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
    expect(result.status === 'held' && result.reason).toMatch(/re-export it as a JPEG/i);
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
