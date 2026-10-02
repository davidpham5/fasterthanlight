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
  await expect(footer).toContainText(`© ${new Date().getFullYear()} ${site.name} · ${site.owner}`);
  await expect(footer.getByRole('link', { name: site.email })).toHaveAttribute(
    'href',
    `mailto:${site.email}`,
  );
});

test('every page opts out of AI training', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', 'noai, noimageai');
  await expect(page.locator('meta[name="tdm-reservation"]')).toHaveAttribute('content', '1');
  const tdmrep = await page.request.get('/.well-known/tdmrep.json');
  expect(await tdmrep.json()).toEqual([{ location: '/', 'tdm-reservation': 1 }]);
});

test('images come from our own domain, so robots.txt and the no-AI headers cover them', async ({
  page,
}) => {
  for (const path of ['/', `/gallery/${firstSet.slug}`, '/about']) {
    await page.goto(path);
    const urls = await page
      .locator('img')
      .evaluateAll((imgs) =>
        imgs.flatMap((img) => [
          (img as HTMLImageElement).src,
          ...((img as HTMLImageElement).srcset.match(/\S+(?=\s+\d+w)/g) ?? []),
        ]),
      );
    const remote = urls.filter((u) => u && !u.startsWith('data:') && !u.includes('/img/'));
    expect(remote, path).toEqual([]);
  }
});

test('skip link moves focus to the main content', async ({ page }) => {
  await page.goto('/');
  await page.keyboard.press('Tab');
  await expect(page.getByRole('link', { name: 'Skip to content' })).toBeFocused();
});

test('the current section is marked in the main navigation', async ({ page }) => {
  await page.goto('/about');
  const nav = page.getByRole('navigation', { name: 'Main' });
  await expect(nav.getByRole('link', { name: 'About' })).toHaveAttribute('aria-current', 'true');
  await page.goto(`/gallery/${firstSet.slug}`);
  await expect(nav.getByRole('link', { name: 'Gallery' })).toHaveAttribute('aria-current', 'true');
});

test('the wordmark and headings use Canela Deck, which actually loads', async ({ page }) => {
  await page.goto('/about');
  for (const selector of ['.wordmark', 'h1']) {
    const family = await page.locator(selector).evaluate((el) => getComputedStyle(el).fontFamily);
    expect(family, selector).toMatch(/^"Canela Deck"/);
  }
  await expect(page.locator('body')).not.toHaveCSS('font-family', /Canela/);
  const loaded = await page.evaluate(async () => {
    await document.fonts.ready;
    return document.fonts.check('1rem "Canela Deck"');
  });
  expect(loaded).toBe(true);
});
