import { describe, expect, it } from 'vitest';
import type { PhotosFile } from '../../src/lib/schema';
import { mergePhotos, syncProblems, titleFromSlug, type RemoteSet } from './merge';

const existing: PhotosFile = {
  sets: [
    {
      slug: 'conferences',
      title: 'Conferences & Keynotes',
      photos: [
        { id: 'c2', width: 100, height: 100, alt: 'Local alt two', caption: 'Local caption' },
        { id: 'c1', width: 100, height: 100, alt: 'Local alt one' },
      ],
    },
    { slug: 'retired', title: 'Retired', photos: [{ id: 'r1', width: 1, height: 1, alt: 'Old' }] },
  ],
  extras: { hero: { width: 1, height: 1, alt: 'Hand-written hero alt' } },
};

const remoteSets: RemoteSet[] = [
  {
    slug: 'conferences',
    photos: [
      {
        id: 'c1',
        width: 3000,
        height: 2000,
        alt: 'Cloud alt one',
        placeholder: 'data:image/jpeg;base64,AA',
      },
      { id: 'c2', width: 3000, height: 2000 },
      { id: 'c3', width: 2000, height: 3000, alt: 'Cloud alt three', caption: 'Cloud caption' },
    ],
  },
  { slug: 'product-launches', photos: [{ id: 'p1', width: 10, height: 10 }] },
];

describe('titleFromSlug', () => {
  it('title-cases hyphenated slugs', () => {
    expect(titleFromSlug('product-launches')).toBe('Product Launches');
  });
});

describe('mergePhotos', () => {
  const { data, report } = mergePhotos(existing, remoteSets, [
    { id: 'hero', width: 3000, height: 2000, alt: 'Cloud hero alt' },
  ]);
  const conferences = data.sets.find((s) => s.slug === 'conferences')!;

  it('keeps hand-edited order, alt text, captions and set titles', () => {
    expect(conferences.title).toBe('Conferences & Keynotes');
    expect(conferences.photos.map((p) => p.id).slice(0, 2)).toEqual(['c2', 'c1']);
    expect(conferences.photos[0]).toMatchObject({ alt: 'Local alt two', caption: 'Local caption' });
    expect(conferences.photos[1].alt).toBe('Local alt one');
  });

  it('refreshes dimensions and placeholders from Cloudinary', () => {
    expect(conferences.photos[1]).toMatchObject({
      width: 3000,
      height: 2000,
      placeholder: 'data:image/jpeg;base64,AA',
    });
  });

  it('appends new photos at the end of their set, using Cloudinary metadata', () => {
    expect(conferences.photos[2]).toEqual({
      id: 'c3',
      width: 2000,
      height: 3000,
      alt: 'Cloud alt three',
      caption: 'Cloud caption',
    });
    expect(report.added).toContain('c3');
  });

  it('adds new folders as new sets titled from their slug', () => {
    const launches = data.sets.find((s) => s.slug === 'product-launches')!;
    expect(launches.title).toBe('Product Launches');
    expect(report.newSets).toEqual(['product-launches']);
  });

  it('drops sets and photos that no longer exist in Cloudinary', () => {
    expect(data.sets.map((s) => s.slug)).toEqual(['conferences', 'product-launches']);
    expect(report.removedSets).toEqual(['retired']);
    expect(report.removed).toEqual(['r1']);
  });

  it('reports photos that still have no alt text', () => {
    expect(report.missingAlt).toEqual(['p1']);
    expect(data.sets[1].photos[0].alt).toBe('');
  });

  it('merges extras by id and keeps hand-written alt text', () => {
    expect(data.extras).toEqual({
      hero: { width: 3000, height: 2000, alt: 'Hand-written hero alt' },
    });
  });

  it('removes a photo deleted in Cloudinary and reports it', () => {
    const result = mergePhotos(
      existing,
      [{ slug: 'conferences', photos: [remoteSets[0].photos[0]] }],
      [],
    );
    expect(result.data.sets[0].photos.map((p) => p.id)).toEqual(['c1']);
    expect(result.report.removed).toEqual(['c2', 'r1']);
  });
});

describe('syncProblems', () => {
  const photo = (id: string) => ({ id, width: 10, height: 10, alt: `Alt ${id}` });
  const before: PhotosFile = {
    sets: [{ slug: 'a', title: 'A', photos: ['1', '2', '3', '4'].map(photo) }],
    extras: {},
  };

  it('allows a normal sync', () => {
    const { data, report } = mergePhotos(
      before,
      [{ slug: 'a', photos: ['1', '2', '3', '5'].map(photo) }],
      [],
    );
    expect(syncProblems(before, data, report)).toEqual([]);
  });

  it('refuses to write when Cloudinary returned no photos', () => {
    const { data, report } = mergePhotos(before, [], []);
    expect(syncProblems(before, data, report)).toEqual([
      'Cloudinary returned no photos under portfolio/ — photos.json would be emptied.',
    ]);
  });

  it('refuses to write when more than half the photos would be removed', () => {
    const { data, report } = mergePhotos(before, [{ slug: 'a', photos: [photo('1')] }], []);
    expect(syncProblems(before, data, report)).toEqual(['This sync would remove 3 of 4 photos.']);
  });
});
