# Photo Log: Design Spec

- **Date:** 2026-10-02
- **Status:** Draft for review
- **Site:** `https://fasterthanlight.studio`
- **Builds on:** `2026-09-30-portfolio-site-design.md`

## 1. Purpose

A **Photo Log** for photos that don't fit the client-facing portfolio, such as flowers or street photography around the neighbourhood. It's a diary of photo batches, inspired by [jamellebouie.net](https://jamellebouie.net/).

**Each post is a batch:** a title, a date, a line or two of text, then the photos stacked one above the next. Each photo has a small grey camera line underneath, plus an optional caption.

**Success looks like this:**
- David uploads a folder to Cloudinary and runs one command.
- He then edits one small Markdown file and publishes by deleting one line.
- Location data never reaches the public, from either Photo Log or the gallery.

### Non-goals

- Comments, tags or categories.
- A homepage teaser for the latest post.
- Camera lines in the gallery.
- Images larger than 1600px on the Photo Log.

## 2. Workflow

### What David does

1. **Upload** the photos to one Cloudinary folder per post, in the order they should appear:
   - `photo-log/peonies/`, or
   - `photo-log/2026-09-28-peonies/` (with a date prefix).
2. **Run `npm run sync-photos`.** It creates `src/content/photo-log/<folder-name>.md` as a draft.
3. **Edit the file:**
   - Fix the title and date if needed.
   - Write text below the frontmatter.
   - Fill in alt text and any captions.
   - Delete or reorder photo lines as wanted.
4. **Publish** by removing `draft: true`, then commit, push and merge as usual.

### Folder and post names

- **The folder name is the post's file name and web address.** `photo-log/peonies/` becomes `peonies.md` and `/photo-log/peonies`.
- **The name must be lowercase words joined by hyphens**, the same rule as gallery sets.
- **It can't be only digits**, because `/photo-log/2` is a feed page. Folders that break either rule are skipped with a warning.

### The draft post file

```md
---
title: Peonies
date: 2026-09-28
draft: true
photos:
  - id: DSCF6829_qdokib
    alt: ""
  - id: DSCF6834_xuwee2
    alt: ""
    lens: Helios 44-2      # optional: fills in or corrects camera data
---
Fuji X-T3, an overcast morning in the back garden.
```

**How the sync fills in the draft:**
- **`title`:** the folder name without any date prefix. Hyphens become spaces and the first letter is capitalised, so `2026-09-28-peonies` becomes "Peonies".
- **`date`** comes from the first source that has one:
  1. the folder's date prefix
  2. the earliest capture date among the photos
  3. the day of the sync
- **`photos[].id`** is the photo's name within the folder. Its full Cloudinary public ID is recorded in `photo-log.json` (§4).
- **`alt` and `caption`** are pre-filled from Cloudinary's alt and caption fields when set, matching the gallery workflow. Otherwise `alt` is `""`.
- **New photos are ordered by upload time,** oldest first.

**Fields David can add under any photo:**

| Field | Example |
|---|---|
| `caption` | `caption: The last of the season` |
| `camera` | `camera: Fujifilm X-T3` |
| `lens` | `lens: Helios 44-2` |
| `focal` | `focal: 58` |
| `aperture` | `aperture: 2` |
| `shutter` | `shutter: 1/250` |
| `iso` | `iso: 400` |

### Rules

- **Drafts never appear anywhere:** not in the feed, post pages, RSS, sitemap, or the nav check.
- **A published post fails the build** if any photo has empty alt text, or lists an `id` not found in `photo-log.json`.
- **Re-syncs never touch David's edits.** That covers title, date, body, alt text, captions, overrides, order and YAML comments. They only:
  - **append photos new to Cloudinary,** where "new" means not yet in `photo-log.json`. A photo David deleted from the post file therefore isn't re-added.
  - **remove photos deleted from Cloudinary.**
- **A deleted Cloudinary folder doesn't delete the post file.** The sync warns instead, so a slip in Cloudinary can't silently unpublish a post.
- **A deleted post file is recreated as a draft on the next sync,** and the sync says so. To drop a post for good, delete its Cloudinary folder too.

## 3. Camera line

One line of small grey text under each photo, for example:

*Fujifilm X-T3 · XC35mmF2 · 35mm · f/3.2 · 1/140s · ISO 160*

**Order:** camera · lens · focal length · aperture · shutter · ISO. Missing values are skipped, and the line is hidden if nothing is left.

### Sources

- **The data comes from the original's EXIF,** fetched once per new photo with Cloudinary's Admin API (`resource(id, { image_metadata: true })`).
- **The sync stores raw values** in `photo-log.json`. Formatting happens at build time, so formatting fixes apply without a re-sync.

### Formatting (`src/lib/exif.ts`)

**Camera:**
- **The brand comes from a lookup table:**
  - `FUJIFILM` → Fujifilm
  - `OLYMPUS CORPORATION` / `OLYMPUS IMAGING CORP.` → Olympus
  - `NIKON CORPORATION` → Nikon
  - `SONY` → Sony
  - `RICOH IMAGING COMPANY, LTD.` → Ricoh
  - `LEICA CAMERA AG` → Leica
- **Unknown makes** use their first word, title-cased.
- **The brand isn't repeated** when the model already starts with it: Canon + `Canon EOS 5D Mark II` → "Canon EOS 5D Mark II".

**Settings:**
- **Focal length:** `35.0 mm` → `35mm`.
- **Aperture:** `3.2` → `f/3.2`.
- **Shutter:** `1/140` → `1/140s`, and `0.5` → `0.5s`.
- **ISO:** `160` → `ISO 160`.
- **Nonsense values are dropped,** such as f/0, 0mm or ISO 0. Manual lenses often record these.

### Overrides from the post file

- **They always win** over the photo's own data.
- **A number gets the usual unit:** `focal: 58` → 58mm, `aperture: 2` → f/2, `iso: 400` → ISO 400.
- **A string is shown exactly as written.**
- **An empty string hides that value.**

## 4. Data

### `src/content/photo-log/<slug>.md` (David edits)

- The post files, validated as an Astro content collection (`src/content.config.ts`, using the glob loader).
- The schema lives in `src/lib/schema.ts` with the others:
  - `alt` must be non-empty unless `draft: true`.
  - Override fields accept a string or a positive number.

### `src/content/photo-log.json` (generated, never edited by hand)

```json
{
  "posts": {
    "peonies": {
      "photos": {
        "DSCF6829_qdokib": {
          "publicId": "photo-log/peonies/DSCF6829_qdokib",
          "width": 1086,
          "height": 1448,
          "placeholder": "data:image/jpeg;base64,…",
          "uploadedAt": "2026-09-28T17:02:11Z",
          "exif": {
            "make": "FUJIFILM",
            "model": "X-T3",
            "lens": "XC35mmF2",
            "focal": "35.0 mm",
            "aperture": "3.2",
            "shutter": "1/140",
            "iso": "160",
            "takenAt": "2026:09:28 08:14:03"
          }
        }
      }
    }
  }
}
```

**Joining the two files:** `src/lib/photo-log.ts` reads published posts from the collection and joins each photo to its JSON entry.

**What the pages get:** each post with fully resolved photos, meaning id, size, placeholder, alt, caption and a formatted camera line. Posts are sorted newest first, with ties broken by slug.

## 5. Location removal (applies to the gallery too)

**The problem:**
- **Delivered images are already clean.** Cloudinary's resizing drops all metadata.
- **Originals are not.** Cloudinary stores each upload byte-for-byte, and the original stays public at its direct `res.cloudinary.com` address. The photo names needed to build that address appear in the page code.

So the fix cleans the stored original.

### On every sync, for each new photo in `portfolio/` or `photo-log/`

1. **Detect.** The `image_metadata` fetched for the camera line also shows any location fields:
   - EXIF/XMP GPS tags
   - IPTC City, Sub-location, Province-State, Country
   - XMP photoshop City/State/Country, iptcCore Location/CountryCode, iptcExt LocationCreated/LocationShown
2. **Clean** (JPEG only):
   - Download the original and run exiftool on it, deleting only those fields.
   - exiftool rewrites metadata without re-encoding, so the picture data is unchanged and camera fields stay.
   - Before uploading, check locally that no location field remains.
3. **Re-upload** under the same public ID with `overwrite: true` and `invalidate: true`:
   - Carry over the asset's context (alt, caption) and tags, so nothing typed into Cloudinary is lost.
   - Site URLs don't include a version number, so they don't change.
4. **Verify.** Fetch `image_metadata` again and confirm no location field remains.
5. **Report**, for example `Removed location from photo-log/peonies/IMG_0412`.

**Held back:** a photo isn't added to the site in two cases:
- it has location data but isn't a JPEG (an iPhone HEIC, for example)
- it fails steps 2–4

The sync names the photo and says to re-export it as a JPEG without location. It's picked up on a later sync once replaced.

### `npm run sync-photos -- --audit-location`

- **A one-time check and clean** of every photo already in `photos.json` and `photo-log.json`. That's about 70 Admin API calls, well inside the free plan's 500 per hour.
- **A photo it can't clean stays on the site.** Removing it would be surprising, so it's listed with instructions to replace it.

### Tooling

- `exiftool-vendored`, a devDependency that bundles exiftool, so no system install is needed.
- The cleaning logic lives in `scripts/sync/location.ts`.

### Known limits (documented, not fixed)

- **Copies made before the clean keep their location.** That covers anything already downloaded or shared, and anything saved by a third-party cache.
- **Cloudinary backups,** if enabled on the account, keep the old version. Backups are private.

## 6. Pages

### Nav

- **Gallery · Photo Log · About · Contact.**
- **The Photo Log link only appears when at least one post is published.**

### `/photo-log` and `/photo-log/2`, `/photo-log/3` …: the feed

- **5 posts per page,** newest first, with *← Newer* / *Older →* links at the bottom.
- **Each post appears in full:**
  - **Title** (Canela, via `--font-display`), linking to the post page.
  - **Date**, e.g. *September 28, 2026*.
  - **The Markdown body.**
  - **The photos.** Each has its camera line, then its caption if there is one.
- **Single centred column,** at most about 1100px wide.
- **Tall photos are capped to the viewport height,** the same rule as the gallery, so a portrait never needs scrolling to see whole.
- **Image loading:**
  - The first photo on the page loads eagerly; the rest lazily.
  - Every photo reserves its exact space and shows the blurred placeholder, so nothing shifts.
- **Images top out at 1600px.** `srcsetFor` gains an optional maximum width, and Photo Log passes 1600.

### `/photo-log/<slug>`: a single post

- **The same layout as the feed,** for one post.
- **Navigation:** *← Previous post* / *Next post →* links, in date order.
- **Social preview card:**
  - `og:image` is the first photo at 1600px.
  - The description is the post's first paragraph as plain text, falling back to the title.
  - `Base.astro` gains optional `ogImage` and `ogType` props.

### `/photo-log/rss.xml`

- **One entry per published post:** title, date, link, and the body plus photos as HTML.
- **Photo URLs are absolute,** at 1600px, with alt text.
- **Built with `@astrojs/rss`.** A `<link rel="alternate">` in the page head advertises the feed.

### Discovery and protection

- **Sitemap:** post and feed pages are included automatically.
- **Inherited from the rest of the site:** the AI-crawler blocks (`robots.txt`), the `noai` tags and the TDMRep opt-out.

## 7. Photo viewer

**Scope:** Photo Log only. On the feed, each post's photos form their own group.

### Behaviour

- **Opening:**
  - Clicking or tapping a photo opens it in a `<dialog>`, with a white backdrop and the photo as large as fits.
  - The caption and camera line sit underneath.
  - The already-loaded image shows straight away, while the 1600px version loads over it.
- **Moving:** *←* / *→* buttons, the arrow keys, or swiping step through the post's photos, wrapping around at either end.
- **Closing:** *✕*, Esc, or a click on the backdrop. Focus returns to the photo that was opened.

### Build

- **Script:** `src/scripts/viewer.ts`, about 2 KB gzipped.
- **Reuse:** `wrapIndex` and `swipeDirection` from `slideshow-state.ts`.
- **Without JavaScript:** each photo is wrapped in a link to its 1600px image file, so clicking still shows it larger.

## 8. Code layout

| File | Job |
|---|---|
| `src/content.config.ts` | Declares the `photoLog` collection. |
| `src/lib/schema.ts` | The post-file schema and the `photo-log.json` schema. |
| `src/lib/exif.ts` | Raw EXIF plus overrides → the camera line. |
| `src/lib/photo-log.ts` | Joins posts with `photo-log.json`, filters drafts, sorts, paginates and finds neighbours. Also provides `hasPublishedPosts()` for the nav. |
| `src/lib/cloudinary.ts` | `srcsetFor` gains an optional maximum width. |
| `src/components/LogPost.astro` | One post: title, date, body, photos. |
| `src/components/LogPhoto.astro` | One photo with link, camera line and caption. |
| `src/pages/photo-log/[...page].astro` | The feed and its pages. |
| `src/pages/photo-log/[slug].astro` | A post page. |
| `src/pages/photo-log/rss.xml.ts` | The RSS feed. |
| `src/scripts/viewer.ts` | The photo viewer. |
| `scripts/sync/photo-log.ts` | Pure functions: folder name → slug/title/date, and merging Cloudinary photos into a post file using the `yaml` Document API (which keeps comments and order). |
| `scripts/sync/location.ts` | Location-field detection (pure) and the exiftool cleaner. |
| `scripts/sync/exif.ts` | Picks the raw fields from Cloudinary's `image_metadata`. |
| `scripts/sync-photos.ts` | Orchestrates the portfolio and Photo Log sync, plus `--audit-location`. |

### Sync safeguards (extending the existing ones)

- **Uncommitted edits block the sync** unless `--force` is passed. The check now covers `photos.json`, `photo-log.json` and `src/content/photo-log/`.
- **A missing `photo-log/` folder in Cloudinary** means "no posts", not an error.
- **Cloudinary errors only ever go through `describeError`,** because raw SDK errors contain the API secret.
- **Admin API calls happen only for new photos,** plus the audit.

## 9. Testing

### Unit tests (Vitest)

- **Camera line:** brand table, model de-duplication, each unit, dropped zero values, override precedence (numbers, strings, empty string).
- **Post schema:** a draft with empty alt passes; a published post with empty alt fails; overrides accept numbers and strings.
- **Folder names:** slug, title and date parsing; all-digit and invalid names are rejected.
- **Post-file merge:**
  - New photos are appended in upload order; deleted ones are removed.
  - A photo David removed from the file stays removed.
  - Title, date, body, alt text, overrides, order and YAML comments survive unchanged.
- **Joining posts with `photo-log.json`:** drafts are filtered out; sorting, paging and neighbours work; an unknown id fails with a clear message; `hasPublishedPosts()` behaves correctly.
- **Location detection:** each location field family is detected; camera-only metadata isn't flagged.

### Real-file test

- A small JPEG fixture is given GPS and IPTC City with exiftool, then cleaned.
- **Afterwards:**
  - GPS and City are gone.
  - Make, Model and LensModel remain.
  - With all metadata stripped from both copies, the before and after files are byte-for-byte identical.

### Browser tests (Playwright, desktop and Pixel 7)

They run against whichever posts are published, and the first real post ships with the PR that adds Photo Log.

- **Feed:** posts in date order, Newer/Older links, and every image served from `/img` at no more than 1600px.
- **Post pages:** previous/next links and `og:image`.
- **RSS:** valid XML, one item per published post, and absolute image URLs.
- **Nav:** shows Photo Log.
- **Viewer:**
  - Opens on click.
  - Arrows and keys move between photos.
  - Esc closes it, and focus returns to the photo.
  - Swipe works on Pixel 7.
  - Without JavaScript, the link opens the image.
- **Layout:** no layout shift on the feed.

### Budgets and CI

- **`scripts/check-budgets.mjs`:** at most 3 KB of gzipped JavaScript on Photo Log pages.
- **Lighthouse CI:** add `/photo-log` to the checked URLs, with the same thresholds as the rest of the site.

## 10. Delivery

1. **PR A: location removal.**
   - The detection, the cleaner and the sync hooks for `portfolio/`, plus `--audit-location`.
   - Running the audit once is part of this PR.
   - Useful straight away for the gallery.
2. **PR B: Photo Log.**
   - The pages, viewer, RSS, nav and Photo Log sync.
   - Merged together with David's first published post, perhaps the neighbourhood photos.
