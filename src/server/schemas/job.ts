import { z } from 'zod';
import { stripHtml, sanitizeRichText } from '../utils/sanitize.js';

export const jobCreateSchema = z.object({
  title: z.string().trim().min(1, 'Title is required').max(300).transform(stripHtml),
  department: z.string().trim().min(1, 'Department is required').max(200).transform(stripHtml),
  location: z.string().trim().max(300).transform(stripHtml).optional().or(z.literal('')),
  type: z.string().trim().min(1, 'Type is required').max(100).transform(stripHtml),
  description: z.string().min(1, 'Description is required').max(20000).transform(sanitizeRichText),
  requirements: z.string().min(1, 'Requirements are required').max(20000).transform(sanitizeRichText),
  salary: z.string().trim().max(200).transform(stripHtml).optional().nullable(),
  slug: z.string().trim().max(300).transform(stripHtml).optional(),
  publishToWebsite: z.boolean().optional(),
  officeId: z.string().trim().optional().nullable().or(z.literal('')),
});

export const jobUpdateSchema = z.object({
  title: z.string().trim().min(1).max(300).transform(stripHtml).optional(),
  department: z.string().trim().min(1).max(200).transform(stripHtml).optional(),
  location: z.string().trim().max(300).transform(stripHtml).optional(),
  type: z.string().trim().min(1).max(100).transform(stripHtml).optional(),
  description: z.string().min(1).max(20000).transform(sanitizeRichText).optional(),
  requirements: z.string().min(1).max(20000).transform(sanitizeRichText).optional(),
  salary: z.string().trim().max(200).transform(stripHtml).optional().nullable(),
  status: z.enum(['open', 'closed', 'on-hold']).optional(),
  slug: z.string().trim().max(300).transform(stripHtml).optional(),
  publishToWebsite: z.boolean().optional(),
  officeId: z.string().trim().optional().nullable().or(z.literal('')),
});

export const linkedInStatusSchema = z.object({
  posted: z.boolean(),
  postUrl: z.string().trim().max(500).transform(stripHtml).optional().nullable().or(z.literal('')),
});

export const platformStatusSchema = z.object({
  platformId: z.string().trim().min(1, 'Platform ID is required'),
  posted: z.boolean(),
  postUrl: z.string().trim().max(500).transform(stripHtml).optional().nullable().or(z.literal('')),
});
