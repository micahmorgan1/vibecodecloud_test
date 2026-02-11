import { useState, useEffect, useRef } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { api } from '../lib/api';
import Avatar from '../components/Avatar';
import { isValidEmail, isValidPhone } from '../utils/validation';
import QRScanner from '../components/QRScanner';
import { VCardData } from '../utils/vcardParser';
import { EventFormModal } from './Events';
import Pagination from '../components/Pagination';
import { PaginatedResponse, isPaginated } from '../lib/pagination';

interface EventAttendee {
  id: string;
  user: { id: string; name: string; email: string; role?: string };
}

interface RecruitmentEvent {
  id: string;
  name: string;
  type: string;
  location: string | null;
  date: string;
  notes: string | null;
  description: string | null;
  eventUrl: string | null;
  university: string | null;
  publishToWebsite: boolean;
  createdBy: { id: string; name: string };
  _count: { applicants: number };
  attendees: EventAttendee[];
}

interface Applicant {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string | null;
  stage: string;
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
}

interface User {
  id: string;
  name: string;
  email: string;
  role: string;
}

const typeLabels: Record<string, string> = {
  job_fair: 'Job Fair',
  campus_visit: 'Campus Visit',
  info_session: 'Info Session',
};

const typeBadgeStyles: Record<string, string> = {
  job_fair: 'bg-blue-100 text-blue-800',
  campus_visit: 'bg-purple-100 text-purple-800',
  info_session: 'bg-green-100 text-green-800',
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

export default function EventDetail() {
  const { id } = useParams<{ id: string }>();
  const { user: currentUser } = useAuth();
  const [event, setEvent] = useState<RecruitmentEvent | null>(null);
  const [applicants, setApplicants] = useState<Applicant[]>([]);
  const [loading, setLoading] = useState(true);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showManageAttendees, setShowManageAttendees] = useState(false);
  const [showIntakeForm, setShowIntakeForm] = useState(false);
  const [appPage, setAppPage] = useState(1);
  const [appTotal, setAppTotal] = useState(0);
  const [appTotalPages, setAppTotalPages] = useState(0);
  const appPageSize = 25;

  const canManage = currentUser?.role === 'admin' || currentUser?.role === 'hiring_manager';

  useEffect(() => {
    if (id) {
      fetchEvent();
      fetchApplicants();
    }
  }, [id, appPage]);

  const fetchEvent = async () => {
    try {
      const res = await api.get<RecruitmentEvent>(`/events/${id}`);
      setEvent(res.data);
    } finally {
      setLoading(false);
    }
  };

  const fetchApplicants = async () => {
    try {
      const res = await api.get<PaginatedResponse<Applicant> | Applicant[]>(
        `/applicants?eventId=${id}&page=${appPage}&pageSize=${appPageSize}`
      );
      if (isPaginated(res.data)) {
        setApplicants(res.data.data);
        setAppTotal(res.data.total);
        setAppTotalPages(res.data.totalPages);
      } else {
        setApplicants(res.data);
        setAppTotal(res.data.length);
        setAppTotalPages(1);
      }
    } catch {
      // ignore
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-black"></div>
      </div>
    );
  }

  if (!event) {
    return (
      <div className="card text-center py-12">
        <p className="text-gray-500">Event not found</p>
        <Link to="/events" className="btn btn-primary mt-4">Back to Events</Link>
      </div>
    );
  }

  const getAverageRating = (reviews: Applicant['reviews']) => {
    if (reviews.length === 0) return null;
    return (reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length).toFixed(1);
  };

  return (
    <div className="space-y-6">
      {/* Breadcrumb */}
      <nav className="text-sm text-gray-500">
        <Link to="/events" className="hover:text-gray-900">Events</Link>
        <span className="mx-2">/</span>
        <span className="text-gray-900">{event.name}</span>
      </nav>

      {/* Event Header */}
      <div className="card">
        <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <h1 className="text-2xl font-display font-bold text-gray-900 uppercase tracking-wide">
                {event.name}
              </h1>
              <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${typeBadgeStyles[event.type] || 'bg-gray-100 text-gray-800'}`}>
                {typeLabels[event.type] || event.type}
              </span>
              {event.publishToWebsite && (
                <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-emerald-100 text-emerald-700">
                  Website
                </span>
              )}
            </div>
            <div className="flex items-center gap-4 text-sm text-gray-500">
              <span>{new Date(event.date).toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</span>
              {event.location && <span>{event.location}</span>}
              {event.university && <span>{event.university}</span>}
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={() => setShowIntakeForm(!showIntakeForm)}
              className="btn btn-primary"
            >
              {showIntakeForm ? 'Hide Intake Form' : 'Start Fair Intake'}
            </button>
            {canManage && (
              <button onClick={() => setShowEditModal(true)} className="btn btn-secondary">
                Edit
              </button>
            )}
          </div>
        </div>

        {event.description && (
          <p className="text-sm text-gray-600 mt-4">{event.description}</p>
        )}
        {event.eventUrl && (
          <a href={event.eventUrl} target="_blank" rel="noopener noreferrer" className="text-sm text-gray-900 hover:text-gray-600 font-medium mt-2 inline-block">
            Event Page &rarr;
          </a>
        )}
        {event.notes && (
          <p className="text-sm text-gray-500 mt-3 italic">{event.notes}</p>
        )}

        {/* Attendees */}
        <div className="mt-6 pt-6 border-t border-gray-200">
          <div className="flex items-center justify-between mb-3">
            <p className="text-sm font-medium text-gray-700">Attendees ({event.attendees.length})</p>
            {canManage && (
              <button
                onClick={() => setShowManageAttendees(true)}
                className="text-sm text-gray-900 hover:text-gray-600 font-medium"
              >
                Manage
              </button>
            )}
          </div>
          <div className="flex flex-wrap gap-2">
            {event.attendees.map((a) => (
              <div key={a.id} className="flex items-center gap-2 bg-gray-50 rounded px-3 py-1.5">
                <Avatar name={a.user.name} email={a.user.email} size={24} />
                <span className="text-sm">{a.user.name}</span>
              </div>
            ))}
            {event.attendees.length === 0 && (
              <p className="text-sm text-gray-400">No attendees assigned</p>
            )}
          </div>
        </div>
      </div>

      {/* Fair Intake Form */}
      {showIntakeForm && (
        <IntakeForm
          eventId={event.id}
          eventName={event.name}
          onApplicantAdded={() => {
            fetchApplicants();
            fetchEvent();
          }}
        />
      )}

      {/* Applicants Table */}
      <div className="card">
        <h2 className="text-lg font-display font-semibold text-gray-900 mb-4 uppercase tracking-wide">
          Event Applicants ({appTotal})
        </h2>

        {applicants.length === 0 ? (
          <p className="text-gray-500 text-center py-8">No applicants added to this event yet</p>
        ) : (
          <div className="overflow-x-auto -mx-6">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr className="text-left text-sm text-gray-500">
                  <th className="px-6 py-3 font-medium">Applicant</th>
                  <th className="px-6 py-3 font-medium">Position</th>
                  <th className="px-6 py-3 font-medium">Stage</th>
                  <th className="px-6 py-3 font-medium">Rating</th>
                  <th className="px-6 py-3 font-medium">Added</th>
                  <th className="px-6 py-3 font-medium"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {applicants.map((applicant) => (
                  <tr key={applicant.id} className="hover:bg-gray-50">
                    <td className="px-6 py-3">
                      <div className="flex items-center gap-3">
                        <Avatar name={`${applicant.firstName} ${applicant.lastName}`} email={applicant.email} size={32} />
                        <div>
                          <p className="font-medium text-gray-900 text-sm">
                            {applicant.firstName} {applicant.lastName}
                          </p>
                          <p className="text-xs text-gray-500">{applicant.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-3 text-sm">
                      {applicant.job ? (
                        <span className="text-gray-900">{applicant.job.title}</span>
                      ) : (
                        <span className="text-gray-500 italic">General Interest</span>
                      )}
                    </td>
                    <td className="px-6 py-3">
                      <span className={`badge ${stageBadge(applicant.stage)}`}>
                        {stageLabels[applicant.stage]}
                      </span>
                    </td>
                    <td className="px-6 py-3">
                      {applicant.reviews.length > 0 ? (
                        <div className="flex items-center text-sm">
                          <span className="text-gray-900 mr-1">★</span>
                          <span className="font-medium">{getAverageRating(applicant.reviews)}</span>
                        </div>
                      ) : (
                        <span className="text-gray-400 text-sm">—</span>
                      )}
                    </td>
                    <td className="px-6 py-3 text-xs text-gray-500">
                      {new Date(applicant.createdAt).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-3">
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
        <Pagination page={appPage} totalPages={appTotalPages} total={appTotal} pageSize={appPageSize} onPageChange={setAppPage} />
      </div>

      {/* Edit Event Modal */}
      {showEditModal && (
        <EventFormModal
          event={event}
          onClose={() => setShowEditModal(false)}
          onSaved={() => {
            setShowEditModal(false);
            fetchEvent();
          }}
        />
      )}

      {/* Manage Attendees Modal */}
      {showManageAttendees && (
        <ManageAttendeesModal
          eventId={event.id}
          currentAttendeeIds={event.attendees.map(a => a.user.id)}
          onClose={() => setShowManageAttendees(false)}
          onSaved={() => {
            setShowManageAttendees(false);
            fetchEvent();
          }}
        />
      )}
    </div>
  );
}

function IntakeForm({
  eventId,
  eventName,
  onApplicantAdded,
}: {
  eventId: string;
  eventName: string;
  onApplicantAdded: () => void;
}) {
  const firstNameRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [sessionCount, setSessionCount] = useState(0);
  const [successMessage, setSuccessMessage] = useState('');
  const [error, setError] = useState('');
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);

  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [portfolioUrl, setPortfolioUrl] = useState('');
  const [resumeFile, setResumeFile] = useState<File | null>(null);
  const [jobId, setJobId] = useState('');
  const [rating, setRating] = useState(0);
  const [recommendation, setRecommendation] = useState('');
  const [comments, setComments] = useState('');
  const [duplicateWarnings, setDuplicateWarnings] = useState<{ id: string; firstName: string; lastName: string; job: { title: string } | null; stage: string }[]>([]);

  useEffect(() => {
    api.get<Job[]>('/jobs?status=open').then(res => setJobs(res.data)).catch(() => {});
    firstNameRef.current?.focus();
  }, []);

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
    const err = validateField(field, value);
    setFieldErrors((prev) => {
      const next = { ...prev };
      if (err) next[field] = err;
      else delete next[field];
      return next;
    });
    if (field === 'email' && value && !err) {
      api.post<{ id: string; firstName: string; lastName: string; job: { title: string } | null; stage: string }[]>(
        '/applicants/check-duplicates', { email: value }
      ).then((res) => setDuplicateWarnings(res.data)).catch(() => setDuplicateWarnings([]));
    }
  };

  const resetForm = (keepJob = true) => {
    setFirstName('');
    setLastName('');
    setEmail('');
    setPhone('');
    setPortfolioUrl('');
    setResumeFile(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
    if (!keepJob) setJobId('');
    setRating(0);
    setRecommendation('');
    setComments('');
    setError('');
    setFieldErrors({});
    setDuplicateWarnings([]);
    setTimeout(() => firstNameRef.current?.focus(), 50);
  };

  const handleQRScan = (data: Partial<VCardData>) => {
    if (data.firstName) setFirstName(data.firstName);
    if (data.lastName) setLastName(data.lastName);
    if (data.email) setEmail(data.email);
    if (data.phone) setPhone(data.phone);
    if (data.portfolioUrl) setPortfolioUrl(data.portfolioUrl);
  };

  const handleSubmit = async (action: 'another' | 'done') => {
    if (!firstName || !lastName || !email || rating === 0) {
      setError('First name, last name, email, and rating are required');
      return;
    }
    const errors: Record<string, string> = {};
    const emailErr = validateField('email', email);
    if (emailErr) errors.email = emailErr;
    const phoneErr = validateField('phone', phone);
    if (phoneErr) errors.phone = phoneErr;
    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      return;
    }

    setSubmitting(true);
    setError('');
    setFieldErrors({});
    try {
      const fd = new FormData();
      fd.append('firstName', firstName);
      fd.append('lastName', lastName);
      fd.append('email', email);
      if (phone) fd.append('phone', phone);
      if (portfolioUrl) fd.append('portfolioUrl', portfolioUrl);
      if (jobId) fd.append('jobId', jobId);
      fd.append('rating', String(rating));
      if (recommendation) fd.append('recommendation', recommendation);
      if (comments) fd.append('comments', comments);
      fd.append('source', eventName);
      if (resumeFile) fd.append('resume', resumeFile);
      await api.upload(`/events/${eventId}/intake`, fd);

      setSessionCount(prev => prev + 1);
      onApplicantAdded();

      if (action === 'another') {
        setSuccessMessage(`${firstName} ${lastName} added successfully`);
        setTimeout(() => setSuccessMessage(''), 3000);
        resetForm(true);
      } else {
        resetForm(false);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add applicant');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="card border-2 border-gray-900">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-display font-semibold text-gray-900 uppercase tracking-wide">
          Fair Intake Form
        </h2>
        {sessionCount > 0 && (
          <span className="text-sm text-gray-500">
            {sessionCount} applicant{sessionCount !== 1 ? 's' : ''} added this session
          </span>
        )}
      </div>

      {successMessage && (
        <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-2 rounded text-sm mb-4">
          {successMessage}
        </div>
      )}

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-2 rounded text-sm mb-4">
          {error}
        </div>
      )}

      <QRScanner onScan={handleQRScan} />

      <div className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="label">First Name *</label>
            <input
              ref={firstNameRef}
              type="text"
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              className="input"
              required
            />
          </div>
          <div>
            <label className="label">Last Name *</label>
            <input
              type="text"
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
              className="input"
              required
            />
          </div>
          <div>
            <label className="label">Email *</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              onBlur={(e) => handleFieldBlur('email', e.target.value)}
              className={`input ${fieldErrors.email ? 'border-red-400' : ''}`}
              required
            />
            {fieldErrors.email && (
              <p className="text-red-600 text-xs mt-1">{fieldErrors.email}</p>
            )}
          </div>
        </div>

        {duplicateWarnings.length > 0 && (
          <div className="bg-yellow-50 border border-yellow-200 rounded p-3">
            <p className="text-sm font-medium text-yellow-800">
              Existing applications found for this email:
            </p>
            <ul className="mt-1 space-y-1">
              {duplicateWarnings.map((d) => (
                <li key={d.id} className="text-xs text-yellow-700">
                  {d.firstName} {d.lastName} — {d.job?.title || 'General Application'} ({d.stage})
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="label">Phone</label>
            <input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              onBlur={(e) => handleFieldBlur('phone', e.target.value)}
              className={`input ${fieldErrors.phone ? 'border-red-400' : ''}`}
            />
            {fieldErrors.phone && (
              <p className="text-red-600 text-xs mt-1">{fieldErrors.phone}</p>
            )}
          </div>
          <div>
            <label className="label">Portfolio URL</label>
            <input
              type="url"
              value={portfolioUrl}
              onChange={(e) => setPortfolioUrl(e.target.value)}
              className="input"
              placeholder="https://..."
            />
          </div>
          <div>
            <label className="label">Job Position</label>
            <select value={jobId} onChange={(e) => setJobId(e.target.value)} className="input">
              <option value="">General Interest</option>
              {jobs.map((job) => (
                <option key={job.id} value={job.id}>
                  {job.title} — {job.department}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="label">Overall Rating * (1-5)</label>
            <div className="flex gap-2">
              {[1, 2, 3, 4, 5].map((star) => (
                <button
                  key={star}
                  type="button"
                  onClick={() => setRating(star)}
                  className={`text-3xl transition-colors ${
                    star <= rating ? 'text-gray-900' : 'text-gray-300 hover:text-gray-500'
                  }`}
                >
                  ★
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="label">Recommendation</label>
            <select
              value={recommendation}
              onChange={(e) => setRecommendation(e.target.value)}
              className="input"
            >
              <option value="">— Select —</option>
              <option value="strong_yes">Strong Yes</option>
              <option value="yes">Yes</option>
              <option value="maybe">Maybe</option>
              <option value="no">No</option>
              <option value="strong_no">Strong No</option>
            </select>
          </div>
        </div>

        <div>
          <label className="label">Quick Notes</label>
          <textarea
            value={comments}
            onChange={(e) => setComments(e.target.value)}
            className="input min-h-[60px]"
            placeholder="First impressions, area of interest, notable skills..."
          />
        </div>

        {/* Resume Upload / Camera Capture */}
        <div>
          <label className="label">Resume</label>
          <div className="flex items-center gap-3">
            <div className="flex-1">
              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf,.doc,.docx,.jpg,.jpeg,.png"
                onChange={(e) => setResumeFile(e.target.files?.[0] || null)}
                className="input text-sm file:mr-3 file:py-1 file:px-3 file:rounded file:border-0 file:bg-gray-100 file:text-gray-700 file:font-medium file:cursor-pointer"
              />
            </div>
            <label className="btn btn-secondary text-sm cursor-pointer flex items-center gap-1.5 shrink-0">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              Camera
              <input
                type="file"
                accept="image/*"
                capture="environment"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) {
                    setResumeFile(file);
                    if (fileInputRef.current) fileInputRef.current.value = '';
                  }
                }}
              />
            </label>
          </div>
          {resumeFile && (
            <div className="flex items-center gap-2 mt-1.5">
              <span className="text-xs text-gray-500">{resumeFile.name}</span>
              <button
                type="button"
                onClick={() => { setResumeFile(null); if (fileInputRef.current) fileInputRef.current.value = ''; }}
                className="text-xs text-red-500 hover:text-red-700"
              >
                Remove
              </button>
            </div>
          )}
          <p className="text-xs text-gray-400 mt-1">PDF, DOC, DOCX, or photo (JPG/PNG)</p>
        </div>

        <div className="flex items-center gap-3 pt-2">
          <button
            onClick={() => handleSubmit('another')}
            disabled={submitting}
            className="btn btn-primary"
          >
            {submitting ? 'Saving...' : 'Save & Add Another'}
          </button>
          <button
            onClick={() => handleSubmit('done')}
            disabled={submitting}
            className="btn btn-secondary"
          >
            Save & Done
          </button>
        </div>
      </div>
    </div>
  );
}

function ManageAttendeesModal({
  eventId,
  currentAttendeeIds,
  onClose,
  onSaved,
}: {
  eventId: string;
  currentAttendeeIds: string[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const [users, setUsers] = useState<User[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set(currentAttendeeIds));
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    api.get<User[]>('/users')
      .then(res => {
        setUsers(res.data);
        setLoading(false);
      })
      .catch(() => {
        setError('Failed to load users');
        setLoading(false);
      });
  }, []);

  const toggleUser = (userId: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(userId)) next.delete(userId);
      else next.add(userId);
      return next;
    });
  };

  const handleSave = async () => {
    setSaving(true);
    setError('');
    try {
      await api.put(`/events/${eventId}/attendees`, {
        attendeeIds: Array.from(selectedIds),
      });
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg w-full max-w-md">
        <div className="border-b px-6 py-4 flex justify-between items-center">
          <h2 className="text-xl font-display font-bold uppercase tracking-wide">Manage Attendees</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="p-6 space-y-4">
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded text-sm">
              {error}
            </div>
          )}

          {loading ? (
            <div className="flex items-center justify-center h-20">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-black"></div>
            </div>
          ) : (
            <div className="border rounded divide-y max-h-[300px] overflow-y-auto">
              {users.map((u) => (
                <div key={u.id} className="flex items-center justify-between px-4 py-3">
                  <div className="flex items-center gap-3">
                    <input
                      type="checkbox"
                      checked={selectedIds.has(u.id)}
                      onChange={() => toggleUser(u.id)}
                      className="h-4 w-4 rounded border-gray-300"
                    />
                    <div>
                      <p className="text-sm font-medium text-gray-900">{u.name}</p>
                      <p className="text-xs text-gray-500">{u.email}</p>
                    </div>
                  </div>
                  <span className="text-xs text-gray-400 capitalize">{u.role.replace('_', ' ')}</span>
                </div>
              ))}
            </div>
          )}

          <div className="flex justify-end gap-3 pt-4">
            <button type="button" onClick={onClose} className="btn btn-secondary">Cancel</button>
            <button onClick={handleSave} disabled={saving} className="btn btn-primary">
              {saving ? 'Saving...' : 'Save'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
