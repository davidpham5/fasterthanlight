# Location Removal Implementation Plan (PR A)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Every photo the sync adds to the site has its GPS and place-name metadata removed from the original stored in Cloudinary, and a one-off `--audit-location` run cleans the photos already published.

**Architecture:** A pure detector (`location.ts`) decides from Cloudinary's `image_metadata` whether a photo carries location data. A file cleaner (`strip.ts`) removes only the location fields with exiftool, which leaves the image data untouched. `protect.ts` orchestrates download → strip → re-upload → re-verify through injected dependencies, so it is unit-testable without Cloudinary. `sync-photos.ts` runs it on new photos and in `--audit-location` mode.

**Tech Stack:** TypeScript (tsx), Vitest, `cloudinary` v2 SDK (Admin + Upload API), `exiftool-vendored` (bundles exiftool; needs Perl, which macOS and the Ubuntu CI runner have).

**Spec:** `docs/superpowers/specs/2026-10-02-photo-log-design.md` (§5 Location removal, §8 Sync safeguards, §9 Testing, §10 Delivery)

## Global Constraints

- Node: `export PATH="$HOME/.nvm/versions/node/v24.14.0/bin:$PATH"` before any `npm`/`npx` command.
- Repo: `~/Developer/fasterthanlight`. Work on a branch `feat/location-removal` cut from up-to-date `main`.
- **Never print raw Cloudinary SDK errors.** They contain the API key and secret. Always go through `describeError` from `scripts/sync/errors.ts`.
- Never commit `.env`. Never ask David to paste the API secret into chat.
- Cloudinary cloud `dpham5` uses **fixed folder mode**. Strict transformations must stay **OFF**.
- Only JPEGs are cleaned. A non-JPEG with location data is **held back** (not added to the site) with a message to re-export it as JPEG without location.
- Only location fields change. Camera, lens and settings fields must survive. No re-compression.
- Re-uploads use the same public ID with `overwrite: true` and `invalidate: true`, carrying over the asset's context (alt, caption) and tags.
- `--audit-location` never removes a photo from the site. Photos it can't clean are listed for David to replace.
- Code style: Prettier (single quotes, width 100). Comments match the surrounding sparse, "why"-focused style.
- Ask David before pushing, opening the PR, merging, or running anything that writes to Cloudinary (the audit).

## Review Focus

1. **An exiftool failure mid-clean** (corrupt JPEG, Perl missing): the photo must be held back with a readable reason. It must never be uploaded half-cleaned, and the sync must not crash. → Task 3: "a strip failure holds the photo back and uploads nothing".
2. **A Cloudinary error carrying credentials**, such as a 401 from the upload: the reason shown must not contain the key or secret. → Task 3: "an upload error is reported without credentials".
3. **A photo with no `context` or `tags` at all**, the common case for gallery uploads: the re-upload must still succeed with empty values rather than sending `undefined`. → Task 3: "a photo without context or tags re-uploads with empty values".
4. **Empty location values that Cloudinary reports**, such as `"City": ""` or an IPTC record with blank fields: these must not count as location, or every Photomator export would be re-uploaded. → Task 1: "empty values aren't location".
5. **The exiftool child process keeps the sync from exiting**: the sync must always end exiftool, including on error. → Task 4: the `finally` block, checked by a manual run that returns to the prompt.

---

## File Structure

| File | Responsibility |
|---|---|
| `scripts/sync/location.ts` (create) | Pure: which metadata fields are location, the verdict per photo (keep / strip / hold), and the exiftool arguments that delete them. |
| `scripts/sync/location.test.ts` (create) | Unit tests for the above. |
| `scripts/sync/strip.ts` (create) | Runs exiftool on a local file and re-checks the result. |
| `scripts/sync/strip.test.ts` (create) | Real-file test against a JPEG fixture. |
| `scripts/sync/fixtures/plain.jpg` (create) | A 16×16 JPEG with no location, used by the real-file test. |
| `scripts/sync/protect.ts` (create) | Orchestrates one photo (`protectPhoto`) and many (`protectAll`) via injected deps; `cloudinaryDeps()` is the real implementation. |
| `scripts/sync/protect.test.ts` (create) | Unit tests with fake deps. |
| `scripts/sync/merge.ts` (modify) | Adds `knownIds()`. |
| `scripts/sync/merge.test.ts` (modify) | Test for `knownIds()`. |
| `scripts/sync-photos.ts` (modify) | Runs protection on new photos; adds `--audit-location`. |
| `README.md` (modify) | Documents location removal and the audit. |
| `package.json` (modify) | `exiftool-vendored` devDependency. |

---

### Task 1: Location detection

**Files:**
- Create: `scripts/sync/location.ts`
- Test: `scripts/sync/location.test.ts`

**Interfaces:**
- Produces:
  - `type Metadata = Record<string, unknown>`
  - `locationFields(meta: Metadata): string[]`, which returns the sorted names of non-empty location fields.
  - `type Verdict = { action: 'keep' } | { action: 'strip'; fields: string[] } | { action: 'hold'; fields: string[]; reason: string }`
  - `locationVerdict(meta: Metadata, format: string): Verdict`
  - `STRIP_ARGS: readonly string[]`

