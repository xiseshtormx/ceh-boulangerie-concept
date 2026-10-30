import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { previewPosition } from '../location-preview.js';
import { locations } from '../presentation.js';

test('The moving photo stays inside its reserved lane, clear of text and controls', () => {
  const area = { left: 650, top: 160, width: 470, height: 510 };
  const row = { left: 80, width: 1100 };
  for (const x of [-200, 80, 400, 900, 1600]) {
    for (const y of [-100, 100, 300, 600, 1100]) {
      const photo = previewPosition(area, row, { x, y }, 720);
      assert.ok(photo.size >= 0 && photo.size <= 380);
      assert.ok(area.left + photo.x >= 650, 'Clear the entire text column');
      assert.ok(area.left + photo.x + photo.size <= 1120, 'Clear the right-hand plus/minus');
      assert.ok(area.top + photo.y >= 14);
      assert.ok(area.top + photo.y + photo.size <= 706);
    }
  }
});

test('Partially scrolled and short viewports never clip the square photo', () => {
  for (const top of [-350, -100, 30, 180]) {
    for (const height of [320, 500, 900]) {
      const area = { left: 500, top, width: 310, height: 510 };
      const photo = previewPosition(area, { left: 30, width: 900 }, { x: 700, y: 250 }, height);
      assert.ok(photo.x >= 0 && photo.x + photo.size <= area.width);
      assert.ok(photo.size <= 310);
      if (photo.size) {
        assert.ok(top + photo.y >= Math.max(14, top));
        assert.ok(top + photo.y + photo.size <= Math.min(height - 14, top + 510));
      }
    }
  }
});

test('No visible lane gives a zero-size preview rather than an overflow', () => {
  const photo = previewPosition({ left: 600, top: 900, width: 450, height: 510 }, { left: 50, width: 900 }, { x: 800, y: 600 }, 720);
  assert.equal(photo.size, 0);
});

test('All four addresses have their own correctly assigned original photo', () => {
  const media = JSON.parse(readFileSync(new URL('../site-media.json', import.meta.url)));
  const expected = { petropavlovskaya: [960, 1280], kompros: [960, 1280], lunacharsky: [960, 720], revolution: [960, 720] };
  assert.deepEqual(Object.keys(media.places).sort(), locations.map(place => place.id).sort());
  for (const place of locations) {
    const photo = media.places[place.id];
    assert.equal(photo.src, `assets/places/${place.id}.png`);
    assert.equal(photo.source, 'user-provided');
    assert.ok(photo.alt.includes(place.address.match(/\d+/)[0]), place.id);
    const file = new URL('../' + photo.src, import.meta.url);
    assert.ok(existsSync(file));
    const png = readFileSync(file);
    assert.deepEqual([png.readUInt32BE(16), png.readUInt32BE(20)], expected[place.id]);
  }
});
