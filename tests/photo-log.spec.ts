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

const ORIGIN = 'https://fasterthanlight.studio';

test.describe('with published posts', () => {
  test.skip(logPosts.length === 0, 'no published Photo Log posts yet');
  const latest = logPosts[0];

  test('the feed shows posts newest first, five per page', async ({ page }) => {
    await page.goto('/photo-log');
    const titles = page.locator('.log-post__title');
    await expect(titles).toHaveText(logPosts.slice(0, 5).map((p) => p.title));
    const older = page.getByRole('link', { name: 'Older →' });
    if (logPosts.length <= 5) {
      await expect(older).toHaveCount(0);
      return;
    }
    await older.click();
    await expect(page).toHaveURL(/\/photo-log\/2$/);
    await expect(titles.first()).toHaveText(logPosts[5].title);
    await expect(page.getByRole('link', { name: '← Newer' })).toHaveAttribute('href', '/photo-log');
  });

  test('post titles link to their page and use the display font', async ({ page }) => {
    await page.goto('/photo-log');
    const title = page.locator('.log-post__title').first();
    await expect(title.getByRole('link')).toHaveAttribute('href', `/photo-log/${latest.slug}`);
    await expect(title).toHaveCSS('font-family', /^"Canela Deck"/);
  });

  test('photos keep their alt text and are served from /img at no more than 1600px', async ({
    page,
  }) => {
    await page.goto(`/photo-log/${latest.slug}`);
    await expect(page.locator('h1')).toHaveText(latest.title);
    const imgs = page.locator('.log-photo img');
    await expect(imgs).toHaveCount(latest.photos.length);
    for (const [i, photo] of latest.photos.entries()) {
      await expect(imgs.nth(i)).toHaveAttribute('alt', photo.alt);
      const srcset = (await imgs.nth(i).getAttribute('srcset')) ?? '';
      expect(srcset).toContain(`/img/f_auto,q_auto,c_limit,w_400/${photo.publicId} `);
      expect(srcset).not.toContain('w_2560');
    }
  });

  test('post pages link to the previous and next post', async ({ page }) => {
    for (const [i, post] of logPosts.entries()) {
      await page.goto(`/photo-log/${post.slug}`);
      const previous = page.getByRole('link', { name: '← Previous post' });
      const next = page.getByRole('link', { name: 'Next post →' });
      const older = logPosts[i + 1];
      const newer = logPosts[i - 1];
      if (older) await expect(previous).toHaveAttribute('href', `/photo-log/${older.slug}`);
      else await expect(previous).toHaveCount(0);
      if (newer) await expect(next).toHaveAttribute('href', `/photo-log/${newer.slug}`);
      else await expect(next).toHaveCount(0);
    }
  });

  test("a post's social card uses its first photo", async ({ page }) => {
    await page.goto(`/photo-log/${latest.slug}`);
    await expect(page.locator('meta[property="og:type"]')).toHaveAttribute('content', 'article');
    await expect(page.locator('meta[property="og:image"]')).toHaveAttribute(
      'content',
      `${ORIGIN}/img/f_auto,q_auto,c_limit,w_1600/${latest.photos[0].publicId}`,
    );
    await expect(page.locator('meta[property="og:image:alt"]')).toHaveAttribute(
      'content',
      latest.photos[0].alt,
    );
  });

  test('the feed loads without layout shift', async ({ page }) => {
    await page.goto('/photo-log');
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

  test('the RSS feed has one item per published post, with absolute image URLs', async ({
    request,
  }) => {
    const res = await request.get('/photo-log/rss.xml');
    expect(res.ok()).toBe(true);
    const xml = await res.text();
    expect(xml.startsWith('<?xml')).toBe(true);
    expect(xml.match(/<item>/g)).toHaveLength(logPosts.length);
    expect(xml).toContain(`<link>${ORIGIN}/photo-log/${latest.slug}/</link>`);
    expect(xml).toContain(
      `${ORIGIN}/img/f_auto,q_auto,c_limit,w_1600/${latest.photos[0].publicId}`,
    );
  });

  test.describe('without JavaScript', () => {
    test.use({ javaScriptEnabled: false });
    test('each photo links to its 1600px image', async ({ page }) => {
      await page.goto(`/photo-log/${latest.slug}`);
      const link = page.locator('a[data-viewer-item]').first();
      const href = await link.getAttribute('href');
      expect(href).toBe(`/img/f_auto,q_auto,c_limit,w_1600/${latest.photos[0].publicId}`);
      expect((await page.request.get(href!)).ok()).toBe(true);
    });
  });
});
