import { z } from 'zod';
import { stripHtml } from '../utils/sanitize.js';

export const officeCreateSchema = z.object({
  name: z.string().trim().min(1, 'Name is required').max(200).transform(stripHtml),
  address: z.string().trim().min(1, 'Address is required').max(500).transform(stripHtml),
  city: z.string().trim().min(1, 'City is required').max(200).transform(stripHtml),
  state: z.string().trim().min(1, 'State is required').max(100).transform(stripHtml),
  zip: z.string().trim().min(1, 'ZIP is required').max(20).transform(stripHtml),
  phone: z.string().trim().min(1, 'Phone is required').max(50).transform(stripHtml),
});

export const officeUpdateSchema = z.object({
  name: z.string().trim().min(1).max(200).transform(stripHtml).optional(),
  address: z.string().trim().min(1).max(500).transform(stripHtml).optional(),
  city: z.string().trim().min(1).max(200).transform(stripHtml).optional(),
  state: z.string().trim().min(1).max(100).transform(stripHtml).optional(),
  zip: z.string().trim().min(1).max(20).transform(stripHtml).optional(),
  phone: z.string().trim().min(1).max(50).transform(stripHtml).optional(),
});
