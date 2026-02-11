import prisma from '../db.js';
import logger from '../lib/logger.js';

const SAFE_BROWSING_KEY = process.env.GOOGLE_SAFE_BROWSING_KEY;
const SAFE_BROWSING_URL = 'https://safebrowsing.googleapis.com/v4/threatMatches:find';

interface ThreatMatch {
  url: string;
  threatType: string;
}

interface CheckResult {
  safe: boolean;
  threats: ThreatMatch[];
}

/**
 * Check URLs against Google Safe Browsing API.
 * Fail-open: if no API key or API error, returns safe.
 */
export async function checkUrls(urls: string[]): Promise<CheckResult> {
  if (!SAFE_BROWSING_KEY || urls.length === 0) {
    return { safe: true, threats: [] };
  }

  try {
    const body = {
      client: {
        clientId: 'whlc-ats',
        clientVersion: '1.0.0',
      },
      threatInfo: {
        threatTypes: ['MALWARE', 'SOCIAL_ENGINEERING', 'UNWANTED_SOFTWARE', 'POTENTIALLY_HARMFUL_APPLICATION'],
        platformTypes: ['ANY_PLATFORM'],
        threatEntryTypes: ['URL'],
        threatEntries: urls.map(url => ({ url })),
      },
    };

    const response = await fetch(`${SAFE_BROWSING_URL}?key=${SAFE_BROWSING_KEY}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(10000),
    });

    if (!response.ok) {
      logger.warn(`Safe Browsing API returned ${response.status}`);
      return { safe: true, threats: [] };
    }

    const data = await response.json() as { matches?: Array<{ threat: { url: string }; threatType: string }> };

    if (!data.matches || data.matches.length === 0) {
      return { safe: true, threats: [] };
    }

    const threats: ThreatMatch[] = data.matches.map(m => ({
      url: m.threat.url,
      threatType: m.threatType,
    }));

    return { safe: false, threats };
  } catch (err) {
    logger.warn({ err }, 'Safe Browsing API error, skipping check');
    return { safe: true, threats: [] };
  }
}

/**
 * Fire-and-forget wrapper: check URLs for an applicant and update the record.
 * Creates a note if flagged.
 */
export function checkApplicantUrls(applicantId: string, urls: string[]): void {
  if (!SAFE_BROWSING_KEY || urls.length === 0) return;

  (async () => {
    try {
      const result = await checkUrls(urls);
      const now = new Date();

      if (!result.safe) {
        const flagSummary = result.threats.map(t => `${t.url} (${t.threatType})`).join('; ');

        await prisma.applicant.update({
          where: { id: applicantId },
          data: {
            urlSafe: false,
            urlFlags: flagSummary,
            urlCheckedAt: now,
          },
        });

        await prisma.note.create({
          data: {
            applicantId,
            content: `[AUTO] URL safety check flagged: ${flagSummary}`,
          },
        });
      } else {
        await prisma.applicant.update({
          where: { id: applicantId },
          data: {
            urlSafe: true,
            urlFlags: null,
            urlCheckedAt: now,
          },
        });
      }
    } catch (err) {
      logger.error({ err, applicantId }, 'URL safety check failed');
    }
  })();
}
