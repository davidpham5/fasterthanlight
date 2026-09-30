import { expect, test, type Page } from '@playwright/test';
import { photos, setWith } from './helpers';

const multi = setWith((s) => s.photos.length >= 3)!;
const n = multi.photos.length;
const items = (page: Page) => page.locator('.set__item');
const activeIndex = (page: Page) =>
  page
    .locator('.set__item')
    .evaluateAll((els) => els.findIndex((el) => el.classList.contains('is-active')));

test.beforeAll(() => {
  expect(multi, 'content needs a set with at least 3 photos').toBeTruthy();
});

test('opens on the first photo with controls shown', async ({ page }) => {
  await page.goto(`/gallery/${multi.slug}`);
  await expect(page.locator('.set.is-enhanced')).toHaveCount(1);
  await expect(page.locator('.set__item.is-active')).toHaveCount(1);
  expect(await activeIndex(page)).toBe(0);
  await expect(page.getByRole('button', { name: 'Next photo' })).toBeVisible();
  await expect(page.locator('.slideshow__thumbs')).toBeVisible();
});

test('next and previous buttons move and wrap around', async ({ page }) => {
  await page.goto(`/gallery/${multi.slug}`);
  await page.getByRole('button', { name: 'Next photo' }).click();
  expect(await activeIndex(page)).toBe(1);
  await expect(page).toHaveURL(/#2$/);
  await page.getByRole('button', { name: 'Previous photo' }).click();
  await page.getByRole('button', { name: 'Previous photo' }).click();
  expect(await activeIndex(page)).toBe(n - 1);
  await expect(page).toHaveURL(new RegExp(`#${n}$`));
});

test('arrow keys navigate', async ({ page }) => {
  await page.goto(`/gallery/${multi.slug}`);
  await page.keyboard.press('ArrowRight');
  expect(await activeIndex(page)).toBe(1);
  await page.keyboard.press('ArrowLeft');
  await page.keyboard.press('ArrowLeft');
  expect(await activeIndex(page)).toBe(n - 1);
});

test('thumbnails jump to a photo and mark it current', async ({ page }) => {
  await page.goto(`/gallery/${multi.slug}`);
  const thumb = page.getByRole('button', { name: `Photo 3 of ${n}` });
  await thumb.click();
  expect(await activeIndex(page)).toBe(2);
  await expect(thumb).toHaveAttribute('aria-current', 'true');
  await expect(page).toHaveURL(/#3$/);
});

test('a deep link opens that photo', async ({ page }) => {
  await page.goto(`/gallery/${multi.slug}#3`);
  expect(await activeIndex(page)).toBe(2);
});

for (const bad of ['#0', `#${n + 1}`, '#abc', '#2abc']) {
  test(`invalid hash ${bad} falls back to the first photo`, async ({ page }) => {
    await page.goto(`/gallery/${multi.slug}${bad}`);
    expect(await activeIndex(page)).toBe(0);
    await expect(page.locator('.set__item.is-active img')).toBeVisible();
  });
}

test('announces the new photo to screen readers', async ({ page }) => {
  await page.goto(`/gallery/${multi.slug}`);
  await page.getByRole('button', { name: 'Next photo' }).click();
  await expect(page.locator('.slideshow__status')).toHaveText(new RegExp(`^Photo 2 of ${n}`));
});

test('swiping left on touch goes to the next photo', async ({ page }) => {
  await page.goto(`/gallery/${multi.slug}`);
  await page.locator('.set__list').evaluate((el) => {
    const init = (x: number): PointerEventInit => ({
      bubbles: true,
      pointerType: 'touch',
      isPrimary: true,
      clientX: x,
      clientY: 200,
    });
    el.dispatchEvent(new PointerEvent('pointerdown', init(300)));
    el.dispatchEvent(new PointerEvent('pointerup', init(150)));
  });
  expect(await activeIndex(page)).toBe(1);
});

test('neighbouring photos are preloaded', async ({ page }) => {
  await page.goto(`/gallery/${multi.slug}`);
  await expect(items(page).nth(1).locator('img')).toHaveAttribute('loading', 'eager');
  await expect(
    items(page)
      .nth(n - 1)
      .locator('img'),
  ).toHaveAttribute('loading', 'eager');
});

test('a single-photo set hides controls and ignores arrow keys', async ({ page }) => {
  const single = setWith((s) => s.photos.length === 1);
  test.skip(!single, 'content has no single-photo set');
  await page.goto(`/gallery/${single!.slug}`);
  await expect(page.locator('.set.is-enhanced')).toHaveCount(1);
  await expect(page.getByRole('button', { name: 'Next photo' })).toBeHidden();
  await expect(page.locator('.slideshow__thumbs')).toBeHidden();
  await page.keyboard.press('ArrowRight');
  expect(await activeIndex(page)).toBe(0);
  await expect(page).not.toHaveURL(/#/);
});

test('a tall portrait photo fits in the viewport without scrolling', async ({ page }) => {
  const set = setWith((s) => s.photos.some((p) => p.height > p.width));
  test.skip(!set, 'content has no portrait photo');
  const index = set!.photos.findIndex((p) => p.height > p.width);
  await page.goto(`/gallery/${set!.slug}#${index + 1}`);
  const img = page.locator('.set__item.is-active img');
  await expect(img).toBeVisible();
  const box = await img.boundingBox();
  const viewportHeight = await page.evaluate(() => window.innerHeight);
  expect(box!.y + box!.height).toBeLessThanOrEqual(viewportHeight);
});

test('every set page enhances without console errors', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  for (const set of photos.sets) {
    await page.goto(`/gallery/${set.slug}`);
    await expect(page.locator('.set.is-enhanced')).toHaveCount(1);
  }
  expect(errors).toEqual([]);
});

test('gallery page loads without layout shift', async ({ page }) => {
  await page.goto(`/gallery/${multi.slug}`);
  await page.waitForLoadState('load');
  const cls = await page.evaluate(
    () =>
      new Promise<number>((resolve) => {
        let total = 0;
        new PerformanceObserver((list) => {
          for (const entry of list.getEntries() as (PerformanceEntry & {
            value: number;
            hadRecentInput: boolean;
          })[]) {
            if (!entry.hadRecentInput) total += entry.value;
          }
        }).observe({ type: 'layout-shift', buffered: true });
        setTimeout(() => resolve(total), 500);
      }),
  );
  expect(cls).toBeLessThanOrEqual(0.05);
});

test('slideshow photos download at the size they display, not larger', async ({ page }) => {
  await page.goto(`/gallery/${multi.slug}`);
  const img = page.locator('.set__item.is-active img');
  await expect(img).toHaveJSProperty('complete', true);
  const { src, rendered, dpr } = await img.evaluate((el) => ({
    src: (el as HTMLImageElement).currentSrc,
    rendered: el.getBoundingClientRect().width,
    dpr: window.devicePixelRatio,
  }));
  const requested = Number(/w_(\d+)/.exec(src)![1]);
  // The smallest allowed width that covers the displayed size is the right download.
  const enough = [400, 800, 1600, 2560].find((w) => w >= rendered * dpr) ?? 2560;
  expect(requested).toBeLessThanOrEqual(enough);
});

test.describe('phone held sideways', () => {
  test.use({ viewport: { width: 750, height: 342 } });

  test('a landscape photo stays usefully large', async ({ page }) => {
    const set = setWith((s) => s.photos[0].width > s.photos[0].height);
    test.skip(!set, 'content has no set that opens on a landscape photo');
    await page.goto(`/gallery/${set!.slug}`);
    const box = await page.locator('.set__item.is-active img').boundingBox();
    expect(box!.height).toBeGreaterThanOrEqual(342 * 0.6);
  });
});
