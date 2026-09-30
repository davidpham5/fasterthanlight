import { readFileSync } from 'node:fs';
import { expect, test } from '@playwright/test';
import { firstSet, photos, site } from './helpers';

const ORIGIN = 'https://fasterthanlight.studio';
const routes = ['/', `/gallery/${firstSet.slug}`, '/about', '/contact'];

test('each page has a unique title and description and a canonical URL', async ({ page }) => {
  const titles = new Set<string>();
  const descriptions = new Set<string>();
  for (const route of routes) {
    await page.goto(route);
    titles.add(await page.title());
    descriptions.add((await page.locator('meta[name="description"]').getAttribute('content'))!);
    const canonical = await page.locator('link[rel="canonical"]').getAttribute('href');
    expect(canonical).toMatch(new RegExp(`^${ORIGIN}${route === '/' ? '/' : `${route}/?`}$`));
  }
  expect(titles.size).toBe(routes.length);
  expect(descriptions.size).toBe(routes.length);
});

test('social cards use the hero image from Cloudinary', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('meta[property="og:image"]')).toHaveAttribute(
    'content',
    new RegExp(`/${site.cloudName}/image/upload/f_auto,q_auto,c_limit,w_1600/`),
  );
  await expect(page.locator('meta[property="og:site_name"]')).toHaveAttribute('content', site.name);
  await expect(page.locator('meta[name="twitter:card"]')).toHaveAttribute(
    'content',
    'summary_large_image',
  );
});

test('structured data describes the business', async ({ page }) => {
  await page.goto('/');
  const json = await page.locator('script[type="application/ld+json"]').textContent();
  const data = JSON.parse(json!);
  expect(data['@type']).toBe('ProfessionalService');
  expect(data.name).toBe(site.name);
  expect(data.url).toBe(`${ORIGIN}/`);
  expect(data.email).toBe(site.email);
});

test('robots.txt blocks AI crawlers and points at the sitemap', async ({ request }) => {
  const body = await (await request.get('/robots.txt')).text();
  for (const bot of ['GPTBot', 'ClaudeBot', 'Google-Extended', 'CCBot', 'PerplexityBot']) {
    expect(body).toContain(`User-agent: ${bot}`);
  }
  expect(body).toContain('Disallow: /');
  expect(body).toContain(`Sitemap: ${ORIGIN}/sitemap-index.xml`);
});

test('sitemap lists real pages but not thanks or the redirect', () => {
  const xml = readFileSync('dist/sitemap-0.xml', 'utf8');
  expect(xml).toContain(`${ORIGIN}/about`);
  for (const set of photos.sets) expect(xml).toContain(`${ORIGIN}/gallery/${set.slug}`);
  expect(xml).not.toContain('/thanks');
  expect(xml).not.toMatch(/\/gallery\/?<\/loc>/);
});

test('netlify.toml sets the protective headers and domain redirects', () => {
  const toml = readFileSync('netlify.toml', 'utf8');
  expect(toml).toContain('X-Robots-Tag = "noai, noimageai"');
  expect(toml).toContain("img-src 'self' data: https://res.cloudinary.com");
  expect(toml).toContain("script-src 'self'");
  expect(toml).toContain('from = "https://thisismynext.photos/*"');
});

test('the old misspelled Portraits URL redirects permanently', () => {
  const toml = readFileSync('netlify.toml', 'utf8');
  expect(toml).toMatch(
    /from = "\/gallery\/protraits"\s+to = "\/gallery\/portraits"\s+status = 301\s+force = true/,
  );
});
