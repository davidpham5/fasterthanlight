import { readFileSync } from 'node:fs';
import { expect, test } from '@playwright/test';
import { firstSet, photos, setWith } from './helpers';

test.describe('without JavaScript', () => {
  test.use({ javaScriptEnabled: false });

  for (const set of photos.sets) {
    test(`${set.slug} lists every photo in order`, async ({ page }) => {
      await page.goto(`/gallery/${set.slug}`);
      const items = page.locator('.set__item');
      await expect(items).toHaveCount(set.photos.length);
      for (const [i, photo] of set.photos.entries()) {
        await expect(items.nth(i).locator('img')).toHaveAttribute('alt', photo.alt);
      }
      await expect(page.locator('.slideshow__nav').first()).toBeHidden();
      await expect(page.locator('.slideshow__thumbs')).toBeHidden();
    });
  }

  test('only the first photo loads eagerly', async ({ page }) => {
    await page.goto(`/gallery/${firstSet.slug}`);
    const imgs = page.locator('.set__item img');
    await expect(imgs.first()).toHaveAttribute('fetchpriority', 'high');
    if (firstSet.photos.length > 1) await expect(imgs.nth(1)).toHaveAttribute('loading', 'lazy');
  });

  test('a photo without a caption keeps its caption space', async ({ page }) => {
    const set = setWith((s) => s.photos.some((p) => !p.caption));
    test.skip(!set, 'content has no caption-less photo');
    const index = set!.photos.findIndex((p) => !p.caption);
    await page.goto(`/gallery/${set!.slug}`);
    const box = await page.locator('.set__item').nth(index).locator('figcaption').boundingBox();
    expect(box!.height).toBeGreaterThan(10);
  });
});

test('set switcher links every set and marks the current one', async ({ page }) => {
  await page.goto(`/gallery/${firstSet.slug}`);
  const switcher = page.getByRole('navigation', { name: 'Event types' });
  for (const set of photos.sets) {
    await expect(switcher.getByRole('link', { name: set.title })).toHaveAttribute(
      'href',
      `/gallery/${set.slug}`,
    );
  }
  await expect(switcher.getByRole('link', { name: firstSet.title })).toHaveAttribute(
    'aria-current',
    'page',
  );
  await expect(page).toHaveTitle(`${firstSet.title} — FasterThanLight Studio`);
});

test('/gallery redirects to the first set', async ({ page }) => {
  await page.goto('/gallery');
  await expect(page).toHaveURL(new RegExp(`/gallery/${firstSet.slug}/?$`));
});

test('Netlify gets a real 301 for /gallery', () => {
  // Forced (301!) because dist/gallery/index.html exists, and Netlify skips unforced rules
  // when a file is present at the path.
  const redirects = readFileSync('dist/_redirects', 'utf8');
  expect(redirects).toContain(`/gallery /gallery/${firstSet.slug} 301!`);
  expect(redirects).toContain(`/gallery/ /gallery/${firstSet.slug} 301!`);
});
