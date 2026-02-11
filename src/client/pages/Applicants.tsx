import { useState, useEffect } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { api } from '../lib/api';
import { isValidEmail, isValidPhone } from '../utils/validation';

interface Applicant {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string | null;
  stage: string;
  spam: boolean;
  spamReason: string | null;
  createdAt: string;
  job: { id: string; title: string; department: string; archived: boolean } | null;
  event: { id: string; name: string } | null;
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
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [resumeFile, setResumeFile] = useState<File | null>(null);
  const [portfolioFile, setPortfolioFile] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [showSpam, setShowSpam] = useState(false);
  const [spamCount, setSpamCount] = useState(0);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkActionLoading, setBulkActionLoading] = useState(false);
  const [showBulkDeleteModal, setShowBulkDeleteModal] = useState(false);
  const [showDeleteAllSpamModal, setShowDeleteAllSpamModal] = useState(false);
  const [showBulkMarkSpamModal, setShowBulkMarkSpamModal] = useState(false);

  const canAdd = currentUser?.role === 'admin' || currentUser?.role === 'hiring_manager';
  const canManageSpam = currentUser?.role === 'admin' || currentUser?.role === 'hiring_manager';

  const stages = ['fair_intake', 'new', 'screening', 'interview', 'offer', 'hired', 'rejected', 'holding'];

  useEffect(() => {
    fetchApplicants();
  }, [stageFilter, showSpam]);

  useEffect(() => {
    refreshSpamCount();
  }, []);

  const refreshSpamCount = () => {
    api.get<{ spamCount: number }>('/dashboard/stats').then((res) => {
      setSpamCount(res.data.spamCount);
    }).catch(() => {});
  };

  const fetchApplicants = async () => {
    setLoading(true);
    setSelectedIds(new Set());
    try {
      const params = new URLSearchParams();
      if (stageFilter) params.append('stage', stageFilter);
      if (search) params.append('search', search);
      params.append('spam', showSpam ? 'true' : 'false');
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
    setFieldErrors({});
    setResumeFile(null);
    setPortfolioFile(null);
    try {
      const res = await api.get<Job[]>('/jobs?status=open');
      setJobs(res.data);
    } catch {
      setJobs([]);
    }
    setShowAddModal(true);
  };

  const validateField = (field: string, value: string) => {
    if (field === 'email' && value && !isValidEmail(value)) {
      return 'Please enter a valid email address';
    }
    if (field === 'phone' && value && !isValidPhone(value)) {
      return 'Please enter a valid phone number';
    }
    return '';
  };

  const handleFieldBlur = (field: string, value: string) => {
    const error = validateField(field, value);
    setFieldErrors((prev) => {
      const next = { ...prev };
      if (error) next[field] = error;
      else delete next[field];
      return next;
    });
  };

  const handleAddSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');
    const errors: Record<string, string> = {};
    const emailErr = validateField('email', formData.email);
    if (emailErr) errors.email = emailErr;
    const phoneErr = validateField('phone', formData.phone);
    if (phoneErr) errors.phone = phoneErr;
    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      return;
    }
    setFieldErrors({});
    setSubmitting(true);
    try {
      const fd = new FormData();
      Object.entries(formData).forEach(([key, val]) => {
        if (val) fd.append(key, val);
      });
      if (resumeFile) fd.append('resume', resumeFile);
      if (portfolioFile) fd.append('portfolio', portfolioFile);
      await api.upload('/applicants/manual', fd);
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

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === applicants.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(applicants.map((a) => a.id)));
    }
  };

  const handleBulkDelete = async () => {
    setBulkActionLoading(true);
    try {
      await api.post('/applicants/bulk-delete', { ids: Array.from(selectedIds) });
      setShowBulkDeleteModal(false);
      fetchApplicants();
      refreshSpamCount();
    } catch (err) {
      console.error('Bulk delete failed:', err);
    } finally {
      setBulkActionLoading(false);
    }
  };

  const handleDeleteAllSpam = async () => {
    setBulkActionLoading(true);
    try {
      await api.delete('/applicants/spam');
      setShowDeleteAllSpamModal(false);
      fetchApplicants();
      refreshSpamCount();
    } catch (err) {
      console.error('Delete all spam failed:', err);
    } finally {
      setBulkActionLoading(false);
    }
  };

  const handleBulkMarkSpam = async () => {
    setBulkActionLoading(true);
    try {
      await api.post('/applicants/bulk-mark-spam', { ids: Array.from(selectedIds) });
      setShowBulkMarkSpamModal(false);
      fetchApplicants();
      refreshSpamCount();
    } catch (err) {
      console.error('Bulk mark spam failed:', err);
    } finally {
      setBulkActionLoading(false);
    }
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

        <div className="flex gap-2 flex-wrap mt-4 items-center">
          <button
            onClick={() => handleStageChange('')}
            className={`px-3 py-1.5 rounded text-sm font-medium transition-colors ${
              stageFilter === '' && !showSpam
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
                stageFilter === stage && !showSpam
                  ? 'bg-black text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              {stageLabels[stage]}
            </button>
          ))}
          {canAdd && spamCount > 0 && (
            <>
              <span className="text-gray-300 mx-1">|</span>
              <button
                onClick={() => { setShowSpam(!showSpam); setStageFilter(''); }}
                className={`px-3 py-1.5 rounded text-sm font-medium transition-colors ${
                  showSpam
                    ? 'bg-red-600 text-white'
                    : 'bg-red-50 text-red-700 hover:bg-red-100'
                }`}
              >
                Spam ({spamCount})
              </button>
            </>
          )}
        </div>
      </div>

      {/* Bulk Action Bar */}
      {canManageSpam && !loading && applicants.length > 0 && (
        <div className="flex items-center gap-3 flex-wrap">
          {showSpam ? (
            <>
              {selectedIds.size > 0 && (
                <button
                  onClick={() => setShowBulkDeleteModal(true)}
                  className="px-3 py-1.5 bg-red-600 text-white rounded text-sm font-medium hover:bg-red-700 transition-colors"
                >
                  Delete Selected ({selectedIds.size})
                </button>
              )}
              <button
                onClick={() => setShowDeleteAllSpamModal(true)}
                className="px-3 py-1.5 bg-red-50 text-red-700 border border-red-200 rounded text-sm font-medium hover:bg-red-100 transition-colors"
              >
                Delete All Spam
              </button>
            </>
          ) : (
            <>
              {selectedIds.size > 0 && (
                <button
                  onClick={() => setShowBulkMarkSpamModal(true)}
                  className="px-3 py-1.5 bg-red-600 text-white rounded text-sm font-medium hover:bg-red-700 transition-colors"
                >
                  Mark Selected as Spam ({selectedIds.size})
                </button>
              )}
            </>
          )}
        </div>
      )}

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
                  {canManageSpam && (
                    <th className="pl-6 py-4 w-10">
                      <input
                        type="checkbox"
                        checked={applicants.length > 0 && selectedIds.size === applicants.length}
                        onChange={toggleSelectAll}
                        className="h-4 w-4 rounded border-gray-300"
                      />
                    </th>
                  )}
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
                  <tr key={applicant.id} className={`hover:bg-gray-50 ${selectedIds.has(applicant.id) ? 'bg-blue-50' : ''}`}>
                    {canManageSpam && (
                      <td className="pl-6 py-4 w-10">
                        <input
                          type="checkbox"
                          checked={selectedIds.has(applicant.id)}
                          onChange={() => toggleSelect(applicant.id)}
                          className="h-4 w-4 rounded border-gray-300"
                        />
                      </td>
                    )}
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
                            {applicant.spam && (
                              <span className="badge badge-spam ml-2">Spam</span>
                            )}
                          </p>
                          <p className="text-sm text-gray-500">{applicant.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      {applicant.job ? (
                        <>
                          <Link
                            to={`/jobs/${applicant.job.id}`}
                            className="text-gray-900 hover:text-gray-600 font-medium"
                          >
                            {applicant.job.title}
                          </Link>
                          {applicant.job.archived && (
                            <span className="text-gray-400 text-xs ml-1">(Archived)</span>
                          )}
                          <p className="text-sm text-gray-500">{applicant.job.department}</p>
                        </>
                      ) : (
                        <span className="text-gray-500 italic">General Application</span>
                      )}
                      {applicant.event && (
                        <Link
                          to={`/events/${applicant.event.id}`}
                          className="text-xs text-blue-600 hover:text-blue-800 block mt-0.5"
                        >
                          {applicant.event.name}
                        </Link>
                      )}
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

      {/* Bulk Delete Confirmation Modal */}
      {showBulkDeleteModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded max-w-md w-full">
            <div className="p-6 border-b border-gray-200">
              <h2 className="text-xl font-display font-semibold uppercase tracking-wide">
                Delete Selected Applicants
              </h2>
            </div>
            <div className="p-6 space-y-4">
              <p className="text-gray-700">
                Are you sure you want to permanently delete <span className="font-medium">{selectedIds.size} applicant{selectedIds.size !== 1 ? 's' : ''}</span>?
                This will remove all their data including reviews, notes, and uploaded files.
              </p>
              <div className="flex justify-end gap-3 pt-4">
                <button
                  onClick={() => setShowBulkDeleteModal(false)}
                  disabled={bulkActionLoading}
                  className="btn btn-secondary"
                >
                  Cancel
                </button>
                <button
                  onClick={handleBulkDelete}
                  disabled={bulkActionLoading}
                  className="btn btn-primary bg-red-600 hover:bg-red-700 border-red-600"
                >
                  {bulkActionLoading ? 'Deleting...' : `Delete ${selectedIds.size} Applicant${selectedIds.size !== 1 ? 's' : ''}`}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Delete All Spam Confirmation Modal */}
      {showDeleteAllSpamModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded max-w-md w-full">
            <div className="p-6 border-b border-gray-200">
              <h2 className="text-xl font-display font-semibold uppercase tracking-wide">
                Delete All Spam
              </h2>
            </div>
            <div className="p-6 space-y-4">
              <p className="text-gray-700">
                Are you sure you want to permanently delete <span className="font-medium">all spam applicants</span>?
                This will remove all their data including reviews, notes, and uploaded files. This action cannot be undone.
              </p>
              <div className="flex justify-end gap-3 pt-4">
                <button
                  onClick={() => setShowDeleteAllSpamModal(false)}
                  disabled={bulkActionLoading}
                  className="btn btn-secondary"
                >
                  Cancel
                </button>
                <button
                  onClick={handleDeleteAllSpam}
                  disabled={bulkActionLoading}
                  className="btn btn-primary bg-red-600 hover:bg-red-700 border-red-600"
                >
                  {bulkActionLoading ? 'Deleting...' : 'Delete All Spam'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Bulk Mark as Spam Confirmation Modal */}
      {showBulkMarkSpamModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded max-w-md w-full">
            <div className="p-6 border-b border-gray-200">
              <h2 className="text-xl font-display font-semibold uppercase tracking-wide">
                Mark as Spam
              </h2>
            </div>
            <div className="p-6 space-y-4">
              <p className="text-gray-700">
                Are you sure you want to mark <span className="font-medium">{selectedIds.size} applicant{selectedIds.size !== 1 ? 's' : ''}</span> as spam?
                They will be moved to the spam queue.
              </p>
              <div className="flex justify-end gap-3 pt-4">
                <button
                  onClick={() => setShowBulkMarkSpamModal(false)}
                  disabled={bulkActionLoading}
                  className="btn btn-secondary"
                >
                  Cancel
                </button>
                <button
                  onClick={handleBulkMarkSpam}
                  disabled={bulkActionLoading}
                  className="btn btn-primary bg-red-600 hover:bg-red-700 border-red-600"
                >
                  {bulkActionLoading ? 'Marking...' : `Mark ${selectedIds.size} as Spam`}
                </button>
              </div>
            </div>
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
                >
                  <option value="">General Application (no specific job)</option>
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
                    onBlur={(e) => handleFieldBlur('email', e.target.value)}
                    className={`input ${fieldErrors.email ? 'border-red-400' : ''}`}
                    required
                  />
                  {fieldErrors.email && (
                    <p className="text-red-600 text-xs mt-1">{fieldErrors.email}</p>
                  )}
                </div>
                <div>
                  <label className="label">Phone</label>
                  <input
                    type="tel"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    onBlur={(e) => handleFieldBlur('phone', e.target.value)}
                    className={`input ${fieldErrors.phone ? 'border-red-400' : ''}`}
                  />
                  {fieldErrors.phone && (
                    <p className="text-red-600 text-xs mt-1">{fieldErrors.phone}</p>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="label">Resume</label>
                  <input
                    type="file"
                    accept=".pdf,.doc,.docx"
                    onChange={(e) => setResumeFile(e.target.files?.[0] || null)}
                    className="input text-sm file:mr-3 file:py-1 file:px-3 file:rounded file:border-0 file:bg-gray-100 file:text-gray-700 file:font-medium file:cursor-pointer"
                  />
                  <p className="text-xs text-gray-400 mt-1">PDF, DOC, or DOCX</p>
                </div>
                <div>
                  <label className="label">Portfolio File</label>
                  <input
                    type="file"
                    accept=".pdf,.jpg,.jpeg,.png,.zip"
                    onChange={(e) => setPortfolioFile(e.target.files?.[0] || null)}
                    className="input text-sm file:mr-3 file:py-1 file:px-3 file:rounded file:border-0 file:bg-gray-100 file:text-gray-700 file:font-medium file:cursor-pointer"
                  />
                  <p className="text-xs text-gray-400 mt-1">PDF, JPG, PNG, or ZIP</p>
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
