import { useState, useEffect, useRef, useCallback } from 'react';
import { Html5Qrcode } from 'html5-qrcode';
import { parseVCard, extractEmailFromText, VCardData } from '../utils/vcardParser';

interface QRScannerProps {
  onScan: (data: Partial<VCardData>) => void;
}

type ScanMode = 'camera' | 'usb';

export default function QRScanner({ onScan }: QRScannerProps) {
  const [mode, setMode] = useState<ScanMode>('usb');
  const [scanning, setScanning] = useState(false);
  const [lastScan, setLastScan] = useState('');
  const [error, setError] = useState('');
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // USB/Bluetooth barcode reader mode — listens for rapid keystrokes
  const bufferRef = useRef('');
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const processScan = useCallback(
    (raw: string) => {
      const trimmed = raw.trim();
      if (!trimmed || trimmed === lastScan) return;
      setLastScan(trimmed);

      const vcard = parseVCard(trimmed);
      if (vcard) {
        onScan(vcard);
        setError('');
        return;
      }

      // Fallback: try to extract email
      const email = extractEmailFromText(trimmed);
      if (email) {
        onScan({ email });
        setError('');
        return;
      }

      setError('Could not parse QR data. Expected a vCard or email address.');
    },
    [onScan, lastScan]
  );

  // USB keyboard listener
  useEffect(() => {
    if (mode !== 'usb') return;

    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore if focus is in an input/textarea/select
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;

      if (e.key === 'Enter') {
        if (bufferRef.current.length > 5) {
          processScan(bufferRef.current);
        }
        bufferRef.current = '';
        if (timerRef.current) clearTimeout(timerRef.current);
        return;
      }

      if (e.key.length === 1) {
        bufferRef.current += e.key;
        if (timerRef.current) clearTimeout(timerRef.current);
        // Reset buffer after 100ms of inactivity (human typing is slower)
        timerRef.current = setTimeout(() => {
          bufferRef.current = '';
        }, 100);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [mode, processScan]);

  // Camera scanner
  const startCamera = async () => {
    setError('');
    try {
      const scanner = new Html5Qrcode('qr-reader');
      scannerRef.current = scanner;
      await scanner.start(
        { facingMode: 'environment' },
        { fps: 10, qrbox: { width: 250, height: 250 } },
        (decodedText) => {
          processScan(decodedText);
        },
        () => {} // ignore scan failures
      );
      setScanning(true);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Camera access denied or not available'
      );
    }
  };

  const stopCamera = async () => {
    if (scannerRef.current) {
      try {
        await scannerRef.current.stop();
      } catch {
        // ignore
      }
      scannerRef.current = null;
    }
    setScanning(false);
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (scannerRef.current) {
        scannerRef.current.stop().catch(() => {});
      }
    };
  }, []);

  const handleModeSwitch = async (newMode: ScanMode) => {
    if (scanning) await stopCamera();
    setMode(newMode);
    setError('');
    setLastScan('');
  };

  return (
    <div className="bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded p-4 mb-4">
      <div className="flex items-center justify-between mb-3">
        <p className="text-sm font-medium text-neutral-700 dark:text-neutral-300">QR / Badge Scanner</p>
        <div className="flex gap-1">
          <button
            type="button"
            onClick={() => handleModeSwitch('usb')}
            className={`px-2.5 py-1 rounded text-xs font-medium transition-colors ${
              mode === 'usb' ? 'bg-neutral-900 text-white dark:bg-white dark:text-black' : 'bg-neutral-200 text-neutral-600 hover:bg-neutral-300 dark:bg-neutral-700 dark:text-neutral-300 dark:hover:bg-neutral-600'
            }`}
          >
            USB/Bluetooth
          </button>
          <button
            type="button"
            onClick={() => handleModeSwitch('camera')}
            className={`px-2.5 py-1 rounded text-xs font-medium transition-colors ${
              mode === 'camera' ? 'bg-neutral-900 text-white dark:bg-white dark:text-black' : 'bg-neutral-200 text-neutral-600 hover:bg-neutral-300 dark:bg-neutral-700 dark:text-neutral-300 dark:hover:bg-neutral-600'
            }`}
          >
            Camera
          </button>
        </div>
      </div>

      {mode === 'usb' && (
        <p className="text-xs text-neutral-500 dark:text-neutral-400">
          Ready for USB/Bluetooth scanner input. Scan a badge QR code to auto-populate fields.
        </p>
      )}

      {mode === 'camera' && (
        <div>
          <div id="qr-reader" ref={containerRef} className="mx-auto max-w-[300px]" />
          {!scanning ? (
            <button
              type="button"
              onClick={startCamera}
              className="btn btn-secondary text-sm mt-2 w-full"
            >
              Start Camera
            </button>
          ) : (
            <button
              type="button"
              onClick={stopCamera}
              className="btn btn-secondary text-sm mt-2 w-full"
            >
              Stop Camera
            </button>
          )}
        </div>
      )}

      {error && (
        <p className="text-red-600 dark:text-red-400 text-xs mt-2">{error}</p>
      )}

      {lastScan && !error && (
        <p className="text-green-600 dark:text-green-400 text-xs mt-2">Scan data applied to form.</p>
      )}
    </div>
  );
}
