import { Request } from 'express';

interface SpamCheckData {
  firstName: string;
  lastName: string;
  email: string;
  coverLetter?: string;
  website2?: string; // honeypot field
}

interface SpamCheckResult {
  isSpam: boolean;
  reasons: string[];
  clientIp: string;
}

const DISPOSABLE_DOMAINS = [
  'mailinator.com', 'guerrillamail.com', 'tempmail.com', 'yopmail.com',
  'throwaway.email', 'sharklasers.com', 'guerrillamailblock.com',
  'grr.la', 'guerrillamail.info', 'guerrillamail.net', 'trashmail.com',
  'trashmail.me', 'trashmail.net', 'dispostable.com', 'maildrop.cc',
  'mailnesia.com', 'guerrillamail.de', 'temp-mail.org', 'fakeinbox.com',
  'tempail.com', 'tempr.email', 'discard.email', 'mailcatch.com',
  'getairmail.com', 'mohmal.com', 'emailondeck.com', 'mytemp.email',
  'getnada.com', 'burnermail.io', 'harakirimail.com', 'tmail.ws',
];

const SPAM_PHRASES = [
  'buy now', 'click here', 'free money', 'viagra', 'casino',
  'crypto invest', 'earn money fast', 'work from home opportunity',
  'act now', 'limited time offer', 'you have been selected',
  'congratulations you won', 'make money online', 'double your income',
  'no obligation', 'risk free', 'online pharmacy', 'weight loss',
  'nigerian prince', 'wire transfer',
];

const URL_PATTERNS = ['http', '://', '.com', '.net', '.org', 'www.'];

export function getClientIp(req: Request): string {
  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string') {
    return forwarded.split(',')[0].trim();
  }
  return req.ip || 'unknown';
}

export function checkSpam(data: SpamCheckData, req: Request): SpamCheckResult {
  const reasons: string[] = [];
  const clientIp = getClientIp(req);

  // 1. Honeypot check
  if (data.website2) {
    return { isSpam: true, reasons: ['Honeypot field filled'], clientIp };
  }

  // 2. URL-in-name check
  const nameLower = `${data.firstName} ${data.lastName}`.toLowerCase();
  for (const pattern of URL_PATTERNS) {
    if (nameLower.includes(pattern)) {
      return { isSpam: true, reasons: ['URL detected in name field'], clientIp };
    }
  }

  // 3. Disposable email check
  const emailDomain = data.email.split('@')[1]?.toLowerCase();
  if (emailDomain && DISPOSABLE_DOMAINS.includes(emailDomain)) {
    return { isSpam: true, reasons: ['Disposable email domain'], clientIp };
  }

  // 4. All-caps name check
  const combinedName = `${data.firstName}${data.lastName}`;
  if (combinedName.length > 4 && combinedName === combinedName.toUpperCase() && /[A-Z]/.test(combinedName)) {
    return { isSpam: true, reasons: ['All-caps name'], clientIp };
  }

  // 5. Spam phrase check
  if (data.coverLetter) {
    const coverLower = data.coverLetter.toLowerCase();
    for (const phrase of SPAM_PHRASES) {
      if (coverLower.includes(phrase)) {
        return { isSpam: true, reasons: [`Spam phrase in cover letter: ${phrase}`], clientIp };
      }
    }
  }

  return { isSpam: false, reasons, clientIp };
}
