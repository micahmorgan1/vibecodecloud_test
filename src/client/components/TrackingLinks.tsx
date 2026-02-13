import { useState, useEffect } from 'react';
import { api } from '../lib/api';

interface Platform {
  id: string;
  name: string;
  description: string;
  color: string;
  trackingUrl: string;
  externalUrl?: string;
  posted: boolean;
  postDate: string | null;
  postUrl: string | null;
}

interface TrackingLinksProps {
  jobId: string;
  onUpdate?: () => void;
}

export function TrackingLinks({ jobId, onUpdate }: TrackingLinksProps) {
  const [platforms, setPlatforms] = useState<Platform[]>([]);
  const [loading, setLoading] = useState(true);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  useEffect(() => {
    loadPlatforms();
  }, [jobId]);

  async function loadPlatforms() {
    try {
      const { data } = await api.get<{ platforms: Platform[] }>(`/jobs/${jobId}/platforms`);
      setPlatforms(data.platforms);
    } catch (error) {
      console.error('Failed to load platforms:', error);
    } finally {
      setLoading(false);
    }
  }

  function copyToClipboard(platform: Platform) {
    console.log('Copying to clipboard:', platform.trackingUrl);

    // Use the more reliable fallback method that works in all browsers
    const textArea = document.createElement('textarea');
    textArea.value = platform.trackingUrl;
    textArea.style.position = 'fixed';
    textArea.style.top = '0';
    textArea.style.left = '0';
    textArea.style.opacity = '0';
    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();

    try {
      const successful = document.execCommand('copy');
      if (successful) {
        console.log('Copy successful!');
        setCopiedId(platform.id);
        setTimeout(() => setCopiedId(null), 2000);
      } else {
        console.error('Copy command failed');
        // Try modern API as fallback
        navigator.clipboard.writeText(platform.trackingUrl).then(() => {
          setCopiedId(platform.id);
          setTimeout(() => setCopiedId(null), 2000);
        }).catch((err) => {
          console.error('Clipboard API also failed:', err);
          alert('Could not copy to clipboard. Please copy the URL manually.');
        });
      }
    } catch (err) {
      console.error('execCommand failed:', err);
      alert('Could not copy to clipboard. Please copy the URL manually.');
    } finally {
      document.body.removeChild(textArea);
    }
  }

  async function togglePosted(platform: Platform) {
    try {
      await api.patch(`/jobs/${jobId}/platform-status`, {
        platformId: platform.id,
        posted: !platform.posted,
        postUrl: platform.postUrl,
      });

      // Reload platforms to get updated status
      await loadPlatforms();

      if (onUpdate) {
        onUpdate();
      }
    } catch (error) {
      console.error('Failed to update platform status:', error);
    }
  }

  async function savePostUrl(platform: Platform, url: string) {
    try {
      await api.patch(`/jobs/${jobId}/platform-status`, {
        platformId: platform.id,
        posted: platform.posted,
        postUrl: url,
      });

      await loadPlatforms();

      if (onUpdate) {
        onUpdate();
      }
    } catch (error) {
      console.error('Failed to save post URL:', error);
    }
  }

  const getColorClasses = (color: string, posted: boolean) => {
    if (posted) {
      const colorMap: Record<string, string> = {
        blue: 'bg-blue-50 border-blue-200 dark:bg-blue-900/30 dark:border-blue-800',
        green: 'bg-green-50 border-green-200 dark:bg-green-900/30 dark:border-green-800',
        purple: 'bg-purple-50 border-purple-200 dark:bg-purple-900/30 dark:border-purple-800',
        orange: 'bg-orange-50 border-orange-200 dark:bg-orange-900/30 dark:border-orange-800',
      };
      return colorMap[color] || 'bg-neutral-50 border-neutral-200 dark:bg-neutral-800 dark:border-neutral-700';
    }
    return 'bg-white border-neutral-200 dark:bg-neutral-800 dark:border-neutral-700';
  };

  const getBadgeColorClasses = (color: string) => {
    const colorMap: Record<string, string> = {
      blue: 'bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-900 dark:text-blue-200 dark:border-blue-800',
      green: 'bg-green-100 text-green-800 border-green-200 dark:bg-green-900 dark:text-green-200 dark:border-green-800',
      purple: 'bg-purple-100 text-purple-800 border-purple-200 dark:bg-purple-900 dark:text-purple-200 dark:border-purple-800',
      orange: 'bg-orange-100 text-orange-800 border-orange-200 dark:bg-orange-900 dark:text-orange-200 dark:border-orange-800',
    };
    return colorMap[color] || 'bg-neutral-100 text-neutral-800 border-neutral-200 dark:bg-neutral-700 dark:text-neutral-200 dark:border-neutral-600';
  };

  if (loading) {
    return (
      <div className="card">
        <div className="flex items-center justify-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-black dark:border-white"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="card">
      <h2 className="text-lg font-display font-semibold text-neutral-900 dark:text-neutral-100 mb-4 uppercase tracking-wide">
        Application Tracking Links
      </h2>
      <p className="text-sm text-neutral-600 dark:text-neutral-400 mb-4">
        Copy these tracking URLs when posting this job to external platforms. Each link includes
        tracking parameters to measure application sources.
      </p>

      <div className="space-y-3">
        {platforms.map((platform) => (
          <div
            key={platform.id}
            className={`border rounded-lg p-4 transition-colors ${getColorClasses(platform.color, platform.posted)}`}
          >
            <div className="flex items-start justify-between mb-2">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <h3 className="font-semibold text-neutral-900 dark:text-neutral-100">{platform.name}</h3>
                  {platform.posted && (
                    <span className={`text-xs px-2 py-0.5 rounded border ${getBadgeColorClasses(platform.color)}`}>
                      Posted
                    </span>
                  )}
                </div>
                <p className="text-sm text-neutral-600 dark:text-neutral-400">{platform.description}</p>
              </div>
            </div>

            <div className="flex flex-wrap gap-2 mt-3">
              <button
                onClick={() => copyToClipboard(platform)}
                className="px-3 py-1.5 bg-neutral-900 text-white text-sm rounded hover:bg-neutral-700 dark:bg-white dark:text-black dark:hover:bg-neutral-200 transition-colors"
              >
                {copiedId === platform.id ? '\u2713 Copied!' : 'Copy Link'}
              </button>

              {platform.externalUrl && (
                <a
                  href={platform.externalUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-3 py-1.5 bg-blue-600 text-white text-sm rounded hover:bg-blue-700 transition-colors inline-flex items-center gap-1"
                >
                  Post Job
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                  </svg>
                </a>
              )}

              <button
                onClick={() => togglePosted(platform)}
                className={`px-3 py-1.5 text-sm rounded transition-colors ${
                  platform.posted
                    ? 'bg-white text-neutral-700 border border-neutral-300 hover:bg-neutral-50 dark:bg-neutral-800 dark:text-neutral-300 dark:border-neutral-600 dark:hover:bg-neutral-700'
                    : 'bg-green-600 text-white hover:bg-green-700'
                }`}
              >
                {platform.posted ? 'Mark as Unposted' : 'Mark as Posted'}
              </button>

              {platform.posted && (
                <button
                  onClick={() => setExpandedId(expandedId === platform.id ? null : platform.id)}
                  className="px-3 py-1.5 bg-white text-neutral-700 text-sm rounded border border-neutral-300 hover:bg-neutral-50 dark:bg-neutral-800 dark:text-neutral-300 dark:border-neutral-600 dark:hover:bg-neutral-700"
                >
                  {expandedId === platform.id ? 'Hide Details' : 'Add URL'}
                </button>
              )}
            </div>

            {/* Expanded section for post URL */}
            {expandedId === platform.id && platform.posted && (
              <div className="mt-3 pt-3 border-t border-neutral-200 dark:border-neutral-700">
                <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-2">
                  {platform.name} Post URL (optional)
                </label>
                <div className="flex gap-2">
                  <input
                    type="url"
                    defaultValue={platform.postUrl || ''}
                    placeholder={`https://${platform.name.toLowerCase()}.com/...`}
                    className="input text-sm"
                    onBlur={(e) => {
                      if (e.target.value !== platform.postUrl) {
                        savePostUrl(platform, e.target.value);
                      }
                    }}
                  />
                </div>
                {platform.postDate && (
                  <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-2">
                    Posted on {new Date(platform.postDate).toLocaleDateString()}
                  </p>
                )}
              </div>
            )}

            {/* Show tracking URL preview when not expanded */}
            {expandedId !== platform.id && (
              <div className="mt-3 pt-3 border-t border-neutral-200 dark:border-neutral-700">
                <p className="text-xs text-neutral-500 dark:text-neutral-400 font-mono break-all">
                  {platform.trackingUrl}
                </p>
              </div>
            )}
          </div>
        ))}
      </div>

      <div className="mt-4 p-3 bg-neutral-50 dark:bg-neutral-800 rounded border border-neutral-200 dark:border-neutral-700">
        <p className="text-xs text-neutral-600 dark:text-neutral-400">
          <strong>Tip:</strong> Copy the tracking link, paste it into the job posting on the external
          platform, then mark it as "Posted" here to track where applicants come from.
        </p>
      </div>
    </div>
  );
}
