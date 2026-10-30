import { readFile, writeFile } from 'node:fs/promises';
import { validateBytes } from 'gltf-validator';
const base = new URL('../assets/coffee/3d/', import.meta.url);
const files = ['cup.glb', 'coffee-liquid.glb', 'coffee-stream.glb', 'ceh-coffee.glb', 'ceh-coffee-pouring.glb'];
const reports = [];
for (const name of files) {
  const bytes = new Uint8Array(await readFile(new URL(name, base)));
  const report = await validateBytes(bytes, { uri: name, maxIssues: 30 });
  reports.push({ file: name, bytes: bytes.length, ...report });
  console.log(name, `${bytes.length} bytes`, `${report.issues.numErrors} errors, ${report.issues.numWarnings} warnings`);
  if (report.issues.numErrors) process.exitCode = 1;
}
await writeFile(new URL('../coffee-3d/gltf-validation.json', import.meta.url), JSON.stringify(reports, null, 2));
