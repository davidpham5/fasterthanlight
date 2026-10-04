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
    if (verdict.action === 'keep')
      return { status: 'clean', metadata: before.image_metadata ?? {} };
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
      return {
        status: 'held',
        reason: `still has location data after cleaning (${left.join(', ')})`,
      };
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
