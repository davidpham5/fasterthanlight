// Fails if any built page exceeds its gzipped JS/CSS budget. Run after `npm run build`.
import { readFile, readdir } from 'node:fs/promises';
import { dirname, join, relative } from 'node:path';
import { gzipSync } from 'node:zlib';

const DIST = 'dist';
const KB = 1024;
const CSS_LIMIT = 15 * KB;
const GALLERY_JS_LIMIT = 10 * KB;

async function htmlFiles(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  const nested = await Promise.all(
    entries.map((e) => {
      const path = join(dir, e.name);
      if (e.isDirectory()) return htmlFiles(path);
      return e.name.endsWith('.html') ? [path] : [];
    }),
  );
  return nested.flat();
}

const gz = (text) => gzipSync(text).length;
const assetPath = (src) => join(DIST, src.replace(/^\//, ''));

/** Gzipped size of a JS module plus every chunk it statically imports. */
async function moduleSize(file, seen) {
  if (seen.has(file)) return 0;
  seen.add(file);
  const code = await readFile(file, 'utf8');
  let size = gz(code);
  for (const [, spec] of code.matchAll(/(?:import|from)\s*["']([^"']+\.js)["']/g)) {
    const next = spec.startsWith('/') ? assetPath(spec) : join(dirname(file), spec);
    size += await moduleSize(next, seen);
  }
  return size;
}

async function measure(html) {
  let js = 0;
  let css = 0;
  const seen = new Set();
  for (const [, attrs, body] of html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/g)) {
    if (attrs.includes('application/ld+json')) continue;
    const src = /\bsrc="([^"]+)"/.exec(attrs)?.[1];
    js += src ? await moduleSize(assetPath(src), seen) : gz(body);
  }
  for (const [, href] of html.matchAll(/<link\b[^>]*rel="stylesheet"[^>]*href="([^"]+)"/g)) {
    css += gz(await readFile(assetPath(href), 'utf8'));
  }
  for (const [, body] of html.matchAll(/<style\b[^>]*>([\s\S]*?)<\/style>/g)) css += gz(body);
  return { js, css };
}

let failed = false;
for (const file of await htmlFiles(DIST)) {
  const page = `/${relative(DIST, file)}`;
  const { js, css } = await measure(await readFile(file, 'utf8'));
  const jsLimit = page.startsWith('/gallery/') ? GALLERY_JS_LIMIT : 0;
  const ok = js <= jsLimit && css <= CSS_LIMIT;
  if (!ok) failed = true;
  console.log(
    `${ok ? '✓' : '✗'} ${page.padEnd(40)} js ${(js / KB).toFixed(1)} KB (≤ ${jsLimit / KB})  css ${(css / KB).toFixed(1)} KB (≤ ${CSS_LIMIT / KB})`,
  );
}
if (failed) {
  console.error('\nBudget exceeded.');
  process.exit(1);
}
