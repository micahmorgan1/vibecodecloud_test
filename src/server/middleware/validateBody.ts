import { Request, Response, NextFunction } from 'express';
import { ZodSchema, ZodError } from 'zod';

/**
 * Express middleware that validates req.body against a Zod schema.
 * On success, replaces req.body with the parsed (sanitized/transformed) output.
 * On failure, returns 400 with structured field errors.
 *
 * For multipart/form-data routes (after multer), string coercion is already
 * handled by multer so no special treatment is needed.
 */
export function validateBody(schema: ZodSchema) {
  return (req: Request, res: Response, next: NextFunction) => {
    const result = schema.safeParse(req.body);

    if (!result.success) {
      const fieldErrors = formatZodErrors(result.error);
      return res.status(400).json({
        error: 'Validation failed',
        fields: fieldErrors,
      });
    }

    // Replace body with validated + sanitized output
    req.body = result.data;
    next();
  };
}

function formatZodErrors(error: ZodError): Record<string, string> {
  const fields: Record<string, string> = {};
  for (const issue of error.issues) {
    const path = issue.path.join('.');
    if (!fields[path]) {
      fields[path] = issue.message;
    }
  }
  return fields;
}
