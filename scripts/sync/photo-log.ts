// Photo Log sync: Cloudinary folders photo-log/<slug>/ → src/content/photo-log.json (generated)
// and src/content/photo-log/<slug>.md (David's). Post files are edited through the yaml Document
// API so his comments and order survive; a file is only rewritten when photos were added or removed.
import { Document, YAMLSeq, isMap, isSeq, parseDocument } from 'yaml';
import { formatDate } from '../../src/lib/photo-log';
import type { LogImage, PhotoLogFile, RawExif } from '../../src/lib/schema';

export const LOG_ROOT = 'photo-log';
const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const DATED = /^(\d{4}-\d{2}-\d{2})(?:-(.+))?$/;
const FRONTMATTER = /^---\r?\n([\s\S]*?)^---[ \t]*(?:\r?\n|$)/m;
const YAML_OPTIONS = { lineWidth: 0 } as const; // never fold long alt text

export interface LogFolder {
  slug: string;
  title: string;
  date?: string;
}

function isRealDate(day: string): boolean {
  const date = new Date(`${day}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().startsWith(day);
}

function sentence(words: string): string {
  const text = words.replaceAll('-', ' ');
  return text.charAt(0).toUpperCase() + text.slice(1);
}

export function parseFolderName(name: string): LogFolder | { error: string } {
  if (!SLUG.test(name)) return { error: 'name must be lowercase words joined by hyphens' };
  if (/^\d+$/.test(name)) return { error: "name can't be only digits (those are feed pages)" };
  const dated = DATED.exec(name);
  if (dated && isRealDate(dated[1])) {
    // A folder named only by its date has no words to title it with, so the date is the title.
    const title = dated[2] ? sentence(dated[2]) : formatDate(new Date(`${dated[1]}T00:00:00Z`));
    return { slug: name, title, date: dated[1] };
  }
  return { slug: name, title: sentence(name) };
}

export interface RemoteLogPhoto {
  name: string;
  publicId: string;
  width: number;
  height: number;
  placeholder?: string;
  uploadedAt: string;
  alt?: string;
  caption?: string;
  /** Only set for photos new to photo-log.json; known photos keep their stored EXIF. */
  exif?: RawExif;
}

export interface RemoteLogFolder extends LogFolder {
  photos: RemoteLogPhoto[];
}

/** "2026:09:25 19:00:00" → "2026-09-25". Cameras without a clock write zeros. */
function takenDay(takenAt?: string): string | undefined {
  const match = /^(\d{4}):(\d{2}):(\d{2})/.exec(takenAt ?? '');
  if (!match || match[1] === '0000') return undefined;
  return `${match[1]}-${match[2]}-${match[3]}`;
}

export function postDate(folder: LogFolder, photos: { exif?: RawExif }[], today: string): string {
  if (folder.date) return folder.date;
  const days = photos.map((p) => takenDay(p.exif?.takenAt)).filter((d): d is string => !!d);
  return days.sort()[0] ?? today;
}

function photoEntry(photo: RemoteLogPhoto): Record<string, string> {
  const entry: Record<string, string> = { id: photo.name, alt: photo.alt?.trim() ?? '' };
  if (photo.caption?.trim()) entry.caption = photo.caption.trim();
  return entry;
}

export function draftPost(folder: LogFolder, photos: RemoteLogPhoto[], today: string): string {
  const doc = new Document({
    title: folder.title,
    date: postDate(folder, photos, today),
    draft: true,
    photos: photos.map(photoEntry),
  });
  return `---\n${doc.toString(YAML_OPTIONS)}---\n`;
}

const itemId = (item: unknown): string | undefined =>
  isMap(item) && item.get('id') !== undefined ? String(item.get('id')) : undefined;

export function updatePost(
  text: string,
  slug: string,
  known: Set<string>,
  remote: RemoteLogPhoto[],
): { text: string; added: string[]; removed: string[] } {
  const match = FRONTMATTER.exec(text);
  if (!match || match.index !== 0) {
    throw new Error(`${slug}.md has no frontmatter (a block between --- lines) at the top`);
  }
  const doc = parseDocument(match[1]);
  if (doc.errors.length > 0) {
    throw new Error(`${slug}.md frontmatter is invalid YAML: ${doc.errors[0].message}`);
  }
  const current = doc.get('photos');
  const photos = isSeq(current) ? current : new YAMLSeq();
  if (!isSeq(current)) doc.set('photos', photos);

  const remoteNames = new Set(remote.map((p) => p.name));
  const removed: string[] = [];
  photos.items = photos.items.filter((item) => {
    const id = itemId(item);
    if (id === undefined || remoteNames.has(id)) return true;
    removed.push(id);
    return false;
  });

  // Only photos new to Cloudinary are added, so a line David deleted stays deleted.
  const listed = new Set(photos.items.map(itemId));
  const added = remote.filter((p) => !known.has(p.name) && !listed.has(p.name));
  for (const photo of added) photos.add(doc.createNode(photoEntry(photo)));

  if (added.length === 0 && removed.length === 0) return { text, added: [], removed: [] };
  const body = text.slice(match[0].length);
  return {
    text: `---\n${doc.toString(YAML_OPTIONS)}---\n${body}`,
    added: added.map((p) => p.name),
    removed,
  };
}

export interface LogSyncReport {
  created: string[];
  added: string[];
  removed: string[];
  /** Post files whose Cloudinary folder no longer exists. */
  orphaned: string[];
}

export function syncPhotoLog(
  existing: PhotoLogFile,
  folders: RemoteLogFolder[],
  postTexts: Map<string, string>,
  today: string,
): { file: PhotoLogFile; writes: Map<string, string>; report: LogSyncReport } {
  const file: PhotoLogFile = { posts: {} };
  const writes = new Map<string, string>();
  const report: LogSyncReport = { created: [], added: [], removed: [], orphaned: [] };

  for (const folder of folders) {
    const before = existing.posts[folder.slug]?.photos ?? {};
    const ordered = [...folder.photos].sort(
      (a, b) => a.uploadedAt.localeCompare(b.uploadedAt) || a.name.localeCompare(b.name),
    );
    const text = postTexts.get(folder.slug);
    if (ordered.length === 0 && text === undefined) continue;

    const photos: Record<string, LogImage> = {};
    for (const p of ordered) {
      photos[p.name] = {
        publicId: p.publicId,
        width: p.width,
        height: p.height,
        ...(p.placeholder ? { placeholder: p.placeholder } : {}),
        uploadedAt: p.uploadedAt,
        exif: p.exif ?? before[p.name]?.exif ?? {},
      };
    }
    file.posts[folder.slug] = { photos };

    if (text === undefined) {
      writes.set(folder.slug, draftPost(folder, ordered, today));
      report.created.push(folder.slug);
      continue;
    }
    const update = updatePost(text, folder.slug, new Set(Object.keys(before)), ordered);
    if (update.text !== text) writes.set(folder.slug, update.text);
    report.added.push(...update.added.map((name) => `${folder.slug}/${name}`));
    report.removed.push(...update.removed.map((name) => `${folder.slug}/${name}`));
  }

  // A missing folder never deletes a post: keep its data and say so.
  const remoteSlugs = new Set(folders.map((f) => f.slug));
  for (const slug of [...postTexts.keys()].sort()) {
    if (remoteSlugs.has(slug)) continue;
    report.orphaned.push(slug);
    const kept = existing.posts[slug];
    if (kept) file.posts[slug] = kept;
  }
  return { file, writes, report };
}
