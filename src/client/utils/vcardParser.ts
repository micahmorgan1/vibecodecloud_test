export interface VCardData {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  portfolioUrl: string;
}

export function parseVCard(raw: string): VCardData | null {
  if (!raw.includes('BEGIN:VCARD')) return null;

  const get = (key: string): string => {
    // Handle both "KEY:" and "KEY;type=...:value" formats
    const re = new RegExp(`^${key}[;:](.*)$`, 'im');
    const m = raw.match(re);
    if (!m) return '';
    // For keys with params (e.g. TEL;type=CELL:+1...) the value is after the last ':'
    const val = m[1];
    const colonIdx = val.indexOf(':');
    // If the match already stripped the key prefix, check for param:value pattern
    return colonIdx >= 0 && !val.startsWith('http') ? val.slice(colonIdx + 1).trim() : val.trim();
  };

  // Parse N field: LastName;FirstName;Middle;Prefix;Suffix
  const nField = get('N');
  let firstName = '';
  let lastName = '';
  if (nField) {
    const parts = nField.split(';');
    lastName = parts[0] || '';
    firstName = parts[1] || '';
  }

  // Fallback to FN (full name) if N didn't yield results
  if (!firstName && !lastName) {
    const fn = get('FN');
    if (fn) {
      const parts = fn.split(/\s+/);
      firstName = parts[0] || '';
      lastName = parts.slice(1).join(' ') || '';
    }
  }

  const email = get('EMAIL');
  const phone = get('TEL');
  const portfolioUrl = get('URL');

  return { firstName, lastName, email, phone, portfolioUrl };
}

const EMAIL_RE = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/;

export function extractEmailFromText(text: string): string {
  const m = text.match(EMAIL_RE);
  return m ? m[0] : '';
}
