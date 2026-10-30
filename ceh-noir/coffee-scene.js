import { PHOTO_SIZE as SIZE, mix, cupLandmarks, mapPhotoY, coffeePhotoState } from './coffee-photo-model.js';
import { smoothRange } from './coffee-timeline.js';

const imageFiles = ['front', 'tilt', 'pour', 'final', 'stream'];
async function loadImage(name) {
  const image = new Image();
  image.decoding = 'async';
  image.src = new URL(`assets/coffee/photos/${name}.webp`, import.meta.url).href;
  await image.decode();
  return image;
}
function buffer(size) {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const context = canvas.getContext('2d', { alpha: false });
  if (!context) throw new Error('Canvas2D is unavailable.');
  context.imageSmoothingEnabled = true; context.imageSmoothingQuality = 'high';
  return { canvas, context };
}
function clearFrame(frame) {
  frame.context.setTransform(1, 0, 0, 1, 0, 0);
  frame.context.fillStyle = '#000'; frame.context.fillRect(0, 0, frame.canvas.width, frame.canvas.height);
  frame.context.setTransform(frame.canvas.width / SIZE, 0, 0, frame.canvas.height / SIZE, 0, 0);
}

function photographProfile(image, pose, filled) {
  const marks = cupLandmarks(pose, filled), probe = document.createElement('canvas');
  probe.width = probe.height = SIZE;
  const c = probe.getContext('2d'); c.drawImage(image, 0, 0, SIZE, SIZE);
  const pixels = c.getImageData(0, 0, SIZE, SIZE), data = pixels.data;
  const left = new Float32Array(SIZE + 1), right = new Float32Array(SIZE + 1);
  const axis = mix(548, 522, pose);
  const bright = (x, y) => { const i = (y * SIZE + x) * 4; return Math.max(data[i], data[i + 1], data[i + 2]); };
  for (let y = 0; y < SIZE; y++) {
    let l = axis, r = axis;
    if (y >= marks.back && y <= marks.bottom) {
      for (let x = 60; x < axis; x++) if (bright(x, y) > 18 && bright(x + 1, y) > 18 && bright(x + 2, y) > 18) { l = x; break; }
      for (let x = 972; x > axis; x--) if (bright(x, y) > 18 && bright(x - 1, y) > 18) { r = x; break; }
      r = mix(r, 2 * axis - l, smoothRange(marks.handleTop - 35, marks.handleTop - 5, y));
    }
    left[y] = l; right[y] = Math.max(l + .2, r);
  }
  left[SIZE] = right[SIZE] = axis;
  const handle = document.createElement('canvas');
  const bounds = { x: 720, y: Math.floor(marks.handleTop - 5), w: 510, h: Math.ceil(marks.handleBottom - marks.handleTop + 12) };
  handle.width = bounds.w; handle.height = bounds.h;
  const hc = handle.getContext('2d'); hc.drawImage(image, bounds.x, bounds.y, bounds.w, bounds.h, 0, 0, bounds.w, bounds.h);
  const hp = hc.getImageData(0, 0, bounds.w, bounds.h);
  for (let y = 0; y < bounds.h; y++) for (let x = 0; x < bounds.w; x++) {
    const i = (y * bounds.w + x) * 4;
    const value = Math.max(hp.data[i], hp.data[i + 1], hp.data[i + 2]);
    hp.data[i + 3] = x + bounds.x < right[Math.min(SIZE, y + bounds.y)] - 42 ? 0 : Math.min(255, Math.max(0, (value - 5) * 18));
  }
  hc.putImageData(hp, 0, 0); probe.width = probe.height = 1;
  return { left, right, handle, bounds, marks };
}
const sample = (array, y) => { const f = Math.max(0, Math.min(SIZE - 1, y)), i = Math.floor(f); return mix(array[i], array[i + 1], f - i); };
function triangle(ctx, image, s, d) {
  const [x0, y0, x1, y1, x2, y2] = s, [u0, v0, u1, v1, u2, v2] = d;
  const det = (x0 - x2) * (y1 - y2) - (x1 - x2) * (y0 - y2);
  if (Math.abs(det) < .001) return;
  const a = ((u0 - u2) * (y1 - y2) - (u1 - u2) * (y0 - y2)) / det;
  const c = ((u1 - u2) * (x0 - x2) - (u0 - u2) * (x1 - x2)) / det;
  const b = ((v0 - v2) * (y1 - y2) - (v1 - v2) * (y0 - y2)) / det;
  const e = ((v1 - v2) * (x0 - x2) - (v0 - v2) * (x1 - x2)) / det;
  ctx.save(); ctx.beginPath();
  const orientation = Math.sign((u1 - u0) * (v2 - v0) - (v1 - v0) * (u2 - u0)) || 1;
  const edges = [];
  for (let i = 0; i < 3; i++) {
    const j = (i + 1) % 3, x = d[i * 2], y = d[i * 2 + 1];
    const dx = d[j * 2] - x, dy = d[j * 2 + 1] - y, length = Math.hypot(dx, dy) || 1;
    const nx = orientation * dy / length, ny = -orientation * dx / length;
    edges.push({ nx, ny, v: nx * x + ny * y + .8 });
  }
  for (let i = 0; i < 3; i++) {
    const previous = edges[(i + 2) % 3], next = edges[i];
    const delta = previous.nx * next.ny - next.nx * previous.ny;
    const px = Math.abs(delta) > 1e-8 ? (previous.v * next.ny - next.v * previous.ny) / delta : d[i * 2];
    const py = Math.abs(delta) > 1e-8 ? (previous.nx * next.v - next.nx * previous.v) / delta : d[i * 2 + 1];
    if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
  }
  ctx.closePath(); ctx.clip(); ctx.transform(a, b, c, e, u2 - a * x2 - c * y2, v2 - b * x2 - e * y2);
  ctx.drawImage(image, 0, 0, SIZE, SIZE); ctx.restore();
}

