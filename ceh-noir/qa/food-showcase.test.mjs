import test from 'node:test';
import assert from 'node:assert/strict';
import { showcaseFrame, chapterProgress } from '../food-showcase-model.js';
import { initFoodShowcase } from '../food-showcase.js';

test('One clock has bounded poses, controlled overlaps and an occupied final frame', () => {
  for (let i = 0; i <= 1000; i++) {
    const p = i / 1000, frame = showcaseFrame(p);
    assert.ok(frame.panels.filter(s => s.product.opacity > .01).length <= 2);
    assert.ok(frame.panels.filter(s => s.title > .1).length <= 1);
    if (p > .07) assert.ok(Math.max(...frame.panels.map(s => s.product.opacity)) > .25, 'No empty transition in the shared stage');
    frame.panels.forEach(s => {
      const pose = s.product;
      for (const v of Object.values(pose)) assert.ok(Number.isFinite(v));
      assert.ok(pose.opacity >= 0 && pose.opacity <= 1); assert.ok(pose.scale >= .94 && pose.scale <= 1);
    });
  }
  const final = showcaseFrame(1).panels[2];
  assert.equal(final.product.opacity, 1); assert.equal(final.title, 1); assert.equal(final.details, 1);
});
test('Each reading plateau fully reveals the correct chapter, controls and lines', () => {
  for (let index = 0; index < 3; index++) {
    const frame = showcaseFrame(chapterProgress(index)), s = frame.panels[index];
    assert.equal(frame.active, index); assert.equal(s.product.opacity, 1); assert.equal(s.title, 1);
    assert.equal(s.description(1), 1); assert.equal(s.option(4), 1); assert.equal(s.details, 1);
  }
  const productFirst = showcaseFrame(.22 / 3.35).panels[0];
  assert.equal(productFirst.product.opacity, 1); assert.equal(productFirst.title, 0);
  assert.equal(productFirst.description(0), 0); assert.equal(productFirst.option(0), 0);
});
test('Reverse seeking is deterministic and compact scenes retain direction with less travel', () => {
  const snapshot = frame => ({ ...frame, panels: frame.panels.map(s => ({ ...s, description: [s.description(0), s.description(1)], option: Array.from({ length: 5 }, (_, i) => s.option(i)) })) });
  const saved = new Map();
  for (let i = 0; i <= 100; i++) saved.set(i, snapshot(showcaseFrame(i / 100)));
  for (let i = 100; i >= 0; i--) assert.deepEqual(snapshot(showcaseFrame(i / 100)), saved.get(i));
  for (const p of [.02, .35, .68]) {
    const desktop = showcaseFrame(p), mobile = showcaseFrame(p, 3, true);
    assert.equal(mobile.active, desktop.active);
    desktop.panels.forEach((s, i) => {
      assert.equal(mobile.panels[i].product.opacity, s.product.opacity);
      assert.ok(Math.abs(mobile.panels[i].product.x) <= Math.abs(s.product.x));
    });
  }
});

