import { afterEach } from 'vitest';
import { cleanup } from '@testing-library/react';

afterEach(() => cleanup());

// jsdom does not implement these
window.scrollTo = () => {};
Element.prototype.scrollIntoView = () => {};
window.matchMedia = window.matchMedia || (() => ({ matches: false, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {} }));
HTMLCanvasElement.prototype.getContext = () => null;
class IO { observe(el) { this.cb?.([{ isIntersecting: true, target: el }]); } unobserve() {} disconnect() {} constructor(cb) { this.cb = cb; } }
window.IntersectionObserver = IO;
