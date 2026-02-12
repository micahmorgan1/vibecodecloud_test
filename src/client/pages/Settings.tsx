import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { api } from '../lib/api';
import RichTextEditor from '../components/RichTextEditor';

interface Job {
  id: string;
  title: string;
  status: string;
}

interface Reviewer {
  id: string;
  name: string;
  email: string;
}

interface UserWithRole {
  id: string;
  name: string;
  email: string;
  role: string;
}

interface EventOption {
  id: string;
  name: string;
  date: string;
}

interface SubOptions {
  jobs: { id: string; title: string }[];
  departments: string[];
  offices: { id: string; name: string }[];
  events: EventOption[];
}

interface NotificationSubItem {
  id: string;
  type: string;
  value: string;
}

const roleLabel = (role: string) => {
  const labels: Record<string, string> = {
    admin: 'Admin',
    hiring_manager: 'Hiring Manager',
    reviewer: 'Reviewer',
  };
  return labels[role] || role;
};

const roleBadge = (role: string) => {
  const styles: Record<string, string> = {
    admin: 'bg-gray-900 text-white',
    hiring_manager: 'bg-blue-100 text-blue-800',
    reviewer: 'bg-green-100 text-green-800',
  };
  return styles[role] || 'bg-gray-100 text-gray-800';
};

// --- Tabs ---

const TABS = [
  { id: 'content', label: 'Site Content' },
  { id: 'templates', label: 'Email Templates' },
  { id: 'access', label: 'Access Control' },
  { id: 'notifications', label: 'Notifications' },
];

// --- Site Content (dropdown selector) ---

const SITE_CONTENT_OPTIONS = [
  { key: 'about_whlc', label: 'About WHLC', description: 'Appears on job listing pages and the apply page. Describe the firm, culture, and benefits of working at WHLC.' },
  { key: 'positions_intro', label: 'Positions Intro', description: 'Appears above the list of available positions on the careers page.' },
  { key: 'events_intro', label: 'Events Intro', description: 'Appears above the list of upcoming events on the careers page.' },
];

