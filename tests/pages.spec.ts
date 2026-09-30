import { expect, test } from '@playwright/test';
import { firstSet, photos, site } from './helpers';

test('about shows the portrait, bio and how-I-work section', async ({ page }) => {
  await page.goto('/about');
  await expect(page.getByRole('heading', { level: 1, name: 'About' })).toBeVisible();
  await expect(page.locator('.about img')).toHaveAttribute(
    'alt',
    photos.extras[site.portraitId].alt,
  );
  await expect(page.getByRole('heading', { level: 2, name: 'How I work' })).toBeVisible();
  await expect(page.locator('script:not([type="application/ld+json"])')).toHaveCount(0);
});

test('contact form is wired for Netlify Forms', async ({ page }) => {
  await page.goto('/contact');
  const form = page.locator('form[name="inquiry"]');
  await expect(form).toHaveAttribute('method', /post/i);
  await expect(form).toHaveAttribute('data-netlify', 'true');
  await expect(form).toHaveAttribute('netlify-honeypot', 'bot-field');
  await expect(form).toHaveAttribute('action', '/thanks');
  await expect(form.locator('input[type="hidden"][name="form-name"]')).toHaveValue('inquiry');
  await expect(page.locator('input[name="bot-field"]')).toBeHidden();
  await expect(page.locator('script:not([type="application/ld+json"])')).toHaveCount(0);
});

test('contact form requires name, email and message only', async ({ page }) => {
  await page.goto('/contact');
  await expect(page.getByLabel('Name')).toHaveAttribute('required', '');
  await expect(page.getByLabel('Email')).toHaveAttribute('type', 'email');
  await expect(page.getByLabel('Email')).toHaveAttribute('required', '');
  await expect(page.getByLabel('Message')).toHaveAttribute('required', '');
  for (const optional of ['Company', 'Event date', 'Event type', 'Location']) {
    await expect(page.getByLabel(optional)).not.toHaveAttribute('required', '');
  }
});

test('event type options are the set titles plus Other', async ({ page }) => {
  await page.goto('/contact');
  const options = await page.getByLabel('Event type').locator('option').allTextContents();
  expect(options.map((o) => o.trim())).toEqual([
    'Choose one',
    ...photos.sets.map((s) => s.title),
    'Other',
  ]);
});

test('submitting with an empty required field is blocked by the browser', async ({ page }) => {
  await page.goto('/contact');
  await page.getByRole('button', { name: 'Send inquiry' }).click();
  await expect(page).toHaveURL(/\/contact\/?$/);
  const missing = await page
    .getByLabel('Name')
    .evaluate((el) => (el as HTMLInputElement).validity.valueMissing);
  expect(missing).toBe(true);
});

test('thanks page confirms and is not indexed', async ({ page }) => {
  await page.goto('/thanks');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Thank you');
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', /noindex/);
});

test('unknown pages return 404 with a way back', async ({ page }) => {
  const response = await page.goto('/this-page-does-not-exist');
  expect(response?.status()).toBe(404);
  await expect(page.getByRole('link', { name: 'Go to the gallery' })).toHaveAttribute(
    'href',
    `/gallery/${firstSet.slug}`,
  );
});
