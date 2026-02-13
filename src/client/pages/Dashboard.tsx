import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../lib/api';
import { PLATFORMS, getPlatformColorClasses, getPlatformTextColorClasses } from '../lib/platforms';
import Avatar from '../components/Avatar';

interface DashboardStats {
  jobs: { total: number; open: number };
  applicants: { total: number; new: number; inReview: number; generalPool: number };
  reviews: { total: number };
  events?: { total: number; upcoming: number };
  upcomingInterviews?: number;
  spamCount?: number;
}

interface UpcomingEvent {
  id: string;
  name: string;
  type: string;
  date: string;
  location: string | null;
  _count: { applicants: number };
}

interface PipelineApplicant {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  createdAt: string;
  job: { id: string; title: string } | null;
  interviews?: Array<{ id: string; scheduledAt: string; status: string }>;
  offers?: Array<{ id: string; status: string; createdAt: string }>;
  _count: { reviews: number };
}

interface PipelineStage {
  stage: string;
  count: number;
  applicants: PipelineApplicant[];
}

interface UpcomingInterview {
  id: string;
  scheduledAt: string;
  type: string;
  location: string | null;
  applicant: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
    job: { id: string; title: string } | null;
  };
  participants: Array<{ user: { id: string; name: string } }>;
  createdBy: { id: string; name: string };
}

interface Activity {
  recentApplicants: Array<{
    id: string;
    firstName: string;
    lastName: string;
    email: string;
    createdAt: string;
    job: { id: string; title: string } | null;
  }>;
  recentReviews: Array<{
    id: string;
    rating: number;
    createdAt: string;
    reviewer: { name: string };
    applicant: { id: string; firstName: string; lastName: string };
  }>;
}

interface SourceAnalytics {
  sourceBreakdown: Record<string, {
    total: number;
    hired: number;
    rejected: number;
  }>;
}

