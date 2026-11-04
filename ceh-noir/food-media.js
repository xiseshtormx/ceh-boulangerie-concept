// Derived from the supplied originals, with identical framing and transparent canvases.
export const foodSizes = '(max-width: 760px) calc(100vw - 48px), (min-width: 1680px) 760px, 56vw';
export function foodPhoto(entry) {
  const stem = entry.image.replace(/\.[^.]+$/, '');
  const factor = Math.min(1, 1600 / Math.max(entry.width, entry.height));
  const smallFactor = Math.min(1, 800 / Math.max(entry.width, entry.height));
  const width = Math.round(entry.width * factor);
  const smallWidth = Math.round(entry.width * smallFactor);
  const path = `assets/dishes/food-web/${stem}`;
  return { src: `${path}-1600.webp`, srcset: `${path}-800.webp ${smallWidth}w, ${path}-1600.webp ${width}w`, sizes: foodSizes };
}
