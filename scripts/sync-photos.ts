// Pulls photo metadata from Cloudinary into src/content/photos.json, removing location data from
// new photos' originals first.
// Usage: npm run sync-photos [-- --force | -- --audit-location]   (needs CLOUDINARY_URL in .env)
import { execFileSync } from 'node:child_process';
import { mkdir, mkdtemp, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { v2 as cloudinary } from 'cloudinary';
import { parseLogFile, type PhotoLogFile, type PhotosFile } from '../src/lib/schema';
import { describeError, isNotFound } from './sync/errors';
import { pickExif } from './sync/exif';
import { listAllFolders, type Folder, type FolderPage } from './sync/folders';
import {
  knownIds,
  mergePhotos,
  syncProblems,
  type RemotePhoto,
  type RemoteSet,
} from './sync/merge';
import { LOG_ROOT, parseFolderName, syncPhotoLog, type RemoteLogFolder } from './sync/photo-log';
import { cloudinaryDeps, protectAll, protectPhoto, type ProtectReport } from './sync/protect';
import { endExiftool } from './sync/strip';

const ROOT = 'portfolio';
const EXTRAS = '_extras';
const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const FILE = new URL('../src/content/photos.json', import.meta.url);
const LOG_FILE = new URL('../src/content/photo-log.json', import.meta.url);
const LOG_DIR = new URL('../src/content/photo-log/', import.meta.url);

interface Resource {
  public_id: string;
  resource_type: string;
  width: number;
  height: number;
  created_at: string;
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
        uploadedAt: r.created_at,
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

function listSubFolders(path: string): Promise<Folder[]> {
  return listAllFolders(
    async (cursor) =>
      (await cloudinary.api.sub_folders(path, {
        max_results: 500,
        next_cursor: cursor,
      })) as FolderPage,
  );
}

const GUARDED = ['src/content/photos.json', 'src/content/photo-log.json', 'src/content/photo-log'];

/** Includes untracked files, so a brand-new draft David is editing is protected too. */
function hasUncommittedEdits(): boolean {
  const status = execFileSync('git', ['status', '--porcelain', '--', ...GUARDED], {
    cwd: fileURLToPath(new URL('..', import.meta.url)),
    encoding: 'utf8',
  });
  return status.trim() !== '';
}

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
  const log = await readLogFile();
  const logIds = Object.values(log.posts).flatMap((post) =>
    Object.values(post.photos).map((image) => image.publicId),
  );
  const ids = [...knownIds(existing), ...logIds].map((id) => ({ id }));
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

async function readLogFile(): Promise<PhotoLogFile> {
  try {
    return parseLogFile(JSON.parse(await readFile(LOG_FILE, 'utf8')));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return { posts: {} };
    throw error;
  }
}

async function readPostTexts(): Promise<Map<string, string>> {
  const texts = new Map<string, string>();
  let names: string[] = [];
  try {
    names = await readdir(LOG_DIR);
  } catch {
    return texts;
  }
  for (const name of names.filter((n) => n.endsWith('.md'))) {
    texts.set(name.slice(0, -3), await readFile(new URL(name, LOG_DIR), 'utf8'));
  }
  return texts;
}

/** Local calendar day, YYYY-MM-DD. */
const today = () => new Date().toLocaleDateString('en-CA');

async function syncLog(mode: FolderMode, workDir: string): Promise<void> {
  let folders: Folder[] = [];
  try {
    folders = await listSubFolders(LOG_ROOT);
  } catch (error) {
    if (!isNotFound(error)) throw error; // no photo-log/ folder yet: no posts
  }

  const existing = await readLogFile();
  const deps = cloudinaryDeps();
  const remote: RemoteLogFolder[] = [];
  const protection: ProtectReport = { cleaned: [], held: [] };
  for (const folder of folders) {
    const parsed = parseFolderName(folder.name);
    if ('error' in parsed) {
      console.warn(`Skipping folder "${folder.path}": ${parsed.error}.`);
      continue;
    }
    const before = existing.posts[parsed.slug]?.photos ?? {};
    const listed = (await listFolder(mode, folder.path)).map((p) => ({
      name: p.id.split('/').pop()!,
      publicId: p.id,
      width: p.width,
      height: p.height,
      placeholder: p.placeholder,
      uploadedAt: p.uploadedAt ?? '',
      alt: p.alt,
      caption: p.caption,
    }));
    // New photos get the location check (which also fetches their camera data, once).
    const fresh = listed.filter((p) => !(p.name in before)).map((p) => ({ id: p.publicId }));
    const { metadata, report } = await protectAll(fresh, (id) => protectPhoto(id, deps, workDir));
    protection.cleaned.push(...report.cleaned);
    protection.held.push(...report.held);
    const held = new Set(report.held.map((h) => h.id));
    remote.push({
      ...parsed,
      photos: listed
        .filter((p) => !held.has(p.publicId))
        .map((p) => {
          const meta = metadata.get(p.publicId);
          return meta ? { ...p, exif: pickExif(meta) } : p;
        }),
    });
  }

  const { file, writes, report } = syncPhotoLog(existing, remote, await readPostTexts(), today());
  await mkdir(LOG_DIR, { recursive: true });
  await writeFile(LOG_FILE, `${JSON.stringify(file, null, 2)}\n`);
  for (const [slug, text] of writes) await writeFile(new URL(`${slug}.md`, LOG_DIR), text);

  console.log(`\nPhoto Log: ${Object.keys(file.posts).length} post folder(s).`);
  if (report.created.length) {
    console.log(
      `New draft posts: ${report.created.map((s) => `src/content/photo-log/${s}.md`).join(', ')}`,
    );
  }
  if (report.added.length) console.log(`Added to posts: ${report.added.join(', ')}`);
  if (report.removed.length) console.warn(`Removed from posts: ${report.removed.join(', ')}`);
  for (const slug of report.orphaned) {
    console.warn(
      `⚠ Cloudinary folder ${LOG_ROOT}/${slug}/ is gone, but src/content/photo-log/${slug}.md ` +
        'is kept. Delete the post file (and sync again) if that is intended.',
    );
  }
  printProtection(protection, 'were held back and not added to the Photo Log');
  console.log('Review with: git status src/content && git diff src/content');
}

async function main(): Promise<void> {
  if (!process.env.CLOUDINARY_URL) {
    console.error('CLOUDINARY_URL is not set. Copy .env.example to .env and fill it in.');
    process.exit(1);
  }
  const force = process.argv.includes('--force');
  const audit = process.argv.includes('--audit-location');
  if (!audit && !force && hasUncommittedEdits()) {
    console.error(
      'Photo files have uncommitted changes (photos.json, photo-log.json or photo-log/*.md). ' +
        'Commit them first so a sync can never lose your edits (or rerun with --force).',
    );
    process.exitCode = 1;
    return;
  }
  cloudinary.config({ secure: true });
  const workDir = await mkdtemp(join(tmpdir(), 'ftl-sync-'));
  try {
    if (audit) await auditLocation(workDir);
    else {
      await syncPortfolio(workDir, force);
      await syncLog(await folderMode(), workDir);
    }
  } finally {
    await endExiftool();
    await rm(workDir, { recursive: true, force: true });
  }
}

async function syncPortfolio(workDir: string, force: boolean): Promise<void> {
  const mode = await folderMode();

  const folders = await listSubFolders(ROOT);
  let remoteSets: RemoteSet[] = [];
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

  // Printed before the refusal check below: Cloudinary has already been changed by this point.
  printProtection(protection, 'were held back and not added to the site');

  const { data, report } = mergePhotos(existing, remoteSets, remoteExtras);
  const problems = syncProblems(existing, data, report);
  if (problems.length > 0 && !force) {
    console.error(`Nothing written. ${problems.join(' ')}`);
    console.error(
      'Check the folder names in Cloudinary, or rerun with --force if this is intended.',
    );
    process.exitCode = 1;
    return;
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
  // Never print the raw error: Cloudinary errors carry the API key and secret.
  console.error(describeError(error));
  process.exit(1);
});
