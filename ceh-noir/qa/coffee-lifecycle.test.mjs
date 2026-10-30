import test from 'node:test';
import assert from 'node:assert/strict';
import { initCoffeeStory } from '../coffee-story.js';

// Verify failure and accessibility paths without creating a graphics context.
function browserFixture(t, { reduced = false, memory = 8 } = {}) {
  const saved = new Map();
  const put = (key, value) => { saved.set(key, Object.getOwnPropertyDescriptor(globalThis, key)); Object.defineProperty(globalThis, key, { configurable: true, value }); };
  t.after(() => { for (const [key, descriptor] of saved) { if (descriptor) Object.defineProperty(globalThis, key, descriptor); else delete globalThis[key]; } });
  const events = {}, observers = [], frames = new Map();
  const add = (key, listener) => { events[key] = listener; };
  const media = { matches: reduced, addEventListener: (key, callback) => { events.media = callback; } };
  put('matchMedia', () => media);
  put('navigator', { deviceMemory: memory, hardwareConcurrency: 8 });
  put('innerWidth', 1440); put('devicePixelRatio', 1); put('scrollY', 0);
  put('window', { addEventListener: add });
  put('document', { hidden: false, body: { classList: { contains: () => false } }, addEventListener: add });
  put('requestAnimationFrame', callback => { const id = frames.size + 1; frames.set(id, callback); return id; });
  put('cancelAnimationFrame', id => frames.delete(id));
  put('IntersectionObserver', class {
    constructor(callback, options) { this.callback = callback; this.options = options; observers.push(this); }
    observe() {}
  });
  put('ResizeObserver', class { observe() {} });
  const style = { setProperty() {} };
  const story = { getBoundingClientRect: () => ({ top: -1000, height: 3200 }) };
  const canvas = { addEventListener: add };
  const elements = { '.coffee-story': story, '.coffee-stage': { clientHeight: 1000, clientWidth: 1440, style }, canvas, '.coffee-copy': { style } };
  const root = { dataset: {}, querySelector: key => elements[key] };
  const enter = () => observers.forEach(observer => observer.callback([{ isIntersecting: true }]));
  return { root, enter, events, media, frames };
}
const flush = async () => { for (let i = 0; i < 6; i++) await Promise.resolve(); };

test('the supplied 3D scene stops rendering when scroll settles instead of running the photo steam clock', async t => {
  const { root, enter, frames } = browserFixture(t);
  root.dataset.coffeeRenderer = '3d';
  initCoffeeStory(root, { loadScene: async () => ({ createCoffeeScene: async () => ({ resize() {}, render() {}, dispose() {} }) }) });
  enter(); await flush();
  assert.equal(root.dataset.coffeeMode, 'webgl');
  assert.ok(frames.size > 0);
  const callbacks = [...frames.values()]; frames.clear();
  callbacks.forEach(callback => callback(100));
  assert.equal(frames.size, 0, 'A settled 3D shot must not keep a free-running animation frame');
});

test('reduced motion and low memory use the poster without loading the selected 3D renderer', async t => {
  for (const options of [{ reduced: true }, { memory: 2 }]) {
    await t.test(JSON.stringify(options), subtest => {
      const { root } = browserFixture(subtest, options);
      root.dataset.coffeeRenderer = '3d';
      let loads = 0;
      initCoffeeStory(root, { loadScene: () => { loads++; throw new Error('must not load'); } });
      assert.equal(root.dataset.coffeeMode, 'poster');
      assert.equal(root.dataset.coffeeProgress, '1.0000');
      assert.equal(loads, 0);
    });
  }
});

test('failed renderer load shows the final poster instead of an empty long section', async t => {
  const { root, enter } = browserFixture(t);
  initCoffeeStory(root, { loadScene: async () => { throw new Error('Photo assets unavailable'); } });
  enter(); await flush();
  assert.equal(root.dataset.coffeeMode, 'poster');
  assert.equal(root.dataset.coffeeStage, 'final');
});

test('context loss and a late async renderer cannot replace the static fallback', async t => {
  const { root, enter, events } = browserFixture(t);
  let release, disposed = 0;
  const renderer = { resize() {}, render() {}, dispose() { disposed++; } };
  initCoffeeStory(root, { loadScene: async () => ({ createCoffeeScene: () => new Promise(resolve => { release = resolve; }) }) });
  enter(); await flush();
  events.contextlost();
  release(renderer); await flush();
  assert.equal(root.dataset.coffeeMode, 'poster');
  assert.equal(disposed, 1);
});

test('renderer pauses while hidden and disposes when reduced motion is enabled', async t => {
  const { root, enter, events, media, frames } = browserFixture(t);
  let disposed = 0;
  initCoffeeStory(root, { loadScene: async () => ({ createCoffeeScene: async () => ({ resize() {}, render() {}, dispose() { disposed++; } }) }) });
  enter(); await flush();
  assert.equal(root.dataset.coffeeMode, 'sequence');
  assert.ok(frames.size > 0);
  document.hidden = true; events.visibilitychange();
  assert.equal(frames.size, 0);
  media.matches = true; events.media();
  assert.equal(root.dataset.coffeeMode, 'poster');
  assert.equal(disposed, 1);
});

test('animation can be enabled after the page initially loads with reduced motion', async t => {
  const { root, enter, events, media } = browserFixture(t, { reduced: true });
  let loads = 0;
  initCoffeeStory(root, { loadScene: async () => {
    loads++;
    return { createCoffeeScene: async () => ({ resize() {}, render() {}, dispose() {} }) };
  } });
  enter(); await flush();
  assert.equal(root.dataset.coffeeMode, 'poster');
  assert.equal(loads, 0);
  media.matches = false; events.media(); await flush();
  assert.equal(root.dataset.coffeeMode, 'sequence');
  assert.equal(loads, 1);
});

test('a stale rejected load cannot disable a newer successful photo renderer', async t => {
  const { root, enter, events, media } = browserFixture(t);
  let rejectOld, loads = 0;
  initCoffeeStory(root, { loadScene: () => {
    if (++loads === 1) return new Promise((resolve, reject) => { rejectOld = reject; });
    return Promise.resolve({ createCoffeeScene: async () => ({ resize() {}, render() {}, dispose() {} }) });
  } });
  enter(); await flush();
  media.matches = true; events.media();
  media.matches = false; events.media(); await flush();
  assert.equal(root.dataset.coffeeMode, 'sequence');
  rejectOld(new Error('Old image decode failed')); await flush();
  assert.equal(root.dataset.coffeeMode, 'sequence');
});

test('failed canvas resize retains the poster and disposes the failed renderer', async t => {
  const { root, enter } = browserFixture(t);
  let disposed = 0;
  initCoffeeStory(root, { loadScene: async () => ({ createCoffeeScene: async () => ({
    resize() { throw new Error('Canvas surface unavailable'); },
    render() {},
    dispose() { disposed++; },
  }) }) });
  enter(); await flush();
  assert.equal(root.dataset.coffeeMode, 'poster');
  assert.equal(disposed, 1);
});
