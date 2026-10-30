import test from 'node:test';
import assert from 'node:assert/strict';
import { PHOTO_SIZE, cupLandmarks, mapPhotoY, coffeePhotoState } from '../coffee-photo-model.js';

test('photographic row registration never folds and can be reversed without losing a landmark', () => {
  const poses = [0, .25, .5, .75, 1];
  for (const filled of [0, .5, 1]) for (const from of poses) for (const to of poses) {
    const source = cupLandmarks(from, filled), target = cupLandmarks(to, filled);
    for (const handle of [false, true]) {
      let previous = -Infinity;
      const anchors = handle ? [source.handleTop, source.handleBottom] : [source.back, source.lip, source.bottom];
      const rows = [...new Set([0, PHOTO_SIZE, ...anchors, ...Array.from({ length: 180 }, (_, i) => i * PHOTO_SIZE / 180)])].sort((a, b) => a - b);
      for (const y of rows) {
        const mapped = mapPhotoY(y, source, target, handle);
        assert.ok(mapped > previous, `Fold at row ${y}, pose ${from}→${to}, handle=${handle}`);
        assert.ok(Math.abs(mapPhotoY(mapped, target, source, handle) - y) < 1e-8, `Lost row ${y}`);
        previous = mapped;
      }
      assert.equal(mapPhotoY(0, source, target, handle), 0);
      assert.equal(mapPhotoY(PHOTO_SIZE, source, target, handle), PHOTO_SIZE);
    }
  }
});

test('the supplied overhead cup is held through the pour and returns continuously to its front photograph', () => {
  for (const p of [.26, .35, .45, .6, .70, .72]) assert.equal(coffeePhotoState(p).tilt, 1);
  assert.equal(coffeePhotoState(0).tilt, 0);
  assert.equal(coffeePhotoState(.84).tilt, 0);
  for (const boundary of [.13, .26, .70, .72, .84, .94]) {
    const before = coffeePhotoState(boundary - 1e-7), after = coffeePhotoState(boundary + 1e-7);
    for (const key of ['entry', 'returning', 'tilt', 'lift']) assert.ok(Math.abs(after[key] - before[key]) < 1e-4, `${key} jumps at ${boundary}`);
    for (const key of ['x', 'y', 'rx', 'ry']) assert.ok(Math.abs(after.surface[key] - before.surface[key]) < .001, `Surface ${key} jumps at ${boundary}`);
  }
});

test('liquid projection rises continuously without reversing or collapsing during filling', () => {
  let previous = coffeePhotoState(.26).surface;
  for (let i = 1; i <= 600; i++) {
    const current = coffeePhotoState(.26 + .44 * i / 600).surface;
    assert.ok(current.y <= previous.y, 'Liquid center moved downward');
    assert.ok(current.y - current.ry <= previous.y - previous.ry, 'Back waterline moved downward');
    assert.ok(current.rx >= previous.rx && current.ry >= previous.ry, 'Surface radius shrank while filling');
    assert.ok(current.rx > 0 && current.ry > 0, 'Surface collapsed');
    assert.ok(Object.values(current).every(Number.isFinite));
    previous = current;
  }
});
