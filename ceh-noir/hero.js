// Choose once during parsing; reveal only after the complete image has decoded.
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

  const variants = [
    { src: 'assets/hero/croissant-cucumber.png', alt: 'Круассан с огурцом и зеленью', width: 3840, height: 3158 },
    { src: 'assets/hero/croissant-ham-cheese.png', alt: 'Круассан с ветчиной и сыром', width: 3840, height: 3158 },
    { src: 'assets/hero/croissant-salmon.png', alt: 'Круассан с лососем', width: 3840, height: 3163 }
  ];
  const selected = variants[Math.floor(Math.random() * variants.length)];
  image.alt = selected.alt;
  image.width = selected.width;
  image.height = selected.height;
  image.dataset.heroState = 'loading';
  image.hidden = false;
  image.src = selected.src;

  async function reveal() {
    try {
      await image.decode();
    } catch {
      image.dataset.heroState = 'error';
      return;
    }
    if (allowIntro && !reduceMotion.matches && !document.hidden) {
      intro = image.animate([
        { opacity: 0, transform: 'translate3d(0, 12px, 0)' },
        { opacity: 1, transform: 'none' }
      ], { duration: 850, easing: 'cubic-bezier(.23,1,.32,1)', fill: 'backwards' });
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
