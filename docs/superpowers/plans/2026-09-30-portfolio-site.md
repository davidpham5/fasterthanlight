# FasterThanLight Studio Portfolio Site Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build and launch a fast, static portfolio site at `fasterthanlight.studio`. It shows 60 curated corporate-event photos in slideshow sets, plus an About page and a Netlify contact form.

**Architecture:**
- Astro 7 static site. Content lives in two JSON files, validated with zod at build time.
- Every image is delivered by Cloudinary through a single URL builder and a `<Photo>` component, so the image host can later be swapped by changing one module.
- Gallery sets render as plain HTML lists. A ≤10 KB vanilla-TypeScript script turns each list into a Hunter-style slideshow. No other page ships JavaScript.
- Photo metadata is pulled from Cloudinary by a local sync script. Netlify builds never call Cloudinary.

**Tech Stack:**
- Astro 7.3 and `@astrojs/sitemap` 3.7
- TypeScript 6 and zod 4 (via `astro/zod`)
- Vitest 5 (unit tests) and Playwright 1.63 (end-to-end tests)
- The Cloudinary Node SDK 2 (sync script only)
- Lighthouse CI 0.15, Prettier 3, and GitHub Actions
- Netlify (hosting + Forms)

**Spec:** `docs/superpowers/specs/2026-09-30-portfolio-site-design.md`

## Global Constraints

- **Node ≥ 22.12 is required by Astro 7. Use Node 24.** The shell default is Node 18, so before running any command: `export PATH="$HOME/.nvm/versions/node/v24.14.0/bin:$PATH"` (verify with `node -v` → `v24.x`). CI and Netlify use `.nvmrc` = `24`.
- Work on branch `feat/portfolio-site` in `~/Developer/fasterthanlight`. **Never push or open a PR without asking David first.** Pushes deploy to Netlify.
- End every commit message with the trailer `Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>`.
- Site name: `FasterThanLight Studio`. Owner: `David Pham`. Email: `hello@fasterthanlight.studio`. Site URL: `https://fasterthanlight.studio`.
- Visual style is "Gallery White": white background, the stack `"Helvetica Neue", Helvetica, Arial, system-ui, sans-serif`, no web fonts, no CSS framework, no UI framework.
- Cloudinary delivery transform: `f_auto,q_auto,c_limit,w_{400|800|1600|2560}`. **No other widths or transformations** are allowed in delivered URLs, because strict transformations are enabled. The only exception is the sync script's signed placeholder request.
- JavaScript budget: **0 KB** on `/`, `/about`, `/contact`, `/thanks`, and 404; **≤ 10 KB gzipped** on gallery pages. CSS: **≤ 15 KB gzipped** per page.
- Lighthouse (mobile) on `/` and a gallery page: Performance ≥ 0.95, Accessibility ≥ 0.95, CLS ≤ 0.05, LCP ≤ 2000 ms. LCP is a warning in CI (network-dependent); the rest are errors.
- Every photo requires non-empty `alt` text. The build must fail otherwise.
- Every page carries `<meta name="robots" content="noai, noimageai">`.
- Photographs are © David Pham / FasterThanLight Studio, all rights reserved. Apache-2.0 covers code only.

### Deliberate deviations from the spec (approved in plan review)

1. The spec's `content.config.ts` content collections are replaced by `src/lib/schema.ts` + `src/lib/content.ts`: plain JSON imports validated with zod. `photos.json` is a nested document that doesn't fit Astro's `file()` loader, and this is simpler.
2. The mobile nav wraps below the wordmark instead of using a disclosure menu. Three links fit, and this needs no JavaScript.
3. `og:image` uses the `w_1600` variant rather than 1200 px, which keeps the strict-transformation allow-list at four widths.

## Review Focus

These are inputs the spec implies but doesn't spell out. Each has a pinned test in the task noted.

1. **A malformed or out-of-range photo hash** (`#0`, `#99`, `#abc`, `#2abc`) must open photo 1, not a blank stage. Covered by Task 7 (unit tests) and Task 8 (end-to-end).
2. **A set with only one photo** must hide the arrows and thumbnails, and arrow keys must do nothing (no errors, no hash churn). Covered by Task 7 (`wrapIndex(…, 1)`) and Task 8 (end-to-end, using the seed "launches" set).
3. **A tall portrait photo** (typical for headshots) must fit inside a laptop viewport without scrolling. Covered by Task 8 (end-to-end, using the seed `samples/man-portrait`).
4. **A photo without a caption** must keep the caption's space, so moving between photos doesn't shift the layout. Covered by Task 6 (end-to-end).
5. **Cloudinary public IDs containing spaces or `#`** (e.g. `Award Night #1`) must produce valid, encoded URLs. Covered by Task 3 (unit tests).

---

## File Structure

```
fasterthanlight/
  .nvmrc                          Node version for CI/Netlify
  .gitignore
  .env.example                    CLOUDINARY_URL template for the sync script
  .prettierrc / .prettierignore
  package.json / package-lock.json
  astro.config.mjs                site URL, sitemap, /gallery redirect (+ Netlify _redirects writer)
  tsconfig.json
  vitest.config.ts                unit tests: src/**, scripts/**
  playwright.config.ts            e2e tests against `astro preview`
  lighthouserc.json               Lighthouse CI budgets
  netlify.toml                    build, headers (CSP, X-Robots-Tag, caching), domain redirects
  NOTICE / README.md              code-vs-photo licensing
  .github/workflows/ci.yml
  public/
    robots.txt                    AI-crawler blocks + sitemap
    favicon.svg
  src/
    content/
      site.json                   name, tagline, email, cloudName, heroId, portraitId
      photos.json                 sets → photos (+ extras: hero, portrait); written by sync-photos
      about.md                    About copy (David edits)
    lib/
      schema.ts                   zod schemas, types, loadContent()     [pure; unit-tested]
      schema.test.ts
      content.ts                  loads + validates the two JSON files at build time
      cloudinary.ts               URL/srcset builder                    [pure; unit-tested]
      cloudinary.test.ts
    components/
      Photo.astro                 the only <img> renderer
      Header.astro / Footer.astro
      SetSwitcher.astro
      Slideshow.astro             no-JS list markup + slideshow CSS + script hook
    scripts/
      slideshow-state.ts          pure index/hash/swipe logic         [unit-tested]
      slideshow-state.test.ts
      slideshow.ts                DOM enhancement
    layouts/Base.astro            <head>, header, footer
    styles/global.css
    pages/
      index.astro  about.astro  contact.astro  thanks.astro  404.astro
      gallery/[set].astro
  scripts/
    sync/merge.ts                 pure merge of Cloudinary listing into photos.json [unit-tested]
    sync/merge.test.ts
    sync-photos.ts                CLI: Cloudinary Admin API → merge → write photos.json
    check-budgets.mjs             JS/CSS gzip budgets over dist/
  tests/                          Playwright specs + helpers.ts
```

---

### Task 1: Project scaffold and tooling

**Files:**
- Create: `.nvmrc`, `.gitignore`, `.env.example`, `.prettierrc`, `.prettierignore`, `package.json`, `astro.config.mjs` (temporary version), `tsconfig.json`, `vitest.config.ts`, `playwright.config.ts`, `NOTICE`, `src/pages/index.astro` (temporary), `tests/smoke.spec.ts`
- Modify: `README.md`

**Interfaces:**
- Produces: npm scripts `dev`, `build`, `preview` (port 4321), `check`, `test`, `test:e2e`, `budgets`, `sync-photos`, `format`, `format:check`. Playwright `baseURL` = `http://localhost:4321`.

- [ ] **Step 1: Create the branch and set Node**

```bash
cd ~/Developer/fasterthanlight
export PATH="$HOME/.nvm/versions/node/v24.14.0/bin:$PATH"
node -v   # expect v24.x
git switch -c feat/portfolio-site
```

- [ ] **Step 2: Write config files**

`.nvmrc`:
```
24
```

`.gitignore`:
```
node_modules/
dist/
.astro/
.env
test-results/
playwright-report/
.lighthouseci/
.DS_Store
```

`.env.example`:
```
# Copy to .env (never commit .env). Find this in Cloudinary → Settings → API Keys.
CLOUDINARY_URL=cloudinary://API_KEY:API_SECRET@CLOUD_NAME
```

`.prettierrc`:
```json
{
  "plugins": ["prettier-plugin-astro"],
  "singleQuote": true,
  "printWidth": 100
}
```

`.prettierignore`:
```
dist
.astro
node_modules
package-lock.json
src/content/photos.json
docs
.lighthouseci
playwright-report
test-results
```

`package.json`:
```json
{
  "name": "fasterthanlight",
  "type": "module",
  "private": true,
  "engines": { "node": ">=22.12.0" },
  "scripts": {
    "dev": "astro dev",
    "build": "astro build",
    "preview": "astro preview --port 4321",
    "check": "astro check",
    "test": "vitest run",
    "test:e2e": "playwright test",
    "budgets": "node scripts/check-budgets.mjs",
    "sync-photos": "tsx --env-file-if-exists=.env scripts/sync-photos.ts",
    "format": "prettier --write .",
    "format:check": "prettier --check ."
  }
}
```

- [ ] **Step 3: Install dependencies**

```bash
npm install astro@^7.3.5 @astrojs/sitemap@^3.7.4
npm install -D @astrojs/check@^0.9.10 typescript@^6 vitest@^5.0.2 @playwright/test@^1.63.0 \
  prettier@^3.9.9 prettier-plugin-astro@^1.1.0 tsx@^4.23.15 cloudinary@^2.11.0 @lhci/cli@^0.15.1
npx playwright install chromium
```
Expected: installs complete with no `ERESOLVE` errors.

- [ ] **Step 4: Astro, TypeScript, Vitest and Playwright configs**

`astro.config.mjs` (temporary; Task 6 replaces it):
```js
import { defineConfig } from 'astro/config';

export default defineConfig({
  site: 'https://fasterthanlight.studio',
  output: 'static',
  // Emit scripts as files (never inline) so the CSP can use script-src 'self'.
  vite: { build: { assetsInlineLimit: 0 } },
});
```

`tsconfig.json`:
```json
{
  "extends": "astro/tsconfigs/strict",
  "include": [".astro/types.d.ts", "**/*"],
  "exclude": ["dist", "node_modules"]
}
```

`vitest.config.ts`:
```ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: { include: ['src/**/*.test.ts', 'scripts/**/*.test.ts'] },
});
```

`playwright.config.ts`:
```ts
import { defineConfig, devices } from '@playwright/test';

// Tests run against the production build. Run `npm run build` first.
export default defineConfig({
  testDir: 'tests',
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? 'github' : 'list',
  use: { baseURL: 'http://localhost:4321' },
  webServer: {
    command: 'npm run preview',
    url: 'http://localhost:4321',
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
  },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'] } },
    { name: 'mobile', use: { ...devices['Pixel 7'] } },
  ],
});
```

`src/pages/index.astro` (temporary; Task 5 replaces it):
```astro
<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <title>FasterThanLight Studio</title>
  </head>
  <body>
    <h1>FasterThanLight Studio</h1>
  </body>
</html>
```

- [ ] **Step 5: Write the smoke test**

`tests/smoke.spec.ts`:
```ts
import { expect, test } from '@playwright/test';

test('home page responds with the site title', async ({ page }) => {
  const response = await page.goto('/');
  expect(response?.status()).toBe(200);
  await expect(page).toHaveTitle(/FasterThanLight Studio/);
});
```

- [ ] **Step 6: Build and run the smoke test**

Run: `npm run build && npx playwright test tests/smoke.spec.ts`
Expected: build completes; `2 passed` (desktop + mobile).

- [ ] **Step 7: Licensing notice**

`NOTICE`:
```
FasterThanLight Studio — https://fasterthanlight.studio

The source code in this repository is licensed under the Apache License 2.0
(see LICENSE).

The photographs shown on the site — including every image delivered from
Cloudinary and any image data stored in this repository (such as the
placeholder data in src/content/photos.json) — are © David Pham /
FasterThanLight Studio. All rights reserved. No license is granted to use,
copy, modify, or distribute the photographs, including for training
machine-learning models.
```

