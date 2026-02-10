import { z } from 'zod';
import { stripHtml, sanitizeRichText } from '../utils/sanitize.js';

export const publicApplicantSchema = z.object({
  jobId: z.string().trim().optional(),
  firstName: z.string().trim().min(1, 'First name is required').max(200).transform(stripHtml),
  lastName: z.string().trim().min(1, 'Last name is required').max(200).transform(stripHtml),
  email: z.string().trim().email('Invalid email address').transform(stripHtml),
  phone: z.string().trim().max(50).transform(stripHtml).optional().or(z.literal('')),
  linkedIn: z.string().trim().max(500).transform(stripHtml).optional().or(z.literal('')),
  website: z.string().trim().max(500).transform(stripHtml).optional().or(z.literal('')),
  portfolioUrl: z.string().trim().max(500).transform(stripHtml).optional().or(z.literal('')),
  coverLetter: z.string().max(10000).transform(sanitizeRichText).optional().or(z.literal('')),
  source: z.string().trim().max(200).transform(stripHtml).optional().or(z.literal('')),
  sourceDetails: z.string().trim().max(500).transform(stripHtml).optional().or(z.literal('')),
  referrer: z.string().trim().max(500).transform(stripHtml).optional().or(z.literal('')),
  utmSource: z.string().trim().max(200).transform(stripHtml).optional().or(z.literal('')),
  utmMedium: z.string().trim().max(200).transform(stripHtml).optional().or(z.literal('')),
  utmCampaign: z.string().trim().max(200).transform(stripHtml).optional().or(z.literal('')),
  utmContent: z.string().trim().max(200).transform(stripHtml).optional().or(z.literal('')),
  website2: z.string().optional(), // honeypot — not sanitized, just passed through
});

export const manualApplicantSchema = z.object({
  jobId: z.string().trim().optional(),
  firstName: z.string().trim().min(1, 'First name is required').max(200).transform(stripHtml),
  lastName: z.string().trim().min(1, 'Last name is required').max(200).transform(stripHtml),
  email: z.string().trim().email('Invalid email address').transform(stripHtml),
  phone: z.string().trim().max(50).transform(stripHtml).optional().or(z.literal('')),
  linkedIn: z.string().trim().max(500).transform(stripHtml).optional().or(z.literal('')),
  website: z.string().trim().max(500).transform(stripHtml).optional().or(z.literal('')),
  portfolioUrl: z.string().trim().max(500).transform(stripHtml).optional().or(z.literal('')),
  coverLetter: z.string().max(10000).transform(sanitizeRichText).optional().or(z.literal('')),
  source: z.string().trim().max(200).transform(stripHtml).optional().or(z.literal('')),
});

export const applicantUpdateSchema = z.object({
  firstName: z.string().trim().min(1).max(200).transform(stripHtml).optional(),
  lastName: z.string().trim().min(1).max(200).transform(stripHtml).optional(),
  email: z.string().trim().email().transform(stripHtml).optional(),
  phone: z.string().trim().max(50).transform(stripHtml).optional().nullable(),
  linkedIn: z.string().trim().max(500).transform(stripHtml).optional().nullable(),
  website: z.string().trim().max(500).transform(stripHtml).optional().nullable(),
  portfolioUrl: z.string().trim().max(500).transform(stripHtml).optional().nullable(),
  coverLetter: z.string().max(10000).transform(sanitizeRichText).optional().nullable(),
});

export const stageUpdateSchema = z.object({
  stage: z.enum(['new', 'screening', 'interview', 'offer', 'hired', 'rejected', 'holding'], {
    errorMap: () => ({ message: 'Invalid stage. Valid stages: new, screening, interview, offer, hired, rejected, holding' }),
  }),
});

export const rejectionEmailSchema = z.object({
  emailBody: z.string().min(1, 'Email body is required').max(10000).transform(sanitizeRichText),
});

export const assignJobSchema = z.object({
  jobId: z.string().trim().nullable().optional(),
});

export const noteSchema = z.object({
  content: z.string().min(1, 'Note content is required').max(5000).transform(sanitizeRichText),
});
