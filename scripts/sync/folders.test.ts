import { describe, expect, it } from 'vitest';
import { listAllFolders, type FolderPage } from './folders';

const folder = (name: string) => ({ name, path: `photo-log/${name}` });

describe('listAllFolders', () => {
  it('follows next_cursor until the last page and returns every folder', async () => {
    const pages: Record<string, FolderPage> = {
      first: { folders: [folder('a'), folder('b')], next_cursor: 'second' },
      second: { folders: [folder('c')], next_cursor: 'third' },
      third: { folders: [folder('d')] },
    };
    const cursors: (string | undefined)[] = [];
    const all = await listAllFolders(async (cursor) => {
      cursors.push(cursor);
      return pages[cursor ?? 'first'];
    });
    expect(all.map((f) => f.name)).toEqual(['a', 'b', 'c', 'd']);
    expect(cursors).toEqual([undefined, 'second', 'third']);
  });

  it('makes one call when there is a single page', async () => {
    let calls = 0;
    const all = await listAllFolders(async () => {
      calls++;
      return { folders: [folder('a')] };
    });
    expect(all).toHaveLength(1);
    expect(calls).toBe(1);
  });

  it('lets errors through, so callers can treat a missing folder as empty', async () => {
    await expect(
      listAllFolders(async () => {
        throw { error: { http_code: 404 } };
      }),
    ).rejects.toEqual({ error: { http_code: 404 } });
  });
});
