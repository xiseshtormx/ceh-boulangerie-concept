import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { foodChapters } from '../presentation.js';
import { foodPhoto } from '../food-media.js';

test('Every flavor ships correct responsive WebP dimensions, alpha and unchanged original provenance', () => {
  const manifest = JSON.parse(readFileSync(new URL('../assets/dishes/food-web/manifest.json', import.meta.url)));
  for (const entry of foodChapters.flatMap(chapter => chapter.entries)) {
    const stem = entry.image.replace(/\.[^.]+$/, '');
    const original = readFileSync(new URL('../assets/dishes/' + entry.image, import.meta.url));
    assert.equal(createHash('sha256').update(original).digest('hex'), manifest.images[stem].sha256);
    const photo = foodPhoto(entry);
    for (const candidate of photo.srcset.split(', ')) {
      const [path, descriptor] = candidate.split(' ');
      const bytes = readFileSync(new URL('../' + path, import.meta.url));
      assert.equal(bytes.toString('ascii', 0, 4), 'RIFF');
      assert.equal(bytes.toString('ascii', 8, 12), 'WEBP');
      let offset = 12, extended = -1;
      while (offset + 8 < bytes.length) {
        const length = bytes.readUInt32LE(offset + 4);
        if (bytes.toString('ascii', offset, offset + 4) === 'VP8X') { extended = offset + 8; break; }
        offset += 8 + length + (length % 2);
      }
      assert.ok(extended >= 0, path + ' retains its alpha-capable canvas');
      assert.ok(bytes[extended] & 0x10, path + ' has alpha');
      const width = bytes.readUIntLE(extended + 4, 3) + 1;
      const height = bytes.readUIntLE(extended + 7, 3) + 1;
      assert.equal(descriptor, width + 'w', path + ' has a truthful srcset descriptor');
      assert.ok(Math.abs(width / height - entry.width / entry.height) < .002, path + ' preserves framing');
      assert.ok(width <= entry.width && height <= entry.height, path + ' is not upscaled');
      assert.ok(bytes.length < original.length, path + ' is lighter than its supplied PNG');
    }
  }
});