- [ ] **Step 1: Create the branch**

```bash
cd ~/Developer/fasterthanlight && git switch main && git pull && git switch -c feat/location-removal
```

- [ ] **Step 2: Write the failing tests**

`scripts/sync/location.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { STRIP_ARGS, locationFields, locationVerdict } from './location';

// Shaped like Cloudinary's image_metadata for one of David's Fujifilm exports.
const camera = {
  Make: 'FUJIFILM',
  Model: 'X-T3',
  LensModel: 'XC35mmF2',
  FNumber: '2.2',
  DateTimeOriginal: '2026:08:02 20:29:40',
  CopyrightNotice: '',
};

describe('locationFields', () => {
  it('finds nothing in camera-only metadata', () => {
    expect(locationFields(camera)).toEqual([]);
  });

  it('finds GPS tags', () => {
    expect(
      locationFields({ ...camera, GPSLatitude: '40 deg 40\' 12.00" N', GPSVersionID: '2.3.0.0' }),
    ).toEqual(['GPSLatitude', 'GPSVersionID']);
  });

  it('finds IPTC and XMP place names', () => {
    expect(
      locationFields({
        ...camera,
        City: 'Brooklyn',
        'Sub-location': 'Park Slope',
        'Province-State': 'NY',
        'Country-PrimaryLocationName': 'USA',
        'Country-PrimaryLocationCode': 'US',
        State: 'NY',
        Country: 'USA',
        CountryCode: 'US',
        Location: 'Prospect Park',
      }),
    ).toEqual([
      'City',
      'Country',
      'Country-PrimaryLocationCode',
      'Country-PrimaryLocationName',
      'CountryCode',
      'Location',
      'Province-State',
      'State',
      'Sub-location',
    ]);
  });

  it('finds XMP location structures, flattened or not', () => {
    expect(
      locationFields({ LocationCreatedCity: 'Brooklyn', LocationShown: [{ City: 'Brooklyn' }] }),
    ).toEqual(['LocationCreatedCity', 'LocationShown']);
  });

  it("empty values aren't location", () => {
    expect(
      locationFields({ City: '', 'Sub-location': '   ', GPSLatitude: null, LocationShown: [] }),
    ).toEqual([]);
  });
});

describe('locationVerdict', () => {
  it('keeps a photo without location', () => {
    expect(locationVerdict(camera, 'jpg')).toEqual({ action: 'keep' });
  });

  it('strips a JPEG with location', () => {
    expect(locationVerdict({ ...camera, City: 'Brooklyn' }, 'jpg')).toEqual({
      action: 'strip',
      fields: ['City'],
    });
    expect(locationVerdict({ GPSLatitude: '1' }, 'JPEG')).toMatchObject({ action: 'strip' });
  });

  it('holds back any other format with location, and says what to do', () => {
    const verdict = locationVerdict({ GPSLatitude: '1' }, 'heic');
    expect(verdict).toMatchObject({ action: 'hold', fields: ['GPSLatitude'] });
    expect(verdict.action === 'hold' && verdict.reason).toMatch(/HEIC.*re-export it as a JPEG/);
  });

  it('keeps any format without location', () => {
    expect(locationVerdict(camera, 'heic')).toEqual({ action: 'keep' });
  });
});

describe('STRIP_ARGS', () => {
  it('overwrites in place and deletes GPS and place names, not whole metadata groups', () => {
    expect(STRIP_ARGS[0]).toBe('-overwrite_original');
    expect(STRIP_ARGS).toContain('-gps:all=');
    expect(STRIP_ARGS).toContain('-iptc:city=');
    expect(STRIP_ARGS).not.toContain('-all=');
    expect(STRIP_ARGS).not.toContain('-exif:all=');
  });
});
```

- [ ] **Step 3: Run the tests and confirm they fail**

Run: `npx vitest run scripts/sync/location.test.ts`
Expected: FAIL, "Failed to resolve import './location'".

- [ ] **Step 4: Implement**

`scripts/sync/location.ts`:

