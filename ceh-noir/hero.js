// One supplied photograph, including its reflection; reveal after full decoding.
// The reserved image box stays in place while loading. No slideshow or replay.
(() => {
  const image = document.querySelector('.hero-croissant');
  if (!image) return;
  const text = [...document.querySelectorAll('.hero-word, .hero-copy p')];
  const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)');
  let allowIntro = !reduceMotion.matches;
  let intro;
  const stopMotion = () => {
    allowIntro = false;
    text.forEach(element => { element.style.animation = 'none'; });
    intro?.cancel();
    intro = undefined;
  };
  // Persist the settled text state, so changing input mode cannot restart CSS motion.
  text.forEach(element => element.addEventListener('animationend', () => {
    element.style.animation = 'none';
  }, { once: true }));
  if (reduceMotion.matches) stopMotion();
  document.addEventListener('keydown', stopMotion, { once: true, capture: true });
  reduceMotion.addEventListener('change', () => { if (reduceMotion.matches) stopMotion(); });
  window.addEventListener('pageshow', event => { if (event.persisted) stopMotion(); });

  image.alt = 'Круассан «Цеха» с отражением на чёрной поверхности';
  image.width = 1536;
  image.height = 1024;
  image.dataset.heroState = 'loading';
  image.hidden = false;
  image.src = 'assets/hero/croissant-studio.png';

  async function reveal() {
    try {
      await image.decode();
    } catch {
      image.dataset.heroState = 'error';
      return;
    }
    if (allowIntro && !reduceMotion.matches && !document.hidden) {
      intro = image.animate([
        { opacity: 0, transform: 'translate3d(0, 20px, 0) scale(.98)' },
        { opacity: 1, transform: 'none' }
      ], { duration: 1100, delay: 140, easing: 'cubic-bezier(.23,1,.32,1)', fill: 'backwards' });
      const animation = intro;
      animation.addEventListener('finish', () => {
        animation.cancel();
        if (intro === animation) intro = undefined;
      }, { once: true });
    }
    image.dataset.heroState = 'ready';
  }
  reveal();
})();
