import { describe, expect, it } from 'vitest';
import { loadContent } from './schema';

const site = {
  name: 'FasterThanLight Studios',
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

  it('rejects a heroId that is missing from extras', () => {
    expect(() => loadContent({ ...site, heroId: 'nope' }, photos)).toThrow(
      /heroId "nope" is not listed under "extras"/,
    );
  });

  it('rejects an invalid email in site.json', () => {
    expect(() => loadContent({ ...site, email: 'not-an-email' }, photos)).toThrow(
      /site\.json is invalid/,
    );
  });
});