```ts
// Decides whether a photo's original carries location data, and how to remove it. Delivered
// (resized) images never carry metadata; the original stored in Cloudinary keeps everything.

/** A photo's metadata: Cloudinary's image_metadata, or tags read by exiftool. */
export type Metadata = Record<string, unknown>;

/** IPTC and XMP place-name fields, as Cloudinary and exiftool name them (without group prefix). */
const PLACE_NAMES = new Set([
  'City',
  'Sub-location',
  'Sublocation',
  'Province-State',
  'State',
  'Country',
  'Country-PrimaryLocationName',
  'Country-PrimaryLocationCode',
  'CountryCode',
  'Location',
]);

function isLocationKey(key: string): boolean {
  return (
    key.startsWith('GPS') ||
    key.startsWith('LocationCreated') ||
    key.startsWith('LocationShown') ||
    PLACE_NAMES.has(key)
  );
}

function hasValue(value: unknown): boolean {
  if (value === null || value === undefined) return false;
  if (Array.isArray(value)) return value.length > 0;
  if (typeof value === 'object') return Object.keys(value).length > 0;
  return String(value).trim() !== '';
}

export function locationFields(meta: Metadata): string[] {
  return Object.entries(meta)
    .filter(([key, value]) => isLocationKey(key) && hasValue(value))
    .map(([key]) => key)
    .sort();
}

export type Verdict =
  | { action: 'keep' }
  | { action: 'strip'; fields: string[] }
  | { action: 'hold'; fields: string[]; reason: string };

/** Only JPEGs are cleaned; anything else with location is held back from the site. */
export function locationVerdict(meta: Metadata, format: string): Verdict {
  const fields = locationFields(meta);
  if (fields.length === 0) return { action: 'keep' };
  if (/^jpe?g$/i.test(format)) return { action: 'strip', fields };
  return {
    action: 'hold',
    fields,
    reason:
      `has location data (${fields.join(', ')}) but is a ${format.toUpperCase()}, and only ` +
      'JPEGs are cleaned automatically. Re-export it as a JPEG without location.',
  };
}

/**
 * exiftool arguments that delete GPS and place names only. exiftool rewrites metadata segments
 * without re-encoding, so the image data and camera fields are untouched.
 */
export const STRIP_ARGS: readonly string[] = [
  '-overwrite_original',
  '-gps:all=',
  '-xmp-exif:gps*=',
  '-iptc:city=',
  '-iptc:sub-location=',
  '-iptc:province-state=',
  '-iptc:country-primarylocationname=',
  '-iptc:country-primarylocationcode=',
  '-xmp-photoshop:city=',
  '-xmp-photoshop:state=',
  '-xmp-photoshop:country=',
  '-xmp-iptccore:location=',
  '-xmp-iptccore:countrycode=',
  '-xmp-iptcext:locationcreated=',
  '-xmp-iptcext:locationshown=',
];
```

- [ ] **Step 5: Run the tests and confirm they pass**

Run: `npx vitest run scripts/sync/location.test.ts`
Expected: PASS (11 tests).

- [ ] **Step 6: Commit**

```bash
git add scripts/sync/location.ts scripts/sync/location.test.ts
git commit -m "feat(sync): detect location data in photo metadata"
```

---

### Task 2: The exiftool cleaner

**Files:**
- Modify: `package.json` (devDependency)
- Create: `scripts/sync/fixtures/plain.jpg`
- Create: `scripts/sync/strip.ts`
- Test: `scripts/sync/strip.test.ts`

**Interfaces:**
- Consumes: `STRIP_ARGS`, `locationFields`, `Metadata` (Task 1).
- Produces:
  - `stripLocation(path: string): Promise<void>`, which cleans in place and throws if any location field survives.
  - `endExiftool(): Promise<void>`

- [ ] **Step 1: Install exiftool-vendored and create the fixture**

```bash
npm install --save-dev exiftool-vendored@^38
mkdir -p scripts/sync/fixtures
sips -s format jpeg -z 16 16 "/System/Library/Desktop Pictures/iMac Blue.heic" --out scripts/sync/fixtures/plain.jpg
```

If that `.heic` doesn't exist, run `ls "/System/Library/Desktop Pictures"/*.heic` and use any one of them. Expected: `scripts/sync/fixtures/plain.jpg` exists, about 1 KB.

- [ ] **Step 2: Write the failing test**

`scripts/sync/strip.test.ts`:

```ts
import { copyFile, mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { exiftool } from 'exiftool-vendored';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { locationFields, type Metadata } from './location';
import { endExiftool, stripLocation } from './strip';

const FIXTURE = new URL('./fixtures/plain.jpg', import.meta.url).pathname;
let dir: string;

beforeAll(async () => {
  dir = await mkdtemp(join(tmpdir(), 'strip-test-'));
});
afterAll(async () => {
  await endExiftool();
  await rm(dir, { recursive: true, force: true });
});

/** A copy of the fixture with camera data, GPS and place names, like a Lightroom export. */
async function locatedCopy(name: string): Promise<string> {
  const path = join(dir, name);
  await copyFile(FIXTURE, path);
  await exiftool.write(
    path,
    {
      Make: 'FUJIFILM',
      Model: 'X-T3',
      LensModel: 'XC35mmF2',
      GPSLatitude: 40.67,
      GPSLatitudeRef: 'N',
      GPSLongitude: -73.97,
      GPSLongitudeRef: 'W',
      'IPTC:City': 'Brooklyn',
      'IPTC:Sub-location': 'Park Slope',
      'XMP-photoshop:City': 'Brooklyn',
    } as never,
    { writeArgs: ['-overwrite_original'] },
  );
  return path;
}

const read = async (path: string) => (await exiftool.read(path)) as unknown as Metadata;

describe('stripLocation', () => {
  it('removes GPS and place names but keeps the camera data', { timeout: 30_000 }, async () => {
    const path = await locatedCopy('located.jpg');
    expect(locationFields(await read(path))).toContain('GPSLatitude');

    await stripLocation(path);

    const after = await read(path);
    expect(locationFields(after)).toEqual([]);
    expect(after).toMatchObject({ Make: 'FUJIFILM', Model: 'X-T3', LensModel: 'XC35mmF2' });
  });

  it('leaves the picture data byte-for-byte identical', { timeout: 30_000 }, async () => {
    const before = await locatedCopy('before.jpg');
    const after = join(dir, 'after.jpg');
    await copyFile(before, after);
    await stripLocation(after);

    // With every metadata segment removed from both, only the image data is left to compare.
    await exiftool.deleteAllTags(before);
    await exiftool.deleteAllTags(after);
    expect((await readFile(after)).equals(await readFile(before))).toBe(true);
  });

  it('rejects a file that is not an image', { timeout: 30_000 }, async () => {
    const path = join(dir, 'not-an-image.jpg');
    await copyFile(new URL(import.meta.url).pathname, path);
    await expect(stripLocation(path)).rejects.toThrow();
  });
});
```

