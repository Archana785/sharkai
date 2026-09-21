import { vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, useLocation } from 'react-router-dom';
import App from '../App.jsx';
import { AuthProvider } from '../context/AuthContext.jsx';
import { EvalProvider } from '../context/EvalContext.jsx';

export const USER = { id: 'u1', name: 'Ada Lovelace', email: 'ada@example.com' };

const area = (score, title, term) => ({ score, title, description: `About ${title}`, insight: 'Do one thing.', businessTerm: term });
export const RESULT = {
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

/** Puts a finished report where the app keeps it for a visitor with no account id (the tests render without one). */
export const seedReport = () =>
  localStorage.setItem('sharkai:v3:anon', JSON.stringify({ idea: 'x', analyzedIdea: 'A study cafe for students. More text.', result: RESULT }));

/** Invisible marker that lets a test read the current route. */
function Where() {
  const { pathname } = useLocation();
  return <div data-testid="where" hidden>{pathname}</div>;
}
export const where = () => screen.getByTestId('where').textContent;

/** Renders the whole app at `path`. Signed in as USER by default; pass `{ user: null }` for a visitor. */
export function setup(path = '/evaluate', { user = USER } = {}) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <AuthProvider initialUser={user}>
        <EvalProvider><App /></EvalProvider>
      </AuthProvider>
      <Where />
    </MemoryRouter>
  );
}

/** A fetch mock that answers every call with `body`. */
export const okFetch = (body) => vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => body });
