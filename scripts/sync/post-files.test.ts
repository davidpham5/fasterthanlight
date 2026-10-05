import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { afterEach, describe, expect, it } from 'vitest';
import { readPostTexts } from './post-files';

let dir: string | undefined;
afterEach(async () => {
  if (dir) await rm(dir, { recursive: true, force: true });
  dir = undefined;
});

describe('readPostTexts', () => {
  it('reads every .md file, keyed by slug', async () => {
    dir = await mkdtemp(join(tmpdir(), 'ftl-posts-'));
    await writeFile(join(dir, 'peonies.md'), 'a');
    await writeFile(join(dir, 'notes.txt'), 'b');
    const texts = await readPostTexts(pathToFileURL(`${dir}/`));
    expect([...texts]).toEqual([['peonies', 'a']]);
  });

  it('treats a missing directory as no posts yet', async () => {
    dir = await mkdtemp(join(tmpdir(), 'ftl-posts-'));
    const texts = await readPostTexts(pathToFileURL(join(dir, 'nope/')));
    expect(texts.size).toBe(0);
  });

  it('rethrows any other read error instead of pretending there are no posts', async () => {
    dir = await mkdtemp(join(tmpdir(), 'ftl-posts-'));
    await writeFile(join(dir, 'file'), 'x'); // a file where a directory should be: ENOTDIR
    await expect(readPostTexts(pathToFileURL(join(dir, 'file/')))).rejects.toMatchObject({
      code: 'ENOTDIR',
    });
  });
});
