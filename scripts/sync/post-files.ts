import { readdir, readFile } from 'node:fs/promises';

/** Post slug → file text. Only a missing directory means "no posts yet"; anything else throws. */
export async function readPostTexts(dir: URL): Promise<Map<string, string>> {
  const texts = new Map<string, string>();
  let names: string[];
  try {
    names = await readdir(dir);
  } catch (error) {
    // Treating a read failure as "no posts" would make every folder a fresh draft that overwrites
    // David's files.
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return texts;
    throw error;
  }
  for (const name of names.filter((n) => n.endsWith('.md'))) {
    texts.set(name.slice(0, -3), await readFile(new URL(name, dir), 'utf8'));
  }
  return texts;
}