// Match the photographed silhouettes, instead of fading between two outlines.
function warp(frame, image, sourcePose, targetPose, filled, lowPower, profiles) {
  clearFrame(frame);
  const ctx = frame.context;
  const front = profiles[filled ? 'final' : 'front'], tilted = profiles.tilt;
  const profile = sourcePose ? tilted : front, source = profile.marks, target = cupLandmarks(targetPose, filled);
  const sharedHandle = profiles.final;
  const targetX = mix(front.bounds.x, tilted.bounds.x, targetPose);
  const targetY = target.handleTop - 5;
  ctx.drawImage(sharedHandle.handle, targetX, targetY, mix(front.bounds.w, tilted.bounds.w, targetPose), target.handleBottom - target.handleTop + 12);
  const point = y => {
    const sy = mapPhotoY(y, target, source);
    const fy = mapPhotoY(y, target, front.marks), ty = mapPhotoY(y, target, tilted.marks);
    return { y: sy, l: sample(profile.left, sy), r: sample(profile.right, sy),
      dl: mix(sample(front.left, fy), sample(tilted.left, ty), targetPose),
      dr: mix(sample(front.right, fy), sample(tilted.right, ty), targetPose) };
  };
  const strips = lowPower ? 80 : 112;
  const ys = [...Array.from({ length: strips + 1 }, (_, i) => mix(target.back + .25, target.bottom - .25, i / strips)), target.lip].sort((a, b) => a - b);
  ctx.save(); ctx.beginPath();
  ys.forEach((y, i) => { const p = point(y); if (i === 0) ctx.moveTo(p.dl, y); else ctx.lineTo(p.dl, y); });
  ys.toReversed().forEach(y => { const p = point(y); ctx.lineTo(p.dr, y); });
  ctx.closePath(); ctx.clip();
  for (let i = 0; i < ys.length - 1; i++) {
    const y0 = ys[i], y1 = ys[i + 1], p0 = point(y0), p1 = point(y1);
    triangle(ctx, image, [p0.l, p0.y, p0.r, p0.y, p1.r, p1.y], [p0.dl, y0, p0.dr, y0, p1.dr, y1]);
    triangle(ctx, image, [p0.l, p0.y, p1.r, p1.y, p1.l, p1.y], [p0.dl, y0, p1.dr, y1, p1.dl, y1]);
  }
  ctx.restore();
}

