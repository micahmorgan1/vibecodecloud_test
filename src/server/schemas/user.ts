import { z } from 'zod';
import { stripHtml } from '../utils/sanitize.js';

const passwordSchema = z
  .string()
  .min(8, 'Password must be at least 8 characters')
  .regex(/[A-Z]/, 'Password must contain at least 1 uppercase letter')
  .regex(/[a-z]/, 'Password must contain at least 1 lowercase letter')
  .regex(/[0-9]/, 'Password must contain at least 1 number');

export const loginSchema = z.object({
  email: z.string().trim().email('Invalid email address').transform(stripHtml),
  password: z.string().min(1, 'Password is required'),
});

export const registerSchema = z.object({
  email: z.string().trim().email('Invalid email address').transform(stripHtml),
  password: passwordSchema,
  name: z.string().trim().min(1, 'Name is required').max(200).transform(stripHtml),
  role: z.enum(['admin', 'hiring_manager', 'reviewer']).default('reviewer'),
});

export const passwordChangeSchema = z.object({
  currentPassword: z.string().min(1, 'Current password is required'),
  newPassword: passwordSchema,
});

export const userCreateSchema = z.object({
  email: z.string().trim().email('Invalid email address').transform(stripHtml),
  name: z.string().trim().min(1, 'Name is required').max(200).transform(stripHtml),
  password: passwordSchema,
  role: z.enum(['admin', 'hiring_manager', 'reviewer']),
});

export const userUpdateSchema = z.object({
  email: z.string().trim().email('Invalid email address').transform(stripHtml).optional(),
  name: z.string().trim().min(1).max(200).transform(stripHtml).optional(),
  password: passwordSchema.optional(),
  role: z.enum(['admin', 'hiring_manager', 'reviewer']).optional(),
});
