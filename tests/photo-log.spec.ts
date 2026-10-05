import { expect, test } from '@playwright/test';
import { logPosts } from './helpers';

test('the nav links to the Photo Log only when a post is published', async ({ page }) => {
  await page.goto('/about');
  const nav = page.getByRole('navigation', { name: 'Main' });
  const link = nav.getByRole('link', { name: 'Photo Log' });
  if (logPosts.length === 0) {
    await expect(link).toHaveCount(0);
    return;
  }
  await expect(link).toHaveAttribute('href', '/photo-log');
  await expect(nav.getByRole('link')).toHaveText(['Gallery', 'Photo Log', 'About', 'Contact']);
});
