import { describe, expect, it } from 'vitest';
import type { PhotoLogFile } from '../../src/lib/schema';
import {
  draftPost,
  parseFolderName,
  postDate,
  syncPhotoLog,
  updatePost,
  type RemoteLogPhoto,
} from './photo-log';

const photo = (name: string, extra: Partial<RemoteLogPhoto> = {}): RemoteLogPhoto => ({
  name,
  publicId: `photo-log/peonies/${name}`,
  width: 1086,
  height: 1448,
  uploadedAt: `2026-09-28T17:00:0${name.at(-1)}Z`,
  ...extra,
});

describe('parseFolderName', () => {
  it('uses the folder name as the slug and makes a sentence-case title', () => {
    expect(parseFolderName('back-garden')).toEqual({ slug: 'back-garden', title: 'Back garden' });
  });

  it('reads a date prefix', () => {
    expect(parseFolderName('2026-09-28-peonies')).toEqual({
      slug: '2026-09-28-peonies',
      title: 'Peonies',
      date: '2026-09-28',
    });
  });

  it('titles a folder named only by its date with that date', () => {
    expect(parseFolderName('2026-06-28')).toEqual({
      slug: '2026-06-28',
      title: 'June 28, 2026',
      date: '2026-06-28',
    });
  });

  it('ignores a prefix that is not a real date', () => {
    expect(parseFolderName('2026-13-40-peonies')).toEqual({
      slug: '2026-13-40-peonies',
      title: '2026 13 40 peonies',
    });
  });

  it('rejects names that are not slugs, or only digits', () => {
    expect(parseFolderName('Peonies')).toHaveProperty('error');
    expect(parseFolderName('my_walk')).toHaveProperty('error');
    expect(parseFolderName('2')).toHaveProperty('error');
  });
});

describe('postDate', () => {
  const folder = { slug: 'peonies', title: 'Peonies' };
  it('prefers the folder date, then the earliest capture date, then today', () => {
    expect(postDate({ ...folder, date: '2026-09-28' }, [], '2026-10-03')).toBe('2026-09-28');
    expect(
      postDate(
        folder,
        [
          { exif: { takenAt: '2026:09:27 08:00:00' } },
          { exif: { takenAt: '2026:09:25 19:00:00' } },
          {},
        ],
        '2026-10-03',
      ),
    ).toBe('2026-09-25');
    expect(postDate(folder, [{ exif: { takenAt: '0000:00:00 00:00:00' } }], '2026-10-03')).toBe(
      '2026-10-03',
    );
  });
});

describe('draftPost', () => {
  it('writes a draft with every photo and empty or pre-filled alt text', () => {
    const text = draftPost(
      { slug: 'peonies', title: 'Peonies', date: '2026-09-28' },
      [photo('DSCF1'), photo('DSCF2', { alt: 'Cloud alt', caption: 'Cloud caption' })],
      '2026-10-03',
    );
    expect(text).toBe(
      [
        '---',
        'title: Peonies',
        'date: 2026-09-28',
        'draft: true',
        'photos:',
        '  - id: DSCF1',
        '    alt: ""',
        '  - id: DSCF2',
        '    alt: Cloud alt',
        '    caption: Cloud caption',
        '---',
        '',
      ].join('\n'),
    );
  });

  it('long alt text stays on one line', () => {
    const alt =
      'A weathered pale-blue Little Free Library cabinet stuffed with books and yarn, its glass door hanging open';
    expect(draftPost({ slug: 'p', title: 'P' }, [photo('A1', { alt })], '2026-10-03')).toContain(
      `    alt: ${alt}\n`,
    );
  });
});

const edited = `---
title: Peonies, at last # renamed
date: 2026-09-30
photos:
  # the best one first
  - id: DSCF2
    alt: The second
    lens: Helios 44-2      # manual lens
  - id: DSCF1
    alt: The first
---
Fuji X-T3, an overcast morning.

---

A second section after a rule.
`;