- [ ] **Step 3: Run it and confirm it fails**

Run: `npx vitest run scripts/sync/strip.test.ts`
Expected: FAIL, "Failed to resolve import './strip'".

- [ ] **Step 4: Implement**

`scripts/sync/strip.ts`:

```ts
import { exiftool } from 'exiftool-vendored';
import { STRIP_ARGS, locationFields, type Metadata } from './location';

/** Removes location fields from a local JPEG in place, then re-reads it to prove they're gone. */
export async function stripLocation(path: string): Promise<void> {
  await exiftool.write(path, {}, { writeArgs: [...STRIP_ARGS] });
  const left = locationFields((await exiftool.read(path)) as unknown as Metadata);
  if (left.length > 0) throw new Error(`location fields survived cleaning: ${left.join(', ')}`);
}

/** exiftool runs as a long-lived child process; end it or the sync never exits. */
export function endExiftool(): Promise<void> {
  return exiftool.end();
}
```

- [ ] **Step 5: Run it and confirm it passes**

Run: `npx vitest run scripts/sync/strip.test.ts`
Expected: PASS (3 tests).

If the type-check rejects `{}` as `WriteTags`, keep `{}` and change nothing else; `exiftool.write(path, {}, options)` is the documented call.

- [ ] **Step 6: Run the whole unit suite and the type check**

Run: `npm test && npm run check`
Expected: all pass, 0 errors.

- [ ] **Step 7: Commit**

```bash
git add package.json package-lock.json scripts/sync/strip.ts scripts/sync/strip.test.ts scripts/sync/fixtures/plain.jpg
git commit -m "feat(sync): strip location fields from a JPEG with exiftool"
```

---

### Task 3: Protecting a photo in Cloudinary

**Files:**
- Create: `scripts/sync/protect.ts`
- Test: `scripts/sync/protect.test.ts`

**Interfaces:**
- Consumes:
  - `locationVerdict`, `locationFields` (Task 1)
  - `stripLocation` (Task 2)
  - `describeError(error: unknown): string` from `./errors`
- Produces:
  - `interface CloudResource { public_id: string; format: string; secure_url: string; asset_folder?: string; image_metadata?: Record<string, string>; context?: { custom?: Record<string, string> }; tags?: string[] }`
  - `interface UploadOptions { publicId: string; assetFolder?: string; context: Record<string, string>; tags: string[] }`
  - `interface ProtectDeps { fetchResource(publicId: string): Promise<CloudResource>; download(url: string, path: string): Promise<void>; strip(path: string): Promise<void>; upload(path: string, options: UploadOptions): Promise<void> }`
  - `type ProtectResult = { status: 'clean'; metadata: Record<string, string> } | { status: 'cleaned'; metadata: Record<string, string>; fields: string[] } | { status: 'held'; reason: string }`
  - `protectPhoto(publicId: string, deps: ProtectDeps, workDir: string): Promise<ProtectResult>`
  - `interface ProtectReport { cleaned: string[]; held: { id: string; reason: string }[] }`
  - `protectAll<T extends { id: string }>(photos: T[], protect: (id: string) => Promise<ProtectResult>): Promise<{ kept: T[]; metadata: Map<string, Record<string, string>>; report: ProtectReport }>`
  - `cloudinaryDeps(): ProtectDeps`

- [ ] **Step 1: Write the failing tests**

`scripts/sync/protect.test.ts`:

```ts
import { mkdtemp, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { protectAll, protectPhoto, type CloudResource, type ProtectDeps } from './protect';

let dir: string;
beforeAll(async () => {
  dir = await mkdtemp(join(tmpdir(), 'protect-test-'));
});
afterAll(() => rm(dir, { recursive: true, force: true }));

const ID = 'portfolio/documentary/DSCF1';
const camera = { Make: 'FUJIFILM', Model: 'X-T3' };

function resource(meta: Record<string, string>, extra: Partial<CloudResource> = {}): CloudResource {
  return {
    public_id: ID,
    format: 'jpg',
    secure_url: `https://res.cloudinary.com/demo/image/upload/v1/${ID}.jpg`,
    image_metadata: meta,
    context: { custom: { alt: 'A child in a yellow rain jacket' } },
    tags: ['documentary'],
    ...extra,
  };
}

