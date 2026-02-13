import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../lib/api';
import { useAuth } from '../context/AuthContext';
import RichTextEditor from '../components/RichTextEditor';
import Pagination from '../components/Pagination';
import { PaginatedResponse, isPaginated } from '../lib/pagination';

interface Job {
  id: string;
  title: string;
  slug: string;
  department: string;
  location: string;
  type: string;
  status: string;
  salary: string | null;
  publishToWebsite: boolean;
  archived: boolean;
  createdAt: string;
  createdBy: { id: string; name: string };
  _count: { applicants: number };
  postedToLinkedIn: boolean;
  office: { id: string; name: string; city: string; state: string } | null;
}

export default function Jobs() {
  const { user } = useAuth();
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('');
  const [showArchived, setShowArchived] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const pageSize = 25;

  const canCreateJob = user?.role === 'admin' || user?.role === 'hiring_manager';
  const isAdmin = user?.role === 'admin';

  useEffect(() => {
    fetchJobs();
  }, [statusFilter, showArchived, page]);

  const fetchJobs = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (statusFilter) params.append('status', statusFilter);
      if (showArchived) params.append('archived', 'true');
      params.append('page', String(page));
      params.append('pageSize', String(pageSize));
      const queryString = params.toString();
      const res = await api.get<PaginatedResponse<Job> | Job[]>(`/jobs${queryString ? `?${queryString}` : ''}`);
      if (isPaginated(res.data)) {
        setJobs(res.data.data);
        setTotal(res.data.total);
        setTotalPages(res.data.totalPages);
      } else {
        setJobs(res.data);
        setTotal(res.data.length);
        setTotalPages(1);
      }
    } finally {
      setLoading(false);
    }
  };

  const statusBadge = (status: string) => {
    const styles: Record<string, string> = {
      open: 'bg-black text-white dark:bg-white dark:text-black',
      closed: 'bg-neutral-200 text-neutral-500 dark:bg-neutral-600 dark:text-neutral-300',
      'on-hold': 'bg-neutral-300 text-neutral-700 dark:bg-neutral-600 dark:text-neutral-300',
    };
    return styles[status] || styles.open;
  };

  const typeBadge = (type: string) => {
    const styles: Record<string, string> = {
      'full-time': 'bg-neutral-100 text-neutral-800 border border-neutral-300 dark:bg-neutral-700 dark:text-neutral-300 dark:border-neutral-600',
      'part-time': 'bg-neutral-100 text-neutral-600 border border-neutral-300 dark:bg-neutral-700 dark:text-neutral-400 dark:border-neutral-600',
      contract: 'bg-neutral-100 text-neutral-600 border border-neutral-300 dark:bg-neutral-700 dark:text-neutral-400 dark:border-neutral-600',
      internship: 'bg-neutral-100 text-neutral-600 border border-neutral-300 dark:bg-neutral-700 dark:text-neutral-400 dark:border-neutral-600',
    };
    return styles[type] || 'bg-neutral-100 text-neutral-800 dark:bg-neutral-700 dark:text-neutral-300';
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-display font-bold text-neutral-900 dark:text-neutral-100 uppercase tracking-wide">Jobs</h1>
          <p className="text-neutral-500 dark:text-neutral-400 mt-1">Manage job postings and track applicants</p>
        </div>
        {canCreateJob && (
          <button
            onClick={() => setShowCreateModal(true)}
            className="btn btn-primary font-display uppercase tracking-wider"
          >
            + Create Job
          </button>
        )}
      </div>

      {/* Filters */}
      <div className="flex gap-2 flex-wrap items-center">
        {!showArchived && ['', 'open', 'closed', 'on-hold'].map((status) => (
          <button
            key={status}
            onClick={() => { setStatusFilter(status); setPage(1); }}
            className={`px-4 py-2 rounded text-sm font-medium transition-colors ${
              statusFilter === status
                ? 'bg-black text-white dark:bg-white dark:text-black'
                : 'bg-white text-neutral-700 hover:bg-neutral-100 border border-neutral-200 dark:bg-neutral-700 dark:text-neutral-300 dark:hover:bg-neutral-600 dark:border-neutral-700'
            }`}
          >
            {status === '' ? 'All' : status.charAt(0).toUpperCase() + status.slice(1)}
          </button>
        ))}
        {isAdmin && (
          <button
            onClick={() => {
              setShowArchived(!showArchived);
              setStatusFilter('');
              setPage(1);
            }}
            className={`px-4 py-2 rounded text-sm font-medium transition-colors ${
              showArchived
                ? 'bg-neutral-700 text-white dark:bg-neutral-300 dark:text-black'
                : 'bg-white text-neutral-500 hover:bg-neutral-100 border border-neutral-200 dark:bg-neutral-700 dark:text-neutral-400 dark:hover:bg-neutral-600 dark:border-neutral-700'
            }`}
          >
            {showArchived ? 'Hide Archived' : 'Show Archived'}
          </button>
        )}
      </div>

      {/* Jobs Grid */}
      {loading ? (
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-black dark:border-white"></div>
        </div>
      ) : jobs.length === 0 ? (
        <div className="card text-center py-12">
          <p className="text-neutral-500 dark:text-neutral-400">No jobs found</p>
          {canCreateJob && (
            <button
              onClick={() => setShowCreateModal(true)}
              className="btn btn-primary mt-4"
            >
              Create your first job
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {jobs.map((job) => (
            <Link
              key={job.id}
              to={`/jobs/${job.id}`}
              className={`card hover:shadow-md transition-shadow ${job.archived ? 'opacity-60' : ''}`}
            >
              <div className="flex items-start justify-between mb-3">
                <div className="flex gap-2">
                  {job.archived ? (
                    <span className="badge bg-neutral-300 text-neutral-600 dark:bg-neutral-600 dark:text-neutral-300">Archived</span>
                  ) : (
                    <span className={`badge ${statusBadge(job.status)}`}>
                      {job.status}
                    </span>
                  )}
                  {job.publishToWebsite && (
                    <span className="badge bg-green-100 text-green-800 border border-green-200 dark:bg-green-900 dark:text-green-200 dark:border-green-800">
                      Website
                    </span>
                  )}
                  {job.postedToLinkedIn && (
                    <span className="badge bg-blue-100 text-blue-800 border border-blue-200 dark:bg-blue-900 dark:text-blue-200 dark:border-blue-800">
                      LinkedIn
                    </span>
                  )}
                </div>
                <span className={`badge ${typeBadge(job.type)}`}>
                  {job.type}
                </span>
              </div>

              <h3 className="text-lg font-display font-semibold text-neutral-900 dark:text-neutral-100 mb-1">{job.title}</h3>
              <p className="text-neutral-500 dark:text-neutral-400 text-sm mb-3">{job.department}</p>

              <div className="flex items-center text-sm text-neutral-500 dark:text-neutral-400 mb-3">
                <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                {job.office ? `${job.office.name} — ${job.office.city}, ${job.office.state}` : job.location}
              </div>

              {job.salary && (
                <p className="text-sm text-neutral-500 dark:text-neutral-400 mb-3">{job.salary}</p>
              )}

              <div className="flex items-center justify-between pt-3 border-t border-neutral-200 dark:border-neutral-700">
                <div className="flex items-center text-sm">
                  <span className="text-neutral-900 dark:text-neutral-100 font-medium">{job._count.applicants}</span>
                  <span className="text-neutral-500 dark:text-neutral-400 ml-1">applicants</span>
                </div>
                <p className="text-xs text-neutral-400 dark:text-neutral-500">
                  {new Date(job.createdAt).toLocaleDateString()}
                </p>
              </div>
            </Link>
          ))}
        </div>
      )}

      <Pagination page={page} totalPages={totalPages} total={total} pageSize={pageSize} onPageChange={setPage} />

      {/* Create Job Modal */}
      {showCreateModal && (
        <CreateJobModal
          onClose={() => setShowCreateModal(false)}
          onCreated={() => {
            setShowCreateModal(false);
            fetchJobs();
          }}
        />
      )}
    </div>
  );
}

interface Office {
  id: string;
  name: string;
  city: string;
  state: string;
}

function CreateJobModal({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: () => void;
}) {
  const [formData, setFormData] = useState({
    title: '',
    slug: '',
    department: '',
    type: 'full-time',
    description: '',
    responsibilities: '',
    requirements: '',
    benefits: '',
    salary: '',
    publishToWebsite: false,
    officeId: '',
  });
  const [slugManuallyEdited, setSlugManuallyEdited] = useState(false);
  const [offices, setOffices] = useState<Office[]>([]);

  const toSlug = (text: string) =>
    text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    api.get<Office[]>('/offices').then((res) => setOffices(res.data));
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const payload = {
        ...formData,
        slug: formData.slug || undefined, // let backend auto-generate if empty
        officeId: formData.officeId || undefined,
        responsibilities: formData.responsibilities || null,
        benefits: formData.benefits || null,
      };
      await api.post('/jobs', payload);
      onCreated();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create job');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white dark:bg-neutral-800 rounded max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6 border-b border-neutral-200 dark:border-neutral-700 sticky top-0 bg-white dark:bg-neutral-800">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-display font-semibold uppercase tracking-wide text-neutral-900 dark:text-neutral-100">Create New Job</h2>
            <button onClick={onClose} className="text-neutral-400 hover:text-neutral-600 dark:text-neutral-500 dark:hover:text-neutral-300">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="bg-neutral-100 border border-neutral-300 text-neutral-800 dark:bg-neutral-700 dark:border-neutral-600 dark:text-neutral-300 px-4 py-3 rounded">
              {error}
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="label">Job Title</label>
              <input
                type="text"
                value={formData.title}
                onChange={(e) => {
                  const title = e.target.value;
                  setFormData({
                    ...formData,
                    title,
                    ...(slugManuallyEdited ? {} : { slug: toSlug(title) }),
                  });
                }}
                className="input"
                placeholder="e.g., Senior Architect"
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
                placeholder="e.g., Design"
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
          </div>

          <div>
            <label className="label">Salary Range (optional)</label>
            <input
              type="text"
              value={formData.salary}
              onChange={(e) => setFormData({ ...formData, salary: e.target.value })}
              className="input"
              placeholder="e.g., $80,000 - $100,000"
            />
          </div>

          <div>
            <label className="label">URL Slug</label>
            <input
              type="text"
              value={formData.slug}
              onChange={(e) => {
                setSlugManuallyEdited(true);
                setFormData({ ...formData, slug: toSlug(e.target.value) });
              }}
              className="input"
              placeholder="auto-generated from title"
            />
            <p className="text-xs text-neutral-400 dark:text-neutral-500 mt-1">
              Leave blank to auto-generate from the title
            </p>
          </div>

          <div className="flex items-center gap-3">
            <input
              type="checkbox"
              id="publishToWebsite"
              checked={formData.publishToWebsite}
              onChange={(e) => setFormData({ ...formData, publishToWebsite: e.target.checked })}
              className="h-4 w-4 rounded border-neutral-300 dark:border-neutral-600"
            />
            <label htmlFor="publishToWebsite" className="text-sm font-medium text-neutral-700 dark:text-neutral-300">
              Publish to WHLC Website
            </label>
          </div>

          <div>
            <label className="label">Job Description</label>
            <RichTextEditor
              value={formData.description}
              onChange={(html) => setFormData({ ...formData, description: html })}
              placeholder="Describe the role..."
            />
          </div>

          <div>
            <label className="label">Responsibilities (optional)</label>
            <RichTextEditor
              value={formData.responsibilities}
              onChange={(html) => setFormData({ ...formData, responsibilities: html })}
              placeholder="List key responsibilities..."
            />
          </div>

          <div>
            <label className="label">Desired Qualifications</label>
            <RichTextEditor
              value={formData.requirements}
              onChange={(html) => setFormData({ ...formData, requirements: html })}
              placeholder="List desired qualifications..."
            />
          </div>

          <div>
            <label className="label">Benefits (optional)</label>
            <RichTextEditor
              value={formData.benefits}
              onChange={(html) => setFormData({ ...formData, benefits: html })}
              placeholder="List benefits and perks..."
            />
          </div>

          <div className="flex justify-end gap-3 pt-4">
            <button type="button" onClick={onClose} className="btn btn-secondary">
              Cancel
            </button>
            <button type="submit" disabled={loading} className="btn btn-primary">
              {loading ? 'Creating...' : 'Create Job'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
