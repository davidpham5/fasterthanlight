import { describe, expect, it } from 'vitest';
import { defaultWidth, originFor, srcsetEntries, srcsetFor, urlFor } from './cloudinary';

describe('urlFor', () => {
  it('builds a same-origin /img URL with auto format/quality and a width limit', () => {
    expect(urlFor('samples/people/jazz', 800)).toBe(
      '/img/f_auto,q_auto,c_limit,w_800/samples/people/jazz',
    );
  });

  it('URL-encodes each segment of a public id with spaces or #', () => {
    expect(urlFor('portfolio/galas/Award Night #1', 400)).toBe(
      '/img/f_auto,q_auto,c_limit,w_400/portfolio/galas/Award%20Night%20%231',
    );
  });
});

describe('srcsetEntries', () => {
  it('uses all four widths for large originals', () => {
    expect(srcsetEntries(6000)).toEqual([
      { width: 400, descriptor: 400 },
      { width: 800, descriptor: 800 },
      { width: 1600, descriptor: 1600 },
      { width: 2560, descriptor: 2560 },
    ]);
  });

  it('describes the capped size instead of claiming an upscale', () => {
    expect(srcsetEntries(1333)).toEqual([
      { width: 400, descriptor: 400 },
      { width: 800, descriptor: 800 },
      { width: 1600, descriptor: 1333 },
    ]);
  });

  it('stops at a width equal to the original', () => {
    expect(srcsetEntries(800)).toEqual([
      { width: 400, descriptor: 400 },
      { width: 800, descriptor: 800 },
    ]);
  });

  it('handles originals smaller than the smallest width', () => {
    expect(srcsetEntries(300)).toEqual([{ width: 400, descriptor: 300 }]);
  });
});

describe('srcsetFor', () => {
  it('joins entries into a srcset string', () => {
    expect(srcsetFor({ id: 'woman', width: 1000 })).toBe(
      [
        '/img/f_auto,q_auto,c_limit,w_400/woman 400w',
        '/img/f_auto,q_auto,c_limit,w_800/woman 800w',
        '/img/f_auto,q_auto,c_limit,w_1600/woman 1000w',
      ].join(', '),
    );
  });
});

describe('defaultWidth', () => {
  it('prefers 1600 when available, else the largest entry', () => {
    expect(defaultWidth(6000)).toBe(1600);
    expect(defaultWidth(1333)).toBe(1600);
    expect(defaultWidth(800)).toBe(800);
    expect(defaultWidth(300)).toBe(400);
  });
});

describe('2560 px long-edge cap (spec §5)', () => {
  it('limits both width and height on the largest size', () => {
    expect(urlFor('tall', 2560)).toBe('/img/f_auto,q_auto,c_limit,w_2560,h_2560/tall');
  });

  it('describes a height-capped portrait by its delivered width', () => {
    expect(srcsetEntries(4000, 6000)).toEqual([
      { width: 400, descriptor: 400 },
      { width: 800, descriptor: 800 },
      { width: 1600, descriptor: 1600 },
      { width: 2560, descriptor: 1707 },
    ]);
  });

  it('drops the largest size when the height cap makes it no wider than the previous one', () => {
    expect(srcsetEntries(1700, 5000)).toEqual([
      { width: 400, descriptor: 400 },
      { width: 800, descriptor: 800 },
      { width: 1600, descriptor: 1600 },
    ]);
  });
});

describe('originFor', () => {
  it('is the Cloudinary upload base that /img proxies to', () => {
    expect(originFor('demo')).toBe('https://res.cloudinary.com/demo/image/upload');
  });
});
