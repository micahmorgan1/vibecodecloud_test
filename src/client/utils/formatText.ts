/**
 * Check if a string contains HTML tags (already formatted content).
 */
export function isHtml(text: string): boolean {
  return /<(?:p|ul|ol|li|br|strong|em|b|i)\b/i.test(text);
}

/**
 * Convert plain text with `- ` prefixed lines into HTML bullet lists.
 * Non-bullet lines become paragraphs.
 */
export function formatTextToHtml(text: string): string {
  if (!text) return '';

  const lines = text.split('\n');
  const parts: string[] = [];
  let inList = false;

  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.startsWith('- ')) {
      if (!inList) {
        inList = true;
        parts.push('<ul>');
      }
      parts.push(`<li>${trimmed.slice(2)}</li>`);
    } else {
      if (inList) {
        inList = false;
        parts.push('</ul>');
      }
      if (trimmed) {
        parts.push(`<p>${trimmed}</p>`);
      }
    }
  }

  if (inList) {
    parts.push('</ul>');
  }

  return parts.join('');
}

/**
 * Render content: if already HTML pass through, otherwise convert plain text.
 */
export function renderContent(text: string | null | undefined): string {
  if (!text) return '';
  if (isHtml(text)) return text;
  return formatTextToHtml(text);
}
