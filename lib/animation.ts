export function clamp01(value: number) {
  return Math.max(0, Math.min(1, value));
}

export function easeOutCubic(value: number) {
  const t = clamp01(value);
  return 1 - (1 - t) ** 3;
}

export function easeInOutCubic(value: number) {
  const t = clamp01(value);
  return t < 0.5 ? 4 * t ** 3 : 1 - (-2 * t + 2) ** 3 / 2;
}

export function lerp(from: number, to: number, alpha: number) {
  return from + (to - from) * alpha;
}
