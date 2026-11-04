import test from 'node:test';
import assert from 'node:assert/strict';
import { foodDrift, initFoodScene } from '../food-scenes.js';

const flush = async () => { for (let i = 0; i < 8; i++) await Promise.resolve(); };
const classes = initial => {
  const names = new Set(initial);
  return {
    contains: name => names.has(name),
    add: name => names.add(name),
    remove: name => names.delete(name),
    toggle(name, force = !names.has(name)) { if (force) names.add(name); else names.delete(name); }
  };
};

function scene(t, { reduced = false, motion = true, saveData = true } = {}) {
  const saved = new Map();
  const put = (name, value) => {
    saved.set(name, Object.getOwnPropertyDescriptor(globalThis, name));
    Object.defineProperty(globalThis, name, { configurable: true, value });
  };
  t.after(() => {
    for (const [name, descriptor] of saved) {
      if (descriptor) Object.defineProperty(globalThis, name, descriptor); else delete globalThis[name];
    }
  });
  const animations = [], requests = [], frames = new Map();
  let observer, frameId = 0, errors = 0;
  const node = (initialClasses = []) => {
    const attributes = new Map();
    return Object.assign(new EventTarget(), {
      style: {}, dataset: {}, hidden: false, alt: '', classList: classes(initialClasses),
      setAttribute: (name, value) => attributes.set(name, String(value)),
      getAttribute: name => attributes.has(name) ? attributes.get(name) : null,
      removeAttribute: name => attributes.delete(name),
      animate(keyframes, options) {
        let resolve, reject;
        const animation = {
          target: this, keyframes, options, cancelled: false,
          finished: new Promise((yes, no) => { resolve = yes; reject = no; }),
          finish: () => resolve(),
          cancel() { this.cancelled = true; reject(new Error('Animation cancelled')); }
        };
        animations.push(animation); return animation;
      }
    });
  };
  const media = Object.assign(new EventTarget(), { matches: reduced });
  const document = Object.assign(new EventTarget(), { hidden: false, body: { classList: classes([]) } });
  const window = Object.assign(new EventTarget(), { innerWidth: 1440, innerHeight: 900 });
  put('document', document); put('window', window); put('navigator', { connection: { saveData } });
  put('matchMedia', () => media);
  put('requestAnimationFrame', callback => { frames.set(++frameId, callback); return frameId; });
  put('cancelAnimationFrame', id => frames.delete(id));
  put('IntersectionObserver', class {
    constructor(callback) { observer = callback; this.disconnected = false; }
    observe() {}
    disconnect() { this.disconnected = true; }
  });
  put('Image', class {
    constructor() {
      let resolve, reject;
      const decoded = new Promise((yes, no) => { resolve = yes; reject = no; });
      this.decode = () => decoded;
      requests.push({ image: this, resolve, reject });
    }
  });
  const chapter = { id: 'syrniki', entries: [0, 1, 2].map(index => ({
    id: `dish-${index}`, image: `dish-${index}.png`, alt: `Блюдо ${index}`, width: 1600, height: 1600
  })) };
  const images = [node(['food-image', 'is-current']), node(['food-image'])];
  images[0].alt = chapter.entries[0].alt; images[0].decode = () => Promise.resolve();
  images[1].hidden = true; images[1].decode = () => Promise.resolve(); images[1].setAttribute('aria-hidden', 'true');
  const buttons = chapter.entries.map((entry, index) => {
    const button = node(); button.setAttribute('aria-pressed', String(index === 0)); return button;
  });
  const details = node(); details.dataset.product = chapter.entries[0].id;
  const drift = node(), arrival = node(), title = node(), description = node(), options = node();
  const box = { top: 100, height: 700 };
  const selectors = { '.food-details': details, '.food-drift': drift, '.food-arrival': arrival, '.food-title-ink': title, '.food-copy p': description, '.food-options': options };
  const section = Object.assign(node(), {
    querySelector: selector => selectors[selector],
    querySelectorAll: selector => selector === '.food-image' ? images : buttons,
    getBoundingClientRect: () => box
  });
  const dispose = initFoodScene(section, chapter, {
    baseURL: new URL('https://example.test/ceh/'), motionAllowed: () => motion, onError: () => errors++
  });
  const runFrames = () => {
    for (let i = 0; frames.size && i < 300; i++) {
      const callbacks = [...frames.values()]; frames.clear(); callbacks.forEach(callback => callback(performance.now() + i * 16));
    }
  };
  const choose = index => buttons[index].dispatchEvent(new Event('click'));
  return {
    section, chapter, media, document, window, images, buttons, details, drift, animations, requests, frames, box,
    dispose, choose, runFrames, enter: (ratio = 1) => observer([{ isIntersecting: true, intersectionRatio: ratio }]), leave: () => observer([{ isIntersecting: false, intersectionRatio: 0 }]),
    finish: () => animations.forEach(animation => animation.finish()), errors: () => errors
  };
}

