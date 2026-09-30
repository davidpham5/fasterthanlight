/**
 * The public URL path for a page. Pages are built as files (about.html), so during the build
 * Astro.url.pathname is `/about.html`; Netlify serves it as `/about`.
 */
export function pagePath(pathname: string): string {
  const path = pathname
    .replace(/\.html$/, '')
    .replace(/\/index$/, '/')
    .replace(/(.)\/$/, '$1');
  return path === '' ? '/' : path;
}
