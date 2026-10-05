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
