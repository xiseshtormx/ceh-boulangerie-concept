import { coffeeState, coffeeProgress, smoothRange } from './coffee-timeline.js';

export function initCoffeeStory(root, { loadScene = () => root?.dataset.coffeeRenderer === '3d' ? import('./coffee-scene-3d.js') : import('./coffee-scene.js') } = {}) {
  if (!root) return;
  const story = root.querySelector('.coffee-story');
  const stage = root.querySelector('.coffee-stage');
  const canvas = root.querySelector('canvas');
  const pin = root.querySelector('.coffee-pin') || stage;
  const copy = root.querySelector('.coffee-copy');
  const is3D = root.dataset.coffeeRenderer === '3d';
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const limited = navigator.connection?.saveData || (navigator.deviceMemory && navigator.deviceMemory <= 2);
  const lowPower = innerWidth < 700 || navigator.hardwareConcurrency <= 4 || navigator.deviceMemory <= 4;
  let scene, loading = false, version = 0, failed = false, visible = false;
  let frame = 0, lastTime = 0, lastDraw = 0, ambient = 0, current = 0, target = 0;
  let top = 0, height = 1, pinHeight = 1;
  const staticMode = () => reduced.matches || limited || failed;
  const stop = () => { cancelAnimationFrame(frame); frame = 0; lastTime = 0; };

  function present(progress) {
    const state = coffeeState(progress);
    if (is3D) state.copy = smoothRange(.80, .96, progress);
    root.dataset.coffeeProgress = progress.toFixed(4);
    root.dataset.coffeeStage = state.stage;
    copy.style.setProperty('--coffee-copy-opacity', state.copy.toFixed(4));
    copy.style.setProperty('--coffee-copy-y', `${((1 - state.copy) * 18).toFixed(2)}px`);
    if (is3D) stage.style.setProperty('--coffee-lift', state.copy.toFixed(4));
    scene?.render({ ...state, ambientTime: ambient });
  }

  function poster() {
    stop(); version++; loading = false;
    scene?.dispose(); scene = null;
    root.dataset.coffeeMode = 'poster';
    present(1);
  }

  function tick(now) {
    frame = 0;
    if (!visible || document.hidden || staticMode() || !scene) return;
    const dt = lastTime ? Math.min(64, now - lastTime) : 16;
    lastTime = now;
    const keyboard = document.body.classList.contains('keyboard-input');
    current = keyboard || Math.abs(target - current) < .0001 ? target : current + (target - current) * (1 - Math.exp(-dt / 85));
    const drifting = !is3D && !keyboard && current > .76;
    if (drifting) ambient += dt / 1000;
    if (!lowPower || now - lastDraw >= 32 || Math.abs(target - current) < .0001 && !drifting) {
      try { present(current); lastDraw = now; }
      catch { failed = true; poster(); return; }
    }
    if (Math.abs(target - current) >= .0001 || drifting) frame = requestAnimationFrame(tick);
    else lastTime = 0;
  }
  function wake() {
    if (!frame && visible && scene && !document.hidden && !staticMode()) frame = requestAnimationFrame(tick);
  }
  function readProgress() {
    target = coffeeProgress(top - scrollY, height, pinHeight);
    wake();
  }
  function measure() {
    const bounds = story.getBoundingClientRect();
    top = bounds.top + scrollY; height = bounds.height; pinHeight = pin.clientHeight;
    // Optical compensation aligns the visible bowl with the centred copy.
    if (is3D) {
      stage.style.setProperty('--coffee-optical-x', `${(.096 * Math.min(stage.clientHeight, stage.clientWidth * 1.08)).toFixed(2)}px`);
      stage.style.setProperty('--coffee-poster-optical-x', `${(.08 * Math.min(stage.clientHeight, stage.clientWidth * .85)).toFixed(2)}px`);
    }
    try { scene?.resize({ width: stage.clientWidth, height: stage.clientHeight, dpr: Math.min(devicePixelRatio, lowPower ? 1.5 : 1.75), mobile: innerWidth < 700 }); }
    catch { failed = true; poster(); return; }
    readProgress();
    if (scene && !staticMode()) { current = target; try { present(current); } catch { failed = true; poster(); } }
  }
  async function prepare() {
    if (scene || loading || staticMode()) return;
    loading = true;
    const token = ++version;
    try {
      const { createCoffeeScene } = await loadScene();
      if (token !== version || staticMode()) return;
      const ready = await createCoffeeScene(canvas, { lowPower });
      if (token !== version || staticMode()) { ready.dispose(); return; }
      scene = ready; measure();
      if (token !== version || staticMode()) return;
      current = target; present(current);
      root.dataset.coffeeMode = is3D ? 'webgl' : 'sequence';
      wake();
    } catch { if (token === version) { failed = true; poster(); } }
    finally { if (token === version) loading = false; }
  }

  root.dataset.coffeeMode = 'pending';
  if (staticMode()) poster();
  else measure();
  const preload = new IntersectionObserver(entries => {
    if (entries.some(entry => entry.isIntersecting)) prepare();
  }, { rootMargin: '120% 0px' });
  preload.observe(story);
  const observer = new IntersectionObserver(entries => {
    visible = entries[0].isIntersecting;
    if (visible) { readProgress(); prepare(); wake(); } else stop();
  });
  observer.observe(story);
  const resize = new ResizeObserver(measure); resize.observe(story); resize.observe(stage);
  window.addEventListener('scroll', readProgress, { passive: true });
  window.addEventListener('resize', measure, { passive: true });
  document.addEventListener('visibilitychange', () => { if (document.hidden) stop(); else { readProgress(); wake(); } });
  // A lost canvas context must never leave a tall, empty scroll section.
  canvas.addEventListener('contextlost', () => { failed = true; poster(); });
  reduced.addEventListener('change', () => {
    if (staticMode()) poster();
    else { root.dataset.coffeeMode = 'pending'; measure(); prepare(); }
  });
  window.addEventListener('pagehide', stop);
  window.addEventListener('pageshow', () => { measure(); wake(); });
}
