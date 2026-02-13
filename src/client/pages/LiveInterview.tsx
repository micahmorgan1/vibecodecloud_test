import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import { api } from '../lib/api';
import { useAuth } from '../context/AuthContext';
import RichTextEditor from '../components/RichTextEditor';
import Avatar from '../components/Avatar';
import { renderContent } from '../utils/formatText';

interface InterviewParticipant {
  id: string;
  feedback: string | null;
  rating: number | null;
  userId: string;
  user: { id: string; name: string; email: string };
}

interface InterviewApplicant {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string | null;
  linkedIn: string | null;
  resumePath: string | null;
  portfolioPath: string | null;
  portfolioUrl: string | null;
  stage: string;
  jobId: string | null;
  job: { id: string; title: string; department: string; location: string } | null;
  event: { id: string; name: string } | null;
  reviews: Array<{
    id: string;
    rating: number;
    recommendation: string | null;
    comments: string | null;
    reviewer: { id: string; name: string };
  }>;
}

interface InterviewDetail {
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
  applicant: InterviewApplicant;
}

const typeLabels: Record<string, string> = { in_person: 'In Person', video: 'Video', phone: 'Phone' };
const statusColors: Record<string, string> = {
  scheduled: 'bg-blue-100 text-blue-800',
  completed: 'bg-green-100 text-green-800',
  cancelled: 'bg-gray-100 text-gray-500',
  no_show: 'bg-red-100 text-red-800',
};
const stageLabels: Record<string, string> = {
  fair_intake: 'Fair Intake', new: 'New', screening: 'Screening', interview: 'Interview',
  offer: 'Offer', hired: 'Hired', rejected: 'Rejected', holding: 'Holding',
};
const recommendationLabels: Record<string, string> = {
  strong_yes: 'Strong Yes', yes: 'Yes', maybe: 'Maybe', no: 'No', strong_no: 'Strong No',
};