function mount(t, { reduced = false } = {}) {
  const saved = new Map(), frames = new Map(); let next = 0, observe;
  const put = (key, value) => { saved.set(key, Object.getOwnPropertyDescriptor(globalThis, key)); Object.defineProperty(globalThis, key, { configurable: true, value }); };
  t.after(() => { for (const [key, desc] of saved) if (desc) Object.defineProperty(globalThis, key, desc); else delete globalThis[key]; });
  const document = Object.assign(new EventTarget(), { hidden: false, activeElement: null, body: { classList: { contains: () => false } } });
  const node = () => Object.assign(new EventTarget(), {
    style: {}, dataset: {}, inert: false, attrs: new Map(),
    setAttribute(key, value) { this.attrs.set(key, value); },
    removeAttribute(key) { this.attrs.delete(key); if (key === 'style') this.style = {}; },
    focus() { document.activeElement = this; }
  });
  const panels = Array.from({ length: 3 }, (_, index) => {
    const element = node(), title = node(), heading = node(), product = node(), details = node(), description = [node(), node()];
    const options = Array.from({ length: index ? 3 : 5 }, () => { const b = node(), ink = node(); b.querySelector = () => ink; return b; });
    element.dataset.chapter = ['porridge', 'syrniki', 'pasta'][index]; element.id = element.dataset.chapter;
    heading.focus = () => { assert.equal(element.inert, false, 'Enable destination before transferring focus'); document.activeElement = heading; };
    const selectors = { '.food-arrival': product, '.food-title-ink': title, '.food-details': details, 'h2': heading };
    element.querySelector = selector => selectors[selector]; element.querySelectorAll = selector => selector === '.food-description-ink' ? description : options;
    element.contains = target => [heading, details, ...options].includes(target);
    return { element, heading, product, details, options };
  });
  const stage = { offsetHeight: 900 };
  const root = node(); root.offsetHeight = 3690; root.querySelectorAll = () => panels.map(p => p.element); root.querySelector = () => stage;
  const window = Object.assign(new EventTarget(), { innerWidth: 1440, innerHeight: 900, scrollY: 1500 });
  root.getBoundingClientRect = () => ({ top: 1000 - window.scrollY });
  window.scrollTo = ({ top }) => { window.scrollY = top; };
  const media = Object.assign(new EventTarget(), { matches: reduced });
  put('window', window); put('document', document); put('matchMedia', () => media);
  put('requestAnimationFrame', callback => { frames.set(++next, callback); return next; }); put('cancelAnimationFrame', id => frames.delete(id));
  put('IntersectionObserver', class { constructor(callback) { observe = callback; } observe() {} disconnect() {} });
  const dispose = initFoodShowcase(root);
  const run = () => { for (let i = 0; frames.size && i < 300; i++) { const pending = [...frames.values()]; frames.clear(); pending.forEach(fn => fn(performance.now() + i * 16)); } };
  return { root, stage, panels, window, document, media, frames, dispose, run, intersect: active => observe([{ isIntersecting: active }]) };
}
test('Scrub reverses from the current pose, stops when idle/hidden and restores immediately', t => {
  const s = mount(t); s.window.scrollY = 2500; s.window.dispatchEvent(new Event('scroll'));
  assert.equal(s.frames.size, 1); s.run(); assert.equal(s.frames.size, 0); assert.equal(s.root.dataset.foodChapter, 'syrniki');
  const before = s.root.dataset.foodProgress; s.window.innerWidth = 390; s.window.dispatchEvent(new Event('resize'));
  assert.equal(s.root.dataset.foodMode, 'compact'); assert.equal(s.root.dataset.foodProgress, before);
  s.window.innerHeight = 844; s.root.offsetHeight = 3100; s.stage.offsetHeight = 844; s.window.dispatchEvent(new Event('resize'));
  assert.equal(s.root.dataset.foodProgress, before, 'Same-mode resizing also preserves the logical scene');
  s.window.scrollY = 1600; s.window.dispatchEvent(new Event('scroll')); s.run();
  assert.equal(s.root.dataset.foodChapter, 'porridge'); assert.equal(s.root.dataset.foodFrames, 'idle');
  s.window.scrollY = 3200; s.window.dispatchEvent(new Event('scroll')); s.intersect(false); assert.equal(s.frames.size, 0);
  s.intersect(true); assert.equal(s.root.dataset.foodChapter, 'pasta');
  s.document.hidden = true; s.document.dispatchEvent(new Event('visibilitychange')); assert.equal(s.frames.size, 0);
  s.dispose(); s.window.dispatchEvent(new Event('scroll')); assert.equal(s.frames.size, 0);
});
test('Reduced motion exposes the document; local Tab order reaches every chapter', t => {
  const s = mount(t);
  s.window.scrollY = 1000; s.window.dispatchEvent(new Event('scroll')); s.run();
  assert.equal(s.panels[0].options[0].tabIndex, 0, 'Keyboard can enter an unrevealed scene');
  s.document.activeElement = s.panels[0].options[0]; s.root.dispatchEvent(new Event('focusin'));
  assert.equal(s.panels[0].details.style.opacity, '1', 'Focus immediately resolves to the reading plateau');
  s.document.activeElement = s.panels[0].details;
  const tab = Object.assign(new Event('keydown', { cancelable: true }), { key: 'Tab', shiftKey: false });
  s.root.dispatchEvent(tab);
  assert.equal(tab.defaultPrevented, true); assert.equal(s.root.dataset.foodChapter, 'syrniki'); assert.equal(s.document.activeElement, s.panels[1].options[0]);
  s.media.matches = true; s.media.dispatchEvent(new Event('change'));
  assert.equal(s.root.dataset.foodMode, 'static'); assert.ok(s.panels.every(p => p.element.inert === false)); assert.equal(s.frames.size, 0);
  s.dispose();
});

test('Restored chapter links seek after native restoration and dispose cancels the pending seek', t => {
  const s = mount(t); s.window.location = { hash: '#syrniki' };
  s.window.dispatchEvent(new Event('pageshow')); assert.equal(s.frames.size, 1); s.run();
  assert.equal(s.root.dataset.foodChapter, 'syrniki');
  s.window.location.hash = '#porridge'; s.window.dispatchEvent(new Event('hashchange'));
  assert.equal(s.root.dataset.foodChapter, 'porridge');
  s.window.dispatchEvent(new Event('pageshow')); s.dispose(); assert.equal(s.frames.size, 0);
});
