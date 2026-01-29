import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { api } from '../lib/api';
import { useAuth } from '../context/AuthContext';
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
  yearsExperience: number | null;
  currentCompany: string | null;
  currentTitle: string | null;
  stage: string;
  source: string | null;
  createdAt: string;
  job: { id: string; title: string; department: string; location: string };
  reviews: Review[];
  notes: Note[];
}

const stages = ['new', 'screening', 'interview', 'offer', 'hired', 'rejected', 'holding'];
const stageLabels: Record<string, string> = {
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
  const [applicant, setApplicant] = useState<Applicant | null>(null);
  const [loading, setLoading] = useState(true);
  const [showReviewModal, setShowReviewModal] = useState(false);
  const [newNote, setNewNote] = useState('');
  const [addingNote, setAddingNote] = useState(false);
  const [viewingDocument, setViewingDocument] = useState<{ url: string; title: string } | null>(null);

  useEffect(() => {
    if (id) {
      fetchApplicant();
    }
  }, [id]);

  const fetchApplicant = async () => {
    try {
      const res = await api.get<Applicant>(`/applicants/${id}`);
      setApplicant(res.data);
    } finally {
      setLoading(false);
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

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-black"></div>
      </div>
    );
  }

  if (!applicant) {
    return (
      <div className="card text-center py-12">
        <p className="text-gray-500">Applicant not found</p>
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
    strong_yes: { label: 'Strong Yes', color: 'text-gray-900 font-bold' },
    yes: { label: 'Yes', color: 'text-gray-800' },
    maybe: { label: 'Maybe', color: 'text-gray-500' },
    no: { label: 'No', color: 'text-gray-400' },
    strong_no: { label: 'Strong No', color: 'text-gray-400 line-through' },
  };

  return (
    <div className="space-y-6">
      {/* Breadcrumb */}
      <nav className="text-sm text-gray-500">
        <Link to="/applicants" className="hover:text-gray-900">Applicants</Link>
        <span className="mx-2">/</span>
        <span className="text-gray-900">{applicant.firstName} {applicant.lastName}</span>
      </nav>

      {/* Header */}
      <div className="card">
        <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
          <div className="flex items-start gap-4">
            <div className="w-16 h-16 bg-gray-900 rounded-full flex items-center justify-center">
              <span className="text-white text-2xl font-medium">
                {applicant.firstName[0]}{applicant.lastName[0]}
              </span>
            </div>
            <div>
              <h1 className="text-2xl font-display font-bold text-gray-900 uppercase tracking-wide">
                {applicant.firstName} {applicant.lastName}
              </h1>
              <p className="text-gray-500">{applicant.email}</p>
              {applicant.phone && <p className="text-gray-400 text-sm">{applicant.phone}</p>}
              <div className="flex items-center gap-3 mt-2">
                {applicant.linkedIn && (
                  <a href={`https://${applicant.linkedIn}`} target="_blank" rel="noopener noreferrer" className="text-gray-900 hover:text-gray-600 text-sm font-medium">
                    LinkedIn
                  </a>
                )}
                {applicant.website && (
                  <a href={`https://${applicant.website}`} target="_blank" rel="noopener noreferrer" className="text-gray-900 hover:text-gray-600 text-sm font-medium">
                    Website
                  </a>
                )}
              </div>
            </div>
          </div>

          <div className="flex flex-col items-end gap-2">
            {getAverageRating() && (
              <div className="flex items-center gap-2">
                <span className="text-gray-900 text-xl">★</span>
                <span className="text-2xl font-display font-bold">{getAverageRating()}</span>
                <span className="text-gray-400">({applicant.reviews.length} reviews)</span>
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
        <div className="mt-6 pt-6 border-t border-gray-200">
          <p className="text-sm font-medium text-gray-700 mb-3">Application Stage</p>
          <div className="flex flex-wrap gap-2">
            {stages.map((stage) => (
              <button
                key={stage}
                onClick={() => updateStage(stage)}
                className={`px-4 py-2 rounded text-sm font-medium transition-colors ${
                  applicant.stage === stage
                    ? stage === 'rejected'
                      ? 'bg-gray-300 text-gray-700'
                      : stage === 'hired'
                      ? 'bg-black text-white'
                      : 'bg-gray-900 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                {stageLabels[stage]}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Application Info */}
          <div className="card">
            <h2 className="text-lg font-display font-semibold text-gray-900 mb-4 uppercase tracking-wide">Application Details</h2>
            <dl className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <dt className="text-sm text-gray-500">Position</dt>
                <dd className="font-medium">
                  <Link to={`/jobs/${applicant.job.id}`} className="text-gray-900 hover:text-gray-600">
                    {applicant.job.title}
                  </Link>
                </dd>
              </div>
              <div>
                <dt className="text-sm text-gray-500">Department</dt>
                <dd className="font-medium">{applicant.job.department}</dd>
              </div>
              {applicant.yearsExperience && (
                <div>
                  <dt className="text-sm text-gray-500">Years of Experience</dt>
                  <dd className="font-medium">{applicant.yearsExperience} years</dd>
                </div>
              )}
              {applicant.currentCompany && (
                <div>
                  <dt className="text-sm text-gray-500">Current Company</dt>
                  <dd className="font-medium">{applicant.currentCompany}</dd>
                </div>
              )}
              {applicant.currentTitle && (
                <div>
                  <dt className="text-sm text-gray-500">Current Title</dt>
                  <dd className="font-medium">{applicant.currentTitle}</dd>
                </div>
              )}
              {applicant.source && (
                <div>
                  <dt className="text-sm text-gray-500">Source</dt>
                  <dd className="font-medium">{applicant.source}</dd>
                </div>
              )}
              <div>
                <dt className="text-sm text-gray-500">Applied On</dt>
                <dd className="font-medium">{new Date(applicant.createdAt).toLocaleDateString()}</dd>
              </div>
            </dl>

            {/* Documents */}
            <div className="mt-6 pt-6 border-t border-gray-200">
              <h3 className="text-sm font-medium text-gray-900 mb-3">Documents</h3>
              <div className="flex flex-wrap gap-3">
                {applicant.resumePath && (
                  <button
                    onClick={() => setViewingDocument({ url: applicant.resumePath!, title: `Resume - ${applicant.firstName} ${applicant.lastName}` })}
                    className="flex items-center gap-2 px-4 py-2 bg-gray-900 text-white rounded hover:bg-gray-700 transition-colors"
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
                    className="flex items-center gap-2 px-4 py-2 bg-gray-900 text-white rounded hover:bg-gray-700 transition-colors"
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
                    className="flex items-center gap-2 px-4 py-2 bg-gray-100 rounded hover:bg-gray-200 transition-colors"
                  >
                    <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                    </svg>
                    Online Portfolio
                  </a>
                )}
              </div>
            </div>

            {/* Cover Letter */}
            {applicant.coverLetter && (
              <div className="mt-6 pt-6 border-t border-gray-200">
                <h3 className="text-sm font-medium text-gray-900 mb-3">Cover Letter</h3>
                <p className="text-gray-600 whitespace-pre-wrap">{applicant.coverLetter}</p>
              </div>
            )}
          </div>

          {/* Reviews */}
          <div className="card">
            <h2 className="text-lg font-display font-semibold text-gray-900 mb-4 uppercase tracking-wide">
              Reviews ({applicant.reviews.length})
            </h2>
            {applicant.reviews.length === 0 ? (
              <p className="text-gray-500 text-center py-4">No reviews yet</p>
            ) : (
              <div className="space-y-4">
                {applicant.reviews.map((review) => (
                  <div key={review.id} className="p-4 bg-gray-50 rounded border border-gray-100">
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <p className="font-medium text-gray-900">{review.reviewer.name}</p>
                        <p className="text-xs text-gray-500">
                          {new Date(review.createdAt).toLocaleDateString()}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="flex">
                          {[1, 2, 3, 4, 5].map((star) => (
                            <span
                              key={star}
                              className={`text-lg ${
                                star <= review.rating ? 'text-gray-900' : 'text-gray-300'
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
                        <div className="text-center p-2 bg-white rounded border border-gray-100">
                          <p className="text-xs text-gray-500">Technical</p>
                          <p className="font-medium">{review.technicalSkills}/5</p>
                        </div>
                      )}
                      {review.designAbility && (
                        <div className="text-center p-2 bg-white rounded border border-gray-100">
                          <p className="text-xs text-gray-500">Design</p>
                          <p className="font-medium">{review.designAbility}/5</p>
                        </div>
                      )}
                      {review.portfolioQuality && (
                        <div className="text-center p-2 bg-white rounded border border-gray-100">
                          <p className="text-xs text-gray-500">Portfolio</p>
                          <p className="font-medium">{review.portfolioQuality}/5</p>
                        </div>
                      )}
                      {review.communication && (
                        <div className="text-center p-2 bg-white rounded border border-gray-100">
                          <p className="text-xs text-gray-500">Communication</p>
                          <p className="font-medium">{review.communication}/5</p>
                        </div>
                      )}
                      {review.cultureFit && (
                        <div className="text-center p-2 bg-white rounded border border-gray-100">
                          <p className="text-xs text-gray-500">Culture Fit</p>
                          <p className="font-medium">{review.cultureFit}/5</p>
                        </div>
                      )}
                    </div>

                    {review.comments && (
                      <p className="text-gray-600 text-sm">{review.comments}</p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Sidebar - Notes */}
        <div className="space-y-6">
          <div className="card">
            <h2 className="text-lg font-display font-semibold text-gray-900 mb-4 uppercase tracking-wide">Notes</h2>

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
              <p className="text-gray-500 text-center py-4">No notes yet</p>
            ) : (
              <div className="space-y-3">
                {applicant.notes.map((note) => (
                  <div key={note.id} className="p-3 bg-gray-50 rounded border border-gray-100">
                    <p className="text-sm text-gray-600">{note.content}</p>
                    <p className="text-xs text-gray-400 mt-2">
                      {new Date(note.createdAt).toLocaleString()}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
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
      <p className="text-sm text-gray-700 mb-1">{label}</p>
      <div className="flex gap-1">
        {[1, 2, 3, 4, 5].map((star) => (
          <button
            key={star}
            type="button"
            onClick={() => onChange(value === star ? null : star)}
            className={`text-2xl transition-colors ${
              value && star <= value ? 'text-gray-900' : 'text-gray-300 hover:text-gray-500'
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
      <div className="bg-white rounded max-w-lg w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6 border-b border-gray-200 sticky top-0 bg-white">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-display font-semibold uppercase tracking-wide">
              {existingReview ? 'Edit Review' : 'Add Review'}
            </h2>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {error && (
            <div className="bg-gray-100 border border-gray-300 text-gray-800 px-4 py-3 rounded">
              {error}
            </div>
          )}

          {/* Overall Rating */}
          <div>
            <p className="text-sm font-medium text-gray-700 mb-2">Overall Rating *</p>
            <div className="flex gap-2">
              {[1, 2, 3, 4, 5].map((star) => (
                <button
                  key={star}
                  type="button"
                  onClick={() => setFormData({ ...formData, rating: star })}
                  className={`text-3xl transition-colors ${
                    star <= formData.rating ? 'text-gray-900' : 'text-gray-300 hover:text-gray-500'
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
            <p className="text-sm font-medium text-gray-700 mb-2">Recommendation</p>
            <div className="flex flex-wrap gap-2">
              {[
                { value: 'strong_yes', label: 'Strong Yes', color: 'bg-gray-900 text-white border-gray-900' },
                { value: 'yes', label: 'Yes', color: 'bg-gray-700 text-white border-gray-700' },
                { value: 'maybe', label: 'Maybe', color: 'bg-gray-300 text-gray-800 border-gray-400' },
                { value: 'no', label: 'No', color: 'bg-gray-100 text-gray-500 border-gray-300' },
                { value: 'strong_no', label: 'Strong No', color: 'bg-gray-50 text-gray-400 border-gray-200' },
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
                      : 'bg-gray-50 text-gray-600 border-gray-200 hover:bg-gray-100'
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
