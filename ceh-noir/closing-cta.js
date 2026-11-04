export function initClosingCTA(section) {
  if (!section) return () => {};
  const link = section.querySelector('.closing-link');
  const lines = [...section.querySelectorAll('.closing-reveal')];
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const effects = new Set();
  let played = false, disposed = false, fontTimer, releaseFont;
  section.dataset.ctaState = 'idle';

  function settle() {
    played = true;
    releaseFont?.(false); clearTimeout(fontTimer);
    effects.forEach(effect => effect.cancel()); effects.clear();
    section.dataset.ctaState = 'settled';
  }
  const quiet = () => reduced.matches || document.hidden || document.body.classList.contains('keyboard-input');
  async function enter() {
    if (played || disposed) return;
    played = true;
    if (quiet() || section.getBoundingClientRect().top < -40) { settle(); return; }
    section.dataset.ctaState = 'waiting';
    const ready = await new Promise(resolve => {
      releaseFont = resolve;
      fontTimer = setTimeout(() => resolve(false), 800);
      document.fonts.load('italic 500 64px "Ceh CTA Serif"', lines[1].textContent).then(() => resolve(true), () => resolve(false));
    });
    clearTimeout(fontTimer); releaseFont = undefined;
    if (disposed) return;
    if (!ready || quiet() || section.dataset.ctaState === 'settled' || section.getBoundingClientRect().bottom <= 0) { settle(); return; }
    const paths = [
      [{ clipPath: 'inset(0 0 100% 0)', transform: 'translate3d(0,.24em,0)' }, { clipPath: 'inset(0 0 0 0)', transform: 'none' }],
      [{ clipPath: 'inset(0 100% 0 0)', transform: 'translate3d(-.12em,.08em,0)' }, { clipPath: 'inset(0 0 0 0)', transform: 'none' }]
    ];
    if (!lines.every(line => typeof line.animate === 'function')) { settle(); return; }
    const finished = lines.map((line, index) => {
      const effect = line.animate(paths[index], {
        duration: index ? 820 : 760, delay: index ? 130 : 0,
        easing: 'cubic-bezier(.23,1,.32,1)', fill: 'both'
      });
      effects.add(effect);
      return effect.finished.catch(() => {});
    });
    section.dataset.ctaState = 'revealing';
    await Promise.all(finished);
    if (!disposed) settle();
  }
  const observer = new IntersectionObserver(([entry]) => {
    if (entry.isIntersecting && entry.intersectionRatio >= .22) enter();
  }, { threshold: .22, rootMargin: '0px 0px -8% 0px' });
  const preference = () => { if (reduced.matches) settle(); };
  const visibility = () => { if (document.hidden && played) settle(); };
  const restore = event => { if (event.persisted) settle(); };
  link.addEventListener('focus', settle);
  document.addEventListener('keydown', settle, { capture: true });
  document.addEventListener('visibilitychange', visibility);
  window.addEventListener('pageshow', restore);
  reduced.addEventListener('change', preference);
  if (quiet()) settle();
  observer.observe(section);
  return () => {
    disposed = true; settle(); observer.disconnect();
    link.removeEventListener('focus', settle);
    document.removeEventListener('keydown', settle, { capture: true });
    document.removeEventListener('visibilitychange', visibility);
    window.removeEventListener('pageshow', restore);
    reduced.removeEventListener('change', preference);
  };
}

if (typeof document !== 'undefined') initClosingCTA(document.querySelector('.closing'));
