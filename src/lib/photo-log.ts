// Joins Photo Log post files with the generated photo-log.json. Pure, so it's testable without
// Astro; src/lib/log-posts.ts feeds it the content collection.
import { urlFor } from './cloudinary';
import { cameraLine } from './exif';
import { ContentError, type LogPost, type Photo, type PhotoLogFile } from './schema';

export const POSTS_PER_PAGE = 5;

export interface LogEntry {
  id: string;
  data: LogPost;
}

export interface ResolvedPhoto extends Photo {
  /** The photo's name within its post folder, as written in the post file. */
  name: string;
  camera: string;
}

export interface ResolvedPost<E extends LogEntry = LogEntry> {
  slug: string;
  title: string;
  date: Date;
  photos: ResolvedPhoto[];
  entry: E;
}

export function resolvePosts<E extends LogEntry>(
  entries: E[],
  file: PhotoLogFile,
): ResolvedPost<E>[] {
  return entries
    .filter((entry) => !entry.data.draft)
    .map((entry) => {
      const images = file.posts[entry.id]?.photos ?? {};
      const photos = entry.data.photos.map(({ id: name, alt, caption, ...overrides }) => {
        const image = images[name];
        if (!image) {
          throw new ContentError(
            `Photo Log post "${entry.id}" lists photo "${name}", which isn't in photo-log.json. ` +
              'Run npm run sync-photos, or fix the id in the post file.',
          );
        }
        const photo: ResolvedPhoto = {
          id: image.publicId,
          name,
          width: image.width,
          height: image.height,
          alt: alt.trim(),
          camera: cameraLine(image.exif, overrides),
        };
        if (caption?.trim()) photo.caption = caption.trim();
        if (image.placeholder) photo.placeholder = image.placeholder;
        return photo;
      });
      return { slug: entry.id, title: entry.data.title, date: entry.data.date, photos, entry };
    })
    .sort((a, b) => b.date.getTime() - a.date.getTime() || a.slug.localeCompare(b.slug));
}

/** Posts are newest first, so the newer post comes before this one in the list. */
export function neighbours<P extends { slug: string }>(
  posts: P[],
  slug: string,
): { newer?: P; older?: P } {
  const i = posts.findIndex((post) => post.slug === slug);
  if (i === -1) return {};
  return { newer: posts[i - 1], older: posts[i + 1] };
}

/** Post dates are calendar days (parsed as UTC midnight), so format in UTC. */
export function formatDate(date: Date): string {
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    timeZone: 'UTC',
  });
}

export function isoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

const ENTITIES: Record<string, string> = {
  '&amp;': '&',
  '&lt;': '<',
  '&gt;': '>',
  '&quot;': '"',
  '&#39;': "'",
  '&#x27;': "'",
  '&nbsp;': ' ',
};

/** The first paragraph of rendered Markdown as plain text, for descriptions and previews. */
export function excerpt(html: string, fallback: string): string {
  const first = /<p>([\s\S]*?)<\/p>/.exec(html)?.[1] ?? '';
  const text = first
    .replace(/<[^>]+>/g, '')
    .replace(/&(?:amp|lt|gt|quot|#39|#x27|nbsp);/g, (entity) => ENTITIES[entity])
    .replace(/\s+/g, ' ')
    .trim();
  return text || fallback;
}

export function escapeHtml(text: string): string {
  return text
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

/** RSS item HTML: the post's text, then each photo at 1600px with its camera line and caption. */
export function rssContent(post: ResolvedPost, bodyHtml: string, origin: string | URL): string {
  const figures = post.photos.map((photo) => {
    const src = new URL(urlFor(photo.id, 1600), origin).href;
    const lines = [photo.camera, photo.caption].filter(Boolean).map((line) => escapeHtml(line!));
    const caption = lines.length ? `<figcaption>${lines.join('<br />')}</figcaption>` : '';
    return `<figure><img src="${escapeHtml(src)}" alt="${escapeHtml(photo.alt)}" />${caption}</figure>`;
  });
  return bodyHtml + figures.join('');
}
