/** Thin client for the SharkAI Express API. Every failure becomes an ApiError with a friendly message. */

export class ApiError extends Error {
  constructor(message, code = 'ERROR', status = 0, fields) {
    super(message);
    this.name = 'ApiError';
    this.code = code;
    this.status = status;
    this.fields = fields; // { fieldName: 'friendly message' } when a form field was rejected
  }
}

async function request(path, init = {}) {
  let res;
  try {
    res = await fetch(path, { credentials: 'same-origin', ...init });
  } catch (err) {
    if (err?.name === 'AbortError') throw err; // the caller cancelled on purpose
    throw new ApiError("We can't reach SharkAI right now. Please try again in a moment.", 'NETWORK');
  }
  const body = await res.json().catch(() => null);
  if (!res.ok) {
    const e = body?.error;
    // Session ended (or never started): tell the app so it can show the sign-in page.
    if (res.status === 401 && e?.code === 'UNAUTHENTICATED') window.dispatchEvent(new Event('sharkai:unauthorized'));
    if (e?.message) throw new ApiError(e.message, e.code, res.status, e.fields);
    if (res.status >= 500) throw new ApiError("We can't reach SharkAI right now. Please try again in a moment.", 'NETWORK', res.status);
    throw new ApiError(`Something went wrong (${res.status}). Please try again.`, `HTTP_${res.status}`, res.status);
  }
  return body;
}

const send = (method, data, signal) => ({
  method,
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(data ?? {}),
  signal
});
const json = (data, signal) => send('POST', data, signal);

/** idea -> { reportId, overallScore, verdict, strengths, improvements, evaluation, roadmap, pitch } */
export const evaluateIdea = (idea, signal) => request('/api/evaluate', json({ idea }, signal));

/** Rewrites four short next steps as full paragraphs (older reports) -> { roadmap: [four strings] } */
export const expandRoadmap = (idea, steps, signal) => request('/api/roadmap', json({ idea, steps }, signal));

/** -> { pitch } */
export const generatePitch = (payload, signal) => request('/api/pitch', json(payload, signal));

/** Upload a pitch deck or document -> { text, truncated } */
export function extractFile(file) {
  const form = new FormData();
  form.append('file', file);
  return request('/api/extract', { method: 'POST', body: form });
}

/** Accounts. `me` answers { user: null } when signed out. */
export const authApi = {
  me: () => request('/api/auth/me'),
  login: (data) => request('/api/auth/login', json(data)),
  register: (data) => request('/api/auth/register', json(data)),
  logout: () => request('/api/auth/logout', json({})),
  forgot: (email) => request('/api/auth/forgot', json({ email })),
  reset: (token, password) => request('/api/auth/reset', json({ token, password })),
  updateName: (name) => request('/api/auth/me', send('PATCH', { name })),
  changePassword: (current, password) => request('/api/auth/password', json({ current, password }))
};

/** Saved reports (every evaluation is saved to the signed-in account). */
export const reportsApi = {
  list: () => request('/api/reports'),
  get: (id) => request(`/api/reports/${encodeURIComponent(id)}`),
  remove: (id) => request(`/api/reports/${encodeURIComponent(id)}`, { method: 'DELETE' })
};