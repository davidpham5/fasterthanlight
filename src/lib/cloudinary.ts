// The only Cloudinary-specific module. To move images to another host, replace this file.
export type Width = 400 | 800 | 1600 | 2560;
export const WIDTHS: readonly Width[] = [400, 800, 1600, 2560];

const BASE = 'https://res.cloudinary.com';

function encodeId(id: string): string {
  return id.split('/').map(encodeURIComponent).join('/');
}

export function urlFor(cloud: string, id: string, width: Width): string {
  return `${BASE}/${cloud}/image/upload/f_auto,q_auto,c_limit,w_${width}/${encodeId(id)}`;
}

/**
 * Widths to request for an original. c_limit never upscales, so the first width at or above
 * the original is described by the original's real width.
 */
export function srcsetEntries(originalWidth: number): { width: Width; descriptor: number }[] {
  const entries: { width: Width; descriptor: number }[] = [];
  for (const width of WIDTHS) {
    if (width < originalWidth) {
      entries.push({ width, descriptor: width });
    } else {
      entries.push({ width, descriptor: originalWidth });
      break;
    }
  }
  return entries;
}

export function srcsetFor(cloud: string, photo: { id: string; width: number }): string {
  return srcsetEntries(photo.width)
    .map(({ width, descriptor }) => `${urlFor(cloud, photo.id, width)} ${descriptor}w`)
    .join(', ');
}

export function defaultWidth(originalWidth: number): Width {
  const entries = srcsetEntries(originalWidth);
  return entries.find((e) => e.width === 1600)?.width ?? entries[entries.length - 1].width;
}
