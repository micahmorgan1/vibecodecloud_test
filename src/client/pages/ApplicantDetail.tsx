import { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { api } from '../lib/api';
import { useAuth } from '../context/AuthContext';
import { isValidEmail, isValidPhone } from '../utils/validation';
import Avatar from '../components/Avatar';
import DocumentViewer from '../components/DocumentViewer';

interface Review {
  id: string;
  rating: number;
  technicalSkills: number | null;
  designAbility: number | null;
  portfolioQuality: number | null;
  communication: number | null;
  cultureFit: number | null;
  recommendation: string | null;
  comments: string | null;
  createdAt: string;
  reviewer: { id: string; name: string; email: string };
}

interface Note {
  id: string;
  content: string;
  createdAt: string;
}

interface InterviewParticipant {
  id: string;
  feedback: string | null;
  rating: number | null;
  user: { id: string; name: string; email: string };
}

interface Interview {
  id: string;
  scheduledAt: string;
  location: string | null;
  type: string;
  notes: string | null;
  notesUrl: string | null;
  status: string;
  feedback: string | null;
  outcome: string | null;
  createdAt: string;
  participants: InterviewParticipant[];
  createdBy: { id: string; name: string };
}

interface Offer {
  id: string;
  status: string;
  filePath: string | null;
  notes: string | null;
  salary: string | null;
  offerDate: string | null;
  acceptedDate: string | null;
  declinedDate: string | null;
  createdAt: string;
  updatedAt: string;
  createdBy: { id: string; name: string };
}

interface DuplicateApplicant {
  id: string;
  firstName: string;
  lastName: string;
  stage: string;
  createdAt: string;
  job: { id: string; title: string } | null;
}

interface ActivityLogEntry {
  id: string;
  action: string;
  metadata: string | null;
  createdAt: string;
  user: { id: string; name: string } | null;
}

interface Applicant {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string | null;
  linkedIn: string | null;
  website: string | null;
  resumePath: string | null;
  portfolioPath: string | null;
  portfolioUrl: string | null;
  coverLetter: string | null;
  stage: string;
  startDate: string | null;
  source: string | null;
  spam: boolean;
  spamReason: string | null;
  createdAt: string;
  job: { id: string; title: string; department: string; location: string } | null;
  event: { id: string; name: string } | null;
  reviews: Review[];
  notes: Note[];
  interviews: Interview[];
  offers: Offer[];
}

const stages = ['fair_intake', 'new', 'screening', 'interview', 'offer', 'hired', 'rejected', 'holding'];
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

export default function ApplicantDetail() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [applicant, setApplicant] = useState<Applicant | null>(null);
  const [loading, setLoading] = useState(true);
  const [showReviewModal, setShowReviewModal] = useState(false);
  const [showRejectionModal, setShowRejectionModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showRequestReviewModal, setShowRequestReviewModal] = useState(false);
  const [showAssignJobModal, setShowAssignJobModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [pendingStage, setPendingStage] = useState<string | null>(null);
  const [newNote, setNewNote] = useState('');
  const [addingNote, setAddingNote] = useState(false);
  const [viewingDocument, setViewingDocument] = useState<{ url: string; title: string } | null>(null);
  const [spamActionLoading, setSpamActionLoading] = useState(false);
  const [showConfirmSpamModal, setShowConfirmSpamModal] = useState(false);
  const [activityLogs, setActivityLogs] = useState<ActivityLogEntry[]>([]);
  const [duplicates, setDuplicates] = useState<DuplicateApplicant[]>([]);
  const [showScheduleInterviewModal, setShowScheduleInterviewModal] = useState(false);
  const [editingInterview, setEditingInterview] = useState<Interview | null>(null);
  const [feedbackInterview, setFeedbackInterview] = useState<Interview | null>(null);
  const [detailInterview, setDetailInterview] = useState<Interview | null>(null);
  const [showOfferModal, setShowOfferModal] = useState(false);
  const [editingOffer, setEditingOffer] = useState<Offer | null>(null);

  useEffect(() => {
    if (id) {
      fetchApplicant();
      fetchActivity();
      fetchDuplicates();
    }
  }, [id]);

  const fetchDuplicates = async () => {
    try {
      const res = await api.get<DuplicateApplicant[]>(`/applicants/${id}/duplicates`);
      setDuplicates(res.data);
    } catch {
      // Non-critical
    }
  };

  const fetchActivity = async () => {
    try {
      const res = await api.get<ActivityLogEntry[]>(`/applicants/${id}/activity`);
      setActivityLogs(res.data);
    } catch {
      // Non-critical — silently ignore
    }
  };

  const fetchApplicant = async () => {
    try {
      const res = await api.get<Applicant>(`/applicants/${id}`);
      setApplicant(res.data);
    } finally {
      setLoading(false);
    }
  };

  const getRejectionDate = (): string | null => {
    if (!applicant) return null;
    const note = applicant.notes.find((n) => n.content.startsWith('Rejection letter sent on '));
    if (!note) return null;
    return note.content.replace('Rejection letter sent on ', '');
  };

  const handleStageClick = (stage: string) => {
    if (!applicant) return;
    if (applicant.stage === 'rejected' && stage !== 'rejected' && getRejectionDate()) {
      setPendingStage(stage);
    } else {
      updateStage(stage);
    }
  };

  const updateStage = async (stage: string) => {
    if (!id) return;
    try {
      await api.patch(`/applicants/${id}/stage`, { stage });
      fetchApplicant();
    } catch (err) {
      console.error('Failed to update stage:', err);
    }
  };

  const addNote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!id || !newNote.trim()) return;
    setAddingNote(true);
    try {
      await api.post(`/applicants/${id}/notes`, { content: newNote });
      setNewNote('');
      fetchApplicant();
    } finally {
      setAddingNote(false);
    }
  };

  const deleteApplicant = async () => {
    if (!id) return;
    setDeleting(true);
    try {
      await api.delete(`/applicants/${id}`);
      navigate('/applicants');
    } catch (err) {
      console.error('Failed to delete applicant:', err);
      setDeleting(false);
      setShowDeleteModal(false);
    }
  };

  const markNotSpam = async () => {
    if (!id) return;
    setSpamActionLoading(true);
    try {
      const res = await api.patch<Applicant>(`/applicants/${id}/mark-not-spam`);
      setApplicant(res.data);
    } catch (err) {
      console.error('Failed to mark as not spam:', err);
    } finally {
      setSpamActionLoading(false);
    }
  };

  const markAsSpam = async () => {
    if (!id) return;
    setSpamActionLoading(true);
    try {
      const res = await api.patch<Applicant>(`/applicants/${id}/mark-spam`);
      setApplicant(res.data);
    } catch (err) {
      console.error('Failed to mark as spam:', err);
    } finally {
      setSpamActionLoading(false);
    }
  };

  const canDelete = user?.role === 'admin' || user?.role === 'hiring_manager';

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-black dark:border-white"></div>
      </div>
    );
  }

  if (!applicant) {
    return (
      <div className="card text-center py-12">
        <p className="text-neutral-500 dark:text-neutral-400">Applicant not found</p>
        <Link to="/applicants" className="btn btn-primary mt-4">
          Back to Applicants
        </Link>
      </div>
    );
  }

  const getAverageRating = () => {
    if (applicant.reviews.length === 0) return null;
    const avg = applicant.reviews.reduce((sum, r) => sum + r.rating, 0) / applicant.reviews.length;
    return avg.toFixed(1);
  };

  const myReview = applicant.reviews.find((r) => r.reviewer.id === user?.id);

  const recommendationLabels: Record<string, { label: string; color: string }> = {
    strong_yes: { label: 'Strong Yes', color: 'text-neutral-900 dark:text-neutral-100 font-bold' },
    yes: { label: 'Yes', color: 'text-neutral-800 dark:text-neutral-300' },
    maybe: { label: 'Maybe', color: 'text-neutral-500 dark:text-neutral-400' },
    no: { label: 'No', color: 'text-neutral-400 dark:text-neutral-500' },
    strong_no: { label: 'Strong No', color: 'text-neutral-400 dark:text-neutral-500 line-through' },
  };

  return (
    <div className="space-y-6">
      {/* Breadcrumb */}
      <nav className="text-sm text-neutral-500 dark:text-neutral-400">
        <Link to="/applicants" className="hover:text-neutral-900 dark:hover:text-neutral-100">Applicants</Link>
        <span className="mx-2">/</span>
        <span className="text-neutral-900 dark:text-neutral-100">{applicant.firstName} {applicant.lastName}</span>
      </nav>

      {/* Spam Banner */}
      {applicant.spam && canDelete && (
        <div className="bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-lg p-4">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="font-medium text-red-800 dark:text-red-200">This applicant was flagged as spam</p>
              {applicant.spamReason && (
                <p className="text-sm text-red-600 dark:text-red-400 mt-1">Reason: {applicant.spamReason}</p>
              )}
            </div>
            <div className="flex gap-2 shrink-0">
              <button
                onClick={markNotSpam}
                disabled={spamActionLoading}
                className="px-3 py-1.5 bg-white dark:bg-neutral-700 border border-neutral-300 dark:border-neutral-600 rounded text-sm font-medium text-neutral-700 dark:text-neutral-300 hover:bg-neutral-50 dark:hover:bg-neutral-600 transition-colors"
              >
                {spamActionLoading ? 'Updating...' : 'Not Spam'}
              </button>
              <button
                onClick={() => setShowConfirmSpamModal(true)}
                disabled={spamActionLoading}
                className="px-3 py-1.5 bg-red-600 text-white rounded text-sm font-medium hover:bg-red-700 transition-colors"
              >
                Confirm Spam
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="card">
        <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
          <div className="flex items-start gap-4">
            <Avatar name={`${applicant.firstName} ${applicant.lastName}`} email={applicant.email} size={64} />
            <div>
              <h1 className="text-2xl font-display font-bold text-neutral-900 dark:text-neutral-100 uppercase tracking-wide">
                {applicant.firstName} {applicant.lastName}
              </h1>
              <p className="text-neutral-500 dark:text-neutral-400">{applicant.email}</p>
              {applicant.phone && <p className="text-neutral-400 dark:text-neutral-500 text-sm">{applicant.phone}</p>}
              <div className="flex items-center gap-3 mt-2">
                {applicant.linkedIn && (
                  <a href={`https://${applicant.linkedIn}`} target="_blank" rel="noopener noreferrer" className="text-neutral-900 dark:text-neutral-100 hover:text-neutral-600 dark:hover:text-neutral-400 text-sm font-medium">
                    LinkedIn
                  </a>
                )}
                {applicant.website && (
                  <a href={`https://${applicant.website}`} target="_blank" rel="noopener noreferrer" className="text-neutral-900 dark:text-neutral-100 hover:text-neutral-600 dark:hover:text-neutral-400 text-sm font-medium">
                    Website
                  </a>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {getAverageRating() && (
              <div className="flex items-center gap-1 mr-2">
                <span className="text-neutral-900 dark:text-neutral-100 text-xl">★</span>
                <span className="text-2xl font-display font-bold">{getAverageRating()}</span>
                <span className="text-neutral-400 dark:text-neutral-500 text-sm">({applicant.reviews.length})</span>
              </div>
            )}
            <button
              onClick={() => setShowReviewModal(true)}
              className="btn btn-primary"
            >
              {myReview ? 'Edit My Review' : 'Add Review'}
            </button>
          </div>
        </div>

        {/* Stage Pipeline */}
        <div className="mt-6 pt-6 border-t border-neutral-200 dark:border-neutral-700">
          <p className="text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-3">Application Stage</p>
          <div className="flex flex-wrap gap-2">
            {stages.map((stage) => (
              <button
                key={stage}
                onClick={() => handleStageClick(stage)}
                className={`px-4 py-2 rounded text-sm font-medium transition-colors ${
                  applicant.stage === stage
                    ? stage === 'rejected'
                      ? 'bg-red-500 text-white'
                      : stage === 'hired'
                      ? 'bg-black text-white'
                      : stage === 'fair_intake'
                      ? 'bg-teal-600 text-white'
                      : stage === 'holding'
                      ? 'bg-yellow-500 text-white'
                      : 'bg-neutral-900 text-white dark:bg-neutral-100 dark:text-neutral-900'
                    : 'bg-neutral-100 dark:bg-neutral-700 text-neutral-700 dark:text-neutral-300 hover:bg-neutral-200 dark:hover:bg-neutral-600'
                }`}
              >
                {stageLabels[stage]}
              </button>
            ))}
          </div>
        </div>

        {/* Actions */}
        <div className="mt-6 pt-6 border-t border-neutral-200 dark:border-neutral-700 flex flex-wrap gap-2">
          {applicant.stage !== 'rejected' && applicant.stage !== 'hired' && (
            <button
              onClick={() => setShowRejectionModal(true)}
              className="btn btn-secondary text-sm"
            >
              Send Rejection Letter
            </button>
          )}
          {(user?.role === 'admin' || user?.role === 'hiring_manager' || (user?.role === 'reviewer' && applicant.event)) && (
            <button
              onClick={() => setShowEditModal(true)}
              className="btn btn-secondary text-sm"
            >
              Edit Details
            </button>
          )}
          {(user?.role === 'admin' || user?.role === 'hiring_manager') && (
            <>
              <button
                onClick={() => setShowAssignJobModal(true)}
                className="btn btn-secondary text-sm"
              >
                {applicant.job ? 'Reassign Job' : 'Assign to Job'}
              </button>
              <button
                onClick={() => setShowRequestReviewModal(true)}
                className="btn btn-secondary text-sm"
              >
                Request Review
              </button>
            </>
          )}
          {canDelete && !applicant.spam && (
            <button
              onClick={markAsSpam}
              disabled={spamActionLoading}
              className="btn btn-secondary text-sm"
            >
              {spamActionLoading ? 'Marking...' : 'Mark as Spam'}
            </button>
          )}
          {canDelete && (
            <button
              onClick={() => setShowDeleteModal(true)}
              className="btn btn-secondary text-sm text-red-600 dark:text-red-400 hover:text-red-700"
            >
              Delete Applicant
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Application Info */}
          <div className="card">
            <h2 className="text-lg font-display font-semibold text-neutral-900 dark:text-neutral-100 mb-4 uppercase tracking-wide">Application Details</h2>
            <dl className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <dt className="text-sm text-neutral-500 dark:text-neutral-400">Position</dt>
                <dd className="font-medium">
                  {applicant.job ? (
                    <Link to={`/jobs/${applicant.job.id}`} className="text-neutral-900 dark:text-neutral-100 hover:text-neutral-600 dark:hover:text-neutral-400">
                      {applicant.job.title}
                    </Link>
                  ) : (
                    <span className="text-neutral-500 dark:text-neutral-400 italic">General Application</span>
                  )}
                </dd>
              </div>
              <div>
                <dt className="text-sm text-neutral-500 dark:text-neutral-400">Department</dt>
                <dd className="font-medium">{applicant.job?.department || '—'}</dd>
              </div>
              {applicant.event && (
                <div>
                  <dt className="text-sm text-neutral-500 dark:text-neutral-400">Event</dt>
                  <dd className="font-medium">
                    <Link to={`/events/${applicant.event.id}`} className="text-neutral-900 dark:text-neutral-100 hover:text-neutral-600 dark:hover:text-neutral-400">
                      {applicant.event.name}
                    </Link>
                  </dd>
                </div>
              )}
              {applicant.source && (
                <div>
                  <dt className="text-sm text-neutral-500 dark:text-neutral-400">Source</dt>
                  <dd className="font-medium">{applicant.source}</dd>
                </div>
              )}
              <div>
                <dt className="text-sm text-neutral-500 dark:text-neutral-400">Applied On</dt>
                <dd className="font-medium">{new Date(applicant.createdAt).toLocaleDateString()}</dd>
              </div>
            </dl>

            {/* Documents */}
            <div className="mt-6 pt-6 border-t border-neutral-200 dark:border-neutral-700">
              <h3 className="text-sm font-medium text-neutral-900 dark:text-neutral-100 mb-3">Documents</h3>
              <div className="flex flex-wrap gap-3">
                {applicant.resumePath && (
                  <button
                    onClick={() => setViewingDocument({ url: applicant.resumePath!, title: `Resume - ${applicant.firstName} ${applicant.lastName}` })}
                    className="flex items-center gap-2 px-4 py-2 bg-neutral-900 text-white rounded hover:bg-neutral-700 transition-colors dark:bg-neutral-100 dark:text-neutral-900 dark:hover:bg-neutral-300"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                    View Resume
                  </button>
                )}
                {applicant.portfolioPath && (
                  <button
                    onClick={() => setViewingDocument({ url: applicant.portfolioPath!, title: `Portfolio - ${applicant.firstName} ${applicant.lastName}` })}
                    className="flex items-center gap-2 px-4 py-2 bg-neutral-900 text-white rounded hover:bg-neutral-700 transition-colors dark:bg-neutral-100 dark:text-neutral-900 dark:hover:bg-neutral-300"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                    View Portfolio
                  </button>
                )}
                {applicant.portfolioUrl && (
                  <a
                    href={applicant.portfolioUrl.startsWith('http') ? applicant.portfolioUrl : `https://${applicant.portfolioUrl}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 px-4 py-2 bg-neutral-100 dark:bg-neutral-700 rounded hover:bg-neutral-200 dark:hover:bg-neutral-600 transition-colors"
                  >
                    <svg className="w-5 h-5 text-neutral-600 dark:text-neutral-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                    </svg>
                    Online Portfolio
                  </a>
                )}
              </div>
            </div>

            {/* Cover Letter */}
            {applicant.coverLetter && (
              <div className="mt-6 pt-6 border-t border-neutral-200 dark:border-neutral-700">
                <h3 className="text-sm font-medium text-neutral-900 dark:text-neutral-100 mb-3">Cover Letter</h3>
                <p className="text-neutral-600 dark:text-neutral-400 whitespace-pre-wrap">{applicant.coverLetter}</p>
              </div>
            )}
          </div>

          {/* Start Date — shown when hired */}
          {applicant.stage === 'hired' && (user?.role === 'admin' || user?.role === 'hiring_manager') && (
            <div className="card bg-green-50 dark:bg-green-900/30 border border-green-200 dark:border-green-800">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-display font-semibold text-neutral-900 dark:text-neutral-100 uppercase tracking-wide">Start Date</h2>
                  {applicant.startDate ? (
                    <p className="text-green-800 dark:text-green-200 font-medium mt-1">
                      {new Date(applicant.startDate).toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                    </p>
                  ) : (
                    <p className="text-neutral-500 dark:text-neutral-400 text-sm mt-1">No start date set</p>
                  )}
                </div>
                <StartDatePicker
                  applicantId={applicant.id}
                  currentDate={applicant.startDate}
                  onSaved={fetchApplicant}
                />
              </div>
            </div>
          )}

          {/* Interviews */}
          <div className="card">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-display font-semibold text-neutral-900 dark:text-neutral-100 uppercase tracking-wide">
                Interviews ({applicant.interviews?.length || 0})
              </h2>
              {(user?.role === 'admin' || user?.role === 'hiring_manager') && (
                <button
                  onClick={() => setShowScheduleInterviewModal(true)}
                  className="btn btn-primary text-sm"
                >
                  Schedule Interview
                </button>
              )}
            </div>
            {(!applicant.interviews || applicant.interviews.length === 0) ? (
              <p className="text-neutral-500 dark:text-neutral-400 text-center py-4">No interviews scheduled</p>
            ) : (
              <div className="space-y-3">
                {applicant.interviews.map((interview) => {
                  const isParticipant = interview.participants.some(p => p.user.id === user?.id);
                  const myParticipant = interview.participants.find(p => p.user.id === user?.id);
                  const typeLabel: Record<string, string> = { in_person: 'In Person', video: 'Video', phone: 'Phone' };
                  const statusColors: Record<string, string> = {
                    scheduled: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
                    completed: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
                    cancelled: 'bg-neutral-100 text-neutral-500 dark:bg-neutral-700 dark:text-neutral-400',
                    no_show: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
                  };
                  const outcomeColors: Record<string, string> = {
                    advance: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
                    hold: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200',
                    reject: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
                  };
                  return (
                    <div key={interview.id} className="p-4 bg-neutral-50 dark:bg-neutral-700 rounded border border-neutral-100 dark:border-neutral-600">
                      <div className="flex items-start justify-between mb-2">
                        <div>
                          <p className="font-medium text-neutral-900 dark:text-neutral-100">
                            {new Date(interview.scheduledAt).toLocaleString(undefined, {
                              dateStyle: 'medium',
                              timeStyle: 'short',
                            })}
                          </p>
                          <div className="flex items-center gap-2 mt-1">
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-neutral-200 dark:bg-neutral-600 text-neutral-700 dark:text-neutral-300">
                              {typeLabel[interview.type] || interview.type}
                            </span>
                            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${statusColors[interview.status] || 'bg-neutral-100 dark:bg-neutral-700 text-neutral-700 dark:text-neutral-300'}`}>
                              {interview.status.replace('_', ' ')}
                            </span>
                            {interview.outcome && (
                              <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${outcomeColors[interview.outcome] || 'bg-neutral-100 dark:bg-neutral-700 text-neutral-700 dark:text-neutral-300'}`}>
                                {interview.outcome}
                              </span>
                            )}
                          </div>
                        </div>
                        <div className="flex gap-1">
                          {interview.status === 'scheduled' && (
                            <Link
                              to={`/interviews/${interview.id}/live`}
                              className="text-xs px-2 py-1 bg-neutral-900 text-white rounded hover:bg-neutral-700 transition-colors dark:bg-neutral-100 dark:text-neutral-900 dark:hover:bg-neutral-300"
                            >
                              Live Notes
                            </Link>
                          )}
                          {isParticipant && (interview.status === 'scheduled' || interview.status === 'completed') && !myParticipant?.feedback && (
                            <button
                              onClick={() => setFeedbackInterview(interview)}
                              className="text-xs px-2 py-1 bg-neutral-900 text-white rounded hover:bg-neutral-700 transition-colors dark:bg-neutral-100 dark:text-neutral-900 dark:hover:bg-neutral-300"
                            >
                              Add Feedback
                            </button>
                          )}
                          {(user?.role === 'admin' || user?.role === 'hiring_manager') && interview.status !== 'cancelled' && (
                            <button
                              onClick={() => setEditingInterview(interview)}
                              className="text-xs px-2 py-1 bg-neutral-100 dark:bg-neutral-600 text-neutral-700 dark:text-neutral-300 rounded hover:bg-neutral-200 dark:hover:bg-neutral-500 transition-colors"
                            >
                              Edit
                            </button>
                          )}
                          <button
                            onClick={() => setDetailInterview(interview)}
                            className="text-xs px-2 py-1 bg-neutral-100 dark:bg-neutral-600 text-neutral-700 dark:text-neutral-300 rounded hover:bg-neutral-200 dark:hover:bg-neutral-500 transition-colors"
                          >
                            Details
                          </button>
                        </div>
                      </div>
                      {interview.location && (
                        <p className="text-sm text-neutral-500 dark:text-neutral-400">{interview.location}</p>
                      )}
                      <p className="text-xs text-neutral-400 dark:text-neutral-500 mt-1">
                        Participants: {interview.participants.map(p => p.user.name).join(', ')}
                      </p>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Offers — hidden for reviewers and HMs without offerAccess */}
          {(user?.role === 'admin' || (user?.role === 'hiring_manager' && user?.offerAccess)) && (
            <div className="card">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-display font-semibold text-neutral-900 dark:text-neutral-100 uppercase tracking-wide">
                  Offers ({applicant.offers?.length || 0})
                </h2>
                <button
                  onClick={() => { setEditingOffer(null); setShowOfferModal(true); }}
                  className="btn btn-primary text-sm"
                >
                  Create Offer
                </button>
              </div>
              {(!applicant.offers || applicant.offers.length === 0) ? (
                <p className="text-neutral-500 dark:text-neutral-400 text-center py-4">No offers yet</p>
              ) : (
                <div className="space-y-3">
                  {applicant.offers.map((offer) => {
                    const statusColors: Record<string, string> = {
                      draft: 'bg-neutral-100 text-neutral-700 dark:bg-neutral-700 dark:text-neutral-300',
                      extended: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200',
                      accepted: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
                      declined: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
                      rescinded: 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200',
                    };
                    return (
                      <div key={offer.id} className="p-4 bg-neutral-50 dark:bg-neutral-700 rounded border border-neutral-100 dark:border-neutral-600">
                        <div className="flex items-start justify-between mb-2">
                          <div>
                            <div className="flex items-center gap-2">
                              <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${statusColors[offer.status] || 'bg-neutral-100 dark:bg-neutral-700 text-neutral-700 dark:text-neutral-300'}`}>
                                {offer.status}
                              </span>
                              {offer.salary && (
                                <span className="text-sm text-neutral-600 dark:text-neutral-400">{offer.salary}</span>
                              )}
                              {offer.offerDate && (
                                <span className="text-xs text-neutral-500 dark:text-neutral-400">
                                  Offered {new Date(offer.offerDate).toLocaleDateString()}
                                </span>
                              )}
                              {offer.acceptedDate && (
                                <span className="text-xs text-green-600 dark:text-green-400">
                                  Accepted {new Date(offer.acceptedDate).toLocaleDateString()}
                                </span>
                              )}
                              {offer.declinedDate && (
                                <span className="text-xs text-red-600 dark:text-red-400">
                                  Declined {new Date(offer.declinedDate).toLocaleDateString()}
                                </span>
                              )}
                            </div>
                            <p className="text-xs text-neutral-400 dark:text-neutral-500 mt-1">
                              Created by {offer.createdBy.name} on {new Date(offer.createdAt).toLocaleDateString()}
                            </p>
                          </div>
                          <div className="flex gap-1">
                            {offer.filePath && (
                              <a
                                href={offer.filePath}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-xs px-2 py-1 bg-neutral-100 dark:bg-neutral-600 text-neutral-700 dark:text-neutral-300 rounded hover:bg-neutral-200 dark:hover:bg-neutral-500 transition-colors"
                              >
                                Download
                              </a>
                            )}
                            <button
                              onClick={() => { setEditingOffer(offer); setShowOfferModal(true); }}
                              className="text-xs px-2 py-1 bg-neutral-100 dark:bg-neutral-600 text-neutral-700 dark:text-neutral-300 rounded hover:bg-neutral-200 dark:hover:bg-neutral-500 transition-colors"
                            >
                              Edit
                            </button>
                          </div>
                        </div>
                        {offer.notes && (
                          <div className="text-sm text-neutral-600 dark:text-neutral-400 mt-2" dangerouslySetInnerHTML={{ __html: offer.notes }} />
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* Reviews */}
          <div className="card">
            <h2 className="text-lg font-display font-semibold text-neutral-900 dark:text-neutral-100 mb-4 uppercase tracking-wide">
              Reviews ({applicant.reviews.length})
            </h2>
            {applicant.reviews.length === 0 ? (
              <p className="text-neutral-500 dark:text-neutral-400 text-center py-4">No reviews yet</p>
            ) : (
              <div className="space-y-4">
                {applicant.reviews.map((review) => (
                  <div key={review.id} className="p-4 bg-neutral-50 dark:bg-neutral-700 rounded border border-neutral-100 dark:border-neutral-600">
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <p className="font-medium text-neutral-900 dark:text-neutral-100">{review.reviewer.name}</p>
                        <p className="text-xs text-neutral-500 dark:text-neutral-400">
                          {new Date(review.createdAt).toLocaleDateString()}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="flex">
                          {[1, 2, 3, 4, 5].map((star) => (
                            <span
                              key={star}
                              className={`text-lg ${
                                star <= review.rating ? 'text-neutral-900 dark:text-neutral-100' : 'text-neutral-300 dark:text-neutral-600'
                              }`}
                            >
                              ★
                            </span>
                          ))}
                        </div>
                        {review.recommendation && (
                          <span className={`text-sm font-medium ${recommendationLabels[review.recommendation]?.color}`}>
                            {recommendationLabels[review.recommendation]?.label}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Criteria Ratings */}
                    <div className="grid grid-cols-2 md:grid-cols-5 gap-2 mb-3">
                      {review.technicalSkills && (
                        <div className="text-center p-2 bg-white dark:bg-neutral-800 rounded border border-neutral-100 dark:border-neutral-600">
                          <p className="text-xs text-neutral-500 dark:text-neutral-400">Technical</p>
                          <p className="font-medium">{review.technicalSkills}/5</p>
                        </div>
                      )}
                      {review.designAbility && (
                        <div className="text-center p-2 bg-white dark:bg-neutral-800 rounded border border-neutral-100 dark:border-neutral-600">
                          <p className="text-xs text-neutral-500 dark:text-neutral-400">Design</p>
                          <p className="font-medium">{review.designAbility}/5</p>
                        </div>
                      )}
                      {review.portfolioQuality && (
                        <div className="text-center p-2 bg-white dark:bg-neutral-800 rounded border border-neutral-100 dark:border-neutral-600">
                          <p className="text-xs text-neutral-500 dark:text-neutral-400">Portfolio</p>
                          <p className="font-medium">{review.portfolioQuality}/5</p>
                        </div>
                      )}
                      {review.communication && (
                        <div className="text-center p-2 bg-white dark:bg-neutral-800 rounded border border-neutral-100 dark:border-neutral-600">
                          <p className="text-xs text-neutral-500 dark:text-neutral-400">Communication</p>
                          <p className="font-medium">{review.communication}/5</p>
                        </div>
                      )}
                      {review.cultureFit && (
                        <div className="text-center p-2 bg-white dark:bg-neutral-800 rounded border border-neutral-100 dark:border-neutral-600">
                          <p className="text-xs text-neutral-500 dark:text-neutral-400">Culture Fit</p>
                          <p className="font-medium">{review.cultureFit}/5</p>
                        </div>
                      )}
                    </div>

                    {review.comments && (
                      <p className="text-neutral-600 dark:text-neutral-400 text-sm">{review.comments}</p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Sidebar - Duplicates + Notes + Activity */}
        <div className="space-y-6">
          {/* Other Applications (duplicates) */}
          {duplicates.length > 0 && (
            <div className="card">
              <h2 className="text-lg font-display font-semibold text-neutral-900 dark:text-neutral-100 mb-4 uppercase tracking-wide">
                Other Applications ({duplicates.length})
              </h2>
              <div className="space-y-2">
                {duplicates.map((dup) => (
                  <Link
                    key={dup.id}
                    to={`/applicants/${dup.id}`}
                    className="block p-3 bg-neutral-50 dark:bg-neutral-700 rounded border border-neutral-100 dark:border-neutral-600 hover:bg-neutral-100 dark:hover:bg-neutral-600 transition-colors"
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-neutral-900 dark:text-neutral-100">
                          {dup.job?.title || <span className="italic text-neutral-500 dark:text-neutral-400">General Application</span>}
                        </p>
                        <p className="text-xs text-neutral-500 dark:text-neutral-400">{new Date(dup.createdAt).toLocaleDateString()}</p>
                      </div>
                      <span className={`badge ${
                        dup.stage === 'hired' ? 'badge-hired' :
                        dup.stage === 'rejected' ? 'badge-rejected' :
                        dup.stage === 'new' ? 'badge-new' :
                        `badge-${dup.stage}`
                      }`}>
                        {stageLabels[dup.stage] || dup.stage}
                      </span>
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          )}

          <div className="card">
            <h2 className="text-lg font-display font-semibold text-neutral-900 dark:text-neutral-100 mb-4 uppercase tracking-wide">Notes</h2>

            <form onSubmit={addNote} className="mb-4">
              <textarea
                value={newNote}
                onChange={(e) => setNewNote(e.target.value)}
                placeholder="Add a note..."
                className="input min-h-[80px] mb-2"
              />
              <button
                type="submit"
                disabled={addingNote || !newNote.trim()}
                className="btn btn-primary w-full"
              >
                {addingNote ? 'Adding...' : 'Add Note'}
              </button>
            </form>

            {applicant.notes.length === 0 ? (
              <p className="text-neutral-500 dark:text-neutral-400 text-center py-4">No notes yet</p>
            ) : (
              <div className="space-y-3">
                {applicant.notes.map((note) => (
                  <div key={note.id} className="p-3 bg-neutral-50 dark:bg-neutral-700 rounded border border-neutral-100 dark:border-neutral-600">
                    <p className="text-sm text-neutral-600 dark:text-neutral-400">{note.content}</p>
                    <p className="text-xs text-neutral-400 dark:text-neutral-500 mt-2">
                      {new Date(note.createdAt).toLocaleString()}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Activity Timeline */}
          {activityLogs.length > 0 && (
            <div className="card">
              <h2 className="text-lg font-display font-semibold text-neutral-900 dark:text-neutral-100 mb-4 uppercase tracking-wide">Activity</h2>
              <div className="space-y-0">
                {activityLogs.map((log, i) => {
                  const meta = log.metadata ? JSON.parse(log.metadata) : {};
                  return (
                    <div key={log.id} className="flex gap-3">
                      <div className="flex flex-col items-center">
                        <div className="w-2 h-2 rounded-full bg-neutral-400 dark:bg-neutral-500 mt-1.5 shrink-0" />
                        {i < activityLogs.length - 1 && <div className="w-px flex-1 bg-neutral-200 dark:bg-neutral-700 my-1" />}
                      </div>
                      <div className="pb-4 min-w-0">
                        <p className="text-sm text-neutral-600 dark:text-neutral-400">{formatActivityMessage(log.action, meta)}</p>
                        <p className="text-xs text-neutral-400 dark:text-neutral-500 mt-0.5">
                          {log.user?.name && <span>{log.user.name} &middot; </span>}
                          {formatRelativeTime(log.createdAt)}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Review Modal */}
      {showReviewModal && (
        <ReviewModal
          applicantId={applicant.id}
          existingReview={myReview}
          onClose={() => setShowReviewModal(false)}
          onSaved={() => {
            setShowReviewModal(false);
            fetchApplicant();
          }}
        />
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-neutral-800 rounded max-w-md w-full">
            <div className="p-6 border-b border-neutral-200 dark:border-neutral-700">
              <h2 className="text-xl font-display font-semibold uppercase tracking-wide">
                Delete Applicant
              </h2>
            </div>
            <div className="p-6 space-y-4">
              <p className="text-neutral-700 dark:text-neutral-300">
                Are you sure you want to delete <span className="font-medium">{applicant.firstName} {applicant.lastName}</span>?
                This will permanently remove their application, reviews, and notes.
              </p>
              <div className="flex justify-end gap-3 pt-4">
                <button
                  onClick={() => setShowDeleteModal(false)}
                  disabled={deleting}
                  className="btn btn-secondary"
                >
                  Cancel
                </button>
                <button
                  onClick={deleteApplicant}
                  disabled={deleting}
                  className="btn btn-primary bg-red-600 hover:bg-red-700 border-red-600"
                >
                  {deleting ? 'Deleting...' : 'Yes, Delete'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Un-reject Confirmation Modal */}
      {pendingStage && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-neutral-800 rounded max-w-md w-full">
            <div className="p-6 border-b border-neutral-200 dark:border-neutral-700">
              <h2 className="text-xl font-display font-semibold uppercase tracking-wide">
                Un-reject Applicant?
              </h2>
            </div>
            <div className="p-6 space-y-4">
              <p className="text-neutral-700 dark:text-neutral-300">
                A rejection letter was sent to <span className="font-medium">{applicant.firstName} {applicant.lastName}</span> on{' '}
                <span className="font-medium">{getRejectionDate()}</span>.
              </p>
              <p className="text-neutral-700 dark:text-neutral-300">
                Are you sure you want to move this applicant to <span className="font-medium">{stageLabels[pendingStage]}</span>?
              </p>
              <div className="flex justify-end gap-3 pt-4">
                <button
                  onClick={() => setPendingStage(null)}
                  className="btn btn-secondary"
                >
                  Cancel
                </button>
                <button
                  onClick={() => {
                    updateStage(pendingStage);
                    setPendingStage(null);
                  }}
                  className="btn btn-primary"
                >
                  Yes, Un-reject
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Rejection Modal */}
      {showRejectionModal && (
        <RejectionModal
          applicant={applicant}
          onClose={() => setShowRejectionModal(false)}
          onSent={(updated) => {
            setShowRejectionModal(false);
            setApplicant(updated);
          }}
        />
      )}

      {/* Assign Job Modal */}
      {showAssignJobModal && (
        <AssignJobModal
          applicant={applicant}
          onClose={() => setShowAssignJobModal(false)}
          onAssigned={(updated) => {
            setShowAssignJobModal(false);
            setApplicant(updated);
          }}
        />
      )}

      {/* Request Review Modal */}
      {showRequestReviewModal && (
        <RequestReviewModal
          applicant={applicant}
          onClose={() => setShowRequestReviewModal(false)}
          onSent={() => {
            setShowRequestReviewModal(false);
            fetchApplicant();
          }}
        />
      )}

      {/* Edit Details Modal */}
      {showEditModal && (
        <EditApplicantModal
          applicant={applicant}
          onClose={() => setShowEditModal(false)}
          onSaved={(updated) => {
            setShowEditModal(false);
            setApplicant(updated);
          }}
        />
      )}

      {/* Confirm Spam Modal */}
      {showConfirmSpamModal && applicant && (
        <ConfirmSpamModal
          applicant={applicant}
          onClose={() => setShowConfirmSpamModal(false)}
          onConfirmed={(updated) => {
            setShowConfirmSpamModal(false);
            setApplicant(updated);
          }}
        />
      )}

      {/* Schedule Interview Modal */}
      {(showScheduleInterviewModal || editingInterview) && (
        <ScheduleInterviewModal
          applicantId={applicant.id}
          existingInterview={editingInterview || undefined}
          onClose={() => {
            setShowScheduleInterviewModal(false);
            setEditingInterview(null);
          }}
          onSaved={() => {
            setShowScheduleInterviewModal(false);
            setEditingInterview(null);
            fetchApplicant();
            fetchActivity();
          }}
        />
      )}

      {/* Interview Feedback Modal */}
      {feedbackInterview && (
        <InterviewFeedbackModal
          interview={feedbackInterview}
          onClose={() => setFeedbackInterview(null)}
          onSaved={() => {
            setFeedbackInterview(null);
            fetchApplicant();
            fetchActivity();
          }}
        />
      )}

      {/* Interview Detail Modal */}
      {detailInterview && (
        <InterviewDetailModal
          interview={detailInterview}
          onClose={() => setDetailInterview(null)}
        />
      )}

      {/* Offer Modal */}
      {showOfferModal && (
        <OfferModal
          applicantId={applicant.id}
          existingOffer={editingOffer || undefined}
          onClose={() => { setShowOfferModal(false); setEditingOffer(null); }}
          onSaved={() => {
            setShowOfferModal(false);
            setEditingOffer(null);
            fetchApplicant();
            fetchActivity();
          }}
        />
      )}

      {/* Document Viewer */}
      {viewingDocument && (
        <DocumentViewer
          url={viewingDocument.url}
          title={viewingDocument.title}
          onClose={() => setViewingDocument(null)}
        />
      )}
    </div>
  );
}

const stageLabelsMap: Record<string, string> = {
  fair_intake: 'Fair Intake', new: 'New', screening: 'Screening', interview: 'Interview',
  offer: 'Offer', hired: 'Hired', rejected: 'Rejected', holding: 'Holding',
};

function formatActivityMessage(action: string, meta: Record<string, unknown>): string {
  switch (action) {
    case 'applicant_created': {
      const src = meta.source === 'public' ? 'Applied online' : meta.source === 'event_intake' ? 'Added via event intake' : 'Manually added';
      return src;
    }
    case 'stage_changed':
      return `Stage changed from ${stageLabelsMap[meta.from as string] || meta.from} to ${stageLabelsMap[meta.to as string] || meta.to}`;
    case 'applicant_updated':
      return 'Details updated';
    case 'job_assigned':
      return 'Job assignment changed';
    case 'marked_spam':
      return 'Flagged as spam';
    case 'unmarked_spam':
      return 'Removed from spam';
    case 'spam_confirmed':
      return 'Confirmed as spam';
    case 'note_added':
      return 'Note added';
    case 'review_added':
      return `Review added (${meta.rating}/5)`;
    case 'interview_scheduled':
      return `Interview scheduled (${meta.type ? String(meta.type).replace('_', ' ') : 'interview'})`;
    case 'interview_status_changed':
      return `Interview status changed from ${meta.from} to ${meta.to}`;
    case 'interview_cancelled':
      return 'Interview cancelled';
    case 'interview_feedback_added':
      return `Interview feedback added${meta.rating ? ` (${meta.rating}/5)` : ''}`;
    default:
      return action.replace(/_/g, ' ');
  }
}

function formatRelativeTime(dateStr: string): string {
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diffMs = now - then;
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) return 'just now';
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHrs = Math.floor(diffMin / 60);
  if (diffHrs < 24) return `${diffHrs}h ago`;
  const diffDays = Math.floor(diffHrs / 24);
  if (diffDays < 30) return `${diffDays}d ago`;
  return new Date(dateStr).toLocaleDateString();
}

function ReviewModal({
  applicantId,
  existingReview,
  onClose,
  onSaved,
}: {
  applicantId: string;
  existingReview?: Review;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [formData, setFormData] = useState({
    rating: existingReview?.rating || 3,
    technicalSkills: existingReview?.technicalSkills || null,
    designAbility: existingReview?.designAbility || null,
    portfolioQuality: existingReview?.portfolioQuality || null,
    communication: existingReview?.communication || null,
    cultureFit: existingReview?.cultureFit || null,
    recommendation: existingReview?.recommendation || '',
    comments: existingReview?.comments || '',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      await api.post(`/reviews/applicant/${applicantId}`, formData);
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save review');
    } finally {
      setLoading(false);
    }
  };

  const StarRating = ({
    value,
    onChange,
    label,
  }: {
    value: number | null;
    onChange: (v: number | null) => void;
    label: string;
  }) => (
    <div>
      <p className="text-sm text-neutral-700 dark:text-neutral-300 mb-1">{label}</p>
      <div className="flex gap-1">
        {[1, 2, 3, 4, 5].map((star) => (
          <button
            key={star}
            type="button"
            onClick={() => onChange(value === star ? null : star)}
            className={`text-2xl transition-colors ${
              value && star <= value ? 'text-neutral-900 dark:text-neutral-100' : 'text-neutral-300 dark:text-neutral-600 hover:text-neutral-500'
            }`}
          >
            ★
          </button>
        ))}
      </div>
    </div>
  );

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white dark:bg-neutral-800 rounded max-w-lg w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6 border-b border-neutral-200 dark:border-neutral-700 sticky top-0 bg-white dark:bg-neutral-800">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-display font-semibold uppercase tracking-wide">
              {existingReview ? 'Edit Review' : 'Add Review'}
            </h2>
            <button onClick={onClose} className="text-neutral-400 hover:text-neutral-600 dark:text-neutral-500 dark:hover:text-neutral-300">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {error && (
            <div className="bg-neutral-100 dark:bg-neutral-700 border border-neutral-300 dark:border-neutral-600 text-neutral-800 dark:text-neutral-300 px-4 py-3 rounded">
              {error}
            </div>
          )}

          {/* Overall Rating */}
          <div>
            <p className="text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-2">Overall Rating *</p>
            <div className="flex gap-2">
              {[1, 2, 3, 4, 5].map((star) => (
                <button
                  key={star}
                  type="button"
                  onClick={() => setFormData({ ...formData, rating: star })}
                  className={`text-3xl transition-colors ${
                    star <= formData.rating ? 'text-neutral-900 dark:text-neutral-100' : 'text-neutral-300 dark:text-neutral-600 hover:text-neutral-500'
                  }`}
                >
                  ★
                </button>
              ))}
            </div>
          </div>

          {/* Criteria Ratings */}
          <div className="grid grid-cols-2 gap-4">
            <StarRating
              label="Technical Skills"
              value={formData.technicalSkills}
              onChange={(v) => setFormData({ ...formData, technicalSkills: v })}
            />
            <StarRating
              label="Design Ability"
              value={formData.designAbility}
              onChange={(v) => setFormData({ ...formData, designAbility: v })}
            />
            <StarRating
              label="Portfolio Quality"
              value={formData.portfolioQuality}
              onChange={(v) => setFormData({ ...formData, portfolioQuality: v })}
            />
            <StarRating
              label="Communication"
              value={formData.communication}
              onChange={(v) => setFormData({ ...formData, communication: v })}
            />
            <StarRating
              label="Culture Fit"
              value={formData.cultureFit}
              onChange={(v) => setFormData({ ...formData, cultureFit: v })}
            />
          </div>

          {/* Recommendation */}
          <div>
            <p className="text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-2">Recommendation</p>
            <div className="flex flex-wrap gap-2">
              {[
                { value: 'strong_yes', label: 'Strong Yes', color: 'bg-neutral-900 text-white border-neutral-900 dark:bg-neutral-100 dark:text-neutral-900 dark:border-neutral-100' },
                { value: 'yes', label: 'Yes', color: 'bg-neutral-700 text-white border-neutral-700 dark:bg-neutral-300 dark:text-neutral-900 dark:border-neutral-300' },
                { value: 'maybe', label: 'Maybe', color: 'bg-neutral-300 text-neutral-800 border-neutral-400 dark:bg-neutral-500 dark:text-neutral-100 dark:border-neutral-500' },
                { value: 'no', label: 'No', color: 'bg-neutral-100 text-neutral-500 border-neutral-300 dark:bg-neutral-700 dark:text-neutral-400 dark:border-neutral-600' },
                { value: 'strong_no', label: 'Strong No', color: 'bg-neutral-50 text-neutral-400 border-neutral-200 dark:bg-neutral-800 dark:text-neutral-500 dark:border-neutral-700' },
              ].map((rec) => (
                <button
                  key={rec.value}
                  type="button"
                  onClick={() =>
                    setFormData({
                      ...formData,
                      recommendation: formData.recommendation === rec.value ? '' : rec.value,
                    })
                  }
                  className={`px-3 py-1.5 rounded text-sm font-medium border transition-colors ${
                    formData.recommendation === rec.value
                      ? rec.color
                      : 'bg-neutral-50 dark:bg-neutral-700 text-neutral-600 dark:text-neutral-400 border-neutral-200 dark:border-neutral-600 hover:bg-neutral-100 dark:hover:bg-neutral-600'
                  }`}
                >
                  {rec.label}
                </button>
              ))}
            </div>
          </div>

          {/* Comments */}
          <div>
            <label className="label">Comments</label>
            <textarea
              value={formData.comments}
              onChange={(e) => setFormData({ ...formData, comments: e.target.value })}
              className="input min-h-[100px]"
              placeholder="Share your thoughts on this candidate..."
            />
          </div>

          <div className="flex justify-end gap-3 pt-4">
            <button type="button" onClick={onClose} className="btn btn-secondary">
              Cancel
            </button>
            <button type="submit" disabled={loading} className="btn btn-primary">
              {loading ? 'Saving...' : 'Save Review'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function RejectionModal({
  applicant,
  onClose,
  onSent,
}: {
  applicant: Applicant;
  onClose: () => void;
  onSent: (updated: Applicant) => void;
}) {
  const jobTitle = applicant.job?.title || 'General Application';
  const hardcodedTemplate = `Dear ${applicant.firstName},

Thank you for your interest in the ${jobTitle} position and for taking the time to apply. We appreciate the effort you put into your application.

After careful consideration, we have decided to move forward with other candidates whose qualifications more closely align with our current needs.

We encourage you to apply for future openings that match your skills and experience. We wish you all the best in your career search.

Sincerely,
The Hiring Team`;

  const [emailBody, setEmailBody] = useState(hardcodedTemplate);
  const [loading, setLoading] = useState(false);
  const [loadingTemplate, setLoadingTemplate] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    (async () => {
      try {
        const res = await api.get<{ subject: string; body: string }>('/email-settings/templates/rejection');
        // Replace template variables with actual applicant data
        let body = res.data.body;
        body = body.replace(/\{\{firstName\}\}/g, applicant.firstName);
        body = body.replace(/\{\{lastName\}\}/g, applicant.lastName);
        body = body.replace(/\{\{jobTitle\}\}/g, applicant.job?.title || 'General Application');
        setEmailBody(body);
      } catch {
        // Fall back to hardcoded template
      } finally {
        setLoadingTemplate(false);
      }
    })();
  }, []);

  const handleSend = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await api.post<Applicant>(`/applicants/${applicant.id}/send-rejection`, { emailBody });
      onSent(res.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to send rejection email');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white dark:bg-neutral-800 rounded max-w-lg w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6 border-b border-neutral-200 dark:border-neutral-700 sticky top-0 bg-white dark:bg-neutral-800">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-display font-semibold uppercase tracking-wide">
              Send Rejection Letter
            </h2>
            <button onClick={onClose} className="text-neutral-400 hover:text-neutral-600 dark:text-neutral-500 dark:hover:text-neutral-300">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        <div className="p-6 space-y-4">
          {error && (
            <div className="bg-neutral-100 dark:bg-neutral-700 border border-neutral-300 dark:border-neutral-600 text-neutral-800 dark:text-neutral-300 px-4 py-3 rounded">
              {error}
            </div>
          )}

          <dl className="grid grid-cols-1 gap-2">
            <div>
              <dt className="text-sm text-neutral-500 dark:text-neutral-400">Applicant</dt>
              <dd className="font-medium">{applicant.firstName} {applicant.lastName}</dd>
            </div>
            <div>
              <dt className="text-sm text-neutral-500 dark:text-neutral-400">Email</dt>
              <dd className="font-medium">{applicant.email}</dd>
            </div>
            <div>
              <dt className="text-sm text-neutral-500 dark:text-neutral-400">Position</dt>
              <dd className="font-medium">{applicant.job?.title || 'General Application'}</dd>
            </div>
          </dl>

          <div>
            <label className="label">Rejection Letter</label>
            {loadingTemplate ? (
              <div className="flex items-center justify-center h-[200px] border dark:border-neutral-700 rounded bg-neutral-50 dark:bg-neutral-700">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-black dark:border-white"></div>
              </div>
            ) : (
              <textarea
                value={emailBody}
                onChange={(e) => setEmailBody(e.target.value)}
                className="input min-h-[200px]"
              />
            )}
          </div>

          <div className="flex justify-end gap-3 pt-4">
            <button type="button" onClick={onClose} className="btn btn-secondary">
              Cancel
            </button>
            <button
              onClick={handleSend}
              disabled={loading || !emailBody.trim()}
              className="btn btn-primary"
            >
              {loading ? 'Sending...' : 'Send Rejection Letter'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function RequestReviewModal({
  applicant,
  onClose,
  onSent,
}: {
  applicant: Applicant;
  onClose: () => void;
  onSent: () => void;
}) {
  const [users, setUsers] = useState<{ id: string; name: string; email: string; role: string }[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    (async () => {
      try {
        const res = await api.get<{ id: string; name: string; email: string; role: string }[]>('/email-settings/users');
        setUsers(res.data);
      } catch {
        setError('Failed to load users');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const toggleUser = (userId: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(userId)) {
        next.delete(userId);
      } else {
        next.add(userId);
      }
      return next;
    });
  };

  const handleSend = async () => {
    setSending(true);
    setError('');
    try {
      await api.post(`/email-settings/request-review/${applicant.id}`, {
        userIds: Array.from(selectedIds),
        message: message.trim() || undefined,
      });
      onSent();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to send review requests');
    } finally {
      setSending(false);
    }
  };

  const roleLabels: Record<string, string> = {
    admin: 'Admin',
    hiring_manager: 'Hiring Manager',
    reviewer: 'Reviewer',
  };

  const roleBadgeStyles: Record<string, string> = {
    admin: 'bg-neutral-900 text-white dark:bg-neutral-100 dark:text-neutral-900',
    hiring_manager: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
    reviewer: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white dark:bg-neutral-800 rounded max-w-lg w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6 border-b border-neutral-200 dark:border-neutral-700 sticky top-0 bg-white dark:bg-neutral-800">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-display font-semibold uppercase tracking-wide">
              Request Review
            </h2>
            <button onClick={onClose} className="text-neutral-400 hover:text-neutral-600 dark:text-neutral-500 dark:hover:text-neutral-300">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        <div className="p-6 space-y-4">
          {error && (
            <div className="bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 px-4 py-3 rounded text-sm">
              {error}
            </div>
          )}

          <p className="text-sm text-neutral-600 dark:text-neutral-400">
            Send a review request for <span className="font-medium">{applicant.firstName} {applicant.lastName}</span> ({applicant.job?.title || 'General Application'}) to selected users.
          </p>

          {loading ? (
            <div className="flex items-center justify-center h-20">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-black dark:border-white"></div>
            </div>
          ) : (
            <div className="border dark:border-neutral-700 rounded divide-y dark:divide-neutral-700 max-h-[250px] overflow-y-auto">
              {users.map((u) => (
                <div key={u.id} className="flex items-center justify-between px-4 py-3">
                  <div className="flex items-center gap-3">
                    <input
                      type="checkbox"
                      checked={selectedIds.has(u.id)}
                      onChange={() => toggleUser(u.id)}
                      className="h-4 w-4 rounded border-neutral-300 dark:border-neutral-600"
                    />
                    <div>
                      <p className="text-sm font-medium text-neutral-900 dark:text-neutral-100">{u.name}</p>
                      <p className="text-xs text-neutral-500 dark:text-neutral-400">{u.email}</p>
                    </div>
                  </div>
                  <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${roleBadgeStyles[u.role] || 'bg-neutral-100 dark:bg-neutral-700 text-neutral-800 dark:text-neutral-300'}`}>
                    {roleLabels[u.role] || u.role}
                  </span>
                </div>
              ))}
            </div>
          )}

          <div>
            <label className="label">Message (optional)</label>
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Add a note for the reviewers..."
              className="input min-h-[80px]"
            />
          </div>

          <div className="flex justify-end gap-3 pt-4">
            <button type="button" onClick={onClose} className="btn btn-secondary">
              Cancel
            </button>
            <button
              onClick={handleSend}
              disabled={sending || selectedIds.size === 0}
              className="btn btn-primary"
            >
              {sending ? 'Sending...' : `Send to ${selectedIds.size} user${selectedIds.size !== 1 ? 's' : ''}`}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function ConfirmSpamModal({
  applicant,
  onClose,
  onConfirmed,
}: {
  applicant: Applicant;
  onClose: () => void;
  onConfirmed: (updated: Applicant) => void;
}) {
  const [blockDomain, setBlockDomain] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const emailDomain = applicant.email.split('@')[1] || '';

  const handleConfirm = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await api.patch<Applicant>(`/applicants/${applicant.id}/confirm-spam`, { blockDomain });
      onConfirmed(res.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to confirm spam');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white dark:bg-neutral-800 rounded max-w-md w-full">
        <div className="p-6 border-b border-neutral-200 dark:border-neutral-700">
          <h2 className="text-xl font-display font-semibold uppercase tracking-wide">
            Confirm Spam & Block
          </h2>
        </div>
        <div className="p-6 space-y-4">
          {error && (
            <div className="bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 px-4 py-3 rounded text-sm">
              {error}
            </div>
          )}

          <p className="text-neutral-700 dark:text-neutral-300">
            This will block future submissions from <span className="font-medium">{applicant.email}</span>.
          </p>

          {emailDomain && (
            <label className="flex items-start gap-3 p-3 bg-neutral-50 dark:bg-neutral-700 rounded border border-neutral-200 dark:border-neutral-600 cursor-pointer">
              <input
                type="checkbox"
                checked={blockDomain}
                onChange={(e) => setBlockDomain(e.target.checked)}
                className="h-4 w-4 rounded border-neutral-300 dark:border-neutral-600 mt-0.5"
              />
              <div>
                <p className="text-sm font-medium text-neutral-900 dark:text-neutral-100">Also block domain @{emailDomain}</p>
                <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-0.5">
                  All future submissions from any @{emailDomain} address will be auto-flagged as spam.
                </p>
              </div>
            </label>
          )}

          <div className="flex justify-end gap-3 pt-4">
            <button
              onClick={onClose}
              disabled={loading}
              className="btn btn-secondary"
            >
              Cancel
            </button>
            <button
              onClick={handleConfirm}
              disabled={loading}
              className="btn btn-primary bg-red-600 hover:bg-red-700 border-red-600"
            >
              {loading ? 'Blocking...' : 'Confirm Spam & Block'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function EditApplicantModal({
  applicant,
  onClose,
  onSaved,
}: {
  applicant: Applicant;
  onClose: () => void;
  onSaved: (updated: Applicant) => void;
}) {
  const [firstName, setFirstName] = useState(applicant.firstName);
  const [lastName, setLastName] = useState(applicant.lastName);
  const [email, setEmail] = useState(applicant.email);
  const [phone, setPhone] = useState(applicant.phone || '');
  const [linkedIn, setLinkedIn] = useState(applicant.linkedIn || '');
  const [website, setWebsite] = useState(applicant.website || '');
  const [portfolioUrl, setPortfolioUrl] = useState(applicant.portfolioUrl || '');
  const [coverLetter, setCoverLetter] = useState(applicant.coverLetter || '');
  const [source, setSource] = useState(applicant.source || '');
  const [resumeFile, setResumeFile] = useState<File | null>(null);
  const [portfolioFile, setPortfolioFile] = useState<File | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

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
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    const errors: Record<string, string> = {};
    const emailErr = validateField('email', email);
    if (emailErr) errors.email = emailErr;
    const phoneErr = validateField('phone', phone);
    if (phoneErr) errors.phone = phoneErr;
    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      return;
    }
    setFieldErrors({});

    setSaving(true);
    try {
      const fd = new FormData();
      fd.append('firstName', firstName);
      fd.append('lastName', lastName);
      fd.append('email', email);
      if (phone) fd.append('phone', phone);
      if (linkedIn) fd.append('linkedIn', linkedIn);
      if (website) fd.append('website', website);
      if (portfolioUrl) fd.append('portfolioUrl', portfolioUrl);
      if (coverLetter) fd.append('coverLetter', coverLetter);
      if (source) fd.append('source', source);
      if (resumeFile) fd.append('resume', resumeFile);
      if (portfolioFile) fd.append('portfolio', portfolioFile);

      const res = await api.upload<Applicant>(`/applicants/${applicant.id}`, fd, 'PUT');
      onSaved(res.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update applicant');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-neutral-800 rounded-lg w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white dark:bg-neutral-800 border-b dark:border-neutral-700 px-6 py-4 flex justify-between items-center">
          <h2 className="text-xl font-display font-bold uppercase tracking-wide">Edit Applicant Details</h2>
          <button onClick={onClose} className="text-neutral-400 hover:text-neutral-600 dark:text-neutral-500 dark:hover:text-neutral-300">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 px-4 py-3 rounded text-sm">
              {error}
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="label">First Name</label>
              <input
                type="text"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                className="input"
                required
              />
            </div>
            <div>
              <label className="label">Last Name</label>
              <input
                type="text"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
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
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                onBlur={(e) => handleFieldBlur('email', e.target.value)}
                className={`input ${fieldErrors.email ? 'border-red-400' : ''}`}
                required
              />
              {fieldErrors.email && (
                <p className="text-red-600 dark:text-red-400 text-xs mt-1">{fieldErrors.email}</p>
              )}
            </div>
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
                <p className="text-red-600 dark:text-red-400 text-xs mt-1">{fieldErrors.phone}</p>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="label">LinkedIn URL</label>
              <input
                type="url"
                value={linkedIn}
                onChange={(e) => setLinkedIn(e.target.value)}
                className="input"
                placeholder="https://linkedin.com/in/..."
              />
            </div>
            <div>
              <label className="label">Website</label>
              <input
                type="url"
                value={website}
                onChange={(e) => setWebsite(e.target.value)}
                className="input"
                placeholder="https://..."
              />
            </div>
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
            <label className="label">Cover Letter</label>
            <textarea
              value={coverLetter}
              onChange={(e) => setCoverLetter(e.target.value)}
              className="input min-h-[100px]"
            />
          </div>

          <div>
            <label className="label">Source</label>
            <input
              type="text"
              value={source}
              onChange={(e) => setSource(e.target.value)}
              className="input"
              placeholder="e.g. LinkedIn, Career Fair, Referral, Website..."
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="label">
                Resume {applicant.resumePath && <span className="text-xs text-neutral-400 dark:text-neutral-500 font-normal">(replace existing)</span>}
              </label>
              <input
                type="file"
                accept=".pdf,.doc,.docx"
                onChange={(e) => setResumeFile(e.target.files?.[0] || null)}
                className="input text-sm file:mr-3 file:py-1 file:px-3 file:rounded file:border-0 file:bg-neutral-100 dark:file:bg-neutral-700 file:text-neutral-700 dark:file:text-neutral-300 file:font-medium file:cursor-pointer"
              />
              <p className="text-xs text-neutral-400 dark:text-neutral-500 mt-1">PDF, DOC, or DOCX</p>
            </div>
            <div>
              <label className="label">
                Portfolio File {applicant.portfolioPath && <span className="text-xs text-neutral-400 dark:text-neutral-500 font-normal">(replace existing)</span>}
              </label>
              <input
                type="file"
                accept=".pdf,.jpg,.jpeg,.png,.zip"
                onChange={(e) => setPortfolioFile(e.target.files?.[0] || null)}
                className="input text-sm file:mr-3 file:py-1 file:px-3 file:rounded file:border-0 file:bg-neutral-100 dark:file:bg-neutral-700 file:text-neutral-700 dark:file:text-neutral-300 file:font-medium file:cursor-pointer"
              />
              <p className="text-xs text-neutral-400 dark:text-neutral-500 mt-1">PDF, JPG, PNG, or ZIP</p>
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-4">
            <button type="button" onClick={onClose} className="btn btn-secondary">
              Cancel
            </button>
            <button type="submit" disabled={saving} className="btn btn-primary">
              {saving ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function AssignJobModal({
  applicant,
  onClose,
  onAssigned,
}: {
  applicant: Applicant;
  onClose: () => void;
  onAssigned: (updated: Applicant) => void;
}) {
  const [jobs, setJobs] = useState<{ id: string; title: string; department: string }[]>([]);
  const [selectedJobId, setSelectedJobId] = useState<string>(applicant.job?.id || '');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    (async () => {
      try {
        const res = await api.get<{ id: string; title: string; department: string }[]>('/jobs?status=open');
        setJobs(res.data);
      } catch {
        setError('Failed to load jobs');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const handleSave = async () => {
    setSaving(true);
    setError('');
    try {
      const res = await api.patch<Applicant>(`/applicants/${applicant.id}/assign-job`, {
        jobId: selectedJobId || null,
      });
      onAssigned(res.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to assign job');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white dark:bg-neutral-800 rounded max-w-md w-full">
        <div className="p-6 border-b border-neutral-200 dark:border-neutral-700">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-display font-semibold uppercase tracking-wide">
              {applicant.job ? 'Reassign Job' : 'Assign to Job'}
            </h2>
            <button onClick={onClose} className="text-neutral-400 hover:text-neutral-600 dark:text-neutral-500 dark:hover:text-neutral-300">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        <div className="p-6 space-y-4">
          {error && (
            <div className="bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 px-4 py-3 rounded text-sm">
              {error}
            </div>
          )}

          <p className="text-sm text-neutral-600 dark:text-neutral-400">
            Currently: <span className="font-medium">{applicant.job?.title || 'General Pool'}</span>
          </p>

          {loading ? (
            <div className="flex items-center justify-center h-20">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-black dark:border-white"></div>
            </div>
          ) : (
            <div>
              <label className="label">New Assignment</label>
              <select
                value={selectedJobId}
                onChange={(e) => setSelectedJobId(e.target.value)}
                className="input"
              >
                <option value="">General Pool (no job)</option>
                {jobs.map((job) => (
                  <option key={job.id} value={job.id}>
                    {job.title} — {job.department}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div className="flex justify-end gap-3 pt-4">
            <button type="button" onClick={onClose} className="btn btn-secondary">
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={saving || (selectedJobId === (applicant.job?.id || ''))}
              className="btn btn-primary"
            >
              {saving ? 'Saving...' : 'Assign'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function ScheduleInterviewModal({
  applicantId,
  existingInterview,
  onClose,
  onSaved,
}: {
  applicantId: string;
  existingInterview?: Interview;
  onClose: () => void;
  onSaved: () => void;
}) {
  const isEdit = !!existingInterview;
  const [scheduledAt, setScheduledAt] = useState(() => {
    if (existingInterview) {
      const d = new Date(existingInterview.scheduledAt);
      return d.toISOString().slice(0, 16);
    }
    return '';
  });
  const [type, setType] = useState(existingInterview?.type || 'in_person');
  const [location, setLocation] = useState(existingInterview?.location || '');
  const [notesUrl, setNotesUrl] = useState(existingInterview?.notesUrl || '');
  const [notes, setNotes] = useState(existingInterview?.notes || '');
  const [status, setStatus] = useState(existingInterview?.status || 'scheduled');
  const [outcome, setOutcome] = useState(existingInterview?.outcome || '');
  const [feedback, setFeedback] = useState(existingInterview?.feedback || '');
  const [participantIds, setParticipantIds] = useState<Set<string>>(
    new Set(existingInterview?.participants.map(p => p.user.id) || [])
  );
  const [users, setUsers] = useState<{ id: string; name: string; email: string; role: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    (async () => {
      try {
        const res = await api.get<{ id: string; name: string; email: string; role: string }[]>('/email-settings/users');
        setUsers(res.data);
      } catch {
        setError('Failed to load users');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const toggleParticipant = (userId: string) => {
    setParticipantIds(prev => {
      const next = new Set(prev);
      if (next.has(userId)) next.delete(userId);
      else next.add(userId);
      return next;
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (participantIds.size === 0) {
      setError('Select at least one participant');
      return;
    }
    setSaving(true);
    setError('');
    try {
      if (isEdit) {
        await api.put(`/interviews/${existingInterview!.id}`, {
          scheduledAt: new Date(scheduledAt).toISOString(),
          type,
          location: location || null,
          notesUrl: notesUrl || null,
          notes: notes || null,
          status,
          outcome: outcome || null,
          feedback: feedback || null,
          participantIds: Array.from(participantIds),
        });
      } else {
        await api.post(`/interviews/applicant/${applicantId}`, {
          applicantId,
          scheduledAt: new Date(scheduledAt).toISOString(),
          type,
          location: location || null,
          notesUrl: notesUrl || null,
          notes: notes || null,
          participantIds: Array.from(participantIds),
        });
      }
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save interview');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!existingInterview) return;
    setDeleting(true);
    try {
      await api.delete(`/interviews/${existingInterview.id}`);
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to cancel interview');
      setDeleting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white dark:bg-neutral-800 rounded max-w-lg w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6 border-b border-neutral-200 dark:border-neutral-700 sticky top-0 bg-white dark:bg-neutral-800">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-display font-semibold uppercase tracking-wide">
              {isEdit ? 'Edit Interview' : 'Schedule Interview'}
            </h2>
            <button onClick={onClose} className="text-neutral-400 hover:text-neutral-600 dark:text-neutral-500 dark:hover:text-neutral-300">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 px-4 py-3 rounded text-sm">
              {error}
            </div>
          )}

          <div>
            <label className="label">Date & Time *</label>
            <input
              type="datetime-local"
              value={scheduledAt}
              onChange={(e) => setScheduledAt(e.target.value)}
              className="input"
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Type</label>
              <select value={type} onChange={(e) => setType(e.target.value)} className="input">
                <option value="in_person">In Person</option>
                <option value="video">Video</option>
                <option value="phone">Phone</option>
              </select>
            </div>
            <div>
              <label className="label">Location</label>
              <input
                type="text"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                className="input"
                placeholder="Office, Zoom link, etc."
              />
            </div>
          </div>

          <div>
            <label className="label">Meeting Notes URL</label>
            <input
              type="url"
              value={notesUrl}
              onChange={(e) => setNotesUrl(e.target.value)}
              className="input"
              placeholder="OneNote, Google Docs, etc."
            />
          </div>

          {isEdit && (
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="label">Status</label>
                <select value={status} onChange={(e) => setStatus(e.target.value)} className="input">
                  <option value="scheduled">Scheduled</option>
                  <option value="completed">Completed</option>
                  <option value="cancelled">Cancelled</option>
                  <option value="no_show">No Show</option>
                </select>
              </div>
              <div>
                <label className="label">Outcome</label>
                <select value={outcome} onChange={(e) => setOutcome(e.target.value)} className="input">
                  <option value="">Not set</option>
                  <option value="advance">Advance</option>
                  <option value="hold">Hold</option>
                  <option value="reject">Reject</option>
                </select>
              </div>
            </div>
          )}

          <div>
            <label className="label">Participants *</label>
            {loading ? (
              <div className="flex items-center justify-center h-16">
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-black dark:border-white"></div>
              </div>
            ) : (
              <div className="border dark:border-neutral-700 rounded divide-y dark:divide-neutral-700 max-h-[200px] overflow-y-auto">
                {users.map((u) => (
                  <label key={u.id} className="flex items-center gap-3 px-4 py-2.5 hover:bg-neutral-50 dark:hover:bg-neutral-700 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={participantIds.has(u.id)}
                      onChange={() => toggleParticipant(u.id)}
                      className="h-4 w-4 rounded border-neutral-300 dark:border-neutral-600"
                    />
                    <div>
                      <p className="text-sm font-medium text-neutral-900 dark:text-neutral-100">{u.name}</p>
                      <p className="text-xs text-neutral-500 dark:text-neutral-400">{u.email}</p>
                    </div>
                  </label>
                ))}
              </div>
            )}
          </div>

          <div>
            <label className="label">Prep Notes</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="input min-h-[80px]"
              placeholder="Topics to discuss, questions to ask..."
            />
          </div>

          {isEdit && (
            <div>
              <label className="label">Summary Feedback</label>
              <textarea
                value={feedback}
                onChange={(e) => setFeedback(e.target.value)}
                className="input min-h-[80px]"
                placeholder="Post-interview summary..."
              />
            </div>
          )}

          <div className="flex items-center justify-between pt-4">
            <div>
              {isEdit && (
                <button
                  type="button"
                  onClick={handleDelete}
                  disabled={deleting || saving}
                  className="text-sm text-red-600 dark:text-red-400 hover:text-red-700 font-medium"
                >
                  {deleting ? 'Cancelling...' : 'Cancel Interview'}
                </button>
              )}
            </div>
            <div className="flex gap-3">
              <button type="button" onClick={onClose} className="btn btn-secondary">
                Close
              </button>
              <button type="submit" disabled={saving || participantIds.size === 0} className="btn btn-primary">
                {saving ? 'Saving...' : isEdit ? 'Update Interview' : 'Schedule Interview'}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}

function InterviewFeedbackModal({
  interview,
  onClose,
  onSaved,
}: {
  interview: Interview;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [rating, setRating] = useState<number | null>(null);
  const [feedback, setFeedback] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      await api.patch(`/interviews/${interview.id}/feedback`, {
        feedback: feedback || null,
        rating,
      });
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save feedback');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white dark:bg-neutral-800 rounded max-w-md w-full">
        <div className="p-6 border-b border-neutral-200 dark:border-neutral-700">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-display font-semibold uppercase tracking-wide">
              Interview Feedback
            </h2>
            <button onClick={onClose} className="text-neutral-400 hover:text-neutral-600 dark:text-neutral-500 dark:hover:text-neutral-300">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 px-4 py-3 rounded text-sm">
              {error}
            </div>
          )}

          <p className="text-sm text-neutral-600 dark:text-neutral-400">
            Interview on {new Date(interview.scheduledAt).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })}
          </p>

          <div>
            <p className="text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-2">Rating</p>
            <div className="flex gap-2">
              {[1, 2, 3, 4, 5].map((star) => (
                <button
                  key={star}
                  type="button"
                  onClick={() => setRating(rating === star ? null : star)}
                  className={`text-3xl transition-colors ${
                    rating && star <= rating ? 'text-neutral-900 dark:text-neutral-100' : 'text-neutral-300 dark:text-neutral-600 hover:text-neutral-500'
                  }`}
                >
                  ★
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="label">Feedback</label>
            <textarea
              value={feedback}
              onChange={(e) => setFeedback(e.target.value)}
              className="input min-h-[120px]"
              placeholder="Your assessment of the candidate..."
            />
          </div>

          <div className="flex justify-end gap-3 pt-4">
            <button type="button" onClick={onClose} className="btn btn-secondary">
              Cancel
            </button>
            <button type="submit" disabled={saving} className="btn btn-primary">
              {saving ? 'Saving...' : 'Submit Feedback'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function InterviewDetailModal({
  interview,
  onClose,
}: {
  interview: Interview;
  onClose: () => void;
}) {
  const typeLabel: Record<string, string> = { in_person: 'In Person', video: 'Video', phone: 'Phone' };
  const statusColors: Record<string, string> = {
    scheduled: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
    completed: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
    cancelled: 'bg-neutral-100 text-neutral-500 dark:bg-neutral-700 dark:text-neutral-400',
    no_show: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
  };
  const outcomeColors: Record<string, string> = {
    advance: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
    hold: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200',
    reject: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white dark:bg-neutral-800 rounded max-w-lg w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6 border-b border-neutral-200 dark:border-neutral-700 sticky top-0 bg-white dark:bg-neutral-800">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-display font-semibold uppercase tracking-wide">
              Interview Details
            </h2>
            <button onClick={onClose} className="text-neutral-400 hover:text-neutral-600 dark:text-neutral-500 dark:hover:text-neutral-300">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        <div className="p-6 space-y-4">
          <dl className="grid grid-cols-2 gap-4">
            <div>
              <dt className="text-sm text-neutral-500 dark:text-neutral-400">Date & Time</dt>
              <dd className="font-medium">
                {new Date(interview.scheduledAt).toLocaleString(undefined, {
                  dateStyle: 'medium',
                  timeStyle: 'short',
                })}
              </dd>
            </div>
            <div>
              <dt className="text-sm text-neutral-500 dark:text-neutral-400">Type</dt>
              <dd className="font-medium">{typeLabel[interview.type] || interview.type}</dd>
            </div>
            <div>
              <dt className="text-sm text-neutral-500 dark:text-neutral-400">Status</dt>
              <dd>
                <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${statusColors[interview.status] || 'bg-neutral-100 dark:bg-neutral-700 text-neutral-700 dark:text-neutral-300'}`}>
                  {interview.status.replace('_', ' ')}
                </span>
              </dd>
            </div>
            {interview.outcome && (
              <div>
                <dt className="text-sm text-neutral-500 dark:text-neutral-400">Outcome</dt>
                <dd>
                  <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${outcomeColors[interview.outcome] || 'bg-neutral-100 dark:bg-neutral-700 text-neutral-700 dark:text-neutral-300'}`}>
                    {interview.outcome}
                  </span>
                </dd>
              </div>
            )}
            {interview.location && (
              <div className="col-span-2">
                <dt className="text-sm text-neutral-500 dark:text-neutral-400">Location</dt>
                <dd className="font-medium">{interview.location}</dd>
              </div>
            )}
            {interview.notesUrl && (
              <div className="col-span-2">
                <dt className="text-sm text-neutral-500 dark:text-neutral-400">Meeting Notes</dt>
                <dd>
                  <a
                    href={interview.notesUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm text-neutral-900 dark:text-neutral-100 hover:text-neutral-600 dark:hover:text-neutral-400 font-medium"
                  >
                    Open Notes Link &rarr;
                  </a>
                </dd>
              </div>
            )}
            <div className="col-span-2">
              <dt className="text-sm text-neutral-500 dark:text-neutral-400">Scheduled by</dt>
              <dd className="font-medium">{interview.createdBy.name}</dd>
            </div>
          </dl>

          {interview.notes && (
            <div>
              <h3 className="text-sm font-medium text-neutral-900 dark:text-neutral-100 mb-1">Prep Notes</h3>
              <p className="text-sm text-neutral-600 dark:text-neutral-400 whitespace-pre-wrap">{interview.notes}</p>
            </div>
          )}

          {interview.feedback && (
            <div>
              <h3 className="text-sm font-medium text-neutral-900 dark:text-neutral-100 mb-1">Summary Feedback</h3>
              <p className="text-sm text-neutral-600 dark:text-neutral-400 whitespace-pre-wrap">{interview.feedback}</p>
            </div>
          )}

          <div>
            <h3 className="text-sm font-medium text-neutral-900 dark:text-neutral-100 mb-2">Participants</h3>
            <div className="space-y-3">
              {interview.participants.map((p) => (
                <div key={p.id} className="p-3 bg-neutral-50 dark:bg-neutral-700 rounded border border-neutral-100 dark:border-neutral-600">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-neutral-900 dark:text-neutral-100">{p.user.name}</p>
                      <p className="text-xs text-neutral-500 dark:text-neutral-400">{p.user.email}</p>
                    </div>
                    {p.rating && (
                      <div className="flex">
                        {[1, 2, 3, 4, 5].map((star) => (
                          <span
                            key={star}
                            className={`text-lg ${star <= p.rating! ? 'text-neutral-900 dark:text-neutral-100' : 'text-neutral-300 dark:text-neutral-600'}`}
                          >
                            ★
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                  {p.feedback && (
                    <p className="text-sm text-neutral-600 dark:text-neutral-400 mt-2">{p.feedback}</p>
                  )}
                  {!p.feedback && !p.rating && (
                    <p className="text-xs text-neutral-400 dark:text-neutral-500 mt-1 italic">No feedback yet</p>
                  )}
                </div>
              ))}
            </div>
          </div>

          <div className="flex justify-end pt-4">
            <button onClick={onClose} className="btn btn-secondary">
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function OfferModal({
  applicantId,
  existingOffer,
  onClose,
  onSaved,
}: {
  applicantId: string;
  existingOffer?: Offer;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [status, setStatus] = useState(existingOffer?.status || 'draft');
  const [salary, setSalary] = useState(existingOffer?.salary || '');
  const [offerDate, setOfferDate] = useState(
    existingOffer?.offerDate ? existingOffer.offerDate.split('T')[0] : ''
  );
  const [acceptedDate, setAcceptedDate] = useState(
    existingOffer?.acceptedDate ? existingOffer.acceptedDate.split('T')[0] : ''
  );
  const [declinedDate, setDeclinedDate] = useState(
    existingOffer?.declinedDate ? existingOffer.declinedDate.split('T')[0] : ''
  );
  const [notes, setNotes] = useState(existingOffer?.notes || '');
  const [file, setFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [deleting, setDeleting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError('');

    try {
      if (existingOffer) {
        // Update offer
        await api.put(`/offers/${existingOffer.id}`, {
          status,
          notes: notes || undefined,
          salary: salary || undefined,
          offerDate: offerDate || null,
          acceptedDate: acceptedDate || null,
          declinedDate: declinedDate || null,
        });
        // Upload file separately if provided
        if (file) {
          const formData = new FormData();
          formData.append('offerLetter', file);
          await api.upload(`/offers/${existingOffer.id}/upload`, formData, 'PATCH');
        }
      } else {
        // Create offer — always use FormData so multer middleware works
        const formData = new FormData();
        formData.append('status', status);
        if (notes) formData.append('notes', notes);
        if (salary) formData.append('salary', salary);
        if (offerDate) formData.append('offerDate', offerDate);
        if (acceptedDate) formData.append('acceptedDate', acceptedDate);
        if (declinedDate) formData.append('declinedDate', declinedDate);
        if (file) formData.append('offerLetter', file);
        await api.upload(`/offers/applicant/${applicantId}`, formData);
      }
      onSaved();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to save offer';
      setError(message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!existingOffer) return;
    setDeleting(true);
    try {
      await api.delete(`/offers/${existingOffer.id}`);
      onSaved();
    } catch {
      setError('Failed to delete offer');
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-neutral-800 rounded-lg shadow-xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          <h2 className="text-lg font-display font-semibold text-neutral-900 dark:text-neutral-100 mb-4 uppercase tracking-wide">
            {existingOffer ? 'Edit Offer' : 'Create Offer'}
          </h2>

          {error && (
            <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded text-sm text-red-600 dark:text-red-400">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="label">Status</label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value)}
                className="input"
              >
                <option value="draft">Draft</option>
                <option value="extended">Extended</option>
                <option value="accepted">Accepted</option>
                <option value="declined">Declined</option>
                <option value="rescinded">Rescinded</option>
              </select>
            </div>

            <div>
              <label className="label">Salary / Compensation</label>
              <input
                type="text"
                value={salary}
                onChange={(e) => setSalary(e.target.value)}
                placeholder="e.g. $75,000/year"
                className="input"
              />
            </div>

            <div>
              <label className="label">Offer Date</label>
              <input
                type="date"
                value={offerDate}
                onChange={(e) => setOfferDate(e.target.value)}
                className="input"
              />
            </div>

            {(status === 'accepted' || acceptedDate) && (
              <div>
                <label className="label">Accepted Date</label>
                <input
                  type="date"
                  value={acceptedDate}
                  onChange={(e) => setAcceptedDate(e.target.value)}
                  className="input"
                />
              </div>
            )}

            {(status === 'declined' || declinedDate) && (
              <div>
                <label className="label">Declined Date</label>
                <input
                  type="date"
                  value={declinedDate}
                  onChange={(e) => setDeclinedDate(e.target.value)}
                  className="input"
                />
              </div>
            )}

            <div>
              <label className="label">Notes</label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={3}
                placeholder="Negotiation details, revision notes..."
                className="input"
              />
            </div>

            <div>
              <label className="label">
                Offer Letter {existingOffer?.filePath ? '(replace)' : '(optional)'}
              </label>
              <input
                type="file"
                accept=".pdf,.doc,.docx"
                onChange={(e) => setFile(e.target.files?.[0] || null)}
                className="input text-sm"
              />
              {existingOffer?.filePath && !file && (
                <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-1">
                  Current file: <a href={existingOffer.filePath} target="_blank" rel="noopener noreferrer" className="text-blue-600 dark:text-blue-400 hover:underline">View</a>
                </p>
              )}
            </div>

            <div className="flex justify-between items-center pt-4">
              <div>
                {existingOffer && (
                  <button
                    type="button"
                    onClick={handleDelete}
                    disabled={deleting}
                    className="text-sm text-red-600 dark:text-red-400 hover:text-red-800"
                  >
                    {deleting ? 'Deleting...' : 'Delete Offer'}
                  </button>
                )}
              </div>
              <div className="flex gap-3">
                <button type="button" onClick={onClose} className="btn btn-secondary">
                  Cancel
                </button>
                <button type="submit" disabled={saving} className="btn btn-primary">
                  {saving ? 'Saving...' : existingOffer ? 'Update Offer' : 'Create Offer'}
                </button>
              </div>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

function StartDatePicker({
  applicantId,
  currentDate,
  onSaved,
}: {
  applicantId: string;
  currentDate: string | null;
  onSaved: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [date, setDate] = useState(currentDate ? currentDate.split('T')[0] : '');
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    try {
      await api.put(`/applicants/${applicantId}`, {
        startDate: date || null,
      });
      onSaved();
      setEditing(false);
    } catch {
      // ignore
    } finally {
      setSaving(false);
    }
  };

  if (!editing) {
    return (
      <button
        onClick={() => setEditing(true)}
        className="text-sm text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300"
      >
        {currentDate ? 'Change' : 'Set Date'}
      </button>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <input
        type="date"
        value={date}
        onChange={(e) => setDate(e.target.value)}
        className="input text-sm py-1"
      />
      <button
        onClick={handleSave}
        disabled={saving}
        className="btn btn-primary text-sm py-1 px-3"
      >
        {saving ? '...' : 'Save'}
      </button>
      <button
        onClick={() => { setEditing(false); setDate(currentDate ? currentDate.split('T')[0] : ''); }}
        className="text-sm text-neutral-500 dark:text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-300"
      >
        Cancel
      </button>
    </div>
  );
}
