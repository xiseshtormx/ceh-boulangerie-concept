import { cp, mkdir, readdir, rm } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
await import('./compose-pages.mjs');
const root = fileURLToPath(new URL('../', import.meta.url));
const out = path.join(root, 'dist');
// This target is fixed inside this project's root.
if (path.dirname(out) !== path.resolve(root)) throw new Error('Invalid output path');
await rm(out, { recursive: true, force: true });
await mkdir(out, { recursive: true });
for (const entry of await readdir(root, { withFileTypes: true })) {
  if (['assets', 'menu', 'vendor'].includes(entry.name) || /\.(html|css|js|json|svg|txt)$/.test(entry.name) && !['package.json', 'package-lock.json'].includes(entry.name)) {
    await cp(path.join(root, entry.name), path.join(out, entry.name), { recursive: true });
  }
}
console.log('Built ceh-noir → dist');
