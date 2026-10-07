import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { parse } from 'yaml';

export interface SeedPhoto {
  id: string;
  width: number;
  height: number;
  alt: string;
  caption?: string;
}
export interface SeedSet {
  slug: string;
  title: string;
  photos: SeedPhoto[];
}

const read = <T>(path: string): T =>
  JSON.parse(readFileSync(new URL(path, import.meta.url), 'utf8')) as T;

export const photos = read<{ sets: SeedSet[]; extras: Record<string, Omit<SeedPhoto, 'id'>> }>(
  '../src/content/photos.json',
);
export const site = read<{
  name: string;
  owner: string;
  tagline: string;
  email: string;
  cloudName: string;
  heroId: string;
  portraitId: string;
}>('../src/content/site.json');

export const firstSet = photos.sets[0];
export const setWith = (pred: (set: SeedSet) => boolean): SeedSet | undefined =>
  photos.sets.find(pred);

export interface SeedLogPost {
  slug: string;
  title: string;
  date: string;
  photos: { name: string; publicId: string; alt: string }[];
}

const LOG_DIR = new URL('../src/content/photo-log/', import.meta.url);
const logFile = read<{ posts: Record<string, { photos: Record<string, { publicId: string }> }> }>(
  '../src/content/photo-log.json',
);

/** Published Photo Log posts, newest first, read the same way the site reads them. */
export const logPosts: SeedLogPost[] = (existsSync(LOG_DIR) ? readdirSync(LOG_DIR) : [])
  .filter((name) => name.endsWith('.md'))
  .map((name) => {
    const slug = name.slice(0, -3);
    const text = readFileSync(new URL(name, LOG_DIR), 'utf8');
    const data = parse(/^---\n([\s\S]*?)\n---/.exec(text)![1]);
    return { slug, data };
  })
  .filter(({ data }) => !data.draft)
  .map(({ slug, data }) => ({
    slug,
    title: String(data.title),
    date: String(data.date).slice(0, 10),
    photos: (data.photos as { id: unknown; alt: string }[]).map((p) => ({
      name: String(p.id),
      publicId: logFile.posts[slug].photos[String(p.id)].publicId,
      alt: p.alt.trim(),
    })),
  }))
  .sort((a, b) => b.date.localeCompare(a.date) || a.slug.localeCompare(b.slug));
