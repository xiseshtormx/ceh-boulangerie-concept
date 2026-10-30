import { gsap } from './vendor/gsap/index.js';
import { ScrollTrigger } from './vendor/gsap/ScrollTrigger.js';
import { smooth } from './coffee-fluid.js';

gsap.registerPlugin(ScrollTrigger);
const story = document.querySelector('.story'), pin = document.querySelector('.pin'), stage = document.querySelector('.stage');
const canvas = document.querySelector('canvas'), copy = document.querySelector('.copy'), hint = document.querySelector('.hint');
const status = document.querySelector('.status'), slider = document.querySelector('input[type=range]'), output = document.querySelector('output');
const media = matchMedia('(prefers-reduced-motion: reduce)');
const limited = navigator.connection?.saveData || navigator.deviceMemory <= 2;
let scene, trigger, animation, resizeObserver, progress = 0, destroyed = false, attempt = 0;
function render(p) {
  progress = Math.max(0, Math.min(1, p));
  const alpha = smooth(.80, .96, progress);
  scene?.render({ progress });
  copy.style.opacity = alpha; copy.style.transform = `translateY(${(1 - alpha) * 12}px)`;
  stage.style.transform = `translateY(-${alpha * (innerWidth < 700 ? 6 : 14)}svh)`;
  copy.inert = alpha < .9;
  hint.style.opacity = 1 - smooth(.06, .18, progress);
  slider.value = progress; output.value = `${Math.round(progress * 100)}%`;
  document.querySelectorAll('[data-progress]').forEach(button => button.setAttribute('aria-pressed', Math.abs(Number(button.dataset.progress) - progress) < .006));
  document.body.dataset.progress = progress.toFixed(4);
}
function staticPoster(message = '') {
  trigger?.kill(true); animation?.kill(); trigger = undefined; scene?.dispose(); scene = undefined;
  resizeObserver?.disconnect(); document.body.classList.add('static');
  render(1); status.textContent = message; status.classList.toggle('error', Boolean(message));
}
function resize() {
  scene?.resize({ width: stage.clientWidth, height: stage.clientHeight, dpr: devicePixelRatio }); render(progress);
}
async function init() {
  const token = ++attempt;
  if (media.matches || limited) { staticPoster(); return; }
  try {
    const useSequence = new URLSearchParams(location.search).get('renderer') === 'sequence';
    const { createCoffeeScene } = await (useSequence ? import('./coffee-sequence-3d.js') : import('./coffee-scene-3d.js'));
    const ready = await createCoffeeScene(canvas, { lowPower: innerWidth < 700 });
    if (destroyed || token !== attempt || media.matches) { ready.dispose(); return; }
    scene = ready; document.body.classList.remove('static'); status.textContent = '';
    resizeObserver = new ResizeObserver(resize); resizeObserver.observe(stage);
    const playhead = { p: 0 };
    animation = gsap.to(playhead, { p: 1, duration: 1, ease: 'none', paused: true, onUpdate: () => render(playhead.p) });
    trigger = ScrollTrigger.create({ trigger: story, animation, scrub: .18, pin, start: 'top top', end: () => `+=${innerHeight * (innerWidth < 700 ? 1.5 : 2.2)}`,
      pinSpacing: false, invalidateOnRefresh: true });
    // Native scroll remains reversible. Scrub does not run a free-playing clock.
    const initial = Number(new URLSearchParams(location.search).get('p'));
    if (initial > 0) requestAnimationFrame(() => { if (trigger) { ScrollTrigger.refresh(); scrollToProgress(initial); } });
    else render(trigger.progress);
    document.body.dataset.ready = 'true';
  } catch (error) { if (token === attempt) { console.error(error); staticPoster('Не удалось открыть 3D. Показан статичный кадр.'); document.body.dataset.error = String(error); } }
}
function scrollToProgress(p) {
  if (!trigger) return;
  animation.progress(p);
  window.scrollTo({ top: trigger.start + p * (trigger.end - trigger.start), behavior: 'instant' });
  ScrollTrigger.update(); trigger.getTween()?.progress(1);
  render(p);
}
slider.addEventListener('input', () => scrollToProgress(Number(slider.value)));
document.querySelectorAll('[data-progress]').forEach(button => button.addEventListener('click', () => scrollToProgress(Number(button.dataset.progress))));
canvas.addEventListener('contextlost', () => { ++attempt; staticPoster('Предпросмотр недоступен. Показан статичный кадр.'); });
media.addEventListener('change', () => { ++attempt; staticPoster(); if (!media.matches && !limited) init(); });
window.addEventListener('pagehide', () => { destroyed = true; ++attempt; trigger?.kill(true); resizeObserver?.disconnect(); scene?.dispose(); });
window.addEventListener('pageshow', event => { if (event.persisted) { destroyed = false; init(); } });
init();
