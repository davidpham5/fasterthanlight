import { describe, expect, it } from 'vitest';
import {
  excerpt,
  formatDate,
  isoDate,
  neighbours,
  resolvePosts,
  rssContent,
  type LogEntry,
} from './photo-log';
import type { PhotoLogFile } from './schema';

const file: PhotoLogFile = {
  posts: {
    peonies: {
      photos: {
        DSCF1: {
          publicId: 'photo-log/peonies/DSCF1',
          width: 1086,
          height: 1448,
          placeholder: 'data:image/jpeg;base64,AA',
          uploadedAt: '2026-09-28T17:00:00Z',
          exif: { make: 'FUJIFILM', model: 'X-T3', iso: '160' },
        },
        DSCF2: {
          publicId: 'photo-log/peonies/DSCF2',
          width: 2000,
          height: 1000,
          uploadedAt: '2026-09-28T17:01:00Z',
          exif: {},
        },
      },
    },
    walk: {
      photos: {
        IMG1: { publicId: 'photo-log/walk/IMG1', width: 10, height: 10, uploadedAt: '', exif: {} },
      },
    },
  },
};

const entry = (id: string, data: Partial<LogEntry['data']>): LogEntry => ({
  id,
  data: { title: id, date: new Date('2026-09-01'), draft: false, photos: [], ...data },
});

const peonies = entry('peonies', {
  title: 'Peonies',
  date: new Date('2026-09-28'),
  photos: [
    { id: 'DSCF2', alt: 'Wide', caption: ' Last of the season ', lens: 'Helios 44-2' },
    { id: 'DSCF1', alt: 'Tall' },
  ],
});
const walk = entry('walk', {
  date: new Date('2026-09-28'),
  photos: [{ id: 'IMG1', alt: 'A walk' }],
});
const older = entry('older', { date: new Date('2026-08-01'), photos: [{ id: 'IMG1', alt: 'x' }] });
const draft = entry('draft', {
  draft: true,
  date: new Date('2026-12-01'),
  photos: [{ id: 'nope', alt: '' }],
});

describe('resolvePosts', () => {
  // "older" reuses the walk's photo data; only its date matters here.
  const posts = resolvePosts([older, walk, draft, peonies], {
    posts: { ...file.posts, older: file.posts.walk },
  });

  it('drops drafts and sorts newest first, ties by slug', () => {
    expect(posts.map((p) => p.slug)).toEqual(['peonies', 'walk', 'older']);
  });

  it('joins photos in post order with their image data, alt, caption and camera line', () => {
    expect(posts[0].photos).toEqual([
      {
        id: 'photo-log/peonies/DSCF2',
        name: 'DSCF2',
        width: 2000,
        height: 1000,
        alt: 'Wide',
        caption: 'Last of the season',
        camera: 'Helios 44-2',
      },
      {
        id: 'photo-log/peonies/DSCF1',
        name: 'DSCF1',
        width: 1086,
        height: 1448,
        alt: 'Tall',
        placeholder: 'data:image/jpeg;base64,AA',
        camera: 'Fujifilm X-T3 · ISO 160',
      },
    ]);
  });

  it('keeps the original entry for rendering', () => {
    expect(posts[0].entry.id).toBe('peonies');
  });

  it('fails clearly when a published post lists an unknown photo', () => {
    expect(() =>
      resolvePosts([entry('peonies', { photos: [{ id: 'DSCF9', alt: 'x' }] })], file),
    ).toThrow(/"peonies" lists photo "DSCF9", which isn't in photo-log.json/);
  });

  it("ignores drafts' photos entirely", () => {
    expect(resolvePosts([draft], file)).toEqual([]);
  });
});

describe('neighbours', () => {
  const list = [{ slug: 'c' }, { slug: 'b' }, { slug: 'a' }];
  it('finds the newer and older post', () => {
    expect(neighbours(list, 'b')).toEqual({ newer: { slug: 'c' }, older: { slug: 'a' } });
    expect(neighbours(list, 'c')).toEqual({ newer: undefined, older: { slug: 'b' } });
    expect(neighbours(list, 'zzz')).toEqual({});
  });
});

describe('dates', () => {
  it('formats in UTC so the day never shifts', () => {
    expect(formatDate(new Date('2026-09-28'))).toBe('September 28, 2026');
    expect(isoDate(new Date('2026-09-28'))).toBe('2026-09-28');
  });
});

describe('excerpt', () => {
  it('returns the first paragraph as plain text', () => {
    expect(
      excerpt('<p>Fuji X-T3, <em>an</em> overcast &amp; still morning.</p><p>More.</p>', 'T'),
    ).toBe('Fuji X-T3, an overcast & still morning.');
  });
  it('falls back when there is no text', () => {
    expect(excerpt('', 'Peonies')).toBe('Peonies');
  });
  it('decodes numeric entities from Astro-style output', () => {
    expect(excerpt('<p>Fuji &#x26; Helios &#x3C;3, it&#39;s &#38; more</p>', 'T')).toBe(
      "Fuji & Helios <3, it's & more",
    );
  });
});

describe('rssContent', () => {
  it('appends each photo as an absolute 1600px image with escaped alt and caption', () => {
    const [post] = resolvePosts([peonies], file);
    const html = rssContent(post, '<p>Body</p>', 'https://fasterthanlight.studio');
    expect(html.startsWith('<p>Body</p><figure>')).toBe(true);
    expect(html).toContain(
      '<img src="https://fasterthanlight.studio/img/f_auto,q_auto,c_limit,w_1600/photo-log/peonies/DSCF2" alt="Wide" />',
    );
    expect(html).toContain('<figcaption>Helios 44-2<br />Last of the season</figcaption>');
    const escaped = rssContent(
      { ...post, photos: [{ ...post.photos[0], alt: 'A "big" <one>' }] },
      '',
      'https://x.test',
    );
    expect(escaped).toContain('alt="A &quot;big&quot; &lt;one&gt;"');
  });
});
