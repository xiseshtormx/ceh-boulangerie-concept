// Re-encode supplied food cutouts without cropping, recolouring or replacing their transparency.
// Requires sharp. If installed outside this checkout, set SHARP_MODULE_PATH to its entry/directory.
import { createRequire } from 'node:module';
import { mkdir, readFile, stat, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const require = createRequire(import.meta.url);
const sharp = require(process.env.SHARP_MODULE_PATH || 'sharp');
const root = fileURLToPath(new URL('../', import.meta.url));
const output = path.join(root, 'assets', 'dishes', 'food-web');
const sources = [
  'rice-berry', 'rice-porridge', 'oatmeal', 'oatmeal-cheese', 'oatmeal-chocolate',
  'syrniki-condensed', 'syrniki-forest-berries', 'syrniki-blueberry',
  'pasta-chicken', 'carbonara'
];
await mkdir(output, { recursive: true });
const manifest = { recipe: { format: 'webp', quality: 90, alphaQuality: 100, maxDimensions: [800, 1600], crop: false, upscale: false }, images: {} };
let originalBytes = 0;
const totals = { 800: 0, 1600: 0 };
for (const stem of sources) {
  const source = path.join(root, 'assets', 'dishes', `${stem}.png`);
  const input = await readFile(source);
  const metadata = await sharp(input).metadata();
  if (!metadata.hasAlpha) throw new Error(`Expected supplied alpha cutout: ${stem}`);
  originalBytes += input.length;
  const entry = { source: `${stem}.png`, width: metadata.width, height: metadata.height, bytes: input.length, sha256: createHash('sha256').update(input).digest('hex'), variants: {} };
  for (const size of [800, 1600]) {
    const name = `${stem}-${size}.webp`;
    const info = await sharp(input)
      .resize({ width: size, height: size, fit: 'inside', withoutEnlargement: true })
      .webp({ quality: 90, alphaQuality: 100, effort: 6, smartSubsample: true })
      .toFile(path.join(output, name));
    const bytes = (await stat(path.join(output, name))).size;
    totals[size] += bytes;
    entry.variants[size] = { src: `assets/dishes/food-web/${name}`, width: info.width, height: info.height, bytes };
  }
  manifest.images[stem] = entry;
  console.log(`${stem}: ${metadata.width}×${metadata.height} ${(input.length / 1024).toFixed(0)} KB → ${Object.entries(entry.variants).map(([size, item]) => `${size}: ${item.width}×${item.height}, ${(item.bytes / 1024).toFixed(0)} KB`).join(' / ')}`);
}
manifest.totals = { originalBytes, variants: totals };
await writeFile(path.join(output, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n');
console.log(`Total: ${(originalBytes / 1024 / 1024).toFixed(2)} MB original; ${(totals[800] / 1024 / 1024).toFixed(2)} MB mobile; ${(totals[1600] / 1024 / 1024).toFixed(2)} MB desktop.`);
