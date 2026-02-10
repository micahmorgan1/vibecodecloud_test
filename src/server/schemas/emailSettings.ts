import { z } from 'zod';
import { stripHtml, sanitizeRichText } from '../utils/sanitize.js';

export const templateUpdateSchema = z.object({
  subject: z.string().trim().min(1, 'Subject is required').max(500).transform(stripHtml),
  body: z.string().min(1, 'Body is required').max(20000).transform(sanitizeRichText),
});

export const reviewerAssignmentSchema = z.object({
  userIds: z.array(z.string().trim()),
});

export const subscriberSchema = z.object({
  userIds: z.array(z.string().trim()),
});

export const requestReviewSchema = z.object({
  userIds: z.array(z.string().trim()).min(1, 'At least one user must be selected'),
  message: z.string().max(2000).transform(sanitizeRichText).optional().or(z.literal('')),
});
