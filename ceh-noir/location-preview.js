const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

// Stay inside the empty photo column and the visible viewport, never over addresses.
export function previewPosition(area, row, pointer, viewportHeight) {
  const visibleTop = Math.max(area.top, 14);
  const visibleBottom = Math.min(area.top + area.height, viewportHeight - 14);
  const size = Math.floor(Math.max(0, Math.min(380, area.width, visibleBottom - visibleTop)));
  const horizontal = clamp((pointer.x - row.left) / Math.max(1, row.width), 0, 1);
  return {
    size,
    x: horizontal * Math.max(0, area.width - size),
    y: clamp(pointer.y - area.top - size / 2, visibleTop - area.top, Math.max(visibleTop - area.top, visibleBottom - area.top - size))
  };
}

export function createLocationPreview(section, { motionAllowed }) {
  const area = section?.querySelector('.location-preview-area');
  const preview = area?.querySelector('.location-preview');
  if (!preview) return;
  const layers = [...preview.querySelectorAll('img')];
  const rows = [...section.querySelectorAll('.location')];
  const desktop = matchMedia('(min-width: 901px) and (hover: hover) and (pointer: fine)');
  const prepared = new Map();
  let activeRow, version = 0, layerIndex = -1, frame = 0, lastFrame = 0;
  let geometry, pointer, target, current;

  function prepare(source) {
    if (!prepared.has(source)) prepared.set(source, (async () => {
      const image = new Image(); image.decoding = 'async'; image.src = source;
      await image.decode();
      return image;
    })());
    return prepared.get(source);
  }

  function paint(time) {
    frame = 0;
    if (!activeRow || !target) return;
    const amount = motionAllowed() ? 1 - Math.exp(-Math.min(32, time - lastFrame || 16) / 55) : 1;
    lastFrame = time;
    current.x += (target.x - current.x) * amount;
    current.y += (target.y - current.y) * amount;
    preview.style.transform = `translate3d(${current.x}px, ${current.y}px, 0)`;
    if (Math.abs(target.x - current.x) + Math.abs(target.y - current.y) > .15) frame = requestAnimationFrame(paint);
  }

  function position(event, instant = false) {
    pointer = event ? { x: event.clientX, y: event.clientY } : pointer;
    if (!geometry || !pointer) return;
    target = previewPosition(geometry.area, geometry.row, pointer, innerHeight);
    preview.style.width = `${target.size}px`;
    if (!current || instant || !motionAllowed()) current = { x: target.x, y: target.y };
    if (!frame) frame = requestAnimationFrame(paint);
  }

  function hide() {
    ++version;
    activeRow = undefined;
    preview.classList.remove('is-visible');
    cancelAnimationFrame(frame); frame = 0;
  }

  async function show(row, event, keyboard = false) {
    if (!desktop.matches) return;
    const photo = row.querySelector('.location-photo img');
    if (!photo) return;
    const request = ++version;
    activeRow = row;
    geometry = { area: area.getBoundingClientRect(), row: row.getBoundingClientRect() };
    if (!geometry.area.width) return hide();
    if (keyboard) pointer = { x: geometry.row.left + geometry.row.width / 2, y: geometry.row.top + 35 };
    position(event, !preview.classList.contains('is-visible') || keyboard);
    try {
      const decoded = await prepare(photo.src);
      if (request !== version || activeRow !== row) return;
      const nextIndex = (layerIndex + 1) % layers.length;
      const next = layers[nextIndex];
      next.src = decoded.src;
      await next.decode();
      if (request !== version || activeRow !== row || !desktop.matches) return;
      layers.forEach((layer, index) => layer.classList.toggle('is-active', index === nextIndex));
      layerIndex = nextIndex;
      preview.dataset.location = row.dataset.location;
      preview.classList.add('is-visible');
    } catch {
      if (request === version) hide();
    }
  }

  rows.forEach(row => {
    row.addEventListener('pointerenter', event => {
      if (event.pointerType === 'mouse') show(row, event);
    });
    row.addEventListener('pointermove', event => {
      if (event.pointerType !== 'mouse' || !desktop.matches) return;
      if (activeRow !== row) show(row, event);
      else position(event);
    });
    row.addEventListener('pointerleave', () => { if (activeRow === row) hide(); });
    row.addEventListener('focusin', () => {
      if (document.body.classList.contains('keyboard-input')) show(row, null, true);
    });
    row.addEventListener('keydown', event => {
      if (event.key === 'Enter' || event.key === ' ') show(row, null, true);
    });
    row.addEventListener('focusout', event => {
      if (!row.contains(event.relatedTarget) && activeRow === row) hide();
    });
  });

  document.addEventListener('keydown', event => { if (event.key === 'Escape') hide(); });
  desktop.addEventListener('change', hide);
  window.addEventListener('resize', hide);
  window.addEventListener('scroll', () => {
    if (activeRow && document.body.classList.contains('keyboard-input') && activeRow.contains(document.activeElement)) show(activeRow, null, true);
    else hide();
  }, { passive: true });
  window.addEventListener('blur', hide);

  // Warm up just these four photos as the address section approaches the viewport.
  const observer = new IntersectionObserver(entries => {
    if (!entries.some(entry => entry.isIntersecting)) return;
    rows.forEach(row => {
      const photo = row.querySelector('.location-photo img');
      if (photo) prepare(photo.src).catch(() => {});
    });
    observer.disconnect();
  }, { rootMargin: '300px' });
  observer.observe(section);
}
