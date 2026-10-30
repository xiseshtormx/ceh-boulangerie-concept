import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { normalize, filterMenu, readSaved, itemLabel } from '../menu-model.js';
import { foodChapters } from '../presentation.js';
const catalog = JSON.parse(readFileSync(new URL('../catalog.json', import.meta.url)));
const { items, categories } = catalog;

test('Cyrillic search tolerates ё, case, punctuation and extra spaces', () => {
  assert.equal(normalize('  СГущёнка / 40 г! '), 'сгущенка 40 г');
  assert.ok(filterMenu(items, {query:'СЫРНИКИ  СГУЩЁНКОЙ'}).some(item => item.id === 'syrniki-condensed'));
});
test('Multiword search finds ingredients in any order', () => {
  const result = filterMenu(items, {query:'трюфельный куриное'});
  assert.deepEqual(result.map(item => item.id), ['main-2']);
});
test('Category, search and favorites combine instead of overriding each other', () => {
  const saved = new Set(['syrniki-condensed','classic-croissant']);
  assert.deepEqual(filterMenu(items, {category:'breakfast',query:'сырники',savedOnly:true}, saved).map(item => item.id), ['syrniki-condensed']);
  assert.equal(filterMenu(items, {category:'pastry',query:'сырники',savedOnly:true}, saved).length, 0);
});
test('Empty favorites and unknown searches remain empty', () => {
  assert.equal(filterMenu(items, {savedOnly:true}, new Set()).length, 0);
  assert.equal(filterMenu(items, {query:'несуществующееблюдо'}).length, 0);
});
test('Unrestricted menu contains every unique source item', () => {
  assert.equal(filterMenu(items, {}).length, 83);
  assert.equal(items.filter(item => item.source === 'https://vx553.menuquickresto.ru/').length, 81);
  assert.equal(new Set(items.map(item => item.id)).size, items.length);
  for (const item of items) {
    assert.ok(categories.some(cat => cat.id === item.category), item.id);
    if (item.source === 'user-provided') {
      assert.ok(['oatmeal-chocolate-nuts', 'syrniki-blueberry-cream-cheese'].includes(item.id));
      assert.equal(item.price, null, 'An unconfirmed price must not be fabricated');
      assert.ok(item.sourceNote);
    } else {
      assert.ok(Number.isFinite(item.price) && item.price > 0, item.id);
      assert.equal(item.source, 'https://vx553.menuquickresto.ru/');
    }
  }
});
test('Blocked, corrupt and incorrectly shaped storage recover to an empty selection', () => {
  const validIds=new Set(items.map(item => item.id));
  assert.equal(readSaved({getItem:()=>{throw new Error('blocked')}},validIds).size,0);
  assert.equal(readSaved({getItem:()=>'{bad'},validIds).size,0);
  assert.equal(readSaved({getItem:()=>'{}'},validIds).size,0);
  assert.deepEqual([...readSaved({getItem:()=>'["classic-croissant","deleted-item",42,"classic-croissant"]'},validIds)],['classic-croissant']);
});
test('Russian result counts use the correct forms', () => {
  assert.deepEqual([0,1,2,5,11,21,23,81].map(itemLabel),['позиций','позиция','позиции','позиций','позиций','позиция','позиции','позиция']);
});
test('All sixteen menu photos have a supplied source and an existing file', () => {
  const photographed=items.filter(item=>item.photo);
  assert.equal(photographed.length,16);
  for(const item of photographed){assert.ok(['https://vk.com/cehperm','user-provided'].includes(item.photoSource));assert.ok(existsSync(new URL('../'+item.photo,import.meta.url)));}
});

test('All food chapter choices resolve to distinct items and matching photos', () => {
  for (const [chapterId, count] of [['porridge', 5], ['syrniki', 3], ['pasta', 2]]) {
    const entries = foodChapters.find(chapter => chapter.id === chapterId).entries;
    assert.equal(entries.length, count);
    assert.equal(new Set(entries.map(entry => entry.id)).size, count);
    for (const entry of entries) {
      const item = items.find(item => item.id === entry.id);
      assert.ok(item, entry.id);
      assert.equal(item.photo, `assets/dishes/${entry.image}`);
      const bytes = readFileSync(new URL('../' + item.photo, import.meta.url));
      assert.equal(bytes.readUInt32BE(16), entry.width, entry.id + ' image width');
      assert.equal(bytes.readUInt32BE(20), entry.height, entry.id + ' image height');
    }
  }
});
test('Every static document link and asset resolves inside the new project', () => {
  for (const document of ['index.html','menu/index.html']) {
    const url=new URL('../'+document, import.meta.url);
    const html=readFileSync(url,'utf8');
    const ids=[...html.matchAll(/\bid="([^"]+)"/g)].map(match=>match[1]);
    assert.equal(new Set(ids).size,ids.length,document+' has duplicate IDs');
    assert.equal([...html.matchAll(/<h1\b/g)].length,1);
    if (document === 'index.html') assert.ok(!html.includes('id="salad"'), 'The salad block is removed from the landing');
    assert.ok(!/photo-pending|data-photo=|Ожидает добавления/.test(html),'No unfinished image slots');
    for(const match of html.matchAll(/(?:href|src)="([^"]+)"/g)) {
      if(/^(https?:|mailto:|#|\?)/.test(match[1])) continue;
      const target=new URL(match[1],url);target.search='';target.hash='';
      assert.ok(existsSync(fileURLToPath(target)),`${document}: ${match[1]}`);
    }
  }
});