/** Fake Cloudinary: returns `before` until an upload happens, then `after`. */
function fakeDeps(before: CloudResource, after: CloudResource = before) {
  let uploaded = false;
  const deps = {
    fetchResource: vi.fn(async () => (uploaded ? after : before)),
    download: vi.fn(async (_url: string, path: string) => writeFile(path, 'jpeg bytes')),
    strip: vi.fn(async () => {}),
    upload: vi.fn(async () => {
      uploaded = true;
    }),
  } satisfies ProtectDeps;
  return deps;
}

describe('protectPhoto', () => {
  it('leaves a photo without location alone', async () => {
    const deps = fakeDeps(resource(camera));
    expect(await protectPhoto(ID, deps, dir)).toEqual({ status: 'clean', metadata: camera });
    expect(deps.download).not.toHaveBeenCalled();
    expect(deps.upload).not.toHaveBeenCalled();
  });

  it('cleans a JPEG with location and re-uploads it with its alt text and tags', async () => {
    const deps = fakeDeps(resource({ ...camera, City: 'Brooklyn' }), resource(camera));
    expect(await protectPhoto(ID, deps, dir)).toEqual({
      status: 'cleaned',
      metadata: camera,
      fields: ['City'],
    });
    expect(deps.download).toHaveBeenCalledWith(
      `https://res.cloudinary.com/demo/image/upload/v1/${ID}.jpg`,
      expect.stringMatching(/\.jpg$/),
    );
    expect(deps.strip).toHaveBeenCalledOnce();
    expect(deps.upload).toHaveBeenCalledWith(expect.any(String), {
      publicId: ID,
      assetFolder: undefined,
      context: { alt: 'A child in a yellow rain jacket' },
      tags: ['documentary'],
    });
    expect(await readdir(dir)).toEqual([]); // the temporary copy is deleted
  });

  it('a photo without context or tags re-uploads with empty values', async () => {
    const bare = resource({ GPSLatitude: '1' }, { context: undefined, tags: undefined });
    const deps = fakeDeps(bare, resource(camera));
    await protectPhoto(ID, deps, dir);
    expect(deps.upload).toHaveBeenCalledWith(expect.any(String), {
      publicId: ID,
      assetFolder: undefined,
      context: {},
      tags: [],
    });
  });

  it('holds back a non-JPEG with location without touching it', async () => {
    const deps = fakeDeps(resource({ GPSLatitude: '1' }, { format: 'heic' }));
    const result = await protectPhoto(ID, deps, dir);
    expect(result).toMatchObject({ status: 'held' });
    expect(result.status === 'held' && result.reason).toMatch(/re-export it as a JPEG/);
    expect(deps.download).not.toHaveBeenCalled();
  });

  it('a strip failure holds the photo back and uploads nothing', async () => {
    const deps = fakeDeps(resource({ City: 'Brooklyn' }));
    deps.strip.mockRejectedValueOnce(new Error('exiftool: corrupt JPEG'));
    const result = await protectPhoto(ID, deps, dir);
    expect(result).toEqual({
      status: 'held',
      reason: 'could not be checked or cleaned: exiftool: corrupt JPEG',
    });
    expect(deps.upload).not.toHaveBeenCalled();
    expect(await readdir(dir)).toEqual([]);
  });

  it('an upload error is reported without credentials', async () => {
    const deps = fakeDeps(resource({ City: 'Brooklyn' }));
    deps.upload.mockRejectedValueOnce({
      error: { message: 'Invalid Signature', http_code: 401 },
      request_options: { auth: { api_key: 'KEY123', api_secret: 'SECRET456' } },
    });
    const result = await protectPhoto(ID, deps, dir);
    expect(result).toEqual({
      status: 'held',
      reason: 'could not be checked or cleaned: Cloudinary API error 401: Invalid Signature',
    });
    expect(JSON.stringify(result)).not.toMatch(/KEY123|SECRET456/);
  });

  it('holds back a photo whose location survives the re-upload', async () => {
    const deps = fakeDeps(resource({ City: 'Brooklyn' }));
    expect(await protectPhoto(ID, deps, dir)).toEqual({
      status: 'held',
      reason: 'still has location data after cleaning (City)',
    });
  });

  it('passes the asset folder through, for accounts in dynamic folder mode', async () => {
    const deps = fakeDeps(
      resource({ City: 'X' }, { asset_folder: 'portfolio/documentary' }),
      resource(camera),
    );
    await protectPhoto(ID, deps, dir);
    expect(deps.upload).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ assetFolder: 'portfolio/documentary' }),
    );
  });
});

