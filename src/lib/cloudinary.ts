// The only Cloudinary-specific module. To move images to another host, replace this file.
// Images are requested from /img on our own domain, which Netlify (and the dev/preview server)
// proxies to Cloudinary, so robots.txt and the no-AI headers cover the image files too.
export type Width = 400 | 800 | 1600 | 2560;
export const WIDTHS: readonly Width[] = [400, 800, 1600, 2560];

/** Delivered images never exceed this on their long edge (spec §5). */
const MAX_EDGE: Width = 2560;
/** Same-origin path that proxies to {@link originFor}. */
export const IMAGE_PATH = '/img';

/** Where IMAGE_PATH points: our account's upload base, so no other cloud can be fetched. */
export function originFor(cloud: string): string {
  return `https://res.cloudinary.com/${cloud}/image/upload`;
}

function encodeId(id: string): string {
  return id.split('/').map(encodeURIComponent).join('/');
}

/** The four allowed transformations. Only the largest also needs a height limit. */
function transformation(width: Width): string {
  const limit = width === MAX_EDGE ? `w_${width},h_${MAX_EDGE}` : `w_${width}`;
  return `f_auto,q_auto,c_limit,${limit}`;
}

/**
 * Netlify _redirects rules: one rewrite per transformation, so /img can't fetch originals (which
 * keep their camera metadata) or any other transformation.
 */
export function imageProxyRules(cloud: string): string[] {
  return WIDTHS.map((width) => {
    const t = transformation(width);
    return `${IMAGE_PATH}/${t}/* ${originFor(cloud)}/${t}/:splat 200!`;
  });
}

export function urlFor(id: string, width: Width): string {
  return `${IMAGE_PATH}/${transformation(width)}/${encodeId(id)}`;
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
  maxWidth: Width = MAX_EDGE,
): { width: Width; descriptor: number }[] {
  const entries: { width: Width; descriptor: number }[] = [];
  for (const width of WIDTHS) {
    if (width > maxWidth) break;
    const descriptor = deliveredWidth(width, originalWidth, originalHeight);
    const previous = entries[entries.length - 1];
    if (previous && descriptor <= previous.descriptor) break;
    entries.push({ width, descriptor });
    if (descriptor < width) break;
  }
  return entries;
}

export function srcsetFor(
  photo: { id: string; width: number; height?: number },
  maxWidth: Width = MAX_EDGE,
): string {
  return srcsetEntries(photo.width, photo.height, maxWidth)
    .map(({ width, descriptor }) => `${urlFor(photo.id, width)} ${descriptor}w`)
    .join(', ');
}

export function defaultWidth(originalWidth: number, maxWidth: Width = MAX_EDGE): Width {
  const entries = srcsetEntries(originalWidth, originalWidth, maxWidth);
  return entries.find((e) => e.width === 1600)?.width ?? entries[entries.length - 1].width;
}
