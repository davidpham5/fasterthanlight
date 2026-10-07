import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
import { logPostSchema } from './lib/schema';

export const collections = {
  photoLog: defineCollection({
    loader: glob({ pattern: '*.md', base: './src/content/photo-log' }),
    schema: logPostSchema,
  }),
};
