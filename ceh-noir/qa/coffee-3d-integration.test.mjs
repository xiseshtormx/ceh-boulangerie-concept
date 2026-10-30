import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, stat } from 'node:fs/promises';
import { createHash } from 'node:crypto';

const root = new URL('../', import.meta.url);
const sectionFrom = html => html.match(/<section\b(?=[^>]*\bid="coffee")[\s\S]+?<\/section>/)?.[0];
const digest = bytes => createHash('sha256').update(bytes).digest('hex');

test('the homepage selects the supplied 3D scene with its matching static poster and original end action', async () => {
  const html = await readFile(new URL('index.html', root), 'utf8');
  const section = sectionFrom(html);
  assert.ok(section, 'Coffee section is missing');
  assert.match(section, /data-coffee-renderer="3d"/);
  assert.match(section, /class="coffee-poster"[^>]*src="assets\/coffee\/3d\/poster\.webp"/);
  assert.match(section, /<noscript>/, 'No-JS users need the same final cup and copy');
  assert.match(section, /Взять с собой\.<br>Или остаться ещё немного\./);
  assert.match(section, /href="menu\/\?category=drinks">Напитки в меню<\/a>/);
  assert.ok(section.indexOf('coffee-canvas') < section.indexOf('coffee-copy'));
  assert.doesNotMatch(section, /type="range"|data-progress=|class="(?:status|hint)"/, 'Technical preview controls leaked into the homepage');
  const poster = await readFile(new URL('assets/coffee/3d/poster.webp', root));
  assert.equal(poster.toString('ascii', 0, 4), 'RIFF');
  assert.equal(poster.toString('ascii', 8, 12), 'WEBP');
});

test('the 3D loader is selected locally and its visible mode retains the static reduced-motion alternative', async () => {
  const controller = await readFile(new URL('coffee-story.js', root), 'utf8');
  const css = await readFile(new URL('coffee.css', root), 'utf8');
  assert.match(controller, /coffeeRenderer\s*===\s*['"]3d['"]/);
  assert.match(controller, /import\(['"]\.\/coffee-scene-3d\.js['"]\)/);
  assert.match(css, /\[data-coffee-mode=["']webgl["']\][^{]*\{[^}]*opacity:\s*1/);
  assert.match(css, /@media\s*\(prefers-reduced-motion:\s*reduce\)/);
  assert.match(css, /\[data-coffee-mode=["']poster["']\][^{]*\.coffee-story\s*\{[^}]*height:\s*auto/);
});

test('the built homepage ships the complete local renderer dependency graph and unchanged supplied models', async t => {
  const dist = new URL('dist/', root);
  let html;
  try { html = await readFile(new URL('index.html', dist), 'utf8'); }
  catch (error) {
    if (error.code !== 'ENOENT') throw error;
    t.skip('Run npm run build to verify the packaged site');
    return;
  }
  assert.match(sectionFrom(html) || '', /data-coffee-renderer="3d"/);
  const modules = new Set();
  async function visit(url) {
    assert.ok(url.href.startsWith(dist.href), `Module escapes the packaged site: ${url.href}`);
    if (modules.has(url.href)) return;
    modules.add(url.href);
    const source = await readFile(url, 'utf8');
    for (const match of source.matchAll(/\b(?:import|export)\s+(?:[^'";]*?\s+from\s*)?['"](\.[^'"]+)['"]/g)) {
      await visit(new URL(match[1], url));
    }
  }
  await visit(new URL('coffee-scene-3d.js', dist));
  assert.ok([...modules].some(path => path.endsWith('/coffee-fluid.js')));
  assert.ok([...modules].some(path => path.endsWith('/vendor/three/loaders/GLTFLoader.js')));
  assert.ok([...modules].some(path => path.endsWith('/vendor/three/three.core.js')));
  for (const name of ['ceh-coffee.glb', 'coffee-stream.glb', 'steam-wisp.png', 'poster.webp']) {
    const packaged = new URL(`assets/coffee/3d/${name}`, dist);
    assert.ok((await stat(packaged)).size > 0);
    const original = new URL(`coffee-3d/models/${name}`, root);
    assert.equal(digest(await readFile(packaged)), digest(await readFile(original)), `Packaged ${name} differs from the supplied asset`);
  }
});