function SiteContentEditor() {
  const [selectedKey, setSelectedKey] = useState(SITE_CONTENT_OPTIONS[0].key);
  const [value, setValue] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');

  const selected = SITE_CONTENT_OPTIONS.find(o => o.key === selectedKey)!;

  useEffect(() => {
    setLoading(true);
    setSaved(false);
    setError('');
    (async () => {
      try {
        const res = await api.get<{ key: string; value: string }>(`/settings/${selectedKey}`);
        setValue(res.data.value || '');
      } catch {
        setValue('');
      } finally {
        setLoading(false);
      }
    })();
  }, [selectedKey]);

  const handleSave = async () => {
    setSaving(true);
    setError('');
    setSaved(false);
    try {
      await api.put(`/settings/${selectedKey}`, { value });
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="card">
      <h2 className="text-lg font-display font-semibold uppercase tracking-wide mb-1">Site Content</h2>
      <p className="text-sm text-gray-500 mb-4">Public text blocks displayed on the careers page and job listings.</p>

      <div className="space-y-4">
        <div>
          <label className="label">Section</label>
          <select
            value={selectedKey}
            onChange={(e) => setSelectedKey(e.target.value)}
            className="input"
          >
            {SITE_CONTENT_OPTIONS.map((opt) => (
              <option key={opt.key} value={opt.key}>{opt.label}</option>
            ))}
          </select>
        </div>

        <p className="text-xs text-gray-400">{selected.description}</p>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded text-sm">
            {error}
          </div>
        )}
        {saved && (
          <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded text-sm">
            Saved successfully.
          </div>
        )}

        {loading ? (
          <div className="flex items-center justify-center h-32">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-black"></div>
          </div>
        ) : (
          <>
            <RichTextEditor
              key={selectedKey}
              value={value}
              onChange={setValue}
              minHeight="200px"
            />
            <div className="flex justify-end">
              <button onClick={handleSave} disabled={saving} className="btn btn-primary">
                {saving ? 'Saving...' : 'Save'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// --- Email Templates (dropdown selector) ---

const TEMPLATE_OPTIONS = [
  {
    type: 'thank_you',
    label: 'Thank You Auto-Responder',
    description: 'Automatically sent when an applicant submits an application.',
    variables: ['firstName', 'lastName', 'jobTitle'],
  },
  {
    type: 'event_thank_you',
    label: 'Event Thank You Auto-Responder',
    description: 'Automatically sent when an applicant is added via fair intake.',
    variables: ['firstName', 'lastName', 'eventName'],
  },
  {
    type: 'review_request',
    label: 'Review Request',
    description: 'Sent to users when an admin or hiring manager requests their review of an applicant.',
    variables: ['recipientName', 'applicantName', 'jobTitle', 'senderName', 'applicantUrl'],
  },
  {
    type: 'rejection',
    label: 'Default Rejection Letter',
    description: 'Pre-fills the rejection letter when a manager rejects an applicant. Can still be edited at send time.',
    variables: ['firstName', 'lastName', 'jobTitle'],
  },
];

function EmailTemplateEditor() {
  const [selectedType, setSelectedType] = useState(TEMPLATE_OPTIONS[0].type);
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');

  const selected = TEMPLATE_OPTIONS.find(o => o.type === selectedType)!;

  useEffect(() => {
    setLoading(true);
    setSaved(false);
    setError('');
    (async () => {
      try {
        const res = await api.get<{ subject: string; body: string }>(`/email-settings/templates/${selectedType}`);
        setSubject(res.data.subject);
        setBody(res.data.body);
      } catch {
        setSubject('');
        setBody('');
        setError('Failed to load template');
      } finally {
        setLoading(false);
      }
    })();
  }, [selectedType]);

  const handleSave = async () => {
    setSaving(true);
    setError('');
    setSaved(false);
    try {
      await api.put(`/email-settings/templates/${selectedType}`, { subject, body });
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save template');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="card">
      <h2 className="text-lg font-display font-semibold uppercase tracking-wide mb-1">Email Templates</h2>
      <p className="text-sm text-gray-500 mb-4">Auto-responders and notification emails sent to applicants.</p>

      <div className="space-y-4">
        <div>
          <label className="label">Template</label>
          <select
            value={selectedType}
            onChange={(e) => setSelectedType(e.target.value)}
            className="input"
          >
            {TEMPLATE_OPTIONS.map((opt) => (
              <option key={opt.type} value={opt.type}>{opt.label}</option>
            ))}
          </select>
        </div>

        <p className="text-xs text-gray-400">{selected.description}</p>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded text-sm">
            {error}
          </div>
        )}
        {saved && (
          <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded text-sm">
            Template saved successfully.
          </div>
        )}

        {loading ? (
          <div className="flex items-center justify-center h-32">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-black"></div>
          </div>
        ) : (
          <>
            <div>
              <label className="label">Subject</label>
              <input
                type="text"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                className="input"
              />
            </div>

            <div>
              <label className="label">Body</label>
              <RichTextEditor
                key={selectedType}
                value={body}
                onChange={setBody}
                minHeight="200px"
              />
            </div>

            <div className="flex items-center justify-between">
              <p className="text-xs text-gray-400">
                Variables:{' '}
                {selected.variables.map((v, i) => (
                  <span key={v}>
                    {i > 0 && ' '}
                    <code className="bg-gray-100 px-1 rounded">{`{{${v}}}`}</code>
                  </span>
                ))}
              </p>
              <button
                onClick={handleSave}
                disabled={saving || !subject.trim() || !body.trim()}
                className="btn btn-primary"
              >
                {saving ? 'Saving...' : 'Save Template'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// --- Reviewer Access ---

function ReviewerAccess() {
  const [mode, setMode] = useState<'jobs' | 'events'>('jobs');
  const [jobs, setJobs] = useState<Job[]>([]);
  const [events, setEvents] = useState<EventOption[]>([]);
  const [reviewers, setReviewers] = useState<Reviewer[]>([]);
  const [selectedId, setSelectedId] = useState('');
  const [assignedIds, setAssignedIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [loadingAssignments, setLoadingAssignments] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    (async () => {
      try {
        const [jobsRes, reviewersRes, eventsRes] = await Promise.all([
          api.get<Job[]>('/jobs?status=open'),
          api.get<Reviewer[]>('/email-settings/reviewers'),
          api.get<EventOption[]>('/events'),
        ]);
        setJobs(jobsRes.data);
        setReviewers(reviewersRes.data);
        setEvents(Array.isArray(eventsRes.data) ? eventsRes.data : (eventsRes.data as { data: EventOption[] }).data || []);
      } catch {
        setError('Failed to load data');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  // Reset selection when mode changes
  useEffect(() => {
    setSelectedId('');
    setAssignedIds(new Set());
    setSaved(false);
    setError('');
  }, [mode]);

  useEffect(() => {
    if (!selectedId) {
      setAssignedIds(new Set());
      return;
    }
    (async () => {
      setLoadingAssignments(true);
      try {
        const endpoint = mode === 'jobs'
          ? `/email-settings/jobs/${selectedId}/reviewers`
          : `/email-settings/events/${selectedId}/reviewers`;
        const res = await api.get<{ userId: string }[]>(endpoint);
        setAssignedIds(new Set(res.data.map((a) => a.userId)));
      } catch {
        setError('Failed to load assignments');
      } finally {
        setLoadingAssignments(false);
      }
    })();
  }, [selectedId, mode]);

  const toggleAssignment = (userId: string) => {
    setAssignedIds((prev) => {
      const next = new Set(prev);
      if (next.has(userId)) {
        next.delete(userId);
      } else {
        next.add(userId);
      }
      return next;
    });
  };

  const handleSave = async () => {
    setSaving(true);
    setError('');
    setSaved(false);
    try {
      const endpoint = mode === 'jobs'
        ? `/email-settings/jobs/${selectedId}/reviewers`
        : `/email-settings/events/${selectedId}/reviewers`;
      await api.put(endpoint, {
        userIds: Array.from(assignedIds),
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save assignments');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="card">
        <h2 className="text-lg font-display font-semibold uppercase tracking-wide mb-2">Reviewer Access</h2>
        <div className="flex items-center justify-center h-32">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-black"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="card">
      <h2 className="text-lg font-display font-semibold uppercase tracking-wide mb-1">Reviewer Access</h2>
      <p className="text-sm text-gray-500 mb-4">
        Control which jobs and events each reviewer can see. Reviewers only see applicants for their assigned jobs and events.
      </p>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded text-sm mb-4">
          {error}
        </div>
      )}
      {saved && (
        <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded text-sm mb-4">
          Assignments saved successfully.
        </div>
      )}

      <div className="space-y-4">
        {/* Mode toggle */}
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setMode('jobs')}
            className={`px-4 py-2 text-sm font-medium rounded border ${mode === 'jobs' ? 'bg-black text-white border-black' : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-50'}`}
          >
            Job Access
          </button>
          <button
            type="button"
            onClick={() => setMode('events')}
            className={`px-4 py-2 text-sm font-medium rounded border ${mode === 'events' ? 'bg-black text-white border-black' : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-50'}`}
          >
            Event Access
          </button>
        </div>

        <div>
          <label className="label">{mode === 'jobs' ? 'Select Job' : 'Select Event'}</label>
          <select
            value={selectedId}
            onChange={(e) => setSelectedId(e.target.value)}
            className="input"
          >
            <option value="">-- Choose {mode === 'jobs' ? 'a job' : 'an event'} --</option>
            {mode === 'jobs'
              ? jobs.map((job) => (
                  <option key={job.id} value={job.id}>{job.title}</option>
                ))
              : events.map((event) => (
                  <option key={event.id} value={event.id}>
                    {event.name} ({new Date(event.date).toLocaleDateString()})
                  </option>
                ))
            }
          </select>
        </div>

        {selectedId && (
          <>
            {loadingAssignments ? (
              <div className="flex items-center justify-center h-20">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-black"></div>
              </div>
            ) : reviewers.length === 0 ? (
              <p className="text-sm text-gray-500">No reviewers found. Create reviewer accounts in the Users page first.</p>
            ) : (
              <div className="border rounded divide-y">
                {reviewers.map((reviewer) => (
                  <div key={reviewer.id} className="flex items-center gap-3 px-4 py-3">
                    <input
                      type="checkbox"
                      checked={assignedIds.has(reviewer.id)}
                      onChange={() => toggleAssignment(reviewer.id)}
                      className="h-4 w-4 rounded border-gray-300"
                    />
                    <div>
                      <p className="text-sm font-medium text-gray-900">{reviewer.name}</p>
                      <p className="text-xs text-gray-500">{reviewer.email}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div className="flex justify-end">
              <button onClick={handleSave} disabled={saving} className="btn btn-primary">
                {saving ? 'Saving...' : 'Save Access'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// --- Notification Subscriptions (new per-user system) ---

function NotificationSubscriptions() {
  const [options, setOptions] = useState<SubOptions>({ jobs: [], departments: [], offices: [], events: [] });
  const [checkedJobs, setCheckedJobs] = useState<Set<string>>(new Set());
  const [checkedDepts, setCheckedDepts] = useState<Set<string>>(new Set());
  const [checkedOffices, setCheckedOffices] = useState<Set<string>>(new Set());
  const [checkedEvents, setCheckedEvents] = useState<Set<string>>(new Set());
  const [allNotifications, setAllNotifications] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    (async () => {
      try {
        const [optRes, subsRes] = await Promise.all([
          api.get<SubOptions>('/email-settings/notification-subs/options'),
          api.get<NotificationSubItem[]>('/email-settings/notification-subs'),
        ]);
        setOptions(optRes.data);

        // Populate checked sets from existing subs
        const jobs = new Set<string>();
        const depts = new Set<string>();
        const offices = new Set<string>();
        const events = new Set<string>();
        let hasAll = false;
        for (const sub of subsRes.data) {
          if (sub.type === 'all') hasAll = true;
          else if (sub.type === 'job') jobs.add(sub.value);
          else if (sub.type === 'department') depts.add(sub.value);
          else if (sub.type === 'office') offices.add(sub.value);
          else if (sub.type === 'event') events.add(sub.value);
        }
        setAllNotifications(hasAll);
        setCheckedJobs(jobs);
        setCheckedDepts(depts);
        setCheckedOffices(offices);
        setCheckedEvents(events);
      } catch {
        setError('Failed to load data');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const toggle = (set: Set<string>, setFn: (s: Set<string>) => void, value: string) => {
    const next = new Set(set);
    if (next.has(value)) next.delete(value);
    else next.add(value);
    setFn(next);
  };

  const handleSave = async () => {
    setSaving(true);
    setError('');
    setSaved(false);
    try {
      const subscriptions: { type: string; value: string }[] = [];
      if (allNotifications) {
        subscriptions.push({ type: 'all', value: '*' });
      } else {
        checkedJobs.forEach(v => subscriptions.push({ type: 'job', value: v }));
        checkedDepts.forEach(v => subscriptions.push({ type: 'department', value: v }));
        checkedOffices.forEach(v => subscriptions.push({ type: 'office', value: v }));
        checkedEvents.forEach(v => subscriptions.push({ type: 'event', value: v }));
      }

      await api.put('/email-settings/notification-subs', { subscriptions });
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save subscriptions');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="card">
        <h2 className="text-lg font-display font-semibold uppercase tracking-wide mb-2">My Notification Subscriptions</h2>
        <div className="flex items-center justify-center h-32">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-black"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="card">
      <h2 className="text-lg font-display font-semibold uppercase tracking-wide mb-1">My Notification Subscriptions</h2>
      <p className="text-sm text-gray-500 mb-4">
        Choose what triggers in-app notifications for you. Subscribe to specific jobs, entire departments, or offices.
      </p>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded text-sm mb-4">
          {error}
        </div>
      )}
      {saved && (
        <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded text-sm mb-4">
          Subscriptions saved successfully.
        </div>
      )}

      <div className="space-y-6">
        {/* All Notifications Toggle */}
        <div className="border rounded px-4 py-3 bg-gray-50">
          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={allNotifications}
              onChange={() => setAllNotifications(!allNotifications)}
              className="h-4 w-4 rounded border-gray-300"
            />
            <div>
              <span className="text-sm font-semibold text-gray-900">All Notifications</span>
              <p className="text-xs text-gray-500">Receive notifications for all applicants you have access to, including future jobs.</p>
            </div>
          </label>
        </div>

        {/* Job Subscriptions */}
        <div className={allNotifications ? 'opacity-40 pointer-events-none' : ''}>
          <h3 className="text-sm font-semibold text-gray-700 mb-2">Jobs</h3>
          {options.jobs.length === 0 ? (
            <p className="text-sm text-gray-400">No open jobs available.</p>
          ) : (
            <div className="border rounded divide-y max-h-64 overflow-y-auto">
              {options.jobs.map((job) => (
                <label key={job.id} className="flex items-center gap-3 px-4 py-2.5 hover:bg-gray-50 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={checkedJobs.has(job.id)}
                    onChange={() => toggle(checkedJobs, setCheckedJobs, job.id)}
                    className="h-4 w-4 rounded border-gray-300"
                  />
                  <span className="text-sm text-gray-900">{job.title}</span>
                </label>
              ))}
            </div>
          )}
        </div>

        {/* Department Subscriptions */}
        <div className={allNotifications ? 'opacity-40 pointer-events-none' : ''}>
          <h3 className="text-sm font-semibold text-gray-700 mb-2">Departments</h3>
          {options.departments.length === 0 ? (
            <p className="text-sm text-gray-400">No departments found.</p>
          ) : (
            <div className="border rounded divide-y">
              {options.departments.map((dept) => (
                <label key={dept} className="flex items-center gap-3 px-4 py-2.5 hover:bg-gray-50 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={checkedDepts.has(dept)}
                    onChange={() => toggle(checkedDepts, setCheckedDepts, dept)}
                    className="h-4 w-4 rounded border-gray-300"
                  />
                  <span className="text-sm text-gray-900">{dept}</span>
                </label>
              ))}
            </div>
          )}
        </div>

        {/* Office Subscriptions */}
        <div className={allNotifications ? 'opacity-40 pointer-events-none' : ''}>
          <h3 className="text-sm font-semibold text-gray-700 mb-2">Offices</h3>
          {options.offices.length === 0 ? (
            <p className="text-sm text-gray-400">No offices found.</p>
          ) : (
            <div className="border rounded divide-y">
              {options.offices.map((office) => (
                <label key={office.id} className="flex items-center gap-3 px-4 py-2.5 hover:bg-gray-50 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={checkedOffices.has(office.id)}
                    onChange={() => toggle(checkedOffices, setCheckedOffices, office.id)}
                    className="h-4 w-4 rounded border-gray-300"
                  />
                  <span className="text-sm text-gray-900">{office.name}</span>
                </label>
              ))}
            </div>
          )}
        </div>

        {/* Event Subscriptions */}
        <div className={allNotifications ? 'opacity-40 pointer-events-none' : ''}>
          <h3 className="text-sm font-semibold text-gray-700 mb-2">Events</h3>
          <p className="text-xs text-gray-400 mb-2">Get notified when applicants are added via fair intake for these events.</p>
          {options.events.length === 0 ? (
            <p className="text-sm text-gray-400">No events found.</p>
          ) : (
            <div className="border rounded divide-y max-h-64 overflow-y-auto">
              {options.events.map((event) => (
                <label key={event.id} className="flex items-center gap-3 px-4 py-2.5 hover:bg-gray-50 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={checkedEvents.has(event.id)}
                    onChange={() => toggle(checkedEvents, setCheckedEvents, event.id)}
                    className="h-4 w-4 rounded border-gray-300"
                  />
                  <div>
                    <span className="text-sm text-gray-900">{event.name}</span>
                    <span className="text-xs text-gray-400 ml-2">{new Date(event.date).toLocaleDateString()}</span>
                  </div>
                </label>
              ))}
            </div>
          )}
        </div>

        <div className="flex justify-end">
          <button onClick={handleSave} disabled={saving} className="btn btn-primary">
            {saving ? 'Saving...' : 'Save Subscriptions'}
          </button>
        </div>
      </div>
    </div>
  );
}

// --- Legacy Notification Subscriptions (admin per-job per-user management) ---

function LegacyNotificationSubscriptions() {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [allUsers, setAllUsers] = useState<UserWithRole[]>([]);
  const [selectedJobId, setSelectedJobId] = useState('');
  const [subscribedIds, setSubscribedIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [loadingSubs, setLoadingSubs] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    (async () => {
      try {
        const [jobsRes, usersRes] = await Promise.all([
          api.get<Job[]>('/jobs?status=open'),
          api.get<UserWithRole[]>('/email-settings/users'),
        ]);
        setJobs(jobsRes.data);
        setAllUsers(usersRes.data);
      } catch {
        setError('Failed to load data');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  useEffect(() => {
    if (!selectedJobId) {
      setSubscribedIds(new Set());
      return;
    }
    (async () => {
      setLoadingSubs(true);
      try {
        const res = await api.get<{ userId: string }[]>(`/email-settings/jobs/${selectedJobId}/subscribers`);
        setSubscribedIds(new Set(res.data.map((s) => s.userId)));
      } catch {
        setError('Failed to load subscribers');
      } finally {
        setLoadingSubs(false);
      }
    })();
  }, [selectedJobId]);

  const toggleSubscription = (userId: string) => {
    setSubscribedIds((prev) => {
      const next = new Set(prev);
      if (next.has(userId)) {
        next.delete(userId);
      } else {
        next.add(userId);
      }
      return next;
    });
  };

  const handleSave = async () => {
    setSaving(true);
    setError('');
    setSaved(false);
    try {
      await api.put(`/email-settings/jobs/${selectedJobId}/subscribers`, {
        userIds: Array.from(subscribedIds),
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save subscribers');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="card mt-6">
        <h2 className="text-lg font-display font-semibold uppercase tracking-wide mb-2">Per-Job Email Notifications</h2>
        <div className="flex items-center justify-center h-32">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-black"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="card mt-6">
      <h2 className="text-lg font-display font-semibold uppercase tracking-wide mb-1">Per-Job Email Notifications</h2>
      <p className="text-sm text-gray-500 mb-4">
        Choose which users receive an email notification when a new application is submitted for each job.
      </p>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded text-sm mb-4">
          {error}
        </div>
      )}
      {saved && (
        <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded text-sm mb-4">
          Subscribers saved successfully.
        </div>
      )}

      <div className="space-y-4">
        <div>
          <label className="label">Select Job</label>
          <select
            value={selectedJobId}
            onChange={(e) => setSelectedJobId(e.target.value)}
            className="input"
          >
            <option value="">-- Choose a job --</option>
            {jobs.map((job) => (
              <option key={job.id} value={job.id}>{job.title}</option>
            ))}
          </select>
        </div>

        {selectedJobId && (
          <>
            {loadingSubs ? (
              <div className="flex items-center justify-center h-20">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-black"></div>
              </div>
            ) : allUsers.length === 0 ? (
              <p className="text-sm text-gray-500">No users found.</p>
            ) : (
              <div className="border rounded divide-y">
                {allUsers.map((user) => (
                  <div key={user.id} className="flex items-center justify-between px-4 py-3">
                    <div className="flex items-center gap-3">
                      <input
                        type="checkbox"
                        checked={subscribedIds.has(user.id)}
                        onChange={() => toggleSubscription(user.id)}
                        className="h-4 w-4 rounded border-gray-300"
                      />
                      <div>
                        <p className="text-sm font-medium text-gray-900">{user.name}</p>
                        <p className="text-xs text-gray-500">{user.email}</p>
                      </div>
                    </div>
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${roleBadge(user.role)}`}>
                      {roleLabel(user.role)}
                    </span>
                  </div>
                ))}
              </div>
            )}

            <div className="flex justify-end">
              <button onClick={handleSave} disabled={saving} className="btn btn-primary">
                {saving ? 'Saving...' : 'Save Subscribers'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// --- Main Page ---

export default function Settings() {
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab = searchParams.get('tab') || 'content';
  const setTab = (tab: string) => setSearchParams({ tab }, { replace: true });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-display font-bold text-gray-900 uppercase tracking-wide">Settings</h1>
        <p className="text-gray-500 mt-1">Manage site content, email templates, access control, and notification preferences</p>
      </div>

      {/* Tab Bar */}
      <div className="flex gap-1 flex-wrap">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setTab(tab.id)}
            className={`px-4 py-2 rounded text-sm font-medium font-display uppercase tracking-wider transition-colors ${
              activeTab === tab.id
                ? 'bg-black text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      {activeTab === 'content' && <SiteContentEditor />}
      {activeTab === 'templates' && <EmailTemplateEditor />}
      {activeTab === 'access' && <ReviewerAccess />}
      {activeTab === 'notifications' && (
        <>
          <NotificationSubscriptions />
          <LegacyNotificationSubscriptions />
        </>
      )}
    </div>
  );
}
