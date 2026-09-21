import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { okFetch, setup, USER, where } from './helpers.jsx';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const landingCss = readFileSync(resolve(__dirname, '../styles/landing.css'), 'utf8');

beforeEach(() => {
  localStorage.clear();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

const HEADLINE = 'See how strong your startup idea really is.';
const LEDE = 'SharkAI helps you evaluate your startup idea, understand where it stands, and get clear next steps to move forward.';
const h2s = () => screen.getAllByRole('heading', { level: 2 }).map((h) => h.textContent);
// All visible text in <main>, with a space between elements (textContent would glue neighbours together).
const mainText = () => {
  const walker = document.createTreeWalker(document.querySelector('main'), NodeFilter.SHOW_TEXT);
  const parts = [];
  while (walker.nextNode()) parts.push(walker.currentNode.nodeValue);
  return parts.join(' ');
};

describe('Landing page (/) hero', () => {
  it('shows the headline and the short supporting sentence to a visitor who is not signed in', () => {
    setup('/', { user: null });
    expect(where()).toBe('/');
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe(HEADLINE);
    expect(document.querySelectorAll('.lp-hero p').length).toBe(1);
    expect(document.querySelector('.lp-hero p').textContent).toBe(LEDE);
    expect(document.title).toBe('SharkAI: Know if your startup idea is worth building');
  });

  it('has no label above the headline', () => {
    setup('/', { user: null });
    expect(document.querySelector('.lp-eyebrow')).toBeNull();
    expect(document.querySelector('.lp-hero').firstElementChild.tagName).toBe('H1');
  });

  it('has exactly two buttons: Evaluate My Idea and See How It Works', () => {
    setup('/', { user: null });
    const hero = document.querySelector('.lp-hero');
    expect(within(hero).getAllByRole('link').map((l) => l.textContent)).toEqual(['Evaluate My Idea', 'See How It Works']);
    expect(within(hero).getByRole('link', { name: 'Evaluate My Idea' }).getAttribute('href')).toBe('/evaluate');
    expect(within(hero).getByRole('link', { name: 'See How It Works' }).getAttribute('href')).toBe('#how-it-works');
  });

  it('scrolls to the steps and moves keyboard focus there when "See How It Works" is used', async () => {
    const scroll = vi.spyOn(Element.prototype, 'scrollIntoView');
    setup('/', { user: null });
    await userEvent.click(screen.getByRole('link', { name: 'See How It Works' }));
    expect(scroll).toHaveBeenCalledTimes(1);
    expect(scroll.mock.contexts[0].id).toBe('how-title');
    expect(document.activeElement).toBe(document.getElementById('how-title'));
    expect(where()).toBe('/'); // it stays on the page
  });

  it('can be used from the keyboard', async () => {
    setup('/', { user: null });
    screen.getByRole('link', { name: 'See How It Works' }).focus();
    await userEvent.keyboard('{Enter}');
    expect(document.activeElement).toBe(document.getElementById('how-title'));
  });

  it('is also shown to a signed in user, with no redirect and no separate home screen', () => {
    setup('/');
    expect(where()).toBe('/');
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe(HEADLINE);
    expect(screen.queryByLabelText('Describe your startup idea')).toBeNull();
  });
});

describe('Landing page (/) structure: hero, how it works, what you get, final call to action', () => {
  it('has only those four parts, in that order', () => {
    setup('/', { user: null });
    expect(h2s()).toEqual(['How It Works', 'What You Get', 'Ready to test your idea?']);
    expect([...document.querySelector('.lp').children].map((c) => c.className.split(' ')[0])).toEqual(['lp-hero', 'lp-section', 'lp-section', 'lp-final']);
    expect([...document.querySelectorAll('.lp > section')].map((s) => s.id)).toEqual(['how-it-works', 'get', '']);
  });

  it('shows the three steps with short text', () => {
    setup('/', { user: null });
    const steps = [...document.querySelectorAll('#how-it-works li')];
    expect(steps.map((li) => li.querySelector('.lp-num').textContent)).toEqual(['01', '02', '03']);
    expect(steps.map((li) => li.querySelector('h3').textContent)).toEqual(['Share your idea', 'Get your evaluation', 'Know what to do next']);
    expect(steps.map((li) => li.querySelector('p').textContent)).toEqual([
      'Tell SharkAI about your startup idea.',
      'SharkAI analyzes your idea and gives you useful feedback.',
      'Get clear direction on what to improve or explore next.'
    ]);
  });

  it('shows only three things you get, each with one short line', () => {
    setup('/', { user: null });
    const cards = [...document.querySelectorAll('#get .lp-card')];
    expect(cards.map((c) => c.querySelector('h3').textContent)).toEqual(['Idea Evaluation', 'Actionable Insights', 'Next Steps']);
    expect(cards.map((c) => c.querySelector('p').textContent)).toEqual([
      'Understand the strengths and gaps in your startup idea.',
      'See the key areas that need attention.',
      'Get practical direction for moving your idea forward.'
    ]);
    cards.forEach((c) => { expect(c.querySelectorAll('p').length).toBe(1); expect(c.querySelector('ul, ol')).toBeNull(); });
  });

  it('ends with a simple call to action and the site footer', () => {
    setup('/', { user: null });
    const final = document.querySelector('.lp-final');
    expect(within(final).getByRole('heading', { name: 'Ready to test your idea?' })).toBeTruthy();
    expect(final.querySelectorAll('p').length).toBe(0);
    expect(within(final).getByRole('link', { name: 'Evaluate My Idea' }).getAttribute('href')).toBe('/evaluate');
    expect(screen.getByRole('contentinfo')).toBeTruthy();
    expect(screen.getByRole('navigation', { name: 'Quick links' })).toBeTruthy();
  });
});

describe('Landing page (/) no longer reveals the detailed product', () => {
  it('has none of the removed sections', () => {
    setup('/', { user: null });
    ['what', 'who', 'faq', 'pitch', 'journey'].forEach((id) => expect(document.getElementById(id)).toBeNull());
    expect(screen.queryByRole('heading', { name: /who is it for|frequently asked|founder journey|pitch|turn an idea into a plan/i })).toBeNull();
    expect(document.querySelectorAll('.lp-chips, .lp-stages, .lp-faq, .lp-who, .lp-prose').length).toBe(0);
  });

  it('does not describe the report, the scoring, the journey stages or the pitch', () => {
    setup('/', { user: null });
    expect(mainText()).not.toMatch(/founder|journey|stage|pitch|report|score|scoring|six|seven|6-|7-|investment|feasibility|competition|revenue|students/i);
  });
});

describe('Landing page (/) writing', () => {
  it('does not use the phrases that were removed earlier', () => {
    setup('/', { user: null });
    expect(mainText()).not.toMatch(/startup mentor/i);
    expect(mainText()).not.toMatch(/honest/i);
    expect(mainText()).not.toMatch(/plain English/i);
  });

  it('uses no em dashes and no hyphenated words', () => {
    setup('/', { user: null });
    expect(mainText()).not.toMatch(/[—–]/); // em dash, en dash
    expect(mainText().match(/\w+(?:-\w+)+/g) || []).toEqual([]);
  });

  it('marks sections and headings so screen readers can move around the page', () => {
    setup('/', { user: null });
    document.querySelectorAll('main section').forEach((s) => expect(s.getAttribute('aria-labelledby')).toBeTruthy());
    expect(document.querySelectorAll('main h1').length).toBe(1);
  });
});

describe('Flow: Landing → Sign In / Sign Up → Evaluate', () => {
  it('a visitor who clicks Evaluate My Idea reaches sign in, which also offers sign up', async () => {
    setup('/', { user: null });
    await userEvent.click(within(document.querySelector('.lp-hero')).getByRole('link', { name: 'Evaluate My Idea' }));
    expect(where()).toBe('/login');
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('Welcome back');
    expect(screen.getByRole('link', { name: 'Create one.' }).getAttribute('href')).toBe('/signup');
  });

  it('the navbar Sign In link still opens the sign in page', async () => {
    setup('/', { user: null });
    await userEvent.click(screen.getByRole('link', { name: 'Sign In' }));
    expect(where()).toBe('/login');
  });

  it('after signing in they land directly on the Evaluate page', async () => {
    vi.stubGlobal('fetch', okFetch({ user: USER }));
    setup('/', { user: null });
    await userEvent.click(within(document.querySelector('.lp-final')).getByRole('link', { name: 'Evaluate My Idea' }));
    await userEvent.type(screen.getByLabelText('Email'), 'ada@example.com');
    await userEvent.type(screen.getByLabelText('Password'), 'correct horse');
    await userEvent.click(screen.getByRole('button', { name: 'Sign In' }));
    await waitFor(() => expect(where()).toBe('/evaluate'));
    expect(screen.getByLabelText('Describe your startup idea')).toBeTruthy();
  });

  it('a signed in user goes straight to the Evaluate page', async () => {
    setup('/');
    await userEvent.click(within(document.querySelector('.lp-hero')).getByRole('link', { name: 'Evaluate My Idea' }));
    expect(where()).toBe('/evaluate');
    expect(screen.getByLabelText('Describe your startup idea')).toBeTruthy();
  });
});

describe('Scroll reveal', () => {
  const realObserver = window.IntersectionObserver;
  afterEach(() => { window.IntersectionObserver = realObserver; });

  /** Replaces the always-visible test observer with one the test can fire by hand, like a real scroll. */
  function manualObserver() {
    const seen = [];
    window.IntersectionObserver = class {
      constructor(cb) { this.cb = cb; seen.push(this); }
      observe(el) { this.el = el; }
      unobserve() {}
      disconnect() {}
    };
    return (el) => act(() => seen.find((o) => o.el === el).cb([{ isIntersecting: true, target: el }]));
  }

  it('keeps each section hidden until it scrolls into view, then reveals only that one', () => {
    const scrollTo = manualObserver();
    setup('/', { user: null });
    const sections = [...document.querySelectorAll('.lp-section.reveal, .lp-final.reveal')];
    expect(sections.length).toBe(3);
    sections.forEach((s) => expect(s.classList.contains('in')).toBe(false));
    scrollTo(sections[1]);
    expect(sections[1].classList.contains('in')).toBe(true);
    expect(sections.filter((s) => s.classList.contains('in')).length).toBe(1);
    scrollTo(sections[2]);
    expect(sections[2].classList.contains('in')).toBe(true);
  });

  it('does not hold back the hero: it is not part of the reveal and keeps its own entrance', () => {
    manualObserver();
    setup('/', { user: null });
    const hero = document.querySelector('.lp-hero');
    expect(hero.classList.contains('reveal')).toBe(false);
    expect(hero.closest('.reveal')).toBeNull();
    expect(hero.querySelectorAll('.rise').length).toBe(3);
  });

  it('is subtle: 20px of movement, about half a second, and a gap of 70ms between parts', () => {
    const moves = [...landingCss.matchAll(/translateY\((\d+)px\)/g)].map((m) => Number(m[1]));
    expect(moves.length).toBeGreaterThan(0);
    moves.forEach((px) => { expect(px).toBeGreaterThanOrEqual(15); expect(px).toBeLessThanOrEqual(25); });
    expect(landingCss).toMatch(/transition: opacity \.55s var\(--ease\), transform \.55s var\(--ease\)/);
    expect(landingCss).toMatch(/var\(--i, 0\) \* 70ms/);
    expect(landingCss).not.toMatch(/scale\(|rotate\(|infinite|@keyframes/);
  });

  it('switches off for people who prefer reduced motion', () => {
    const block = landingCss.slice(landingCss.indexOf('@media (prefers-reduced-motion: reduce)'));
    expect(block).toMatch(/opacity: 1; transform: none; transition: none/);
  });
});
