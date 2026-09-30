export function wrapIndex(index: number, count: number): number {
  if (count <= 0) return 0;
  return ((index % count) + count) % count;
}

/** "#7" → 6. Anything malformed or out of range opens the first photo. */
export function indexFromHash(hash: string, count: number): number {
  const match = /^#(\d+)$/.exec(hash);
  if (!match) return 0;
  const n = Number(match[1]);
  return n >= 1 && n <= count ? n - 1 : 0;
}

export function hashForIndex(index: number): string {
  return `#${index + 1}`;
}

/** +1 = next (swipe left), -1 = previous (swipe right), 0 = not a horizontal swipe. */
export function swipeDirection(dx: number, dy: number, threshold = 50): -1 | 0 | 1 {
  if (Math.abs(dx) < threshold || Math.abs(dx) <= Math.abs(dy)) return 0;
  return dx < 0 ? 1 : -1;
}
