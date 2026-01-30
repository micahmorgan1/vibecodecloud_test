import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { api } from '../lib/api';
import { useAuth } from '../context/AuthContext';
import { LinkedInPostModal } from '../components/LinkedInPostModal';
import { TrackingLinks } from '../components/TrackingLinks';

interface Applicant {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  stage: string;
  createdAt: string;
  reviews: Array<{
    rating: number;
    reviewer: { name: string };
  }>;
}

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
  createdAt: string;
  createdBy: { id: string; name: string; email: string };
  applicants: Applicant[];
  postedToLinkedIn: boolean;
  linkedInPostDate: string | null;
  linkedInPostUrl: string | null;
}

export default function JobDetail() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const [job, setJob] = useState<Job | null>(null);
  const [loading, setLoading] = useState(true);
  const [linkedInModalOpen, setLinkedInModalOpen] = useState(false);
  const [copiedAppLink, setCopiedAppLink] = useState(false);

  const canEdit = user?.role === 'admin' || user?.role === 'hiring_manager';

  useEffect(() => {
    loadJob();
  }, [id]);

  const loadJob = () => {
    if (id) {
      api.get<Job>(`/jobs/${id}`)
        .then((res) => setJob(res.data))
        .finally(() => setLoading(false));
    }
  };

  const updateStatus = async (status: string) => {
    if (!id) return;
    try {
      const res = await api.put<Job>(`/jobs/${id}`, { status });
      setJob(res.data);
    } catch (err) {
      console.error('Failed to update status:', err);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-black"></div>
      </div>
    );
  }

  if (!job) {
    return (
      <div className="card text-center py-12">
        <p className="text-gray-500">Job not found</p>
        <Link to="/jobs" className="btn btn-primary mt-4">
          Back to Jobs
        </Link>
      </div>
    );
  }

  const stageBadge = (stage: string) => {
    const styles: Record<string, string> = {
      new: 'badge-new',
      screening: 'badge-screening',
      interview: 'badge-interview',
      offer: 'badge-offer',
      hired: 'badge-hired',
      rejected: 'badge-rejected',
      holding: 'badge-holding',
    };
    return styles[stage] || 'badge-new';
  };

  const stageLabels: Record<string, string> = {
    new: 'New',
    screening: 'Screening',
    interview: 'Interview',
    offer: 'Offer',
    hired: 'Hired',
    rejected: 'Rejected',
    holding: 'Holding',
  };

  const getAverageRating = (reviews: Applicant['reviews']) => {
    if (reviews.length === 0) return null;
    const avg = reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length;
    return avg.toFixed(1);
  };

  // Copy application link
  const applicationUrl = `${window.location.origin}/apply/${job.id}`;

  return (
    <div className="space-y-6">
      {/* Breadcrumb */}
      <nav className="text-sm text-gray-500">
        <Link to="/jobs" className="hover:text-gray-900">Jobs</Link>
        <span className="mx-2">/</span>
        <span className="text-gray-900">{job.title}</span>
      </nav>

      {/* Header */}
      <div className="card">
        <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <h1 className="text-2xl font-display font-bold text-gray-900 uppercase tracking-wide">{job.title}</h1>
              <span className={`badge ${
                job.status === 'open' ? 'bg-black text-white' :
                job.status === 'closed' ? 'bg-gray-200 text-gray-500' :
                'bg-gray-300 text-gray-700'
              }`}>
                {job.status}
              </span>
            </div>
            <div className="flex flex-wrap gap-4 text-sm text-gray-500">
              <span className="flex items-center">
                <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                </svg>
                {job.department}
              </span>
              <span className="flex items-center">
                <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                {job.location}
              </span>
              <span className="flex items-center">
                <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                {job.type}
              </span>
              {job.salary && (
                <span className="flex items-center">
                  <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  {job.salary}
                </span>
              )}
            </div>
          </div>

          {canEdit && (
            <div className="flex flex-col gap-2">
              <button
                onClick={() => setLinkedInModalOpen(true)}
                className={`px-4 py-2 rounded text-sm font-medium transition-colors ${
                  job.postedToLinkedIn
                    ? 'bg-blue-100 text-blue-800 hover:bg-blue-200'
                    : 'bg-blue-600 text-white hover:bg-blue-700'
                }`}
              >
                {job.postedToLinkedIn ? '✓ Posted to LinkedIn' : 'Post to LinkedIn'}
              </button>
              <div className="flex gap-2">
                {job.status === 'open' && (
                  <>
                    <button
                      onClick={() => updateStatus('on-hold')}
                      className="btn btn-secondary text-sm"
                    >
                      Put On Hold
                    </button>
                    <button
                      onClick={() => updateStatus('closed')}
                      className="btn btn-danger text-sm"
                    >
                      Close Job
                    </button>
                  </>
                )}
                {job.status === 'closed' && (
                  <button
                    onClick={() => updateStatus('open')}
                    className="btn btn-primary text-sm"
                  >
                    Reopen Job
                  </button>
                )}
                {job.status === 'on-hold' && (
                  <>
                    <button
                      onClick={() => updateStatus('open')}
                      className="btn btn-primary text-sm"
                    >
                      Resume
                    </button>
                    <button
                      onClick={() => updateStatus('closed')}
                      className="btn btn-danger text-sm"
                    >
                      Close
                    </button>
                  </>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Application Link */}
        <div className="mt-6 p-4 bg-gray-50 rounded border border-gray-200">
          <p className="text-sm font-medium text-gray-700 mb-2">Application Link</p>
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={applicationUrl}
              readOnly
              className="input flex-1 text-sm bg-white"
            />
            <button
              onClick={() => {
                // Use reliable copy method
                const textArea = document.createElement('textarea');
                textArea.value = applicationUrl;
                textArea.style.position = 'fixed';
                textArea.style.top = '0';
                textArea.style.left = '0';
                textArea.style.opacity = '0';
                document.body.appendChild(textArea);
                textArea.focus();
                textArea.select();

                try {
                  document.execCommand('copy');
                  setCopiedAppLink(true);
                  setTimeout(() => setCopiedAppLink(false), 2000);
                } catch (err) {
                  console.error('Copy failed:', err);
                }

                document.body.removeChild(textArea);
              }}
              className="btn btn-secondary text-sm"
            >
              {copiedAppLink ? '✓ Copied!' : 'Copy'}
            </button>
          </div>
        </div>
      </div>

      {/* Job Details */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <div className="card">
            <h2 className="text-lg font-display font-semibold text-gray-900 mb-4 uppercase tracking-wide">Description</h2>
            <div className="prose prose-sm max-w-none text-gray-600 whitespace-pre-wrap">
              {job.description}
            </div>
          </div>

          <div className="card">
            <h2 className="text-lg font-display font-semibold text-gray-900 mb-4 uppercase tracking-wide">Requirements</h2>
            <div className="prose prose-sm max-w-none text-gray-600 whitespace-pre-wrap">
              {job.requirements}
            </div>
          </div>
        </div>

        <div className="space-y-6">
          <div className="card">
            <h2 className="text-lg font-display font-semibold text-gray-900 mb-4 uppercase tracking-wide">Details</h2>
            <dl className="space-y-3 text-sm">
              <div>
                <dt className="text-gray-500">Posted by</dt>
                <dd className="font-medium text-gray-900">{job.createdBy.name}</dd>
              </div>
              <div>
                <dt className="text-gray-500">Posted on</dt>
                <dd className="font-medium text-gray-900">
                  {new Date(job.createdAt).toLocaleDateString()}
                </dd>
              </div>
              <div>
                <dt className="text-gray-500">Total Applicants</dt>
                <dd className="font-medium text-gray-900">{job.applicants.length}</dd>
              </div>
            </dl>
          </div>
        </div>
      </div>

      {/* Tracking Links */}
      {canEdit && (
        <TrackingLinks jobId={id || ''} onUpdate={loadJob} />
      )}

      {/* Applicants */}
      <div className="card">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-display font-semibold text-gray-900 uppercase tracking-wide">
            Applicants ({job.applicants.length})
          </h2>
        </div>

        {job.applicants.length === 0 ? (
          <p className="text-gray-500 text-center py-8">No applicants yet</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-200 text-left text-sm text-gray-500">
                  <th className="pb-3 font-medium">Applicant</th>
                  <th className="pb-3 font-medium">Stage</th>
                  <th className="pb-3 font-medium">Rating</th>
                  <th className="pb-3 font-medium">Applied</th>
                  <th className="pb-3 font-medium"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {job.applicants.map((applicant) => (
                  <tr key={applicant.id} className="hover:bg-gray-50">
                    <td className="py-3">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 bg-gray-900 rounded-full flex items-center justify-center">
                          <span className="text-white text-sm font-medium">
                            {applicant.firstName[0]}{applicant.lastName[0]}
                          </span>
                        </div>
                        <div>
                          <p className="font-medium text-gray-900">
                            {applicant.firstName} {applicant.lastName}
                          </p>
                          <p className="text-sm text-gray-500">{applicant.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="py-3">
                      <span className={`badge ${stageBadge(applicant.stage)}`}>
                        {stageLabels[applicant.stage]}
                      </span>
                    </td>
                    <td className="py-3">
                      {applicant.reviews.length > 0 ? (
                        <div className="flex items-center">
                          <span className="text-gray-900 mr-1">★</span>
                          <span className="font-medium">{getAverageRating(applicant.reviews)}</span>
                          <span className="text-gray-400 text-sm ml-1">
                            ({applicant.reviews.length})
                          </span>
                        </div>
                      ) : (
                        <span className="text-gray-400 text-sm">No reviews</span>
                      )}
                    </td>
                    <td className="py-3 text-sm text-gray-500">
                      {new Date(applicant.createdAt).toLocaleDateString()}
                    </td>
                    <td className="py-3">
                      <Link
                        to={`/applicants/${applicant.id}`}
                        className="text-gray-900 hover:text-gray-600 text-sm font-medium"
                      >
                        View &rarr;
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* LinkedIn Post Modal */}
      <LinkedInPostModal
        jobId={id || ''}
        isOpen={linkedInModalOpen}
        onClose={() => setLinkedInModalOpen(false)}
        onPosted={loadJob}
      />
    </div>
  );
}
