import NodeClam from 'clamscan';

interface ScanResult {
  clean: boolean;
  viruses?: string[];
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let clamav: any = null;
let initAttempted = false;
let available = false;

async function initClamAV(): Promise<void> {
  if (initAttempted) return;
  initAttempted = true;

  try {
    const scanner = new NodeClam();
    clamav = await scanner.init({
      clamdscan: {
        socket: process.env.CLAMAV_SOCKET || '/var/run/clamav/clamd.ctl',
        timeout: 30000,
        localFallback: true,
      },
      preference: 'clamdscan',
    });
    available = true;
    console.log('[INFO] ClamAV: connected');
  } catch {
    available = false;
    console.warn('[WARN] ClamAV: not available, virus scanning disabled');
  }
}

// Initialize on first import (fire-and-forget)
initClamAV();

/**
 * Scan a file for viruses. Gracefully degrades if ClamAV is not available.
 */
export async function scanFile(filePath: string): Promise<ScanResult> {
  if (!available || !clamav) {
    return { clean: true };
  }

  try {
    const result = await clamav.isInfected(filePath);
    if (result.isInfected) {
      return {
        clean: false,
        viruses: result.viruses,
      };
    }
    return { clean: true };
  } catch (err) {
    console.error('ClamAV scan error:', err);
    // Fail open — don't block uploads if scan fails
    return { clean: true };
  }
}
