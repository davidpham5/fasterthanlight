# FasterThanLight Studio Portfolio Site: Design Spec

- **Date:** 2026-09-30
- **Status:** Draft for review
- **Site:** `https://fasterthanlight.studio`
- **Repo:** `davidpham5/fasterthanlight` (public), deployed on Netlify

## 1. Purpose

This is the portfolio site for **FasterThanLight Studio**, David Pham's corporate-event photography business.

**Audience:** corporate event planners and marketing or communications teams.

**The site's job:**
- Show 60 curated photos, organized by event type.
- Turn visitors into inquiries.

It is a standalone static site. Later it becomes the public-site template for the photography platform (see `phamtography/docs/superpowers/specs/2026-09-29-platform-design.md`). To make that easy, it uses the platform's image widths and conventions, and a single swappable `<Photo>` component.

### Non-goals

- A blog or journal.
- Client galleries or proofing (those belong to the platform).
- E-commerce.
- A CMS.
- Analytics. A privacy-friendly option can be added later.

## 2. Visual direction

- **"Gallery White"**, following the structure of Hunter Creates Things:
  - A white background.
  - A Helvetica-style sans serif (a system font stack; no web font download).
  - Generous whitespace, so the photographs dominate.
- **Header:** "FasterThanLight Studio" as a large plain wordmark on the left, and *Gallery · About · Contact* on the right. The current page is underlined. On small screens the nav collapses into a simple disclosure menu.
- **Footer:** `© 2026 FasterThanLight Studio · David Pham · david.pham@hey.com`.

Approved mockups are kept in the `phamtography` repo (`.superpowers/brainstorm/`).

## 3. Pages

| Route | Content |
|---|---|
| `/` | **A full-screen hero image** (supplied by David), a one-line statement laid over it, and a "View the work →" link to `/gallery`. No other sections. |
| `/gallery` | 301 redirect to the first set (`/gallery/{first-set-slug}`). |
| `/gallery/{set}` | The **set switcher**, then the **slideshow**. Both are described below. |
| `/about` | A portrait, a short bio, and a "How I work" section (coverage, turnaround, deliverables). The copy is written in Markdown by David. |
| `/contact` | An inquiry form built on Netlify Forms (§6). |
| `/thanks` | Confirmation shown after the form is submitted. |
| `404` | A plain not-found page with a link to the gallery. |

### Set switcher

- A quiet row of text links above the slideshow, e.g. *Conferences & Keynotes · Galas & Awards · Product Launches · On-site Headshots*.
- The active set is underlined.
- Set names and slugs come from `photos.json`. The four above are placeholders; David renames them to match his 60 photos.

### Slideshow

Each set page works like the Hunter gallery:

- **Layout:**
  - One large image, centered, sized to fit the viewport minus the header and thumbnail strip, with its aspect ratio preserved.
  - A caption line below the image.
  - Previous and next chevron buttons at the page edges.
  - A horizontal strip of thumbnails. The active thumbnail is fully opaque and outlined; the others are dimmed. The strip scrolls when it overflows.
- **Controls:**
  - Keyboard: ← and →. Also swipe on touch devices, and clicking a thumbnail.
  - Navigation wraps around from the last photo to the first.
  - The next and previous images are preloaded.
- **Deep links:** the URL hash tracks the current photo, numbered from 1 (`/gallery/conferences#7`), so a specific photo can be shared.
- **Accessibility:**
  - Chevrons and thumbnails are real `<button>` elements with labels (e.g. "Photo 7 of 15").
  - The caption area is an `aria-live="polite"` region.
  - Focus is visible.
  - Transitions are disabled when `prefers-reduced-motion` is set.
- **Progressive enhancement:** without JavaScript, the set renders as a vertical list of every photo with its caption. The script turns that list into the slideshow.
- **Implementation:** the slideshow is a small vanilla TypeScript module, not React. Its budget is **≤ 10 KB gzipped** of JavaScript per gallery page. No other page ships any JavaScript.

## 4. Architecture

- **Framework:** Astro with static output, deployed on Netlify from `main`. Pull requests get Netlify deploy previews.
- **Styling:** plain CSS with custom properties. No CSS framework and no UI framework.

### Repo layout

