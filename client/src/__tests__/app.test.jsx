import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import App from '../App.jsx';
import { EvalProvider } from '../context/EvalContext.jsx';

const area = (score, title, term) => ({ score, title, description: `About ${title}`, insight: 'Do one thing.', businessTerm: term });
const RESULT = {
  overallScore: 74,
  verdict: 'A promising idea with a real problem behind it.',
  strengths: ['Strong one', 'Strong two', 'Strong three'],
  improvements: ['Fix one', 'Fix two', 'Fix three'],
  evaluation: {
    problem: area(84, 'Does this solve a real problem?', 'Problem Validation'),
    market: area(78, 'Will people actually use it?', 'Market Potential'),
    competition: area(58, 'How crowded is the market?', 'Competition Analysis'),
    difference: area(72, 'What makes it different?', 'USP (Unique Selling Proposition)'),
    growth: area(70, 'Can this grow?', 'Scalability'),
    revenue: area(64, 'Can it make money?', 'Revenue Model')
  },
  roadmap: ['Talk to customers: Interview ten people.', 'Build a prototype: Keep it tiny.', 'Get users: Find five.', 'Practice: Say it out loud.'],
  pitch: Array.from({ length: 200 }, (_, i) => `word${i}`).join(' ')
};

function setup(path = '/') {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <EvalProvider><App /></EvalProvider>
    </MemoryRouter>
  );
}

beforeEach(() => { localStorage.clear(); vi.restoreAllMocks(); });