test('Dish drift is bounded, reversible and reduced on narrow viewports', () => {
  for (const mobile of [false, true]) {
    const limit = mobile ? 5 : 12;
    for (const top of [-4000, -700, -100, 0, 300, 900, 4000]) {
      const value = foodDrift(top, 700, 900, mobile);
      assert.ok(Number.isFinite(value)); assert.ok(Math.abs(value) <= limit);
      assert.equal(value, -foodDrift(200 - top, 700, 900, mobile));
    }
    assert.equal(Math.abs(foodDrift(100, 700, 900, mobile)), 0);
  }
});

test('Only the latest decoded flavor commits its photo, alternative text and detail action', async t => {
  const s = scene(t, { motion: false });
  s.choose(1); s.choose(2);
  assert.equal(s.section.getAttribute('aria-busy'), 'true');
  assert.equal(s.details.dataset.product, 'dish-0', 'Keep the old action until a replacement photo is decoded');
  s.requests[1].resolve(); await flush();
  assert.equal(s.section.dataset.foodVariant, 'dish-2'); assert.equal(s.details.dataset.product, 'dish-2');
  const active = s.images.find(image => image.classList.contains('is-current'));
  assert.equal(active.alt, 'Блюдо 2'); assert.match(active.src, /dish-2-1600\.webp$/);
  s.requests[0].resolve(); await flush();
  assert.equal(s.section.dataset.foodVariant, 'dish-2'); assert.equal(s.details.dataset.product, 'dish-2');
  assert.deepEqual(s.buttons.map(button => button.getAttribute('aria-pressed')), ['false', 'false', 'true']);
  assert.equal(s.section.getAttribute('aria-busy'), 'false');
  assert.equal(s.images.filter(image => !image.hidden).length, 1); assert.equal(s.errors(), 0); s.dispose();
});

test('A failed flavor decode keeps the visible dish and resets the selection; stale failures stay silent', async t => {
  const s = scene(t, { motion: false });
  s.choose(1); s.requests[0].reject(new Error('Unavailable image')); await flush();
  assert.equal(s.section.dataset.foodVariant, 'dish-0'); assert.equal(s.details.dataset.product, 'dish-0');
  assert.equal(s.images[0].alt, 'Блюдо 0'); assert.equal(s.images[0].hidden, false);
  assert.deepEqual(s.buttons.map(button => button.getAttribute('aria-pressed')), ['true', 'false', 'false']);
  assert.equal(s.errors(), 1); assert.equal(s.section.getAttribute('aria-busy'), 'false');
  s.choose(1); s.choose(2); s.requests[2].resolve(); await flush();
  s.requests[1].reject(new Error('Stale failure')); await flush();
  assert.equal(s.section.dataset.foodVariant, 'dish-2'); assert.equal(s.errors(), 1); s.dispose();
});

test('Returning to the currently visible flavor cancels a pending replacement without another download', async t => {
  const s = scene(t, { motion: false });
  s.choose(1); s.choose(0);
  assert.equal(s.requests.length, 1); assert.equal(s.section.getAttribute('aria-busy'), 'false');
  s.requests[0].resolve(); await flush();
  assert.equal(s.section.dataset.foodVariant, 'dish-0'); assert.equal(s.details.dataset.product, 'dish-0');
  assert.deepEqual(s.buttons.map(button => button.getAttribute('aria-pressed')), ['true', 'false', 'false']); s.dispose();
});

