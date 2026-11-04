import { foodPhoto } from './food-media.js';
import { initFoodShowcase } from './food-showcase.js';

// Flavor changes are independent of the one scroll-directed showcase.
export function initFoodScene(section, chapter, {
  baseURL = new URL('.', import.meta.url), motionAllowed = () => true, onError = () => {}
} = {}) {
  if (!section || !chapter) return () => {};
  const media = matchMedia('(prefers-reduced-motion: reduce)');
  const images = [...section.querySelectorAll('.food-image')];
  const buttons = [...section.querySelectorAll('[data-variant]')];
  const details = section.querySelector('.food-details');
  const cache = new Map();
  let currentLayer = images.find(image => image.classList.contains('is-current')) || images[0];
  let current = 0, selected = 0, version = 0, fadeVersion = 0, fades = [];
  let disposed = false, keyboard = false;
  const allowed = () => !media.matches && !keyboard && motionAllowed() && !document.hidden;
  const selectedState = () => buttons.forEach((button, index) => button.setAttribute('aria-pressed', String(index === selected)));
  section.dataset.foodVariant = chapter.entries[0].id;
  function settleFade() {
    fadeVersion++;
    fades.forEach(animation => animation.cancel()); fades = [];
    images.forEach(image => {
      const active = image === currentLayer;
      image.style.opacity = active ? '1' : '0'; image.hidden = !active;
      image.classList.toggle('is-current', active);
      if (active) image.removeAttribute('aria-hidden'); else image.setAttribute('aria-hidden', 'true');
    });
  }
  function preload(index) {
    if (cache.has(index)) return cache.get(index);
    const photo = foodPhoto(chapter.entries[index]);
    const image = new Image(); image.decoding = 'async'; image.sizes = photo.sizes;
    image.srcset = photo.srcset.split(', ').map(source => { const [path, width] = source.split(' '); return `${new URL(path, baseURL).href} ${width}`; }).join(', ');
    image.src = new URL(photo.src, baseURL).href;
    const promise = image.decode().then(() => ({ image, photo })).catch(error => { cache.delete(index); throw error; });
    cache.set(index, promise); return promise;
  }
  async function choose(index) {
    if (disposed || index === selected) return;
    selected = index; const request = ++version;
    settleFade(); selectedState();
    if (index === current) { section.setAttribute('aria-busy', 'false'); return; }
    section.setAttribute('aria-busy', 'true');
    try {
      const { image } = await preload(index);
      if (disposed || request !== version) return;
      const outgoing = currentLayer, incoming = images.find(layer => layer !== outgoing);
      const entry = chapter.entries[index];
      incoming.sizes = image.sizes; incoming.srcset = image.srcset; incoming.src = image.src;
      incoming.width = entry.width; incoming.height = entry.height; incoming.alt = entry.alt;
      incoming.hidden = false; incoming.style.opacity = '1'; incoming.removeAttribute('aria-hidden');
      outgoing.alt = ''; outgoing.setAttribute('aria-hidden', 'true');
      outgoing.classList.remove('is-current'); incoming.classList.add('is-current');
      currentLayer = incoming; current = index;
      details.dataset.product = entry.id; section.dataset.foodVariant = entry.id;
      section.setAttribute('aria-busy', 'false');
      if (!allowed() || !incoming.animate) { settleFade(); return; }
      const token = ++fadeVersion;
      fades = [
        incoming.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 240, fill: 'both', easing: 'cubic-bezier(.23,1,.32,1)' }),
        outgoing.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 220, fill: 'both', easing: 'cubic-bezier(.23,1,.32,1)' })
      ];
      await Promise.all(fades.map(animation => animation.finished.catch(() => {})));
      if (!disposed && token === fadeVersion) settleFade();
    } catch {
      if (!disposed && request === version) {
        selected = current; selectedState(); section.setAttribute('aria-busy', 'false'); settleFade(); onError();
      }
    }
  }
  const handlers = buttons.map((button, index) => {
    const click = () => choose(index);
    const warm = () => { if (!disposed) preload(index).catch(() => {}); };
    button.addEventListener('click', click); button.addEventListener('pointerenter', warm); button.addEventListener('focus', warm);
    return { button, click, warm };
  });
  const warmNext = () => { if (!navigator.connection?.saveData && chapter.entries.length > 1) preload(1).catch(() => {}); };
  const warmScene = () => {
    currentLayer.loading = 'eager';
    currentLayer.decode().catch(() => {});
    warmNext();
  };
  const observer = new IntersectionObserver(([entry]) => { if (entry.isIntersecting) warmScene(); }, { rootMargin: '100% 0px' });
  const key = () => { keyboard = true; settleFade(); };
  const pointer = () => { keyboard = false; };
  const preference = () => { if (media.matches) settleFade(); };
  const visibility = () => { if (document.hidden) settleFade(); };
  section.addEventListener('food:activate', warmScene);
  section.addEventListener('food:deactivate', settleFade);
  document.addEventListener('keydown', key, { capture: true });
  document.addEventListener('pointerdown', pointer, { passive: true });
  document.addEventListener('visibilitychange', visibility);
  media.addEventListener('change', preference);
  observer.observe(section);
  return () => {
    disposed = true; version++; settleFade(); observer.disconnect(); cache.clear();
    handlers.forEach(({ button, click, warm }) => { button.removeEventListener('click', click); button.removeEventListener('pointerenter', warm); button.removeEventListener('focus', warm); });
    section.removeEventListener('food:activate', warmScene); section.removeEventListener('food:deactivate', settleFade);
    document.removeEventListener('keydown', key, { capture: true }); document.removeEventListener('pointerdown', pointer);
    document.removeEventListener('visibilitychange', visibility); media.removeEventListener('change', preference);
  };
}

export function initFoodScenes(root, { chapters = [], ...options } = {}) {
  if (!root) return () => {};
  const disposers = [...root.querySelectorAll('[data-chapter]')].map(section => initFoodScene(section, chapters.find(chapter => chapter.id === section.dataset.chapter), options));
  const disposeShowcase = initFoodShowcase(root);
  return () => { disposeShowcase(); disposers.forEach(dispose => dispose()); };
}
