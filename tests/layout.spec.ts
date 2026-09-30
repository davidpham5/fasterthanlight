import { expect, test } from '@playwright/test';
import { firstSet, site } from './helpers';

test('header shows the wordmark and main navigation', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('link', { name: site.name, exact: true })).toHaveAttribute(
    'href',
    '/',
  );
  const nav = page.getByRole('navigation', { name: 'Main' });
  await expect(nav.getByRole('link', { name: 'Gallery' })).toHaveAttribute(
    'href',
    `/gallery/${firstSet.slug}`,
  );
  await expect(nav.getByRole('link', { name: 'About' })).toHaveAttribute('href', '/about');
  await expect(nav.getByRole('link', { name: 'Contact' })).toHaveAttribute('href', '/contact');
});

test('footer shows copyright and a mailto link', async ({ page }) => {
  await page.goto('/');
  const footer = page.getByRole('contentinfo');
  await expect(footer).toContainText(`${site.name} · ${site.owner}`);
  await expect(footer.getByRole('link', { name: site.email })).toHaveAttribute(
    'href',
    `mailto:${site.email}`,
  );
});

test('every page opts out of AI training', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', 'noai, noimageai');
});

test('skip link moves focus to the main content', async ({ page }) => {
  await page.goto('/');
  await page.keyboard.press('Tab');
  await expect(page.getByRole('link', { name: 'Skip to content' })).toBeFocused();
});
