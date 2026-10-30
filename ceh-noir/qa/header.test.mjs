import test from 'node:test';
import assert from 'node:assert/strict';
import { initSiteHeader, initSiteNavigation, initHeaderMorph } from '../header.js';

function browser(t, position = 0) {
  const old = new Map(), frames = new Map(), classes = new Set();
  let changes = 0, id = 0;
  const put = (key, value) => {
    old.set(key, Object.getOwnPropertyDescriptor(globalThis, key));
    Object.defineProperty(globalThis, key, { configurable: true, value });
  };
  const win = Object.assign(new EventTarget(), { scrollY: position });
  put('window', win);
  put('requestAnimationFrame', callback => { frames.set(++id, callback); return id; });
  put('cancelAnimationFrame', frame => frames.delete(frame));
  t.after(() => {
    for (const [key, descriptor] of old) {
      if (descriptor) Object.defineProperty(globalThis, key, descriptor);
      else delete globalThis[key];
    }
  });
  const header = Object.assign(new EventTarget(), { querySelector: () => null, classList: { contains: name => classes.has(name), toggle(name, active) { changes++; if (active) classes.add(name); else classes.delete(name); } } });
  const scroll = value => { win.scrollY = value; win.dispatchEvent(new Event('scroll')); };
  const flush = () => { const work = [...frames.values()]; frames.clear(); work.forEach(callback => callback()); };
  return { win, header, frames, scroll, flush, put, glass: () => classes.has('is-scrolled'), changes: () => changes };
}

test('a restored scrolled page gets glass immediately and clears it at the top', t => {
  const page = browser(t, 800);
  const dispose = initSiteHeader(page.header);
  assert.equal(page.glass(), true);
  page.win.scrollY = 0;
  page.win.dispatchEvent(new Event('pageshow'));
  assert.equal(page.glass(), false);
  assert.equal(page.frames.size, 0);
  dispose();
});

test('rapid direction changes coalesce into the current position without a stale flash', t => {
  const page = browser(t);
  const dispose = initSiteHeader(page.header);
  page.scroll(100); page.scroll(0);
  assert.equal(page.frames.size, 1);
  page.flush();
  assert.equal(page.glass(), false);
  assert.equal(page.changes(), 1, 'Do not restyle the header when its state has not changed');
  page.scroll(100); page.flush();
  assert.equal(page.glass(), true);
  page.scroll(25); page.flush();
  assert.equal(page.glass(), true, 'Small threshold crossings must not flicker');
  page.scroll(0); page.flush();
  assert.equal(page.glass(), false);
  dispose();
});

test('page restoration and disposal cancel pending frames and release listeners', t => {
  const page = browser(t);
  const dispose = initSiteHeader(page.header);
  page.scroll(200);
  page.win.dispatchEvent(new Event('pageshow'));
  assert.equal(page.frames.size, 0);
  assert.equal(page.glass(), true);
  page.scroll(0);
  dispose();
  assert.equal(page.frames.size, 0);
  page.scroll(900);
  assert.equal(page.frames.size, 0);
});

function navigation(t, native = true) {
  const scene = browser(t), doc = new EventTarget(), attributes = new Map();
  scene.put('document', doc);
  let firstFocus = 0, triggerFocus = 0, nativeOpen = false;
  const trigger = Object.assign(new EventTarget(), {
    setAttribute: (name, value) => attributes.set(name, value),
    removeAttribute: name => attributes.delete(name),
    focus: () => { triggerFocus++; }
  });
  const label = { textContent: 'Меню' };
  const link = { focus: () => { firstFocus++; }, closest: () => link };
  const panel = Object.assign(new EventTarget(), {
    hidden: false, classList: { toggle() {} },
    removeAttribute() {}, querySelector: () => link
  });
  const change = open => {
    nativeOpen = open;
    panel.dispatchEvent(Object.assign(new Event('beforetoggle'), { newState: open ? 'open' : 'closed' }));
  };
  if (native) { panel.showPopover = () => change(true); panel.hidePopover = () => change(false); }
  const elements = { '.edge-nav-toggle': trigger, '.edge-navigation': panel, '.edge-nav-label': label };
  scene.header.querySelector = name => elements[name];
  scene.header.contains = target => [trigger, panel, label, link].includes(target);
  const clickLink = (modified = false) => {
    const event = Object.assign(new Event('click'), { ctrlKey: modified });
    Object.defineProperty(event, 'target', { value: link });
    panel.dispatchEvent(event);
  };
  return { ...scene, doc, trigger, panel, label, attributes, change, clickLink,
    nativeOpen: () => nativeOpen, firstFocus: () => firstFocus, triggerFocus: () => triggerFocus };
}

