import { useState, useEffect } from 'react';
import { api } from '../lib/api';

interface LinkedInPostModalProps {
  jobId: string;
  isOpen: boolean;
  onClose: () => void;
  onPosted?: () => void;
}

interface LinkedInPreview {
  title: string;
  body: string;
  hashtags: string[];
  applyUrl: string;
  currentlyPosted: boolean;
  postDate: string | null;
  postUrl: string | null;
}

export function LinkedInPostModal({ jobId, isOpen, onClose, onPosted }: LinkedInPostModalProps) {
  const [preview, setPreview] = useState<LinkedInPreview | null>(null);
  const [copied, setCopied] = useState(false);
  const [linkedInUrl, setLinkedInUrl] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isOpen) {
      loadPreview();
    }
  }, [isOpen, jobId]);

  async function loadPreview() {
    try {
      const { data } = await api.get<LinkedInPreview>(`/jobs/${jobId}/linkedin-preview`);
      setPreview(data);
      setLinkedInUrl(data.postUrl || '');
    } catch (error) {
      console.error('Failed to load LinkedIn preview:', error);
    }
  }

  async function copyToClipboard() {
    if (!preview) return;

    await navigator.clipboard.writeText(preview.body);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  async function markAsPosted() {
    setLoading(true);
    try {
      await api.patch(`/jobs/${jobId}/linkedin-status`, {
        posted: true,
        postUrl: linkedInUrl || undefined,
      });

      // Open LinkedIn job posting page
      window.open('https://www.linkedin.com/feed/', '_blank');

      if (onPosted) {
        onPosted();
      }

      onClose();
    } catch (error) {
      console.error('Failed to mark as posted:', error);
    } finally {
      setLoading(false);
    }
  }

  async function markAsUnposted() {
    setLoading(true);
    try {
      await api.patch(`/jobs/${jobId}/linkedin-status`, {
        posted: false,
      });

      if (onPosted) {
        onPosted();
      }

      onClose();
    } catch (error) {
      console.error('Failed to mark as unposted:', error);
    } finally {
      setLoading(false);
    }
  }

  if (!isOpen || !preview) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-start mb-4">
          <h2 className="text-2xl font-bold">Post to LinkedIn</h2>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-700 text-2xl leading-none">
            ×
          </button>
        </div>

        {preview.currentlyPosted && (
          <div className="bg-blue-50 border border-blue-200 rounded p-3 mb-4">
            <p className="text-sm text-blue-800">
              ✓ Already posted on {preview.postDate ? new Date(preview.postDate).toLocaleDateString() : 'Unknown date'}
              {preview.postUrl && (
                <>
                  {' - '}
                  <a href={preview.postUrl} target="_blank" rel="noopener noreferrer" className="underline">
                    View post
                  </a>
                </>
              )}
            </p>
          </div>
        )}

        <div className="mb-4">
          <label className="block text-sm font-medium mb-2">LinkedIn Post Preview</label>
          <div className="bg-gray-50 border rounded p-4 whitespace-pre-wrap font-mono text-sm max-h-96 overflow-y-auto">
            {preview.body}
          </div>
        </div>

        <div className="mb-4">
          <label className="block text-sm font-medium mb-2">Apply URL (included in post)</label>
          <input
            type="text"
            value={preview.applyUrl}
            readOnly
            className="w-full px-3 py-2 border rounded bg-gray-50 text-sm"
          />
        </div>

        <div className="mb-6">
          <label className="block text-sm font-medium mb-2">LinkedIn Post URL (optional)</label>
          <input
            type="url"
            value={linkedInUrl}
            onChange={(e) => setLinkedInUrl(e.target.value)}
            placeholder="Paste LinkedIn post URL after posting..."
            className="w-full px-3 py-2 border rounded"
          />
        </div>

        <div className="flex gap-3">
          <button
            onClick={copyToClipboard}
            className="flex-1 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            {copied ? '✓ Copied!' : 'Copy Post Text'}
          </button>

          <button
            onClick={markAsPosted}
            disabled={loading}
            className="flex-1 px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50"
          >
            {loading ? 'Saving...' : 'Open LinkedIn & Mark as Posted'}
          </button>

          {preview.currentlyPosted && (
            <button
              onClick={markAsUnposted}
              disabled={loading}
              className="px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-700 disabled:opacity-50"
            >
              Unmark
            </button>
          )}
        </div>

        <div className="mt-4 text-xs text-gray-500">
          <p><strong>Instructions:</strong></p>
          <ol className="list-decimal ml-5 mt-2 space-y-1">
            <li>Click "Copy Post Text" to copy the formatted post</li>
            <li>Click "Open LinkedIn & Mark as Posted" to open LinkedIn in a new tab</li>
            <li>Create a new post on LinkedIn and paste the copied text</li>
            <li>After posting, copy the LinkedIn post URL and paste it above (optional)</li>
          </ol>
        </div>
      </div>
    </div>
  );
}
