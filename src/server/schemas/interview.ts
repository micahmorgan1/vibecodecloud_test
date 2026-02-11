import { z } from 'zod';
import { stripHtml, sanitizeRichText } from '../utils/sanitize.js';

export const interviewCreateSchema = z.object({
  applicantId: z.string().trim().min(1, 'Applicant is required'),
  scheduledAt: z.string().min(1, 'Scheduled date/time is required'), // ISO string
  location: z.string().trim().max(500).transform(stripHtml).optional().nullable().or(z.literal('')),
  type: z.enum(['in_person', 'video', 'phone']).default('in_person'),
  notes: z.string().max(5000).transform(sanitizeRichText).optional().nullable().or(z.literal('')),
  participantIds: z.array(z.string().trim()).min(1, 'At least one participant is required'),
});

export const interviewUpdateSchema = z.object({
  scheduledAt: z.string().optional(),
  location: z.string().trim().max(500).transform(stripHtml).optional().nullable().or(z.literal('')),
  type: z.enum(['in_person', 'video', 'phone']).optional(),
  notes: z.string().max(5000).transform(sanitizeRichText).optional().nullable(),
  status: z.enum(['scheduled', 'completed', 'cancelled', 'no_show']).optional(),
  feedback: z.string().max(5000).transform(sanitizeRichText).optional().nullable(),
  outcome: z.enum(['advance', 'hold', 'reject']).optional().nullable(),
  participantIds: z.array(z.string().trim()).min(1).optional(),
});

export const interviewFeedbackSchema = z.object({
  feedback: z.string().max(5000).transform(sanitizeRichText).optional().nullable().or(z.literal('')),
  rating: z.coerce.number().int().min(1).max(5).optional().nullable(),
});
