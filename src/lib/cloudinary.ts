// The only Cloudinary-specific module. To move images to another host, replace this file.
export type Width = 400 | 800 | 1600 | 2560;
export const WIDTHS: readonly Width[] = [400, 800, 1600, 2560];

/** Delivered images never exceed this on their long edge (spec §5). */
const MAX_EDGE = 2560;
const BASE = 'https://res.cloudinary.com';

function encodeId(id: string): string {
  return id.split('/').map(encodeURIComponent).join('/');
}

/** The four allowed transformations. Only the largest also needs a height limit. */
function transformation(width: Width): string {
  const limit = width === MAX_EDGE ? `w_${width},h_${MAX_EDGE}` : `w_${width}`;
  return `f_auto,q_auto,c_limit,${limit}`;
}

export function urlFor(cloud: string, id: string, width: Width): string {
  return `${BASE}/${cloud}/image/upload/${transformation(width)}/${encodeId(id)}`;
}

/** Width Cloudinary actually delivers: c_limit never upscales and keeps the aspect ratio. */
function deliveredWidth(width: Width, originalWidth: number, originalHeight: number): number {
  const heightLimit = width === MAX_EDGE ? MAX_EDGE / originalHeight : 1;
  const scale = Math.min(1, width / originalWidth, heightLimit);
  return Math.round(originalWidth * scale);
}

/**
 * Widths to request for an original, each described by the width actually delivered. Stops once
 * the original is exhausted or a larger request would not deliver a wider image.
 */
export function srcsetEntries(
  originalWidth: number,
  originalHeight: number = originalWidth,
): { width: Width; descriptor: number }[] {
  const entries: { width: Width; descriptor: number }[] = [];
  for (const width of WIDTHS) {
    const descriptor = deliveredWidth(width, originalWidth, originalHeight);
    const previous = entries[entries.length - 1];
    if (previous && descriptor <= previous.descriptor) break;
    entries.push({ width, descriptor });
    if (descriptor < width) break;
  }
  return entries;
}

export function srcsetFor(
  cloud: string,
  photo: { id: string; width: number; height?: number },
): string {
  return srcsetEntries(photo.width, photo.height)
    .map(({ width, descriptor }) => `${urlFor(cloud, photo.id, width)} ${descriptor}w`)
    .join(', ');
}

export function defaultWidth(originalWidth: number): Width {
  const entries = srcsetEntries(originalWidth);
  return entries.find((e) => e.width === 1600)?.width ?? entries[entries.length - 1].width;
}
