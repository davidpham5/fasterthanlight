import { expect, test } from '@playwright/test';
import { firstSet, site } from './helpers';

test('hero image fills the screen and loads with high priority', async ({ page }) => {
  await page.goto('/');
  const hero = page.locator('.hero img');
  await expect(hero).toHaveAttribute('loading', 'eager');
  await expect(hero).toHaveAttribute('fetchpriority', 'high');
  await expect(hero).toHaveAttribute('srcset', /(^|\s)\/img\/f_auto,q_auto,c_limit,w_400\//);
  const box = await hero.boundingBox();
  const { width, height } = await page.evaluate(() => ({
    width: document.documentElement.clientWidth,
    height: window.innerHeight,
  }));
  expect(box!.width).toBeGreaterThanOrEqual(width - 1);
  expect(box!.y + box!.height).toBeGreaterThanOrEqual(height - 1);
});

test('tagline and link lead straight to the first set', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(site.tagline);
  await expect(page.getByRole('link', { name: 'View the work →' })).toHaveAttribute(
    'href',
    `/gallery/${firstSet.slug}`,
  );
});

test('homepage ships no JavaScript', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('script:not([type="application/ld+json"])')).toHaveCount(0);
});
