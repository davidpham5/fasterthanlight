# fasterthanlight

Portfolio site for **FasterThanLight Studio**, event, hospitality and documentary photography by David Pham:
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
3. Commit any edits you made to `src/content/photos.json` first (the sync refuses to run over
   uncommitted changes, so it can never lose your alt text or captions).
4. `npm run sync-photos`, review with `git diff src/content/photos.json`, then commit.
   The sync also refuses to write if it would empty the file or remove more than half the photos
   (usually a folder-name mistake); add `-- --force` only if that is really what you want.
5. Location data is removed automatically. The sync downloads any new photo whose original contains
   GPS coordinates or place names, deletes just those fields with exiftool (no re-compression), and
   re-uploads it under the same name. A non-JPEG with location (e.g. an iPhone HEIC) is held back:
   re-export it as a JPEG without location and sync again.
6. `npm run sync-photos -- --audit-location` checks every photo already on the site the same way
   (one Cloudinary Admin API call per photo). It cleans what it can and lists anything to replace;
   it never removes photos from the site.
