import { z } from 'zod';
import { stripHtml, sanitizeRichText } from '../utils/sanitize.js';

export const offerCreateSchema = z.object({
  status: z.enum(['draft', 'extended', 'accepted', 'declined', 'rescinded']).default('draft'),
  notes: z.string().trim().max(5000).transform(sanitizeRichText).optional(),
  salary: z.string().trim().max(200).transform(stripHtml).optional(),
  offerDate: z.string().optional(),
  acceptedDate: z.string().optional(),
  declinedDate: z.string().optional(),
});

export const offerUpdateSchema = z.object({
  status: z.enum(['draft', 'extended', 'accepted', 'declined', 'rescinded']).optional(),
  notes: z.string().trim().max(5000).transform(sanitizeRichText).optional(),
  salary: z.string().trim().max(200).transform(stripHtml).optional(),
  offerDate: z.string().nullable().optional(),
  acceptedDate: z.string().nullable().optional(),
  declinedDate: z.string().nullable().optional(),
});
