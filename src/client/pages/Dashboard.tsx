import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../lib/api';

interface DashboardStats {
  jobs: { total: number; open: number };
  applicants: { total: number; new: number; inReview: number };
  reviews: { total: number };
}

interface PipelineStage {
  stage: string;
  count: number;
  applicants: Array<{
    id: string;
    firstName: string;
    lastName: string;
    job: { id: string; title: string };
    _count: { reviews: number };
  }>;
}

interface Activity {
  recentApplicants: Array<{
    id: string;
    firstName: string;
    lastName: string;
    createdAt: string;
    job: { id: string; title: string };
  }>;
  recentReviews: Array<{
    id: string;
    rating: number;
    createdAt: string;
    reviewer: { name: string };
    applicant: { id: string; firstName: string; lastName: string };
  }>;
}

export default function Dashboard() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [pipeline, setPipeline] = useState<PipelineStage[]>([]);
  const [activity, setActivity] = useState<Activity | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      api.get<DashboardStats>('/dashboard/stats'),
      api.get<PipelineStage[]>('/dashboard/pipeline'),
      api.get<Activity>('/dashboard/activity'),
    ])
      .then(([statsRes, pipelineRes, activityRes]) => {
        setStats(statsRes.data);
        setPipeline(pipelineRes.data);
        setActivity(activityRes.data);
      })
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  const stageLabels: Record<string, string> = {
    new: 'New',
    screening: 'Screening',
    interview: 'Interview',
    offer: 'Offer',
    hired: 'Hired',
    rejected: 'Rejected',
  };

  const stageColors: Record<string, string> = {
    new: 'bg-blue-500',
    screening: 'bg-yellow-500',
    interview: 'bg-purple-500',
    offer: 'bg-green-500',
    hired: 'bg-emerald-600',
    rejected: 'bg-red-500',
  };

  return (
    <div className="space-y-8">
      {/* Page Header */}
      <div>
        <h1 className="text-3xl font-display font-bold text-gray-900">Dashboard</h1>
        <p className="text-gray-600 mt-1">Welcome back. Here's an overview of your recruiting pipeline.</p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="card">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Open Jobs</p>
              <p className="text-3xl font-bold text-gray-900 mt-1">{stats?.jobs.open}</p>
            </div>
            <div className="w-12 h-12 bg-primary-100 rounded-lg flex items-center justify-center">
              <span className="text-2xl">💼</span>
            </div>
          </div>
          <Link to="/jobs" className="text-sm text-primary-600 hover:text-primary-700 mt-4 inline-block">
            View all jobs →
          </Link>
        </div>

        <div className="card">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Total Applicants</p>
              <p className="text-3xl font-bold text-gray-900 mt-1">{stats?.applicants.total}</p>
            </div>
            <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
              <span className="text-2xl">👥</span>
            </div>
          </div>
          <Link to="/applicants" className="text-sm text-primary-600 hover:text-primary-700 mt-4 inline-block">
            View all applicants →
          </Link>
        </div>

        <div className="card">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">New Applicants</p>
              <p className="text-3xl font-bold text-gray-900 mt-1">{stats?.applicants.new}</p>
            </div>
            <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
              <span className="text-2xl">🆕</span>
            </div>
          </div>
          <Link to="/applicants?stage=new" className="text-sm text-primary-600 hover:text-primary-700 mt-4 inline-block">
            Review new applicants →
          </Link>
        </div>

        <div className="card">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">In Review</p>
              <p className="text-3xl font-bold text-gray-900 mt-1">{stats?.applicants.inReview}</p>
            </div>
            <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center">
              <span className="text-2xl">📋</span>
            </div>
          </div>
          <p className="text-sm text-gray-500 mt-4">{stats?.reviews.total} total reviews</p>
        </div>
      </div>

      {/* Pipeline Overview */}
      <div className="card">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Hiring Pipeline</h2>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          {pipeline.map((stage) => (
            <div key={stage.stage} className="text-center">
              <div className={`w-full h-2 ${stageColors[stage.stage]} rounded-full mb-2`}></div>
              <p className="text-2xl font-bold text-gray-900">{stage.count}</p>
              <p className="text-sm text-gray-600">{stageLabels[stage.stage]}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Recent Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Applicants */}
        <div className="card">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Recent Applicants</h2>
          <div className="space-y-3">
            {activity?.recentApplicants.slice(0, 5).map((applicant) => (
              <Link
                key={applicant.id}
                to={`/applicants/${applicant.id}`}
                className="flex items-center justify-between p-3 hover:bg-gray-50 rounded-lg transition-colors"
              >
                <div className="flex items-center space-x-3">
                  <div className="w-10 h-10 bg-brand-100 rounded-full flex items-center justify-center">
                    <span className="text-brand-700 font-medium">
                      {applicant.firstName[0]}{applicant.lastName[0]}
                    </span>
                  </div>
                  <div>
                    <p className="font-medium text-gray-900">
                      {applicant.firstName} {applicant.lastName}
                    </p>
                    <p className="text-sm text-gray-500">{applicant.job.title}</p>
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
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Recent Reviews</h2>
          <div className="space-y-3">
            {activity?.recentReviews.slice(0, 5).map((review) => (
              <Link
                key={review.id}
                to={`/applicants/${review.applicant.id}`}
                className="flex items-center justify-between p-3 hover:bg-gray-50 rounded-lg transition-colors"
              >
                <div className="flex items-center space-x-3">
                  <div className="flex">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <span
                        key={star}
                        className={`text-lg ${
                          star <= review.rating ? 'text-yellow-400' : 'text-gray-300'
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
    </div>
  );
}