```
src/
  pages/            index, gallery/index, gallery/[set], about, contact, thanks, 404
  components/       Photo.astro, Header.astro, Footer.astro, SetSwitcher.astro, Slideshow.astro
  scripts/          slideshow.ts
  lib/cloudinary.ts URL builder (the only Cloudinary-specific code)
  content/          photos.json, site.json, about.md
  content.config.ts content collections + zod schemas
  styles/global.css
scripts/sync-photos.ts
public/             robots.txt, favicon
tests/              Playwright specs
netlify.toml
NOTICE
```

### Content files (validated at build time; a build fails if they're invalid)

**`site.json`** holds:
- `name` ("FasterThanLight Studio")
- `owner` ("David Pham")
- `tagline`, the homepage line
- `email`
- the hero photo id
- the portrait photo id

**`photos.json`** has this shape:

```json
{
  "sets": [
    {
      "slug": "conferences",
      "title": "Conferences & Keynotes",
      "photos": [
        {
          "id": "portfolio/conferences/keynote-01",
          "width": 6000,
          "height": 4000,
          "alt": "Speaker addressing a packed auditorium",
          "caption": "Keynote — Austin, TX — 2026",
          "placeholder": "data:image/jpeg;base64,..."
        }
      ]
    }
  ]
}
```

Rules:
- `alt` is required and must not be empty. Captions are optional.
- The order of sets, and of photos within each set, is the display order.
- The hero and portrait photos are stored under a separate top-level `"extras"` object keyed by photo id, with the same photo fields.

## 5. Images (Cloudinary)

### Storage

- David uploads his **full-resolution JPEG exports** to Cloudinary, one folder per set: `portfolio/{set-slug}/`.
- The hero and portrait go in `portfolio/_extras/`.
- **No photo files are committed to the repo.**

### Delivery (`src/lib/cloudinary.ts` + `<Photo>`)

- Photos are delivered from URLs of the form:
  `https://res.cloudinary.com/{cloud}/image/upload/{transform}/{id}`
  - `{transform}` = `f_auto,q_auto,c_limit,w_{400|800|1600|2560}`
  - `f_auto` serves AVIF or WebP depending on the browser.
- `<Photo>` renders an `<img>` with:
  - a `srcset` covering all four widths, and a `sizes` value passed in by the caller
  - explicit `width` and `height` attributes
  - `decoding="async"`
  - the placeholder as a CSS background that is removed when the image loads
- Loading priority:
  - The **hero** and each set's **first slideshow image** use `loading="eager"` with `fetchpriority="high"`.
  - Everything else uses `loading="lazy"`.
- `<link rel="preconnect" href="https://res.cloudinary.com">` goes in the page `<head>`.
- **Swap point:** to move to the platform later, only `cloudinary.ts` needs replacing, with R2 URLs.

### Protection

- **Strict transformations are enabled.** Only the four allowed width transformations, plus the placeholder transformation, can be generated. The original upload is never delivered.
  - The placeholder transformation is only used by the sync script through signed API calls.
- Delivered images are capped at 2560 px on the long edge.

### Sync workflow (`npm run sync-photos`, run locally by David)

1. Read `CLOUDINARY_URL` from a local `.env` file, which is gitignored.
2. Use the Admin API to list each `portfolio/{set}` folder and read each photo's dimensions and its contextual metadata (`alt`, `caption`).
3. For each photo, fetch a 24 px wide, blurred JPEG and inline it as the `placeholder` data URI (under 1 KB).
4. **Merge** the results into the existing `photos.json`:
   - Existing photos keep their hand-edited order, `alt`, and `caption`.
   - New photos are added at the end of their set.
   - Photos deleted in Cloudinary are removed, with a printed warning.
   - A new folder becomes a new set, titled from its slug.
5. Print a summary, including any photos with missing `alt` text. David reviews the change with `git diff`, then commits it.

Netlify builds never call the Cloudinary API and never hold its secret.

## 6. Contact form (Netlify Forms)

- The form uses `<form name="inquiry" method="POST" data-netlify="true" netlify-honeypot="bot-field" action="/thanks">`.
- **Fields:**

  | Field | Required? |
  |---|---|
  | name | required |
  | email | required, `type=email` |
  | company | optional |
  | event date | optional, `type=date` |
  | event type | optional; a select built from the set titles, plus "Other" |
  | location | optional |
  | message | required |

- Native HTML validation only; the form needs no JavaScript.
- David configures an email notification in the Netlify UI so submissions reach his inbox.
- Spam protection comes from the honeypot field. Netlify's reCAPTCHA option can be added if spam becomes a problem.

