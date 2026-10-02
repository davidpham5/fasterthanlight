import { expect, test } from '@playwright/test';

test('home page responds with the site title', async ({ page }) => {
  const response = await page.goto('/');
  expect(response?.status()).toBe(200);
  await expect(page).toHaveTitle(/FasterThanLight Studio/);
});
