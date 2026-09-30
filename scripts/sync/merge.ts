import type { Photo, PhotosFile } from '../../src/lib/schema';

export interface RemotePhoto {
  id: string;
  width: number;
  height: number;
  alt?: string;
  caption?: string;
  placeholder?: string;
}

export interface RemoteSet {
  slug: string;
  photos: RemotePhoto[];
}

export interface MergeReport {
  added: string[];
  removed: string[];
  missingAlt: string[];
  newSets: string[];
  removedSets: string[];
}

const clean = (value?: string): string | undefined => value?.trim() || undefined;

export function titleFromSlug(slug: string): string {
  return slug
    .split('-')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

/** Hand-edited alt/caption win over Cloudinary metadata; dimensions/placeholder come from Cloudinary. */
function mergePhoto(remote: RemotePhoto, local?: { alt?: string; caption?: string }): Photo {
  const photo: Photo = {
    id: remote.id,
    width: remote.width,
    height: remote.height,
    alt: clean(local?.alt) ?? clean(remote.alt) ?? '',
  };
  const caption = clean(local?.caption) ?? clean(remote.caption);
  if (caption) photo.caption = caption;
  if (remote.placeholder) photo.placeholder = remote.placeholder;
  return photo;
}

export function mergePhotos(
  existing: PhotosFile,
  remoteSets: RemoteSet[],
  remoteExtras: RemotePhoto[],
): { data: PhotosFile; report: MergeReport } {
  const report: MergeReport = {
    added: [],
    removed: [],
    missingAlt: [],
    newSets: [],
    removedSets: [],
  };
  const remoteBySlug = new Map(remoteSets.map((set) => [set.slug, set]));
  const sets: PhotosFile['sets'] = [];

  for (const local of existing.sets) {
    const remote = remoteBySlug.get(local.slug);
    if (!remote) {
      report.removedSets.push(local.slug);
      report.removed.push(...local.photos.map((p) => p.id));
      continue;
    }
    const remoteById = new Map(remote.photos.map((p) => [p.id, p]));
    const kept: Photo[] = [];
    for (const photo of local.photos) {
      const match = remoteById.get(photo.id);
      if (match) kept.push(mergePhoto(match, photo));
      else report.removed.push(photo.id);
    }
    const localIds = new Set(local.photos.map((p) => p.id));
    const added = remote.photos.filter((p) => !localIds.has(p.id)).map((p) => mergePhoto(p));
    report.added.push(...added.map((p) => p.id));

    const photos = [...kept, ...added];
    if (photos.length > 0) sets.push({ slug: local.slug, title: local.title, photos });
    else report.removedSets.push(local.slug);
  }

  const localSlugs = new Set(existing.sets.map((set) => set.slug));
  for (const remote of remoteSets) {
    if (localSlugs.has(remote.slug) || remote.photos.length === 0) continue;
    const photos = remote.photos.map((p) => mergePhoto(p));
    report.newSets.push(remote.slug);
    report.added.push(...photos.map((p) => p.id));
    sets.push({ slug: remote.slug, title: titleFromSlug(remote.slug), photos });
  }

  const extras: PhotosFile['extras'] = {};
  for (const remote of remoteExtras) {
    const { id, ...rest } = mergePhoto(remote, existing.extras[remote.id]);
    extras[id] = rest;
  }

  for (const set of sets) for (const p of set.photos) if (!p.alt) report.missingAlt.push(p.id);
  for (const [id, extra] of Object.entries(extras)) if (!extra.alt) report.missingAlt.push(id);

  return { data: { sets, extras }, report };
}

/**
 * Reasons to refuse writing a sync result. An empty or mostly-emptied photos.json almost always
 * means Cloudinary was listed wrongly (wrong folder, wrong account), not that photos were deleted.
 */
export function syncProblems(before: PhotosFile, after: PhotosFile, report: MergeReport): string[] {
  const problems: string[] = [];
  if (after.sets.length === 0) {
    problems.push('Cloudinary returned no photos under portfolio/ — photos.json would be emptied.');
    return problems;
  }
  const total = before.sets.reduce((sum, set) => sum + set.photos.length, 0);
  if (total > 0 && report.removed.length > total / 2) {
    problems.push(`This sync would remove ${report.removed.length} of ${total} photos.`);
  }
  return problems;
}
