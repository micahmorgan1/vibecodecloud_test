import { z } from 'zod';
import { stripHtml, sanitizeRichText } from '../utils/sanitize.js';

export const eventCreateSchema = z.object({
  name: z.string().trim().min(1, 'Name is required').max(300).transform(stripHtml),
  type: z.enum(['job_fair', 'campus_visit', 'info_session']).default('job_fair'),
  location: z.string().trim().max(500).transform(stripHtml).optional().nullable().or(z.literal('')),
  date: z.string().min(1, 'Date is required'), // ISO date string, parsed in handler
  notes: z.string().max(5000).transform(sanitizeRichText).optional().nullable().or(z.literal('')),
  attendeeIds: z.array(z.string().trim()).optional(),
});

export const eventUpdateSchema = z.object({
  name: z.string().trim().min(1).max(300).transform(stripHtml).optional(),
  type: z.enum(['job_fair', 'campus_visit', 'info_session']).optional(),
  location: z.string().trim().max(500).transform(stripHtml).optional().nullable(),
  date: z.string().optional(), // ISO date string
  notes: z.string().max(5000).transform(sanitizeRichText).optional().nullable(),
});

export const fairIntakeSchema = z.object({
  firstName: z.string().trim().min(1, 'First name is required').max(200).transform(stripHtml),
  lastName: z.string().trim().min(1, 'Last name is required').max(200).transform(stripHtml),
  email: z.string().trim().email('Invalid email address').transform(stripHtml),
  phone: z.string().trim().max(50).transform(stripHtml).optional().or(z.literal('')),
  portfolioUrl: z.string().trim().max(500).transform(stripHtml).optional().or(z.literal('')),
  jobId: z.string().trim().optional().or(z.literal('')),
  rating: z.coerce.number().int().min(1, 'Rating is required (1-5)').max(5),
  recommendation: z.enum(['strong_yes', 'yes', 'maybe', 'no', 'strong_no']).optional().nullable(),
  comments: z.string().max(5000).transform(sanitizeRichText).optional().nullable().or(z.literal('')),
  source: z.string().trim().max(200).transform(stripHtml).optional().or(z.literal('')),
});

export const attendeesSchema = z.object({
  attendeeIds: z.array(z.string().trim()),
});
