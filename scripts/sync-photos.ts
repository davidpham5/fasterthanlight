// Pulls photo metadata from Cloudinary into src/content/photos.json.
// Usage: npm run sync-photos   (needs CLOUDINARY_URL in .env — see .env.example)
import { execFileSync } from 'node:child_process';
import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { v2 as cloudinary } from 'cloudinary';
import type { PhotosFile } from '../src/lib/schema';
import { mergePhotos, syncProblems, type RemotePhoto, type RemoteSet } from './sync/merge';

const ROOT = 'portfolio';
const EXTRAS = '_extras';
const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const FILE = new URL('../src/content/photos.json', import.meta.url);

interface Resource {
  public_id: string;
  resource_type: string;
  width: number;
  height: number;
  context?: { custom?: Record<string, string> };
}
interface ResourcePage {
  resources: Resource[];
  next_cursor?: string;
}

async function placeholderFor(id: string): Promise<string> {
  // Signed, so it is delivered even with strict transformations enabled.
  const url = cloudinary.url(id, {
    sign_url: true,
    secure: true,
    transformation: [
      { width: 24, crop: 'scale' },
      { effect: 'blur:200', quality: 30, fetch_format: 'jpg' },
    ],
  });
  const res = await fetch(url);
  if (!res.ok) throw new Error(`placeholder for "${id}" failed: HTTP ${res.status}`);
  return `data:image/jpeg;base64,${Buffer.from(await res.arrayBuffer()).toString('base64')}`;
}

type FolderMode = 'dynamic' | 'fixed';

async function folderMode(): Promise<FolderMode> {
  const { settings } = await cloudinary.api.config({ settings: true });
  return settings?.folder_mode ?? 'fixed';
}

async function listPage(mode: FolderMode, folder: string, cursor?: string): Promise<ResourcePage> {
  const options = { context: true, max_results: 500, next_cursor: cursor };
  if (mode === 'dynamic') {
    // Dynamic folders (the default for accounts created since 2024).
    return (await cloudinary.api.resources_by_asset_folder(folder, options)) as ResourcePage;
  }
  // Fixed folders: folders are public_id prefixes.
  return (await cloudinary.api.resources({
    ...options,
    type: 'upload',
    prefix: `${folder}/`,
  })) as ResourcePage;
}

async function listFolder(mode: FolderMode, folder: string): Promise<RemotePhoto[]> {
  const photos: RemotePhoto[] = [];
  let cursor: string | undefined;
  do {
    const page = await listPage(mode, folder, cursor);
    for (const r of page.resources) {
      if (r.resource_type !== 'image') continue;
      const meta = r.context?.custom ?? {};
      photos.push({
        id: r.public_id,
        width: r.width,
        height: r.height,
        alt: meta.alt,
        caption: meta.caption,
        placeholder: await placeholderFor(r.public_id),
      });
    }
    cursor = page.next_cursor;
  } while (cursor);
  // Stable order for new photos: by public id (name exports 01-…, 02-… to control order).
  return photos.sort((a, b) => a.id.localeCompare(b.id));
}

function hasUncommittedEdits(): boolean {
  try {
    execFileSync('git', ['diff', '--quiet', 'HEAD', '--', fileURLToPath(FILE)]);
    return false;
  } catch {
    return true;
  }
}

async function main(): Promise<void> {
  if (!process.env.CLOUDINARY_URL) {
    console.error('CLOUDINARY_URL is not set. Copy .env.example to .env and fill it in.');
    process.exit(1);
  }
  const force = process.argv.includes('--force');
  if (!force && hasUncommittedEdits()) {
    console.error(
      'src/content/photos.json has uncommitted changes. Commit them first so a sync can never ' +
        'lose your edits (or rerun with --force).',
    );
    process.exit(1);
  }

  cloudinary.config({ secure: true });
  const mode = await folderMode();

  const { folders } = (await cloudinary.api.sub_folders(ROOT)) as {
    folders: { name: string; path: string }[];
  };
  const remoteSets: RemoteSet[] = [];
  let remoteExtras: RemotePhoto[] = [];
  for (const folder of folders) {
    if (folder.name === EXTRAS) {
      remoteExtras = await listFolder(mode, folder.path);
    } else if (SLUG.test(folder.name)) {
      remoteSets.push({ slug: folder.name, photos: await listFolder(mode, folder.path) });
    } else {
      console.warn(`Skipping folder "${folder.path}": name must be lowercase-with-hyphens.`);
    }
  }

  const existing = JSON.parse(await readFile(FILE, 'utf8')) as PhotosFile;
  const { data, report } = mergePhotos(existing, remoteSets, remoteExtras);
  const problems = syncProblems(existing, data, report);
  if (problems.length > 0 && !force) {
    console.error(`Nothing written. ${problems.join(' ')}`);
    console.error(
      'Check the folder names in Cloudinary, or rerun with --force if this is intended.',
    );
    process.exit(1);
  }
  await writeFile(FILE, `${JSON.stringify(data, null, 2)}\n`);

  const total = data.sets.reduce((sum, set) => sum + set.photos.length, 0);
  console.log(
    `Synced ${data.sets.length} sets, ${total} photos, ${Object.keys(data.extras).length} extras.`,
  );
  if (report.newSets.length) console.log(`New sets: ${report.newSets.join(', ')}`);
  if (report.added.length) console.log(`Added: ${report.added.join(', ')}`);
  if (report.removedSets.length) console.warn(`Removed sets: ${report.removedSets.join(', ')}`);
  if (report.removed.length) console.warn(`Removed photos: ${report.removed.join(', ')}`);
  console.log(
    `Extras ids (use for heroId/portraitId in site.json): ${Object.keys(data.extras).join(', ')}`,
  );
  if (report.missingAlt.length) {
    console.warn(
      `\n⚠ ${report.missingAlt.length} photo(s) have no alt text — the build will fail until you add it` +
        ` in Cloudinary (then re-sync) or directly in photos.json:\n  ${report.missingAlt.join('\n  ')}`,
    );
  }
  console.log('\nReview with: git diff src/content/photos.json');
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
