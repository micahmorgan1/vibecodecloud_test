import prisma from '../db.js';

/**
 * Generate a URL-safe slug from a string.
 * Lowercases, replaces non-alphanumeric chars with hyphens,
 * deduplicates hyphens, and trims leading/trailing hyphens.
 */
export function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

/**
 * Generate a unique slug for a Job, appending -2, -3, etc. on collision.
 * If excludeId is provided, that job's slug won't be considered a collision
 * (useful for updates).
 */
export async function generateUniqueSlug(title: string, excludeId?: string): Promise<string> {
  const base = slugify(title);
  let candidate = base;
  let counter = 1;

  while (true) {
    const existing = await prisma.job.findUnique({ where: { slug: candidate } });
    if (!existing || (excludeId && existing.id === excludeId)) {
      return candidate;
    }
    counter++;
    candidate = `${base}-${counter}`;
  }
}
