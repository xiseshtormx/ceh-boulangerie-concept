import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const source = readFileSync(new URL('../closing-cta.js', import.meta.url), 'utf8').replaceAll('export ', '');
const flush = async () => { for (let index = 0; index < 8; index++) await Promise.resolve(); };

function scene({ reduced = false, keyboard = false, animated = true, top = 300 } = {}) {
  let resolveFont, rejectFont, observe;
  const fonts = new Promise((resolve, reject) => { resolveFont = resolve; rejectFont = reject; });
  const timers = new Map(), effects = [], requestedFonts = [];
  const classes = new Set(keyboard ? ['keyboard-input'] : []);
  const document = Object.assign(new EventTarget(), {
    hidden: false,
    body: { classList: { contains: name => classes.has(name) } },
    fonts: { load: (...args) => { requestedFonts.push(args); return fonts; } },
    querySelector: () => null
  });
  const window = new EventTarget();
  const media = Object.assign(new EventTarget(), { matches: reduced });
  const link = new EventTarget();
  const lines = ['Посмотреть', 'всё меню.'].map(textContent => ({
    textContent,
    ...(animated ? { animate: (keyframes, options) => {
      let resolve, reject;
      const effect = {
        target: textContent, keyframes, options, cancelled: false,
        finished: new Promise((yes, no) => { resolve = yes; reject = no; }),
        finish: () => resolve(),
        cancel() { this.cancelled = true; reject(new Error('Cancelled')); }
      };
      effects.push(effect); return effect;
    } } : {})
  }));
  const rect = { top, bottom: top + 470 };
  const section = {
    dataset: {}, querySelector: () => link, querySelectorAll: () => lines,
    getBoundingClientRect: () => rect
  };
  let nextTimer = 0, disconnected = false;
  const context = {
    document, window, section,
    matchMedia: () => media,
    setTimeout: callback => { timers.set(++nextTimer, callback); return nextTimer; },
    clearTimeout: id => timers.delete(id),
    requestAnimationFrame: () => { throw new Error('CTA must not schedule an idle animation loop'); },
    IntersectionObserver: class {
      constructor(callback) { observe = callback; }
      observe() {}
      disconnect() { disconnected = true; }
    }
  };
  const dispose = vm.runInNewContext(source + '\ninitClosingCTA(section);', context);
  return {
    section, document, window, media, link, lines, rect, effects, timers, requestedFonts,
    resolveFont, rejectFont, dispose, disconnected: () => disconnected,
    enter: (ratio = 1) => observe([{ isIntersecting: ratio > 0, intersectionRatio: ratio }])
  };
}

test('CTA waits for meaningful visibility and its italic, reveals two distinct masks once, then releases effects', async () => {
  const s = scene();
  s.enter(.01); await flush();
  assert.equal(s.section.dataset.ctaState, 'idle'); assert.equal(s.requestedFonts.length, 0);
  s.enter(.3);
  assert.equal(s.section.dataset.ctaState, 'waiting'); assert.equal(s.effects.length, 0);
  assert.equal(s.requestedFonts[0][1], 'всё меню.');
  s.resolveFont(); await flush();
  assert.equal(s.section.dataset.ctaState, 'revealing'); assert.equal(s.effects.length, 2);
  assert.notEqual(s.effects[0].keyframes[0].clipPath, s.effects[1].keyframes[0].clipPath);
  assert.notEqual(s.effects[0].keyframes[0].transform, s.effects[1].keyframes[0].transform);
  assert.equal(s.effects[0].options.delay, 0); assert.ok(s.effects[1].options.delay > 0);
  assert.ok(Math.max(...s.effects.map(effect => effect.options.duration + effect.options.delay)) <= 1000);
  s.effects.forEach(effect => effect.finish()); await flush();
  assert.equal(s.section.dataset.ctaState, 'settled'); assert.ok(s.effects.every(effect => effect.cancelled));
  assert.equal(s.timers.size, 0);
  s.enter(0); s.enter(1); await flush(); assert.equal(s.effects.length, 2);
  s.dispose(); assert.equal(s.disconnected(), true);
});