export async function createCoffeeScene(canvas, { lowPower = false } = {}) {
  const ctx = canvas.getContext('2d', { alpha: false, desynchronized: true });
  if (!ctx) throw new Error('Canvas2D is unavailable.');
  const values = await Promise.all(imageFiles.map(loadImage));
  const photos = Object.fromEntries(imageFiles.map((key, i) => [key, values[i]]));
  const profiles = { front: photographProfile(photos.front, 0, 0), tilt: photographProfile(photos.tilt, 1, 0), final: photographProfile(photos.final, 0, 1) };
  const resolution = lowPower ? 896 : SIZE;
  const master = buffer(resolution), a = buffer(resolution), b = buffer(resolution);
  const frontBase = buffer(resolution), tiltBase = buffer(resolution);
  warp(frontBase, photos.front, 0, 0, 0, lowPower, profiles);
  warp(tiltBase, photos.tilt, 1, 1, 0, lowPower, profiles);
  const liquid = document.createElement('canvas'); liquid.width = liquid.height = SIZE;
  const liquidCtx = liquid.getContext('2d');
  const quiet = document.createElement('canvas'); quiet.width = quiet.height = SIZE;
  const quietCtx = quiet.getContext('2d');
  if (!liquidCtx || !quietCtx) throw new Error('Canvas2D is unavailable.');

  // Actual supplied coffee pixels. Adjacent coffee pixels replace the baked
  // stream above the photographed impact, so the stream can move independently.
  liquidCtx.drawImage(photos.pour, 0, 0);
  liquidCtx.save(); liquidCtx.beginPath();
  liquidCtx.moveTo(535, 512); liquidCtx.lineTo(636, 512); liquidCtx.lineTo(588, 724); liquidCtx.lineTo(515, 724); liquidCtx.closePath(); liquidCtx.clip();
  liquidCtx.drawImage(photos.pour, 100, -30); liquidCtx.restore();
  liquidCtx.globalCompositeOperation = 'destination-in';
  liquidCtx.beginPath(); liquidCtx.ellipse(528, 696, 281, 174, 0, 0, Math.PI * 2); liquidCtx.fill();
  quietCtx.save(); quietCtx.beginPath(); quietCtx.ellipse(528, 696, 281, 174, 0, 0, Math.PI * 2); quietCtx.clip();
  quietCtx.drawImage(photos.final, 192, 469, 716, 162, 247, 522, 562, 348); quietCtx.restore();

  let width = 1, height = 1, dpr = 1, mobile = false, dead = false;
  function resize({ width: w, height: h, dpr: ratio = 1, mobile: phone = w < 700 }) {
    if (dead) return;
    width = Math.max(1, w); height = Math.max(1, h); dpr = Math.min(lowPower ? 1.5 : 1.75, Math.max(.75, ratio)); mobile = phone;
    canvas.width = Math.round(width * dpr); canvas.height = Math.round(height * dpr);
    ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'high';
  }

  function drawSurface(frame, state) {
    const c = frame.context, g = state.surface;
    c.save();
    c.beginPath(); c.ellipse(523, 527, 405, 332, 0, 0, Math.PI * 2); c.clip();
    c.beginPath(); c.ellipse(g.x, g.y, g.rx, g.ry, 0, 0, Math.PI * 2); c.clip();
    c.globalAlpha = smoothRange(.26, .295, state.progress);
    c.translate(g.x, g.y); c.scale(g.rx / 281, g.ry / 174); c.translate(-528, -696);
    const agitation = state.pour * (1 - state.settle);
    const strips = 22, start = 522, band = 348 / strips;
    for (let i = 0; i < strips; i++) {
      const y = start + i * band;
      const displacement = Math.sin(i * .72 - state.time * 4.2) * agitation * 1.4;
      c.drawImage(liquid, 247, y, 562, band + 1, 247 + displacement, y, 562, band + 1);
    }
    c.globalAlpha *= smoothRange(.64, .76, state.progress);
    c.drawImage(quiet, 0, 0); c.restore();
  }

  function render(input = {}) {
    if (dead) return;
    const state = coffeePhotoState(input.progress || 0);
    const { progress: p, tilt } = state;
    const size = Math.min(width * (mobile ? .98 : .62), height * (mobile ? .76 : .98));
    const scale = size / SIZE;
    const marks = cupLandmarks(tilt, p > .7 ? 1 : 0);
    const centerY = mix(height * .59, height * (mobile ? .43 : .37), state.lift) + (1 - state.reveal) * 18;
    const left = width / 2 - marks.centerX * scale, top = centerY - marks.centerY * scale;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
    ctx.fillStyle = '#000'; ctx.fillRect(0, 0, width, height);
    ctx.save(); ctx.translate(left, top); ctx.scale(scale, scale); ctx.globalAlpha = state.reveal;
    if (p <= .26) {
      if (tilt < .00001) { clearFrame(a); a.context.drawImage(frontBase.canvas, 0, 0, SIZE, SIZE); }
      else warp(a, photos.front, 0, tilt, 0, lowPower, profiles);
      ctx.drawImage(a.canvas, 0, 0, SIZE, SIZE);
      if (state.entry > .0001) {
        warp(b, photos.tilt, 1, tilt, 0, lowPower, profiles);
        ctx.globalAlpha = state.reveal * state.entry; ctx.drawImage(b.canvas, 0, 0, SIZE, SIZE);
      }
    } else if (p < .84) {
      clearFrame(master); master.context.drawImage(tiltBase.canvas, 0, 0, SIZE, SIZE); drawSurface(master, state);
      if (tilt > .99999) { clearFrame(a); a.context.drawImage(master.canvas, 0, 0, SIZE, SIZE); }
      else warp(a, master.canvas, 1, tilt, 1, lowPower, profiles);
      ctx.drawImage(a.canvas, 0, 0, SIZE, SIZE);
      if (state.returning > .0001) {
        warp(b, photos.final, 0, tilt, 1, lowPower, profiles);
        ctx.globalAlpha = state.reveal * state.returning; ctx.drawImage(b.canvas, 0, 0, SIZE, SIZE);
      }
    } else {
      // Final cup and crema resolve to the supplied03.png, with its own steam.
      ctx.drawImage(photos.final, 0, 426, SIZE, SIZE - 426, 0, 426, SIZE, SIZE - 426);
    }
    if (p > .76) {
      const ambient = Math.max(0, Number(input.ambientTime) || 0);
      ctx.globalAlpha = state.steam * (.94 + .06 * Math.cos(ambient * .34));
      ctx.drawImage(photos.final, 260, 65, 520, 361, 260 + marks.centerX - 665 + Math.sin(ambient * .21) * 2.5, marks.back - 371 + Math.sin(ambient * .17) * 3, 520, 361);
    }
    ctx.restore();

    if (p > .232 && p < .715) {
      const g = state.surface;
      const impact = { x: g.x + 20 * g.rx / 281, y: g.y + 63 * g.ry / 174 };
      const bottomX = left + impact.x * scale, bottomY = top + impact.y * scale;
      const entry = smoothRange(.232, .29, p), stop = 1 - smoothRange(.665, .715, p);
      const emitter = -140;
      const end = mix(emitter, bottomY, entry);
      const start = mix(emitter, bottomY - 5, smoothRange(.665, .715, p));
      const streamWidth = 106 * scale * Math.max(.08, stop);
      const strips = lowPower ? 20 : 30;
      ctx.save(); ctx.globalAlpha = state.reveal * Math.min(1, stop * 3);
      const total = Math.max(1, end - start);
      for (let i = 0; i < strips; i++) {
        const f0 = i / strips;
        const y = start + total * f0, stripHeight = total / strips + 1;
        const fraction = (y - emitter) / Math.max(1, bottomY - emitter);
        const bend = (1 - fraction) * 85 * scale + Math.sin(f0 * 7 + state.time * 3) * 1.2 * scale;
        const sx = bottomX + bend - streamWidth / 2;
        const span = 1100 / strips;
        const sourceY = f0 * 1100 + state.time * 20;
        ctx.drawImage(photos.stream, 0, sourceY, 310, span, sx, y, streamWidth, stripHeight + .5);
      }
      ctx.restore();
    }
    // Last drops are cropped from the user's isolated stream, not painted dots.
    if (p >= .703 && p < .785) {
      for (let i = 0; i < 3; i++) {
        const flight = (p - (.703 + i * .014)) / .044;
        if (flight < 0 || flight > 1) continue;
        const g = state.surface;
        const sourceMarks = cupLandmarks(1, 1), targetMarks = cupLandmarks(tilt, 1);
        const impactX = g.x + 20 * g.rx / 281;
        const mappedX = targetMarks.centerX + (impactX - sourceMarks.centerX) * targetMarks.width / sourceMarks.width;
        const impactY = mapPhotoY(g.y + 63 * g.ry / 174, sourceMarks, targetMarks);
        const x = left + (mappedX + (1 - flight) * 18) * scale;
        const y = mix(-35, top + impactY * scale, flight * flight);
        const drop = (12 - i * 1.5) * scale;
        ctx.drawImage(photos.stream, 246, 768, 29, 34, x - drop / 2, y, drop, drop * 1.35);
      }
    }
  }
  function dispose() {
    if (dead) return; dead = true;
    for (const frame of [master, a, b, frontBase, tiltBase]) { frame.canvas.width = frame.canvas.height = 1; }
    Object.values(profiles).forEach(profile => { profile.handle.width = profile.handle.height = 1; });
    liquid.width = liquid.height = quiet.width = quiet.height = 1;
  }
  resize({ width: canvas.clientWidth || 1280, height: canvas.clientHeight || 720, dpr: 1 });
  render({ progress: 0 });
  return { resize, render, dispose };
}
