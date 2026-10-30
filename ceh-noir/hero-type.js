// Hero typography owns only text. Product entrance, photography and header stay independent.
export const typeTiming = (row, index) => row === 0
  ? { delay: 36 * index, duration: 680, easing: 'cubic-bezier(.23,1,.32,1)' }
  : { delay: 450 + 32 * index, duration: 740, easing: 'cubic-bezier(.22,1,.36,1)' };

export function initHeroType(hero) {
  if (!hero) return () => {};
  const root = document.documentElement;
  const media = matchMedia('(prefers-reduced-motion: reduce)');
  const type = root.dataset.heroType || 'b';
  const words = [hero.querySelector('.hero-word-order'), hero.querySelector(type === 'b' ? '.hero-now-serif' : '.hero-now-roman')];
  const caption = hero.querySelector('.hero-copy p');
  const animations = new Set();
  let disposed = false, settled = false, inView = true, keyboard = false, frame = 0, waitTimer, releaseWait;
  let current = 0, previous = 0, height = hero.offsetHeight;
  const quiet = () => media.matches || keyboard;
  const position = () => Math.min(1, Math.max(0, scrollY / height));
  const paint = progress => {
    words[0].style.transform = `translate3d(${-12 * progress}px,0,0)`;
    words[1].style.transform = `translate3d(${10 * progress}px,0,0)`;
  };
  function settle() {
    animations.forEach(animation => animation.cancel());
    animations.clear();
    root.classList.remove('hero-type-pending');
    hero.dataset.typeState = 'settled';
    settled = true;
  }
  function stop() {
    releaseWait?.(false); clearTimeout(waitTimer);
    settle();
    cancelAnimationFrame(frame); frame = 0;
    current = 0; paint(0);
  }
  function tick(time) {
    frame = 0;
    if (!settled || !inView || quiet() || document.hidden || disposed) return;
    const target = position();
    current += (target - current) * (1 - Math.exp(-Math.min(64, time - previous || 16) / 95));
    previous = time;
    if (Math.abs(target - current) < .0005) current = target;
    paint(current);
    if (current !== target) frame = requestAnimationFrame(tick);
  }
  function scroll() {
    if (!settled && scrollY > 32) stop();
    if (settled && inView && !quiet() && !document.hidden && !frame && !disposed) {
      previous = performance.now(); frame = requestAnimationFrame(tick);
    }
  }
  function key() { keyboard = true; stop(); }
  function pointer() { keyboard = false; scroll(); }
  function preference() { if (media.matches) stop(); else scroll(); }
  function resize() { height = hero.offsetHeight; scroll(); }
  function restore(event) { if (event.persisted) { stop(); keyboard = document.body.classList.contains('keyboard-input'); scroll(); } }
  function visibility() {
    if (document.hidden) { stop(); } else scroll();
  }
  const observer = new IntersectionObserver(([entry]) => {
    inView = entry.isIntersecting;
    if (!inView) { cancelAnimationFrame(frame); frame = 0; }
    else scroll();
  });
  observer.observe(hero);
  document.addEventListener('keydown', key, { capture: true });
  document.addEventListener('pointerdown', pointer, { passive: true });
  document.addEventListener('visibilitychange', visibility);
  media.addEventListener('change', preference);
  window.addEventListener('scroll', scroll, { passive: true });
  window.addEventListener('resize', resize, { passive: true });
  window.addEventListener('pageshow', restore);

  async function enter() {
    if (!root.classList.contains('hero-type-pending') || quiet() || scrollY > 32 || document.hidden) { settle(); scroll(); return; }
    hero.dataset.typeState = 'waiting';
    const ready = await new Promise(resolve => {
      releaseWait = resolve;
      waitTimer = setTimeout(() => resolve(false), 1400);
      document.fonts.ready.then(() => resolve(true), () => resolve(false));
    });
    clearTimeout(waitTimer); releaseWait = undefined;
    if (disposed) return;
    if (!ready || settled || quiet() || scrollY > 32 || document.hidden) { settle(); scroll(); return; }
    const finished = [];
    words.forEach((word, row) => {
      word.querySelectorAll('.hero-glyph-ink').forEach((glyph, index) => {
        const animation = glyph.animate([
          { opacity: 0, transform: row === 0 ? 'translate3d(0,.38em,0)' : 'translate3d(-.16em,.15em,0)' },
          { opacity: 1, transform: 'translate3d(0,0,0)' }
        ], { ...typeTiming(row, index), fill: 'both' });
        animations.add(animation);
        finished.push(animation.finished.catch(() => {}));
      });
    });
    const subtitle = caption.animate([{ opacity: 0 }, { opacity: 1 }], {
      duration: 420, delay: 720, easing: 'cubic-bezier(.23,1,.32,1)', fill: 'both'
    });
    animations.add(subtitle); finished.push(subtitle.finished.catch(() => {}));
    hero.dataset.typeState = 'assembling';
    root.classList.remove('hero-type-pending');
    await Promise.all(finished);
    if (!disposed) { settle(); scroll(); }
  }
  enter();
  return () => {
    disposed = true; stop(); observer.disconnect();
    document.removeEventListener('keydown', key, { capture: true });
    document.removeEventListener('pointerdown', pointer);
    document.removeEventListener('visibilitychange', visibility);
    media.removeEventListener('change', preference);
    window.removeEventListener('scroll', scroll);
    window.removeEventListener('resize', resize);
    window.removeEventListener('pageshow', restore);
  };
}

if (typeof document !== 'undefined') initHeroType(document.querySelector('.hero'));
