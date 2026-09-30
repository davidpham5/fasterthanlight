# fasterthanlight

Portfolio site for **FasterThanLight Studios**, corporate event photography by David Pham:
https://fasterthanlight.studio

## Licensing

- **Code:** Apache License 2.0 (see `LICENSE`).
- **Photographs:** © David Pham / FasterThanLight Studios. All rights reserved. The Apache
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
