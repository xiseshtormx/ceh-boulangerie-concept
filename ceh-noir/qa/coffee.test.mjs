import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { coffeeState, coffeeProgress } from '../coffee-timeline.js';

test('coffee follows scroll geometry on both tall and short viewports', () => {
  for (const viewport of [568, 844, 900]) {
    for (const length of [2.5, 3.2]) {
      const height = viewport * length, travel = height - viewport;
      assert.equal(coffeeProgress(100, height, viewport), 0);
      assert.equal(coffeeProgress(-travel / 2, height, viewport), .5);
      assert.equal(coffeeProgress(-travel, height, viewport), 1);
      assert.equal(coffeeProgress(-travel - 100, height, viewport), 1);
    }
  }
  assert.equal(coffeeProgress(0, 0, 0), 1);
});

test('reverse scrolling reproduces the same shot rather than replaying a simulation', () => {
  const positions = [0, .14, .24, .3, .48, .64, .72, .83, .96, 1];
  const forward = positions.map(coffeeState);
  const backward = positions.toReversed().map(coffeeState).toReversed();
  assert.deepEqual(forward, backward);
  assert.deepEqual(coffeeState(-5), coffeeState(0));
  assert.deepEqual(coffeeState(7), coffeeState(1));
  assert.deepEqual(coffeeState(NaN), coffeeState(0));
});

test('liquid rises without jumping and the stream stops before the final copy', () => {
  let previous = coffeeState(0);
  for (let i = 1; i <= 1000; i++) {
    const next = coffeeState(i / 1000);
    for (const key of ['fill', 'crema', 'reveal', 'blue', 'settle', 'steam', 'camera', 'copy']) {
      assert.ok(next[key] >= previous[key], `${key} reversed`);
      assert.ok(Math.abs(next[key] - previous[key]) < .02, `${key} jumped`);
    }
    previous = next;
  }
  assert.equal(coffeeState(.2).fill, 0);
  assert.ok(coffeeState(.45).pour > .99);
  assert.ok(coffeeState(.45).fill > .3 && coffeeState(.45).fill < .5);
  assert.equal(coffeeState(.72).pour, 0);
  assert.equal(coffeeState(.8).copy, 0);
  assert.equal(coffeeState(.95).copy, 1);
  assert.equal(coffeeState(1).fill, 1);
});

test('coffee retains the original end action and has desktop and mobile static alternatives', async () => {
  const html = await readFile(new URL('../index.html', import.meta.url), 'utf8');
  const section = html.match(/<section class="coffee-section[\s\S]+?<\/section>/)?.[0];
  assert.ok(section);
  assert.ok(section.indexOf('coffee-canvas') < section.indexOf('coffee-copy'));
  assert.match(section, /Взять с собой\.<br>Или остаться ещё немного\./);
  assert.match(section, /href="menu\/\?category=drinks">Напитки в меню<\/a>/);
  assert.match(section, /<noscript>/);
  for (const file of ['final.jpg', 'final-mobile.jpg']) {
    const image = await readFile(new URL(`../assets/coffee/${file}`, import.meta.url));
    assert.ok(image.length > 10000, `${file} must contain a complete final photo`);
    assert.equal(image.readUInt16BE(0), 0xffd8, `${file} must be a JPEG`);
  }
});

test('all five coffee photographs retain their exact supplied originals and usable web assets', async () => {
  const manifest = JSON.parse(await readFile(new URL('../assets/coffee/photos/SOURCES.json', import.meta.url), 'utf8'));
  const supplied = {
    front: '01_empty_cup.png',
    final: '03.png',
    tilt: 'codex-clipboard-5b62f313-4ded-404f-b9ba-bb472838a573.png',
    pour: 'codex-clipboard-84f36846-3df7-4d6d-8ef6-628b24fe2809.png',
    stream: 'codex-clipboard-1ad9f71e-91e1-4bf5-943d-a14ad9048e99.png',
  };
  assert.deepEqual(Object.keys(manifest).sort(), Object.keys(supplied).sort());
  for (const [key, sourceFile] of Object.entries(supplied)) {
    const source = manifest[key];
    assert.equal(source.sourceFile, sourceFile);
    const original = await readFile(new URL(`../source-images/coffee-user/${key}.png`, import.meta.url));
    assert.equal(createHash('sha256').update(original).digest('hex'), source.sha256, `${key} original changed`);
    assert.equal(original.subarray(0, 8).toString('hex'), '89504e470d0a1a0a');
    assert.equal(original.readUInt32BE(16), source.width, `${key} width differs from original`);
    assert.equal(original.readUInt32BE(20), source.height, `${key} height differs from original`);
    assert.equal(source.src, `assets/coffee/photos/${key}.webp`);
    const optimized = await readFile(new URL(`../${source.src}`, import.meta.url));
    assert.ok(optimized.length > 10000, `${key} optimized photo is missing or incomplete`);
    assert.equal(optimized.subarray(0, 4).toString(), 'RIFF');
    assert.equal(optimized.subarray(8, 12).toString(), 'WEBP');
  }
});
