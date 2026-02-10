import sanitizeHtml from 'sanitize-html';

/**
 * Strip ALL HTML tags — use for names, emails, phones, titles, etc.
 */
export function stripHtml(input: string): string {
  return sanitizeHtml(input, { allowedTags: [], allowedAttributes: {} }).trim();
}

/**
 * Allow safe formatting tags — use for cover letters, descriptions, notes, email bodies.
 */
export function sanitizeRichText(input: string): string {
  return sanitizeHtml(input, {
    allowedTags: ['b', 'i', 'em', 'strong', 'p', 'br', 'ul', 'ol', 'li'],
    allowedAttributes: {},
  }).trim();
}
