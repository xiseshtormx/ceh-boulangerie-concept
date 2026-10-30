import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { typeTiming } from '../hero-type.js';

const source = readFileSync(new URL('../hero-type.js', import.meta.url), 'utf8').replaceAll('export ', '');
const flush = async () => { for (let i = 0; i < 5; i++) await Promise.resolve(); };
const classes = initial => {
  const set = new Set(initial);
  return { contains: value => set.has(value), remove: value => set.delete(value) };
};
function scene({ reduced = false, offset = 0 } = {}) {
  let ready;
  const records = [], frames = new Map(), timers = new Map();
  const node = () => ({ style: {}, animate: (keyframes, options) => {
    let finish;
    const record = { keyframes, options, cancelled: false, finished: new Promise(resolve => { finish = resolve; }), finish: () => finish(), cancel() { this.cancelled = true; finish(); } };
    records.push(record); return record;
  } });
  const words = [8, 7].map(count => Object.assign(node(), { querySelectorAll: () => Array.from({ length: count }, node) }));
  const caption = node();
  const hero = { offsetHeight: 900, dataset: {}, querySelector: selector => selector === '.hero-copy p' ? caption : words[selector === '.hero-word-order' ? 0 : 1] };
  const media = Object.assign(new EventTarget(), { matches: reduced });
  const document = Object.assign(new EventTarget(), {
    hidden: false, documentElement: { classList: classes(['hero-type-pending']), dataset: { heroType: 'b' } },
    body: { classList: classes([]) }, fonts: { ready: new Promise(resolve => { ready = resolve; }) }, querySelector: () => null
  });
  const window = new EventTarget();
  let observer, next = 0;
  const context = { document, window, hero, scrollY: offset, matchMedia: () => media, performance: { now: () => 0 },
    requestAnimationFrame: fn => { frames.set(++next, fn); return next; }, cancelAnimationFrame: id => frames.delete(id),
    setTimeout: fn => { timers.set(++next, fn); return next; }, clearTimeout: id => timers.delete(id),
    IntersectionObserver: class { constructor(callback) { observer = callback; } observe() {} disconnect() {} }
  };
  const dispose = vm.runInNewContext(source + '\ninitHeroType(hero);', context);
  const runFrames = () => { for (let time = 16, i = 0; frames.size && i < 200; i++, time += 16) { const pending = [...frames.values()]; frames.clear(); pending.forEach(fn => fn(time)); } };
  return { hero, media, document, window, words, records, frames, timers, context, ready, dispose, runFrames, intersect: value => observer([{ isIntersecting: value }]) };
}

test('Assembly waits for fonts, overlaps both rows, then releases every effect', async () => {
  const s = scene();
  assert.equal(s.hero.dataset.typeState, 'waiting'); assert.equal(s.records.length, 0);
  s.ready(); await flush();
  assert.equal(s.hero.dataset.typeState, 'assembling'); assert.equal(s.records.length, 16);
  assert.equal(s.document.documentElement.classList.contains('hero-type-pending'), false);
  assert.equal(Math.max(...s.records.map(r => r.options.duration + (r.options.delay || 0))), 1382);
  assert.ok(typeTiming(1, 0).delay < typeTiming(0, 7).delay + typeTiming(0, 7).duration);
  s.records.forEach(r => r.finish()); await flush(); s.runFrames();
  assert.equal(s.hero.dataset.typeState, 'settled'); assert.ok(s.records.every(r => r.cancelled));
  assert.equal(s.frames.size, 0); s.dispose();
});

test('Keyboard, reduced motion and restored scroll show complete text without an entrance', async () => {
  for (const options of [{ reduced: true }, { offset: 300 }, {}]) {
    const s = scene(options);
    if (!options.reduced && !options.offset) s.document.dispatchEvent(new Event('keydown'));
    s.ready(); await flush(); s.runFrames();
    assert.equal(s.records.length, 0); assert.equal(s.hero.dataset.typeState, 'settled');
    assert.equal(s.document.documentElement.classList.contains('hero-type-pending'), false);
    s.dispose(); assert.equal(s.timers.size, 0);
  }
});

test('Reduced motion cancels an active assembly and history restoration never replays it', async () => {
  const s = scene(); s.ready(); await flush();
  s.media.matches = true; s.media.dispatchEvent(new Event('change')); await flush();
  assert.ok(s.records.every(r => r.cancelled)); assert.equal(s.hero.dataset.typeState, 'settled');
  const count = s.records.length;
  s.window.dispatchEvent(Object.assign(new Event('pageshow'), { persisted: true }));
  s.media.matches = false; s.media.dispatchEvent(new Event('change')); s.runFrames();
  assert.equal(s.records.length, count); s.dispose();
});

test('Scroll reverses from its current pose, stops offscreen and leaves no idle frames', async () => {
  const s = scene({ offset: 300 });
  s.runFrames(); assert.match(s.words[0].style.transform, /-4px/);
  s.context.scrollY = 450; s.window.dispatchEvent(new Event('scroll'));
  const [id, step] = [...s.frames][0]; s.frames.delete(id); step(16);
  s.context.scrollY = 0; s.window.dispatchEvent(new Event('scroll')); s.runFrames();
  assert.equal(s.words[0].style.transform, 'translate3d(0px,0,0)'); assert.equal(s.frames.size, 0);
  s.context.scrollY = 600; s.window.dispatchEvent(new Event('scroll')); s.intersect(false);
  assert.equal(s.frames.size, 0); s.intersect(true); s.runFrames(); assert.equal(s.frames.size, 0);
  s.dispose(); assert.equal(s.frames.size, 0);
});

test('A stalled font load fails open; disposing during font loading cannot start animation', async () => {
  const timeout = scene(); [...timeout.timers.values()][0](); await flush();
  assert.equal(timeout.hero.dataset.typeState, 'settled'); assert.equal(timeout.records.length, 0); timeout.dispose();
  const disposed = scene(); disposed.dispose(); disposed.ready(); await flush();
  assert.equal(disposed.records.length, 0); assert.equal(disposed.timers.size, 0);
});

test('Leaving the first screen during assembly reveals all remaining glyphs immediately', async () => {
  const s = scene(); s.ready(); await flush();
  s.context.scrollY = 150; s.window.dispatchEvent(new Event('scroll')); await flush(); s.runFrames();
  assert.equal(s.hero.dataset.typeState, 'settled'); assert.ok(s.records.every(r => r.cancelled));
  assert.equal(s.frames.size, 0); s.dispose();
});
