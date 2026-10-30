// Bounded sliding cache. No 4K frames and no all-150-frames allocation.
export async function createCoffeeScene(canvas, { lowPower = false } = {}) {
  const ctx = canvas.getContext('2d', { alpha: false });
  if (!ctx) throw new Error('Canvas2D unavailable');
  const base = new URL(`./assets/coffee/3d/sequence/${lowPower ? 'mobile' : 'desktop'}/`, import.meta.url);
  const cache = new Map(), pending = new Map(), errors = new Set();
  const limit = lowPower ? 14 : 18, ahead = lowPower ? 6 : 9;
  let target = 1, width = 1, height = 1, dpr = 1, dead = false, queue = [];
  const url = frame => new URL(`frame_${String(frame).padStart(4, '0')}.webp`, base).href;
  function paint() {
    if (dead || !cache.size) return;
    let nearest = target;
    if (!cache.has(nearest)) nearest = [...cache.keys()].sort((a, b) => Math.abs(a - target) - Math.abs(b - target))[0];
    const image = cache.get(nearest), size = Math.min(width * (width < 700 ? 1 : .88), height * .94);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.fillStyle = '#000'; ctx.fillRect(0, 0, width, height);
    ctx.drawImage(image, (width - size) / 2, (height - size) / 2, size, size);
    canvas.dataset.renderer = 'sequence'; canvas.dataset.frame = String(nearest); canvas.dataset.targetFrame = String(target);
  }
  function trim() {
    const sorted = [...cache.keys()].sort((a, b) => Math.abs(b - target) - Math.abs(a - target));
    while (cache.size > limit) { const key = sorted.shift(); cache.get(key)?.close?.(); cache.delete(key); }
  }
  function schedule() {
    if (dead) return;
    queue = Array.from({ length: ahead * 2 + 1 }, (_, i) => target - ahead + i)
      .filter(i => i >= 1 && i <= 150 && !cache.has(i) && !pending.has(i) && !errors.has(i))
      .sort((a, b) => Math.abs(a - target) - Math.abs(b - target));
    pump();
  }
  async function decode(frame, controller) {
    const response = await fetch(url(frame), { signal: controller.signal });
    if (!response.ok) throw new Error(`Missing coffee frame ${frame}: ${response.status}`);
    return createImageBitmap(await response.blob());
  }
  function pump() {
    while (!dead && pending.size < 3 && queue.length) {
      const frame = queue.shift(), controller = new AbortController(); pending.set(frame, controller);
      decode(frame, controller).then(image => {
        if (dead) { image.close(); return; }
        cache.set(frame, image); trim(); paint();
      }).catch(error => {
        if (!dead && error.name !== 'AbortError') {
          errors.add(frame);
          if (frame === target) canvas.dispatchEvent(new Event('contextlost'));
        }
      }).finally(() => { pending.delete(frame); if (!dead) pump(); });
    }
  }
  function resize({ width: w, height: h, dpr: ratio = 1 } = {}) {
    width = Math.max(1, w || canvas.clientWidth); height = Math.max(1, h || canvas.clientHeight);
    dpr = Math.min(lowPower ? 1.35 : 1.75, ratio); canvas.width = Math.round(width * dpr); canvas.height = Math.round(height * dpr);
    paint();
  }
  function render({ progress = 0 } = {}) {
    if (dead) return;
    target = Math.max(1, Math.min(150, 1 + Math.round(progress * 149)));
    if (errors.has(target)) { canvas.dispatchEvent(new Event('contextlost')); return; }
    paint(); schedule();
  }
  function dispose() {
    if (dead) return; dead = true;
    pending.forEach(controller => controller.abort()); pending.clear(); cache.forEach(image => image.close()); cache.clear(); queue = [];
  }
  // Fail before pinning if the sequence was not generated or deployed completely.
  const first = await decode(1, new AbortController()); cache.set(1, first);
  resize({ dpr: devicePixelRatio || 1 }); render({ progress: 0 });
  return { render, resize, dispose };
}
