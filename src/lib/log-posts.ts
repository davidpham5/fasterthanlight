// Astro glue for the Photo Log: the content collection joined with photo-log.json. Invalid
// content throws, which fails the build.
import { getCollection, type CollectionEntry } from 'astro:content';
import logJson from '../content/photo-log.json';
import { site } from './content';
import { resolvePosts, type ResolvedPost } from './photo-log';
import { parseLogFile } from './schema';

export type Post = ResolvedPost<CollectionEntry<'photoLog'>>;

export const LOG_DESCRIPTION = `A log of everyday photographs by ${site.owner}, posted in batches.`;

/** Published posts, newest first. */
export async function publishedPosts(): Promise<Post[]> {
  return resolvePosts(await getCollection('photoLog'), parseLogFile(logJson));
}
