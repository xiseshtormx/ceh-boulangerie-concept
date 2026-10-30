export const normalize = (value) => value.toLocaleLowerCase('ru').replaceAll('ё', 'е').replace(/[^\p{L}\p{N}\s]/gu, ' ').replace(/\s+/g, ' ').trim();
export function filterMenu(items, { category = 'all', query = '', savedOnly = false }, saved = new Set()) {
  const words = normalize(query).split(' ').filter(Boolean);
  return items.filter((item) => (category === 'all' || item.category === category) && (!savedOnly || saved.has(item.id)) && words.every((word) => normalize(item.name + ' ' + (item.description || '')).includes(word)));
}
export function itemLabel(count) {
  const n = Math.abs(count) % 100;
  return n > 10 && n < 20 ? 'позиций' : n % 10 === 1 ? 'позиция' : n % 10 >= 2 && n % 10 <= 4 ? 'позиции' : 'позиций';
}
export function readSaved(storage, validIds) {
  try { const value = JSON.parse(storage.getItem('ceh-saved-v1') || '[]'); return new Set(Array.isArray(value) ? value.filter(id => typeof id === 'string' && validIds.has(id)) : []); } catch { return new Set(); }
}
