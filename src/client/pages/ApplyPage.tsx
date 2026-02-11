import { useState, useEffect } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { api } from '../lib/api';
import { WhlcMark, WhlcWordmark } from '../components/WhlcLogo';
import { renderContent } from '../utils/formatText';

interface Job {
  id: string;
  title: string;
  department: string;
  location: string;
  type: string;
  description: string;
  responsibilities: string | null;
  requirements: string;
  benefits: string | null;
  salary: string | null;
  status: string;
}

export default function ApplyPage() {
  const { jobId } = useParams<{ jobId: string }>();
  const [searchParams] = useSearchParams();
  const [job, setJob] = useState<Job | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState('');
  const [sourceTracking, setSourceTracking] = useState({
    source: '',
    sourceDetails: '',
    referrer: '',
    utmSource: '',
    utmMedium: '',
    utmCampaign: '',
    utmContent: '',
  });

  const [aboutWhlc, setAboutWhlc] = useState('');

  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    linkedIn: '',
    website: '',
    portfolioUrl: '',
    coverLetter: '',
  });
  const [resume, setResume] = useState<File | null>(null);
  const [portfolio, setPortfolio] = useState<File | null>(null);

  const ShareButtons = ({ jobId, jobTitle }: { jobId: string; jobTitle: string }) => {
    const baseUrl = window.location.origin;
    const jobUrl = `${baseUrl}/apply/${jobId}?utm_source=linkedin&utm_medium=social&utm_campaign=job_share`;
    const encodedUrl = encodeURIComponent(jobUrl);
    const encodedTitle = encodeURIComponent(`We're hiring: ${jobTitle}`);

    return (
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
        <h3 className="font-semibold text-gray-900 mb-2">Share this job</h3>
        <div className="flex flex-wrap gap-2">
          <a
            href={`https://www.linkedin.com/sharing/share-offsite/?url=${encodedUrl}`}
            target="_blank"
            rel="noopener noreferrer"
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 text-sm font-medium transition-colors"
          >
            Share on LinkedIn
          </a>
          <a
            href={`https://twitter.com/intent/tweet?text=${encodedTitle}&url=${encodedUrl}`}
            target="_blank"
            rel="noopener noreferrer"
            className="px-4 py-2 bg-sky-500 text-white rounded hover:bg-sky-600 text-sm font-medium transition-colors"
          >
            Share on Twitter
          </a>
          <button
            onClick={() => {
              navigator.clipboard.writeText(jobUrl);
              alert('Link copied to clipboard!');
            }}
            className="px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-700 text-sm font-medium transition-colors"
          >
            Copy Link
          </button>
        </div>
      </div>
    );
  };

  useEffect(() => {
    // Capture source tracking from URL parameters
    const source = searchParams.get('source') || '';
    const utmSource = searchParams.get('utm_source') || '';
    const utmMedium = searchParams.get('utm_medium') || '';
    const utmCampaign = searchParams.get('utm_campaign') || '';
    const utmContent = searchParams.get('utm_content') || '';

    // Capture referrer
    const referrer = document.referrer || '';

    // Build source details from all query parameters
    const sourceDetails = searchParams.toString();

    setSourceTracking({
      source: source || (utmSource ? 'Social Media' : ''),
      sourceDetails,
      referrer,
      utmSource,
      utmMedium,
      utmCampaign,
      utmContent,
    });
  }, [searchParams]);

  useEffect(() => {
    fetch('/api/settings/public/about_whlc')
      .then((res) => res.ok ? res.json() : null)
      .then((data) => { if (data?.value) setAboutWhlc(data.value); })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (jobId) {
      fetch(`/api/jobs/${jobId}/public`)
        .then((res) => {
          if (!res.ok) throw new Error('Job not found');
          return res.json();
        })
        .then((data) => setJob(data))
        .catch(() => setError('Job not found'))
        .finally(() => setLoading(false));
    }
  }, [jobId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError('');

    try {
      const data = new FormData();
      data.append('jobId', jobId!);
      data.append('firstName', formData.firstName);
      data.append('lastName', formData.lastName);
      data.append('email', formData.email);
      if (formData.phone) data.append('phone', formData.phone);
      if (formData.linkedIn) data.append('linkedIn', formData.linkedIn);
      if (formData.website) data.append('website', formData.website);
      if (formData.portfolioUrl) data.append('portfolioUrl', formData.portfolioUrl);
      if (formData.coverLetter) data.append('coverLetter', formData.coverLetter);
      // Add source tracking fields
      if (sourceTracking.source) data.append('source', sourceTracking.source);
      if (sourceTracking.sourceDetails) data.append('sourceDetails', sourceTracking.sourceDetails);
      if (sourceTracking.referrer) data.append('referrer', sourceTracking.referrer);
      if (sourceTracking.utmSource) data.append('utmSource', sourceTracking.utmSource);
      if (sourceTracking.utmMedium) data.append('utmMedium', sourceTracking.utmMedium);
      if (sourceTracking.utmCampaign) data.append('utmCampaign', sourceTracking.utmCampaign);
      if (sourceTracking.utmContent) data.append('utmContent', sourceTracking.utmContent);

      // Honeypot field
      const honeypot = (document.getElementById('website2') as HTMLInputElement)?.value || '';
      if (honeypot) data.append('website2', honeypot);

      if (resume) data.append('resume', resume);
      if (portfolio) data.append('portfolio', portfolio);

      await api.upload('/applicants', data);
      setSubmitted(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to submit application');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-black"></div>
      </div>
    );
  }

  if (submitted) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="max-w-md w-full text-center">
          <div className="w-20 h-20 bg-gray-900 rounded-full mx-auto mb-6 flex items-center justify-center">
            <svg className="w-10 h-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h1 className="text-2xl font-display font-bold text-gray-900 mb-2 uppercase tracking-wide">Application Submitted</h1>
          <p className="text-gray-600 mb-6">
            Thank you for your interest in joining WHLC Architecture. We'll review your application and get back to you soon.
          </p>
          <a href="https://whlcarchitecture.com" className="btn btn-primary">
            Visit Our Website
          </a>
        </div>
      </div>
    );
  }

  if (!job || job.status !== 'open') {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="max-w-md w-full text-center">
          <h1 className="text-2xl font-display font-bold text-gray-900 mb-2 uppercase tracking-wide">Position Not Available</h1>
          <p className="text-gray-600 mb-6">
            This job posting is no longer accepting applications.
          </p>
          <a href="https://whlcarchitecture.com/careers" className="btn btn-primary">
            View Other Opportunities
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-black text-white py-6">
        <div className="max-w-4xl mx-auto px-4">
          <div className="flex items-center gap-3">
            <WhlcMark height={36} />
            <div className="flex items-center gap-2.5">
              <WhlcWordmark height={16} />
              <span className="text-[10px] uppercase tracking-[0.2em] text-gray-400 border-l border-gray-600 pl-2.5">Careers</span>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-8">
        {/* Job Info */}
        <div className="card mb-8">
          <div className="flex items-start justify-between mb-4">
            <div>
              <h2 className="text-2xl font-display font-bold text-gray-900 uppercase tracking-wide">{job.title}</h2>
              <div className="flex flex-wrap gap-3 mt-2 text-sm text-gray-500">
                <span>{job.department}</span>
                <span>|</span>
                <span>{job.location}</span>
                <span>|</span>
                <span className="capitalize">{job.type}</span>
                {job.salary && (
                  <>
                    <span>|</span>
                    <span>{job.salary}</span>
                  </>
                )}
              </div>
            </div>
          </div>

          <div className="prose prose-sm max-w-none text-gray-600">
            <h3 className="text-lg font-display font-semibold text-gray-900 mt-6 mb-2 uppercase tracking-wide">About the Role</h3>
            <div dangerouslySetInnerHTML={{ __html: renderContent(job.description) }} />

            {job.responsibilities && (
              <>
                <h3 className="text-lg font-display font-semibold text-gray-900 mt-6 mb-2 uppercase tracking-wide">Responsibilities</h3>
                <div dangerouslySetInnerHTML={{ __html: renderContent(job.responsibilities) }} />
              </>
            )}

            <h3 className="text-lg font-display font-semibold text-gray-900 mt-6 mb-2 uppercase tracking-wide">Desired Qualifications</h3>
            <div dangerouslySetInnerHTML={{ __html: renderContent(job.requirements) }} />

            {job.benefits && (
              <>
                <h3 className="text-lg font-display font-semibold text-gray-900 mt-6 mb-2 uppercase tracking-wide">Benefits</h3>
                <div dangerouslySetInnerHTML={{ __html: renderContent(job.benefits) }} />
              </>
            )}
          </div>
        </div>

        {/* About WHLC */}
        {aboutWhlc && (
          <div className="card mb-8">
            <h3 className="text-lg font-display font-semibold text-gray-900 mb-4 uppercase tracking-wide">About WHLC</h3>
            <div className="prose prose-sm max-w-none text-gray-600" dangerouslySetInnerHTML={{ __html: renderContent(aboutWhlc) }} />
          </div>
        )}

        {/* Share Buttons */}
        <ShareButtons jobId={job.id} jobTitle={job.title} />

        {/* Application Form */}
        <div className="card">
          <h2 className="text-xl font-display font-semibold text-gray-900 mb-6 uppercase tracking-wide">Apply for this Position</h2>

          {error && (
            <div className="bg-gray-100 border border-gray-300 text-gray-800 px-4 py-3 rounded mb-6">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Personal Info */}
            <div>
              <h3 className="text-sm font-medium text-gray-700 mb-4 uppercase tracking-wider">Personal Information</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="label">First Name *</label>
                  <input
                    type="text"
                    value={formData.firstName}
                    onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
                    className="input"
                    required
                  />
                </div>
                <div>
                  <label className="label">Last Name *</label>
                  <input
                    type="text"
                    value={formData.lastName}
                    onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
                    className="input"
                    required
                  />
                </div>
                <div>
                  <label className="label">Email *</label>
                  <input
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    className="input"
                    required
                  />
                </div>
                <div>
                  <label className="label">Phone</label>
                  <input
                    type="tel"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    className="input"
                  />
                </div>
              </div>
            </div>

            {/* Online Profiles */}
            <div>
              <h3 className="text-sm font-medium text-gray-700 mb-4 uppercase tracking-wider">Online Profiles</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="label">LinkedIn Profile</label>
                  <input
                    type="text"
                    value={formData.linkedIn}
                    onChange={(e) => setFormData({ ...formData, linkedIn: e.target.value })}
                    className="input"
                    placeholder="linkedin.com/in/yourprofile"
                  />
                </div>
              </div>
            </div>

            {/* Portfolio Links */}
            <div>
              <h3 className="text-sm font-medium text-gray-700 mb-4 uppercase tracking-wider">Portfolio & Website</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="label">Personal Website</label>
                  <input
                    type="text"
                    value={formData.website}
                    onChange={(e) => setFormData({ ...formData, website: e.target.value })}
                    className="input"
                    placeholder="yourwebsite.com"
                  />
                </div>
                <div>
                  <label className="label">Online Portfolio (Behance, etc.)</label>
                  <input
                    type="text"
                    value={formData.portfolioUrl}
                    onChange={(e) => setFormData({ ...formData, portfolioUrl: e.target.value })}
                    className="input"
                    placeholder="behance.net/yourportfolio"
                  />
                </div>
              </div>
            </div>

            {/* File Uploads */}
            <div>
              <h3 className="text-sm font-medium text-gray-700 mb-4 uppercase tracking-wider">Documents</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="label">Resume (PDF, DOC, DOCX)</label>
                  <input
                    type="file"
                    accept=".pdf,.doc,.docx"
                    onChange={(e) => setResume(e.target.files?.[0] || null)}
                    className="input file:mr-4 file:py-2 file:px-4 file:rounded file:border-0 file:text-sm file:font-medium file:bg-gray-100 file:text-gray-700 hover:file:bg-gray-200"
                  />
                </div>
                <div>
                  <label className="label">Portfolio (PDF, ZIP, Images)</label>
                  <input
                    type="file"
                    accept=".pdf,.zip,.jpg,.jpeg,.png"
                    onChange={(e) => setPortfolio(e.target.files?.[0] || null)}
                    className="input file:mr-4 file:py-2 file:px-4 file:rounded file:border-0 file:text-sm file:font-medium file:bg-gray-100 file:text-gray-700 hover:file:bg-gray-200"
                  />
                </div>
              </div>
            </div>

            {/* Cover Letter */}
            <div>
              <label className="label">Cover Letter</label>
              <textarea
                value={formData.coverLetter}
                onChange={(e) => setFormData({ ...formData, coverLetter: e.target.value })}
                className="input min-h-[150px]"
                placeholder="Tell us why you're interested in this position and what makes you a great fit..."
              />
            </div>

            {/* Honeypot - hidden from humans */}
            <div style={{ position: 'absolute', left: '-9999px', top: '-9999px' }} aria-hidden="true">
              <label htmlFor="website2">Website</label>
              <input
                type="text"
                id="website2"
                name="website2"
                tabIndex={-1}
                autoComplete="off"
              />
            </div>

            <div className="pt-4">
              <button
                type="submit"
                disabled={submitting}
                className="btn btn-primary w-full py-3 text-lg font-display uppercase tracking-wider"
              >
                {submitting ? (
                  <span className="flex items-center justify-center">
                    <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Submitting...
                  </span>
                ) : (
                  'Submit Application'
                )}
              </button>
            </div>
          </form>
        </div>
      </main>

      {/* Footer */}
      <footer className="bg-black text-gray-500 py-6 mt-12">
        <div className="max-w-4xl mx-auto px-4 text-center text-sm">
          <p>&copy; {new Date().getFullYear()} WHLC Architecture. All rights reserved.</p>
          <p className="mt-1">Baton Rouge, LA | Fairhope, AL | Biloxi, MS</p>
        </div>
      </footer>
    </div>
  );
}
