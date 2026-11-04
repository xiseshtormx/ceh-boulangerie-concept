import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const source = readFileSync(new URL('../hero.js', import.meta.url), 'utf8');

function mount({ reduced = false, random = 0 } = {}) {
  let resolveDecode, rejectDecode;
  const decoded = new Promise((resolve, reject) => { resolveDecode = resolve; rejectDecode = reject; });
  const text = Array.from({ length: 3 }, () => Object.assign(new EventTarget(), { style: {} }));
  const requests = [], animations = [];
  const image = Object.assign(new EventTarget(), {
    dataset: {}, hidden: true, decode: () => decoded,
    animate: () => {
      const animation = Object.assign(new EventTarget(), { cancelled: false });
      animation.cancel = () => { animation.cancelled = true; };
      animations.push(animation);
      return animation;
    }
  });
  Object.defineProperty(image, 'src', { set(value) { requests.push(value); } });
  const media = Object.assign(new EventTarget(), { matches: reduced });
  const document = Object.assign(new EventTarget(), {
    hidden: false, querySelector: () => image, querySelectorAll: () => text
  });
  const window = new EventTarget();
  const math = Object.create(Math); math.random = () => random;
  vm.runInNewContext(source, { document, window, matchMedia: () => media, Math: math });
  return { image, document, window, text, requests, animations, media, resolveDecode, rejectDecode };
}

const tick = async () => { await Promise.resolve(); await Promise.resolve(); };

test('The supplied hero photograph is stable across visits, decodes fully, then enters once', async () => {
  const selected = new Set();
  for (const random of [0, 0.5, 0.999]) {
    const scene = mount({ random });
    assert.equal(scene.image.dataset.heroState, 'loading');
    assert.equal(scene.image.hidden, false, 'Keep the reserved layout box while loading');
    assert.equal(scene.animations.length, 0, 'Do not animate a partially decoded PNG');
    assert.equal(scene.requests.length, 1, 'Request only the supplied photo');
    const png = readFileSync(new URL('../' + scene.requests[0], import.meta.url));
    assert.equal(scene.image.width, png.readUInt32BE(16));
    assert.equal(scene.image.height, png.readUInt32BE(20));
    selected.add(scene.requests[0]);
    scene.resolveDecode(); await tick();
    assert.equal(scene.image.dataset.heroState, 'ready');
    assert.equal(scene.animations.length, 1);
    scene.animations[0].dispatchEvent(new Event('finish'));
    assert.equal(scene.animations[0].cancelled, true, 'Release the finished effect');
    scene.window.dispatchEvent(Object.assign(new Event('pageshow'), { persisted: true }));
    assert.equal(scene.animations.length, 1, 'History restoration must not replay the entrance');
  }
  assert.deepEqual([...selected], ['assets/hero/croissant-studio.png']);
});

test('Keyboard input during loading skips motion without exposing an unfinished image', async () => {
  const scene = mount();
  scene.document.dispatchEvent(new Event('keydown'));
  assert.equal(scene.image.dataset.heroState, 'loading');
  assert.ok(scene.text.every(element => element.style.animation === 'none'));
  scene.resolveDecode(); await tick();
  assert.equal(scene.image.dataset.heroState, 'ready');
  assert.equal(scene.animations.length, 0);
});

test('Reduced motion skips the entrance and cancels an already running effect', async () => {
  const reduced = mount({ reduced: true });
  reduced.resolveDecode(); await tick();
  assert.equal(reduced.image.dataset.heroState, 'ready');
  assert.equal(reduced.animations.length, 0);
  const scene = mount();
  scene.resolveDecode(); await tick();
  scene.media.matches = true; scene.media.dispatchEvent(new Event('change'));
  assert.equal(scene.animations[0].cancelled, true);
  assert.equal(scene.image.dataset.heroState, 'ready');
  assert.ok(scene.text.every(element => element.style.animation === 'none'));
});

test('Settled text cannot replay when the input mode changes', () => {
  const scene = mount();
  scene.text.forEach(element => element.dispatchEvent(new Event('animationend')));
  scene.document.dispatchEvent(new Event('keydown'));
  scene.document.dispatchEvent(new Event('pointermove'));
  assert.ok(scene.text.every(element => element.style.animation === 'none'));
});

test('A failed image decode never reveals a partial or broken photo', async () => {
  const scene = mount();
  scene.rejectDecode(new Error('Image decode failed')); await tick();
  assert.equal(scene.image.dataset.heroState, 'error');
  assert.equal(scene.animations.length, 0);
});
