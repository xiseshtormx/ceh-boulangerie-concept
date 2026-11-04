import { showcaseFrame, chapterProgress, clamp01 } from './food-showcase-model.js';

export function initFoodShowcase(root) {
  if (!root) return () => {};
  const stage = root.querySelector('.food-stage');
  const panels = [...root.querySelectorAll('[data-chapter]')].map(element => ({
    element, product: element.querySelector('.food-arrival'), title: element.querySelector('.food-title-ink'),
    description: [...element.querySelectorAll('.food-description-ink')],
    options: [...element.querySelectorAll('[data-variant]')], details: element.querySelector('.food-details')
  }));
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  let frame = 0, restoreFrame = 0, current = 0, target = 0, lastTime = 0, active = -1, visible = true, disposed = false, mode = '';
  let measuredWidth = 0, measuredHeight = 0;
  const quiet = () => reduced.matches || document.body.classList.contains('keyboard-input');
  const stop = () => { cancelAnimationFrame(frame); frame = 0; root.dataset.foodFrames = 'idle'; };
  const range = () => Math.max(1, root.offsetHeight - (stage.offsetHeight || window.innerHeight));
  const progress = () => clamp01(-root.getBoundingClientRect().top / range());
  const reveal = (element, value, distance = 105) => {
    element.style.transform = `translate3d(0,${(1 - value) * distance}%,0)`;
    element.style.opacity = String(value);
  };
  function render(value) {
    const scene = showcaseFrame(value, panels.length, mode === 'compact');
    root.dataset.foodProgress = value.toFixed(5);
    root.dataset.foodChapter = panels[scene.active].element.dataset.chapter;
    const incoming = panels[scene.active].element;
    incoming.inert = false; incoming.style.visibility = 'visible'; incoming.setAttribute('aria-hidden', 'false');
    panels.forEach((panel, index) => {
      const state = scene.panels[index], selected = index === scene.active;
      panel.element.style.visibility = state.visible ? 'visible' : 'hidden';
      panel.element.style.zIndex = selected ? '2' : '1';
      panel.element.style.pointerEvents = selected ? 'auto' : 'none';
      // Transfer focus before deactivating the previous semantic scene.
      if (!selected && panel.element.contains(document.activeElement)) {
        const heading = panels[scene.active].element.querySelector('h2');
        heading.setAttribute('tabindex', '-1'); heading.focus({ preventScroll: true });
      }
      panel.element.inert = !selected;
      panel.element.setAttribute('aria-hidden', String(!selected));
      const pose = state.product;
      panel.product.style.transform = `translate3d(${pose.x}px,${pose.y}px,0) scale(${pose.scale})`;
      panel.product.style.opacity = String(pose.opacity);
      reveal(panel.title, state.title);
      panel.description.forEach((line, item) => reveal(line, state.description(item), 102));
      panel.options.forEach((button, item) => {
        const amount = state.option(item);
        reveal(button.querySelector('.food-option-ink'), amount, 105);
        button.style.pointerEvents = selected && amount > .97 ? 'auto' : 'none';
        button.tabIndex = amount > .97 || (selected && item === 0) ? 0 : -1;
      });
      panel.details.style.opacity = String(state.details);
      panel.details.style.pointerEvents = selected && state.details > .97 ? 'auto' : 'none';
      panel.details.tabIndex = state.details > .97 ? 0 : -1;
    });
    if (scene.active !== active) {
      if (active >= 0) panels[active].element.dispatchEvent(new Event('food:deactivate'));
      panels[scene.active].element.dispatchEvent(new Event('food:activate'));
      active = scene.active;
    }
  }
  function reset() {
    panels.forEach(panel => {
      panel.element.removeAttribute('style'); panel.element.inert = false; panel.element.removeAttribute('aria-hidden');
      [panel.product, panel.title, ...panel.description, panel.details].forEach(element => element.removeAttribute('style'));
      panel.options.forEach(button => { button.removeAttribute('style'); button.tabIndex = 0; button.querySelector('.food-option-ink').removeAttribute('style'); });
      panel.details.tabIndex = 0;
    });
  }
  function tick(time) {
    frame = 0;
    if (!visible || document.hidden || disposed || mode === 'static') { stop(); return; }
    const dt = Math.min(64, time - lastTime || 16); lastTime = time;
    current += (target - current) * (1 - Math.exp(-dt / (mode === 'compact' ? 75 : 140)));
    if (Math.abs(target - current) < .00012) current = target;
    render(current);
    if (current !== target) frame = requestAnimationFrame(tick); else root.dataset.foodFrames = 'idle';
  }
  function read(immediate = false) {
    if (disposed || mode === 'static') return;
    target = progress();
    if (immediate || quiet()) { stop(); current = target; render(current); return; }
    if (!frame && visible && !document.hidden) { lastTime = performance.now(); root.dataset.foodFrames = 'active'; frame = requestAnimationFrame(tick); }
  }
  function measure() {
    if (disposed) return;
    const next = reduced.matches || window.innerHeight < 640 ? 'static' : window.innerWidth <= 760 ? 'compact' : 'cinematic';
    const resized = measuredWidth !== window.innerWidth || measuredHeight !== window.innerHeight;
    const preserve = mode && mode !== 'static' && next !== 'static' && resized && visible;
    const previous = current;
    measuredWidth = window.innerWidth; measuredHeight = window.innerHeight;
    stop();
    if (next !== mode) { reset(); mode = next; root.dataset.foodMode = mode; }
    if (preserve) window.scrollTo({ top: root.getBoundingClientRect().top + window.scrollY + previous * range(), behavior: 'instant' });
    if (mode !== 'static') read(true);
  }
  function jump(index) {
    const start = root.getBoundingClientRect().top + window.scrollY;
    window.scrollTo({ top: start + chapterProgress(index) * range(), behavior: 'instant' });
    read(true);
  }
  function seek(index, last = false) {
    jump(index);
    const controls = [...panels[index].options, panels[index].details];
    controls[last ? controls.length - 1 : 0].focus({ preventScroll: true });
  }
  // Native Tab order continues through all chapters, without invisible focus targets.
  function key(event) {
    if (mode === 'static') return;
    if (event.key === 'Tab') {
      const panel = panels[active];
      if (!event.shiftKey && document.activeElement === panel.details && active < panels.length - 1) { event.preventDefault(); seek(active + 1); }
      else if (event.shiftKey && document.activeElement === panel.options[0] && active > 0) { event.preventDefault(); seek(active - 1, true); }
    }
    read(true);
  }
  function focus() {
    if (mode === 'static') return;
    panels.forEach((panel, index) => {
      const item = panel.options.indexOf(document.activeElement);
      // The existing first flavor is the keyboard entry point; reveal its scene synchronously.
      if (item >= 0 && showcaseFrame(current, panels.length).panels[index].option(item) < .97) jump(index);
    });
  }
  const scroll = () => read();
  const route = () => {
    const hash = window.location?.hash;
    const index = panels.findIndex(panel => '#' + panel.element.id === hash);
    if (index >= 0 && mode !== 'static') jump(index);
  };
  const restore = () => {
    measure(); cancelAnimationFrame(restoreFrame);
    // Native history/hash restoration occurs after pageshow. Seek once after it.
    restoreFrame = requestAnimationFrame(() => { restoreFrame = 0; if (!disposed && !document.hidden) route(); });
  };
  const visibility = () => { if (document.hidden) stop(); else read(true); };
  const observer = new IntersectionObserver(([entry]) => { visible = entry.isIntersecting; if (visible) read(true); else stop(); });
  observer.observe(root);
  window.addEventListener('scroll', scroll, { passive: true }); window.addEventListener('resize', measure, { passive: true });
  window.addEventListener('pageshow', restore); window.addEventListener('hashchange', route); document.addEventListener('visibilitychange', visibility);
  root.addEventListener('keydown', key); root.addEventListener('focusin', focus); reduced.addEventListener('change', measure);
  measure(); document.fonts?.ready.then(() => { if (!disposed) measure(); });
  return () => {
    disposed = true; stop(); cancelAnimationFrame(restoreFrame); observer.disconnect(); reset(); root.removeAttribute('data-food-mode');
    window.removeEventListener('scroll', scroll); window.removeEventListener('resize', measure); window.removeEventListener('pageshow', restore);
    window.removeEventListener('hashchange', route);
    document.removeEventListener('visibilitychange', visibility); root.removeEventListener('keydown', key); reduced.removeEventListener('change', measure);
    root.removeEventListener('focusin', focus);
  };
}