export default function Dashboard() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [pipeline, setPipeline] = useState<PipelineStage[]>([]);
  const [activity, setActivity] = useState<Activity | null>(null);
  const [sourceAnalytics, setSourceAnalytics] = useState<SourceAnalytics | null>(null);
  const [upcomingEvents, setUpcomingEvents] = useState<UpcomingEvent[]>([]);
  const [upcomingInterviews, setUpcomingInterviews] = useState<UpcomingInterview[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedStage, setExpandedStage] = useState<string | null>(null);
  const [draggedApplicant, setDraggedApplicant] = useState<{ id: string; fromStage: string } | null>(null);
  const [dropTargetStage, setDropTargetStage] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([
      api.get<DashboardStats>('/dashboard/stats'),
      api.get<PipelineStage[]>('/dashboard/pipeline'),
      api.get<Activity>('/dashboard/activity'),
      api.get<SourceAnalytics>('/dashboard/sources'),
      api.get<UpcomingEvent[]>('/dashboard/upcoming-events'),
    ])
      .then(([statsRes, pipelineRes, activityRes, sourcesRes, eventsRes]) => {
        setStats(statsRes.data);
        setPipeline(pipelineRes.data);
        setActivity(activityRes.data);
        setSourceAnalytics(sourcesRes.data);
        setUpcomingEvents(eventsRes.data);
      })
      .finally(() => setLoading(false));

    // Fetch separately so a failure doesn't block the entire dashboard
    api.get<UpcomingInterview[]>('/dashboard/upcoming-interviews')
      .then(res => setUpcomingInterviews(res.data))
      .catch(() => {});
  }, []);

  const refreshPipeline = async () => {
    try {
      const res = await api.get<PipelineStage[]>('/dashboard/pipeline');
      setPipeline(res.data);
    } catch { /* ignore */ }
  };

  const handleDrop = async (targetStage: string) => {
    if (!draggedApplicant || draggedApplicant.fromStage === targetStage) {
      setDraggedApplicant(null);
      setDropTargetStage(null);
      return;
    }
    try {
      await api.patch(`/applicants/${draggedApplicant.id}/stage`, { stage: targetStage });
      // Optimistic: move applicant in local state
      setPipeline(prev => {
        const fromIdx = prev.findIndex(s => s.stage === draggedApplicant.fromStage);
        const toIdx = prev.findIndex(s => s.stage === targetStage);
        if (fromIdx === -1 || toIdx === -1) return prev;
        const next = prev.map(s => ({ ...s, applicants: [...s.applicants], count: s.count }));
        const appIdx = next[fromIdx].applicants.findIndex(a => a.id === draggedApplicant.id);
        if (appIdx !== -1) {
          const [moved] = next[fromIdx].applicants.splice(appIdx, 1);
          next[fromIdx].count--;
          next[toIdx].applicants.unshift(moved);
          next[toIdx].count++;
        }
        return next;
      });
      // Also refresh from server to keep counts accurate
      refreshPipeline();
    } catch { /* ignore - will refresh */ }
    setDraggedApplicant(null);
    setDropTargetStage(null);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-black dark:border-white"></div>
      </div>
    );
  }

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

  const stageColors: Record<string, string> = {
    fair_intake: 'bg-teal-400 dark:bg-teal-500',
    new: 'bg-neutral-300 dark:bg-neutral-600',
    screening: 'bg-neutral-400 dark:bg-neutral-500',
    interview: 'bg-neutral-500 dark:bg-neutral-400',
    offer: 'bg-neutral-600 dark:bg-neutral-300',
    hired: 'bg-black dark:bg-white',
    rejected: 'bg-red-500',
    holding: 'bg-yellow-300 dark:bg-yellow-500',
  };

  return (
    <div className="space-y-8">
      {/* Page Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-display font-bold text-neutral-900 dark:text-neutral-100 uppercase tracking-wide">Dashboard</h1>
          <p className="text-neutral-500 dark:text-neutral-400 mt-1">Welcome back. Here's an overview of your recruiting pipeline.</p>
        </div>
        {(stats?.spamCount ?? 0) > 0 && (
          <Link
            to="/applicants?spam=true"
            className="flex items-center gap-2 px-3 py-1.5 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded text-sm text-red-700 dark:text-red-300 hover:bg-red-100 dark:hover:bg-red-900/50 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4.5c-.77-.833-2.694-.833-3.464 0L3.34 16.5c-.77.833.192 2.5 1.732 2.5z" />
            </svg>
            {stats!.spamCount} spam
          </Link>
        )}
      </div>

      {/* Pipeline Overview */}
      <div className="card">
        <h2 className="text-lg font-display font-semibold text-neutral-900 dark:text-neutral-100 mb-4 uppercase tracking-wide">Hiring Pipeline</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-4">
          {pipeline.map((stage) => (
            <div
              key={stage.stage}
              className={`text-center cursor-pointer rounded-lg p-2 transition-all ${
                expandedStage === stage.stage
                  ? 'ring-2 ring-black dark:ring-white bg-neutral-50 dark:bg-neutral-700'
                  : dropTargetStage === stage.stage && draggedApplicant
                    ? 'ring-2 ring-blue-500 bg-blue-50 dark:bg-blue-900/30'
                    : 'hover:bg-neutral-50 dark:hover:bg-neutral-700'
              }`}
              onClick={() => setExpandedStage(expandedStage === stage.stage ? null : stage.stage)}
              onDragOver={(e) => {
                e.preventDefault();
                setDropTargetStage(stage.stage);
              }}
              onDragLeave={() => setDropTargetStage(null)}
              onDrop={(e) => {
                e.preventDefault();
                handleDrop(stage.stage);
              }}
            >
              <div className={`w-full h-2 ${stageColors[stage.stage]} rounded-full mb-2`}></div>
              <p className="text-2xl font-display font-bold text-neutral-900 dark:text-neutral-100">{stage.count}</p>
              <p className="text-sm text-neutral-500 dark:text-neutral-400">{stageLabels[stage.stage]}</p>
              <svg
                className={`w-4 h-4 mx-auto mt-1 text-neutral-400 dark:text-neutral-500 ${expandedStage === stage.stage ? 'scale-y-[-1]' : ''}`}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </div>
          ))}
        </div>

        {/* Expanded stage applicant preview */}
        {expandedStage && (() => {
          const stageData = pipeline.find(s => s.stage === expandedStage);
          if (!stageData) return null;
          return (
            <div className="mt-4 pt-4 border-t dark:border-neutral-700">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <h3 className="text-sm font-display font-semibold text-neutral-900 dark:text-neutral-100 uppercase tracking-wide">
                    {stageLabels[expandedStage]} — Top {Math.min(stageData.applicants.length, 5)} of {stageData.count}
                  </h3>
                  <p className="text-xs text-neutral-400 dark:text-neutral-500 mt-0.5">Drag applicants to a stage above to move them</p>
                </div>
                <Link
                  to={`/applicants?stage=${expandedStage}`}
                  className="text-sm text-neutral-900 dark:text-neutral-100 hover:text-neutral-600 dark:hover:text-neutral-400 font-medium"
                >
                  View all &rarr;
                </Link>
              </div>
              {stageData.applicants.length === 0 ? (
                <p className="text-sm text-neutral-500 dark:text-neutral-400 py-2">No applicants in this stage</p>
              ) : (
                <div className="space-y-1">
                  {stageData.applicants.map((applicant) => (
                    <div
                      key={applicant.id}
                      draggable
                      onDragStart={(e) => {
                        setDraggedApplicant({ id: applicant.id, fromStage: expandedStage! });
                        e.dataTransfer.effectAllowed = 'move';
                      }}
                      onDragEnd={() => {
                        setDraggedApplicant(null);
                        setDropTargetStage(null);
                      }}
                      className={`flex items-center justify-between p-3 rounded transition-colors cursor-grab active:cursor-grabbing ${
                        draggedApplicant?.id === applicant.id ? 'opacity-50 bg-neutral-100 dark:bg-neutral-700' : 'hover:bg-neutral-50 dark:hover:bg-neutral-700'
                      }`}
                    >
                      <Link
                        to={`/applicants/${applicant.id}`}
                        className="flex items-center gap-3 min-w-0 flex-1"
                        onClick={(e) => { if (draggedApplicant) e.preventDefault(); }}
                      >
                        <Avatar name={`${applicant.firstName} ${applicant.lastName}`} email={applicant.email} size={36} />
                        <div className="min-w-0">
                          <p className="font-medium text-neutral-900 dark:text-neutral-100 truncate">
                            {applicant.firstName} {applicant.lastName}
                          </p>
                          <p className="text-sm text-neutral-500 dark:text-neutral-400 truncate">
                            {applicant.job?.title || 'General Application'}
                          </p>
                        </div>
                      </Link>
                      <div className="flex items-center gap-3 shrink-0 ml-4">
                        {(() => {
                          const iv = applicant.interviews?.[0];
                          if (!iv) return null;
                          const isCompleted = iv.status === 'completed';
                          const isScheduled = iv.status === 'scheduled';
                          return (
                            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium whitespace-nowrap ${
                              isCompleted ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
                                : isScheduled ? 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200'
                                : 'bg-neutral-100 text-neutral-600 dark:bg-neutral-700 dark:text-neutral-400'
                            }`}>
                              {isCompleted ? 'Interview Done' : isScheduled ? 'Interview ' + new Date(iv.scheduledAt).toLocaleDateString() : iv.status}
                            </span>
                          );
                        })()}
                        {(() => {
                          const offer = applicant.offers?.[0];
                          if (!offer) return null;
                          const offerColors: Record<string, string> = {
                            draft: 'bg-neutral-100 text-neutral-700 dark:bg-neutral-700 dark:text-neutral-300',
                            extended: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200',
                            accepted: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
                            declined: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
                            rescinded: 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200',
                          };
                          return (
                            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium whitespace-nowrap ${offerColors[offer.status] || 'bg-neutral-100 text-neutral-600 dark:bg-neutral-700 dark:text-neutral-400'}`}>
                              Offer: {offer.status}
                            </span>
                          );
                        })()}
                        <div className="text-right">
                          <p className="text-xs text-neutral-400 dark:text-neutral-500">
                            {new Date(applicant.createdAt).toLocaleDateString()}
                          </p>
                          <p className="text-xs text-neutral-400 dark:text-neutral-500">
                            {applicant._count.reviews} review{applicant._count.reviews !== 1 ? 's' : ''}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })()}
      </div>

      {/* Upcoming Interviews */}
      {upcomingInterviews.length > 0 && (
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-display font-semibold text-neutral-900 dark:text-neutral-100 uppercase tracking-wide">Your Upcoming Interviews</h2>
            <Link to="/applicants?stage=interview" className="text-sm text-neutral-900 dark:text-neutral-100 hover:text-neutral-600 dark:hover:text-neutral-400 font-medium">
              View all &rarr;
            </Link>
          </div>
          <div className="space-y-2">
            {upcomingInterviews.map((interview) => {
              const typeLabels: Record<string, string> = { in_person: 'In Person', video: 'Video', phone: 'Phone' };
              const date = new Date(interview.scheduledAt);
              return (
                <div
                  key={interview.id}
                  className="flex items-center justify-between p-4 border dark:border-neutral-700 rounded-lg hover:bg-neutral-50 dark:hover:bg-neutral-700 transition-colors"
                >
                  <Link
                    to={`/applicants/${interview.applicant.id}`}
                    className="flex items-center gap-3 min-w-0 flex-1"
                  >
                    <Avatar
                      name={`${interview.applicant.firstName} ${interview.applicant.lastName}`}
                      email={interview.applicant.email}
                      size={40}
                    />
                    <div>
                      <p className="font-medium text-neutral-900 dark:text-neutral-100">
                        {interview.applicant.firstName} {interview.applicant.lastName}
                      </p>
                      <p className="text-sm text-neutral-500 dark:text-neutral-400">
                        {interview.applicant.job?.title || 'General Application'}
                      </p>
                    </div>
                  </Link>
                  <div className="flex items-center gap-4 text-right">
                    <div>
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200">
                        {typeLabels[interview.type] || interview.type}
                      </span>
                      {interview.location && (
                        <p className="text-xs text-neutral-400 dark:text-neutral-500 mt-0.5">{interview.location}</p>
                      )}
                    </div>
                    <div>
                      <p className="text-sm font-medium text-neutral-900 dark:text-neutral-100">
                        {date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                      </p>
                      <p className="text-xs text-neutral-500 dark:text-neutral-400">
                        {date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
                      </p>
                    </div>
                    <Link
                      to={`/interviews/${interview.id}/live`}
                      className="text-xs px-2.5 py-1 bg-neutral-900 dark:bg-neutral-100 text-white dark:text-neutral-900 rounded hover:bg-neutral-700 dark:hover:bg-neutral-300 transition-colors whitespace-nowrap"
                    >
                      Live Notes
                    </Link>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Upcoming Events */}
      {upcomingEvents.length > 0 && (
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-display font-semibold text-neutral-900 dark:text-neutral-100 uppercase tracking-wide">Upcoming Events</h2>
            <Link to="/events" className="text-sm text-neutral-900 dark:text-neutral-100 hover:text-neutral-600 dark:hover:text-neutral-400 font-medium">
              View all &rarr;
            </Link>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {upcomingEvents.map((event) => (
              <Link
                key={event.id}
                to={`/events/${event.id}`}
                className="p-4 border dark:border-neutral-700 rounded-lg hover:bg-neutral-50 dark:hover:bg-neutral-700 transition-colors"
              >
                <p className="font-medium text-neutral-900 dark:text-neutral-100">{event.name}</p>
                <p className="text-sm text-neutral-500 dark:text-neutral-400 mt-1">
                  {new Date(event.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                  {event.location && ` — ${event.location}`}
                </p>
                <p className="text-sm text-neutral-400 dark:text-neutral-500 mt-2">
                  {event._count.applicants} applicant{event._count.applicants !== 1 ? 's' : ''}
                </p>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Recent Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Applicants */}
        <div className="card">
          <h2 className="text-lg font-display font-semibold text-neutral-900 dark:text-neutral-100 mb-4 uppercase tracking-wide">Recent Applicants</h2>
          <div className="space-y-3">
            {activity?.recentApplicants.slice(0, 5).map((applicant) => (
              <Link
                key={applicant.id}
                to={`/applicants/${applicant.id}`}
                className="flex items-center justify-between p-3 hover:bg-neutral-50 dark:hover:bg-neutral-700 rounded transition-colors"
              >
                <div className="flex items-center space-x-3">
                  <Avatar name={`${applicant.firstName} ${applicant.lastName}`} email={applicant.email} size={40} />
                  <div>
                    <p className="font-medium text-neutral-900 dark:text-neutral-100">
                      {applicant.firstName} {applicant.lastName}
                    </p>
                    <p className="text-sm text-neutral-500 dark:text-neutral-400">{applicant.job?.title || 'General Application'}</p>
                  </div>
                </div>
                <p className="text-xs text-neutral-400 dark:text-neutral-500">
                  {new Date(applicant.createdAt).toLocaleDateString()}
                </p>
              </Link>
            ))}
            {(!activity?.recentApplicants || activity.recentApplicants.length === 0) && (
              <p className="text-neutral-500 dark:text-neutral-400 text-center py-4">No recent applicants</p>
            )}
          </div>
        </div>

        {/* Recent Reviews */}
        <div className="card">
          <h2 className="text-lg font-display font-semibold text-neutral-900 dark:text-neutral-100 mb-4 uppercase tracking-wide">Recent Reviews</h2>
          <div className="space-y-3">
            {activity?.recentReviews.slice(0, 5).map((review) => (
              <Link
                key={review.id}
                to={`/applicants/${review.applicant.id}`}
                className="flex items-center justify-between p-3 hover:bg-neutral-50 dark:hover:bg-neutral-700 rounded transition-colors"
              >
                <div className="flex items-center space-x-3">
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
                  <div>
                    <p className="font-medium text-neutral-900 dark:text-neutral-100">
                      {review.applicant.firstName} {review.applicant.lastName}
                    </p>
                    <p className="text-sm text-neutral-500 dark:text-neutral-400">by {review.reviewer.name}</p>
                  </div>
                </div>
                <p className="text-xs text-neutral-400 dark:text-neutral-500">
                  {new Date(review.createdAt).toLocaleDateString()}
                </p>
              </Link>
            ))}
            {(!activity?.recentReviews || activity.recentReviews.length === 0) && (
              <p className="text-neutral-500 dark:text-neutral-400 text-center py-4">No recent reviews</p>
            )}
          </div>
        </div>
      </div>

      {/* Application Sources */}
      <div className="card">
        <h2 className="text-lg font-display font-semibold text-neutral-900 dark:text-neutral-100 mb-4 uppercase tracking-wide">
          Application Sources
        </h2>
        <p className="text-sm text-neutral-600 dark:text-neutral-400 mb-4">
          Track where your applicants are coming from and measure the effectiveness of each platform.
        </p>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
          {PLATFORMS.filter(p => ['website', 'linkedin', 'handshake', 'aiala', 'aiabr'].includes(p.id)).map((platform) => {
            // Find data for this platform from the analytics
            const sourceData = sourceAnalytics?.sourceBreakdown
              ? Object.entries(sourceAnalytics.sourceBreakdown).find(([source]) => {
                  const normalized = source.toLowerCase().trim();
                  return normalized === platform.name.toLowerCase() ||
                         normalized === platform.id ||
                         normalized.includes(platform.id);
                })
              : null;

            const data = sourceData ? sourceData[1] : { total: 0, hired: 0, rejected: 0 };
            const conversionRate = data.total > 0 ? ((data.hired / data.total) * 100).toFixed(1) : '0.0';
            const colorClasses = getPlatformColorClasses(platform.color);
            const textColorClasses = getPlatformTextColorClasses(platform.color);

            return (
              <div key={platform.id} className={`border rounded-lg p-4 ${colorClasses}`}>
                <div className="flex items-center justify-between mb-2">
                  <p className={`text-sm font-semibold ${textColorClasses}`}>
                    {platform.name}
                  </p>
                </div>
                <p className={`text-3xl font-display font-bold ${textColorClasses} mb-3`}>
                  {data.total}
                </p>
                <div className="space-y-1.5 text-xs text-neutral-700 dark:text-neutral-300">
                  <div className="flex justify-between">
                    <span className="font-medium">Hired:</span>
                    <span className="font-semibold">{data.hired}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="font-medium">Rejected:</span>
                    <span className="font-semibold">{data.rejected}</span>
                  </div>
                  <div className="flex justify-between pt-1.5 border-t border-neutral-300 dark:border-neutral-600">
                    <span className="font-medium">Conversion:</span>
                    <span className="font-bold">{conversionRate}%</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