test('Rapid choices settle an active crossfade before staging a newer replacement', async t => {
  const s = scene(t);
  s.choose(1); s.requests[0].resolve(); await flush();
  assert.equal(s.animations.length, 2); assert.equal(s.images.filter(image => !image.hidden).length, 2);
  s.choose(2);
  assert.ok(s.animations.every(animation => animation.cancelled));
  assert.equal(s.images.filter(image => !image.hidden).length, 1);
  assert.equal(s.details.dataset.product, 'dish-1');
  s.requests[1].resolve(); await flush(); s.finish(); await flush();
  assert.equal(s.section.dataset.foodVariant, 'dish-2');
  assert.equal(s.images.filter(image => !image.hidden).length, 1);
  assert.equal(s.images.filter(image => image.getAttribute('aria-hidden') !== 'true').length, 1); s.dispose();
});

test('Keyboard and reduced motion cancel effects and keep flavor controls usable without an entrance', async t => {
  const s = scene(t);
  s.enter(); await flush();
  assert.equal(s.section.dataset.foodState, 'entering'); assert.equal(s.animations.length, 5);
  s.document.dispatchEvent(new Event('keydown')); await flush();
  assert.ok(s.animations.every(animation => animation.cancelled)); assert.equal(s.frames.size, 0);
  const count = s.animations.length;
  s.choose(1); s.requests[0].resolve(); await flush();
  assert.equal(s.section.dataset.foodVariant, 'dish-1'); assert.equal(s.animations.length, count);
  s.document.dispatchEvent(new Event('pointerdown')); s.media.matches = true; s.media.dispatchEvent(new Event('change'));
  s.choose(2); s.requests[1].resolve(); await flush();
  assert.equal(s.section.dataset.foodVariant, 'dish-2'); assert.equal(s.animations.length, count);
  assert.equal(s.drift.style.transform, 'translate3d(0,0,0)'); s.dispose();
});

test('Entrance plays once; parallax stops when settled, offscreen, hidden or disposed', async t => {
  const s = scene(t);
  s.enter(); await flush(); s.finish(); await flush(); s.runFrames();
  assert.equal(s.section.dataset.foodState, 'settled'); assert.equal(s.frames.size, 0);
  const count = s.animations.length;
  s.leave(); s.enter(); await flush(); s.runFrames(); assert.equal(s.animations.length, count);
  s.box.top = -200; s.window.dispatchEvent(new Event('scroll')); assert.equal(s.frames.size, 1);
  s.runFrames(); assert.equal(s.frames.size, 0); assert.equal(s.section.dataset.foodFrames, 'idle');
  s.box.top = 300; s.window.dispatchEvent(new Event('scroll')); s.leave(); assert.equal(s.frames.size, 0);
  s.enter(); s.document.hidden = true; s.document.dispatchEvent(new Event('visibilitychange'));
  assert.equal(s.frames.size, 0);
  s.document.hidden = false; s.document.dispatchEvent(new Event('visibilitychange')); s.runFrames();
  s.dispose(); assert.equal(s.frames.size, 0);
  s.window.dispatchEvent(new Event('scroll')); s.choose(1); assert.equal(s.frames.size, 0); assert.equal(s.requests.length, 0);
});

test('A fringe intersection does not consume the entrance before enough of the section is visible', async t => {
  const s = scene(t);
  s.enter(.01); await flush();
  assert.equal(s.section.dataset.foodState, 'idle'); assert.equal(s.animations.length, 0);
  s.enter(.2); await flush();
  assert.equal(s.section.dataset.foodState, 'entering'); assert.equal(s.animations.length, 5);
  s.finish(); await flush(); s.runFrames();
  assert.equal(s.section.dataset.foodState, 'settled');
  s.leave(); s.enter(.2); await flush(); s.runFrames();
  assert.equal(s.animations.length, 5, 'Re-entry cannot replay the consumed entrance'); s.dispose();
});

test('A late decoded or rejected request cannot mutate a disposed scene', async t => {
  const s = scene(t, { motion: false });
  s.choose(1); s.choose(2); s.dispose();
  const variant = s.section.dataset.foodVariant, detail = s.details.dataset.product;
  s.requests[0].reject(new Error('Late rejected image')); s.requests[1].resolve(); await flush();
  assert.equal(s.section.dataset.foodVariant, variant); assert.equal(s.details.dataset.product, detail);
  assert.equal(s.errors(), 0); assert.equal(s.animations.length, 0);
});