`README.md` (replace the entire file):
```markdown
# fasterthanlight

Portfolio site for **FasterThanLight Studio**, corporate event photography by David Pham:
https://fasterthanlight.studio

## Licensing

- **Code:** Apache License 2.0 (see `LICENSE`).
- **Photographs:** © David Pham / FasterThanLight Studio. All rights reserved. The Apache
  license does **not** apply to the photographs. See `NOTICE`.

## Development

Requires Node 24 (`.nvmrc`).

    npm install
    npm run dev          # local dev server
    npm test             # unit tests
    npm run build && npm run test:e2e   # end-to-end tests against the production build

## Updating photos

1. Upload exports to Cloudinary folders `portfolio/<set-slug>/` (hero and portrait go in
   `portfolio/_extras/`). Set `alt` (and optionally `caption`) in each photo's contextual metadata.
2. `cp .env.example .env` and fill in `CLOUDINARY_URL` (first time only).
3. `npm run sync-photos`, review with `git diff src/content/photos.json`, then commit.
```

- [ ] **Step 8: Format check and commit**

```bash
npm run format && npm run format:check
git add -A
git commit -m "chore: scaffold Astro 7 project with test tooling and licensing notice

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

---

### Task 2: Content model (schema, validation, seed content)

**Files:**
- Create: `src/lib/schema.ts`, `src/lib/schema.test.ts`, `src/lib/content.ts`, `src/content/site.json`, `src/content/photos.json`, `tests/helpers.ts`

**Interfaces:**
- Produces (in `src/lib/schema.ts`):
  - `type Photo = { id: string; width: number; height: number; alt: string; caption?: string; placeholder?: string }`
  - `type PhotoSet = { slug: string; title: string; photos: Photo[] }`
  - `type PhotosFile = { sets: PhotoSet[]; extras: Record<string, Omit<Photo, 'id'>> }`
  - `type Site = { name; owner; tagline; description; email; cloudName; heroId; portraitId }` (all strings)
  - `interface Content { site: Site; sets: PhotoSet[]; hero: Photo; portrait: Photo }`
  - `class ContentError extends Error`
  - `function loadContent(siteRaw: unknown, photosRaw: unknown): Content` (throws `ContentError`)
- Produces (in `src/lib/content.ts`): `export const site: Site; sets: PhotoSet[]; hero: Photo; portrait: Photo`
- Produces (in `tests/helpers.ts`): `photos`, `site`, `firstSet`, `setWith(pred)`, and the types `SeedSet` and `SeedPhoto`

- [ ] **Step 1: Write the failing tests**

`src/lib/schema.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { loadContent } from './schema';

const site = {
  name: 'FasterThanLight Studio',
  owner: 'David Pham',
  tagline: 'Corporate events, photographed like they matter.',
  description: 'Corporate event photography by David Pham.',
  email: 'hello@fasterthanlight.studio',
  cloudName: 'demo',
  heroId: 'hero',
  portraitId: 'me',
};

const photos = {
  sets: [
    {
      slug: 'conferences',
      title: 'Conferences & Keynotes',
      photos: [{ id: 'a', width: 3000, height: 2000, alt: 'Speaker on stage' }],
    },
  ],
  extras: {
    hero: { width: 3000, height: 2000, alt: 'Hero' },
    me: { width: 1000, height: 1500, alt: 'Portrait of David Pham' },
  },
};

const clone = <T>(value: T): T => structuredClone(value);