describe('protectAll', () => {
  it('keeps clean and cleaned photos, drops held ones, and reports both', async () => {
    const photos = [{ id: 'a' }, { id: 'b' }, { id: 'c' }];
    const results = {
      a: { status: 'clean', metadata: { Make: 'A' } },
      b: { status: 'cleaned', metadata: { Make: 'B' }, fields: ['City'] },
      c: { status: 'held', reason: 'is a HEIC' },
    } as const;
    const { kept, metadata, report } = await protectAll(photos, async (id) => results[id as 'a']);
    expect(kept).toEqual([{ id: 'a' }, { id: 'b' }]);
    expect(metadata).toEqual(
      new Map([
        ['a', { Make: 'A' }],
        ['b', { Make: 'B' }],
      ]),
    );
    expect(report).toEqual({ cleaned: ['b'], held: [{ id: 'c', reason: 'is a HEIC' }] });
  });
});
```

- [ ] **Step 2: Run them and confirm they fail**

Run: `npx vitest run scripts/sync/protect.test.ts`
Expected: FAIL, "Failed to resolve import './protect'".

- [ ] **Step 3: Implement**

`scripts/sync/protect.ts`:

```ts
// Keeps location data out of the originals stored in Cloudinary: download, strip, re-upload under
// the same public ID, then check again. Anything that can't be cleaned is held back.
import { rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { v2 as cloudinary } from 'cloudinary';
import { describeError } from './errors';
import { locationFields, locationVerdict } from './location';
import { stripLocation } from './strip';

export interface CloudResource {
  public_id: string;
  format: string;
  secure_url: string;
  asset_folder?: string;
  image_metadata?: Record<string, string>;
  context?: { custom?: Record<string, string> };
  tags?: string[];
}

export interface UploadOptions {
  publicId: string;
  assetFolder?: string;
  context: Record<string, string>;
  tags: string[];
}

export interface ProtectDeps {
  fetchResource(publicId: string): Promise<CloudResource>;
  download(url: string, path: string): Promise<void>;
  strip(path: string): Promise<void>;
  upload(path: string, options: UploadOptions): Promise<void>;
}

export type ProtectResult =
  | { status: 'clean'; metadata: Record<string, string> }
  | { status: 'cleaned'; metadata: Record<string, string>; fields: string[] }
  | { status: 'held'; reason: string };

export async function protectPhoto(
  publicId: string,
  deps: ProtectDeps,
  workDir: string,
): Promise<ProtectResult> {
  try {
    const before = await deps.fetchResource(publicId);
    const verdict = locationVerdict(before.image_metadata ?? {}, before.format);
    if (verdict.action === 'keep') return { status: 'clean', metadata: before.image_metadata ?? {} };
    if (verdict.action === 'hold') return { status: 'held', reason: verdict.reason };

    const file = join(workDir, `${publicId.replaceAll('/', '__')}.${before.format}`);
    try {
      await deps.download(before.secure_url, file);
      await deps.strip(file);
      await deps.upload(file, {
        publicId,
        assetFolder: before.asset_folder,
        context: before.context?.custom ?? {},
        tags: before.tags ?? [],
      });
    } finally {
      await rm(file, { force: true });
    }

    const after = await deps.fetchResource(publicId);
    const left = locationFields(after.image_metadata ?? {});
    if (left.length > 0) {
      return { status: 'held', reason: `still has location data after cleaning (${left.join(', ')})` };
    }
    return { status: 'cleaned', metadata: after.image_metadata ?? {}, fields: verdict.fields };
  } catch (error) {
    // describeError never includes the request details, which hold the API key and secret.
    return { status: 'held', reason: `could not be checked or cleaned: ${describeError(error)}` };
  }
}

export interface ProtectReport {
  cleaned: string[];
  held: { id: string; reason: string }[];
}

/** Runs one photo at a time: the Admin API allows 500 calls an hour on the free plan. */
export async function protectAll<T extends { id: string }>(
  photos: T[],
  protect: (id: string) => Promise<ProtectResult>,
): Promise<{ kept: T[]; metadata: Map<string, Record<string, string>>; report: ProtectReport }> {
  const kept: T[] = [];
  const metadata = new Map<string, Record<string, string>>();
  const report: ProtectReport = { cleaned: [], held: [] };
  for (const photo of photos) {
    const result = await protect(photo.id);
    if (result.status === 'held') {
      report.held.push({ id: photo.id, reason: result.reason });
      continue;
    }
    if (result.status === 'cleaned') report.cleaned.push(photo.id);
    metadata.set(photo.id, result.metadata);
    kept.push(photo);
  }
  return { kept, metadata, report };
}

/** The real dependencies. Expects cloudinary.config() to have been called. */
export function cloudinaryDeps(): ProtectDeps {
  return {
    fetchResource: async (publicId) =>
      (await cloudinary.api.resource(publicId, {
        image_metadata: true,
        context: true,
        tags: true,
      })) as CloudResource,
    download: async (url, path) => {
      const res = await fetch(url);
      if (!res.ok) throw new Error(`downloading the original failed: HTTP ${res.status}`);
      await writeFile(path, Buffer.from(await res.arrayBuffer()));
    },
    strip: stripLocation,
    upload: async (path, { publicId, assetFolder, context, tags }) => {
      await cloudinary.uploader.upload(path, {
        public_id: publicId,
        ...(assetFolder ? { asset_folder: assetFolder } : {}),
        overwrite: true,
        invalidate: true,
        unique_filename: false,
        resource_type: 'image',
        type: 'upload',
        context,
        tags,
      });
    },
  };
}
```

- [ ] **Step 4: Run them and confirm they pass**

Run: `npx vitest run scripts/sync/protect.test.ts`
Expected: PASS (9 tests).

- [ ] **Step 5: Type-check and commit**

Run: `npm run check`
Expected: 0 errors.

```bash
git add scripts/sync/protect.ts scripts/sync/protect.test.ts
git commit -m "feat(sync): clean location from originals in Cloudinary, holding back what can't be cleaned"
```

---

### Task 4: Wire protection into the sync, and add `--audit-location`

**Files:**
- Modify: `scripts/sync/merge.ts` (add `knownIds`)
- Modify: `scripts/sync/merge.test.ts`
- Modify: `scripts/sync-photos.ts`
- Modify: `README.md` ("Updating photos" section)

**Interfaces:**
- Consumes:
  - `protectPhoto`, `protectAll`, `cloudinaryDeps`, `ProtectReport` (Task 3)
  - `endExiftool` (Task 2)
- Produces: `knownIds(file: PhotosFile): Set<string>`, which returns every public ID in the gallery sets and extras.

- [ ] **Step 1: Write the failing test for `knownIds`**

Append to `scripts/sync/merge.test.ts`, and add `knownIds` to the existing `import { … } from './merge'`:

```ts
describe('knownIds', () => {
  it('lists every photo already on the site, in sets and extras', () => {
    expect(knownIds(existing)).toEqual(new Set(['c2', 'c1', 'r1', 'hero']));
  });
});
```

- [ ] **Step 2: Run it and confirm it fails**

Run: `npx vitest run scripts/sync/merge.test.ts`
Expected: FAIL, "knownIds is not a function".

- [ ] **Step 3: Implement `knownIds`**

Add to `scripts/sync/merge.ts`, after `titleFromSlug`:

```ts
/** Public IDs already on the site; anything else the sync finds is new. */
export function knownIds(file: PhotosFile): Set<string> {
  return new Set([
    ...file.sets.flatMap((set) => set.photos.map((photo) => photo.id)),
    ...Object.keys(file.extras),
  ]);
}
```

Run: `npx vitest run scripts/sync/merge.test.ts`
Expected: PASS.

- [ ] **Step 4: Wire it into `scripts/sync-photos.ts`**

1. **Imports.** Replace the import block at the top with:

```ts
import { execFileSync } from 'node:child_process';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { v2 as cloudinary } from 'cloudinary';
import type { PhotosFile } from '../src/lib/schema';
import { describeError } from './sync/errors';
import {
  knownIds,
  mergePhotos,
  syncProblems,
  type RemotePhoto,
  type RemoteSet,
} from './sync/merge';
import { cloudinaryDeps, protectAll, protectPhoto, type ProtectReport } from './sync/protect';
import { endExiftool } from './sync/strip';
```

2. **Report helper.** Add these two functions above `main()`:

```ts
function printProtection(report: ProtectReport, heldMeans: string): void {
  for (const id of report.cleaned) console.log(`Removed location from ${id}`);
  if (report.held.length) {
    console.warn(`\n⚠ ${report.held.length} photo(s) ${heldMeans}:`);
    for (const { id, reason } of report.held) console.warn(`  ${id} ${reason}`);
  }
}

/** --audit-location: checks every photo already on the site, cleaning any with location. */
async function auditLocation(workDir: string): Promise<void> {
  const existing = JSON.parse(await readFile(FILE, 'utf8')) as PhotosFile;
  const ids = [...knownIds(existing)].map((id) => ({ id }));
  console.log(`Checking ${ids.length} photos for location data…`);
  const deps = cloudinaryDeps();
  const { report } = await protectAll(ids, (id) => protectPhoto(id, deps, workDir));
  printProtection(report, 'could not be cleaned. They stay on the site; replace them');
  const clean = ids.length - report.cleaned.length - report.held.length;
  console.log(
    `\nChecked ${ids.length}: ${clean} had no location, ${report.cleaned.length} cleaned, ` +
      `${report.held.length} need replacing.`,
  );
}
```

3. **The start of `main()`.** Replace everything from `const force = …` down to and including `const mode = await folderMode();` with:

```ts
  cloudinary.config({ secure: true });
  const workDir = await mkdtemp(join(tmpdir(), 'ftl-sync-'));
  try {
    if (process.argv.includes('--audit-location')) await auditLocation(workDir);
    else await syncPortfolio(workDir);
  } finally {
    await endExiftool();
    await rm(workDir, { recursive: true, force: true });
  }
}

