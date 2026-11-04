import { foodPhoto } from './food-media.js';

const clamp = value => Math.min(1, Math.max(-1, value));
export function foodDrift(top, height, viewportHeight, mobile = false) {
  return -clamp((viewportHeight / 2 - (top + height / 2)) / ((viewportHeight + height) / 2)) * (mobile ? 5 : 12);
}

export function initFoodScene(section, chapter, {
  baseURL = new URL('.', import.meta.url), motionAllowed = () => true, onError = () => {}
} = {}) {
  if (!section || !chapter) return () => {};
  const media = matchMedia('(prefers-reduced-motion: reduce)');
  const images = [...section.querySelectorAll('.food-image')];
  const buttons = [...section.querySelectorAll('[data-variant]')];
  const details = section.querySelector('.food-details');
  const drift = section.querySelector('.food-drift');
  const arrival = section.querySelector('.food-arrival');
  const title = section.querySelector('.food-title-ink');
  const description = section.querySelector('.food-copy p');
  const options = section.querySelector('.food-options');
  const cache = new Map();
  const entrance = new Set();
  let currentLayer = images.find(image => image.classList.contains('is-current')) || images[0];
  let current = 0, selected = 0, version = 0, fadeVersion = 0, fades = [];
  let disposed = false, entered = false, inView = false, keyboard = false, frame = 0, lastTime = 0, y = 0;
  const allowed = () => !media.matches && !keyboard && motionAllowed() && !document.hidden;
  const selectedState = () => buttons.forEach((button, index) => button.setAttribute('aria-pressed', String(index === selected)));
  section.dataset.foodState = 'idle';
  section.dataset.foodVariant = chapter.entries[0].id;

  function settleEntrance() {
    entrance.forEach(animation => animation.cancel()); entrance.clear();
    entered = true; section.dataset.foodState = 'settled';
  }
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
  function stopDrift() { cancelAnimationFrame(frame); frame = 0; section.dataset.foodFrames = 'idle'; }
  function stopMotion() {
    settleEntrance(); settleFade(); stopDrift(); y = 0;
    drift.style.transform = 'translate3d(0,0,0)';
  }
  function tick(time) {
    frame = 0;
    if (!inView || !allowed() || disposed) { section.dataset.foodFrames = 'idle'; return; }
    const box = section.getBoundingClientRect();
    const target = foodDrift(box.top, box.height, window.innerHeight, window.innerWidth <= 760);
    const delta = Math.min(64, time - lastTime || 16); lastTime = time;
    y += (target - y) * (1 - Math.exp(-delta / 100));
    if (Math.abs(target - y) < .02) y = target;
    drift.style.transform = `translate3d(0,${y}px,0)`;
    if (y !== target) frame = requestAnimationFrame(tick);
    else section.dataset.foodFrames = 'idle';
  }
  function scroll() {
    if (inView && entered && allowed() && !disposed && !frame) {
      lastTime = performance.now(); section.dataset.foodFrames = 'active'; frame = requestAnimationFrame(tick);
    }
  }
  async function enter() {
    if (entered || disposed) return;
    entered = true; section.dataset.foodState = 'waiting';
    if (!allowed() || section.getBoundingClientRect().top < -40) { settleEntrance(); scroll(); return; }
    try { await currentLayer.decode(); } catch { /* Text and the existing image remain usable. */ }
    if (disposed || !inView || !allowed() || section.dataset.foodState === 'settled') { if (!disposed) settleEntrance(); return; }
    const animate = (element, keyframes, duration, delay) => {
      if (!element?.animate) return;
      const animation = element.animate(keyframes, { duration, delay, fill: 'both', easing: 'cubic-bezier(.23,1,.32,1)' });
      entrance.add(animation);
      return animation.finished.catch(() => {});
    };
    const finished = [
      animate(arrival, [{ opacity: 0, transform: 'translate3d(0,26px,0) scale(.97)' }, { opacity: 1, transform: 'none' }], 800, 0),
      animate(title, [{ transform: 'translate3d(0,108%,0)' }, { transform: 'none' }], 650, 90),
      animate(description, [{ opacity: 0, transform: 'translate3d(0,8px,0)' }, { opacity: 1, transform: 'none' }], 560, 150),
      animate(options, [{ opacity: 0, transform: 'translate3d(0,6px,0)' }, { opacity: 1, transform: 'none' }], 480, 220),
      animate(details, [{ opacity: 0 }, { opacity: 1 }], 420, 280)
    ];
    section.dataset.foodState = 'entering';
    await Promise.all(finished);
    if (!disposed) { settleEntrance(); scroll(); }
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
    settleEntrance(); settleFade(); selectedState();
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
  const observer = new IntersectionObserver(([entry]) => {
    inView = entry.isIntersecting;
    if (!inView) { stopDrift(); return; }
    if ((entry.intersectionRatio ?? 1) >= .18) enter();
    scroll();
    if (!navigator.connection?.saveData && chapter.entries.length > 1) preload(1).catch(() => {});
  }, { rootMargin: '0px 0px -8% 0px', threshold: .18 });
  const key = () => { keyboard = true; stopMotion(); };
  const pointer = () => { keyboard = false; scroll(); };
  const pointerMove = event => { if (keyboard && event.pointerType === 'mouse') pointer(); };
  const preference = () => { if (media.matches) stopMotion(); else scroll(); };
  const visibility = () => { if (document.hidden) stopMotion(); else scroll(); };
  const restore = event => { if (event.persisted) { stopMotion(); scroll(); } };
  document.addEventListener('keydown', key, { capture: true });
  document.addEventListener('pointerdown', pointer, { passive: true });
  document.addEventListener('pointermove', pointerMove, { passive: true });
  document.addEventListener('visibilitychange', visibility);
  window.addEventListener('scroll', scroll, { passive: true }); window.addEventListener('resize', scroll, { passive: true });
  window.addEventListener('pageshow', restore); media.addEventListener('change', preference);
  observer.observe(section);
  return () => {
    disposed = true; version++; stopMotion(); observer.disconnect(); cache.clear();
    handlers.forEach(({ button, click, warm }) => { button.removeEventListener('click', click); button.removeEventListener('pointerenter', warm); button.removeEventListener('focus', warm); });
    document.removeEventListener('keydown', key, { capture: true }); document.removeEventListener('pointerdown', pointer);
    document.removeEventListener('pointermove', pointerMove);
    document.removeEventListener('visibilitychange', visibility);
    window.removeEventListener('scroll', scroll); window.removeEventListener('resize', scroll); window.removeEventListener('pageshow', restore);
    media.removeEventListener('change', preference);
  };
}

export function initFoodScenes(root, { chapters = [], ...options } = {}) {
  if (!root) return () => {};
  const disposers = [...root.querySelectorAll('[data-chapter]')].map(section => initFoodScene(section, chapters.find(chapter => chapter.id === section.dataset.chapter), options));
  return () => disposers.forEach(dispose => dispose());
}