describe('updatePost', () => {
  it('returns the text untouched when nothing changed', () => {
    const remote = [photo('DSCF1'), photo('DSCF2'), photo('DSCF3')];
    expect(updatePost(edited, 'peonies', new Set(['DSCF1', 'DSCF2', 'DSCF3']), remote)).toEqual({
      text: edited,
      added: [],
      removed: [],
    });
  });

  it("appends new photos and removes deleted ones, keeping David's edits and comments", () => {
    const remote = [photo('DSCF2'), photo('DSCF4', { alt: 'Cloud alt' })];
    const result = updatePost(edited, 'peonies', new Set(['DSCF1', 'DSCF2']), remote);
    expect(result.added).toEqual(['DSCF4']);
    expect(result.removed).toEqual(['DSCF1']);
    expect(result.text).toBe(`---
title: Peonies, at last # renamed
date: 2026-09-30
photos:
  # the best one first
  - id: DSCF2
    alt: The second
    lens: Helios 44-2 # manual lens
  - id: DSCF4
    alt: Cloud alt
---
Fuji X-T3, an overcast morning.

---

A second section after a rule.
`);
  });

  it('a photo David deleted from the post stays deleted', () => {
    const remote = [photo('DSCF1'), photo('DSCF2'), photo('DSCF3')];
    // DSCF3 was synced before (it's known), but David removed its line from the post.
    expect(
      updatePost(edited, 'peonies', new Set(['DSCF1', 'DSCF2', 'DSCF3']), remote).added,
    ).toEqual([]);
  });

  it('refuses a file without frontmatter', () => {
    expect(() => updatePost('Just text', 'peonies', new Set(), [])).toThrow(
      /peonies\.md has no frontmatter/,
    );
  });

  it('refuses a file with invalid YAML', () => {
    expect(() => updatePost('---\ntitle: [oops\n---\n', 'peonies', new Set(), [])).toThrow(
      /peonies\.md frontmatter is invalid YAML/,
    );
  });
});

describe('updatePost with a missing closing ---', () => {
  it('refuses frontmatter that swallowed body text, naming the unexpected key', () => {
    const text =
      '---\ntitle: Peonies\ndate: 2026-09-28\nphotos:\n  - id: A\n    alt: a\n\n## Morning\n\nLight: soft and grey.\n\n---\n\nA second section.\n';
    expect(() => updatePost(text, 'peonies', new Set(['A']), [photo('A'), photo('B')])).toThrow(
      /peonies\.md frontmatter has unexpected keys \(Light\).*closing ---/,
    );
  });

  it('refuses frontmatter that is not a map', () => {
    expect(() => updatePost('---\n- a\n---\n', 'peonies', new Set(), [])).toThrow(
      /peonies\.md frontmatter must be key: value lines/,
    );
  });
});

