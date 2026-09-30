import { readFileSync } from 'node:fs';

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