test('native navigation synchronizes its accessible state and dismisses links and restored pages', t => {
  const nav = navigation(t);
  const dispose = initSiteNavigation(nav.header);
  nav.change(true);
  assert.equal(nav.attributes.get('aria-expanded'), 'true');
  assert.equal(nav.label.textContent, 'Закрыть');
  nav.clickLink(true);
  assert.equal(nav.nativeOpen(), true, 'Opening a new tab must not dismiss the current navigation');
  nav.clickLink();
  assert.equal(nav.nativeOpen(), false);
  assert.equal(nav.attributes.get('aria-label'), 'Открыть навигацию');
  nav.change(true);
  nav.win.dispatchEvent(new Event('pageshow'));
  assert.equal(nav.nativeOpen(), false, 'Back/forward restoration must not leave a stale panel open');
  dispose();
});

test('the non-popover fallback focuses its links, closes on Escape/outside click, and cleans up', t => {
  const nav = navigation(t, false);
  const dispose = initSiteNavigation(nav.header);
  assert.equal(nav.panel.hidden, true);
  nav.trigger.dispatchEvent(new Event('click'));
  assert.equal(nav.panel.hidden, false);
  assert.equal(nav.firstFocus(), 1);
  const escape = Object.assign(new Event('keydown', { cancelable: true }), { key: 'Escape' });
  nav.doc.dispatchEvent(escape);
  assert.equal(escape.defaultPrevented, true);
  assert.equal(nav.panel.hidden, true);
  assert.equal(nav.triggerFocus(), 1);
  nav.trigger.dispatchEvent(new Event('click'));
  nav.doc.dispatchEvent(new Event('pointerdown'));
  assert.equal(nav.panel.hidden, true);
  dispose();
  nav.trigger.dispatchEvent(new Event('click'));
  assert.equal(nav.panel.hidden, true);
});

function morph(t, { position = 0, reduced = false } = {}) {
  const page = browser(t, position), doc = Object.assign(new EventTarget(), { hidden: false, activeElement: {}, body: { classList: { contains: () => false } } });
  const media = Object.assign(new EventTarget(), { matches: reduced });
  page.put('document', doc); page.put('matchMedia', () => media);
  const node = () => ({ style: {}, setAttribute() {}, focus() { doc.activeElement = this; } });
  const brand = node(), menu = node(), addresses = node(), toggle = node(), links = node(), flight = node(), surface = node();
  const topLinks = [brand, menu, addresses];
  const top = Object.assign(node(), { querySelector: () => brand, querySelectorAll: () => topLinks, contains: target => topLinks.includes(target) });
  links.getBoundingClientRect = () => ({ left: 1160, top: 33, width: 160, height: 44 });
  page.header.getBoundingClientRect = () => ({ left: 1340, top: 378, width: 52, height: 144 });
  page.header.dataset = {};
  const elements = { '.hero-header': top, '.hero-header-links': links, '.edge-nav-flight': flight, '.edge-nav-toggle': toggle, '.hero-nav-surface': surface, '.edge-navigation': { contains: () => false } };
  page.header.querySelector = name => elements[name];
  const settle = () => { for (let i = 0; page.frames.size && i < 120; i++) page.flush(); assert.equal(page.frames.size, 0, 'Settled motion must release animation frames'); };
  return { ...page, doc, media, brand, menu, top, toggle, flight, settle };
}

test('restoring a scrolled homepage presents the side navigation without an entrance replay', t => {
  const page = morph(t, { position: 600 });
  const dispose = initHeaderMorph(page.header);
  assert.equal(page.header.dataset.headerProgress, '1.0000');
  assert.equal(page.top.inert, true);
  assert.equal(page.toggle.inert, false);
  assert.equal(Number(page.flight.style.opacity), 1);
  assert.equal(page.frames.size, 0);
  dispose();
});

test('reduced motion switches complete, usable navigation states without a travel animation', t => {
  const page = morph(t, { reduced: true });
  const dispose = initHeaderMorph(page.header);
  assert.equal(page.top.inert, false);
  assert.equal(page.toggle.inert, true);
  page.scroll(500);
  assert.equal(page.header.dataset.headerProgress, '1.0000');
  assert.equal(page.frames.size, 0);
  page.scroll(0);
  assert.equal(page.header.dataset.headerProgress, '0.0000');
  assert.equal(page.top.inert, false);
  dispose();
});

test('the header reverses from its current pose, settles, and transfers focus before hiding controls', t => {
  const page = morph(t);
  const dispose = initHeaderMorph(page.header);
  page.doc.activeElement = page.menu;
  page.scroll(500); page.flush();
  const forward = Number(page.header.dataset.headerProgress);
  assert.ok(forward > 0 && forward < 1);
  page.scroll(0); page.flush();
  assert.ok(Number(page.header.dataset.headerProgress) < forward, 'Reverse without jumping to an endpoint');
  page.settle();
  assert.equal(page.header.dataset.headerProgress, '0.0000');
  page.scroll(500); page.settle();
  assert.equal(page.doc.activeElement, page.toggle);
  page.scroll(0); page.settle();
  assert.equal(page.doc.activeElement, page.brand);
  assert.equal(Number(page.brand.style.opacity), 1);
  page.scroll(500);
  dispose();
  assert.equal(page.frames.size, 0);
});
