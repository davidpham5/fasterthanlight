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

export type Photo = z.infer<typeof photoSchema>;
export type PhotoSet = z.infer<typeof setSchema>;
export type PhotosFile = z.infer<typeof photosFileSchema>;
export type Site = z.infer<typeof siteSchema>;

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

  const extra = (key: 'heroId' | 'portraitId'): Photo => {
    const id = site[key];
    const found = extras[id];
    if (!found) {
      throw new ContentError(
        `site.json ${key} "${id}" is not listed under "extras" in photos.json`,
      );
    }
    return { id, ...found };
  };

  return { site, sets, hero: extra('heroId'), portrait: extra('portraitId') };
}
