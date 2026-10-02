import { writeFile } from 'node:fs/promises';
import sitemap from '@astrojs/sitemap';
import { defineConfig } from 'astro/config';
import photos from './src/content/photos.json' with { type: 'json' };
import site from './src/content/site.json' with { type: 'json' };
import { IMAGE_PATH, imageProxyRules, originFor } from './src/lib/cloudinary.ts';

const firstSet = photos.sets[0].slug;
const imageOrigin = originFor(site.cloudName);

/** Serves /img/* from Cloudinary in `astro dev` and `astro preview`, as Netlify does in production. */
const imageProxy = {
  [IMAGE_PATH]: {
    target: imageOrigin,
    changeOrigin: true,
    rewrite: (path) => path.slice(IMAGE_PATH.length),
  },
};

/** Writes dist/_redirects so Netlify serves /gallery as a real 301. Forced (301!) because Astro
 * also emits dist/gallery/index.html (a meta refresh), which would otherwise shadow the rule.
 * Also proxies the site's image sizes under /img to Cloudinary (200 = rewrite, so the URL stays on
 * our domain). */
function netlifyRedirects() {
  return {
    name: 'netlify-redirects',
    hooks: {
      'astro:build:done': async ({ dir }) => {
        const rules = [
          `/gallery /gallery/${firstSet} 301!`,
          `/gallery/ /gallery/${firstSet} 301!`,
          ...imageProxyRules(site.cloudName),
        ];
        await writeFile(new URL('_redirects', dir), `${rules.join('\n')}\n`);
      },
    },
  };
}

export default defineConfig({
  site: 'https://fasterthanlight.studio',
  output: 'static',
  // One file per page (about.html, not about/index.html): Netlify serves /about directly instead
  // of 301-redirecting every internal link to /about/.
  build: { format: 'file' },
  // Emit scripts as files (never inline) so the CSP can use script-src 'self'.
  vite: {
    build: { assetsInlineLimit: 0 },
    server: { proxy: imageProxy },
    preview: { proxy: imageProxy },
  },
  redirects: { '/gallery': `/gallery/${firstSet}` },
  integrations: [
    sitemap({ filter: (page) => !/\/(thanks|gallery)\/?$/.test(page) }),
    netlifyRedirects(),
  ],
});
