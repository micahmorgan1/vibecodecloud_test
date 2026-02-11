import NodeClam from 'clamscan';
import logger from '../lib/logger.js';

type InitializedScanner = Awaited<ReturnType<NodeClam['init']>>;

interface ScanResult {
  clean: boolean;
  viruses?: string[];
}

let clamav: InitializedScanner | null = null;
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
    logger.info('ClamAV: connected');
  } catch {
    available = false;
    logger.warn('ClamAV: not available, virus scanning disabled');
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
    logger.error({ err }, 'ClamAV scan error');
    // Fail open — don't block uploads if scan fails
    return { clean: true };
  }
}
