import rss from '@astrojs/rss';
import type { APIContext } from 'astro';
import { site } from '../../lib/content';
import { LOG_DESCRIPTION, publishedPosts } from '../../lib/log-posts';
import { excerpt, rssContent } from '../../lib/photo-log';

export async function GET(context: APIContext) {
  const origin = context.site!;
  const posts = await publishedPosts();
  return rss({
    title: `Photo Log — ${site.name}`,
    description: LOG_DESCRIPTION,
    site: origin,
    items: posts.map((post) => {
      const html = post.entry.rendered?.html ?? '';
      return {
        title: post.title,
        pubDate: post.date,
        link: `/photo-log/${post.slug}`,
        description: excerpt(html, post.title),
        content: rssContent(post, html, origin),
      };
    }),
    customData: '<language>en</language>',
    // Site pages are slash-less (build.format 'file'), so links must match.
    trailingSlash: false,
  });
}
