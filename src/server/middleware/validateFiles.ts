import { Request, Response, NextFunction } from 'express';
import fs from 'fs';
import { fileTypeFromFile } from 'file-type';
import { scanFile } from '../services/virusScan.js';

// Allowed MIME types by field
const ALLOWED_RESUME_TYPES = new Set([
  'application/pdf',
  'application/x-cfb',          // DOC (OLE2 / Compound File Binary)
  'application/zip',            // DOCX (ZIP container with Office XML)
]);

const ALLOWED_PORTFOLIO_TYPES = new Set([
  'application/pdf',
  'image/jpeg',
  'image/png',
  'application/zip',
]);

/**
 * Middleware that validates uploaded files by reading magic bytes.
 * Runs AFTER multer, BEFORE the route handler.
 * Deletes rejected files from disk and returns 400.
 */
export async function validateUploadedFiles(req: Request, res: Response, next: NextFunction) {
  const files = req.files as { [fieldname: string]: Express.Multer.File[] } | undefined;
  if (!files) return next();

  const errors: string[] = [];

  for (const [fieldname, fileArray] of Object.entries(files)) {
    for (const file of fileArray) {
      const allowed = fieldname === 'resume' ? ALLOWED_RESUME_TYPES : ALLOWED_PORTFOLIO_TYPES;

      // Magic byte validation
      const detected = await fileTypeFromFile(file.path);

      if (!detected) {
        // file-type couldn't detect — reject unless it's a known text-based type
        // Plain text files (some .doc files) won't have magic bytes
        // Allow if extension is .doc (could be legacy text doc)
        const ext = file.originalname.toLowerCase();
        if (!ext.endsWith('.doc')) {
          errors.push(`${fieldname}: Unable to verify file type`);
          safeDelete(file.path);
          continue;
        }
      } else if (!allowed.has(detected.mime)) {
        errors.push(`${fieldname}: File type "${detected.mime}" is not allowed`);
        safeDelete(file.path);
        continue;
      }

      // Virus scan
      const scanResult = await scanFile(file.path);
      if (!scanResult.clean) {
        errors.push(`${fieldname}: File rejected by virus scan${scanResult.viruses ? ': ' + scanResult.viruses.join(', ') : ''}`);
        safeDelete(file.path);
        continue;
      }
    }
  }

  if (errors.length > 0) {
    return res.status(400).json({
      error: 'File validation failed',
      fields: errors,
    });
  }

  next();
}

function safeDelete(filePath: string) {
  try {
    fs.unlinkSync(filePath);
  } catch {
    // ignore cleanup errors
  }
}
