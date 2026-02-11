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
}

interface UpcomingEvent {
  id: string;
  name: string;
  type: string;
  date: string;
  location: string | null;
  _count: { applicants: number };
}

interface PipelineStage {
  stage: string;
  count: number;
  applicants: Array<{
    id: string;
    firstName: string;
    lastName: string;
    job: { id: string; title: string } | null;
    _count: { reviews: number };
  }>;
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
  const [loading, setLoading] = useState(true);
  const [expandedStage, setExpandedStage] = useState<string | null>(null);

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
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-black"></div>
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
    fair_intake: 'bg-teal-400',
    new: 'bg-gray-300',
    screening: 'bg-gray-400',
    interview: 'bg-gray-500',
    offer: 'bg-gray-600',
    hired: 'bg-black',
    rejected: 'bg-red-500',
    holding: 'bg-yellow-300',
  };

  return (
    <div className="space-y-8">
      {/* Page Header */}
      <div>
        <h1 className="text-3xl font-display font-bold text-gray-900 uppercase tracking-wide">Dashboard</h1>
        <p className="text-gray-500 mt-1">Welcome back. Here's an overview of your recruiting pipeline.</p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6">
        <div className="card">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-500">Open Jobs</p>
              <p className="text-3xl font-display font-bold text-gray-900 mt-1">{stats?.jobs.open}</p>
            </div>
            <div className="w-12 h-12 bg-gray-100 rounded flex items-center justify-center">
              <svg className="w-6 h-6 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
            </div>
          </div>
          <Link to="/jobs" className="text-sm text-gray-900 hover:text-gray-600 mt-4 inline-block font-medium">
            View all jobs &rarr;
          </Link>
        </div>

        <div className="card">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-500">Total Applicants</p>
              <p className="text-3xl font-display font-bold text-gray-900 mt-1">{stats?.applicants.total}</p>
            </div>
            <div className="w-12 h-12 bg-gray-100 rounded flex items-center justify-center">
              <svg className="w-6 h-6 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
            </div>
          </div>
          <Link to="/applicants" className="text-sm text-gray-900 hover:text-gray-600 mt-4 inline-block font-medium">
            View all applicants &rarr;
          </Link>
        </div>

        <div className="card">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-500">New Applicants</p>
              <p className="text-3xl font-display font-bold text-gray-900 mt-1">{stats?.applicants.new}</p>
            </div>
            <div className="w-12 h-12 bg-gray-100 rounded flex items-center justify-center">
              <svg className="w-6 h-6 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
              </svg>
            </div>
          </div>
          <Link to="/applicants?stage=new" className="text-sm text-gray-900 hover:text-gray-600 mt-4 inline-block font-medium">
            Review new applicants &rarr;
          </Link>
        </div>

        <div className="card">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-500">In Review</p>
              <p className="text-3xl font-display font-bold text-gray-900 mt-1">{stats?.applicants.inReview}</p>
            </div>
            <div className="w-12 h-12 bg-gray-100 rounded flex items-center justify-center">
              <svg className="w-6 h-6 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
              </svg>
            </div>
          </div>
          <p className="text-sm text-gray-500 mt-4">{stats?.reviews.total} total reviews</p>
        </div>

        <div className="card">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-500">Upcoming Interviews</p>
              <p className="text-3xl font-display font-bold text-gray-900 mt-1">{stats?.upcomingInterviews ?? 0}</p>
            </div>
            <div className="w-12 h-12 bg-gray-100 rounded flex items-center justify-center">
              <svg className="w-6 h-6 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            </div>
          </div>
          <Link to="/applicants?stage=interview" className="text-sm text-gray-900 hover:text-gray-600 mt-4 inline-block font-medium">
            View interviews &rarr;
          </Link>
        </div>
      </div>

      {/* Pipeline Overview */}
      <div className="card">
        <h2 className="text-lg font-display font-semibold text-gray-900 mb-4 uppercase tracking-wide">Hiring Pipeline</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-4">
          {pipeline.map((stage) => (
            <div
              key={stage.stage}
              className={`text-center cursor-pointer rounded-lg p-2 transition-all ${
                expandedStage === stage.stage
                  ? 'ring-2 ring-black bg-gray-50'
                  : 'hover:bg-gray-50'
              }`}
              onClick={() => setExpandedStage(expandedStage === stage.stage ? null : stage.stage)}
            >
              <div className={`w-full h-2 ${stageColors[stage.stage]} rounded-full mb-2`}></div>
              <p className="text-2xl font-display font-bold text-gray-900">{stage.count}</p>
              <p className="text-sm text-gray-500">{stageLabels[stage.stage]}</p>
            </div>
          ))}
        </div>

        {/* Expanded stage applicant preview */}
        {expandedStage && (() => {
          const stageData = pipeline.find(s => s.stage === expandedStage);
          if (!stageData) return null;
          return (
            <div className="mt-4 pt-4 border-t">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-display font-semibold text-gray-900 uppercase tracking-wide">
                  {stageLabels[expandedStage]} — Top {Math.min(stageData.applicants.length, 5)} of {stageData.count}
                </h3>
                <Link
                  to={`/applicants?stage=${expandedStage}`}
                  className="text-sm text-gray-900 hover:text-gray-600 font-medium"
                >
                  View all &rarr;
                </Link>
              </div>
              {stageData.applicants.length === 0 ? (
                <p className="text-sm text-gray-500 py-2">No applicants in this stage</p>
              ) : (
                <div className="space-y-2">
                  {stageData.applicants.map((applicant) => (
                    <Link
                      key={applicant.id}
                      to={`/applicants/${applicant.id}`}
                      className="flex items-center justify-between p-3 hover:bg-gray-50 rounded transition-colors"
                    >
                      <div>
                        <p className="font-medium text-gray-900">
                          {applicant.firstName} {applicant.lastName}
                        </p>
                        <p className="text-sm text-gray-500">
                          {applicant.job?.title || 'General Application'}
                        </p>
                      </div>
                      <p className="text-sm text-gray-400">
                        {applicant._count.reviews} review{applicant._count.reviews !== 1 ? 's' : ''}
                      </p>
                    </Link>
                  ))}
                </div>
              )}
            </div>
          );
        })()}
      </div>

      {/* Recent Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Applicants */}
        <div className="card">
          <h2 className="text-lg font-display font-semibold text-gray-900 mb-4 uppercase tracking-wide">Recent Applicants</h2>
          <div className="space-y-3">
            {activity?.recentApplicants.slice(0, 5).map((applicant) => (
              <Link
                key={applicant.id}
                to={`/applicants/${applicant.id}`}
                className="flex items-center justify-between p-3 hover:bg-gray-50 rounded transition-colors"
              >
                <div className="flex items-center space-x-3">
                  <Avatar name={`${applicant.firstName} ${applicant.lastName}`} email={applicant.email} size={40} />
                  <div>
                    <p className="font-medium text-gray-900">
                      {applicant.firstName} {applicant.lastName}
                    </p>
                    <p className="text-sm text-gray-500">{applicant.job?.title || 'General Application'}</p>
                  </div>
                </div>
                <p className="text-xs text-gray-400">
                  {new Date(applicant.createdAt).toLocaleDateString()}
                </p>
              </Link>
            ))}
            {(!activity?.recentApplicants || activity.recentApplicants.length === 0) && (
              <p className="text-gray-500 text-center py-4">No recent applicants</p>
            )}
          </div>
        </div>

        {/* Recent Reviews */}
        <div className="card">
          <h2 className="text-lg font-display font-semibold text-gray-900 mb-4 uppercase tracking-wide">Recent Reviews</h2>
          <div className="space-y-3">
            {activity?.recentReviews.slice(0, 5).map((review) => (
              <Link
                key={review.id}
                to={`/applicants/${review.applicant.id}`}
                className="flex items-center justify-between p-3 hover:bg-gray-50 rounded transition-colors"
              >
                <div className="flex items-center space-x-3">
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
                  <div>
                    <p className="font-medium text-gray-900">
                      {review.applicant.firstName} {review.applicant.lastName}
                    </p>
                    <p className="text-sm text-gray-500">by {review.reviewer.name}</p>
                  </div>
                </div>
                <p className="text-xs text-gray-400">
                  {new Date(review.createdAt).toLocaleDateString()}
                </p>
              </Link>
            ))}
            {(!activity?.recentReviews || activity.recentReviews.length === 0) && (
              <p className="text-gray-500 text-center py-4">No recent reviews</p>
            )}
          </div>
        </div>
      </div>

      {/* Upcoming Events */}
      {upcomingEvents.length > 0 && (
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-display font-semibold text-gray-900 uppercase tracking-wide">Upcoming Events</h2>
            <Link to="/events" className="text-sm text-gray-900 hover:text-gray-600 font-medium">
              View all &rarr;
            </Link>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {upcomingEvents.map((event) => (
              <Link
                key={event.id}
                to={`/events/${event.id}`}
                className="p-4 border rounded-lg hover:bg-gray-50 transition-colors"
              >
                <p className="font-medium text-gray-900">{event.name}</p>
                <p className="text-sm text-gray-500 mt-1">
                  {new Date(event.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                  {event.location && ` — ${event.location}`}
                </p>
                <p className="text-sm text-gray-400 mt-2">
                  {event._count.applicants} applicant{event._count.applicants !== 1 ? 's' : ''}
                </p>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Application Sources */}
      <div className="card">
        <h2 className="text-lg font-display font-semibold text-gray-900 mb-4 uppercase tracking-wide">
          Application Sources
        </h2>
        <p className="text-sm text-gray-600 mb-4">
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
                <div className="space-y-1.5 text-xs text-gray-700">
                  <div className="flex justify-between">
                    <span className="font-medium">Hired:</span>
                    <span className="font-semibold">{data.hired}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="font-medium">Rejected:</span>
                    <span className="font-semibold">{data.rejected}</span>
                  </div>
                  <div className="flex justify-between pt-1.5 border-t border-gray-300">
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