## 7. Performance targets (acceptance criteria)

Measured on mobile with a simulated 4G connection, at the 75th percentile, for both `/` and a `/gallery/{set}` page:

- **Largest Contentful Paint (LCP) ≤ 2.0 s**
- **Cumulative Layout Shift (CLS) ≤ 0.05**
- **Lighthouse Performance ≥ 95**, and **Accessibility ≥ 95**
- **JavaScript:** 0 KB on `/`, `/about`, and `/contact`; ≤ 10 KB gzipped on gallery pages
- **CSS:** ≤ 15 KB gzipped

**Caching:** hashed `/_astro/*` assets are served with `Cache-Control: public, max-age=31536000, immutable`. HTML is served with Netlify's defaults, which are always revalidated.

## 8. Protection, licensing and SEO

- **Licensing:** the README and a `NOTICE` file state that **Apache 2.0 covers the source code only**, and that **all photographs are © David Pham / FasterThanLight Studio, all rights reserved**, with no license granted.
- **AI scraping defenses:**
  - `robots.txt` disallows known AI crawlers, including GPTBot, ClaudeBot, Google-Extended, CCBot, PerplexityBot, Bytespider, and Applebot-Extended.
  - Every page carries `<meta name="robots" content="noai, noimageai">`.
  - `netlify.toml` sets an `X-Robots-Tag: noai, noimageai` header.
  - Regular search engines stay allowed.
- **SEO:**
  - Each page has a unique `<title>` and meta description.
  - Open Graph and Twitter card tags. The og:image is the hero, served at 1200 px wide from Cloudinary.
  - A `sitemap.xml` generated by `@astrojs/sitemap`.
  - JSON-LD structured data describing the business (`LocalBusiness` / `ProfessionalService`) with its name, URL, and email.
- **Security headers** (set in `netlify.toml`):
  - A Content-Security-Policy allowing `self`, `res.cloudinary.com` for images, and Netlify Forms posts
  - `Referrer-Policy: strict-origin-when-cross-origin`
  - `X-Content-Type-Options: nosniff`
  - `Permissions-Policy` with unused features turned off

## 9. Domains and email

- **Primary domain:** `fasterthanlight.studio`, on Netlify with HTTPS. `www.fasterthanlight.studio` returns a 301 redirect to the apex domain.
- **Old domains:** `thisismynext.photos` (and the `.photography` domain, if David keeps it) return a 301 redirect to `https://fasterthanlight.studio`, preserving the path.
- **Email:** the site shows `david.pham@hey.com` (changed from `hello@fasterthanlight.studio` on 2026-09-30). Namecheap email forwarding for the domain can stay in place but is no longer advertised.

## 10. Testing and CI

- **Playwright tests** (in GitHub Actions, run against `astro build && astro preview`):
  - Every route renders, and the `/gallery` redirect works.
  - The slideshow:
    - responds to the arrow keys, the chevron buttons, and thumbnail clicks
    - wraps around at the ends
    - updates the URL hash, and loading a `#n` URL opens that photo
  - With JavaScript disabled, a gallery page shows every photo as a list.
  - The contact form has the Netlify attributes, the honeypot field, and the required fields.
- **Content validation:** the build fails on an invalid `photos.json` or `site.json` (zod schemas).
- **Lighthouse CI:** the budgets in §7 are enforced against the preview build on every pull request.
- **Type and format checks:** `astro check` and Prettier.

## 11. Content David supplies

1. **The 60 curated JPEG exports**, uploaded into Cloudinary folders by set, each with `alt` text (and an optional caption) set as contextual metadata. Alt text can also be added later in `photos.json`.
2. **The hero image and a portrait**, uploaded to `portfolio/_extras/`.
3. **The final set names**, the homepage tagline, and the About copy (bio and "How I work").
4. **DNS changes** so the domains point to Netlify, email forwarding for `hello@`, and a Netlify email notification for form submissions.

## 12. Verify during implementation

1. Netlify's current free-plan limits (the credit-based plan): bandwidth, build minutes, and the Forms submission quota.
2. Cloudinary's free-plan credits, and that **strict transformations work with `f_auto`/`q_auto`**. If they don't, fall back to named transformations (`t_ftl_400` and so on) combined with `f_auto`.
3. The spelling of the second old domain (`thisismynext.photogrphy` vs `.photography`), and whether David wants to keep it.
