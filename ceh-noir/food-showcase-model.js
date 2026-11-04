export const clamp01 = value => Math.max(0, Math.min(1, value));
const ease = value => { const t = clamp01(value); return 1 - (1 - t) ** 3; };
const phase = (time, start, end) => ease((time - start) / (end - start));
const smooth = value => { const t = clamp01(value); return t * t * (3 - 2 * t); };
export const showcaseTime = 3.35;
export const chapterStep = 1.08;
export const chapterProgress = index => (index * chapterStep + .73) / showcaseTime;

/** One deterministic clock; seeking backwards reproduces the exact same composition. */
export function showcaseFrame(progress, count = 3, compact = false) {
  const clock = clamp01(progress) * showcaseTime;
  const active = Math.max(0, Math.min(count - 1, Math.floor((clock - .12) / chapterStep)));
  const entries = [[76, 20], [-64, 38], [48, -18]];
  const exits = [[38, -16], [-34, -20], [26, -10]];
  return { clock, active, panels: Array.from({ length: count }, (_, index) => {
    const time = clock - index * chapterStep;
    const enter = phase(time, 0, .22);
    const leave = index === count - 1 ? 0 : smooth((time - .94) / .26);
    const textOut = index === count - 1 ? 1 : 1 - phase(time, .91, 1.03);
    const amount = compact ? .32 : 1;
    const [x, y] = entries[index % entries.length], [ex, ey] = exits[index % exits.length];
    return {
      time, visible: time >= 0 && (index === count - 1 || time < 1.2),
      product: { opacity: enter * (1 - leave), x: (x * (1 - enter) + ex * leave) * amount, y: (y * (1 - enter) + ey * leave) * amount, scale: 1 - .035 * (1 - enter) - .025 * leave },
      title: phase(time, .24, .38) * textOut,
      description: line => phase(time, .33 + line * .035, .46 + line * .035) * textOut,
      option: item => phase(time, .43 + item * .022, .56 + item * .022) * textOut,
      details: phase(time, .56, .66) * textOut
    };
  }) };
}