describe('Home', () => {
  it('shows the simplified hero and workspace', () => {
    setup();
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('Know if your startup ideais worth building.');
    expect(screen.queryByText('Startup idea and pitch evaluation')).toBeNull();
    expect(screen.queryByText(/Describe it in your own words/)).toBeNull();
    expect(screen.getByText('Get honest, easy-to-read feedback, like talking to an experienced startup mentor.')).toBeTruthy();
    expect(screen.getByText('Describe your startup idea')).toBeTruthy();
    expect(screen.queryByText(/Who it is for/)).toBeNull();
    expect(screen.getByRole('button', { name: 'Upload File' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Voice Input' })).toBeTruthy();
    expect(screen.queryByText('Attach Pitch Deck')).toBeNull();
    expect(screen.getByRole('button', { name: /Evaluate Idea/ })).toBeTruthy();
    expect(screen.getByText('Try an example startup')).toBeTruthy();
    expect(screen.queryByText('We will look at')).toBeNull();
    expect(screen.getByText('Share your idea')).toBeTruthy();
    expect(screen.getByText('Improve & Pitch')).toBeTruthy();
  });

  it('fills the idea box when an example chip is clicked', async () => {
    setup();
    await userEvent.click(screen.getByRole('button', { name: /Study Café/ }));
    expect(screen.getByLabelText('Describe your startup idea').value).toMatch(/college students can study comfortably/);
  });

  it('asks for more text instead of evaluating an empty idea', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    setup();
    await userEvent.type(screen.getByLabelText('Describe your startup idea'), 'hi{Enter}');
    expect(await screen.findByText(/Add a sentence or two/)).toBeTruthy();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('evaluates in place: button spins, box shows progress, then the score ring appears in the same box', async () => {
    let resolve;
    const fetchMock = vi.fn(() => new Promise((r) => { resolve = r; }));
    vi.stubGlobal('fetch', fetchMock);
    setup();
    await userEvent.click(screen.getByRole('button', { name: /Study Café/ }));
    await userEvent.type(screen.getByLabelText('Describe your startup idea'), '{Enter}'.replace('{Enter}', ' '));
    await userEvent.type(screen.getByLabelText('Describe your startup idea'), '{Enter}');

    const btn = screen.getByRole('button', { name: /Evaluating/ });
    expect(btn.getAttribute('aria-busy')).toBe('true');
    expect(btn.className).toContain('is-loading');
    expect(screen.getByText('READING YOUR IDEA')).toBeTruthy();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('/api/evaluate');
    expect(JSON.parse(init.body).idea).toMatch(/college students/);

    resolve({ ok: true, status: 200, json: async () => RESULT });
    expect(await screen.findByText(RESULT.verdict)).toBeTruthy();
    expect(screen.getByRole('img', { name: 'Overall score 74 out of 100' })).toBeTruthy();
    expect(screen.getByRole('link', { name: /See full report/ })).toBeTruthy();
    expect(screen.queryByText('READING YOUR IDEA')).toBeNull();
  });

  it('shows a friendly error with a hint when Ollama is down, and can retry', async () => {
    const down = { ok: false, status: 503, json: async () => ({ error: { code: 'OLLAMA_DOWN', message: 'SharkAI cannot reach Ollama.' } }) };
    const fetchMock = vi.fn().mockResolvedValueOnce(down).mockResolvedValueOnce({ ok: true, status: 200, json: async () => RESULT });
    vi.stubGlobal('fetch', fetchMock);
    setup();
    await userEvent.click(screen.getByRole('button', { name: /Study Café/ }));
    await userEvent.click(screen.getByRole('button', { name: /Evaluate Idea/ }));
    expect(await screen.findByText('SharkAI cannot reach Ollama.')).toBeTruthy();
    expect(screen.getByText('ollama serve')).toBeTruthy();
    await userEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(await screen.findByText(RESULT.verdict)).toBeTruthy();
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});

describe('Report, Journey, Pitch', () => {
  const seed = () => localStorage.setItem('sharkai:v2', JSON.stringify({ idea: 'x', analyzedIdea: 'A study cafe for students. More text.', result: RESULT }));

  it('redirects to Home when there is no report yet', () => {
    setup('/report');
    expect(screen.getByText('Describe your startup idea')).toBeTruthy();
  });

  it('renders the report from the AI JSON: summary first, then six question cards', () => {
    seed();
    setup('/report');
    expect(screen.getByText(RESULT.verdict)).toBeTruthy();
    expect(screen.getByText('Top 3 strengths')).toBeTruthy();
    expect(screen.getByText('Top 3 improvements')).toBeTruthy();
    RESULT.strengths.concat(RESULT.improvements).forEach((t) => expect(screen.getByText(t)).toBeTruthy());
    const cards = document.querySelectorAll('.qcard');
    expect(cards.length).toBe(6);
    const first = within(cards[0]);
    expect(first.getByRole('heading', { name: 'Does this solve a real problem?' })).toBeTruthy();
    expect(first.getByText('Problem Validation')).toBeTruthy();
    // business term sits below the explanation
    expect(cards[0].lastElementChild.textContent).toBe('Problem Validation');
    expect(screen.getByRole('link', { name: /Generate Pitch/ })).toBeTruthy();
  });

  it('renders the AI roadmap as a horizontal journey', () => {
    seed();
    setup('/journey');
    expect(document.querySelectorAll('.step').length).toBe(6);
    expect(screen.getAllByText('Talk to customers').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Interview ten people.').length).toBeGreaterThan(0);
  });

  it('shows the pitch as one paragraph with time and word count; regenerate calls the API', async () => {
    seed();
    const next = Array.from({ length: 150 }, (_, i) => `fresh${i}`).join(' ');
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => ({ pitch: next }) });
    vi.stubGlobal('fetch', fetchMock);
    setup('/pitch');
    expect(document.querySelectorAll('.pitch-text').length).toBe(1);
    expect(screen.getByText('200 words')).toBeTruthy();
    expect(screen.getByText(/About 1:32 to say/)).toBeTruthy();
    expect(screen.getByRole('button', { name: /Copy/ })).toBeTruthy();
    expect(screen.getByRole('button', { name: /Download/ })).toBeTruthy();
    await userEvent.click(screen.getByRole('button', { name: /Regenerate/ }));
    await waitFor(() => expect(screen.getByText('150 words')).toBeTruthy());
    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body.idea).toMatch(/study cafe/);
    expect(body.variant).toBe(1);
  });
});
