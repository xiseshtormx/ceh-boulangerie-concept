import { mkdir, copyFile, readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = fileURLToPath(new URL('../', import.meta.url));
const vendor = path.join(root, 'vendor');
for (const name of ['three', 'three/loaders', 'three/utils', 'gsap']) await mkdir(path.join(vendor, name), { recursive: true });
for (const name of ['three.module.js', 'three.core.js']) {
  await copyFile(path.join(root, 'node_modules/three/build', name), path.join(vendor, 'three', name));
}
for (const name of ['loaders/GLTFLoader.js', 'utils/BufferGeometryUtils.js']) {
  const code = await readFile(path.join(root, 'node_modules/three/examples/jsm', name), 'utf8');
  await writeFile(path.join(vendor, 'three', name), code.replaceAll("from 'three'", "from '../three.module.js'"));
}
for (const name of ['index.js', 'gsap-core.js', 'CSSPlugin.js', 'ScrollTrigger.js', 'Observer.js']) {
  await copyFile(path.join(root, 'node_modules/gsap', name), path.join(vendor, 'gsap', name));
}
for (const [source, target] of [['three/LICENSE', 'three/LICENSE.txt']]) {
  await copyFile(path.join(root, 'node_modules', source), path.join(vendor, target));
}
await writeFile(path.join(vendor, 'gsap/LICENSE.txt'), 'GSAP 3.13.0. Copyright 2008-2025 GreenSock. All rights reserved.\nhttps://gsap.com/standard-license/\nOriginal license headers are retained in all distributed source files.\n');
console.log('Prepared local Three.js 0.180.0 and GSAP 3.13.0. No CDN requests.');
