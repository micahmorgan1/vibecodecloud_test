import { useState, useEffect } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
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

export default function Applicants() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [applicants, setApplicants] = useState<Applicant[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState(searchParams.get('search') || '');
  const [stageFilter, setStageFilter] = useState(searchParams.get('stage') || '');

  const stages = ['new', 'screening', 'interview', 'offer', 'hired', 'rejected'];

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
      <div>
        <h1 className="text-3xl font-display font-bold text-gray-900 uppercase tracking-wide">Applicants</h1>
        <p className="text-gray-500 mt-1">Review and manage job applicants</p>
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
    </div>
  );
}
