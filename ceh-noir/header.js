/** Native popover supplies light dismissal and Escape without locking page scroll. */
export function initSiteNavigation(header) {
  const toggle = header?.querySelector('.edge-nav-toggle');
  const panel = header?.querySelector('.edge-navigation');
  const label = header?.querySelector('.edge-nav-label');
  if (!toggle || !panel) return () => {};
  const native = typeof panel.showPopover === 'function';
  let opened = false;
  const sync = open => {
    opened = open;
    header.classList.toggle('is-nav-open', open);
    panel.classList.toggle('is-open', open);
    toggle.setAttribute('aria-expanded', String(open));
    toggle.setAttribute('aria-label', open ? 'Закрыть навигацию' : 'Открыть навигацию');
    if (label) label.textContent = open ? 'Закрыть' : 'Меню';
    if (open) header.dispatchEvent(new Event('navigation:opening'));
  };
  const close = () => {
    if (!opened) return;
    if (native) panel.hidePopover();
    else { panel.hidden = true; sync(false); toggle.focus({ preventScroll: true }); }
  };
  const beforeToggle = event => sync(event.newState === 'open');
  const fallbackToggle = () => {
    const next = !opened;
    panel.hidden = !next;
    sync(next);
    if (next) panel.querySelector('a')?.focus({ preventScroll: true });
    else toggle.focus({ preventScroll: true });
  };
  const followLink = event => {
    if (event.button > 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    if (event.target.closest('a')) close();
  };
  const outside = event => { if (!header.contains(event.target)) close(); };
  const escape = event => {
    if (opened && event.key === 'Escape') { event.preventDefault(); close(); }
  };
  if (native) panel.addEventListener('beforetoggle', beforeToggle);
  else {
    panel.removeAttribute('popover');
    panel.hidden = true;
    toggle.removeAttribute('popovertarget');
    toggle.addEventListener('click', fallbackToggle);
    document.addEventListener('pointerdown', outside);
    document.addEventListener('keydown', escape);
  }
  panel.addEventListener('click', followLink);
  window.addEventListener('pageshow', close);
  header.addEventListener('navigation:reset', close);
  sync(false);
  return () => {
    close();
    panel.removeEventListener('beforetoggle', beforeToggle);
    toggle.removeEventListener('click', fallbackToggle);
    document.removeEventListener('pointerdown', outside);
    document.removeEventListener('keydown', escape);
    panel.removeEventListener('click', followLink);
    window.removeEventListener('pageshow', close);
    header.removeEventListener('navigation:reset', close);
  };
}

/** Both navigation forms share the same path, so the handoff is reversible. */
export function initHeaderMorph(header) {
  const top = header?.querySelector('.hero-header');
  const links = header?.querySelector('.hero-header-links');
  const brand = top?.querySelector('.brand');
  const flight = header?.querySelector('.edge-nav-flight');
  const toggle = header?.querySelector('.edge-nav-toggle');
  const surface = header?.querySelector('.hero-nav-surface');
  const sideLabel = header?.querySelector('.edge-nav-label');
  const panel = header?.querySelector('.edge-navigation');
  if (!top || !links || !brand || !flight || !toggle) return () => {};
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const handoff = .36;
  const topLinks = [...top.querySelectorAll('a')];
  const progress = () => Math.max(0, Math.min(1, (window.scrollY - 48) / 232));
  const phase = (a, b, p) => { const t = Math.max(0, Math.min(1, (p - a) / (b - a))); return t * t * (3 - 2 * t); };
  const quiet = () => reduced.matches || document.body.classList.contains('keyboard-input');
  let frame = 0, lastTime = 0, current = 0, target = 0, dx = 0, dy = 0, centerY = 0, viewHeight = 0, mobile = false, compact, disposed = false;
  const stop = () => { if (frame) cancelAnimationFrame(frame); frame = 0; lastTime = 0; };
  function controls(next) {
    if (compact === next) return;
    compact = next;
    header.classList.toggle('is-compact', next);
    const active = document.activeElement;
    const fromTop = top.contains(active);
    const fromEdge = active === toggle || panel?.contains(active);
    if (!next) {
      top.inert = false; top.setAttribute('aria-hidden', 'false');
      topLinks.forEach(link => { link.tabIndex = 0; link.style.pointerEvents = 'auto'; });
      header.dispatchEvent(new Event('navigation:reset'));
      if (fromEdge) topLinks[0]?.focus({ preventScroll: true });
    }
    toggle.inert = !next;
    toggle.tabIndex = next ? 0 : -1;
    toggle.style.pointerEvents = next ? 'auto' : 'none';
    toggle.setAttribute('aria-hidden', String(!next));
    if (next) {
      if (fromTop) toggle.focus({ preventScroll: true });
      top.inert = true; top.setAttribute('aria-hidden', 'true');
      topLinks.forEach(link => { link.tabIndex = -1; link.style.pointerEvents = 'none'; });
    }
  }
  function present(p) {
    const t = p * p * (3 - 2 * p), arc = Math.sin(Math.PI * t) * 12;
    links.style.transform = `translate3d(${(dx * t + arc).toFixed(2)}px, ${(dy * t).toFixed(2)}px, 0) scale(${(1 - .1 * t).toFixed(4)})`;
    links.style.opacity = String(1 - phase(.18, .4, p));
    brand.style.transform = `translate3d(${(24 * t).toFixed(2)}px, ${(-8 * t).toFixed(2)}px, 0)`;
    brand.style.opacity = String(1 - phase(0, .42, p));
    flight.style.transform = `translate3d(${(-dx * (1 - t) + arc).toFixed(2)}px, ${(-dy * (1 - t)).toFixed(2)}px, 0) scale(${(.94 + .06 * t).toFixed(4)})`;
    flight.style.opacity = String(phase(.1, .3, p));
    if (sideLabel) sideLabel.style.opacity = String(phase(.38, .62, p));
    if (surface) surface.style.opacity = String(phase(.02, .12, p) * (1 - phase(.15, .35, p)));
    // An interrupted handoff may be clicked: keep the popover beside the control.
    if (panel?.style) {
      if (!mobile && panel.classList.contains('is-open')) {
        const half = Math.min(126.5, (viewHeight - 40) / 2);
        const y = Math.max(half + 20, Math.min(viewHeight - half - 20, centerY - dy * (1 - t)));
        panel.style.translate = `${(-dx * (1 - t) + arc).toFixed(2)}px calc(-50% + ${(y - centerY).toFixed(2)}px)`;
      } else panel.style.translate = '';
    }
    header.dataset.headerProgress = p.toFixed(4);
    controls(p >= handoff);
  }
  function tick(now) {
    frame = 0;
    if (disposed || document.hidden) return;
    const time = Number.isFinite(now) ? now : lastTime + 16;
    const dt = lastTime ? Math.min(64, Math.max(1, time - lastTime)) : 16;
    lastTime = time;
    current = Math.abs(target - current) < .001 ? target : current + (target - current) * (1 - Math.exp(-dt / 105));
    present(current);
    if (Math.abs(target - current) >= .001) frame = requestAnimationFrame(tick);
    else { current = target; present(current); lastTime = 0; }
  }
  function read() {
    target = progress();
    if (target < .95 && header.classList.contains('is-nav-open')) header.dispatchEvent(new Event('navigation:reset'));
    if (quiet()) { stop(); current = target < handoff ? 0 : 1; present(current); }
    else if (!frame && !document.hidden) frame = requestAnimationFrame(tick);
  }
  function measure(snap = false) {
    const saved = links.style.transform;
    links.style.transform = 'none';
    const source = links.getBoundingClientRect(), destination = header.getBoundingClientRect();
    dx = destination.left + destination.width / 2 - source.left - source.width / 2;
    dy = destination.top + destination.height / 2 - source.top - source.height / 2;
    centerY = destination.top + destination.height / 2;
    viewHeight = window.innerHeight;
    mobile = window.innerWidth <= 760;
    links.style.transform = saved;
    target = progress();
    if (snap || quiet()) { stop(); current = quiet() ? (target < handoff ? 0 : 1) : target; }
    present(current);
    if (Math.abs(target - current) >= .001 && !quiet() && !frame) frame = requestAnimationFrame(tick);
  }
  const resize = () => measure(false);
  const restore = () => measure(true);
  const visibility = () => { if (document.hidden) stop(); else restore(); };
  const opening = () => present(current);
  window.addEventListener('scroll', read, { passive: true });
  window.addEventListener('resize', resize);
  window.addEventListener('pageshow', restore);
  document.addEventListener('visibilitychange', visibility);
  reduced.addEventListener('change', restore);
  header.addEventListener('navigation:opening', opening);
  measure(true);
  document.fonts?.ready.then(() => { if (!disposed) measure(false); });
  return () => {
    disposed = true; stop();
    window.removeEventListener('scroll', read);
    window.removeEventListener('resize', resize);
    window.removeEventListener('pageshow', restore);
    document.removeEventListener('visibilitychange', visibility);
    reduced.removeEventListener('change', restore);
    header.removeEventListener('navigation:opening', opening);
  };
}

/** The small edge control frosts only its own footprint as content passes behind. */
export function initSiteHeader(header) {
  if (!header) return () => {};
  let frame = 0, scrolled;
  const paint = () => {
    const next = window.scrollY > (scrolled ? 12 : 32);
    if (next !== scrolled) {
      scrolled = next;
      header.classList.toggle('is-scrolled', next);
    }
  };
  const schedule = () => {
    if (!frame) frame = requestAnimationFrame(() => { frame = 0; paint(); });
  };
  const restore = () => {
    if (frame) cancelAnimationFrame(frame);
    frame = 0;
    paint();
  };
  window.addEventListener('scroll', schedule, { passive: true });
  window.addEventListener('pageshow', restore);
  paint();
  const disposeNavigation = initSiteNavigation(header);
  const disposeMorph = initHeaderMorph(header);
  return () => {
    disposeMorph();
    disposeNavigation();
    window.removeEventListener('scroll', schedule);
    window.removeEventListener('pageshow', restore);
    if (frame) cancelAnimationFrame(frame);
    frame = 0;
  };
}
