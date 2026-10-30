import { filterMenu, itemLabel, readSaved } from './menu-model.js';
import { foodChapters } from './presentation.js';
import { createLocationPreview } from './location-preview.js';
import { initCoffeeStory } from './coffee-story.js';
import { initAboutStory } from './about.js';
import { initSiteHeader } from './header.js';

const projectRoot = new URL('.', import.meta.url);
const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)');
if (!reduceMotion.matches) document.documentElement.classList.add('motion-ready');
let keyboardInput = false;
document.addEventListener('keydown', () => { keyboardInput = true; document.body.classList.add('keyboard-input'); }, { capture: true });
document.addEventListener('pointerdown', () => { keyboardInput = false; document.body.classList.remove('keyboard-input'); }, { capture: true });
document.addEventListener('pointermove', event => { if (keyboardInput && event.pointerType === 'mouse') { keyboardInput = false; document.body.classList.remove('keyboard-input'); } }, { passive: true });
const motionAllowed = () => !reduceMotion.matches && !keyboardInput;
initCoffeeStory(document.querySelector('#coffee'));
initAboutStory(document.querySelector('#about'));
initSiteHeader(document.querySelector('.site-header'));
const $ = (selector, parent = document) => parent.querySelector(selector);
const $$ = (selector, parent = document) => [...parent.querySelectorAll(selector)];
const escapeHTML = (value) => String(value).replace(/[&<>"']/g, (ch) => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
const priceText = item => Number.isFinite(item.price) ? `${item.price.toLocaleString('ru-RU')} ₽` : 'Цену уточняйте';
let menuData;
let saved = new Set();
const menuReady = fetch(new URL('catalog.json', projectRoot)).then(r => { if (!r.ok) throw new Error('menu'); return r.json(); }).then(data => { menuData = data; let storage; try { storage = localStorage; } catch { storage = { getItem: () => null }; } saved = readSaved(storage, new Set(data.items.map(item => item.id))); return data; });
// A handled promise also keeps the landing usable if the catalogue cannot load.
menuReady.catch(() => {});
let lastFocus;
let lastProductId;
const closeTimers = new WeakMap();
function openDialog(dialog) {
  if (!dialog) return;
  clearTimeout(closeTimers.get(dialog));
  dialog.classList.remove('is-closing');
  lastFocus = document.activeElement;
  lastProductId = lastFocus instanceof HTMLElement ? lastFocus.dataset.product : null;
  if (!dialog.open) dialog.showModal();
  document.body.classList.add('dialog-open');

}
function closeDialog(dialog) {
  if (!dialog?.open) return;
  const finish = () => {
    dialog.close(); dialog.classList.remove('is-closing');
    if (!$('dialog[open]')) document.body.classList.remove('dialog-open');

    const focusTarget = (lastFocus instanceof HTMLElement && document.contains(lastFocus) ? lastFocus : lastProductId ? $(`[data-product="${CSS.escape(lastProductId)}"]`) : null) || $('#filter-saved');
    focusTarget?.focus({ preventScroll: true });
  };
  clearTimeout(closeTimers.get(dialog));
  if (motionAllowed()) { dialog.classList.add('is-closing'); closeTimers.set(dialog, setTimeout(finish, 170)); } else finish();
}
$$('dialog').forEach(dialog => {
  dialog.addEventListener('cancel', event => { event.preventDefault(); closeDialog(dialog); });
  let startedOnBackdrop = false;
  dialog.addEventListener('pointerdown', event => { const box = dialog.getBoundingClientRect(); startedOnBackdrop = event.clientX < box.left || event.clientX > box.right || event.clientY < box.top || event.clientY > box.bottom; });
  dialog.addEventListener('click', event => { const box = dialog.getBoundingClientRect(); if (startedOnBackdrop && (event.clientX < box.left || event.clientX > box.right || event.clientY < box.top || event.clientY > box.bottom)) closeDialog(dialog); startedOnBackdrop = false; });
  dialog.addEventListener('close', () => { if (!$('dialog[open]')) document.body.classList.remove('dialog-open'); });
});
$$('[data-close-dialog]').forEach(button => button.addEventListener('click', () => closeDialog(button.closest('dialog'))));
$$('[data-open-credits]').forEach(button => button.addEventListener('click', () => openDialog($('#credits-dialog'))));
document.addEventListener('click', event => {
  const link = event.target.closest('a[href^="#"]');
  if (!link || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
  const target = document.getElementById(link.getAttribute('href').slice(1));
  if (!target) return;
  event.preventDefault();
  target.scrollIntoView({ behavior: motionAllowed() ? 'smooth' : 'instant' });
  history.pushState(null, '', link.getAttribute('href'));
  if (keyboardInput) { target.setAttribute('tabindex', '-1'); target.focus({ preventScroll: true }); }
});

let toastTimer;
function toast(text) { const box = $('.toast'); if (!box) return; clearTimeout(toastTimer); box.textContent = text; box.classList.add('visible'); toastTimer = setTimeout(() => box.classList.remove('visible'), 2600); }
function syncSaved() {
  try { localStorage.setItem('ceh-saved-v1', JSON.stringify([...saved])); } catch { /* Current-session selection still works when storage is unavailable. */ }
  $$('.saved-count').forEach(el => { el.textContent = String(saved.size); el.hidden = saved.size === 0; });
  if ($('#menu-results')) renderMenu(false);
}
function toggleSaved(id) {
  const adding = !saved.has(id);
  if (adding) saved.add(id); else saved.delete(id);
  syncSaved(); toast(adding ? 'Сохранено в избранное' : 'Убрано из избранного');
  return adding;
}
async function showProduct(id) {
  try {
    const data = await menuReady;
    const product = data.items.find(item => item.id === id);
    if (!product) return;
    const category = data.categories.find(cat => cat.id === product.category);
    const content = $('#product-content');
    content.innerHTML = `${product.photo ? `<img class="product-photo" src="${new URL(product.photo, projectRoot).href}" alt="${escapeHTML(product.name)}">` : ''}<span class="product-category">${escapeHTML(category?.label || 'Меню')}</span><h2 id="product-title">${escapeHTML(product.name)}</h2><p class="product-price">${priceText(product)}</p><p class="product-description">${escapeHTML(product.description || 'Состав уточняйте в меню пекарни.')}</p><p class="product-note">${Number.isFinite(product.price) ? `Цена из меню от ${escapeHTML(data.verifiedAt)}. ` : ''}Наличие${Number.isFinite(product.price) ? '' : ', стоимость'} и аллергены уточняйте у команды пекарни. Оформление заказа — в отдельном сервисе «Цеха».</p><div class="product-actions"><button class="save-product" aria-pressed="${saved.has(id)}">${saved.has(id) ? 'В избранном' : 'Сохранить в избранное'}</button><a class="button" href="${escapeHTML(data.orderUrl)}" target="_blank" rel="noopener noreferrer">Сервис заказа «Цеха»</a></div>`;
    $('.save-product', content).addEventListener('click', event => { const active = toggleSaved(id); event.currentTarget.setAttribute('aria-pressed', String(active)); event.currentTarget.textContent = active ? 'В избранном' : 'Сохранить в избранное'; });
    openDialog($('#product-dialog'));
  } catch { toast('Не удалось загрузить меню. Попробуйте обновить страницу.'); }
}
document.addEventListener('click', event => { const trigger = event.target.closest('[data-product]'); if (trigger) showProduct(trigger.dataset.product); });

// Shared motion language: a short press, a quiet reveal, native scrolling.
const observer = new IntersectionObserver(entries => {
  for (const entry of entries) if (entry.isIntersecting) { entry.target.classList.add('revealed'); observer.unobserve(entry.target); }
}, { threshold: 0.12 });
$$('[data-reveal]').forEach(el => observer.observe(el));
// Variations belong to the food chapters, never to the opening scene.
$$('[data-chapter]').forEach(section => {
  const chapter = foodChapters.find(item => item.id === section.dataset.chapter);
  if (!chapter || chapter.entries.length < 2) return;
  const image = $('.food-image', section);
  const buttons = $$('[data-variant]', section);
  let current = 0, selected = 0, request = 0, timer;
  buttons.forEach((button, index) => button.addEventListener('click', async () => {
    if (index === selected) return;
    selected = index;
    const version = ++request;
    clearTimeout(timer);
    const entry = chapter.entries[index];
    buttons.forEach((other, i) => other.setAttribute('aria-pressed', String(i === index)));
    const source = new URL(`assets/dishes/${entry.image}`, projectRoot).href;
    try {
      const next = new Image(); next.src = source;
      await next.decode();
      if (version !== request) return;
      const commit = () => {
        if (version !== request) return;
        image.src = source; image.alt = entry.alt;
        image.width = entry.width; image.height = entry.height;
        $('.food-details', section).dataset.product = entry.id;
        current = index;
        requestAnimationFrame(() => { if (version === request) image.classList.remove('changing'); });
      };
      if (motionAllowed()) { image.classList.add('changing'); timer = setTimeout(commit, 120); }
      else { commit(); image.classList.remove('changing'); }
    } catch {
      if (version === request) {
        selected = current;
        buttons.forEach((other, i) => other.setAttribute('aria-pressed', String(i === current)));
        image.classList.remove('changing'); toast('Не удалось загрузить фотографию.');
      }
    }
  }));
});

// Interruptible address movement: layout updates once, only transforms animate.
const locationRows = $$('.location');
createLocationPreview($('#places'), { motionAllowed });
let locationAnimations = [], hoverTimer;
function setLocation(target, open) {
  const positions = locationRows.map(row => row.getBoundingClientRect().top);
  locationAnimations.forEach(animation => animation.cancel());
  locationAnimations = [];
  locationRows.forEach(row => { row.open = row === target && open; });
  if (!motionAllowed()) return;
  locationRows.forEach((row, index) => {
    const distance = positions[index] - row.getBoundingClientRect().top;
    if (Math.abs(distance) > 1) locationAnimations.push(row.animate([
      { transform: `translateY(${distance}px)` }, { transform: 'translateY(0)' }
    ], { duration: 250, easing: 'cubic-bezier(.23,1,.32,1)' }));
  });
  if (open) locationAnimations.push($('.location-content', target).animate([
    { opacity: 0, transform: 'translateY(4px)' }, { opacity: 1, transform: 'translateY(0)' }
  ], { duration: 200, easing: 'cubic-bezier(.23,1,.32,1)' }));
}
locationRows.forEach(row => {
  $('summary', row).addEventListener('click', event => {
    event.preventDefault(); clearTimeout(hoverTimer); setLocation(row, !row.open);
  });
  row.addEventListener('pointerenter', event => {
    if (event.pointerType !== 'mouse' || !matchMedia('(hover: hover) and (pointer: fine)').matches || row.open) return;
    clearTimeout(hoverTimer); hoverTimer = setTimeout(() => setLocation(row, true), 90);
  });
  row.addEventListener('pointerleave', () => clearTimeout(hoverTimer));
});
// Menu filtering preserves URLs, focus, and native browser history.
const state = { category: 'all', query: '', savedOnly: false };
let listAnimations = [];
function stateFromURL() { const params = new URLSearchParams(location.search); state.category = menuData?.categories.some(cat => cat.id === params.get('category')) ? params.get('category') : 'all'; state.query = params.get('q') || ''; state.savedOnly = params.get('saved') === '1'; }
function writeURL() { const url = new URL(location.href); url.search = ''; if (state.category !== 'all') url.searchParams.set('category', state.category); if (state.query.trim()) url.searchParams.set('q', state.query.trim()); if (state.savedOnly) url.searchParams.set('saved', '1'); history.replaceState(null, '', url); }
function renderMenu(animate = true) {
  if (!menuData || !$('#menu-results')) return;
  const result = filterMenu(menuData.items, state, saved);
  const holder = $('#menu-results');
  const groups = menuData.categories.map(cat => ({ ...cat, entries: result.filter(item => item.category === cat.id) })).filter(cat => cat.entries.length);
  const heading = state.savedOnly ? 'Ваше избранное' : state.category === 'all' ? 'Всё меню' : menuData.categories.find(cat => cat.id === state.category)?.label;
  $('#results-count').textContent = `${result.length} ${itemLabel(result.length)}`;
  $('#results-label').textContent = heading;
  $('#filter-saved').setAttribute('aria-pressed', String(state.savedOnly));
  $$('.saved-count').forEach(el => { el.textContent = String(saved.size); el.hidden = saved.size === 0; });
  $$('#category-nav button').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.category === state.category)));
  $('#clear-search').hidden = !state.query;
  holder.innerHTML = groups.length ? groups.map(group => `<section class="catalog-group" aria-label="${escapeHTML(group.label)}"><h2>${escapeHTML(group.label)}</h2>${group.entries.map(item => `<button class="catalog-row${saved.has(item.id) ? ' is-saved' : ''}${Number.isFinite(item.price) ? '' : ' has-unconfirmed-price'}" data-product="${escapeHTML(item.id)}" aria-label="${escapeHTML(item.name)}, ${Number.isFinite(item.price) ? `${item.price} рублей` : 'цену уточняйте'}, посмотреть состав"><span class="catalog-name"><span class="catalog-row-name">${escapeHTML(item.name)}</span></span>${item.photo ? `<img class="catalog-thumb" src="${new URL(item.photo, projectRoot).href}" alt="" loading="lazy" width="64" height="58">` : ''}<span class="catalog-row-price">${priceText(item)}</span></button>`).join('')}</section>`).join('') : `<div class="empty-state"><h2>${state.savedOnly && !saved.size ? 'Здесь будет ваш выбор.' : 'Ничего не нашлось.'}</h2><p>${state.savedOnly && !saved.size ? 'Откройте блюдо и сохраните его в избранное.' : 'Попробуйте другое название или посмотрите всё меню.'}</p><button class="button" id="reset-filters">Показать всё меню</button></div>`;
  $('#reset-filters')?.addEventListener('click', () => { Object.assign(state, { category: 'all', query: '', savedOnly: false }); $('#menu-search').value = ''; writeURL(); renderMenu(); });
  listAnimations.forEach(animation => animation.cancel()); listAnimations = [];
  if (animate && motionAllowed()) listAnimations = [holder.animate([{ opacity: .6 }, { opacity: 1 }], { duration: 140, easing: 'cubic-bezier(.23,1,.32,1)' })];
}
async function initMenu() {
  if (!$('#menu-results')) return;
  try {
    await menuReady; stateFromURL();
    $('#category-nav').innerHTML = '<button data-category="all" aria-pressed="true">Всё меню</button>' + menuData.categories.map(cat => `<button data-category="${cat.id}" aria-pressed="false">${escapeHTML(cat.label)}</button>`).join('');
    $('#menu-search').value = state.query;
    $('#category-nav').addEventListener('click', event => { const button = event.target.closest('[data-category]'); if (!button) return; state.category = button.dataset.category; writeURL(); renderMenu(); });
    $('#menu-search').addEventListener('input', event => { state.query = event.target.value; writeURL(); renderMenu(false); });
    $('#clear-search').addEventListener('click', () => { state.query = ''; $('#menu-search').value = ''; writeURL(); renderMenu(); $('#menu-search').focus(); });
    $('#filter-saved').addEventListener('click', () => { state.savedOnly = !state.savedOnly; writeURL(); renderMenu(); });
    window.addEventListener('popstate', () => { stateFromURL(); $('#menu-search').value = state.query; renderMenu(false); });
    window.addEventListener('storage', event => { if (event.key === 'ceh-saved-v1' || event.key === null) { try { saved = readSaved(localStorage, new Set(menuData.items.map(item => item.id))); } catch { saved = new Set(); } renderMenu(false); } });
    renderMenu(false);
  } catch { $('#menu-results').innerHTML = `<div class="empty-state"><h2>Меню временно недоступно.</h2><p>Можно посмотреть ассортимент<br>в действующем меню пекарни.</p><a class="button" href="https://vx553.menuquickresto.ru/" target="_blank" rel="noopener noreferrer">Открыть меню «Цеха»</a></div>`; $('#results-count').textContent = ''; }
}
initMenu();
