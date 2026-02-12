import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { api } from '../lib/api';
import Avatar from '../components/Avatar';
import Pagination from '../components/Pagination';
import { PaginatedResponse, isPaginated } from '../lib/pagination';

interface Office {
  id: string;
  name: string;
}

interface User {
  id: string;
  name: string;
  email: string;
  role: string;
  createdAt: string;
  scopedDepartments: string[] | null;
  scopedOffices: string[] | null;
  scopeMode: string;
  eventAccess: boolean;
}

interface UserFormData {
  name: string;
  email: string;
  password: string;
  role: string;
  scopedDepartments: string[];
  scopedOffices: string[];
  scopeGlobal: boolean;
  scopeMode: string;
  eventAccess: boolean;
}

const roles = [
  { value: 'admin', label: 'Admin' },
  { value: 'hiring_manager', label: 'Hiring Manager' },
  { value: 'reviewer', label: 'Reviewer' },
];

const roleBadge = (role: string) => {
  const styles: Record<string, string> = {
    admin: 'bg-gray-900 text-white',
    hiring_manager: 'bg-blue-100 text-blue-800',
    reviewer: 'bg-green-100 text-green-800',
  };
  return styles[role] || 'bg-gray-100 text-gray-800';
};

const roleLabel = (role: string) => {
  const labels: Record<string, string> = {
    admin: 'Admin',
    hiring_manager: 'Hiring Manager',
    reviewer: 'Reviewer',
  };
  return labels[role] || role;
};