async function syncPortfolio(workDir: string): Promise<void> {
  const force = process.argv.includes('--force');
  if (!force && hasUncommittedEdits()) {
    console.error(
      'src/content/photos.json has uncommitted changes. Commit them first so a sync can never ' +
        'lose your edits (or rerun with --force).',
    );
    process.exit(1);
  }

  const mode = await folderMode();
```

The original body of `main()` from `const { folders } = …` to the final `console.log('\nReview with: …')` now ends `syncPortfolio`.

4. **Inside `syncPortfolio`.** Change the `for (const folder of folders)` loop's two declarations from `const remoteSets` / `let remoteExtras` to `let remoteSets: RemoteSet[] = [];` and `let remoteExtras: RemotePhoto[] = [];`. Then replace:

```ts
  const existing = JSON.parse(await readFile(FILE, 'utf8')) as PhotosFile;
  const { data, report } = mergePhotos(existing, remoteSets, remoteExtras);
```

with:

```ts
  const existing = JSON.parse(await readFile(FILE, 'utf8')) as PhotosFile;

  // New photos have any location data removed from their original before they go on the site.
  const known = knownIds(existing);
  const candidates = [...remoteSets.flatMap((set) => set.photos), ...remoteExtras].filter(
    (photo) => !known.has(photo.id),
  );
  const deps = cloudinaryDeps();
  const { report: protection } = await protectAll(candidates, (id) =>
    protectPhoto(id, deps, workDir),
  );
  const held = new Set(protection.held.map((h) => h.id));
  const notHeld = (photo: RemotePhoto) => !held.has(photo.id);
  remoteSets = remoteSets.map((set) => ({ ...set, photos: set.photos.filter(notHeld) }));
  remoteExtras = remoteExtras.filter(notHeld);

  const { data, report } = mergePhotos(existing, remoteSets, remoteExtras);
```

5. **The report.** Just before `console.log('\nReview with: git diff src/content/photos.json');`, add:

```ts
  printProtection(protection, 'were held back and not added to the site');
```

6. **The header comment.** Change the file's first two lines to:

```ts
// Pulls photo metadata from Cloudinary into src/content/photos.json, removing location data from
// new photos' originals first.
// Usage: npm run sync-photos [-- --force | -- --audit-location]   (needs CLOUDINARY_URL in .env)
```

- [ ] **Step 5: Format, type-check, and run the unit tests**

Run: `npx prettier --write scripts && npm run check && npm test`
Expected: 0 type errors, all unit tests pass.

- [ ] **Step 6: Manual check against Cloudinary (read-only when nothing is new)**

Run on the branch, with `.env` present and `photos.json` committed:

```bash
npm run sync-photos
git status --short src/content/photos.json
```

Expected:
- If no photos were uploaded since the last sync: "Synced 5 sets, …" with no "Removed location" or "held back" lines, the shell prompt returns (exiftool ended), and `git status` shows no change.
- If David has uploaded new gallery photos (the new hero is in `_extras`), they're checked first. That costs one Admin call each, plus a re-upload for any with location.

If `photos.json` changes, stop and show David the diff before continuing. Don't commit sync output on this branch: content changes go on their own branch, as usual.

- [ ] **Step 7: Document it**

In `README.md`, under "## Updating photos", add after item 4:

```md
5. Location data is removed automatically. The sync downloads any new photo whose original contains
   GPS coordinates or place names, deletes just those fields with exiftool (no re-compression), and
   re-uploads it under the same name. A non-JPEG with location (e.g. an iPhone HEIC) is held back:
   re-export it as a JPEG without location and sync again.
6. `npm run sync-photos -- --audit-location` checks every photo already on the site the same way
   (one Cloudinary Admin API call per photo). It cleans what it can and lists anything to replace;
   it never removes photos from the site.
```

- [ ] **Step 8: Commit**

```bash
npx prettier --write README.md
git add scripts/sync-photos.ts scripts/sync/merge.ts scripts/sync/merge.test.ts README.md
git commit -m "feat(sync): remove location from new photos and add --audit-location"
```

---

### Task 5: Run the audit, then open PR A

**Files:** none changed. This task writes to Cloudinary only.

- [ ] **Step 1: Ask David before running the audit**

It reads every published photo, about 65 Admin API calls, and re-uploads any original with location. Wait for an explicit yes.

- [ ] **Step 2: Run it**

```bash
npm run sync-photos -- --audit-location
```

Expected: "Checking N photos for location data…", any "Removed location from …" lines, then "Checked N: … had no location, … cleaned, … need replacing." Only six photos were spot-checked before, and none had location, so "0 cleaned" is a plausible and fine result.

- [ ] **Step 3: Verify one cleaned photo, if any were cleaned**

Pick a cleaned public ID and run:

```bash
curl -s "https://res.cloudinary.com/dpham5/image/upload/<public-id>" -o /tmp/check.jpg
node -e "import('exiftool-vendored').then(async ({exiftool})=>{const t=await exiftool.read('/tmp/check.jpg');console.log(Object.keys(t).filter(k=>/^GPS|City|Location|Country|State/.test(k)));await exiftool.end()})"
```

Expected: `[]`. If any field is listed, CDN invalidation may still be in progress, so wait a few minutes and retry. If the field is still there after that, stop and investigate.

- [ ] **Step 4: Run the full checks**

```bash
npm run format:check && npm run check && npm test && npm run build && npm run budgets && npm run test:e2e
```

Expected: all green. The e2e suite is unchanged by this PR, so failures there point at the build or content, not this code.

- [ ] **Step 5: Ask David, then push and open PR A**

```bash
git push -u origin feat/location-removal
gh pr create --title "Remove location data from photo originals" --body "$(cat <<'EOF'
Implements §5 of docs/superpowers/specs/2026-10-02-photo-log-design.md.

- New photos in portfolio/ have GPS and place names removed from their Cloudinary original before they're added (exiftool, no re-compression; camera data kept).
- Non-JPEGs with location are held back with a message to re-export.
- `npm run sync-photos -- --audit-location` checks every published photo. Audit result: <fill in from Step 2>.

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

Then link the PR with `mcp__t3-code__link_pull_request`. Merge only after David approves.
