import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { api } from '../lib/api';
import Avatar from '../components/Avatar';
import Pagination from '../components/Pagination';
import { PaginatedResponse, isPaginated } from '../lib/pagination';

interface EventAttendee {
  id: string;
  user: { id: string; name: string; email: string };
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
  job_fair: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
  campus_visit: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200',
  info_session: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
};

export default function Events() {
  const { user: currentUser } = useAuth();
  const [events, setEvents] = useState<RecruitmentEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const pageSize = 25;

  const canManage = currentUser?.role === 'admin' || currentUser?.role === 'hiring_manager';

  useEffect(() => {
    fetchEvents();
  }, [page]);

  const fetchEvents = async () => {
    try {
      const params = new URLSearchParams();
      params.append('page', String(page));
      params.append('pageSize', String(pageSize));
      const res = await api.get<PaginatedResponse<RecruitmentEvent> | RecruitmentEvent[]>(`/events?${params.toString()}`);
      if (isPaginated(res.data)) {
        setEvents(res.data.data);
        setTotal(res.data.total);
        setTotalPages(res.data.totalPages);
      } else {
        setEvents(res.data);
        setTotal(res.data.length);
        setTotalPages(1);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:justify-between sm:items-start">
        <div>
          <h1 className="text-3xl font-display font-bold text-neutral-900 dark:text-neutral-100 uppercase tracking-wide">Events</h1>
          <p className="text-neutral-500 dark:text-neutral-400 mt-1">Recruitment events, job fairs, and campus visits</p>
        </div>
        {canManage && (
          <button onClick={() => setShowCreateModal(true)} className="btn btn-primary">
            + Create Event
          </button>
        )}
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-black dark:border-white"></div>
        </div>
      ) : events.length === 0 ? (
        <div className="card text-center py-12">
          <p className="text-neutral-500 dark:text-neutral-400">No events found</p>
        </div>
      ) : (
        <>
        {/* Mobile card-rows */}
        <div className="md:hidden space-y-2">
          {events.map((event) => (
            <Link
              key={event.id}
              to={`/events/${event.id}`}
              className="card-row"
            >
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="font-medium text-neutral-900 dark:text-neutral-100 truncate">{event.name}</p>
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium shrink-0 ${typeBadgeStyles[event.type] || 'bg-neutral-100 text-neutral-800 dark:bg-neutral-700 dark:text-neutral-300'}`}>
                      {typeLabels[event.type] || event.type}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 mt-0.5 text-sm text-neutral-500 dark:text-neutral-400">
                    {event.university && <span className="truncate">{event.university}</span>}
                    {event.university && <span>&middot;</span>}
                    <span className="shrink-0">{new Date(event.date).toLocaleDateString()}</span>
                    <span>&middot;</span>
                    <span className="shrink-0">{event._count.applicants} applicants</span>
                  </div>
                </div>
                <span className="text-neutral-400 dark:text-neutral-500 text-sm shrink-0">&rsaquo;</span>
              </div>
            </Link>
          ))}
        </div>

        {/* Desktop table */}
        <div className="hidden md:block card overflow-hidden p-0">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-neutral-50 dark:bg-neutral-800">
                <tr className="text-left text-sm text-neutral-500 dark:text-neutral-400">
                  <th className="px-6 py-4 font-medium">Event</th>
                  <th className="px-6 py-4 font-medium">Type</th>
                  <th className="px-6 py-4 font-medium">Date</th>
                  <th className="px-6 py-4 font-medium">Location</th>
                  <th className="px-6 py-4 font-medium">Applicants</th>
                  <th className="px-6 py-4 font-medium">Attendees</th>
                  <th className="px-6 py-4 font-medium"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100 dark:divide-neutral-700">
                {events.map((event) => (
                  <tr key={event.id} className="hover:bg-neutral-50 dark:hover:bg-neutral-700">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <p className="font-medium text-neutral-900 dark:text-neutral-100">{event.name}</p>
                        {event.publishToWebsite && (
                          <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-300">
                            Website
                          </span>
                        )}
                      </div>
                      {event.university && (
                        <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-0.5">{event.university}</p>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${typeBadgeStyles[event.type] || 'bg-neutral-100 text-neutral-800 dark:bg-neutral-700 dark:text-neutral-300'}`}>
                        {typeLabels[event.type] || event.type}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm text-neutral-500 dark:text-neutral-400">
                      {new Date(event.date).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4 text-sm text-neutral-500 dark:text-neutral-400">
                      {event.location || '—'}
                    </td>
                    <td className="px-6 py-4">
                      <span className="font-medium">{event._count.applicants}</span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-1">
                        {event.attendees.slice(0, 3).map((a) => (
                          <div key={a.id} title={a.user.name}>
                            <Avatar name={a.user.name} email={a.user.email} size={28} />
                          </div>
                        ))}
                        {event.attendees.length > 3 && (
                          <span className="text-xs text-neutral-500 dark:text-neutral-400 ml-1">
                            +{event.attendees.length - 3}
                          </span>
                        )}
                        {event.attendees.length === 0 && (
                          <span className="text-sm text-neutral-400 dark:text-neutral-500">None</span>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <Link
                        to={`/events/${event.id}`}
                        className="text-neutral-900 hover:text-neutral-600 dark:text-neutral-100 dark:hover:text-neutral-400 text-sm font-medium"
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
        </>
      )}

      <Pagination page={page} totalPages={totalPages} total={total} pageSize={pageSize} onPageChange={setPage} />

      {showCreateModal && (
        <EventFormModal
          onClose={() => setShowCreateModal(false)}
          onSaved={() => {
            setShowCreateModal(false);
            fetchEvents();
          }}
        />
      )}
    </div>
  );
}

function EventFormModal({
  event,
  onClose,
  onSaved,
}: {
  event?: RecruitmentEvent;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [users, setUsers] = useState<User[]>([]);
  const [name, setName] = useState(event?.name || '');
  const [type, setType] = useState(event?.type || 'job_fair');
  const [date, setDate] = useState(event ? new Date(event.date).toISOString().split('T')[0] : '');
  const [location, setLocation] = useState(event?.location || '');
  const [notes, setNotes] = useState(event?.notes || '');
  const [university, setUniversity] = useState(event?.university || '');
  const [eventUrl, setEventUrl] = useState(event?.eventUrl || '');
  const [description, setDescription] = useState(event?.description || '');
  const [publishToWebsite, setPublishToWebsite] = useState(event?.publishToWebsite || false);
  const [selectedAttendees, setSelectedAttendees] = useState<Set<string>>(
    new Set(event?.attendees.map(a => a.user.id) || [])
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    api.get<User[]>('/users').then(res => setUsers(res.data)).catch(() => {});
  }, []);

  const toggleAttendee = (userId: string) => {
    setSelectedAttendees(prev => {
      const next = new Set(prev);
      if (next.has(userId)) next.delete(userId);
      else next.add(userId);
      return next;
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const payload = {
        name,
        type,
        date,
        location: location || null,
        notes: notes || null,
        university: university || null,
        eventUrl: eventUrl || null,
        description: description || null,
        publishToWebsite,
        attendeeIds: Array.from(selectedAttendees),
      };

      if (event) {
        await api.put(`/events/${event.id}`, payload);
        // Also update attendees separately
        await api.put(`/events/${event.id}/attendees`, { attendeeIds: payload.attendeeIds });
      } else {
        await api.post('/events', payload);
      }
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-neutral-800 rounded-lg w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white dark:bg-neutral-800 border-b dark:border-neutral-700 px-6 py-4 flex justify-between items-center">
          <h2 className="text-xl font-display font-bold uppercase tracking-wide">
            {event ? 'Edit Event' : 'Create Event'}
          </h2>
          <button onClick={onClose} className="text-neutral-400 hover:text-neutral-600 dark:text-neutral-500 dark:hover:text-neutral-300">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 dark:bg-red-900/30 dark:border-red-800 dark:text-red-300 px-4 py-3 rounded text-sm">
              {error}
            </div>
          )}

          <div>
            <label className="label">Event Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="input"
              placeholder="LSU College of Design Job Fair 2026"
              required
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="label">Type</label>
              <select value={type} onChange={(e) => setType(e.target.value)} className="input">
                <option value="job_fair">Job Fair</option>
                <option value="campus_visit">Campus Visit</option>
                <option value="info_session">Info Session</option>
              </select>
            </div>
            <div>
              <label className="label">Date</label>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="input"
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="label">Location</label>
              <input
                type="text"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                className="input"
                placeholder="LSU Student Union"
              />
            </div>
            <div>
              <label className="label">University / Institution</label>
              <input
                type="text"
                value={university}
                onChange={(e) => setUniversity(e.target.value)}
                className="input"
                placeholder="Louisiana State University"
              />
            </div>
          </div>

          <div>
            <label className="label">Event URL</label>
            <input
              type="url"
              value={eventUrl}
              onChange={(e) => setEventUrl(e.target.value)}
              className="input"
              placeholder="https://..."
            />
          </div>

          <div>
            <label className="label">Public Description</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="input min-h-[80px]"
              placeholder="Brief description shown on the website..."
            />
          </div>

          <div>
            <label className="label">Notes (Internal)</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="input min-h-[80px]"
              placeholder="Internal notes about the event..."
            />
          </div>

          <div className="flex items-center gap-3 py-1">
            <input
              type="checkbox"
              id="publishToWebsite"
              checked={publishToWebsite}
              onChange={(e) => setPublishToWebsite(e.target.checked)}
              className="h-4 w-4 rounded border-neutral-300 dark:border-neutral-600"
            />
            <label htmlFor="publishToWebsite" className="text-sm font-medium text-neutral-900 dark:text-neutral-100">
              Publish to website
            </label>
            <span className="text-xs text-neutral-400 dark:text-neutral-500">Show this event on the public careers page</span>
          </div>

          <div>
            <label className="label">Attendees</label>
            <div className="border dark:border-neutral-700 rounded divide-y dark:divide-neutral-700 max-h-[200px] overflow-y-auto">
              {users.map((u) => (
                <div key={u.id} className="flex items-center justify-between px-4 py-2">
                  <div className="flex items-center gap-3">
                    <input
                      type="checkbox"
                      checked={selectedAttendees.has(u.id)}
                      onChange={() => toggleAttendee(u.id)}
                      className="h-4 w-4 rounded border-neutral-300 dark:border-neutral-600"
                    />
                    <div>
                      <p className="text-sm font-medium text-neutral-900 dark:text-neutral-100">{u.name}</p>
                      <p className="text-xs text-neutral-500 dark:text-neutral-400">{u.email}</p>
                    </div>
                  </div>
                  <span className="text-xs text-neutral-400 dark:text-neutral-500 capitalize">{u.role.replace('_', ' ')}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-4">
            <button type="button" onClick={onClose} className="btn btn-secondary">Cancel</button>
            <button type="submit" disabled={loading} className="btn btn-primary">
              {loading ? 'Saving...' : event ? 'Save Changes' : 'Create Event'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export { EventFormModal };
