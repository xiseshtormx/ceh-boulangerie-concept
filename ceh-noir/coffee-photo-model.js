import { coffeeState, smoothRange } from './coffee-timeline.js';
export const PHOTO_SIZE = 1254;
export const mix = (a, b, amount) => a + (b - a) * amount;

// Registered landmarks in the supplied photographs, not a generated cup model.
export function cupLandmarks(tilt, filled = 0) {
  return {
    back: mix(436, 177, tilt),
    lip: mix(mix(603, 630, filled), 858, tilt),
    bottom: mix(mix(1059, 1063, filled), 1048, tilt),
    centerX: mix(mix(663, 665, filled), 645, tilt),
    width: mix(mix(1032, 1044, filled), 1098, tilt),
    join: mix(mix(954, 940, filled), 925, tilt),
    handleTop: mix(mix(582, 586, filled), 607, tilt),
    handleBottom: mix(mix(955, 958, filled), 914, tilt),
    centerY: mix(750, 612, tilt),
  };
}
export function mapPhotoY(y, source, target, handle = false) {
  const a = handle ? [0, source.handleTop, source.handleBottom, PHOTO_SIZE] : [0, source.back, source.lip, source.bottom, PHOTO_SIZE];
  const b = handle ? [0, target.handleTop, target.handleBottom, PHOTO_SIZE] : [0, target.back, target.lip, target.bottom, PHOTO_SIZE];
  let i = 0;
  while (i < a.length - 2 && y > a[i + 1]) i++;
  return mix(b[i], b[i + 1], (y - a[i]) / (a[i + 1] - a[i]));
}
export function coffeePhotoState(value) {
  const state = coffeeState(value);
  const entry = smoothRange(.13, .26, state.progress);
  const returning = smoothRange(.72, .84, state.progress);
  return {
    ...state, entry, returning, tilt: entry * (1 - returning),
    surface: {
      x: mix(535, 524, state.fill), y: mix(750, 575, state.fill),
      rx: mix(210, 376.5, state.fill), ry: mix(130, 282.5, state.fill),
    },
    lift: smoothRange(.72, .94, state.progress),
  };
}
