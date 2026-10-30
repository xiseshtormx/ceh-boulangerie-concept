// Same real-scale cavity and timeline as coffee-3d/create_coffee_scene.py.
// Blender (x,y,z) maps to glTF / Three.js (x,z,-y). Liquid stays in world space.
export const CUP_PIVOT = .010;
export const INNER_PROFILE = [[.011, 0], [.0113, .012], [.0125, .021], [.015, .028], [.022, .034], [.032, .039], [.046, .0422], [.061, .0437], [.066, .0443]];
const TAU = Math.PI * 2;
export const STREAM_RINGS = 112, STREAM_SIDES = 24;
const topologyCache = new Map();
export const clamp = x => Math.max(0, Math.min(1, Number.isFinite(x) ? x : 0));
export function smooth(a, b, p) { const x = clamp((p - a) / (b - a)); return x * x * (3 - 2 * x); }
export function uprightVolume(h) {
  let v = 0;
  for (let i = 1; i < INNER_PROFILE.length; i++) {
    const [a, ra] = INNER_PROFILE[i - 1], [b, rb] = INNER_PROFILE[i], d = Math.max(0, Math.min(h, b) - a), slope = (rb - ra) / (b - a);
    v += Math.PI * (ra * ra * d + ra * slope * d * d + slope * slope * d * d * d / 3);
  }
  return v;
}
const slices = Array.from({ length: 256 }, (_, i) => { const z = .011 + (i + .5) * .055 / 256; return [z, innerRadius(z)]; });
export function liquidVolume(h, tilt) {
  if (tilt < .01) return uprightVolume(h);
  const c = Math.cos(tilt), s = Math.sin(tilt);
  let sum = 0;
  for (const [z, r] of slices) {
    const k = (h - CUP_PIVOT - (z - CUP_PIVOT) * c) / s;
    if (k >= r) sum += Math.PI * r * r;
    else if (k > -r) sum += r * r * (Math.asin(k / r) + Math.PI / 2) + k * Math.sqrt(Math.max(0, r * r - k * k));
  }
  const blend = smooth(.01, .04, tilt);
  return uprightVolume(h) * (1 - blend) + sum * .055 / 256 * blend;
}
function integralSmooth(a, b, p) { const x = clamp((p - a) / (b - a)); return (b - a) * (x ** 3 - .5 * x ** 4) + Math.max(0, p - b); }
const SEED_VOLUME = liquidVolume(.0115, Math.PI / 180 * 16);
export function fluidState(value) {
  const p = clamp(value), fill = clamp((integralSmooth(.29, .325, p) - integralSmooth(.69, .765, p)) / .420);
  const tilt = Math.PI / 180 * 16 * smooth(.05, .22, p) * (1 - smooth(.30, .80, p));
  const volume = SEED_VOLUME + (uprightVolume(.059) - SEED_VOLUME) * fill;
  let lo = .011, hi = .060;
  for (let i = 0; i < 20; i++) { const h = (lo + hi) / 2; if (liquidVolume(h, tilt) < volume) lo = h; else hi = h; }
  const level = (lo + hi) / 2, pour = smooth(.235, .29, p) * (1 - smooth(.69, .765, p)), impact = pour * smooth(.29, .325, p);
  const cy = -(level - CUP_PIVOT) * Math.tan(tilt);
  return { p, fill, tilt, volume, level, pour, impact, foam: smooth(.56, .98, fill), agitation: smooth(.29, .34, p) * (1 - smooth(.765, .97, p)),
    phase: clamp((p - .29) / .475), ix: .00065 * Math.sin(p * 23) * impact, iz: -cy - .00055 * Math.sin(p * 17 + .8) * impact,
    reveal: .28 + .72 * smooth(0, .13, p), steam: smooth(.81, .98, p) };
}
export function innerRadius(z) {
  if (z <= INNER_PROFILE[0][0]) return .000001;
  for (let i = 1; i < INNER_PROFILE.length; i++) {
    const [a, ra] = INNER_PROFILE[i - 1], [b, rb] = INNER_PROFILE[i];
    if (z <= b) return ra + (rb - ra) * (z - a) / (b - a);
  }
  return INNER_PROFILE.at(-1)[1];
}
function floorAt(r) {
  for (let i = 1; i < INNER_PROFILE.length; i++) {
    const [a, ra] = INNER_PROFILE[i - 1], [b, rb] = INNER_PROFILE[i];
    if (r <= rb) return a + (b - a) * Math.max(0, r - ra) / (rb - ra);
  }
  return INNER_PROFILE.at(-1)[0];
}
export function surfaceHeight(st, x, z, t = 0) {
  const dx = x - st.ix, dy = -z + st.iz, d = Math.hypot(dx, dy), a = Math.atan2(dy, dx), fade = Math.max(0, 1 - t ** 8);
  let wave = .00048 * Math.sin(d * 760 - st.p * 94 + .35 * Math.sin(a * 3)) * Math.exp(-d * 48);
  wave += .00015 * Math.sin(d * 420 - st.p * 58 + a * .7) + .00009 * Math.sin(dx * 500 + dy * 900 - st.p * 112) * Math.exp(-d * 40);
  wave *= st.agitation * fade;
  const crater = -.00125 * Math.exp(-((d / .0019) ** 2)) * st.impact;
  const crownRadius = .0029 + .00045 * Math.sin(a * 3 - st.p * 37) + .00023 * Math.sin(a * 7 + st.p * 71);
  const tongues = .00055 * Math.max(0, Math.sin(a * 3 - st.p * 41)) ** 12;
  const crown = Math.exp(-(((d - crownRadius) / .0011) ** 2)) * (.00135 * (.85 + .30 * Math.sin(a * 5 - st.p * 49)) + tongues) * st.impact;
  const c = Math.cos(st.tilt), s = Math.sin(st.tilt), localRadius = Math.hypot(x, -z * c + (st.level - CUP_PIVOT) * s);
  const floorWorld = CUP_PIVOT + (floorAt(localRadius) - CUP_PIVOT - z * s) / c;
  return Math.max(st.level + wave + (crater + crown) * fade + .00017 * t ** 24, floorWorld + .00012);
}
export function crossSection(height, tilt, segments = 128) {
  const c = Math.cos(tilt), s = Math.sin(tilt), cy = -(height - CUP_PIVOT) * Math.tan(tilt);
  const zc = CUP_PIVOT + (height - CUP_PIVOT) / c, radii = new Float64Array(segments);
  for (let j = 0; j < segments; j++) {
    const a = TAU * j / segments, ca = Math.cos(a), sa = Math.sin(a);
    const localAngle = Math.atan2(sa * c, ca);
    const jointScale = .00060 * Math.exp(-((localAngle / .12) ** 2));
    let lo = 0, hi = .049;
    for (let k = 0; k < 22; k++) {
      const r = (lo + hi) * .5, zl = zc - r * sa * s;
      const joint = jointScale * smooth(.054, .0555, zl) * (1 - smooth(.0577, .0588, zl));
      if (r * Math.hypot(ca, sa * c) < innerRadius(zl) - .00048 - joint) lo = r; else hi = r;
    }
    radii[j] = lo;
  }
  return { cy, radii };
}
export function surfaceData(st, segments = 128, rings = 40, crema = false, shared = null) {
  const { cy, radii } = shared || crossSection(st.level, st.tilt, segments);
  const positions = new Float32Array((1 + segments * rings) * 3), uvs = shared?.uvs || new Float32Array((1 + segments * rings) * 2);
  const colors = crema ? new Float32Array((1 + segments * rings) * 4) : null;
  for (let i = 0; i <= rings; i++) for (let j = 0; j < (i ? segments : 1); j++) {
    const t = (i / rings) ** 1.35, a = TAU * j / segments, r = i ? t * radii[j] : 0, index = i ? 1 + (i - 1) * segments + j : 0;
    const x = r * Math.cos(a), z = -cy - r * Math.sin(a), d = Math.hypot(x - st.ix, z - st.iz);
    const offset = crema ? .000065 : 0;
    positions.set([x, (shared ? shared.positions[index * 3 + 1] : surfaceHeight(st, x, z, t)) + offset, z], index * 3);
    const twist = .34 * st.phase * (1 - t) ** 2 + .012 * Math.sin(a * 3 + st.phase * 8 + t * 10) * st.agitation;
    const advected = t * (1 - .18 * st.phase * (1 - t));
    if (!shared) uvs.set([.5 + .5 * advected * Math.cos(a + twist), .5 + .5 * advected * Math.sin(a + twist)], index * 2);
    if (colors) {
      const angle = Math.atan2(z - st.iz, x - st.ix);
      const edge = .0045 * (1 + .18 * Math.sin(angle * 3 + st.phase * 7) + .09 * Math.sin(angle * 5 - st.phase * 11));
      const swept = 1 - .97 * st.impact * (1 - smooth(.0019, edge, d));
      colors.set([1, 1, 1, swept], index * 4);
    }
  }
  const key = segments * 1024 + rings;
  let indices = topologyCache.get(key);
  if (!indices) {
    indices = [];
    for (let j = 0; j < segments; j++) indices.push(0, 1 + j, 1 + (j + 1) % segments);
    for (let i = 0; i < rings - 1; i++) for (let j = 0; j < segments; j++) {
      const n = (j + 1) % segments, a = 1 + i * segments, b = a + segments;
      indices.push(a + j, b + j, b + n, a + j, b + n, a + n);
    }
    topologyCache.set(key, indices);
  }
  return { positions, uvs, indices, colors, cy, radii };
}
export function streamData(st) {
  const stride = STREAM_SIDES + 1, count = (STREAM_RINGS + 1) * stride, positions = new Float32Array(count * 3), uvs = new Float32Array(count * 2), colors = new Float32Array(count * 4), indices = [];
  const top = .183, contact = surfaceHeight(st, st.ix, st.iz) - .00008, end = top + (contact - top) * smooth(.235, .29, st.p);
  const v0 = .46, fullTravel = (Math.sqrt(v0 * v0 + 19.62 * (top - contact)) - v0) / 9.81;
  for (let i = 0; i <= STREAM_RINGS; i++) {
    const t = i / STREAM_RINGS, y = end + (top - end) * t, distance = top - y;
    const velocity = Math.sqrt(v0 * v0 + 19.62 * distance), travel = (velocity - v0) / 9.81, time = st.p * 5 - travel;
    // Continuity A*v = Q: the jet accelerates and narrows under gravity. The
    // closing nozzle signal travels down the jet instead of shrinking it at once.
    const flow = smooth(.235, .29, st.p) * (1 - smooth(.69, .765, st.p + (fullTravel - travel) / 5));
    const foot = 1 - smooth(0, .026, t);
    const radius = .0032 * Math.sqrt(v0 / velocity) * Math.sqrt(flow) * (1 + .34 * st.impact * foot);
    const pulse = 1 + .10 * Math.sin(time * 34) + .045 * Math.sin(time * 73 + .8);
    const cx = st.ix + t * (.00090 * Math.sin(time * 16) + .00035 * Math.sin(time * 37 + t * 3));
    const cz = st.iz - .0022 * t + .00060 * t * Math.sin(time * 21 + .6);
    for (let j = 0; j <= STREAM_SIDES; j++) {
      const a = TAU * j / STREAM_SIDES, index = i * stride + j;
      const capillary = .18 * Math.sin(distance * 430 - st.p * 107) + .075 * Math.sin(distance * 900 - st.p * 173 + a * 2);
      const r = radius * pulse * (1 + capillary + .075 * Math.sin(time * 39 + a * 2) + .035 * Math.sin(time * 61 - a * 3 + t * 8));
      const oval = 1 + .16 * Math.sin(distance * 145 - st.p * 41) * (1 - foot);
      positions.set([cx + r * oval * Math.cos(a), y, cz - r / oval * Math.sin(a)], index * 3);
      uvs.set([j / STREAM_SIDES, (1 - t) * 6 - st.p * 14], index * 2);
      const absorption = .24 + .76 * smooth(0, .045, t);
      colors.set([absorption, absorption, absorption, 1], index * 4);
      if (i < STREAM_RINGS && j < STREAM_SIDES) {
        const a0 = i * stride, b = a0 + stride;
        indices.push(a0 + j, a0 + j + 1, b + j + 1, a0 + j, b + j + 1, b + j);
      }
    }
  }
  const topRing = STREAM_RINGS * stride;
  for (let j = 1; j < STREAM_SIDES - 1; j++) {
    indices.push(0, j + 1, j, topRing, topRing + j, topRing + j + 1);
  }
  return { positions, uvs, colors, indices };
}
export function bubbleState(st, i, section) {
  const local = i % 72, rim = i < 72;
  const age = ((Math.min(st.p, .765) - .29) * 9 + local * .618034 + 20) % 1;
  const a = local * 2.39996 + .18 * st.phase + (rim ? 0 : age * .55);
  const j = Math.round(((a % TAU) + TAU) % TAU / TAU * section.radii.length) % section.radii.length;
  const fraction = rim ? .84 + .13 * ((local * .618034) % 1) : .18 + .57 * age;
  const r = section.radii[j] * fraction;
  const x = r * Math.cos(a), z = -section.cy - r * Math.sin(a);
  const birth = smooth(.0, .12, age) * (1 - smooth(.86, 1, age));
  const size = (.00013 + .00055 * ((i * .431) % 1) ** 3) * (rim ? 1 : birth * (.4 + .6 * st.agitation)) * Math.sqrt(st.foam);
  return { position: [x, surfaceHeight(st, x, z, fraction) - .000018, z], radius: size, flatten: .35 };
}
export function tailDropState(st, i) {
  const age = (st.p - (.735 + i * .006)) * 5;
  const y = .173 - .46 * age - 4.905 * age * age;
  const active = age > 0 && y > st.level + .0006;
  const radius = active ? .00040 + .00018 * ((i * .619) % 1) : 0;
  return { position: [st.ix + .00045 * Math.sin(i * 4.1), y, st.iz - .0011], radius, stretch: 1.25 + Math.max(0, age) * 2 };
}
export function splashState(st, i) {
  const t = ((st.p - .29) * 5 * 4.2 + i * .173) % 1, a = i * 2.39996 + st.p * 11, r = .0025 + .005 * t;
  const radius = (.00028 + .00014 * ((i * .431) % 1)) * st.impact * Math.max(0, Math.sin(Math.PI * t)) ** .55;
  return { position: [st.ix + r * Math.cos(a), st.level + .0003 + .0042 * 4 * t * (1 - t), st.iz - r * Math.sin(a)], radius };
}
