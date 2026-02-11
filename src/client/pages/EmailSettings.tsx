import { useState, useEffect } from 'react';
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
  const [jobs, setJobs] = useState<Job[]>([]);
  const [reviewers, setReviewers] = useState<Reviewer[]>([]);
  const [selectedJobId, setSelectedJobId] = useState('');
  const [assignedIds, setAssignedIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [loadingAssignments, setLoadingAssignments] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    (async () => {
      try {
        const [jobsRes, reviewersRes] = await Promise.all([
          api.get<Job[]>('/jobs?status=open'),
          api.get<Reviewer[]>('/email-settings/reviewers'),
        ]);
        setJobs(jobsRes.data);
        setReviewers(reviewersRes.data);
      } catch {
        setError('Failed to load data');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  useEffect(() => {
    if (!selectedJobId) {
      setAssignedIds(new Set());
      return;
    }
    (async () => {
      setLoadingAssignments(true);
      try {
        const res = await api.get<{ userId: string }[]>(`/email-settings/jobs/${selectedJobId}/reviewers`);
        setAssignedIds(new Set(res.data.map((a) => a.userId)));
      } catch {
        setError('Failed to load assignments');
      } finally {
        setLoadingAssignments(false);
      }
    })();
  }, [selectedJobId]);

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
      await api.put(`/email-settings/jobs/${selectedJobId}/reviewers`, {
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
        <h2 className="text-lg font-display font-semibold uppercase tracking-wide mb-2">Reviewer Job Access</h2>
        <div className="flex items-center justify-center h-32">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-black"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="card">
      <h2 className="text-lg font-display font-semibold uppercase tracking-wide mb-1">Reviewer Job Access</h2>
      <p className="text-sm text-gray-500 mb-4">
        Control which jobs each reviewer can see. Reviewers only see applicants for their assigned jobs.
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

// --- Notification Subscriptions ---

function NotificationSubscriptions() {
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
      <div className="card">
        <h2 className="text-lg font-display font-semibold uppercase tracking-wide mb-2">New Application Notifications</h2>
        <div className="flex items-center justify-center h-32">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-black"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="card">
      <h2 className="text-lg font-display font-semibold uppercase tracking-wide mb-1">New Application Notifications</h2>
      <p className="text-sm text-gray-500 mb-4">
        Choose which users receive an email when a new application is submitted for each job. This applies to all roles.
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

export default function EmailSettings() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-display font-bold text-gray-900 uppercase tracking-wide">Settings</h1>
        <p className="text-gray-500 mt-1">Manage site content, email templates, reviewer access, and notification preferences</p>
      </div>

      <SiteContentEditor />

      <EmailTemplateEditor />

      <ReviewerAccess />

      <NotificationSubscriptions />
    </div>
  );
}