test('Reduced motion, keyboard use and focus keep a complete, immediately usable native link', async () => {
  for (const mode of ['reduced', 'keyboard', 'keydown', 'focus']) {
    const s = scene({ reduced: mode === 'reduced', keyboard: mode === 'keyboard' });
    if (mode === 'keydown') s.document.dispatchEvent(new Event('keydown'));
    if (mode === 'focus') { s.enter(); s.link.dispatchEvent(new Event('focus')); }
    s.enter(); s.resolveFont(); await flush();
    assert.equal(s.section.dataset.ctaState, 'settled', mode); assert.equal(s.effects.length, 0, mode);
    const click = new Event('click', { cancelable: true });
    assert.equal(s.link.dispatchEvent(click), true, 'The controller must not intercept native navigation');
    assert.equal(click.defaultPrevented, false); assert.equal(s.timers.size, 0); s.dispose();
  }
});

test('Preference changes, hiding and history restoration cancel an active reveal without replay', async () => {
  for (const mode of ['reduced', 'hidden', 'history']) {
    const s = scene(); s.enter(); s.resolveFont(); await flush();
    assert.equal(s.effects.length, 2);
    if (mode === 'reduced') { s.media.matches = true; s.media.dispatchEvent(new Event('change')); }
    if (mode === 'hidden') { s.document.hidden = true; s.document.dispatchEvent(new Event('visibilitychange')); }
    if (mode === 'history') s.window.dispatchEvent(Object.assign(new Event('pageshow'), { persisted: true }));
    await flush();
    assert.equal(s.section.dataset.ctaState, 'settled', mode); assert.ok(s.effects.every(effect => effect.cancelled));
    s.media.matches = false; s.document.hidden = false;
    s.media.dispatchEvent(new Event('change')); s.document.dispatchEvent(new Event('visibilitychange'));
    s.enter(); await flush(); assert.equal(s.effects.length, 2, 'Restoration cannot replay the entrance'); s.dispose();
  }
});

test('Slow or failed fonts fail open, and disposal invalidates a late font resolution', async () => {
  const timeout = scene(); timeout.enter(); [...timeout.timers.values()][0](); await flush();
  assert.equal(timeout.section.dataset.ctaState, 'settled'); assert.equal(timeout.effects.length, 0); timeout.dispose();
  const failure = scene(); failure.enter(); failure.rejectFont(new Error('Font unavailable')); await flush();
  assert.equal(failure.section.dataset.ctaState, 'settled'); assert.equal(failure.effects.length, 0); failure.dispose();
  const disposed = scene(); disposed.enter(); disposed.dispose(); disposed.resolveFont(); await flush();
  assert.equal(disposed.effects.length, 0); assert.equal(disposed.timers.size, 0); assert.equal(disposed.disconnected(), true);
  disposed.enter(); disposed.link.dispatchEvent(new Event('focus'));
  assert.equal(disposed.requestedFonts.length, 1, 'Detached observers/listeners cannot restart the scene');
});

test('Missing WAAPI, an already-passed section or leaving during font loading never hides the CTA', async () => {
  const fallback = scene({ animated: false }); fallback.enter(); fallback.resolveFont(); await flush();
  assert.equal(fallback.section.dataset.ctaState, 'settled'); assert.equal(fallback.effects.length, 0); fallback.dispose();
  const passed = scene({ top: -60 }); passed.enter(); await flush();
  assert.equal(passed.section.dataset.ctaState, 'settled'); assert.equal(passed.requestedFonts.length, 0); passed.dispose();
  const leaving = scene(); leaving.enter(); leaving.rect.bottom = -1; leaving.resolveFont(); await flush();
  assert.equal(leaving.section.dataset.ctaState, 'settled'); assert.equal(leaving.effects.length, 0); leaving.dispose();
});