export default function LiveInterview() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const [interview, setInterview] = useState<InterviewDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Participant feedback state
  const [myFeedback, setMyFeedback] = useState('');
  const [myRating, setMyRating] = useState<number | null>(null);
  const [savingFeedback, setSavingFeedback] = useState(false);
  const [feedbackSaved, setFeedbackSaved] = useState(false);

  // Notes URL editing
  const [editingNotesUrl, setEditingNotesUrl] = useState(false);
  const [notesUrlDraft, setNotesUrlDraft] = useState('');
  const [savingNotesUrl, setSavingNotesUrl] = useState(false);

  // Status/outcome editing
  const [savingStatus, setSavingStatus] = useState(false);

  // Track if user has unsaved edits to prevent polling overwrite
  const hasUnsavedEdits = useRef(false);

  const fetchInterview = useCallback(async (skipMyFeedback = false) => {
    try {
      const res = await api.get<InterviewDetail>(`/interviews/${id}`);
      setInterview(res.data);

      // Only set my feedback on initial load or if not editing
      if (!skipMyFeedback) {
        const myP = res.data.participants.find(p => p.user.id === user?.id);
        if (myP) {
          setMyFeedback(myP.feedback || '');
          setMyRating(myP.rating);
        }
      }
    } catch {
      setError('Interview not found or access denied');
    } finally {
      setLoading(false);
    }
  }, [id, user?.id]);

  useEffect(() => {
    if (id) fetchInterview();
  }, [id, fetchInterview]);

  // Poll every 30s to refresh others' feedback
  useEffect(() => {
    if (!id) return;
    const interval = setInterval(() => {
      fetchInterview(hasUnsavedEdits.current);
    }, 30000);
    return () => clearInterval(interval);
  }, [id, fetchInterview]);

  const saveFeedback = async () => {
    if (!interview) return;
    setSavingFeedback(true);
    setFeedbackSaved(false);
    try {
      await api.patch(`/interviews/${interview.id}/feedback`, {
        feedback: myFeedback || null,
        rating: myRating,
      });
      hasUnsavedEdits.current = false;
      setFeedbackSaved(true);
      setTimeout(() => setFeedbackSaved(false), 2000);
      fetchInterview(true);
    } catch {
      setError('Failed to save feedback');
    } finally {
      setSavingFeedback(false);
    }
  };

  const saveNotesUrl = async () => {
    if (!interview) return;
    setSavingNotesUrl(true);
    try {
      await api.put(`/interviews/${interview.id}`, {
        notesUrl: notesUrlDraft || null,
      });
      setEditingNotesUrl(false);
      fetchInterview(true);
    } catch {
      setError('Failed to save notes URL');
    } finally {
      setSavingNotesUrl(false);
    }
  };

  const updateStatus = async (newStatus: string) => {
    if (!interview) return;
    setSavingStatus(true);
    try {
      await api.put(`/interviews/${interview.id}`, { status: newStatus });
      fetchInterview(true);
    } catch {
      setError('Failed to update status');
    } finally {
      setSavingStatus(false);
    }
  };

  const updateOutcome = async (newOutcome: string) => {
    if (!interview) return;
    setSavingStatus(true);
    try {
      await api.put(`/interviews/${interview.id}`, { outcome: newOutcome || null });
      fetchInterview(true);
    } catch {
      setError('Failed to update outcome');
    } finally {
      setSavingStatus(false);
    }
  };

  const isAdminOrHM = user?.role === 'admin' || user?.role === 'hiring_manager';

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-black"></div>
      </div>
    );
  }

  if (error || !interview) {
    return (
      <div className="card text-center py-12">
        <p className="text-gray-500">{error || 'Interview not found'}</p>
        <Link to="/" className="btn btn-primary mt-4">Back to Dashboard</Link>
      </div>
    );
  }

  const applicant = interview.applicant;
  const date = new Date(interview.scheduledAt);

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="card">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <Link
              to={`/applicants/${applicant.id}`}
              className="text-sm text-gray-500 hover:text-gray-900 mb-1 inline-block"
            >
              &larr; Back to {applicant.firstName} {applicant.lastName}
            </Link>
            <h1 className="text-xl font-display font-bold text-gray-900 uppercase tracking-wide">
              Interview: {applicant.firstName} {applicant.lastName}
            </h1>
            <div className="flex flex-wrap items-center gap-2 mt-1 text-sm text-gray-500">
              <span>{date.toLocaleDateString(undefined, { dateStyle: 'medium' })}</span>
              <span>{date.toLocaleTimeString(undefined, { timeStyle: 'short' })}</span>
              <span className="text-gray-300">|</span>
              <span>{typeLabels[interview.type] || interview.type}</span>
              {interview.location && (
                <>
                  <span className="text-gray-300">|</span>
                  <span>{interview.location}</span>
                </>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${statusColors[interview.status] || 'bg-gray-100 text-gray-700'}`}>
              {interview.status.replace('_', ' ')}
            </span>
            {interview.outcome && (
              <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${
                interview.outcome === 'advance' ? 'bg-green-100 text-green-800' :
                interview.outcome === 'hold' ? 'bg-yellow-100 text-yellow-800' :
                'bg-red-100 text-red-800'
              }`}>
                {interview.outcome}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Two-column layout */}
      <div className="grid grid-cols-1 lg:grid-cols-[320px_1fr] gap-4">
        {/* Sidebar — rendered after main content on mobile via order */}
        <div className="space-y-4 order-2 lg:order-1">
          {/* Applicant Info */}
          <div className="card">
            <div className="flex items-center gap-3 mb-4">
              <Avatar name={`${applicant.firstName} ${applicant.lastName}`} email={applicant.email} size={48} />
              <div className="min-w-0">
                <p className="font-medium text-gray-900 truncate">{applicant.firstName} {applicant.lastName}</p>
                <p className="text-sm text-gray-500 truncate">{applicant.email}</p>
              </div>
            </div>

            <dl className="space-y-2 text-sm">
              {applicant.phone && (
                <div>
                  <dt className="text-gray-500">Phone</dt>
                  <dd className="font-medium">{applicant.phone}</dd>
                </div>
              )}
              <div>
                <dt className="text-gray-500">Stage</dt>
                <dd>
                  <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium badge-${applicant.stage}`}>
                    {stageLabels[applicant.stage] || applicant.stage}
                  </span>
                </dd>
              </div>
              <div>
                <dt className="text-gray-500">Position</dt>
                <dd className="font-medium">
                  {applicant.job ? (
                    <Link to={`/jobs/${applicant.job.id}`} className="text-gray-900 hover:text-gray-600">
                      {applicant.job.title}
                    </Link>
                  ) : (
                    <span className="text-gray-400 italic">General Application</span>
                  )}
                </dd>
              </div>
              {applicant.job?.department && (
                <div>
                  <dt className="text-gray-500">Department</dt>
                  <dd className="font-medium">{applicant.job.department}</dd>
                </div>
              )}
              {applicant.event && (
                <div>
                  <dt className="text-gray-500">Event</dt>
                  <dd className="font-medium">{applicant.event.name}</dd>
                </div>
              )}
            </dl>

            {/* Document links */}
            <div className="mt-4 pt-4 border-t border-gray-200 space-y-2">
              {applicant.resumePath && (
                <a
                  href={applicant.resumePath}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 text-sm text-gray-900 hover:text-gray-600"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  Resume
                </a>
              )}
              {applicant.portfolioPath && (
                <a
                  href={applicant.portfolioPath}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 text-sm text-gray-900 hover:text-gray-600"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                  Portfolio File
                </a>
              )}
              {applicant.portfolioUrl && (
                <a
                  href={applicant.portfolioUrl.startsWith('http') ? applicant.portfolioUrl : `https://${applicant.portfolioUrl}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 text-sm text-gray-900 hover:text-gray-600"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                  </svg>
                  Online Portfolio
                </a>
              )}
              {applicant.linkedIn && (
                <a
                  href={applicant.linkedIn.startsWith('http') ? applicant.linkedIn : `https://${applicant.linkedIn}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 text-sm text-gray-900 hover:text-gray-600"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                  </svg>
                  LinkedIn
                </a>
              )}
            </div>

            <div className="mt-4 pt-4 border-t border-gray-200">
              <Link
                to={`/applicants/${applicant.id}`}
                className="text-sm text-gray-900 hover:text-gray-600 font-medium"
              >
                View Full Profile &rarr;
              </Link>
            </div>
          </div>

          {/* Past Reviews */}
          {applicant.reviews.length > 0 && (
            <div className="card">
              <h3 className="text-sm font-display font-semibold text-gray-900 uppercase tracking-wide mb-3">
                Past Reviews ({applicant.reviews.length})
              </h3>
              <div className="space-y-3">
                {applicant.reviews.map((review) => (
                  <div key={review.id} className="p-2 bg-gray-50 rounded">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-medium text-gray-900">{review.reviewer.name}</p>
                      <div className="flex">
                        {[1, 2, 3, 4, 5].map((star) => (
                          <span
                            key={star}
                            className={`text-sm ${star <= review.rating ? 'text-gray-900' : 'text-gray-300'}`}
                          >
                            ★
                          </span>
                        ))}
                      </div>
                    </div>
                    {review.recommendation && (
                      <p className="text-xs text-gray-500 mt-0.5">
                        {recommendationLabels[review.recommendation] || review.recommendation}
                      </p>
                    )}
                    {review.comments && (
                      <p className="text-xs text-gray-600 mt-1 line-clamp-2">{review.comments}</p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Main Area — shown first on mobile */}
        <div className="space-y-4 order-1 lg:order-2">
          {/* Meeting Notes URL */}
          <div className="card">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-display font-semibold text-gray-900 uppercase tracking-wide">
                Meeting Notes Link
              </h3>
              {isAdminOrHM && !editingNotesUrl && (
                <button
                  onClick={() => {
                    setNotesUrlDraft(interview.notesUrl || '');
                    setEditingNotesUrl(true);
                  }}
                  className="text-xs text-gray-500 hover:text-gray-900"
                >
                  Edit
                </button>
              )}
            </div>
            {editingNotesUrl ? (
              <div className="flex gap-2">
                <input
                  type="url"
                  value={notesUrlDraft}
                  onChange={(e) => setNotesUrlDraft(e.target.value)}
                  placeholder="https://onenote.com/... or https://docs.google.com/..."
                  className="input flex-1 text-sm"
                />
                <button
                  onClick={saveNotesUrl}
                  disabled={savingNotesUrl}
                  className="btn btn-primary text-sm"
                >
                  {savingNotesUrl ? 'Saving...' : 'Save'}
                </button>
                <button
                  onClick={() => setEditingNotesUrl(false)}
                  className="btn btn-secondary text-sm"
                >
                  Cancel
                </button>
              </div>
            ) : interview.notesUrl ? (
              <a
                href={interview.notesUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 text-sm text-gray-900 hover:text-gray-600 font-medium"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                </svg>
                Open Meeting Notes
              </a>
            ) : (
              <p className="text-sm text-gray-400 italic">No meeting notes link set</p>
            )}
          </div>

          {/* Prep Notes */}
          {interview.notes && (
            <div className="card">
              <h3 className="text-sm font-display font-semibold text-gray-900 uppercase tracking-wide mb-2">
                Prep Notes
              </h3>
              <div
                className="text-sm text-gray-600 prose prose-sm max-w-none"
                dangerouslySetInnerHTML={{ __html: renderContent(interview.notes) }}
              />
            </div>
          )}

          {/* Participant Panels */}
          <div className="space-y-3">
            <h3 className="text-sm font-display font-semibold text-gray-900 uppercase tracking-wide">
              Participant Notes
            </h3>
            {interview.participants.map((participant) => {
              const isMe = participant.user.id === user?.id;

              if (isMe) {
                return (
                  <div key={participant.id} className="card border-2 border-gray-900">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <p className="font-medium text-gray-900">{participant.user.name}</p>
                        <span className="text-xs px-2 py-0.5 bg-gray-900 text-white rounded-full">You</span>
                      </div>
                      <div className="flex items-center gap-2">
                        {feedbackSaved && (
                          <span className="text-xs text-green-600 font-medium">Saved!</span>
                        )}
                        <button
                          onClick={saveFeedback}
                          disabled={savingFeedback}
                          className="btn btn-primary text-sm"
                        >
                          {savingFeedback ? 'Saving...' : 'Save'}
                        </button>
                      </div>
                    </div>

                    {/* Rating */}
                    <div className="mb-3">
                      <p className="text-xs text-gray-500 mb-1">Rating</p>
                      <div className="flex gap-1">
                        {[1, 2, 3, 4, 5].map((star) => (
                          <button
                            key={star}
                            type="button"
                            onClick={() => {
                              setMyRating(myRating === star ? null : star);
                              hasUnsavedEdits.current = true;
                            }}
                            className={`text-2xl transition-colors ${
                              myRating && star <= myRating ? 'text-gray-900' : 'text-gray-300 hover:text-gray-500'
                            }`}
                          >
                            ★
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Feedback editor */}
                    <RichTextEditor
                      value={myFeedback}
                      onChange={(html) => {
                        setMyFeedback(html);
                        hasUnsavedEdits.current = true;
                      }}
                      placeholder="Your interview notes and assessment..."
                      minHeight="150px"
                    />
                  </div>
                );
              }

              // Other participants — read-only
              return (
                <div key={participant.id} className="card">
                  <div className="flex items-center justify-between mb-2">
                    <p className="font-medium text-gray-900">{participant.user.name}</p>
                    {participant.rating && (
                      <div className="flex">
                        {[1, 2, 3, 4, 5].map((star) => (
                          <span
                            key={star}
                            className={`text-lg ${star <= participant.rating! ? 'text-gray-900' : 'text-gray-300'}`}
                          >
                            ★
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                  {participant.feedback ? (
                    <div
                      className="text-sm text-gray-600 prose prose-sm max-w-none"
                      dangerouslySetInnerHTML={{ __html: renderContent(participant.feedback) }}
                    />
                  ) : (
                    <p className="text-sm text-gray-400 italic">No feedback yet</p>
                  )}
                </div>
              );
            })}
          </div>

          {/* Action Bar — admin/HM only */}
          {isAdminOrHM && (
            <div className="card bg-gray-50">
              <h3 className="text-sm font-display font-semibold text-gray-900 uppercase tracking-wide mb-3">
                Actions
              </h3>
              <div className="flex flex-wrap items-center gap-3">
                {interview.status === 'scheduled' && (
                  <button
                    onClick={() => updateStatus('completed')}
                    disabled={savingStatus}
                    className="btn btn-primary text-sm"
                  >
                    {savingStatus ? 'Updating...' : 'Mark Complete'}
                  </button>
                )}
                {interview.status === 'completed' && (
                  <span className="text-sm text-green-600 font-medium">Interview completed</span>
                )}
                <div className="flex items-center gap-2">
                  <label className="text-sm text-gray-600">Outcome:</label>
                  <select
                    value={interview.outcome || ''}
                    onChange={(e) => updateOutcome(e.target.value)}
                    disabled={savingStatus}
                    className="input text-sm py-1.5"
                  >
                    <option value="">Not set</option>
                    <option value="advance">Advance</option>
                    <option value="hold">Hold</option>
                    <option value="reject">Reject</option>
                  </select>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
