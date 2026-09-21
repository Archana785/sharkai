import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, within, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { okFetch, seedReport, setup, USER, where } from './helpers.jsx';

beforeEach(() => {
  localStorage.clear();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('routes', () => {
  it('"/" is public: a visitor stays on it', () => {
    setup('/', { user: null });
    expect(where()).toBe('/');
  });

  it.each(['/evaluate', '/report', '/journey', '/pitch', '/dashboard', '/saved', '/settings'])('sends a visitor from %s to sign in', (path) => {
    setup(path, { user: null });
    expect(where()).toBe('/login');
    expect(screen.getByText('Welcome back')).toBeTruthy();
  });

  it.each(['/login', '/signup', '/forgot-password'])('sends a signed in user from %s to the Evaluate page', (path) => {
    setup(path);
    expect(where()).toBe('/evaluate');
    expect(screen.getByLabelText('Describe your startup idea')).toBeTruthy();
  });

  it('sends unknown addresses to the landing page', () => {
    setup('/no-such-page', { user: null });
    expect(where()).toBe('/');
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('See how strong your startup idea really is.');
  });

  it('gives each page its own tab title', () => {
    setup('/evaluate');
    expect(document.title).toBe('Evaluate your idea — SharkAI');
  });
});

describe('after signing in or signing up', () => {
  it('signing in lands on the Evaluate page', async () => {
    vi.stubGlobal('fetch', okFetch({ user: USER }));
    setup('/login', { user: null });
    await userEvent.type(screen.getByLabelText('Email'), 'ada@example.com');
    await userEvent.type(screen.getByLabelText('Password'), 'correct horse');
    await userEvent.click(screen.getByRole('button', { name: 'Sign In' }));
    await waitFor(() => expect(where()).toBe('/evaluate'));
    expect(screen.getByLabelText('Describe your startup idea')).toBeTruthy();
  });

  it('creating an account lands on the Evaluate page', async () => {
    vi.stubGlobal('fetch', okFetch({ user: USER }));
    setup('/signup', { user: null });
    await userEvent.type(screen.getByLabelText('Full name'), 'Ada Lovelace');
    await userEvent.type(screen.getByLabelText('Email'), 'ada@example.com');
    await userEvent.type(screen.getByLabelText('Password'), 'correct horse');
    await userEvent.type(screen.getByLabelText('Confirm password'), 'correct horse');
    await userEvent.click(screen.getByRole('button', { name: 'Create Account' }));
    await waitFor(() => expect(where()).toBe('/evaluate'));
  });

  it('a visitor who clicks "Evaluate My Idea" is asked to sign in first', async () => {
    setup('/', { user: null });
    await userEvent.click(within(document.querySelector('.lp-hero')).getByRole('link', { name: 'Evaluate My Idea' }));
    expect(where()).toBe('/login');
  });

  it('a signed in user who clicks "Evaluate My Idea" goes straight to the Evaluate page', async () => {
    setup('/');
    await userEvent.click(within(document.querySelector('.lp-final')).getByRole('link', { name: 'Evaluate My Idea' }));
    expect(where()).toBe('/evaluate');
    expect(screen.getByLabelText('Describe your startup idea')).toBeTruthy();
  });
});

describe('links that used to point at "/"', () => {
  it('the nav links to Evaluate at /evaluate and marks it as the current page there', () => {
    setup('/evaluate');
    const nav = screen.getByRole('navigation', { name: 'Main' });
    const evaluate = within(nav).getByRole('link', { name: 'Evaluate' });
    expect(evaluate.getAttribute('href')).toBe('/evaluate');
    expect(evaluate.getAttribute('aria-current')).toBe('page');
  });

  it('on the landing page no nav link is marked as current', () => {
    setup('/', { user: null });
    const nav = screen.getByRole('navigation', { name: 'Main' });
    expect(within(nav).queryByRole('link', { current: 'page' })).toBeNull();
  });

  it('the nav button goes to /evaluate', () => {
    setup('/', { user: null });
    expect(screen.getByRole('link', { name: 'Evaluate Idea' }).getAttribute('href')).toBe('/evaluate');
  });

  it('on the Evaluate page the nav button just focuses the idea box', async () => {
    setup('/evaluate');
    await userEvent.click(screen.getByRole('link', { name: 'Evaluate Idea' }));
    expect(where()).toBe('/evaluate');
    expect(document.activeElement).toBe(screen.getByLabelText('Describe your startup idea'));
  });

  it('the logo goes to the landing page, from the header and the footer', async () => {
    setup('/evaluate');
    const logos = screen.getAllByRole('link', { name: 'SharkAI home' });
    expect(logos.length).toBe(2);
    logos.forEach((l) => expect(l.getAttribute('href')).toBe('/'));
    await userEvent.click(logos[0]);
    expect(where()).toBe('/');
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('See how strong your startup idea really is.');
  });

  it('the footer quick link for Evaluate goes to /evaluate', () => {
    setup('/', { user: null });
    const quick = screen.getByRole('navigation', { name: 'Quick links' });
    expect(within(quick).getByRole('link', { name: 'Evaluate' }).getAttribute('href')).toBe('/evaluate');
  });

  it('the Dashboard sends people to /evaluate', async () => {
    vi.stubGlobal('fetch', okFetch({ reports: [] }));
    setup('/dashboard');
    expect((await screen.findByRole('link', { name: 'Evaluate a new idea' })).getAttribute('href')).toBe('/evaluate');
  });

  it('the Saved reports page sends people to /evaluate', async () => {
    vi.stubGlobal('fetch', okFetch({ reports: [] }));
    setup('/saved');
    expect((await screen.findByRole('link', { name: 'Evaluate an idea' })).getAttribute('href')).toBe('/evaluate');
  });
});

describe('underwater background', () => {
  const sea = () => document.querySelector('.sea');

  it.each(['/', '/evaluate'])('shows on %s', (path) => {
    setup(path);
    expect(sea()).not.toBeNull();
  });

  it('shows on /journey', () => {
    seedReport();
    setup('/journey');
    expect(sea()).not.toBeNull();
  });

  it('stays off the report page', () => {
    seedReport();
    setup('/report');
    expect(sea()).toBeNull();
  });

  it('stays off the sign in page', () => {
    setup('/login', { user: null });
    expect(sea()).toBeNull();
  });
});
