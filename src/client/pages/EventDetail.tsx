import { useState, useEffect, useRef } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { api } from '../lib/api';
import { EventFormModal } from './Events';

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

  const canManage = currentUser?.role === 'admin' || currentUser?.role === 'hiring_manager';

  useEffect(() => {
    if (id) {
      fetchEvent();
      fetchApplicants();
    }
  }, [id]);

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
      const res = await api.get<Applicant[]>(`/applicants?eventId=${id}`);
      setApplicants(res.data);
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
            </div>
            <div className="flex items-center gap-4 text-sm text-gray-500">
              <span>{new Date(event.date).toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</span>
              {event.location && <span>{event.location}</span>}
            </div>
            {event.notes && (
              <p className="text-sm text-gray-600 mt-3">{event.notes}</p>
            )}
          </div>

          <div className="flex items-center gap-2">
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
                <div className="w-6 h-6 bg-gray-900 rounded-full flex items-center justify-center">
                  <span className="text-white text-xs font-medium">
                    {a.user.name.split(' ').map(n => n[0]).join('')}
                  </span>
                </div>
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
          Event Applicants ({applicants.length})
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
                        <div className="w-8 h-8 bg-gray-900 rounded-full flex items-center justify-center">
                          <span className="text-white text-xs font-medium">
                            {applicant.firstName[0]}{applicant.lastName[0]}
                          </span>
                        </div>
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
  const [jobs, setJobs] = useState<Job[]>([]);
  const [sessionCount, setSessionCount] = useState(0);
  const [successMessage, setSuccessMessage] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [jobId, setJobId] = useState('');
  const [rating, setRating] = useState(0);
  const [recommendation, setRecommendation] = useState('');
  const [comments, setComments] = useState('');

  useEffect(() => {
    api.get<Job[]>('/jobs?status=open').then(res => setJobs(res.data)).catch(() => {});
    firstNameRef.current?.focus();
  }, []);

  const resetForm = (keepJob = true) => {
    setFirstName('');
    setLastName('');
    setEmail('');
    setPhone('');
    if (!keepJob) setJobId('');
    setRating(0);
    setRecommendation('');
    setComments('');
    setError('');
    setTimeout(() => firstNameRef.current?.focus(), 50);
  };

  const handleSubmit = async (action: 'another' | 'done') => {
    if (!firstName || !lastName || !email || rating === 0) {
      setError('First name, last name, email, and rating are required');
      return;
    }

    setSubmitting(true);
    setError('');
    try {
      await api.post(`/events/${eventId}/intake`, {
        firstName,
        lastName,
        email,
        phone: phone || undefined,
        jobId: jobId || undefined,
        rating,
        recommendation: recommendation || undefined,
        comments: comments || undefined,
        source: eventName,
      });

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
              className="input"
              required
            />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="label">Phone</label>
            <input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="input"
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