describe('syncPhotoLog', () => {
  const existing: PhotoLogFile = {
    posts: {
      peonies: {
        photos: {
          DSCF1: {
            publicId: 'photo-log/peonies/DSCF1',
            width: 1,
            height: 1,
            uploadedAt: '2026-09-28T17:00:01Z',
            exif: { make: 'FUJIFILM' },
          },
        },
      },
      gone: { photos: {} },
    },
  };
  const peoniesText =
    '---\ntitle: Peonies\ndate: 2026-09-28\nphotos:\n  - id: DSCF1\n    alt: x\n---\n';

  it('creates drafts for new folders, in upload order, and records image data', () => {
    const { file, writes, report } = syncPhotoLog(
      { posts: {} },
      [
        {
          slug: 'walk',
          title: 'Walk',
          photos: [
            photo('B2', { publicId: 'photo-log/walk/B2', uploadedAt: '2026-10-01T10:00:00Z' }),
            photo('A1', {
              publicId: 'photo-log/walk/A1',
              uploadedAt: '2026-10-01T09:00:00Z',
              exif: { iso: '200' },
            }),
          ],
        },
      ],
      new Map(),
      '2026-10-03',
    );
    expect(report.created).toEqual(['walk']);
    expect(writes.get('walk')).toMatch(/- id: A1\n {4}alt: ""\n {2}- id: B2/);
    expect(Object.keys(file.posts.walk.photos)).toEqual(['A1', 'B2']);
    expect(file.posts.walk.photos.A1).toEqual({
      publicId: 'photo-log/walk/A1',
      width: 1086,
      height: 1448,
      uploadedAt: '2026-10-01T09:00:00Z',
      exif: { iso: '200' },
    });
  });

  it('orders photos uploaded in the same second by capture time, then name', () => {
    const sameSecond = '2026-10-01T09:00:00Z';
    const { file, writes } = syncPhotoLog(
      { posts: {} },
      [
        {
          slug: 'walk',
          title: 'Walk',
          photos: [
            // Names sort A, B, C, D; capture times run the other way, and D has none (sorts first).
            photo('A1', { uploadedAt: sameSecond, exif: { takenAt: '2026:10:01 09:30:00' } }),
            photo('B2', { uploadedAt: sameSecond, exif: { takenAt: '2026:10:01 09:20:00' } }),
            photo('C3', { uploadedAt: sameSecond, exif: { takenAt: '2026:10:01 09:10:00' } }),
            photo('D4', { uploadedAt: sameSecond }),
          ],
        },
      ],
      new Map(),
      '2026-10-03',
    );
    expect(Object.keys(file.posts.walk.photos)).toEqual(['D4', 'C3', 'B2', 'A1']);
    expect(writes.get('walk')).toMatch(/- id: D4[\s\S]*- id: C3[\s\S]*- id: B2[\s\S]*- id: A1/);
  });

  it('uses stored capture time for known photos, which come without EXIF', () => {
    const sameSecond = '2026-09-28T17:00:00Z';
    const stored = (takenAt: string) => ({
      publicId: 'x',
      width: 1,
      height: 1,
      uploadedAt: sameSecond,
      exif: { takenAt },
    });
    const { file } = syncPhotoLog(
      { posts: { peonies: { photos: { A1: stored('2026:09:28 10:00:00') } } } },
      [
        {
          slug: 'peonies',
          title: 'Peonies',
          photos: [
            photo('A1', { uploadedAt: sameSecond }),
            photo('B2', { uploadedAt: sameSecond, exif: { takenAt: '2026:09:28 09:00:00' } }),
          ],
        },
      ],
      new Map(),
      '2026-10-03',
    );
    expect(Object.keys(file.posts.peonies.photos)).toEqual(['B2', 'A1']);
  });

  it('updates existing posts, keeping stored EXIF for photos it already knows', () => {
    const { file, writes, report } = syncPhotoLog(
      existing,
      [
        {
          slug: 'peonies',
          title: 'Peonies',
          photos: [photo('DSCF1'), photo('DSCF2', { exif: { iso: '400' } })],
        },
      ],
      new Map([['peonies', peoniesText]]),
      '2026-10-03',
    );
    expect(file.posts.peonies.photos.DSCF1.exif).toEqual({ make: 'FUJIFILM' });
    expect(file.posts.peonies.photos.DSCF2.exif).toEqual({ iso: '400' });
    expect(report.added).toEqual(['peonies/DSCF2']);
    expect(writes.get('peonies')).toContain('- id: DSCF2');
  });

  it('recreates a deleted post file as a draft', () => {
    const { writes, report } = syncPhotoLog(
      existing,
      [{ slug: 'peonies', title: 'Peonies', photos: [photo('DSCF1')] }],
      new Map(),
      '2026-10-03',
    );
    expect(report.created).toEqual(['peonies']);
    expect(writes.get('peonies')).toContain('draft: true');
  });

  it('keeps posts whose Cloudinary folder is gone, and reports them', () => {
    const { file, writes, report } = syncPhotoLog(
      existing,
      [],
      new Map([['peonies', peoniesText]]),
      '2026-10-03',
    );
    expect(file.posts.peonies).toEqual(existing.posts.peonies);
    expect(writes.size).toBe(0);
    expect(report.orphaned).toEqual(['peonies']);
  });

  it('forgets data for a post whose folder and file are both gone', () => {
    expect(syncPhotoLog(existing, [], new Map(), '2026-10-03').file).toEqual({ posts: {} });
  });

  it("doesn't create a draft for an empty folder", () => {
    const { file, writes } = syncPhotoLog(
      { posts: {} },
      [{ slug: 'empty', title: 'Empty', photos: [] }],
      new Map(),
      '2026-10-03',
    );
    expect(writes.size).toBe(0);
    expect(file.posts).toEqual({});
  });
});
