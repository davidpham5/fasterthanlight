import type { RawExif } from '../../src/lib/schema';

/** RawExif field → Cloudinary image_metadata tag. Only these are kept (no serial numbers). */
const TAGS: Record<keyof RawExif, string> = {
  make: 'Make',
  model: 'Model',
  lens: 'LensModel',
  focal: 'FocalLength',
  aperture: 'FNumber',
  shutter: 'ExposureTime',
  iso: 'ISO',
  takenAt: 'DateTimeOriginal',
};

export function pickExif(meta: Record<string, string>): RawExif {
  const exif: RawExif = {};
  for (const [field, tag] of Object.entries(TAGS) as [keyof RawExif, string][]) {
    const value = meta[tag]?.trim();
    if (value) exif[field] = value;
  }
  return exif;
}
