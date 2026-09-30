import { writeFile } from 'node:fs/promises';
import sitemap from '@astrojs/sitemap';
import { defineConfig } from 'astro/config';
import photos from './src/content/photos.json' with { type: 'json' };

const firstSet = photos.sets[0].slug;

/** Writes dist/_redirects so Netlify serves /gallery as a real 301 (Astro emits a meta refresh). */
function netlifyRedirects() {
  return {
    name: 'netlify-redirects',
    hooks: {
      'astro:build:done': async ({ dir }) => {
        const rules = [`/gallery /gallery/${firstSet} 301`, `/gallery/ /gallery/${firstSet} 301`];
        await writeFile(new URL('_redirects', dir), `${rules.join('\n')}\n`);
      },
    },
  };
}

export default defineConfig({
  site: 'https://fasterthanlight.studio',
  output: 'static',
  // Emit scripts as files (never inline) so the CSP can use script-src 'self'.
  vite: { build: { assetsInlineLimit: 0 } },
  redirects: { '/gallery': `/gallery/${firstSet}` },
  integrations: [
    sitemap({ filter: (page) => !/\/(thanks|gallery)\/?$/.test(page) }),
    netlifyRedirects(),
  ],
});
