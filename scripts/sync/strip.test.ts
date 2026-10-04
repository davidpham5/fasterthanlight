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
