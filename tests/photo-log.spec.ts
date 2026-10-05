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
    expect(xml).toContain(`<link>${ORIGIN}/photo-log/${latest.slug}</link>`);
    expect(xml).toContain(
      `${ORIGIN}/img/f_auto,q_auto,c_limit,w_1600/${latest.photos[0].publicId}`,
    );
  });

  test.describe('viewer', () => {
    const post = logPosts.find((p) => p.photos.length > 1) ?? latest;
    const big = (page: import('@playwright/test').Page) => page.locator('.viewer__img');

    test('opens on click, moves with arrows, closes with Esc and returns focus', async ({
      page,
    }) => {
      await page.goto(`/photo-log/${post.slug}`);
      const first = page.locator('a[data-viewer-item]').first();
      await first.click();
      const dialog = page.getByRole('dialog', { name: 'Photo viewer' });
      await expect(dialog).toBeVisible();
      await expect(big(page)).toHaveAttribute('alt', post.photos[0].alt);
      await expect(big(page)).toHaveAttribute(
        'src',
        new RegExp(
          `/img/f_auto,q_auto,c_limit,w_1600/${post.photos[0].publicId.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`,
        ),
      );
      if (post.photos.length > 1) {
        await page.keyboard.press('ArrowRight');
        await expect(big(page)).toHaveAttribute('alt', post.photos[1].alt);
        await dialog.getByRole('button', { name: 'Previous photo' }).click();
        await expect(big(page)).toHaveAttribute('alt', post.photos[0].alt);
      }
      await page.keyboard.press('Escape');
      await expect(dialog).toBeHidden();
      await expect(first).toBeFocused();
    });

    test('closes with the ✕ button and a click on the empty space', async ({ page }) => {
      await page.goto(`/photo-log/${post.slug}`);
      const dialog = page.getByRole('dialog', { name: 'Photo viewer' });
      await page.locator('a[data-viewer-item]').first().click();
      await dialog.getByRole('button', { name: 'Close' }).click();
      await expect(dialog).toBeHidden();
      await page.locator('a[data-viewer-item]').first().click();
      await page.mouse.click(5, 5);
      await expect(dialog).toBeHidden();
    });

    test('modified clicks are left to the browser', async ({ page }) => {
      await page.goto(`/photo-log/${post.slug}`);
      const link = page.locator('a[data-viewer-item]').first();
      const opened = await link.evaluate((a) => {
        const event = new MouseEvent('click', { bubbles: true, cancelable: true, metaKey: true });
        a.addEventListener('click', (e) => e.preventDefault(), { once: true }); // don't open a tab
        a.dispatchEvent(event);
        return document.querySelector('dialog.viewer')!.hasAttribute('open');
      });
      expect(opened).toBe(false);
    });

    test('swipes between photos on touch', async ({ page }, testInfo) => {
      test.skip(testInfo.project.name !== 'mobile' || post.photos.length < 2);
      await page.goto(`/photo-log/${post.slug}`);
      await page.locator('a[data-viewer-item]').first().click();
      await page.locator('dialog.viewer').evaluate((el) => {
        const init = (x: number): PointerEventInit => ({
          bubbles: true,
          pointerType: 'touch',
          isPrimary: true,
          clientX: x,
          clientY: 300,
        });
        el.dispatchEvent(new PointerEvent('pointerdown', init(300)));
        el.dispatchEvent(new PointerEvent('pointerup', init(150)));
      });
      await expect(big(page)).toHaveAttribute('alt', post.photos[1].alt);
    });
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
