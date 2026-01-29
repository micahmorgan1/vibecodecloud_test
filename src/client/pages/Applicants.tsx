import { useState, useEffect } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { api } from '../lib/api';

interface Applicant {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string | null;
  stage: string;
  createdAt: string;
  job: { id: string; title: string; department: string };
  reviews: Array<{ rating: number }>;
  _count: { reviews: number; notes: number };
}

interface Job {
  id: string;
  title: string;
  department: string;
  status: string;
}

interface ApplicantFormData {
  jobId: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  linkedIn: string;
  website: string;
  portfolioUrl: string;
  yearsExperience: string;
  currentCompany: string;
  currentTitle: string;
  source: string;
}

const emptyForm: ApplicantFormData = {
  jobId: '',
  firstName: '',
  lastName: '',
  email: '',
  phone: '',
  linkedIn: '',
  website: '',
  portfolioUrl: '',
  yearsExperience: '',
  currentCompany: '',
  currentTitle: '',
  source: 'manual',
};

export default function Applicants() {
  const { user: currentUser } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const [applicants, setApplicants] = useState<Applicant[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState(searchParams.get('search') || '');
  const [stageFilter, setStageFilter] = useState(searchParams.get('stage') || '');
  const [showAddModal, setShowAddModal] = useState(false);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [formData, setFormData] = useState<ApplicantFormData>(emptyForm);
  const [formError, setFormError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const canAdd = currentUser?.role === 'admin' || currentUser?.role === 'hiring_manager';

  const stages = ['new', 'screening', 'interview', 'offer', 'hired', 'rejected', 'holding'];

  useEffect(() => {
    fetchApplicants();
  }, [stageFilter]);

  const fetchApplicants = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (stageFilter) params.append('stage', stageFilter);
      if (search) params.append('search', search);
      const queryString = params.toString();
      const res = await api.get<Applicant[]>(`/applicants${queryString ? `?${queryString}` : ''}`);
      setApplicants(res.data);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    fetchApplicants();
  };

  const handleStageChange = (stage: string) => {
    setStageFilter(stage);
    setSearchParams(stage ? { stage } : {});
  };

  const openAddModal = async () => {
    setFormData(emptyForm);
    setFormError('');
    try {
      const res = await api.get<Job[]>('/jobs?status=open');
      setJobs(res.data);
    } catch {
      setJobs([]);
    }
    setShowAddModal(true);
  };

  const handleAddSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');
    setSubmitting(true);
    try {
      await api.post('/applicants/manual', formData);
      setShowAddModal(false);
      fetchApplicants();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setSubmitting(false);
    }
  };

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

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-3xl font-display font-bold text-gray-900 uppercase tracking-wide">Applicants</h1>
          <p className="text-gray-500 mt-1">Review and manage job applicants</p>
        </div>
        {canAdd && (
          <button onClick={openAddModal} className="btn btn-primary">
            + Add Applicant
          </button>
        )}
      </div>

      {/* Search and Filters */}
      <div className="card">
        <div className="flex flex-col md:flex-row gap-4">
          <form onSubmit={handleSearch} className="flex-1">
            <div className="relative">
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search by name or email..."
                className="input pl-10"
              />
              <svg
                className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                />
              </svg>
            </div>
          </form>
        </div>

        <div className="flex gap-2 flex-wrap mt-4">
          <button
            onClick={() => handleStageChange('')}
            className={`px-3 py-1.5 rounded text-sm font-medium transition-colors ${
              stageFilter === ''
                ? 'bg-black text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            All
          </button>
          {stages.map((stage) => (
            <button
              key={stage}
              onClick={() => handleStageChange(stage)}
              className={`px-3 py-1.5 rounded text-sm font-medium transition-colors ${
                stageFilter === stage
                  ? 'bg-black text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              {stageLabels[stage]}
            </button>
          ))}
        </div>
      </div>

      {/* Applicants List */}
      {loading ? (
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-black"></div>
        </div>
      ) : applicants.length === 0 ? (
        <div className="card text-center py-12">
          <p className="text-gray-500">No applicants found</p>
        </div>
      ) : (
        <div className="card overflow-hidden p-0">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr className="text-left text-sm text-gray-500">
                  <th className="px-6 py-4 font-medium">Applicant</th>
                  <th className="px-6 py-4 font-medium">Position</th>
                  <th className="px-6 py-4 font-medium">Stage</th>
                  <th className="px-6 py-4 font-medium">Rating</th>
                  <th className="px-6 py-4 font-medium">Applied</th>
                  <th className="px-6 py-4 font-medium"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {applicants.map((applicant) => (
                  <tr key={applicant.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-gray-900 rounded-full flex items-center justify-center">
                          <span className="text-white font-medium">
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
                    <td className="px-6 py-4">
                      <Link
                        to={`/jobs/${applicant.job.id}`}
                        className="text-gray-900 hover:text-gray-600 font-medium"
                      >
                        {applicant.job.title}
                      </Link>
                      <p className="text-sm text-gray-500">{applicant.job.department}</p>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`badge ${stageBadge(applicant.stage)}`}>
                        {stageLabels[applicant.stage]}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      {applicant.reviews.length > 0 ? (
                        <div className="flex items-center">
                          <span className="text-gray-900 mr-1">★</span>
                          <span className="font-medium">{getAverageRating(applicant.reviews)}</span>
                          <span className="text-gray-400 text-sm ml-1">
                            ({applicant._count.reviews})
                          </span>
                        </div>
                      ) : (
                        <span className="text-gray-400 text-sm">No reviews</span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-500">
                      {new Date(applicant.createdAt).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4">
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
        </div>
      )}

      {/* Add Applicant Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b px-6 py-4 flex justify-between items-center">
              <h2 className="text-xl font-display font-bold uppercase tracking-wide">Add Applicant</h2>
              <button onClick={() => setShowAddModal(false)} className="text-gray-400 hover:text-gray-600">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <form onSubmit={handleAddSubmit} className="p-6 space-y-4">
              {formError && (
                <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded text-sm">
                  {formError}
                </div>
              )}

              <div>
                <label className="label">Job Position</label>
                <select
                  value={formData.jobId}
                  onChange={(e) => setFormData({ ...formData, jobId: e.target.value })}
                  className="input"
                  required
                >
                  <option value="">Select a job...</option>
                  {jobs.map((job) => (
                    <option key={job.id} value={job.id}>
                      {job.title} — {job.department}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="label">First Name</label>
                  <input
                    type="text"
                    value={formData.firstName}
                    onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
                    className="input"
                    required
                  />
                </div>
                <div>
                  <label className="label">Last Name</label>
                  <input
                    type="text"
                    value={formData.lastName}
                    onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
                    className="input"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="label">Email</label>
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

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="label">Current Title</label>
                  <input
                    type="text"
                    value={formData.currentTitle}
                    onChange={(e) => setFormData({ ...formData, currentTitle: e.target.value })}
                    className="input"
                  />
                </div>
                <div>
                  <label className="label">Current Company</label>
                  <input
                    type="text"
                    value={formData.currentCompany}
                    onChange={(e) => setFormData({ ...formData, currentCompany: e.target.value })}
                    className="input"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="label">Years of Experience</label>
                  <input
                    type="number"
                    value={formData.yearsExperience}
                    onChange={(e) => setFormData({ ...formData, yearsExperience: e.target.value })}
                    className="input"
                    min="0"
                  />
                </div>
                <div>
                  <label className="label">Source</label>
                  <select
                    value={formData.source}
                    onChange={(e) => setFormData({ ...formData, source: e.target.value })}
                    className="input"
                  >
                    <option value="manual">Manual Entry</option>
                    <option value="referral">Referral</option>
                    <option value="linkedin">LinkedIn</option>
                    <option value="indeed">Indeed</option>
                    <option value="website">Website</option>
                    <option value="other">Other</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="label">LinkedIn URL</label>
                  <input
                    type="url"
                    value={formData.linkedIn}
                    onChange={(e) => setFormData({ ...formData, linkedIn: e.target.value })}
                    className="input"
                    placeholder="https://linkedin.com/in/..."
                  />
                </div>
                <div>
                  <label className="label">Portfolio URL</label>
                  <input
                    type="url"
                    value={formData.portfolioUrl}
                    onChange={(e) => setFormData({ ...formData, portfolioUrl: e.target.value })}
                    className="input"
                    placeholder="https://..."
                  />
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-4">
                <button type="button" onClick={() => setShowAddModal(false)} className="btn btn-secondary">
                  Cancel
                </button>
                <button type="submit" disabled={submitting} className="btn btn-primary">
                  {submitting ? 'Adding...' : 'Add Applicant'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
