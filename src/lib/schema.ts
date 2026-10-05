import { z } from 'astro/zod';

const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

const photoFields = {
  width: z.number().int().positive(),
  height: z.number().int().positive(),
  alt: z.string().trim().min(1, 'alt text is required'),
  caption: z.string().trim().min(1).optional(),
  placeholder: z.string().startsWith('data:image/').optional(),
};

export const photoSchema = z.object({ id: z.string().min(1), ...photoFields });

export const setSchema = z.object({
  slug: z.string().regex(SLUG, 'slug must be lowercase words joined by hyphens'),
  title: z.string().trim().min(1),
  photos: z.array(photoSchema).min(1, 'a set needs at least one photo'),
});

export const photosFileSchema = z
  .object({
    sets: z.array(setSchema).min(1, 'at least one set is required'),
    extras: z.record(z.string(), z.object(photoFields)),
  })
  .superRefine((data, ctx) => {
    const seen = new Set<string>();
    for (const set of data.sets) {
      if (seen.has(set.slug)) {
        ctx.addIssue({
          code: 'custom',
          message: `duplicate set slug "${set.slug}"`,
          path: ['sets'],
        });
      }
      seen.add(set.slug);
    }
  });

export const siteSchema = z.object({
  name: z.string().min(1),
  owner: z.string().min(1),
  tagline: z.string().min(1),
  description: z.string().min(1),
  email: z.email(),
  cloudName: z.string().regex(/^[a-z0-9_-]+$/i),
  heroId: z.string().min(1),
  portraitId: z.string().min(1),
});

/** A camera-line override: a number gets its unit, a string is shown as written, '' hides it. */
const override = z.union([z.string(), z.number().positive()]).optional();

export const logPhotoSchema = z.object({
  id: z.coerce.string().min(1),
  alt: z.string().default(''),
  caption: z.string().trim().optional(),
  camera: override,
  lens: override,
  focal: override,
  aperture: override,
  shutter: override,
  iso: override,
});

/** One Photo Log post file. Drafts may be incomplete; published posts must be complete. */
export const logPostSchema = z
  .object({
    title: z.string().trim().min(1),
    date: z.coerce.date(),
    draft: z.boolean().default(false),
    photos: z.array(logPhotoSchema).default([]),
  })
  .superRefine((post, ctx) => {
    if (post.draft) return;
    if (post.photos.length === 0) {
      ctx.addIssue({ code: 'custom', path: ['photos'], message: 'a published post needs photos' });
    }
    post.photos.forEach((photo, i) => {
      if (photo.alt.trim()) return;
      ctx.addIssue({
        code: 'custom',
        path: ['photos', i, 'alt'],
        message: `alt text is required for "${photo.id}" (or keep the post as a draft)`,
      });
    });
  });

export const rawExifSchema = z.object({
  make: z.string().optional(),
  model: z.string().optional(),
  lens: z.string().optional(),
  focal: z.string().optional(),
  aperture: z.string().optional(),
  shutter: z.string().optional(),
  iso: z.string().optional(),
  takenAt: z.string().optional(),
});

export const logImageSchema = z.object({
  publicId: z.string().min(1),
  width: z.number().int().positive(),
  height: z.number().int().positive(),
  placeholder: z.string().startsWith('data:image/').optional(),
  uploadedAt: z.string(),
  exif: rawExifSchema,
});

/** src/content/photo-log.json, written by the sync: post slug → photo name → image data. */
export const photoLogFileSchema = z.object({
  posts: z.record(z.string(), z.object({ photos: z.record(z.string(), logImageSchema) })),
});

export type Photo = z.infer<typeof photoSchema>;
export type PhotoSet = z.infer<typeof setSchema>;
export type PhotosFile = z.infer<typeof photosFileSchema>;
export type Site = z.infer<typeof siteSchema>;
export type LogPhoto = z.infer<typeof logPhotoSchema>;
export type LogPost = z.infer<typeof logPostSchema>;
export type RawExif = z.infer<typeof rawExifSchema>;
export type LogImage = z.infer<typeof logImageSchema>;
export type PhotoLogFile = z.infer<typeof photoLogFileSchema>;

export interface Content {
  site: Site;
  sets: PhotoSet[];
  hero: Photo;
  portrait: Photo;
}

export class ContentError extends Error {}

export function loadContent(siteRaw: unknown, photosRaw: unknown): Content {
  const siteResult = siteSchema.safeParse(siteRaw);
  if (!siteResult.success) {
    throw new ContentError(`site.json is invalid:\n${z.prettifyError(siteResult.error)}`);
  }
  const photosResult = photosFileSchema.safeParse(photosRaw);
  if (!photosResult.success) {
    throw new ContentError(`photos.json is invalid:\n${z.prettifyError(photosResult.error)}`);
  }

  const site = siteResult.data;
  const { sets, extras } = photosResult.data;

  // The hero and portrait may be an extra (not shown in any gallery) or any gallery photo.
  const extra = (key: 'heroId' | 'portraitId'): Photo => {
    const id = site[key];
    const fromExtras = extras[id];
    if (fromExtras) return { id, ...fromExtras };
    const fromSets = sets.flatMap((set) => set.photos).find((photo) => photo.id === id);
    if (fromSets) return fromSets;
    throw new ContentError(
      `site.json ${key} "${id}" is not a photo in photos.json (neither an extra nor in any set)`,
    );
  };

  return { site, sets, hero: extra('heroId'), portrait: extra('portraitId') };
}

export function parseLogFile(raw: unknown): PhotoLogFile {
  const result = photoLogFileSchema.safeParse(raw);
  if (!result.success) {
    throw new ContentError(`photo-log.json is invalid:\n${z.prettifyError(result.error)}`);
  }
  return result.data;
}
