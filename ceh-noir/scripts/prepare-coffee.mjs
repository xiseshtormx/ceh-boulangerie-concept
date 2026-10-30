// Optional source preparation, like prepare-photos.mjs. The build uses the
// committed output assets and does not need Sharp or access to Downloads/Temp.
import sharp from 'sharp';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
const root = new URL('../', import.meta.url);
const sources = {
  front: '01_empty_cup.png', final: '03.png',
  tilt: 'codex-clipboard-5b62f313-4ded-404f-b9ba-bb472838a573.png',
  pour: 'codex-clipboard-84f36846-3df7-4d6d-8ef6-628b24fe2809.png',
  stream: 'codex-clipboard-1ad9f71e-91e1-4bf5-943d-a14ad9048e99.png',
};
const output = new URL('assets/coffee/photos/', root);
await mkdir(output, { recursive: true });
const manifest = {};
for (const [name, sourceFile] of Object.entries(sources)) {
  const original = await readFile(new URL(`source-images/coffee-user/${name}.png`, root));
  const meta = await sharp(original).metadata();
  let image = sharp(original);
  if (name === 'stream') image = image.extract({ left: 380, top: 0, width: 310, height: 1536 });
  else image = image.resize(1254, 1254).flatten({ background: '#000000' });
  await image.webp({ quality: 96, alphaQuality: 100, effort: 6 }).toFile(fileURLToPath(new URL(`${name}.webp`, output)));
  manifest[name] = { src: `assets/coffee/photos/${name}.webp`, sourceFile, sha256: createHash('sha256').update(original).digest('hex'), width: meta.width, height: meta.height };
  if (name === 'final') {
    const poster = await sharp(original).jpeg({ quality: 96, chromaSubsampling: '4:4:4' }).toBuffer();
    await writeFile(new URL('assets/coffee/final.jpg', root), poster);
    await writeFile(new URL('assets/coffee/final-mobile.jpg', root), poster);
  }
}
await writeFile(new URL('SOURCES.json', output), JSON.stringify(manifest, null, 2) + '\n');
console.log('Prepared the five user-supplied coffee assets.');
