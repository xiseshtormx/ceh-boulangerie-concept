const clamp = value => Math.min(1, Math.max(0, Number.isFinite(value) ? value : 0));
export function smoothRange(start, end, value) {
  const x = clamp((value - start) / (end - start));
  return x * x * (3 - 2 * x);
}

// No elapsed-time physics: the same scroll position always gives the same shot.
export function coffeeState(value) {
  const progress = clamp(value);
  return {
    progress, time: progress * 16,
    reveal: smoothRange(0, .15, progress),
    blue: smoothRange(.12, .26, progress),
    pour: smoothRange(.232, .29, progress) * (1 - smoothRange(.65, .715, progress)),
    fill: smoothRange(.26, .70, progress),
    crema: smoothRange(.26, .78, progress),
    settle: smoothRange(.68, .82, progress),
    steam: smoothRange(.76, .90, progress),
    camera: smoothRange(.07, .93, progress),
    copy: smoothRange(.80, .94, progress),
    stage: progress < .15 ? 'reveal' : progress < .25 ? 'light' : progress < .65 ? 'pour' : progress < .80 ? 'crema' : progress < .95 ? 'steam' : 'final',
  };
}

export function coffeeProgress(top, height, pinHeight) {
  const distance = height - pinHeight;
  return distance > 0 ? clamp(-top / distance) : 1;
}
