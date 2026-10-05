export interface Folder {
  name: string;
  path: string;
}
export interface FolderPage {
  folders: Folder[];
  next_cursor?: string;
}

/** Cloudinary lists at most 10 subfolders unless asked for more, so follow the cursor to the end. */
export async function listAllFolders(
  fetchPage: (cursor: string | undefined) => Promise<FolderPage>,
): Promise<Folder[]> {
  const folders: Folder[] = [];
  let cursor: string | undefined;
  do {
    const page = await fetchPage(cursor);
    folders.push(...page.folders);
    cursor = page.next_cursor;
  } while (cursor);
  return folders;
}
