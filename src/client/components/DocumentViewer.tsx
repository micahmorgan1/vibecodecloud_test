import { useState, useEffect, useCallback } from 'react';
import mammoth from 'mammoth';

interface DocumentViewerProps {
  url: string;
  title: string;
  onClose: () => void;
}

function getFileExtension(url: string): string {
  const path = url.split('?')[0];
  return path.split('.').pop()?.toLowerCase() || '';
}

function isImage(ext: string): boolean {
  return ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg'].includes(ext);
}

function isPdf(ext: string): boolean {
  return ext === 'pdf';
}

function isDocx(ext: string): boolean {
  return ext === 'docx';
}

function isDoc(ext: string): boolean {
  return ext === 'doc';
}

export default function DocumentViewer({ url, title, onClose }: DocumentViewerProps) {
  const [scale, setScale] = useState(1);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [docxHtml, setDocxHtml] = useState<string>('');
  const ext = getFileExtension(url);

  // Close on Escape key
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.key === 'Escape') onClose();
  }, [onClose]);

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = '';
    };
  }, [handleKeyDown]);

  // Load file - for DOCX convert to HTML, otherwise just verify it exists
  useEffect(() => {
    if (isDocx(ext)) {
      fetch(url)
        .then((res) => {
          if (!res.ok) throw new Error('File not found');
          return res.arrayBuffer();
        })
        .then((buffer) => mammoth.convertToHtml(
          { arrayBuffer: buffer },
          {
            styleMap: [
              "p[style-name='List Paragraph'] => li:fresh",
              "p[style-name='No Spacing'] => p:fresh",
              "p[style-name='Horizontal Rule'] => hr",
            ],
          }
        ))
        .then((result) => {
          // Post-process: convert common horizontal rule patterns to <hr>
          // Word uses runs of _, -, =, *, ─, ━, or similar as visual dividers
          const processed = result.value
            .replace(/<p>\s*([_\-=*─━]{3,})\s*<\/p>/g, '<hr>')
            .replace(/<p><strong>([_\-=*─━]{3,})<\/strong><\/p>/g, '<hr>')
            .replace(/<p>\s*(<br\s*\/?>)?\s*<\/p>\s*<p>\s*([_\-=*─━]{3,})\s*<\/p>/g, '<hr>')
            // Also catch underscores/dashes inside other inline elements
            .replace(/<p>(?:<[^>]+>)*([_\-=*─━]{3,})(?:<\/[^>]+>)*<\/p>/g, '<hr>');
          setDocxHtml(processed);
          setStatus('ready');
        })
        .catch(() => setStatus('error'));
    } else {
      fetch(url, { method: 'HEAD' })
        .then((res) => setStatus(res.ok ? 'ready' : 'error'))
        .catch(() => setStatus('error'));
    }
  }, [url, ext]);

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) onClose();
  };

  const canZoom = isImage(ext) || isDocx(ext);

  return (
    <div
      className="fixed inset-0 bg-black bg-opacity-80 flex flex-col z-50"
      onClick={handleBackdropClick}
    >
      {/* Toolbar */}
      <div className="flex items-center justify-between px-4 py-3 bg-black border-b border-neutral-800 shrink-0">
        <div className="flex items-center gap-3">
          <svg className="w-5 h-5 text-neutral-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          <h2 className="text-white font-display text-sm uppercase tracking-wider">{title}</h2>
          <span className="text-neutral-500 text-xs uppercase">{ext}</span>
        </div>

        <div className="flex items-center gap-2">
          {/* Zoom controls */}
          {canZoom && status === 'ready' && (
            <div className="flex items-center gap-1 mr-4">
              <button
                onClick={() => setScale((s) => Math.max(0.25, s - 0.25))}
                className="px-2 py-1 text-neutral-300 hover:text-white hover:bg-neutral-800 rounded text-sm"
              >
                −
              </button>
              <span className="text-neutral-400 text-sm w-16 text-center">{Math.round(scale * 100)}%</span>
              <button
                onClick={() => setScale((s) => Math.min(3, s + 0.25))}
                className="px-2 py-1 text-neutral-300 hover:text-white hover:bg-neutral-800 rounded text-sm"
              >
                +
              </button>
              <button
                onClick={() => setScale(1)}
                className="px-2 py-1 text-neutral-300 hover:text-white hover:bg-neutral-800 rounded text-xs ml-1"
              >
                Reset
              </button>
            </div>
          )}

          {/* Download */}
          <a
            href={url}
            download
            className="flex items-center gap-1.5 px-3 py-1.5 text-neutral-300 hover:text-white hover:bg-neutral-800 rounded text-sm transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            Download
          </a>

          {/* Open in new tab */}
          <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 px-3 py-1.5 text-neutral-300 hover:text-white hover:bg-neutral-800 rounded text-sm transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
            </svg>
            Open
          </a>

          {/* Close */}
          <button
            onClick={onClose}
            className="ml-2 p-2 text-neutral-400 hover:text-white hover:bg-neutral-800 rounded transition-colors"
            title="Close (Esc)"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>

      {/* Content area */}
      <div className="flex-1 overflow-auto flex items-start justify-center p-4">
        {status === 'loading' ? (
          <div className="flex flex-col items-center justify-center h-full">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white mb-4"></div>
            <p className="text-neutral-400 text-sm">
              {isDocx(ext) ? 'Converting document...' : 'Loading document...'}
            </p>
          </div>
        ) : status === 'error' ? (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <svg className="w-16 h-16 text-neutral-600 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4.5c-.77-.833-2.694-.833-3.464 0L3.34 16.5c-.77.833.192 2.5 1.732 2.5z" />
            </svg>
            <p className="text-neutral-400 text-lg font-display uppercase tracking-wide mb-2">Unable to load document</p>
            <p className="text-neutral-500 text-sm mb-4">The file could not be found or is unavailable.</p>
            <a href={url} download className="btn btn-primary">
              Try Download
            </a>
          </div>
        ) : isPdf(ext) ? (
          <object
            data={url}
            type="application/pdf"
            className="w-full rounded bg-white"
            style={{ height: 'calc(100vh - 72px)' }}
          >
            <div className="flex flex-col items-center justify-center h-64 text-center">
              <p className="text-neutral-400 text-lg font-display uppercase tracking-wide mb-2">
                PDF preview not supported
              </p>
              <p className="text-neutral-500 text-sm mb-4">
                Your browser cannot display this PDF inline.
              </p>
              <div className="flex gap-3">
                <a href={url} target="_blank" rel="noopener noreferrer" className="btn btn-primary">
                  Open in New Tab
                </a>
                <a href={url} download className="btn btn-secondary">
                  Download
                </a>
              </div>
            </div>
          </object>
        ) : isDocx(ext) ? (
          <div
            className="bg-white rounded shadow-lg w-full max-w-4xl mx-auto"
            style={{ transform: `scale(${scale})`, transformOrigin: 'top center' }}
          >
            <div
              className="p-8 md:p-12 docx-content"
              dangerouslySetInnerHTML={{ __html: docxHtml }}
            />
          </div>
        ) : isDoc(ext) ? (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <svg className="w-16 h-16 text-neutral-600 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            <p className="text-neutral-400 text-lg font-display uppercase tracking-wide mb-2">Legacy .doc format</p>
            <p className="text-neutral-500 text-sm mb-4">
              .doc files cannot be previewed in the browser. Only .docx is supported for inline viewing.
            </p>
            <div className="flex gap-3">
              <a href={url} download className="btn btn-primary">
                Download
              </a>
            </div>
          </div>
        ) : isImage(ext) ? (
          <div className="flex items-center justify-center w-full h-full overflow-auto">
            <img
              src={url}
              alt={title}
              className="max-w-none transition-transform"
              style={{ transform: `scale(${scale})`, transformOrigin: 'center center' }}
              onError={() => setStatus('error')}
            />
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <svg className="w-16 h-16 text-neutral-600 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            <p className="text-neutral-400 text-lg font-display uppercase tracking-wide mb-2">No preview available</p>
            <p className="text-neutral-500 text-sm mb-4">
              .{ext} files cannot be previewed in the browser.
            </p>
            <div className="flex gap-3">
              <a href={url} target="_blank" rel="noopener noreferrer" className="btn btn-primary">
                Open in New Tab
              </a>
              <a href={url} download className="btn btn-secondary">
                Download
              </a>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