describe('loadContent', () => {
  it('accepts valid content and resolves the hero and portrait from extras', () => {
    const content = loadContent(site, photos);
    expect(content.sets).toHaveLength(1);
    expect(content.hero).toEqual({ id: 'hero', width: 3000, height: 2000, alt: 'Hero' });
    expect(content.portrait.id).toBe('me');
  });

  it('rejects a photo with blank alt text', () => {
    const bad = clone(photos);
    bad.sets[0].photos[0].alt = '   ';
    expect(() => loadContent(site, bad)).toThrow(/alt text is required/);
  });

  it('rejects duplicate set slugs', () => {
    const bad = clone(photos);
    bad.sets.push(clone(bad.sets[0]));
    expect(() => loadContent(site, bad)).toThrow(/duplicate set slug "conferences"/);
  });

  it('rejects a set with no photos', () => {
    const bad = clone(photos);
    bad.sets[0].photos = [];
    expect(() => loadContent(site, bad)).toThrow(/a set needs at least one photo/);
  });

  it('rejects a set slug that is not URL-safe', () => {
    const bad = clone(photos);
    bad.sets[0].slug = 'Conferences & Keynotes';
    expect(() => loadContent(site, bad)).toThrow(/slug must be lowercase words joined by hyphens/);
  });

  it('rejects a heroId that is missing from extras', () => {
    expect(() => loadContent({ ...site, heroId: 'nope' }, photos)).toThrow(
      /heroId "nope" is not listed under "extras"/,
    );
  });

  it('rejects an invalid email in site.json', () => {
    expect(() => loadContent({ ...site, email: 'not-an-email' }, photos)).toThrow(
      /site\.json is invalid/,
    );
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/lib/schema.test.ts`
Expected: FAIL — `Failed to resolve import "./schema"`.

- [ ] **Step 3: Implement the schema**

`src/lib/schema.ts`:
```ts
import { z } from 'astro/zod';

const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

const photoFields = {
  width: z.number().int().positive(),
  height: z.number().int().positive(),
  alt: z.string().trim().min(1, 'alt text is required'),
  caption: z.string().trim().min(1).optional(),
  placeholder: z.string().startsWith('data:image/').optional(),
};

export const photoSchema = z.object({ id: z.string().min(1), ...photoFields });

export const setSchema = z.object({
  slug: z.string().regex(SLUG, 'slug must be lowercase words joined by hyphens'),
  title: z.string().trim().min(1),
  photos: z.array(photoSchema).min(1, 'a set needs at least one photo'),
});

export const photosFileSchema = z
  .object({
    sets: z.array(setSchema).min(1, 'at least one set is required'),
    extras: z.record(z.string(), z.object(photoFields)),
  })
  .superRefine((data, ctx) => {
    const seen = new Set<string>();
    for (const set of data.sets) {
      if (seen.has(set.slug)) {
        ctx.addIssue({
          code: 'custom',
          message: `duplicate set slug "${set.slug}"`,
          path: ['sets'],
        });
      }
      seen.add(set.slug);
    }
  });

export const siteSchema = z.object({
  name: z.string().min(1),
  owner: z.string().min(1),
  tagline: z.string().min(1),
  description: z.string().min(1),
  email: z.email(),
  cloudName: z.string().regex(/^[a-z0-9_-]+$/i),
  heroId: z.string().min(1),
  portraitId: z.string().min(1),
});

export type Photo = z.infer<typeof photoSchema>;
export type PhotoSet = z.infer<typeof setSchema>;
export type PhotosFile = z.infer<typeof photosFileSchema>;
export type Site = z.infer<typeof siteSchema>;

export interface Content {
  site: Site;
  sets: PhotoSet[];
  hero: Photo;
  portrait: Photo;
}

export class ContentError extends Error {}

export function loadContent(siteRaw: unknown, photosRaw: unknown): Content {
  const siteResult = siteSchema.safeParse(siteRaw);
  if (!siteResult.success) {
    throw new ContentError(`site.json is invalid:\n${z.prettifyError(siteResult.error)}`);
  }
  const photosResult = photosFileSchema.safeParse(photosRaw);
  if (!photosResult.success) {
    throw new ContentError(`photos.json is invalid:\n${z.prettifyError(photosResult.error)}`);
  }

  const site = siteResult.data;
  const { sets, extras } = photosResult.data;

  const extra = (key: 'heroId' | 'portraitId'): Photo => {
    const id = site[key];
    const found = extras[id];
    if (!found) {
      throw new ContentError(`site.json ${key} "${id}" is not listed under "extras" in photos.json`);
    }
    return { id, ...found };
  };

  return { site, sets, hero: extra('heroId'), portrait: extra('portraitId') };
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run src/lib/schema.test.ts`
Expected: `7 passed`.

- [ ] **Step 5: Seed content and the build-time loader**

This seed content uses Cloudinary's public `demo` account until David's photos are synced (Task 13). It deliberately includes a single-photo set (`launches`), a tall portrait (`samples/man-portrait`), and photos without captions, so the Review Focus tests have data to run against.

`src/content/site.json`:
```json
{
  "name": "FasterThanLight Studio",
  "owner": "David Pham",
  "tagline": "Corporate events, photographed like they matter.",
  "description": "Corporate event photography by David Pham — conferences, galas, product launches and on-site headshots.",
  "email": "hello@fasterthanlight.studio",
  "cloudName": "demo",
  "heroId": "samples/landscapes/architecture-signs",
  "portraitId": "samples/people/smiling-man"
}
```

`src/content/photos.json`:
```json
{
  "sets": [
    {
      "slug": "conferences",
      "title": "Conferences & Keynotes",
      "photos": [
        {
          "id": "samples/people/jazz",
          "width": 3000,
          "height": 1993,
          "alt": "Musicians performing on a lit stage",
          "caption": "Opening act — placeholder photo"
        },
        {
          "id": "happy_people",
          "width": 1920,
          "height": 1279,
          "alt": "A group of attendees laughing together"
        },
        {
          "id": "samples/people/kitchen-bar",
          "width": 1220,
          "height": 813,
          "alt": "Guests talking at a bar counter",
          "caption": "Networking reception — placeholder photo"
        }
      ]
    },
    {
      "slug": "galas",
      "title": "Galas & Awards",
      "photos": [
        {
          "id": "samples/landscapes/girl-urban-view",
          "width": 2048,
          "height": 1252,
          "alt": "A guest looking out over a city skyline",
          "caption": "Rooftop reception — placeholder photo"
        },
        {
          "id": "samples/people/bicycle",
          "width": 2889,
          "height": 1926,
          "alt": "A person riding a bicycle down a city street"
        }
      ]
    },
    {
      "slug": "launches",
      "title": "Product Launches",
      "photos": [
        {
          "id": "bike",
          "width": 2000,
          "height": 1333,
          "alt": "A bicycle parked against a wall",
          "caption": "Launch display — placeholder photo"
        }
      ]
    },
    {
      "slug": "headshots",
      "title": "On-site Headshots",
      "photos": [
        {
          "id": "samples/man-portrait",
          "width": 1333,
          "height": 2000,
          "alt": "Portrait of a man in a jacket",
          "caption": "Executive headshot — placeholder photo"
        },
        {
          "id": "woman",
          "width": 1000,
          "height": 688,
          "alt": "Portrait of a woman smiling"
        }
      ]
    }
  ],
  "extras": {
    "samples/landscapes/architecture-signs": {
      "width": 3000,
      "height": 2000,
      "alt": "A city street lined with signs"
    },
    "samples/people/smiling-man": {
      "width": 849,
      "height": 565,
      "alt": "Portrait of David Pham"
    }
  }
}
```

`src/lib/content.ts`:
```ts
// Loaded once at build time. Invalid content throws, which fails the build.
import siteJson from '../content/site.json';
import photosJson from '../content/photos.json';
import { loadContent } from './schema';

export const { site, sets, hero, portrait } = loadContent(siteJson, photosJson);
```

`tests/helpers.ts`:
```ts
import { readFileSync } from 'node:fs';

export interface SeedPhoto {
  id: string;
  width: number;
  height: number;
  alt: string;
  caption?: string;
}
export interface SeedSet {
  slug: string;
  title: string;
  photos: SeedPhoto[];
}

const read = <T>(path: string): T =>
  JSON.parse(readFileSync(new URL(path, import.meta.url), 'utf8')) as T;

export const photos = read<{ sets: SeedSet[]; extras: Record<string, Omit<SeedPhoto, 'id'>> }>(
  '../src/content/photos.json',
);
export const site = read<{
  name: string;
  owner: string;
  tagline: string;
  email: string;
  cloudName: string;
  heroId: string;
  portraitId: string;
}>('../src/content/site.json');

export const firstSet = photos.sets[0];
export const setWith = (pred: (set: SeedSet) => boolean): SeedSet | undefined =>
  photos.sets.find(pred);
```

- [ ] **Step 6: Verify the seed content validates in a real build**

Add a temporary import to prove the loader runs at build time. Edit `src/pages/index.astro` so its first lines are:
```astro
---
import { site } from '../lib/content';
---
```
and change `<title>FasterThanLight Studio</title>` to `<title>{site.name}</title>`.

Run: `npm run build && npx playwright test tests/smoke.spec.ts`
Expected: build succeeds; `2 passed`.

Then prove that bad content fails the build: set the first photo's `"alt"` in `photos.json` to `""` and run `npm run build`.
Expected: build FAILS with `photos.json is invalid:` … `alt text is required`. Restore the alt text and rebuild successfully.

- [ ] **Step 7: Commit**

```bash
npm run format
git add -A
git commit -m "feat: add validated content model with demo seed photos

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

---

### Task 3: Cloudinary URL builder and `<Photo>` component

**Files:**
- Create: `src/lib/cloudinary.ts`, `src/lib/cloudinary.test.ts`, `src/components/Photo.astro`

**Interfaces:**
- Consumes: `Photo` and `site.cloudName` (Task 2).
- Produces:
  - `type Width = 400 | 800 | 1600 | 2560`, and `const WIDTHS: readonly Width[]`
  - `urlFor(cloud: string, id: string, width: Width): string`
  - `srcsetEntries(originalWidth: number): { width: Width; descriptor: number }[]`
  - `srcsetFor(cloud: string, photo: { id: string; width: number }): string`
  - `defaultWidth(originalWidth: number): Width`
  - `<Photo photo={Photo} sizes="…" priority?={boolean} class?="…" />` renders a single `<img>`.

- [ ] **Step 1: Write the failing tests**

`src/lib/cloudinary.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { defaultWidth, srcsetEntries, srcsetFor, urlFor } from './cloudinary';

describe('urlFor', () => {
  it('builds a delivery URL with auto format/quality and a width limit', () => {
    expect(urlFor('demo', 'samples/people/jazz', 800)).toBe(
      'https://res.cloudinary.com/demo/image/upload/f_auto,q_auto,c_limit,w_800/samples/people/jazz',
    );
  });

  it('URL-encodes each segment of a public id with spaces or #', () => {
    expect(urlFor('demo', 'portfolio/galas/Award Night #1', 400)).toBe(
      'https://res.cloudinary.com/demo/image/upload/f_auto,q_auto,c_limit,w_400/portfolio/galas/Award%20Night%20%231',
    );
  });
});

describe('srcsetEntries', () => {
  it('uses all four widths for large originals', () => {
    expect(srcsetEntries(6000)).toEqual([
      { width: 400, descriptor: 400 },
      { width: 800, descriptor: 800 },
      { width: 1600, descriptor: 1600 },
      { width: 2560, descriptor: 2560 },
    ]);
  });

  it('describes the capped size instead of claiming an upscale', () => {
    expect(srcsetEntries(1333)).toEqual([
      { width: 400, descriptor: 400 },
      { width: 800, descriptor: 800 },
      { width: 1600, descriptor: 1333 },
    ]);
  });

  it('stops at a width equal to the original', () => {
    expect(srcsetEntries(800)).toEqual([
      { width: 400, descriptor: 400 },
      { width: 800, descriptor: 800 },
    ]);
  });

  it('handles originals smaller than the smallest width', () => {
    expect(srcsetEntries(300)).toEqual([{ width: 400, descriptor: 300 }]);
  });
});

describe('srcsetFor', () => {
  it('joins entries into a srcset string', () => {
    expect(srcsetFor('demo', { id: 'woman', width: 1000 })).toBe(
      [
        'https://res.cloudinary.com/demo/image/upload/f_auto,q_auto,c_limit,w_400/woman 400w',
        'https://res.cloudinary.com/demo/image/upload/f_auto,q_auto,c_limit,w_800/woman 800w',
        'https://res.cloudinary.com/demo/image/upload/f_auto,q_auto,c_limit,w_1600/woman 1000w',
      ].join(', '),
    );
  });
});

describe('defaultWidth', () => {
  it('prefers 1600 when available, else the largest entry', () => {
    expect(defaultWidth(6000)).toBe(1600);
    expect(defaultWidth(1333)).toBe(1600);
    expect(defaultWidth(800)).toBe(800);
    expect(defaultWidth(300)).toBe(400);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/lib/cloudinary.test.ts`
Expected: FAIL — `Failed to resolve import "./cloudinary"`.

- [ ] **Step 3: Implement the builder**

`src/lib/cloudinary.ts`:
```ts
// The only Cloudinary-specific module. To move images to another host, replace this file.
export type Width = 400 | 800 | 1600 | 2560;
export const WIDTHS: readonly Width[] = [400, 800, 1600, 2560];

const BASE = 'https://res.cloudinary.com';

function encodeId(id: string): string {
  return id.split('/').map(encodeURIComponent).join('/');
}

export function urlFor(cloud: string, id: string, width: Width): string {
  return `${BASE}/${cloud}/image/upload/f_auto,q_auto,c_limit,w_${width}/${encodeId(id)}`;
}

/**
 * Widths to request for an original. c_limit never upscales, so the first width at or above
 * the original is described by the original's real width.
 */
export function srcsetEntries(originalWidth: number): { width: Width; descriptor: number }[] {
  const entries: { width: Width; descriptor: number }[] = [];
  for (const width of WIDTHS) {
    if (width < originalWidth) {
      entries.push({ width, descriptor: width });
    } else {
      entries.push({ width, descriptor: originalWidth });
      break;
    }
  }
  return entries;
}

export function srcsetFor(cloud: string, photo: { id: string; width: number }): string {
  return srcsetEntries(photo.width)
    .map(({ width, descriptor }) => `${urlFor(cloud, photo.id, width)} ${descriptor}w`)
    .join(', ');
}

export function defaultWidth(originalWidth: number): Width {
  const entries = srcsetEntries(originalWidth);
  return entries.find((e) => e.width === 1600)?.width ?? entries[entries.length - 1].width;
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run src/lib/cloudinary.test.ts`
Expected: `8 passed`.

- [ ] **Step 5: Write the `<Photo>` component**

`src/components/Photo.astro`:
```astro
---
import { defaultWidth, srcsetFor, urlFor } from '../lib/cloudinary';
import { site } from '../lib/content';
import type { Photo } from '../lib/schema';

interface Props {
  photo: Photo;
  sizes: string;
  priority?: boolean;
  class?: string;
}

const { photo, sizes, priority = false, class: className } = Astro.props;
// The blurred placeholder sits behind the image and is covered once the (opaque) photo paints.
const style = photo.placeholder
  ? `background-image:url(${photo.placeholder});background-size:cover`
  : undefined;
---

<img
  class:list={['photo', className]}
  src={urlFor(site.cloudName, photo.id, defaultWidth(photo.width))}
  srcset={srcsetFor(site.cloudName, photo)}
  sizes={sizes}
  width={photo.width}
  height={photo.height}
  alt={photo.alt}
  loading={priority ? 'eager' : 'lazy'}
  fetchpriority={priority ? 'high' : 'auto'}
  decoding="async"
  style={style}
/>
```

- [ ] **Step 6: Type-check and commit**

Run: `npm run check`
Expected: `0 errors`.

```bash
npm run format
git add -A
git commit -m "feat: add Cloudinary URL builder and Photo component

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

---

### Task 4: Base layout, header, footer and global styles

**Files:**
- Create: `src/styles/global.css`, `src/layouts/Base.astro`, `src/components/Header.astro`, `src/components/Footer.astro`, `public/favicon.svg`, `tests/layout.spec.ts`
- Modify: `src/pages/index.astro` (switch to `Base`)

**Interfaces:**
- Consumes: `site` and `sets` from `src/lib/content.ts`.
- Produces: `<Base title?={string} description?={string} noindex?={boolean}>` wrapping page content in `<main id="main">`. CSS custom properties `--font`, `--ink`, `--muted`, `--line`, `--paper`, `--gutter`, `--header-h`. Utility class `.visually-hidden`, and the `.page` content wrapper.

- [ ] **Step 1: Write the failing test**

`tests/layout.spec.ts`:
```ts
import { expect, test } from '@playwright/test';
import { firstSet, site } from './helpers';

test('header shows the wordmark and main navigation', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('link', { name: site.name, exact: true })).toHaveAttribute('href', '/');
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
```

- [ ] **Step 2: Run to verify it fails**

Run: `npm run build && npx playwright test tests/layout.spec.ts`
Expected: FAIL — the navigation `Main` is not found.

- [ ] **Step 3: Global styles**

`src/styles/global.css`:
```css
:root {
  --font: 'Helvetica Neue', Helvetica, Arial, system-ui, sans-serif;
  --ink: #111;
  --muted: #555;
  --line: #e6e6e6;
  --paper: #fff;
  --gutter: clamp(1rem, 3vw, 2.75rem);
  --header-h: 5.5rem;
}

*,
*::before,
*::after {
  box-sizing: border-box;
}

html {
  -webkit-text-size-adjust: 100%;
}

body {
  margin: 0;
  min-height: 100svh;
  display: flex;
  flex-direction: column;
  font-family: var(--font);
  line-height: 1.5;
  color: var(--ink);
  background: var(--paper);
}

main {
  flex: 1;
}

img {
  display: block;
  max-width: 100%;
  height: auto;
}

a {
  color: inherit;
}

[hidden] {
  display: none !important;
}

:focus-visible {
  outline: 2px solid var(--ink);
  outline-offset: 3px;
}

.visually-hidden {
  position: absolute !important;
  width: 1px;
  height: 1px;
  margin: -1px;
  padding: 0;
  overflow: hidden;
  clip: rect(0 0 0 0);
  white-space: nowrap;
  border: 0;
}

.skip-link {
  position: absolute;
  left: var(--gutter);
  top: -3rem;
  z-index: 10;
  padding: 0.5rem 0.75rem;
  background: var(--ink);
  color: var(--paper);
}

.skip-link:focus {
  top: 0.5rem;
}

.page {
  max-width: 72rem;
  margin: 0 auto;
  padding: 2rem var(--gutter) 4rem;
}

.prose {
  max-width: 38rem;
}

.prose h2 {
  margin: 2rem 0 0.5rem;
  font-size: 1.25rem;
  font-weight: 500;
}
```

- [ ] **Step 4: Header, footer, favicon and layout**

`src/components/Header.astro`:
```astro
---
import { sets, site } from '../lib/content';

const path = Astro.url.pathname;
const links = [
  { href: `/gallery/${sets[0].slug}`, label: 'Gallery', section: '/gallery' },
  { href: '/about', label: 'About', section: '/about' },
  { href: '/contact', label: 'Contact', section: '/contact' },
];
const isCurrent = (section: string) => path === section || path.startsWith(`${section}/`);
---

<header class="site-header">
  <a class="wordmark" href="/">{site.name}</a>
  <nav aria-label="Main">
    <ul>
      {
        links.map((link) => (
          <li>
            <a href={link.href} aria-current={isCurrent(link.section) ? 'true' : undefined}>
              {link.label}
            </a>
          </li>
        ))
      }
    </ul>
  </nav>
</header>

<style>
  .site-header {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: space-between;
    gap: 0.75rem 2rem;
    min-height: var(--header-h);
    padding: 1rem var(--gutter);
  }
  .wordmark {
    font-size: clamp(1.375rem, 2.6vw, 2rem);
    letter-spacing: -0.02em;
    text-decoration: none;
  }
  ul {
    display: flex;
    gap: 1.5rem;
    margin: 0;
    padding: 0;
    list-style: none;
  }
  nav a {
    padding-bottom: 2px;
    text-decoration: none;
  }
  nav a[aria-current],
  nav a:hover {
    border-bottom: 1px solid currentColor;
  }
</style>
```

`src/components/Footer.astro`:
```astro
---
import { site } from '../lib/content';

const year = new Date().getFullYear();
---

<footer class="site-footer">
  <p>
    © {year}
    {site.name} · {site.owner} · <a href={`mailto:${site.email}`}>{site.email}</a>
  </p>
</footer>

<style>
  .site-footer {
    padding: 1.5rem var(--gutter) 2rem;
    border-top: 1px solid var(--line);
    font-size: 0.8125rem;
    text-align: center;
    color: var(--muted);
  }
  p {
    margin: 0;
  }
</style>
```

`public/favicon.svg`:
```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><rect width="32" height="32" fill="#111"/><text x="16" y="22" font-family="Helvetica, Arial, sans-serif" font-size="15" font-weight="700" text-anchor="middle" fill="#fff">FTL</text></svg>
```

`src/layouts/Base.astro` (Task 10 replaces this with an SEO-complete version):
```astro
---
import '../styles/global.css';
import Footer from '../components/Footer.astro';
import Header from '../components/Header.astro';
import { site } from '../lib/content';

interface Props {
  title?: string;
  description?: string;
  noindex?: boolean;
}

const { title, description = site.description, noindex = false } = Astro.props;
const fullTitle = title ? `${title} — ${site.name}` : site.name;
const robots = noindex ? 'noindex, noai, noimageai' : 'noai, noimageai';
---

<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>{fullTitle}</title>
    <meta name="description" content={description} />
    <meta name="robots" content={robots} />
    <link rel="preconnect" href="https://res.cloudinary.com" />
    <link rel="icon" href="/favicon.svg" type="image/svg+xml" />
  </head>
  <body>
    <a class="skip-link" href="#main">Skip to content</a>
    <Header />
    <main id="main"><slot /></main>
    <Footer />
  </body>
</html>
```

`src/pages/index.astro` (still temporary; Task 5 fills it in):
```astro
---
import Base from '../layouts/Base.astro';
---

<Base>
  <h1 class="page">Coming soon</h1>
</Base>
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `npm run build && npx playwright test tests/layout.spec.ts tests/smoke.spec.ts`
Expected: all pass on desktop and mobile.

- [ ] **Step 6: Commit**

```bash
npm run format
git add -A
git commit -m "feat: add base layout, header, footer and global styles

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

---

### Task 5: Homepage hero

**Files:**
- Modify: `src/pages/index.astro` (full replacement)
- Create: `tests/home.spec.ts`

**Interfaces:**
- Consumes: `<Base>`, `<Photo>`, and `hero`, `sets`, `site` from content.

- [ ] **Step 1: Write the failing test**

`tests/home.spec.ts`:
```ts
import { expect, test } from '@playwright/test';
import { firstSet, site } from './helpers';

test('hero image fills the screen and loads with high priority', async ({ page }) => {
  await page.goto('/');
  const hero = page.locator('.hero img');
  await expect(hero).toHaveAttribute('loading', 'eager');
  await expect(hero).toHaveAttribute('fetchpriority', 'high');
  await expect(hero).toHaveAttribute(
    'srcset',
    new RegExp(`res\\.cloudinary\\.com/${site.cloudName}/image/upload/f_auto,q_auto,c_limit,w_400/`),
  );
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
```

- [ ] **Step 2: Run to verify it fails**

Run: `npm run build && npx playwright test tests/home.spec.ts`
Expected: FAIL — `.hero img` not found.

- [ ] **Step 3: Implement the homepage**

`src/pages/index.astro`:
```astro
---
import Photo from '../components/Photo.astro';
import Base from '../layouts/Base.astro';
import { hero, sets, site } from '../lib/content';
---

<Base>
  <section class="hero">
    <Photo photo={hero} sizes="100vw" priority class="hero__img" />
    <div class="hero__overlay">
      <h1 class="hero__tagline">{site.tagline}</h1>
      <a class="hero__link" href={`/gallery/${sets[0].slug}`}>View the work →</a>
    </div>
  </section>
</Base>

<style>
  .hero {
    position: relative;
    height: calc(100svh - var(--header-h));
    min-height: 26rem;
    overflow: hidden;
    background: #222;
  }
  .hero :global(.hero__img) {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }
  .hero::after {
    content: '';
    position: absolute;
    inset: auto 0 0 0;
    height: 50%;
    background: linear-gradient(transparent, rgb(0 0 0 / 55%));
  }
  .hero__overlay {
    position: absolute;
    left: var(--gutter);
    right: var(--gutter);
    bottom: clamp(1.5rem, 6vh, 3.5rem);
    z-index: 1;
    color: #fff;
  }
  .hero__tagline {
    max-width: 18ch;
    margin: 0;
    font-size: clamp(2rem, 5vw, 3.75rem);
    font-weight: 500;
    line-height: 1.05;
    letter-spacing: -0.03em;
  }
  .hero__link {
    display: inline-block;
    margin-top: 1rem;
    padding-bottom: 2px;
    border-bottom: 1px solid currentColor;
    color: #fff;
    text-decoration: none;
  }
</style>
```

- [ ] **Step 4: Run to verify it passes**

Run: `npm run build && npx playwright test tests/home.spec.ts tests/layout.spec.ts`
Expected: all pass.

- [ ] **Step 5: Commit**

```bash
npm run format
git add -A
git commit -m "feat: add full-screen hero homepage

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

---

### Task 6: Gallery set pages (no-JS list), set switcher, `/gallery` redirect

**Files:**
- Modify: `astro.config.mjs` (full replacement)
- Create: `src/components/SetSwitcher.astro`, `src/components/Slideshow.astro`, `src/pages/gallery/[set].astro`, `tests/gallery-static.spec.ts`

**Interfaces:**
- Consumes: `sets`, `site`, `PhotoSet`, `<Photo>`, `urlFor`.
- Produces the DOM contract that Task 8's script relies on:
  - `section.set[data-slideshow]` contains:
    - `.set__stage`, holding `button.slideshow__nav[data-dir="-1"]`, then `ol.set__list > li.set__item > figure > img + figcaption`, then `button.slideshow__nav[data-dir="1"]`
    - `p.slideshow__status[aria-live="polite"]`
    - `div.slideshow__thumbs > button.slideshow__thumb[data-index]`
  - The nav buttons and the thumbs container start `hidden`.
  - CSS state classes: `.is-enhanced` on the section, and `.is-active` on the item and thumb.

- [ ] **Step 1: Write the failing test**

`tests/gallery-static.spec.ts`:
```ts
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
  const redirects = readFileSync('dist/_redirects', 'utf8');
  expect(redirects).toContain(`/gallery /gallery/${firstSet.slug} 301`);
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npm run build && npx playwright test tests/gallery-static.spec.ts`
Expected: FAIL — `/gallery/conferences` returns 404.

- [ ] **Step 3: Astro config with redirects and sitemap**

`astro.config.mjs`:
```js
import { writeFile } from 'node:fs/promises';
import sitemap from '@astrojs/sitemap';
import { defineConfig } from 'astro/config';
import photos from './src/content/photos.json' with { type: 'json' };

const firstSet = photos.sets[0].slug;

/** Writes dist/_redirects so Netlify serves /gallery as a real 301 (Astro emits a meta refresh). */
function netlifyRedirects() {
  return {
    name: 'netlify-redirects',
    hooks: {
      'astro:build:done': async ({ dir }) => {
        const rules = [`/gallery /gallery/${firstSet} 301`, `/gallery/ /gallery/${firstSet} 301`];
        await writeFile(new URL('_redirects', dir), `${rules.join('\n')}\n`);
      },
    },
  };
}

export default defineConfig({
  site: 'https://fasterthanlight.studio',
  output: 'static',
  // Emit scripts as files (never inline) so the CSP can use script-src 'self'.
  vite: { build: { assetsInlineLimit: 0 } },
  redirects: { '/gallery': `/gallery/${firstSet}` },
  integrations: [
    sitemap({ filter: (page) => !/\/(thanks|gallery)\/?$/.test(page) }),
    netlifyRedirects(),
  ],
});
```

- [ ] **Step 4: Set switcher**

`src/components/SetSwitcher.astro`:
```astro
---
import type { PhotoSet } from '../lib/schema';

interface Props {
  sets: PhotoSet[];
  current: string;
}

const { sets, current } = Astro.props;
---

<nav class="switcher" aria-label="Event types">
  <ul>
    {
      sets.map((set) => (
        <li>
          <a href={`/gallery/${set.slug}`} aria-current={set.slug === current ? 'page' : undefined}>
            {set.title}
          </a>
        </li>
      ))
    }
  </ul>
</nav>

<style>
  .switcher {
    padding: 0 var(--gutter) 1.25rem;
  }
  ul {
    display: flex;
    flex-wrap: wrap;
    justify-content: center;
    gap: 0.5rem 1.5rem;
    margin: 0;
    padding: 0;
    list-style: none;
    font-size: 0.9375rem;
  }
  a {
    padding-bottom: 2px;
    color: var(--muted);
    text-decoration: none;
  }
  a[aria-current],
  a:hover {
    color: var(--ink);
    border-bottom: 1px solid currentColor;
  }
</style>
```

- [ ] **Step 5: Slideshow markup and styles**

This task writes only the no-JS list. The `<script>` block is added in Task 8.

`src/components/Slideshow.astro`:
```astro
---
import Photo from './Photo.astro';
import { urlFor } from '../lib/cloudinary';
import { site } from '../lib/content';
import type { PhotoSet } from '../lib/schema';

interface Props {
  set: PhotoSet;
}

const { set } = Astro.props;
const count = set.photos.length;
---

<section class="set" data-slideshow aria-label={set.title}>
  <div class="set__stage">
    <button class="slideshow__nav" data-dir="-1" type="button" aria-label="Previous photo" hidden>
      ‹
    </button>
    <ol class="set__list">
      {
        set.photos.map((photo, i) => (
          <li class="set__item">
            <figure>
              <Photo photo={photo} sizes="(min-width: 64rem) 80vw, 100vw" priority={i === 0} />
              <figcaption>{photo.caption ?? ''}</figcaption>
            </figure>
          </li>
        ))
      }
    </ol>
    <button class="slideshow__nav" data-dir="1" type="button" aria-label="Next photo" hidden>
      ›
    </button>
  </div>
  <p class="slideshow__status visually-hidden" aria-live="polite"></p>
  <div class="slideshow__thumbs" hidden>
    {
      set.photos.map((photo, i) => (
        <button
          class="slideshow__thumb"
          type="button"
          data-index={i}
          aria-label={`Photo ${i + 1} of ${count}`}
        >
          <img
            src={urlFor(site.cloudName, photo.id, 400)}
            alt=""
            width="56"
            height="56"
            loading="lazy"
            decoding="async"
          />
        </button>
      ))
    }
  </div>
</section>

<style>
  .set {
    padding: 0 var(--gutter) 2.5rem;
  }
  .set__list {
    display: grid;
    gap: 3rem;
    margin: 0;
    padding: 0;
    list-style: none;
  }
  figure {
    margin: 0;
  }
  .set__item :global(img) {
    margin: 0 auto;
  }
  figcaption {
    min-height: 1.5em;
    margin-top: 0.75rem;
    font-size: 0.875rem;
    text-align: center;
    color: var(--muted);
  }

  /* Slideshow mode, switched on by the script (Task 8). */
  .set.is-enhanced .set__stage {
    display: grid;
    grid-template-columns: 2.75rem minmax(0, 1fr) 2.75rem;
    align-items: center;
  }
  .set.is-enhanced .set__list {
    display: block;
    touch-action: pan-y;
  }
  .set.is-enhanced .set__item {
    display: none;
  }
  .set.is-enhanced .set__item.is-active {
    display: block;
  }
  .set.is-enhanced .set__item :global(img) {
    width: auto;
    height: auto;
    max-width: 100%;
    max-height: calc(100svh - 18rem);
    object-fit: contain;
  }
  .slideshow__nav {
    height: 3rem;
    padding: 0;
    border: 0;
    background: none;
    font: inherit;
    font-size: 1.75rem;
    line-height: 1;
    color: var(--muted);
    cursor: pointer;
  }
  .slideshow__nav:hover {
    color: var(--ink);
  }
  .slideshow__thumbs {
    display: flex;
    justify-content: safe center;
    gap: 0.5rem;
    margin-top: 1rem;
    padding: 0.25rem;
    overflow-x: auto;
    scrollbar-width: thin;
  }
  .slideshow__thumb {
    flex: 0 0 auto;
    padding: 0;
    border: 0;
    background: none;
    opacity: 0.5;
    cursor: pointer;
  }
  .slideshow__thumb img {
    width: 3.5rem;
    height: 3.5rem;
    object-fit: cover;
  }
  .slideshow__thumb.is-active,
  .slideshow__thumb:hover {
    opacity: 1;
  }
  .slideshow__thumb.is-active {
    outline: 2px solid var(--ink);
    outline-offset: 2px;
  }
  @media (prefers-reduced-motion: no-preference) {
    .set.is-enhanced .set__item.is-active {
      animation: fade-in 0.25s ease;
    }
  }
  @keyframes fade-in {
    from {
      opacity: 0;
    }
  }
</style>
```

- [ ] **Step 6: Gallery page**

`src/pages/gallery/[set].astro`:
```astro
---
import type { GetStaticPaths } from 'astro';
import SetSwitcher from '../../components/SetSwitcher.astro';
import Slideshow from '../../components/Slideshow.astro';
import Base from '../../layouts/Base.astro';
import { sets, site } from '../../lib/content';
import type { PhotoSet } from '../../lib/schema';

export const getStaticPaths = (() =>
  sets.map((set) => ({ params: { set: set.slug }, props: { set } }))) satisfies GetStaticPaths;

interface Props {
  set: PhotoSet;
}

const { set } = Astro.props;
---

<Base title={set.title} description={`${set.title} — corporate event photography by ${site.owner}.`}>
  <h1 class="visually-hidden">{set.title}</h1>
  <SetSwitcher sets={sets} current={set.slug} />
  <Slideshow set={set} />
</Base>
```

- [ ] **Step 7: Run to verify it passes**

Run: `npm run build && npx playwright test tests/gallery-static.spec.ts`
Expected: all pass. The caption test runs, because the seed data has caption-less photos.

- [ ] **Step 8: Commit**

```bash
npm run format
git add -A
git commit -m "feat: add gallery set pages with set switcher and /gallery redirect

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

---

### Task 7: Slideshow state logic

**Files:**
- Create: `src/scripts/slideshow-state.ts`, `src/scripts/slideshow-state.test.ts`

**Interfaces:**
- Produces:
  - `wrapIndex(index: number, count: number): number` (always in `[0, count)`; 0 when `count <= 0`)
  - `indexFromHash(hash: string, count: number): number` (0 for invalid or out-of-range hashes)
  - `hashForIndex(index: number): string`
  - `swipeDirection(dx: number, dy: number, threshold?: number): -1 | 0 | 1`

- [ ] **Step 1: Write the failing tests**

`src/scripts/slideshow-state.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { hashForIndex, indexFromHash, swipeDirection, wrapIndex } from './slideshow-state';

describe('wrapIndex', () => {
  it('keeps in-range indexes', () => {
    expect(wrapIndex(0, 3)).toBe(0);
    expect(wrapIndex(2, 3)).toBe(2);
  });
  it('wraps past either end', () => {
    expect(wrapIndex(3, 3)).toBe(0);
    expect(wrapIndex(-1, 3)).toBe(2);
    expect(wrapIndex(5, 3)).toBe(2);
  });
  it('always returns 0 for a single-photo set', () => {
    expect(wrapIndex(1, 1)).toBe(0);
    expect(wrapIndex(-1, 1)).toBe(0);
  });
  it('returns 0 for an empty set', () => {
    expect(wrapIndex(4, 0)).toBe(0);
  });
});

describe('indexFromHash', () => {
  it('maps 1-based hashes to 0-based indexes', () => {
    expect(indexFromHash('#1', 3)).toBe(0);
    expect(indexFromHash('#3', 3)).toBe(2);
    expect(indexFromHash('#02', 3)).toBe(1);
  });
  it('falls back to the first photo for missing, malformed or out-of-range hashes', () => {
    for (const hash of ['', '#', '#0', '#4', '#99', '#abc', '#2abc', '#-1', '#1.5']) {
      expect(indexFromHash(hash, 3)).toBe(0);
    }
  });
});

describe('hashForIndex', () => {
  it('is 1-based', () => {
    expect(hashForIndex(0)).toBe('#1');
    expect(hashForIndex(6)).toBe('#7');
  });
});

describe('swipeDirection', () => {
  it('swiping left goes to the next photo', () => {
    expect(swipeDirection(-80, 10)).toBe(1);
  });
  it('swiping right goes to the previous photo', () => {
    expect(swipeDirection(80, 10)).toBe(-1);
  });
  it('ignores short or mostly-vertical gestures', () => {
    expect(swipeDirection(-30, 0)).toBe(0);
    expect(swipeDirection(-80, 120)).toBe(0);
    expect(swipeDirection(0, 0)).toBe(0);
  });
});
```

- [ ] **Step 2: Run to verify they fail**

Run: `npx vitest run src/scripts/slideshow-state.test.ts`
Expected: FAIL — `Failed to resolve import "./slideshow-state"`.

- [ ] **Step 3: Implement**

`src/scripts/slideshow-state.ts`:
```ts
export function wrapIndex(index: number, count: number): number {
  if (count <= 0) return 0;
  return ((index % count) + count) % count;
}

/** "#7" → 6. Anything malformed or out of range opens the first photo. */
export function indexFromHash(hash: string, count: number): number {
  const match = /^#(\d+)$/.exec(hash);
  if (!match) return 0;
  const n = Number(match[1]);
  return n >= 1 && n <= count ? n - 1 : 0;
}

export function hashForIndex(index: number): string {
  return `#${index + 1}`;
}

/** +1 = next (swipe left), -1 = previous (swipe right), 0 = not a horizontal swipe. */
export function swipeDirection(dx: number, dy: number, threshold = 50): -1 | 0 | 1 {
  if (Math.abs(dx) < threshold || Math.abs(dx) <= Math.abs(dy)) return 0;
  return dx < 0 ? 1 : -1;
}
```

- [ ] **Step 4: Run to verify they pass**

Run: `npx vitest run src/scripts/slideshow-state.test.ts`
Expected: `10 passed`.

- [ ] **Step 5: Commit**

```bash
npm run format
git add -A
git commit -m "feat: add slideshow index, hash and swipe logic

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

---

### Task 8: Slideshow enhancement script

**Files:**
- Create: `src/scripts/slideshow.ts`, `tests/slideshow.spec.ts`
- Modify: `src/components/Slideshow.astro` (append a `<script>` block after `</section>`)

**Interfaces:**
- Consumes: the Task 6 DOM contract and the Task 7 functions.
- Produces: `enhance(root: HTMLElement): void`.

- [ ] **Step 1: Write the failing test**

`tests/slideshow.spec.ts`:
```ts
import { expect, test, type Page } from '@playwright/test';
import { photos, setWith } from './helpers';

const multi = setWith((s) => s.photos.length >= 3)!;
const n = multi.photos.length;
const items = (page: Page) => page.locator('.set__item');
const activeIndex = (page: Page) =>
  page.locator('.set__item').evaluateAll((els) => els.findIndex((el) => el.classList.contains('is-active')));

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
  await expect(items(page).nth(n - 1).locator('img')).toHaveAttribute('loading', 'eager');
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
```

- [ ] **Step 2: Run to verify it fails**

Run: `npm run build && npx playwright test tests/slideshow.spec.ts`
Expected: FAIL — `.set.is-enhanced` not found.

- [ ] **Step 3: Implement the enhancement**

`src/scripts/slideshow.ts`:
```ts
import { hashForIndex, indexFromHash, swipeDirection, wrapIndex } from './slideshow-state';

/** Turns a no-JS photo list (see Slideshow.astro) into a one-photo-at-a-time slideshow. */
export function enhance(root: HTMLElement): void {
  const items = Array.from(root.querySelectorAll<HTMLElement>('.set__item'));
  const thumbs = Array.from(root.querySelectorAll<HTMLButtonElement>('.slideshow__thumb'));
  const navButtons = Array.from(root.querySelectorAll<HTMLButtonElement>('.slideshow__nav'));
  const thumbStrip = root.querySelector<HTMLElement>('.slideshow__thumbs');
  const status = root.querySelector<HTMLElement>('.slideshow__status');
  const list = root.querySelector<HTMLElement>('.set__list');
  const count = items.length;
  if (count === 0 || !list) return;

  let current = -1;

  function centerThumb(index: number): void {
    const thumb = thumbs[index];
    if (!thumbStrip || !thumb) return;
    thumbStrip.scrollLeft = thumb.offsetLeft - (thumbStrip.clientWidth - thumb.clientWidth) / 2;
  }

  function show(index: number, fromUser: boolean): void {
    const next = wrapIndex(index, count);
    if (next === current) return;
    current = next;

    items.forEach((item, i) => item.classList.toggle('is-active', i === current));
    thumbs.forEach((thumb, i) => {
      const active = i === current;
      thumb.classList.toggle('is-active', active);
      if (active) thumb.setAttribute('aria-current', 'true');
      else thumb.removeAttribute('aria-current');
    });

    // Preload neighbours so next/previous feel instant.
    for (const offset of [1, -1]) {
      const img = items[wrapIndex(current + offset, count)].querySelector('img');
      if (img) img.loading = 'eager';
    }
    centerThumb(current);

    if (fromUser) {
      history.replaceState(null, '', hashForIndex(current));
      if (status) {
        const caption = items[current].querySelector('figcaption')?.textContent?.trim();
        status.textContent = `Photo ${current + 1} of ${count}${caption ? `: ${caption}` : ''}`;
      }
    }
  }

  root.classList.add('is-enhanced');
  if (count > 1) {
    navButtons.forEach((button) => (button.hidden = false));
    if (thumbStrip) thumbStrip.hidden = false;
  }
  show(indexFromHash(location.hash, count), false);

  navButtons.forEach((button) =>
    button.addEventListener('click', () => show(current + Number(button.dataset.dir), true)),
  );
  thumbs.forEach((thumb, i) => thumb.addEventListener('click', () => show(i, true)));

  document.addEventListener('keydown', (event) => {
    if (count < 2 || event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return;
    if (event.key === 'ArrowLeft') show(current - 1, true);
    else if (event.key === 'ArrowRight') show(current + 1, true);
  });

  let start: { x: number; y: number } | null = null;
  list.addEventListener('pointerdown', (event) => {
    start = event.pointerType === 'mouse' ? null : { x: event.clientX, y: event.clientY };
  });
  list.addEventListener('pointerup', (event) => {
    if (!start || count < 2) return;
    const direction = swipeDirection(event.clientX - start.x, event.clientY - start.y);
    start = null;
    if (direction !== 0) show(current + direction, true);
  });

  window.addEventListener('hashchange', () => show(indexFromHash(location.hash, count), true));
}
```

Append to the end of `src/components/Slideshow.astro`, after the closing `</style>` tag:
```astro
<script>
  import { enhance } from '../scripts/slideshow';

  document.querySelectorAll<HTMLElement>('[data-slideshow]').forEach(enhance);
</script>
```

- [ ] **Step 4: Run to verify it passes**

Run: `npm run build && npx playwright test tests/slideshow.spec.ts tests/gallery-static.spec.ts`
Expected: all pass. The single-photo and portrait tests run, because the seed has `launches` and `samples/man-portrait`.

- [ ] **Step 5: Confirm the script is an external file (CSP)**

Run: `grep -o '<script[^>]*>' dist/gallery/conferences/index.html`
Expected: exactly one tag, of the form `<script type="module" src="/_astro/….js">`, with no inline script body.

- [ ] **Step 6: Commit**

```bash
npm run format
git add -A
git commit -m "feat: enhance gallery sets into keyboard/swipe/thumbnail slideshows

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

---

### Task 9: About, Contact, Thanks and 404 pages

**Files:**
- Create: `src/content/about.md`, `src/pages/about.astro`, `src/pages/contact.astro`, `src/pages/thanks.astro`, `src/pages/404.astro`, `tests/pages.spec.ts`

**Interfaces:**
- Consumes: `<Base>` (including `noindex`), `<Photo>`, and `portrait`, `sets`, `site`.

- [ ] **Step 1: Write the failing test**

`tests/pages.spec.ts`:
```ts
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
```

- [ ] **Step 2: Run to verify it fails**

Run: `npm run build && npx playwright test tests/pages.spec.ts`
Expected: FAIL — `/about` returns 404.

- [ ] **Step 3: About content and page**

`src/content/about.md` (starter copy that David replaces with his own words):
```markdown
<!-- Starter copy — replace with your own words before launch. -->

FasterThanLight Studio is the corporate event photography practice of David Pham. I photograph
conferences, galas, product launches and on-site headshots for event, marketing and
communications teams who need images that are ready for the press release, the recap deck and
the social feed.

## How I work

- **Coverage:** half-day, full-day and multi-day events, from keynote stages to evening receptions.
- **Turnaround:** a first set of social-ready selects on request, and the full edited gallery soon after the event.
- **Deliverables:** high-resolution, edited images licensed for your marketing, PR and internal communications.
```

`src/pages/about.astro`:
```astro
---
import Photo from '../components/Photo.astro';
import { Content } from '../content/about.md';
import Base from '../layouts/Base.astro';
import { portrait, site } from '../lib/content';
---

<Base title="About" description={`About ${site.owner} and ${site.name}.`}>
  <article class="page about">
    <Photo photo={portrait} sizes="(min-width: 48rem) 20rem, 100vw" priority class="about__portrait" />
    <div class="prose">
      <h1>About</h1>
      <Content />
    </div>
  </article>
</Base>

<style>
  .about {
    display: grid;
    gap: 2.5rem;
    align-items: start;
  }
  @media (min-width: 48rem) {
    .about {
      grid-template-columns: 20rem minmax(0, 1fr);
    }
  }
  h1 {
    margin: 0 0 1rem;
    font-size: 2rem;
    font-weight: 500;
    letter-spacing: -0.02em;
  }
</style>
```

- [ ] **Step 4: Contact, Thanks and 404 pages**

`src/pages/contact.astro`:
```astro
---
import Base from '../layouts/Base.astro';
import { sets, site } from '../lib/content';
---

<Base title="Contact" description={`Book ${site.name} for your next corporate event.`}>
  <div class="page">
    <h1>Contact</h1>
    <p class="intro">
      Tell me about your event. Prefer email? Write to <a href={`mailto:${site.email}`}
        >{site.email}</a
      >.
    </p>
    <form
      name="inquiry"
      method="POST"
      action="/thanks"
      data-netlify="true"
      netlify-honeypot="bot-field"
    >
      <input type="hidden" name="form-name" value="inquiry" />
      <p class="visually-hidden" aria-hidden="true">
        <label>Leave this empty <input name="bot-field" tabindex="-1" autocomplete="off" /></label>
      </p>

      <div class="field">
        <label for="name">Name</label>
        <input id="name" name="name" autocomplete="name" required />
      </div>
      <div class="field">
        <label for="email">Email</label>
        <input id="email" name="email" type="email" autocomplete="email" required />
      </div>
      <div class="field">
        <label for="company">Company</label>
        <input id="company" name="company" autocomplete="organization" />
      </div>
      <div class="field">
        <label for="event-date">Event date</label>
        <input id="event-date" name="event-date" type="date" />
      </div>
      <div class="field">
        <label for="event-type">Event type</label>
        <select id="event-type" name="event-type">
          <option value="">Choose one</option>
          {sets.map((set) => <option>{set.title}</option>)}
          <option>Other</option>
        </select>
      </div>
      <div class="field">
        <label for="location">Location</label>
        <input id="location" name="location" />
      </div>
      <div class="field field--wide">
        <label for="message">Message</label>
        <textarea id="message" name="message" rows="6" required></textarea>
      </div>
      <button type="submit">Send inquiry</button>
    </form>
  </div>
</Base>

<style>
  h1 {
    margin: 0 0 0.5rem;
    font-size: 2rem;
    font-weight: 500;
    letter-spacing: -0.02em;
  }
  .intro {
    margin: 0 0 2rem;
    color: var(--muted);
  }
  form {
    display: grid;
    gap: 1.25rem 1.5rem;
    max-width: 44rem;
  }
  @media (min-width: 40rem) {
    form {
      grid-template-columns: 1fr 1fr;
    }
    .field--wide,
    button {
      grid-column: 1 / -1;
    }
  }
  .field {
    display: grid;
    gap: 0.375rem;
  }
  label {
    font-size: 0.875rem;
  }
  input,
  select,
  textarea {
    width: 100%;
    padding: 0.625rem 0.75rem;
    border: 1px solid #bbb;
    border-radius: 0;
    font: inherit;
    background: var(--paper);
    color: var(--ink);
  }
  button {
    justify-self: start;
    padding: 0.75rem 1.5rem;
    border: 0;
    background: var(--ink);
    color: var(--paper);
    font: inherit;
    cursor: pointer;
  }
</style>
```

`src/pages/thanks.astro`:
```astro
---
import Base from '../layouts/Base.astro';
import { sets } from '../lib/content';
---

<Base title="Thank you" noindex>
  <div class="page prose">
    <h1>Thank you</h1>
    <p>Your inquiry is on its way. I'll reply by email soon.</p>
    <p><a href={`/gallery/${sets[0].slug}`}>Back to the gallery</a></p>
  </div>
</Base>
```

`src/pages/404.astro`:
```astro
---
import Base from '../layouts/Base.astro';
import { sets } from '../lib/content';
---

<Base title="Page not found" noindex>
  <div class="page prose">
    <h1>Page not found</h1>
    <p>That page doesn't exist.</p>
    <p><a href={`/gallery/${sets[0].slug}`}>Go to the gallery</a></p>
  </div>
</Base>
```

- [ ] **Step 5: Run to verify it passes**

Run: `npm run build && npx playwright test tests/pages.spec.ts`
Expected: all pass.

- [ ] **Step 6: Commit**

```bash
npm run format
git add -A
git commit -m "feat: add about, contact (Netlify Forms), thanks and 404 pages

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

---

### Task 10: SEO, AI-scraping defenses, Netlify headers and domain redirects

**Files:**
- Modify: `src/layouts/Base.astro` (full replacement)
- Create: `public/robots.txt`, `netlify.toml`, `tests/seo.spec.ts`

**Interfaces:**
- Consumes: `hero`, `site`, `urlFor`.
- Produces: canonical, Open Graph, Twitter and JSON-LD tags on every page, plus Netlify headers and redirects.

- [ ] **Step 1: Write the failing test**

`tests/seo.spec.ts`:
```ts
import { readFileSync } from 'node:fs';
import { expect, test } from '@playwright/test';
import { firstSet, photos, site } from './helpers';

const ORIGIN = 'https://fasterthanlight.studio';
const routes = ['/', `/gallery/${firstSet.slug}`, '/about', '/contact'];

test('each page has a unique title and description and a canonical URL', async ({ page }) => {
  const titles = new Set<string>();
  const descriptions = new Set<string>();
  for (const route of routes) {
    await page.goto(route);
    titles.add(await page.title());
    descriptions.add((await page.locator('meta[name="description"]').getAttribute('content'))!);
    const canonical = await page.locator('link[rel="canonical"]').getAttribute('href');
    expect(canonical).toMatch(new RegExp(`^${ORIGIN}${route === '/' ? '/' : `${route}/?`}$`));
  }
  expect(titles.size).toBe(routes.length);
  expect(descriptions.size).toBe(routes.length);
});

test('social cards use the hero image from Cloudinary', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('meta[property="og:image"]')).toHaveAttribute(
    'content',
    new RegExp(`/${site.cloudName}/image/upload/f_auto,q_auto,c_limit,w_1600/`),
  );
  await expect(page.locator('meta[property="og:site_name"]')).toHaveAttribute('content', site.name);
  await expect(page.locator('meta[name="twitter:card"]')).toHaveAttribute(
    'content',
    'summary_large_image',
  );
});

test('structured data describes the business', async ({ page }) => {
  await page.goto('/');
  const json = await page.locator('script[type="application/ld+json"]').textContent();
  const data = JSON.parse(json!);
  expect(data['@type']).toBe('ProfessionalService');
  expect(data.name).toBe(site.name);
  expect(data.url).toBe(`${ORIGIN}/`);
  expect(data.email).toBe(site.email);
});

test('robots.txt blocks AI crawlers and points at the sitemap', async ({ request }) => {
  const body = await (await request.get('/robots.txt')).text();
  for (const bot of ['GPTBot', 'ClaudeBot', 'Google-Extended', 'CCBot', 'PerplexityBot']) {
    expect(body).toContain(`User-agent: ${bot}`);
  }
  expect(body).toContain('Disallow: /');
  expect(body).toContain(`Sitemap: ${ORIGIN}/sitemap-index.xml`);
});

test('sitemap lists real pages but not thanks or the redirect', () => {
  const xml = readFileSync('dist/sitemap-0.xml', 'utf8');
  expect(xml).toContain(`${ORIGIN}/about`);
  for (const set of photos.sets) expect(xml).toContain(`${ORIGIN}/gallery/${set.slug}`);
  expect(xml).not.toContain('/thanks');
  expect(xml).not.toMatch(/\/gallery\/?<\/loc>/);
});

test('netlify.toml sets the protective headers and domain redirects', () => {
  const toml = readFileSync('netlify.toml', 'utf8');
  expect(toml).toContain('X-Robots-Tag = "noai, noimageai"');
  expect(toml).toContain("img-src 'self' data: https://res.cloudinary.com");
  expect(toml).toContain("script-src 'self'");
  expect(toml).toContain('from = "https://thisismynext.photos/*"');
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npm run build && npx playwright test tests/seo.spec.ts`
Expected: FAIL — canonical link not found.

- [ ] **Step 3: SEO-complete base layout**

`src/layouts/Base.astro`:
```astro
---
import '../styles/global.css';
import Footer from '../components/Footer.astro';
import Header from '../components/Header.astro';
import { urlFor } from '../lib/cloudinary';
import { hero, site } from '../lib/content';

interface Props {
  title?: string;
  description?: string;
  noindex?: boolean;
}

const { title, description = site.description, noindex = false } = Astro.props;
const fullTitle = title ? `${title} — ${site.name}` : site.name;
const robots = noindex ? 'noindex, noai, noimageai' : 'noai, noimageai';
const canonical = new URL(Astro.url.pathname, Astro.site).href;
const ogImage = urlFor(site.cloudName, hero.id, 1600);
const jsonLd = {
  '@context': 'https://schema.org',
  '@type': 'ProfessionalService',
  name: site.name,
  description: site.description,
  url: new URL('/', Astro.site).href,
  email: site.email,
  image: ogImage,
  founder: { '@type': 'Person', name: site.owner },
};
---

<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>{fullTitle}</title>
    <meta name="description" content={description} />
    <meta name="robots" content={robots} />
    <link rel="canonical" href={canonical} />
    <link rel="preconnect" href="https://res.cloudinary.com" />
    <link rel="icon" href="/favicon.svg" type="image/svg+xml" />
    <link rel="sitemap" href="/sitemap-index.xml" />
    <meta property="og:type" content="website" />
    <meta property="og:site_name" content={site.name} />
    <meta property="og:title" content={fullTitle} />
    <meta property="og:description" content={description} />
    <meta property="og:url" content={canonical} />
    <meta property="og:image" content={ogImage} />
    <meta property="og:image:alt" content={hero.alt} />
    <meta name="twitter:card" content="summary_large_image" />
    <script type="application/ld+json" set:html={JSON.stringify(jsonLd)} />
  </head>
  <body>
    <a class="skip-link" href="#main">Skip to content</a>
    <Header />
    <main id="main"><slot /></main>
    <Footer />
  </body>
</html>
```

- [ ] **Step 4: robots.txt and netlify.toml**

`public/robots.txt`:
```
# AI crawlers: no training or scraping. © David Pham / FasterThanLight Studio.
User-agent: GPTBot
User-agent: ChatGPT-User
User-agent: ClaudeBot
User-agent: anthropic-ai
User-agent: Google-Extended
User-agent: CCBot
User-agent: PerplexityBot
User-agent: Bytespider
User-agent: Applebot-Extended
User-agent: meta-externalagent
User-agent: cohere-ai
User-agent: Amazonbot
Disallow: /

# Everyone else (search engines) is welcome.
User-agent: *
Allow: /

Sitemap: https://fasterthanlight.studio/sitemap-index.xml
```

`netlify.toml`:
```toml
[build]
  command = "npm run build"
  publish = "dist"

[build.environment]
  NODE_VERSION = "24"

# Old domains → new primary (add these domains as aliases in Netlify first).
[[redirects]]
  from = "https://thisismynext.photos/*"
  to = "https://fasterthanlight.studio/:splat"
  status = 301
  force = true

[[redirects]]
  from = "https://www.thisismynext.photos/*"
  to = "https://fasterthanlight.studio/:splat"
  status = 301
  force = true

[[headers]]
  for = "/*"
  [headers.values]
    X-Robots-Tag = "noai, noimageai"
    Referrer-Policy = "strict-origin-when-cross-origin"
    X-Content-Type-Options = "nosniff"
    Permissions-Policy = "camera=(), microphone=(), geolocation=(), payment=(), usb=()"
    Content-Security-Policy = "default-src 'self'; img-src 'self' data: https://res.cloudinary.com; script-src 'self'; style-src 'self' 'unsafe-inline'; form-action 'self'; frame-ancestors 'none'; base-uri 'self'; object-src 'none'"

[[headers]]
  for = "/_astro/*"
  [headers.values]
    Cache-Control = "public, max-age=31536000, immutable"
```

- [ ] **Step 5: Run the SEO tests and the full e2e suite**

Run: `npm run build && npx playwright test`
Expected: every spec passes on desktop and mobile.

- [ ] **Step 6: Commit**

```bash
npm run format
git add -A
git commit -m "feat: add SEO metadata, AI-crawler blocks, security headers and domain redirects

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

---

### Task 11: Photo sync from Cloudinary

**Files:**
- Create: `scripts/sync/merge.ts`, `scripts/sync/merge.test.ts`, `scripts/sync-photos.ts`

**Interfaces:**
- Consumes: the `PhotosFile` and `Photo` types from `src/lib/schema.ts`.
- Produces:
  - `interface RemotePhoto { id: string; width: number; height: number; alt?: string; caption?: string; placeholder?: string }`
  - `interface RemoteSet { slug: string; photos: RemotePhoto[] }`
  - `interface MergeReport { added: string[]; removed: string[]; missingAlt: string[]; newSets: string[]; removedSets: string[] }`
  - `titleFromSlug(slug: string): string`
  - `mergePhotos(existing: PhotosFile, remoteSets: RemoteSet[], remoteExtras: RemotePhoto[]): { data: PhotosFile; report: MergeReport }`
  - The CLI `npm run sync-photos`.

- [ ] **Step 1: Write the failing tests**

`scripts/sync/merge.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import type { PhotosFile } from '../../src/lib/schema';
import { mergePhotos, titleFromSlug, type RemoteSet } from './merge';

const existing: PhotosFile = {
  sets: [
    {
      slug: 'conferences',
      title: 'Conferences & Keynotes',
      photos: [
        { id: 'c2', width: 100, height: 100, alt: 'Local alt two', caption: 'Local caption' },
        { id: 'c1', width: 100, height: 100, alt: 'Local alt one' },
      ],
    },
    { slug: 'retired', title: 'Retired', photos: [{ id: 'r1', width: 1, height: 1, alt: 'Old' }] },
  ],
  extras: { hero: { width: 1, height: 1, alt: 'Hand-written hero alt' } },
};

const remoteSets: RemoteSet[] = [
  {
    slug: 'conferences',
    photos: [
      { id: 'c1', width: 3000, height: 2000, alt: 'Cloud alt one', placeholder: 'data:image/jpeg;base64,AA' },
      { id: 'c2', width: 3000, height: 2000 },
      { id: 'c3', width: 2000, height: 3000, alt: 'Cloud alt three', caption: 'Cloud caption' },
    ],
  },
  { slug: 'product-launches', photos: [{ id: 'p1', width: 10, height: 10 }] },
];

describe('titleFromSlug', () => {
  it('title-cases hyphenated slugs', () => {
    expect(titleFromSlug('product-launches')).toBe('Product Launches');
  });
});

describe('mergePhotos', () => {
  const { data, report } = mergePhotos(existing, remoteSets, [
    { id: 'hero', width: 3000, height: 2000, alt: 'Cloud hero alt' },
  ]);
  const conferences = data.sets.find((s) => s.slug === 'conferences')!;

  it('keeps hand-edited order, alt text, captions and set titles', () => {
    expect(conferences.title).toBe('Conferences & Keynotes');
    expect(conferences.photos.map((p) => p.id).slice(0, 2)).toEqual(['c2', 'c1']);
    expect(conferences.photos[0]).toMatchObject({ alt: 'Local alt two', caption: 'Local caption' });
    expect(conferences.photos[1].alt).toBe('Local alt one');
  });

  it('refreshes dimensions and placeholders from Cloudinary', () => {
    expect(conferences.photos[1]).toMatchObject({
      width: 3000,
      height: 2000,
      placeholder: 'data:image/jpeg;base64,AA',
    });
  });

  it('appends new photos at the end of their set, using Cloudinary metadata', () => {
    expect(conferences.photos[2]).toEqual({
      id: 'c3',
      width: 2000,
      height: 3000,
      alt: 'Cloud alt three',
      caption: 'Cloud caption',
    });
    expect(report.added).toContain('c3');
  });

  it('adds new folders as new sets titled from their slug', () => {
    const launches = data.sets.find((s) => s.slug === 'product-launches')!;
    expect(launches.title).toBe('Product Launches');
    expect(report.newSets).toEqual(['product-launches']);
  });

  it('drops sets and photos that no longer exist in Cloudinary', () => {
    expect(data.sets.map((s) => s.slug)).toEqual(['conferences', 'product-launches']);
    expect(report.removedSets).toEqual(['retired']);
    expect(report.removed).toEqual(['r1']);
  });

  it('reports photos that still have no alt text', () => {
    expect(report.missingAlt).toEqual(['p1']);
    expect(data.sets[1].photos[0].alt).toBe('');
  });

  it('merges extras by id and keeps hand-written alt text', () => {
    expect(data.extras).toEqual({
      hero: { width: 3000, height: 2000, alt: 'Hand-written hero alt' },
    });
  });

  it('removes a photo deleted in Cloudinary and reports it', () => {
    const result = mergePhotos(existing, [{ slug: 'conferences', photos: [remoteSets[0].photos[0]] }], []);
    expect(result.data.sets[0].photos.map((p) => p.id)).toEqual(['c1']);
    expect(result.report.removed).toEqual(['c2', 'r1']);
  });
});
```

- [ ] **Step 2: Run to verify they fail**

Run: `npx vitest run scripts/sync/merge.test.ts`
Expected: FAIL — `Failed to resolve import "./merge"`.

- [ ] **Step 3: Implement the merge**

`scripts/sync/merge.ts`:
```ts
import type { Photo, PhotosFile } from '../../src/lib/schema';

export interface RemotePhoto {
  id: string;
  width: number;
  height: number;
  alt?: string;
  caption?: string;
  placeholder?: string;
}

export interface RemoteSet {
  slug: string;
  photos: RemotePhoto[];
}

export interface MergeReport {
  added: string[];
  removed: string[];
  missingAlt: string[];
  newSets: string[];
  removedSets: string[];
}

const clean = (value?: string): string | undefined => value?.trim() || undefined;

export function titleFromSlug(slug: string): string {
  return slug
    .split('-')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

/** Hand-edited alt/caption win over Cloudinary metadata; dimensions/placeholder come from Cloudinary. */
function mergePhoto(remote: RemotePhoto, local?: { alt?: string; caption?: string }): Photo {
  const photo: Photo = {
    id: remote.id,
    width: remote.width,
    height: remote.height,
    alt: clean(local?.alt) ?? clean(remote.alt) ?? '',
  };
  const caption = clean(local?.caption) ?? clean(remote.caption);
  if (caption) photo.caption = caption;
  if (remote.placeholder) photo.placeholder = remote.placeholder;
  return photo;
}

export function mergePhotos(
  existing: PhotosFile,
  remoteSets: RemoteSet[],
  remoteExtras: RemotePhoto[],
): { data: PhotosFile; report: MergeReport } {
  const report: MergeReport = { added: [], removed: [], missingAlt: [], newSets: [], removedSets: [] };
  const remoteBySlug = new Map(remoteSets.map((set) => [set.slug, set]));
  const sets: PhotosFile['sets'] = [];

  for (const local of existing.sets) {
    const remote = remoteBySlug.get(local.slug);
    if (!remote) {
      report.removedSets.push(local.slug);
      report.removed.push(...local.photos.map((p) => p.id));
      continue;
    }
    const remoteById = new Map(remote.photos.map((p) => [p.id, p]));
    const kept: Photo[] = [];
    for (const photo of local.photos) {
      const match = remoteById.get(photo.id);
      if (match) kept.push(mergePhoto(match, photo));
      else report.removed.push(photo.id);
    }
    const localIds = new Set(local.photos.map((p) => p.id));
    const added = remote.photos.filter((p) => !localIds.has(p.id)).map((p) => mergePhoto(p));
    report.added.push(...added.map((p) => p.id));

    const photos = [...kept, ...added];
    if (photos.length > 0) sets.push({ slug: local.slug, title: local.title, photos });
    else report.removedSets.push(local.slug);
  }

  const localSlugs = new Set(existing.sets.map((set) => set.slug));
  for (const remote of remoteSets) {
    if (localSlugs.has(remote.slug) || remote.photos.length === 0) continue;
    const photos = remote.photos.map((p) => mergePhoto(p));
    report.newSets.push(remote.slug);
    report.added.push(...photos.map((p) => p.id));
    sets.push({ slug: remote.slug, title: titleFromSlug(remote.slug), photos });
  }

  const extras: PhotosFile['extras'] = {};
  for (const remote of remoteExtras) {
    const { id, ...rest } = mergePhoto(remote, existing.extras[remote.id]);
    extras[id] = rest;
  }

  for (const set of sets) for (const p of set.photos) if (!p.alt) report.missingAlt.push(p.id);
  for (const [id, extra] of Object.entries(extras)) if (!extra.alt) report.missingAlt.push(id);

  return { data: { sets, extras }, report };
}
```

- [ ] **Step 4: Run to verify they pass**

Run: `npx vitest run scripts/sync/merge.test.ts`
Expected: `9 passed`.

- [ ] **Step 5: Implement the CLI**

`scripts/sync-photos.ts`:
```ts
// Pulls photo metadata from Cloudinary into src/content/photos.json.
// Usage: npm run sync-photos   (needs CLOUDINARY_URL in .env — see .env.example)
import { readFile, writeFile } from 'node:fs/promises';
import { v2 as cloudinary } from 'cloudinary';
import type { PhotosFile } from '../src/lib/schema';
import { mergePhotos, type RemotePhoto, type RemoteSet } from './sync/merge';

const ROOT = 'portfolio';
const EXTRAS = '_extras';
const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const FILE = new URL('../src/content/photos.json', import.meta.url);

interface Resource {
  public_id: string;
  resource_type: string;
  width: number;
  height: number;
  context?: { custom?: Record<string, string> };
}
interface ResourcePage {
  resources: Resource[];
  next_cursor?: string;
}

async function placeholderFor(id: string): Promise<string> {
  // Signed, so it is delivered even with strict transformations enabled.
  const url = cloudinary.url(id, {
    sign_url: true,
    secure: true,
    transformation: [
      { width: 24, crop: 'scale' },
      { effect: 'blur:200', quality: 30, fetch_format: 'jpg' },
    ],
  });
  const res = await fetch(url);
  if (!res.ok) throw new Error(`placeholder for "${id}" failed: HTTP ${res.status}`);
  return `data:image/jpeg;base64,${Buffer.from(await res.arrayBuffer()).toString('base64')}`;
}

async function listPage(folder: string, cursor?: string): Promise<ResourcePage> {
  const options = { context: true, max_results: 500, next_cursor: cursor };
  try {
    // Dynamic-folder accounts (the default for accounts created since 2024).
    return (await cloudinary.api.resources_by_asset_folder(folder, options)) as ResourcePage;
  } catch {
    // Fixed-folder accounts: folders are public_id prefixes.
    return (await cloudinary.api.resources({
      ...options,
      type: 'upload',
      prefix: `${folder}/`,
    })) as ResourcePage;
  }
}

async function listFolder(folder: string): Promise<RemotePhoto[]> {
  const photos: RemotePhoto[] = [];
  let cursor: string | undefined;
  do {
    const page = await listPage(folder, cursor);
    for (const r of page.resources) {
      if (r.resource_type !== 'image') continue;
      const meta = r.context?.custom ?? {};
      photos.push({
        id: r.public_id,
        width: r.width,
        height: r.height,
        alt: meta.alt,
        caption: meta.caption,
        placeholder: await placeholderFor(r.public_id),
      });
    }
    cursor = page.next_cursor;
  } while (cursor);
  // Stable order for new photos: by public id (name exports 01-…, 02-… to control order).
  return photos.sort((a, b) => a.id.localeCompare(b.id));
}

async function main(): Promise<void> {
  if (!process.env.CLOUDINARY_URL) {
    console.error('CLOUDINARY_URL is not set. Copy .env.example to .env and fill it in.');
    process.exit(1);
  }
  cloudinary.config({ secure: true });

  const { folders } = (await cloudinary.api.sub_folders(ROOT)) as {
    folders: { name: string; path: string }[];
  };
  const remoteSets: RemoteSet[] = [];
  let remoteExtras: RemotePhoto[] = [];
  for (const folder of folders) {
    if (folder.name === EXTRAS) {
      remoteExtras = await listFolder(folder.path);
    } else if (SLUG.test(folder.name)) {
      remoteSets.push({ slug: folder.name, photos: await listFolder(folder.path) });
    } else {
      console.warn(`Skipping folder "${folder.path}": name must be lowercase-with-hyphens.`);
    }
  }

  const existing = JSON.parse(await readFile(FILE, 'utf8')) as PhotosFile;
  const { data, report } = mergePhotos(existing, remoteSets, remoteExtras);
  await writeFile(FILE, `${JSON.stringify(data, null, 2)}\n`);

  const total = data.sets.reduce((sum, set) => sum + set.photos.length, 0);
  console.log(`Synced ${data.sets.length} sets, ${total} photos, ${Object.keys(data.extras).length} extras.`);
  if (report.newSets.length) console.log(`New sets: ${report.newSets.join(', ')}`);
  if (report.added.length) console.log(`Added: ${report.added.join(', ')}`);
  if (report.removedSets.length) console.warn(`Removed sets: ${report.removedSets.join(', ')}`);
  if (report.removed.length) console.warn(`Removed photos: ${report.removed.join(', ')}`);
  console.log(`Extras ids (use for heroId/portraitId in site.json): ${Object.keys(data.extras).join(', ')}`);
  if (report.missingAlt.length) {
    console.warn(
      `\n⚠ ${report.missingAlt.length} photo(s) have no alt text — the build will fail until you add it` +
        ` in Cloudinary (then re-sync) or directly in photos.json:\n  ${report.missingAlt.join('\n  ')}`,
    );
  }
  console.log('\nReview with: git diff src/content/photos.json');
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
```

- [ ] **Step 6: Type-check and verify the missing-credentials path**

Run: `npm run check && npm run sync-photos`
Expected: `0 errors`. Then, because `.env` does not exist yet: `CLOUDINARY_URL is not set. Copy .env.example to .env and fill it in.` with exit code 1. The real sync is run in Task 13.

- [ ] **Step 7: Commit**

```bash
npm run format
git add -A
git commit -m "feat: add Cloudinary photo sync that preserves hand edits

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

---

### Task 12: Performance budgets, Lighthouse CI and GitHub Actions

**Files:**
- Create: `scripts/check-budgets.mjs`, `lighthouserc.json`, `.github/workflows/ci.yml`

**Interfaces:**
- Consumes: `dist/` from `npm run build`.
- Produces: `npm run budgets` (exit code 1 on any violation), plus a CI workflow running every check.

- [ ] **Step 1: Budget checker**

`scripts/check-budgets.mjs`:
```js
// Fails if any built page exceeds its gzipped JS/CSS budget. Run after `npm run build`.
import { readFile, readdir } from 'node:fs/promises';
import { dirname, join, relative } from 'node:path';
import { gzipSync } from 'node:zlib';

const DIST = 'dist';
const KB = 1024;
const CSS_LIMIT = 15 * KB;
const GALLERY_JS_LIMIT = 10 * KB;

async function htmlFiles(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  const nested = await Promise.all(
    entries.map((e) => {
      const path = join(dir, e.name);
      if (e.isDirectory()) return htmlFiles(path);
      return e.name.endsWith('.html') ? [path] : [];
    }),
  );
  return nested.flat();
}

const gz = (text) => gzipSync(text).length;
const assetPath = (src) => join(DIST, src.replace(/^\//, ''));

/** Gzipped size of a JS module plus every chunk it statically imports. */
async function moduleSize(file, seen) {
  if (seen.has(file)) return 0;
  seen.add(file);
  const code = await readFile(file, 'utf8');
  let size = gz(code);
  for (const [, spec] of code.matchAll(/(?:import|from)\s*["']([^"']+\.js)["']/g)) {
    const next = spec.startsWith('/') ? assetPath(spec) : join(dirname(file), spec);
    size += await moduleSize(next, seen);
  }
  return size;
}

async function measure(html) {
  let js = 0;
  let css = 0;
  const seen = new Set();
  for (const [, attrs, body] of html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/g)) {
    if (attrs.includes('application/ld+json')) continue;
    const src = /\bsrc="([^"]+)"/.exec(attrs)?.[1];
    js += src ? await moduleSize(assetPath(src), seen) : gz(body);
  }
  for (const [, href] of html.matchAll(/<link\b[^>]*rel="stylesheet"[^>]*href="([^"]+)"/g)) {
    css += gz(await readFile(assetPath(href), 'utf8'));
  }
  for (const [, body] of html.matchAll(/<style\b[^>]*>([\s\S]*?)<\/style>/g)) css += gz(body);
  return { js, css };
}

let failed = false;
for (const file of await htmlFiles(DIST)) {
  const page = `/${relative(DIST, file)}`;
  const { js, css } = await measure(await readFile(file, 'utf8'));
  const jsLimit = page.startsWith('/gallery/') ? GALLERY_JS_LIMIT : 0;
  const ok = js <= jsLimit && css <= CSS_LIMIT;
  if (!ok) failed = true;
  console.log(
    `${ok ? '✓' : '✗'} ${page.padEnd(40)} js ${(js / KB).toFixed(1)} KB (≤ ${jsLimit / KB})  css ${(css / KB).toFixed(1)} KB (≤ ${CSS_LIMIT / KB})`,
  );
}
if (failed) {
  console.error('\nBudget exceeded.');
  process.exit(1);
}
```

- [ ] **Step 2: Run the budgets**

Run: `npm run build && npm run budgets`
Expected: every line starts with `✓`. Gallery pages show JS roughly between 1 and 3 KB; all other pages show `js 0.0 KB`; exit code 0.

Then prove it catches violations: temporarily add `<script>console.log('x')</script>` to `src/pages/about.astro`, run `npm run build && npm run budgets`, and expect `✗ /about/index.html` and exit code 1. Remove the script afterwards.

- [ ] **Step 3: Lighthouse CI config**

`lighthouserc.json`:
```json
{
  "ci": {
    "collect": {
      "startServerCommand": "npm run preview",
      "startServerReadyPattern": "localhost:4321",
      "url": ["http://localhost:4321/", "http://localhost:4321/gallery/conferences"],
      "numberOfRuns": 3
    },
    "assert": {
      "assertions": {
        "categories:performance": ["error", { "minScore": 0.95 }],
        "categories:accessibility": ["error", { "minScore": 0.95 }],
        "cumulative-layout-shift": ["error", { "maxNumericValue": 0.05 }],
        "largest-contentful-paint": ["warn", { "maxNumericValue": 2000 }]
      }
    },
    "upload": { "target": "filesystem", "outputDir": ".lighthouseci" }
  }
}
```

The gallery URL uses the seed slug `conferences`. **If David's synced sets don't include `conferences`, update this URL to his first set's slug** (Task 13, Step 6).

- [ ] **Step 4: Run Lighthouse locally**

Run: `npm run build && npx lhci autorun`
Expected: `All results processed!` with no `error`-level assertion failures. An LCP warning is acceptable locally.
If performance or accessibility falls below 0.95, open `.lighthouseci/*.html`, fix the top-listed issue, and rerun. Do not lower the thresholds.

- [ ] **Step 5: CI workflow**

`.github/workflows/ci.yml`:
```yaml
name: CI

on:
  pull_request:
  push:
    branches: [main]

jobs:
  ci:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v7
      - uses: actions/setup-node@v7
        with:
          node-version-file: .nvmrc
          cache: npm
      - run: npm ci
      - run: npm run format:check
      - run: npm run check
      - run: npm test
      - run: npm run build
      - run: npm run budgets
      - run: npx playwright install --with-deps chromium
      - run: npm run test:e2e
      - run: npx lhci autorun
```

- [ ] **Step 6: Full local run, then commit**

Run: `npm run format:check && npm run check && npm test && npm run build && npm run budgets && npm run test:e2e`
Expected: everything passes.

```bash
git add -A
git commit -m "ci: enforce JS/CSS budgets, Lighthouse scores and full test suite

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

---

### Task 13: Launch (with David)

This task is interactive. Steps marked **(David)** happen in dashboards that only David can access. Ask him to do each one, and wait for confirmation before continuing.

**Files:**
- Modify: `src/content/site.json` (`cloudName`, `heroId`, `portraitId`), `src/content/photos.json` (via sync), `lighthouserc.json` (gallery URL, if needed), `netlify.toml` (second old domain, if David keeps it)

- [ ] **Step 1 (David): Cloudinary uploads and credentials**
  - Upload the curated exports into `portfolio/<set-slug>/` folders, e.g. `portfolio/conferences/`. Name files `01-…`, `02-…` to set the initial order.
  - Upload the hero and portrait into `portfolio/_extras/`.
  - Add `alt` (and optionally `caption`) contextual metadata to each photo.
  - Copy the API environment variable into `~/Developer/fasterthanlight/.env` as `CLOUDINARY_URL=…`.

- [ ] **Step 2: Sync and point site.json at David's account**

Run: `npm run sync-photos`
Expected: the summary lists David's sets and photos, plus the extras ids.
- Edit `src/content/site.json`: set `cloudName` to David's cloud name, and set `heroId` and `portraitId` to the extras ids printed by the sync.
- Resolve every missing-alt warning, either by adding alt text in Cloudinary and re-syncing, or by editing `photos.json` directly.
- Then run: `npm run build && npm run test:e2e && npm run budgets`
- Expected: all pass. Tests that depend on the seed's special cases skip if David's content lacks them. That is fine.

- [ ] **Step 3 (David): Enable strict transformations, then verify from the terminal**

David enables **Settings → Security → Strict transformations** and allows the four transformations `f_auto,q_auto,c_limit,w_400`, `f_auto,q_auto,c_limit,w_800`, `f_auto,q_auto,c_limit,w_1600` and `f_auto,q_auto,c_limit,w_2560,h_2560` (the largest also caps height, per the final-review fix), e.g. by marking them allowed under **Transformations**. Then run, using one real photo id:

```bash
CLOUD=<cloud>; ID=<a public id>
for t in f_auto,q_auto,c_limit,w_800 f_auto,q_auto,c_limit,w_801; do
  printf "%s → " $t; curl -s -o /dev/null -w "%{http_code}\n" "https://res.cloudinary.com/$CLOUD/image/upload/$t/$ID"
done
printf "original → "; curl -s -o /dev/null -w "%{http_code}\n" "https://res.cloudinary.com/$CLOUD/image/upload/$ID"
```

Expected: `w_800 → 200`, `w_801 → 401` (or 4xx).
- **If the original returns 200**, Cloudinary still serves untransformed uploads. Tell David, and recommend re-uploading exports capped at **2560 px on the long edge**, so the "original" is no larger than what the site already serves (spec §5, "delivered images are capped at 2560 px").
- **If `w_800` returns 4xx**, `f_auto`/`q_auto` aren't allowed in strict mode as configured. Switch to named transformations: in Cloudinary, create `ftl_400`/`ftl_800`/`ftl_1600`/`ftl_2560` (each `q_auto,c_limit,w_N`, allowed for strict). Then change `urlFor` to emit `f_auto,t_ftl_${width}`, and update the three expected URLs in `src/lib/cloudinary.test.ts` to match. Run `npm test` before continuing.

- [ ] **Step 4 (David): Netlify site settings**
  - Build settings come from `netlify.toml`, so no UI changes are needed.
  - **Forms:** after the first deploy, open *Forms → inquiry → Form notifications* and add an email notification to David's inbox.
  - **Domains:** add `fasterthanlight.studio` as the primary domain (Netlify redirects `www` automatically), then add `thisismynext.photos` and `www.thisismynext.photos` as domain aliases. Update DNS at the registrar as Netlify instructs, and wait for HTTPS to provision.
  - **Second old domain:** if David keeps `thisismynext.photography` (confirm the spelling), add it as an alias and add two more `[[redirects]]` blocks to `netlify.toml`, copying the `thisismynext.photos` ones with the domain swapped.
  - **Email:** set up forwarding for `hello@fasterthanlight.studio` to David's inbox, using the registrar's forwarding, ImprovMX, or Cloudflare Email Routing.

- [ ] **Step 5: Confirm Netlify's current free-plan limits**

Check Netlify's pricing page for the free plan's bandwidth, build minutes and Forms submissions (spec §12). Report the numbers to David. With 60 photos served from Cloudinary, Netlify bandwidth covers only HTML, CSS and JS.

- [ ] **Step 6: Final verification, then ask before pushing**

- If the first set's slug isn't `conferences`, update the gallery URL in `lighthouserc.json`.
- Run: `npm run format:check && npm run check && npm test && npm run build && npm run budgets && npm run test:e2e && npx lhci autorun`
- Expected: all pass.

Then **ask David**: "Everything passes locally. OK to push `feat/portfolio-site` and open a PR? Netlify will build a deploy preview, and merging to `main` makes the site live."

On approval:
```bash
git push -u origin feat/portfolio-site
gh pr create --title "Portfolio site: FasterThanLight Studio" --body "$(cat <<'EOF'
Builds the portfolio site from docs/superpowers/specs/2026-09-30-portfolio-site-design.md.

- Astro 7 static site with a Gallery White slideshow per event type
- Cloudinary delivery through a single URL builder (strict transformations)
- About page and Netlify Forms contact
- AI-crawler blocks, security headers, SEO metadata
- CI: unit tests, Playwright e2e, JS/CSS budgets, Lighthouse CI

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```
Link the PR to the thread (`link_pull_request`), then check the Netlify deploy preview.

- [ ] **Step 7: Post-deploy checks on the live preview**

```bash
URL=<deploy preview or https://fasterthanlight.studio>
curl -sI "$URL/" | grep -iE "x-robots-tag|content-security-policy"
curl -sI "$URL/gallery" | grep -iE "^HTTP|^location"
```
Expected: both headers are present, and `/gallery` returns a `301` whose `location` is the first set.
Finally, submit one test inquiry and confirm it arrives in David's inbox.
