import { unlink } from 'fs/promises';
import path from 'path';

/**
 * Delete uploaded files for an applicant.
 * Resolves /uploads/... paths relative to the project root and unlinks them.
 * Silently ignores missing files.
 */
export async function deleteUploadedFiles(filePaths: (string | null | undefined)[]): Promise<void> {
  const projectRoot = path.resolve(import.meta.dirname, '..', '..', '..');
  for (const filePath of filePaths) {
    if (!filePath) continue;
    try {
      const fullPath = path.join(projectRoot, filePath);
      await unlink(fullPath);
    } catch {
      // File may already be deleted or not exist
    }
  }
}
