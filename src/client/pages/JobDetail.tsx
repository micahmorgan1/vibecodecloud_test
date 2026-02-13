import { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { api } from '../lib/api';
import { useAuth } from '../context/AuthContext';
import { LinkedInPostModal } from '../components/LinkedInPostModal';
import { TrackingLinks } from '../components/TrackingLinks';
import RichTextEditor from '../components/RichTextEditor';
import { renderContent } from '../utils/formatText';
import Avatar from '../components/Avatar';

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

interface Office {
  id: string;
  name: string;
  city: string;
  state: string;
  phone: string;
}

interface Job {
  id: string;
  title: string;
  slug: string;
  department: string;
  location: string;
  type: string;
  description: string;
  responsibilities: string | null;
  requirements: string;
  benefits: string | null;
  salary: string | null;
  status: string;
  publishToWebsite: boolean;
  archived: boolean;
  archivedAt: string | null;
  createdAt: string;
  createdBy: { id: string; name: string; email: string };
  applicants: Applicant[];
  postedToLinkedIn: boolean;
  linkedInPostDate: string | null;
  linkedInPostUrl: string | null;
  officeId: string | null;
  office: Office | null;
}

export default function JobDetail() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [job, setJob] = useState<Job | null>(null);
  const [loading, setLoading] = useState(true);
  const [linkedInModalOpen, setLinkedInModalOpen] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [copiedAppLink, setCopiedAppLink] = useState(false);
  const [offices, setOffices] = useState<Office[]>([]);

  const canEdit = user?.role === 'admin' || user?.role === 'hiring_manager';
  const isAdmin = user?.role === 'admin';

  useEffect(() => {
    loadJob();
    api.get<Office[]>('/offices').then((res) => setOffices(res.data));
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
      await api.put(`/jobs/${id}`, { status });
      loadJob();
    } catch (err) {
      console.error('Failed to update status:', err);
    }
  };

  const archiveJob = async () => {
    if (!id) return;
    if (!confirm('Are you sure you want to archive this job? It will be hidden from the jobs list but all data will be preserved.')) return;
    try {
      await api.delete(`/jobs/${id}`);
      navigate('/jobs');
    } catch (err) {
      console.error('Failed to archive job:', err);
    }
  };

  const unarchiveJob = async () => {
    if (!id) return;
    try {
      await api.patch(`/jobs/${id}/unarchive`, {});
      loadJob();
    } catch (err) {
      console.error('Failed to unarchive job:', err);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-black dark:border-white"></div>
      </div>
    );
  }

  if (!job) {
    return (
      <div className="card text-center py-12">
        <p className="text-neutral-500 dark:text-neutral-400">Job not found</p>
        <Link to="/jobs" className="btn btn-primary mt-4">
          Back to Jobs
        </Link>
      </div>
    );
  }

  const stageBadge = (stage: string) => {
    const styles: Record<string, string> = {
      fair_intake: 'badge-fair_intake',
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
    fair_intake: 'Fair Intake',
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
      <nav className="text-sm text-neutral-500 dark:text-neutral-400">
        <Link to="/jobs" className="hover:text-neutral-900 dark:hover:text-neutral-100">Jobs</Link>
        <span className="mx-2">/</span>
        <span className="text-neutral-900 dark:text-neutral-100">{job.title}</span>
      </nav>

      {/* Archived Banner */}
      {job.archived && (
        <div className="bg-neutral-200 border border-neutral-300 dark:bg-neutral-700 dark:border-neutral-600 rounded p-4 flex items-center justify-between">
          <div>
            <p className="font-display font-semibold text-neutral-700 dark:text-neutral-300 uppercase tracking-wide">This job is archived</p>
            <p className="text-sm text-neutral-500 dark:text-neutral-400">
              Archived on {job.archivedAt ? new Date(job.archivedAt).toLocaleDateString() : 'unknown date'}.
              All applicant data has been preserved.
            </p>
          </div>
          {isAdmin && (
            <button onClick={unarchiveJob} className="btn btn-primary">
              Unarchive
            </button>
          )}
        </div>
      )}

      {/* Header */}
      <div className="card">
        <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <h1 className="text-2xl font-display font-bold text-neutral-900 dark:text-neutral-100 uppercase tracking-wide">{job.title}</h1>
              <span className={`badge ${
                job.status === 'open' ? 'bg-black text-white dark:bg-white dark:text-black' :
                job.status === 'closed' ? 'bg-neutral-200 text-neutral-500 dark:bg-neutral-600 dark:text-neutral-300' :
                'bg-neutral-300 text-neutral-700 dark:bg-neutral-600 dark:text-neutral-300'
              }`}>
                {job.status}
              </span>
            </div>
            <div className="flex flex-wrap gap-4 text-sm text-neutral-500 dark:text-neutral-400">
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
                {job.office ? `${job.office.name} — ${job.office.city}, ${job.office.state}` : job.location}
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
              <div className="flex gap-2">
                <button
                  onClick={() => setShowEditModal(true)}
                  className="btn btn-secondary text-sm"
                >
                  Edit Job
                </button>
                <button
                  onClick={() => setLinkedInModalOpen(true)}
                  className={`px-4 py-2 rounded text-sm font-medium transition-colors ${
                    job.postedToLinkedIn
                      ? 'bg-blue-100 text-blue-800 hover:bg-blue-200 dark:bg-blue-900 dark:text-blue-200 dark:hover:bg-blue-800'
                      : 'bg-blue-600 text-white hover:bg-blue-700'
                  }`}
                >
                  {job.postedToLinkedIn ? '✓ Posted to LinkedIn' : 'Post to LinkedIn'}
                </button>
              </div>
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
              {isAdmin && !job.archived && (
                <button
                  onClick={archiveJob}
                  className="text-sm text-neutral-500 hover:text-neutral-700 dark:text-neutral-400 dark:hover:text-neutral-300 underline"
                >
                  Archive Job
                </button>
              )}
            </div>
          )}
        </div>

        {/* Application Link */}
        <div className="mt-6 p-4 bg-neutral-50 dark:bg-neutral-700 rounded border border-neutral-200 dark:border-neutral-600">
          <p className="text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-2">Application Link</p>
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={applicationUrl}
              readOnly
              className="input flex-1 text-sm bg-white dark:bg-neutral-800"
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

      {/* Website Publishing */}
      {canEdit && (
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-display font-semibold text-neutral-900 dark:text-neutral-100 uppercase tracking-wide">Website Publishing</h2>
          </div>
          <div className="flex items-center gap-4 mb-4">
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={job.publishToWebsite}
                onChange={async () => {
                  try {
                    await api.put(`/jobs/${id}`, {
                      publishToWebsite: !job.publishToWebsite,
                    });
                    loadJob();
                  } catch (err) {
                    console.error('Failed to toggle website publish:', err);
                  }
                }}
                className="h-4 w-4 rounded border-neutral-300 dark:border-neutral-600"
              />
              <span className="text-sm font-medium text-neutral-700 dark:text-neutral-300">
                Publish to WHLC Website
              </span>
            </label>
            {job.publishToWebsite && (
              <span className="badge bg-green-100 text-green-800 border border-green-200 dark:bg-green-900 dark:text-green-200 dark:border-green-800">
                Live
              </span>
            )}
          </div>
          <div className="space-y-3">
            <div>
              <label className="text-sm text-neutral-500 dark:text-neutral-400">Slug</label>
              <div className="flex items-center gap-2 mt-1">
                <input
                  type="text"
                  value={job.slug}
                  onChange={(e) => setJob({ ...job, slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]+/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '') })}
                  className="input flex-1 text-sm"
                />
                <button
                  onClick={async () => {
                    try {
                      await api.put(`/jobs/${id}`, { slug: job.slug });
                      loadJob();
                    } catch (err) {
                      console.error('Failed to update slug:', err);
                    }
                  }}
                  className="btn btn-secondary text-sm"
                >
                  Save Slug
                </button>
              </div>
            </div>
            {job.publishToWebsite && (
              <div className="p-3 bg-green-50 dark:bg-green-900/30 rounded border border-green-200 dark:border-green-800">
                <p className="text-xs text-neutral-500 dark:text-neutral-400 mb-1">Website URL</p>
                <p className="text-sm font-medium text-green-800 dark:text-green-300">
                  whlcarchitecture.com/careers/{job.slug}
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Job Details */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <div className="card">
            <h2 className="text-lg font-display font-semibold text-neutral-900 dark:text-neutral-100 mb-4 uppercase tracking-wide">Description</h2>
            <div className="prose prose-sm max-w-none text-neutral-600 dark:text-neutral-300" dangerouslySetInnerHTML={{ __html: renderContent(job.description) }} />
          </div>

          {job.responsibilities && (
            <div className="card">
              <h2 className="text-lg font-display font-semibold text-neutral-900 dark:text-neutral-100 mb-4 uppercase tracking-wide">Responsibilities</h2>
              <div className="prose prose-sm max-w-none text-neutral-600 dark:text-neutral-300" dangerouslySetInnerHTML={{ __html: renderContent(job.responsibilities) }} />
            </div>
          )}

          <div className="card">
            <h2 className="text-lg font-display font-semibold text-neutral-900 dark:text-neutral-100 mb-4 uppercase tracking-wide">Desired Qualifications</h2>
            <div className="prose prose-sm max-w-none text-neutral-600 dark:text-neutral-300" dangerouslySetInnerHTML={{ __html: renderContent(job.requirements) }} />
          </div>

          {job.benefits && (
            <div className="card">
              <h2 className="text-lg font-display font-semibold text-neutral-900 dark:text-neutral-100 mb-4 uppercase tracking-wide">Benefits</h2>
              <div className="prose prose-sm max-w-none text-neutral-600 dark:text-neutral-300" dangerouslySetInnerHTML={{ __html: renderContent(job.benefits) }} />
            </div>
          )}
        </div>

        <div className="space-y-6">
          <div className="card">
            <h2 className="text-lg font-display font-semibold text-neutral-900 dark:text-neutral-100 mb-4 uppercase tracking-wide">Details</h2>
            <dl className="space-y-3 text-sm">
              <div>
                <dt className="text-neutral-500 dark:text-neutral-400">Office</dt>
                <dd className="font-medium text-neutral-900 dark:text-neutral-100">
                  {canEdit ? (
                    <select
                      value={job.officeId || ''}
                      onChange={async (e) => {
                        const officeId = e.target.value || null;
                        try {
                          await api.put(`/jobs/${id}`, { officeId });
                          loadJob();
                        } catch (err) {
                          console.error('Failed to update office:', err);
                        }
                      }}
                      className="input text-sm py-1"
                    >
                      <option value="">None</option>
                      {offices.map((o) => (
                        <option key={o.id} value={o.id}>{o.name}</option>
                      ))}
                    </select>
                  ) : (
                    job.office?.name || 'None'
                  )}
                </dd>
              </div>
              <div>
                <dt className="text-neutral-500 dark:text-neutral-400">Posted by</dt>
                <dd className="font-medium text-neutral-900 dark:text-neutral-100">{job.createdBy.name}</dd>
              </div>
              <div>
                <dt className="text-neutral-500 dark:text-neutral-400">Posted on</dt>
                <dd className="font-medium text-neutral-900 dark:text-neutral-100">
                  {new Date(job.createdAt).toLocaleDateString()}
                </dd>
              </div>
              <div>
                <dt className="text-neutral-500 dark:text-neutral-400">Total Applicants</dt>
                <dd className="font-medium text-neutral-900 dark:text-neutral-100">{job.applicants.length}</dd>
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
          <h2 className="text-lg font-display font-semibold text-neutral-900 dark:text-neutral-100 uppercase tracking-wide">
            Applicants ({job.applicants.length})
          </h2>
        </div>

        {job.applicants.length === 0 ? (
          <p className="text-neutral-500 dark:text-neutral-400 text-center py-8">No applicants yet</p>
        ) : (
          <>
          {/* Mobile card-rows */}
          <div className="md:hidden space-y-2 -mx-6 px-4">
            {job.applicants.map((applicant) => (
              <Link
                key={applicant.id}
                to={`/applicants/${applicant.id}`}
                className="card-row"
              >
                <div className="flex items-center gap-3">
                  <Avatar name={`${applicant.firstName} ${applicant.lastName}`} email={applicant.email} size={36} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <p className="font-medium text-neutral-900 dark:text-neutral-100 truncate">
                        {applicant.firstName} {applicant.lastName}
                      </p>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className={`badge ${stageBadge(applicant.stage)}`}>
                          {stageLabels[applicant.stage]}
                        </span>
                        {applicant.reviews.length > 0 && (
                          <span className="text-sm text-neutral-600 dark:text-neutral-400">
                            <span className="text-neutral-900 dark:text-neutral-100">★</span>{getAverageRating(applicant.reviews)}
                          </span>
                        )}
                        <span className="text-neutral-400 dark:text-neutral-500 text-sm">&rsaquo;</span>
                      </div>
                    </div>
                    <p className="text-xs text-neutral-400 dark:text-neutral-500 mt-0.5">
                      {new Date(applicant.createdAt).toLocaleDateString()}
                    </p>
                  </div>
                </div>
              </Link>
            ))}
          </div>

          {/* Desktop table */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-neutral-200 dark:border-neutral-700 text-left text-sm text-neutral-500 dark:text-neutral-400">
                  <th className="pb-3 font-medium">Applicant</th>
                  <th className="pb-3 font-medium">Stage</th>
                  <th className="pb-3 font-medium">Rating</th>
                  <th className="pb-3 font-medium">Applied</th>
                  <th className="pb-3 font-medium"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100 dark:divide-neutral-700">
                {job.applicants.map((applicant) => (
                  <tr key={applicant.id} className="hover:bg-neutral-50 dark:hover:bg-neutral-700">
                    <td className="py-3">
                      <div className="flex items-center gap-3">
                        <Avatar name={`${applicant.firstName} ${applicant.lastName}`} email={applicant.email} size={32} />
                        <div>
                          <p className="font-medium text-neutral-900 dark:text-neutral-100">
                            {applicant.firstName} {applicant.lastName}
                          </p>
                          <p className="text-sm text-neutral-500 dark:text-neutral-400">{applicant.email}</p>
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
                          <span className="text-neutral-900 dark:text-neutral-100 mr-1">★</span>
                          <span className="font-medium">{getAverageRating(applicant.reviews)}</span>
                          <span className="text-neutral-400 dark:text-neutral-500 text-sm ml-1">
                            ({applicant.reviews.length})
                          </span>
                        </div>
                      ) : (
                        <span className="text-neutral-400 dark:text-neutral-500 text-sm">No reviews</span>
                      )}
                    </td>
                    <td className="py-3 text-sm text-neutral-500 dark:text-neutral-400">
                      {new Date(applicant.createdAt).toLocaleDateString()}
                    </td>
                    <td className="py-3">
                      <Link
                        to={`/applicants/${applicant.id}`}
                        className="text-neutral-900 hover:text-neutral-600 dark:text-neutral-100 dark:hover:text-neutral-300 text-sm font-medium"
                      >
                        View &rarr;
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          </>
        )}
      </div>

      {/* Edit Job Modal */}
      {showEditModal && (
        <EditJobModal
          job={job}
          offices={offices}
          onClose={() => setShowEditModal(false)}
          onSaved={() => {
            setShowEditModal(false);
            loadJob();
          }}
        />
      )}

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

function EditJobModal({
  job,
  offices,
  onClose,
  onSaved,
}: {
  job: Job;
  offices: Office[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const [formData, setFormData] = useState({
    title: job.title,
    department: job.department,
    type: job.type,
    description: job.description,
    responsibilities: job.responsibilities || '',
    requirements: job.requirements,
    benefits: job.benefits || '',
    salary: job.salary || '',
    officeId: job.officeId || '',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      await api.put(`/jobs/${job.id}`, {
        ...formData,
        responsibilities: formData.responsibilities || null,
        benefits: formData.benefits || null,
        salary: formData.salary || null,
        officeId: formData.officeId || null,
      });
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update job');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-neutral-800 rounded-lg w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white dark:bg-neutral-800 border-b border-neutral-200 dark:border-neutral-700 px-6 py-4 flex justify-between items-center">
          <h2 className="text-xl font-display font-bold uppercase tracking-wide text-neutral-900 dark:text-neutral-100">Edit Job</h2>
          <button onClick={onClose} className="text-neutral-400 hover:text-neutral-600 dark:text-neutral-500 dark:hover:text-neutral-300">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 dark:bg-red-900/30 dark:border-red-800 dark:text-red-300 px-4 py-3 rounded text-sm">
              {error}
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="label">Job Title</label>
              <input
                type="text"
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                className="input"
                required
              />
            </div>
            <div>
              <label className="label">Department</label>
              <input
                type="text"
                value={formData.department}
                onChange={(e) => setFormData({ ...formData, department: e.target.value })}
                className="input"
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="label">Office</label>
              <select
                value={formData.officeId}
                onChange={(e) => setFormData({ ...formData, officeId: e.target.value })}
                className="input"
                required
              >
                <option value="">Select an office</option>
                {offices.map((o) => (
                  <option key={o.id} value={o.id}>{o.name} — {o.city}, {o.state}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">Employment Type</label>
              <select
                value={formData.type}
                onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                className="input"
              >
                <option value="full-time">Full-time</option>
                <option value="part-time">Part-time</option>
                <option value="contract">Contract</option>
                <option value="internship">Internship</option>
              </select>
            </div>
            <div>
              <label className="label">Salary Range</label>
              <input
                type="text"
                value={formData.salary}
                onChange={(e) => setFormData({ ...formData, salary: e.target.value })}
                className="input"
                placeholder="e.g., $80,000 - $100,000"
              />
            </div>
          </div>

          <div>
            <label className="label">Job Description</label>
            <RichTextEditor
              value={formData.description}
              onChange={(html) => setFormData({ ...formData, description: html })}
            />
          </div>

          <div>
            <label className="label">Responsibilities (optional)</label>
            <RichTextEditor
              value={formData.responsibilities}
              onChange={(html) => setFormData({ ...formData, responsibilities: html })}
            />
          </div>

          <div>
            <label className="label">Desired Qualifications</label>
            <RichTextEditor
              value={formData.requirements}
              onChange={(html) => setFormData({ ...formData, requirements: html })}
            />
          </div>

          <div>
            <label className="label">Benefits (optional)</label>
            <RichTextEditor
              value={formData.benefits}
              onChange={(html) => setFormData({ ...formData, benefits: html })}
            />
          </div>

          <div className="flex justify-end gap-3 pt-4">
            <button type="button" onClick={onClose} className="btn btn-secondary">
              Cancel
            </button>
            <button type="submit" disabled={loading} className="btn btn-primary">
              {loading ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
