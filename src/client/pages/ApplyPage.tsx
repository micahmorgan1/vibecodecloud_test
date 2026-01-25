import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { api } from '../lib/api';

interface Job {
  id: string;
  title: string;
  department: string;
  location: string;
  type: string;
  description: string;
  requirements: string;
  salary: string | null;
  status: string;
}

export default function ApplyPage() {
  const { jobId } = useParams<{ jobId: string }>();
  const [job, setJob] = useState<Job | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState('');

  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    linkedIn: '',
    website: '',
    portfolioUrl: '',
    coverLetter: '',
    yearsExperience: '',
    currentCompany: '',
    currentTitle: '',
  });
  const [resume, setResume] = useState<File | null>(null);
  const [portfolio, setPortfolio] = useState<File | null>(null);

  useEffect(() => {
    if (jobId) {
      // Fetch job without auth (public endpoint would be needed, for now we'll handle error)
      fetch(`/api/jobs/${jobId}`)
        .then((res) => res.json())
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
      if (formData.yearsExperience) data.append('yearsExperience', formData.yearsExperience);
      if (formData.currentCompany) data.append('currentCompany', formData.currentCompany);
      if (formData.currentTitle) data.append('currentTitle', formData.currentTitle);
      data.append('source', 'Direct Application');

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
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  if (submitted) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="max-w-md w-full text-center">
          <div className="w-20 h-20 bg-green-100 rounded-full mx-auto mb-6 flex items-center justify-center">
            <svg className="w-10 h-10 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Application Submitted!</h1>
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
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Position Not Available</h1>
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
      <header className="bg-brand-900 text-white py-6">
        <div className="max-w-4xl mx-auto px-4">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-white rounded-lg flex items-center justify-center">
              <span className="text-brand-900 font-bold text-xl">W</span>
            </div>
            <div>
              <h1 className="text-xl font-display font-bold">WHLC Architecture</h1>
              <p className="text-sm text-brand-300">Join Our Team</p>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-8">
        {/* Job Info */}
        <div className="card mb-8">
          <div className="flex items-start justify-between mb-4">
            <div>
              <h2 className="text-2xl font-display font-bold text-gray-900">{job.title}</h2>
              <div className="flex flex-wrap gap-3 mt-2 text-sm text-gray-600">
                <span>{job.department}</span>
                <span>•</span>
                <span>{job.location}</span>
                <span>•</span>
                <span className="capitalize">{job.type}</span>
                {job.salary && (
                  <>
                    <span>•</span>
                    <span>{job.salary}</span>
                  </>
                )}
              </div>
            </div>
          </div>

          <div className="prose prose-sm max-w-none text-gray-600">
            <h3 className="text-lg font-semibold text-gray-900 mt-6 mb-2">About the Role</h3>
            <p className="whitespace-pre-wrap">{job.description}</p>

            <h3 className="text-lg font-semibold text-gray-900 mt-6 mb-2">Requirements</h3>
            <p className="whitespace-pre-wrap">{job.requirements}</p>
          </div>
        </div>

        {/* Application Form */}
        <div className="card">
          <h2 className="text-xl font-semibold text-gray-900 mb-6">Apply for this Position</h2>

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-6">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Personal Info */}
            <div>
              <h3 className="text-sm font-medium text-gray-700 mb-4">Personal Information</h3>
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

            {/* Professional Info */}
            <div>
              <h3 className="text-sm font-medium text-gray-700 mb-4">Professional Background</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="label">Current/Recent Title</label>
                  <input
                    type="text"
                    value={formData.currentTitle}
                    onChange={(e) => setFormData({ ...formData, currentTitle: e.target.value })}
                    className="input"
                    placeholder="e.g., Project Architect"
                  />
                </div>
                <div>
                  <label className="label">Current/Recent Company</label>
                  <input
                    type="text"
                    value={formData.currentCompany}
                    onChange={(e) => setFormData({ ...formData, currentCompany: e.target.value })}
                    className="input"
                  />
                </div>
                <div>
                  <label className="label">Years of Experience</label>
                  <input
                    type="number"
                    min="0"
                    value={formData.yearsExperience}
                    onChange={(e) => setFormData({ ...formData, yearsExperience: e.target.value })}
                    className="input"
                  />
                </div>
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
              <h3 className="text-sm font-medium text-gray-700 mb-4">Portfolio & Website</h3>
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
              <h3 className="text-sm font-medium text-gray-700 mb-4">Documents</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="label">Resume (PDF, DOC, DOCX)</label>
                  <input
                    type="file"
                    accept=".pdf,.doc,.docx"
                    onChange={(e) => setResume(e.target.files?.[0] || null)}
                    className="input file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-primary-50 file:text-primary-700 hover:file:bg-primary-100"
                  />
                </div>
                <div>
                  <label className="label">Portfolio (PDF, ZIP, Images)</label>
                  <input
                    type="file"
                    accept=".pdf,.zip,.jpg,.jpeg,.png"
                    onChange={(e) => setPortfolio(e.target.files?.[0] || null)}
                    className="input file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-primary-50 file:text-primary-700 hover:file:bg-primary-100"
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

            <div className="pt-4">
              <button
                type="submit"
                disabled={submitting}
                className="btn btn-primary w-full py-3 text-lg"
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
      <footer className="bg-brand-900 text-brand-400 py-6 mt-12">
        <div className="max-w-4xl mx-auto px-4 text-center text-sm">
          <p>&copy; {new Date().getFullYear()} WHLC Architecture. All rights reserved.</p>
          <p className="mt-1">Baton Rouge, LA | Fairhope, AL | Biloxi, MS</p>
        </div>
      </footer>
    </div>
  );
}
