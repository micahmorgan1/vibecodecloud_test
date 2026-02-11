import { z } from 'zod';
import { sanitizeRichText } from '../utils/sanitize.js';

export const siteSettingUpdateSchema = z.object({
  value: z.string().max(50000).transform(sanitizeRichText),
});