export default function Users() {
  const { user: currentUser } = useAuth();
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [formData, setFormData] = useState<UserFormData>({
    name: '',
    email: '',
    password: '',
    role: 'reviewer',
    scopedDepartments: [],
    scopedOffices: [],
    scopeGlobal: true,
    scopeMode: 'or',
    eventAccess: true,
  });
  const [formError, setFormError] = useState('');
  const [departments, setDepartments] = useState<string[]>([]);
  const [offices, setOffices] = useState<Office[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const pageSize = 25;

  const [officeMap, setOfficeMap] = useState<Record<string, string>>({});

  useEffect(() => {
    // Fetch offices for scope display
    api.get<Office[]>('/offices').then(res => {
      const map: Record<string, string> = {};
      for (const o of res.data) map[o.id] = o.name;
      setOfficeMap(map);
    }).catch(() => {});
  }, []);

  useEffect(() => {
    fetchUsers();
  }, [roleFilter, page]);

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (roleFilter) params.append('role', roleFilter);
      if (search) params.append('search', search);
      params.append('page', String(page));
      params.append('pageSize', String(pageSize));
      const queryString = params.toString();
      const res = await api.get<PaginatedResponse<User> | User[]>(`/users${queryString ? `?${queryString}` : ''}`);
      if (isPaginated(res.data)) {
        setUsers(res.data.data);
        setTotal(res.data.total);
        setTotalPages(res.data.totalPages);
      } else {
        setUsers(res.data);
        setTotal(res.data.length);
        setTotalPages(1);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    fetchUsers();
  };

  const fetchScopeOptions = async () => {
    try {
      const res = await api.get<{ departments: string[]; offices: Office[] }>('/email-settings/notification-subs/options');
      setDepartments(res.data.departments);
      setOffices(res.data.offices);
    } catch { /* ignore */ }
  };

  const openCreateModal = () => {
    setEditingUser(null);
    setFormData({ name: '', email: '', password: '', role: 'reviewer', scopedDepartments: [], scopedOffices: [], scopeGlobal: true, scopeMode: 'or', eventAccess: true });
    setFormError('');
    fetchScopeOptions();
    setShowModal(true);
  };

  const openEditModal = (user: User) => {
    setEditingUser(user);
    const isGlobal = !user.scopedDepartments && !user.scopedOffices;
    setFormData({
      name: user.name,
      email: user.email,
      password: '',
      role: user.role,
      scopedDepartments: user.scopedDepartments || [],
      scopedOffices: user.scopedOffices || [],
      scopeGlobal: isGlobal,
      scopeMode: user.scopeMode || 'or',
      eventAccess: user.eventAccess !== false,
    });
    setFormError('');
    fetchScopeOptions();
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setEditingUser(null);
    setFormError('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');
    setSubmitting(true);

    try {
      const scopeFields = formData.role === 'hiring_manager' && !formData.scopeGlobal
        ? { scopedDepartments: formData.scopedDepartments, scopedOffices: formData.scopedOffices, scopeMode: formData.scopeMode }
        : { scopedDepartments: null, scopedOffices: null, scopeMode: 'or' };
      const eventAccessField = formData.role === 'hiring_manager'
        ? { eventAccess: formData.eventAccess }
        : { eventAccess: true };

      if (editingUser) {
        const data: Record<string, unknown> = {
          name: formData.name,
          email: formData.email,
          role: formData.role,
          ...scopeFields,
          ...eventAccessField,
        };
        if (formData.password) {
          data.password = formData.password;
        }
        await api.put(`/users/${editingUser.id}`, data);
      } else {
        if (!formData.password) {
          setFormError('Password is required');
          setSubmitting(false);
          return;
        }
        await api.post('/users', { ...formData, ...scopeFields, ...eventAccessField });
      }
      closeModal();
      fetchUsers();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await api.delete(`/users/${id}`);
      setDeleteConfirm(null);
      fetchUsers();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to delete user');
      setDeleteConfirm(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-3xl font-display font-bold text-gray-900 uppercase tracking-wide">Users</h1>
          <p className="text-gray-500 mt-1">Manage system users and roles</p>
        </div>
        <button onClick={openCreateModal} className="btn btn-primary">
          + Create User
        </button>
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
          {[
            { value: '', label: 'All' },
            { value: 'admin', label: 'Admin' },
            { value: 'hiring_manager', label: 'Hiring Manager' },
            { value: 'reviewer', label: 'Reviewer' },
          ].map((filter) => (
            <button
              key={filter.value}
              onClick={() => { setRoleFilter(filter.value); setPage(1); }}
              className={`px-3 py-1.5 rounded text-sm font-medium transition-colors ${
                roleFilter === filter.value
                  ? 'bg-black text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              {filter.label}
            </button>
          ))}
        </div>
      </div>

      {/* Users Table */}
      {loading ? (
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-black"></div>
        </div>
      ) : users.length === 0 ? (
        <div className="card text-center py-12">
          <p className="text-gray-500">No users found</p>
        </div>
      ) : (
        <div className="card overflow-hidden p-0">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr className="text-left text-sm text-gray-500">
                  <th className="px-6 py-4 font-medium">Name</th>
                  <th className="px-6 py-4 font-medium">Email</th>
                  <th className="px-6 py-4 font-medium">Role</th>
                  <th className="px-6 py-4 font-medium">Scope</th>
                  <th className="px-6 py-4 font-medium">Created</th>
                  <th className="px-6 py-4 font-medium"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {users.map((user) => (
                  <tr key={user.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <Avatar name={user.name} email={user.email} size={40} />
                        <span className="font-medium text-gray-900">{user.name}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-500">{user.email}</td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${roleBadge(user.role)}`}>
                        {roleLabel(user.role)}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-500">
                      {user.role === 'hiring_manager' ? (
                        <div>
                          <div className="flex flex-wrap gap-1 items-center">
                            {!user.scopedDepartments && !user.scopedOffices ? (
                              <span className="text-gray-400">Global</span>
                            ) : (
                              <>
                                {user.scopedDepartments?.map((d, i) => (
                                  <span key={d}>
                                    <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs bg-blue-50 text-blue-700">{d}</span>
                                    {(i < (user.scopedDepartments?.length || 0) - 1 || (user.scopedOffices && user.scopedOffices.length > 0)) && (
                                      <span className="text-xs text-gray-400 mx-0.5">{user.scopeMode === 'and' ? '&' : '/'}</span>
                                    )}
                                  </span>
                                ))}
                                {user.scopedOffices?.map((o, i) => (
                                  <span key={o}>
                                    <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs bg-green-50 text-green-700">{officeMap[o] || o}</span>
                                    {i < (user.scopedOffices?.length || 0) - 1 && (
                                      <span className="text-xs text-gray-400 mx-0.5">{user.scopeMode === 'and' ? '&' : '/'}</span>
                                    )}
                                  </span>
                                ))}
                              </>
                            )}
                          </div>
                          {user.eventAccess === false && (
                            <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs bg-red-50 text-red-600 mt-1">No Events</span>
                          )}
                        </div>
                      ) : (
                        <span className="text-gray-300">--</span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-500">
                      {new Date(user.createdAt).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2 justify-end">
                        <button
                          onClick={() => openEditModal(user)}
                          className="text-gray-600 hover:text-gray-900 text-sm font-medium"
                        >
                          Edit
                        </button>
                        {currentUser?.id !== user.id && (
                          <>
                            {deleteConfirm === user.id ? (
                              <span className="flex items-center gap-1">
                                <button
                                  onClick={() => handleDelete(user.id)}
                                  className="text-red-600 hover:text-red-800 text-sm font-medium"
                                >
                                  Confirm
                                </button>
                                <button
                                  onClick={() => setDeleteConfirm(null)}
                                  className="text-gray-400 hover:text-gray-600 text-sm font-medium"
                                >
                                  Cancel
                                </button>
                              </span>
                            ) : (
                              <button
                                onClick={() => setDeleteConfirm(user.id)}
                                className="text-red-500 hover:text-red-700 text-sm font-medium"
                              >
                                Delete
                              </button>
                            )}
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <Pagination page={page} totalPages={totalPages} total={total} pageSize={pageSize} onPageChange={setPage} />

      {/* Create/Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b px-6 py-4 flex justify-between items-center">
              <h2 className="text-xl font-display font-bold uppercase tracking-wide">
                {editingUser ? 'Edit User' : 'Create User'}
              </h2>
              <button onClick={closeModal} className="text-gray-400 hover:text-gray-600">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              {formError && (
                <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded text-sm">
                  {formError}
                </div>
              )}

              <div>
                <label className="label">Name</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="input"
                  required
                />
              </div>

              <div>
                <label className="label">Email</label>
                <input
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className="input"
                  required
                />
              </div>

              <div>
                <label className="label">
                  Password{editingUser && <span className="text-gray-400 font-normal"> (leave blank to keep current)</span>}
                </label>
                <input
                  type="password"
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  className="input"
                  required={!editingUser}
                  minLength={8}
                />
                <p className="text-xs text-gray-400 mt-1">Min 8 chars, 1 uppercase, 1 lowercase, 1 number</p>
              </div>

              <div>
                <label className="label">Role</label>
                <select
                  value={formData.role}
                  onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                  className="input"
                >
                  {roles.map((role) => (
                    <option key={role.value} value={role.value}>
                      {role.label}
                    </option>
                  ))}
                </select>
              </div>

              {/* Scope section (only for hiring managers) */}
              {formData.role === 'hiring_manager' && (
                <div className="border rounded p-4 space-y-3 bg-gray-50">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-semibold text-gray-700">Hiring Manager Scope</h3>
                  </div>
                  <p className="text-xs text-gray-400">
                    Global access sees all jobs. Scoped access limits to specific departments and/or offices.
                  </p>

                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formData.scopeGlobal}
                      onChange={(e) => setFormData({ ...formData, scopeGlobal: e.target.checked })}
                      className="h-4 w-4 rounded border-gray-300"
                    />
                    <span className="text-sm text-gray-700 font-medium">Global Access (all departments & offices)</span>
                  </label>

                  {!formData.scopeGlobal && (
                    <div className="space-y-3 pt-1">
                      {/* AND/OR mode toggle */}
                      <div>
                        <label className="label text-xs">Scope Mode</label>
                        <div className="flex gap-2">
                          <button
                            type="button"
                            onClick={() => setFormData({ ...formData, scopeMode: 'or' })}
                            className={`px-3 py-1.5 text-xs font-medium rounded border ${formData.scopeMode === 'or' ? 'bg-black text-white border-black' : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-50'}`}
                          >
                            OR
                          </button>
                          <button
                            type="button"
                            onClick={() => setFormData({ ...formData, scopeMode: 'and' })}
                            className={`px-3 py-1.5 text-xs font-medium rounded border ${formData.scopeMode === 'and' ? 'bg-black text-white border-black' : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-50'}`}
                          >
                            AND
                          </button>
                        </div>
                        <p className="text-xs text-gray-400 mt-1">
                          {formData.scopeMode === 'or'
                            ? 'User sees jobs matching any selected department or office.'
                            : 'User sees only jobs matching both a selected department and office.'}
                        </p>
                      </div>

                      <div>
                        <label className="label text-xs">Departments</label>
                        {departments.length === 0 ? (
                          <p className="text-xs text-gray-400">No departments found in jobs.</p>
                        ) : (
                          <div className="border rounded divide-y bg-white max-h-40 overflow-y-auto">
                            {departments.map((dept) => (
                              <label key={dept} className="flex items-center gap-2 px-3 py-2 hover:bg-gray-50 cursor-pointer">
                                <input
                                  type="checkbox"
                                  checked={formData.scopedDepartments.includes(dept)}
                                  onChange={() => {
                                    const next = formData.scopedDepartments.includes(dept)
                                      ? formData.scopedDepartments.filter(d => d !== dept)
                                      : [...formData.scopedDepartments, dept];
                                    setFormData({ ...formData, scopedDepartments: next });
                                  }}
                                  className="h-4 w-4 rounded border-gray-300"
                                />
                                <span className="text-sm">{dept}</span>
                              </label>
                            ))}
                          </div>
                        )}
                      </div>

                      <div>
                        <label className="label text-xs">Offices</label>
                        {offices.length === 0 ? (
                          <p className="text-xs text-gray-400">No offices found.</p>
                        ) : (
                          <div className="border rounded divide-y bg-white max-h-40 overflow-y-auto">
                            {offices.map((office) => (
                              <label key={office.id} className="flex items-center gap-2 px-3 py-2 hover:bg-gray-50 cursor-pointer">
                                <input
                                  type="checkbox"
                                  checked={formData.scopedOffices.includes(office.id)}
                                  onChange={() => {
                                    const next = formData.scopedOffices.includes(office.id)
                                      ? formData.scopedOffices.filter(o => o !== office.id)
                                      : [...formData.scopedOffices, office.id];
                                    setFormData({ ...formData, scopedOffices: next });
                                  }}
                                  className="h-4 w-4 rounded border-gray-300"
                                />
                                <span className="text-sm">{office.name}</span>
                              </label>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Event Access toggle */}
                  <div className="border-t pt-3 mt-3">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={formData.eventAccess}
                        onChange={(e) => setFormData({ ...formData, eventAccess: e.target.checked })}
                        className="h-4 w-4 rounded border-gray-300"
                      />
                      <span className="text-sm text-gray-700 font-medium">Event Access</span>
                    </label>
                    <p className="text-xs text-gray-400 mt-1">
                      When enabled, this hiring manager can see and manage all recruitment events. Notification preferences are managed separately in Settings.
                    </p>
                  </div>
                </div>
              )}

              <div className="flex justify-end gap-3 pt-4">
                <button type="button" onClick={closeModal} className="btn btn-secondary">
                  Cancel
                </button>
                <button type="submit" disabled={submitting} className="btn btn-primary">
                  {submitting ? 'Saving...' : editingUser ? 'Update User' : 'Create User'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
