import { describe, expect, it } from 'vitest';
import { hashForIndex, indexFromHash, swipeDirection, wrapIndex } from './slideshow-state';

describe('wrapIndex', () => {
  it('keeps in-range indexes', () => {
    expect(wrapIndex(0, 3)).toBe(0);
    expect(wrapIndex(2, 3)).toBe(2);
  });
  it('wraps past either end', () => {
    expect(wrapIndex(3, 3)).toBe(0);
    expect(wrapIndex(-1, 3)).toBe(2);
    expect(wrapIndex(5, 3)).toBe(2);
  });
  it('always returns 0 for a single-photo set', () => {
    expect(wrapIndex(1, 1)).toBe(0);
    expect(wrapIndex(-1, 1)).toBe(0);
  });
  it('returns 0 for an empty set', () => {
    expect(wrapIndex(4, 0)).toBe(0);
  });
});

describe('indexFromHash', () => {
  it('maps 1-based hashes to 0-based indexes', () => {
    expect(indexFromHash('#1', 3)).toBe(0);
    expect(indexFromHash('#3', 3)).toBe(2);
    expect(indexFromHash('#02', 3)).toBe(1);
  });
  it('falls back to the first photo for missing, malformed or out-of-range hashes', () => {
    for (const hash of ['', '#', '#0', '#4', '#99', '#abc', '#2abc', '#-1', '#1.5']) {
      expect(indexFromHash(hash, 3)).toBe(0);
    }
  });
});

describe('hashForIndex', () => {
  it('is 1-based', () => {
    expect(hashForIndex(0)).toBe('#1');
    expect(hashForIndex(6)).toBe('#7');
  });
});

describe('swipeDirection', () => {
  it('swiping left goes to the next photo', () => {
    expect(swipeDirection(-80, 10)).toBe(1);
  });
  it('swiping right goes to the previous photo', () => {
    expect(swipeDirection(80, 10)).toBe(-1);
  });
  it('ignores short or mostly-vertical gestures', () => {
    expect(swipeDirection(-30, 0)).toBe(0);
    expect(swipeDirection(-80, 120)).toBe(0);
    expect(swipeDirection(0, 0)).toBe(0);
  });
});
