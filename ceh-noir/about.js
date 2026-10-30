/** One reversible timeline. The document keeps its native scroll physics. */
export function initAboutStory(root) {
  if (!root) return () => {};
  let disposed = false, media;
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');

  async function prepare() {
    if (disposed || media || reduced.matches) return;
    try {
      const [{ gsap }, { ScrollTrigger }] = await Promise.all([
        import('./vendor/gsap/index.js'), import('./vendor/gsap/ScrollTrigger.js')
      ]);
      if (disposed || media) return;
      gsap.registerPlugin(ScrollTrigger);
      media = gsap.matchMedia();
      media.add({
        desktop: '(min-width: 900px) and (min-height: 580px)',
        compact: '(max-width: 899px), (max-height: 579px)',
        reduced: '(prefers-reduced-motion: reduce)'
      }, context => {
        const { desktop, reduced: quiet } = context.conditions;
        if (quiet) {
          root.dataset.aboutMode = 'static';
          return;
        }
        root.dataset.aboutMode = desktop ? 'cinematic' : 'compact';
        const find = selector => root.querySelector(selector);
        const letters = ['.about-letter-ts', '.about-letter-e', '.about-letter-kh'].map(find);
        const interior = find('.about-interior');
        const image = find('.about-interior img');
        const product = find('.about-product');
        const productImage = find('.about-product img');
        const lines = [...root.querySelectorAll('.about-line > span')];
        const timeline = gsap.timeline({
          paused: true,
          defaults: { ease: 'power2.inOut' },
          onUpdate() { root.dataset.aboutProgress = this.progress().toFixed(4); }
        });
        // Remote typography: a quiet stagger and a longer, shallower travel.
        const offsets = desktop ? [[-14, 28], [8, 48], [16, -24]] : [[-4, 9], [3, 14], [5, -8]];
        letters.forEach((letter, i) => {
          const at = .015 + i * .045;
          timeline.fromTo(letter, { opacity: 0 }, { opacity: 1, duration: .13, ease: 'power1.inOut' }, at)
            .fromTo(letter, { x: offsets[i][0], y: offsets[i][1] }, { x: 0, y: 0, duration: .64 }, at);
        });
        // The crop opens before the image finishes settling into the back plane.
        timeline.fromTo(interior, { clipPath: 'inset(12% 0% 88% 0%)' },
          { clipPath: 'inset(0% 0% 0% 0%)', duration: .33, ease: 'power3.inOut' }, .13)
          .fromTo(interior, { opacity: 0 }, { opacity: 1, duration: .09 }, .13)
          .fromTo(interior, { y: desktop ? 62 : 12 }, { y: 0, duration: .68 }, .13)
          // Overscan keeps both photographs inside their crops while they pan in
          // opposite directions, independently of the frames (the Lune treatment).
          .fromTo(image, { scale: desktop ? 1.095 : 1, yPercent: desktop ? -2.25 : 0 },
            { scale: desktop ? 1.055 : 1, yPercent: desktop ? 2 : 0, duration: .68, ease: 'none' }, .13)
          // Foreground arrives, then drifts another 24px as the scene resolves.
          .fromTo(product, { opacity: 0, x: desktop ? 12 : 0, y: desktop ? 155 : 24, scale: .98 },
            { opacity: 1, x: 0, y: desktop ? 24 : 8, scale: 1, duration: .28, ease: 'power3.out' }, .29)
          .to(product, { y: 0, duration: .27 }, .57)
          .fromTo(productImage, { scale: desktop ? 1.075 : 1, yPercent: desktop ? 1.4 : 0 },
            { scale: 1, yPercent: 0, duration: .55, ease: 'none' }, .29);
        // Each semantic line has a mask. Only the italic aside shifts sideways.
        lines.forEach((line, i) => {
          const italic = line.closest('.about-italics');
          timeline.fromTo(line, { yPercent: 112, x: italic ? (desktop ? 16 : 5) : 0, opacity: 0 },
            { yPercent: 0, x: 0, opacity: 1, duration: .19, ease: 'power3.out' }, .44 + i * .037);
        });
        // A real hold: all movement has settled before the sticky scene releases.
        timeline.to({}, { duration: .16 }, .84);
        // Bind only the completed timeline: deep links must not seek a half-built scene.
        ScrollTrigger.create({
          animation: timeline,
          trigger: root,
          start: desktop ? 'top 18%' : 'top 88%',
          end: desktop ? 'bottom bottom' : 'top 5%',
          scrub: desktop ? 1 : .35,
          invalidateOnRefresh: true,
          onUpdate: self => {
            if (document.body.classList.contains('keyboard-input')) self.getTween()?.progress(1);
          },
          onRefresh: self => { root.dataset.aboutProgress = self.animation.progress().toFixed(4); },
          onToggle: self => { root.dataset.aboutActive = String(self.isActive); }
        });
        const keyboard = event => {
          if (['Tab', 'PageDown', 'PageUp', 'Home', 'End', 'ArrowDown', 'ArrowUp', ' '].includes(event.key)) {
            timeline.scrollTrigger.getTween()?.progress(1);
          }
        };
        const restore = event => { if (event.persisted) timeline.scrollTrigger.refresh(); };
        document.addEventListener('keydown', keyboard);
        window.addEventListener('pageshow', restore);
        const size = new ResizeObserver(() => timeline.scrollTrigger?.refresh());
        size.observe(root);
        // Font/image loading can change the document above this section.
        document.fonts?.ready.then(() => { if (!disposed && timeline.scrollTrigger) timeline.scrollTrigger.refresh(); });
        return () => {
          document.removeEventListener('keydown', keyboard);
          window.removeEventListener('pageshow', restore);
          size.disconnect();
          root.dataset.aboutMode = 'static';
          root.dataset.aboutActive = 'false';
          delete root.dataset.aboutProgress;
        };
      }, root);
    } catch {
      // Failed optional motion leaves a complete, static, accessible composition.
      media?.revert();
      media = undefined;
      root.dataset.aboutMode = 'static';
    }
  }
  const preferenceChanged = () => { if (!reduced.matches) void prepare(); };
  reduced.addEventListener('change', preferenceChanged);
  void prepare();
  return () => {
    disposed = true;
    reduced.removeEventListener('change', preferenceChanged);
    media?.revert();
  };
}
