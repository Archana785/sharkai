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
const h2s = () => screen.getAllByRole('heading', { level: 2 }).map((h) => h.textContent);
// All visible text in <main>, with a space between elements (textContent would glue neighbours together).
const mainText = () => {
  const walker = document.createTreeWalker(document.querySelector('main'), NodeFilter.SHOW_TEXT);
  const parts = [];
  while (walker.nextNode()) parts.push(walker.currentNode.nodeValue);
  return parts.join(' ');
};

describe('Landing page (/) hero', () => {
  it('shows the new headline and sub heading to a visitor who is not signed in', () => {
    setup('/', { user: null });
    expect(where()).toBe('/');
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe(HEADLINE);
    expect(screen.getByText('Share your idea and get a clear assessment of its potential, risks, and next steps.')).toBeTruthy();
    expect(document.title).toBe('SharkAI: Know if your startup idea is worth building');
  });

  it('no longer has the small "AI startup mentor" label above the headline', () => {
    setup('/', { user: null });
    expect(document.querySelector('.lp-eyebrow')).toBeNull();
    expect(screen.queryByText(/startup mentor/i)).toBeNull();
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

describe('Landing page (/) sections', () => {
  it('keeps the same sections, ending with the call to action', () => {
    setup('/', { user: null });
    expect(h2s()).toEqual(['Turn an idea into a plan.', 'How It Works', 'What You Get', 'Who Is It For', 'Frequently Asked Questions', 'Have an idea? Put it to the test.']);
  });

  it('introduces SharkAI with a headline, a main line and a smaller supporting line, as separate paragraphs', () => {
    setup('/', { user: null });
    const what = document.getElementById('what');
    expect(within(what).getByRole('heading', { level: 2 }).textContent).toBe('Turn an idea into a plan.');
    const [main, support, ...rest] = what.querySelectorAll('.lp-prose > p');
    expect(rest.length).toBe(0);
    expect(main.textContent).toBe('SharkAI evaluates your startup idea before you build it.');
    expect(support.textContent).toBe('It analyzes the problem, market, competition, and feasibility to show you where your idea stands and what to work on first.');
    expect(support.className).toBe('lp-support');
  });

  it('leaves the top hero text as it was', () => {
    setup('/', { user: null });
    const hero = document.querySelector('.lp-hero');
    expect(within(hero).getByRole('heading', { level: 1 }).textContent).toBe(HEADLINE);
    expect(within(hero).getByText('Share your idea and get a clear assessment of its potential, risks, and next steps.')).toBeTruthy();
  });

  it('shows the three numbered steps', () => {
    setup('/', { user: null });
    const steps = [...document.querySelectorAll('#how-it-works li')];
    expect(steps.map((li) => li.querySelector('.lp-num').textContent)).toEqual(['01', '02', '03']);
    expect(steps.map((li) => li.querySelector('h3').textContent)).toEqual(['Share Your Idea', 'Get Your Evaluation', 'Know What To Do Next']);
    expect(steps[0].textContent).toMatch(/upload a document or speak your idea/);
    expect(steps[2].textContent).toMatch(/Review the results, follow the founder journey, and prepare your pitch\./);
  });

  it('lists what you get: six areas, seven stages and a pitch', () => {
    setup('/', { user: null });
    const get = document.getElementById('get');
    expect(within(get).getAllByRole('heading', { level: 3 }).map((h) => h.textContent)).toEqual(['6-Area Evaluation', '7-Stage Founder Journey', 'Ready-to-Present Pitch']);
    expect([...within(get).getByRole('list', { name: 'The six areas' }).children].map((li) => li.textContent)).toEqual(
      ['Problem', 'Market', 'Competition', 'Difference', 'Growth', 'Revenue']
    );
    expect([...within(get).getByRole('list', { name: 'The seven stages' }).children].map((li) => li.textContent.replace(/^\d/, ''))).toEqual(
      ['Review', 'Validate', 'Build an MVP', 'Test', 'Refine & Price', 'Launch', 'Create your pitch']
    );
  });

  it('says who it is for, with no extra intro', () => {
    setup('/', { user: null });
    const who = document.getElementById('who');
    expect(within(who).getAllByRole('heading', { level: 3 }).map((h) => h.textContent)).toEqual(['Students', 'First-Time Founders']);
    expect(who.querySelectorAll('p').length).toBe(2);
  });

  it('answers the three questions briefly, and says plainly that the results are not investment advice', () => {
    setup('/', { user: null });
    const faq = document.getElementById('faq');
    expect(within(faq).getAllByRole('heading', { level: 3 }).map((h) => h.textContent)).toEqual(['Is it free?', 'What happens to my idea?', 'Is the feedback guaranteed?']);
    expect(within(faq).getByText(/not investment advice/)).toBeTruthy();
    faq.querySelectorAll('.lp-qa p').forEach((p) => expect(p.textContent.length).toBeLessThan(200));
  });

  it('ends with the new call to action and the site footer', () => {
    setup('/', { user: null });
    const final = document.querySelector('.lp-final');
    expect(within(final).getByRole('heading', { name: 'Have an idea? Put it to the test.' })).toBeTruthy();
    expect(within(final).getByRole('link', { name: 'Evaluate My Idea' }).getAttribute('href')).toBe('/evaluate');
    expect(screen.getByRole('contentinfo')).toBeTruthy();
    expect(screen.getByRole('navigation', { name: 'Quick links' })).toBeTruthy();
  });
});

describe('Landing page (/) writing', () => {
  it('does not repeat the phrases that were removed', () => {
    setup('/', { user: null });
    expect(mainText()).not.toMatch(/startup mentor/i);
    expect(mainText()).not.toMatch(/honest/i);
    expect(mainText()).not.toMatch(/plain English/i);
  });

  it('uses no em dashes, and hyphens only in the headings that call for them', () => {
    setup('/', { user: null });
    expect(mainText()).not.toMatch(/[—–]/); // em dash, en dash
    const hyphenated = mainText().match(/\w+(?:-\w+)+/g) || [];
    expect([...new Set(hyphenated)].sort()).toEqual(['6-Area', '7-Stage', 'First-Time', 'Ready-to-Present']);
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
    expect(sections.length).toBe(6);
    sections.forEach((s) => expect(s.classList.contains('in')).toBe(false));
    scrollTo(sections[1]);
    expect(sections[1].classList.contains('in')).toBe(true);
    expect(sections.filter((s) => s.classList.contains('in')).length).toBe(1);
    scrollTo(sections[5]);
    expect(sections[5].classList.contains('in')).toBe(true);
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
