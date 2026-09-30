import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { expect, test } from '@playwright/test';

const DIST = 'dist';

function htmlFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return htmlFiles(path);
    return entry.name.endsWith('.html') ? [path] : [];
  });
}

// Netlify 301s `/about` to `/about/` when the page is built as about/index.html. A link must
// point straight at what Netlify serves: `/x` → dist/x.html, or `/x/` → dist/x/index.html.
test('internal links resolve without a trailing-slash redirect', () => {
  const hrefs = new Set<string>();
  for (const file of htmlFiles(DIST)) {
    for (const [, href] of readFileSync(file, 'utf8').matchAll(/href="(\/[^"#?]*)"/g)) {
      if (!href.startsWith('/_astro/') && !/\.[a-z0-9]+$/i.test(href)) hrefs.add(href);
    }
  }
  const redirecting = [...hrefs].filter((href) => {
    if (href === '/') return false;
    return href.endsWith('/')
      ? !existsSync(join(DIST, href, 'index.html'))
      : !existsSync(join(DIST, `${href}.html`));
  });
  expect(hrefs.size).toBeGreaterThan(3);
  expect(redirecting).toEqual([]);
});
