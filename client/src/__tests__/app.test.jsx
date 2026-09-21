import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { RESULT, okFetch, seedReport, setup, where } from './helpers.jsx';

beforeEach(() => {
  localStorage.clear();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('Evaluate page (/evaluate)', () => {
  it('shows the hero and workspace', () => {
    setup('/evaluate');
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('Know if your startup idea is worth building.');
    expect(screen.queryByText('Startup idea and pitch evaluation')).toBeNull();
    expect(screen.getByText('Get honest, simple feedback, like talking to an experienced startup mentor.')).toBeTruthy();
    expect(screen.getByLabelText('Describe your startup idea')).toBeTruthy();
    expect(screen.queryByText(/Who it is for/)).toBeNull();
    expect(screen.getByRole('button', { name: 'Upload File' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Voice Input' })).toBeTruthy();
    expect(screen.queryByText('Attach Pitch Deck')).toBeNull();
    expect(screen.getByRole('button', { name: /Evaluate Idea/ })).toBeTruthy();
    expect(screen.getByText('Try an example startup')).toBeTruthy();
    expect(screen.getByText('Share your idea')).toBeTruthy();
    expect(screen.getByText('Get report & pitch')).toBeTruthy();
  });

  it('fills the idea box when an example chip is clicked', async () => {
    setup('/evaluate');
    await userEvent.click(screen.getByRole('button', { name: /Study Cafe/ }));
    expect(screen.getByLabelText('Describe your startup idea').value).toMatch(/college students can study comfortably/);
  });

  it('asks for more text instead of evaluating an empty idea', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    setup('/evaluate');
    await userEvent.type(screen.getByLabelText('Describe your startup idea'), 'hi{Enter}');
    expect(await screen.findByText(/Add a sentence or two/)).toBeTruthy();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('evaluates in place: the button spins and a status line shows, then the report opens', async () => {
    let resolve;
    const fetchMock = vi.fn(() => new Promise((r) => { resolve = r; }));
    vi.stubGlobal('fetch', fetchMock);
    setup('/evaluate');
    await userEvent.click(screen.getByRole('button', { name: /Study Cafe/ }));
    await userEvent.click(screen.getByRole('button', { name: /Evaluate Idea/ }));

    const btn = screen.getByRole('button', { name: /Analyzing/ });
    expect(btn.getAttribute('aria-busy')).toBe('true');
    expect(btn.className).toContain('is-loading');
    expect(screen.getByText(/Analyzing your startup idea/)).toBeTruthy();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('/api/evaluate');
    expect(JSON.parse(init.body).idea).toMatch(/college students/);

    resolve({ ok: true, status: 200, json: async () => RESULT });
    expect(await screen.findByText(RESULT.verdict)).toBeTruthy();
    expect(where()).toBe('/report');
    expect(screen.getByRole('img', { name: 'Overall score 74 out of 100' })).toBeTruthy();
    expect(screen.queryByText(/Analyzing your startup idea/)).toBeNull();
  });

  it('shows a friendly error when the AI is down, and can retry', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const down = { ok: false, status: 503, json: async () => ({ error: { code: 'OLLAMA_DOWN', message: 'SharkAI cannot reach Ollama.' } }) };
    const fetchMock = vi.fn().mockResolvedValueOnce(down).mockResolvedValueOnce({ ok: true, status: 200, json: async () => RESULT });
    vi.stubGlobal('fetch', fetchMock);
    setup('/evaluate');
    await userEvent.click(screen.getByRole('button', { name: /Study Cafe/ }));
    await userEvent.click(screen.getByRole('button', { name: /Evaluate Idea/ }));
    expect(await screen.findByText(/We couldn't analyze your idea right now/)).toBeTruthy();
    expect(screen.queryByText(/Ollama/)).toBeNull(); // technical details never reach the screen
    await userEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(await screen.findByText(RESULT.verdict)).toBeTruthy();
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});

describe('Report, Journey, Pitch', () => {
  it('sends you to the Evaluate page when there is no report yet', () => {
    setup('/report');
    expect(where()).toBe('/evaluate');
    expect(screen.getByLabelText('Describe your startup idea')).toBeTruthy();
  });

  it.each(['/journey', '/pitch'])('does the same for %s', (path) => {
    setup(path);
    expect(where()).toBe('/evaluate');
  });

  it('renders the report from the AI JSON: summary first, then six question cards', () => {
    seedReport();
    setup('/report');
    expect(screen.getByText(RESULT.verdict)).toBeTruthy();
    const cards = document.querySelectorAll('.qcard');
    expect(cards.length).toBe(6);
    expect(cards[0].querySelector('h3').textContent).toBe('Does this solve a real problem?');
    expect(cards[0].querySelector('.qcat').textContent).toBe('Problem Validation');
    expect(screen.getByRole('link', { name: /Generate Pitch/ })).toBeTruthy();
  });

  it('links "Evaluate another idea" to the Evaluate page', () => {
    seedReport();
    setup('/report');
    expect(screen.getByRole('link', { name: /Evaluate another idea/ }).getAttribute('href')).toBe('/evaluate');
  });

  it('shows the founder journey as seven stages', () => {
    seedReport();
    setup('/journey');
    expect(document.querySelectorAll('.step').length).toBe(7);
    expect([...document.querySelectorAll('.step .n')].map((n) => n.textContent)).toEqual([
      'Review your evaluation', 'Validate', 'Build an MVP', 'Test', 'Refine & Price', 'Launch', 'Create your pitch'
    ]);
    expect(screen.getByRole('link', { name: 'Back to report' })).toBeTruthy();
  });

  it('shows the pitch as one paragraph with time and word count; regenerate calls the API', async () => {
    seedReport();
    const next = Array.from({ length: 150 }, (_, i) => `fresh${i}`).join(' ');
    const fetchMock = okFetch({ pitch: next });
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
