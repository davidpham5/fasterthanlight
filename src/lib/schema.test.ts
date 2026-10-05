import { describe, expect, it } from 'vitest';
import { loadContent, logPostSchema, parseLogFile } from './schema';

const site = {
  name: 'FasterThanLight Studio',
  owner: 'David Pham',
  tagline: 'Corporate events, photographed like they matter.',
  description: 'Corporate event photography by David Pham.',
  email: 'hello@fasterthanlight.studio',
  cloudName: 'demo',
  heroId: 'hero',
  portraitId: 'me',
};

const photos = {
  sets: [
    {
      slug: 'conferences',
      title: 'Conferences & Keynotes',
      photos: [{ id: 'a', width: 3000, height: 2000, alt: 'Speaker on stage' }],
    },
  ],
  extras: {
    hero: { width: 3000, height: 2000, alt: 'Hero' },
    me: { width: 1000, height: 1500, alt: 'Portrait of David Pham' },
  },
};

const clone = <T>(value: T): T => structuredClone(value);

describe('loadContent', () => {
  it('accepts valid content and resolves the hero and portrait from extras', () => {
    const content = loadContent(site, photos);
    expect(content.sets).toHaveLength(1);
    expect(content.hero).toEqual({ id: 'hero', width: 3000, height: 2000, alt: 'Hero' });
    expect(content.portrait.id).toBe('me');
  });

  it('rejects a photo with blank alt text', () => {
    const bad = clone(photos);
    bad.sets[0].photos[0].alt = '   ';
    expect(() => loadContent(site, bad)).toThrow(/alt text is required/);
  });

  it('rejects duplicate set slugs', () => {
    const bad = clone(photos);
    bad.sets.push(clone(bad.sets[0]));
    expect(() => loadContent(site, bad)).toThrow(/duplicate set slug "conferences"/);
  });

  it('rejects a set with no photos', () => {
    const bad = clone(photos);
    bad.sets[0].photos = [];
    expect(() => loadContent(site, bad)).toThrow(/a set needs at least one photo/);
  });

  it('rejects a set slug that is not URL-safe', () => {
    const bad = clone(photos);
    bad.sets[0].slug = 'Conferences & Keynotes';
    expect(() => loadContent(site, bad)).toThrow(/slug must be lowercase words joined by hyphens/);
  });

  it('resolves a heroId that points at a gallery photo', () => {
    const content = loadContent({ ...site, heroId: 'a' }, photos);
    expect(content.hero).toEqual({ id: 'a', width: 3000, height: 2000, alt: 'Speaker on stage' });
  });

  it('rejects a heroId that is neither an extra nor a gallery photo', () => {
    expect(() => loadContent({ ...site, heroId: 'nope' }, photos)).toThrow(
      /heroId "nope" is not a photo in photos.json/,
    );
  });

  it('rejects an invalid email in site.json', () => {
    expect(() => loadContent({ ...site, email: 'not-an-email' }, photos)).toThrow(
      /site\.json is invalid/,
    );
  });
});

describe('logPostSchema', () => {
  const post = {
    title: 'Peonies',
    date: '2026-09-28',
    photos: [{ id: 'DSCF1', alt: 'A peony' }],
  };

  it('accepts a published post and parses its date', () => {
    const parsed = logPostSchema.parse(post);
    expect(parsed.draft).toBe(false);
    expect(parsed.date.toISOString()).toBe('2026-09-28T00:00:00.000Z');
  });

  it('lets a draft have empty alt text and no photos', () => {
    expect(
      logPostSchema.safeParse({ ...post, draft: true, photos: [{ id: 'a', alt: '' }] }).success,
    ).toBe(true);
    expect(logPostSchema.safeParse({ ...post, draft: true, photos: [] }).success).toBe(true);
  });

  it('fails a published post with missing alt text, naming the photo', () => {
    const result = logPostSchema.safeParse({ ...post, photos: [{ id: 'DSCF2', alt: '  ' }] });
    expect(result.success).toBe(false);
    expect(JSON.stringify(result.error?.issues)).toContain('alt text is required for \\"DSCF2\\"');
  });

  it('fails a published post with no photos', () => {
    expect(logPostSchema.safeParse({ ...post, photos: [] }).success).toBe(false);
  });

  it('accepts camera overrides as numbers or strings, including empty strings', () => {
    const photo = {
      id: 'a',
      alt: 'x',
      lens: 'Helios 44-2',
      focal: 58,
      aperture: 2,
      iso: '',
      shutter: '1/250',
    };
    expect(logPostSchema.parse({ ...post, photos: [photo] }).photos[0]).toMatchObject(photo);
  });

  it('rejects zero or negative numeric overrides', () => {
    expect(
      logPostSchema.safeParse({ ...post, photos: [{ id: 'a', alt: 'x', focal: 0 }] }).success,
    ).toBe(false);
  });
});

describe('parseLogFile', () => {
  it('accepts generated data', () => {
    const file = {
      posts: {
        peonies: {
          photos: {
            DSCF1: {
              publicId: 'photo-log/peonies/DSCF1',
              width: 1086,
              height: 1448,
              uploadedAt: '2026-09-28T17:02:11Z',
              exif: { make: 'FUJIFILM', model: 'X-T3' },
            },
          },
        },
      },
    };
    expect(parseLogFile(file)).toEqual(file);
  });

  it('throws a readable error for invalid data', () => {
    expect(() => parseLogFile({ posts: { x: { photos: { a: { width: -1 } } } } })).toThrow(
      /photo-log.json is invalid/,
    );
  });
});
