import { z } from 'zod';
import { sanitizeRichText } from '../utils/sanitize.js';

const ratingField = z.number().int().min(1).max(5);
const optionalRating = z.number().int().min(1).max(5).optional().nullable();

export const reviewCreateSchema = z.object({
  rating: ratingField,
  technicalSkills: optionalRating,
  designAbility: optionalRating,
  portfolioQuality: optionalRating,
  communication: optionalRating,
  cultureFit: optionalRating,
  recommendation: z.enum(['strong_yes', 'yes', 'maybe', 'no', 'strong_no']).optional().nullable(),
  comments: z.string().max(5000).transform(sanitizeRichText).optional().nullable(),
});
