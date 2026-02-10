import { z } from 'zod';
import { stripHtml } from '../utils/sanitize.js';

export const loginSchema = z.object({
  email: z.string().trim().email('Invalid email address').transform(stripHtml),
  password: z.string().min(1, 'Password is required'),
});

export const registerSchema = z.object({
  email: z.string().trim().email('Invalid email address').transform(stripHtml),
  password: z.string().min(6, 'Password must be at least 6 characters'),
  name: z.string().trim().min(1, 'Name is required').max(200).transform(stripHtml),
  role: z.enum(['admin', 'hiring_manager', 'reviewer']).default('reviewer'),
});

export const passwordChangeSchema = z.object({
  currentPassword: z.string().min(1, 'Current password is required'),
  newPassword: z.string().min(6, 'New password must be at least 6 characters'),
});

export const userCreateSchema = z.object({
  email: z.string().trim().email('Invalid email address').transform(stripHtml),
  name: z.string().trim().min(1, 'Name is required').max(200).transform(stripHtml),
  password: z.string().min(6, 'Password must be at least 6 characters'),
  role: z.enum(['admin', 'hiring_manager', 'reviewer']),
});

export const userUpdateSchema = z.object({
  email: z.string().trim().email('Invalid email address').transform(stripHtml).optional(),
  name: z.string().trim().min(1).max(200).transform(stripHtml).optional(),
  password: z.string().min(6).optional(),
  role: z.enum(['admin', 'hiring_manager', 'reviewer']).optional(),
});
