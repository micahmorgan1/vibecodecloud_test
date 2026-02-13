import { useState, useEffect } from 'react';
import { api } from '../lib/api';

interface Office {
  id: string;
  name: string;
  address: string;
  city: string;
  state: string;
  zip: string;
  phone: string;
  _count: { jobs: number };
}

interface OfficeFormData {
  name: string;
  address: string;
  city: string;
  state: string;
  zip: string;
  phone: string;
}

const emptyForm: OfficeFormData = { name: '', address: '', city: '', state: '', zip: '', phone: '' };

export default function Offices() {
  const [offices, setOffices] = useState<Office[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingOffice, setEditingOffice] = useState<Office | null>(null);
  const [formData, setFormData] = useState<OfficeFormData>(emptyForm);
  const [formError, setFormError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  useEffect(() => {
    fetchOffices();
  }, []);

  const fetchOffices = async () => {
    setLoading(true);
    try {
      const res = await api.get<Office[]>('/offices');
      setOffices(res.data);
    } finally {
      setLoading(false);
    }
  };

  const openCreateModal = () => {
    setEditingOffice(null);
    setFormData(emptyForm);
    setFormError('');
    setShowModal(true);
  };

  const openEditModal = (office: Office) => {
    setEditingOffice(office);
    setFormData({
      name: office.name,
      address: office.address,
      city: office.city,
      state: office.state,
      zip: office.zip,
      phone: office.phone,
    });
    setFormError('');
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setEditingOffice(null);
    setFormError('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');
    setSubmitting(true);

    try {
      if (editingOffice) {
        await api.put(`/offices/${editingOffice.id}`, formData);
      } else {
        await api.post('/offices', formData);
      }
      closeModal();
      fetchOffices();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await api.delete(`/offices/${id}`);
      setDeleteConfirm(null);
      fetchOffices();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to delete office');
      setDeleteConfirm(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-3xl font-display font-bold text-gray-900 uppercase tracking-wide">Offices</h1>
          <p className="text-gray-500 mt-1">Manage office locations</p>
        </div>
        <button onClick={openCreateModal} className="btn btn-primary">
          + Add Office
        </button>
      </div>

      {/* Offices Table */}
      {loading ? (
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-black"></div>
        </div>
      ) : offices.length === 0 ? (
        <div className="card text-center py-12">
          <p className="text-gray-500">No offices yet</p>
          <button onClick={openCreateModal} className="btn btn-primary mt-4">
            Add your first office
          </button>
        </div>
      ) : (
        <>
        {/* Mobile card-rows */}
        <div className="md:hidden space-y-2">
          {offices.map((office) => (
            <div key={office.id} className="card-row">
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="font-medium text-gray-900 truncate">{office.name}</p>
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800 shrink-0">
                      {office._count.jobs} {office._count.jobs === 1 ? 'job' : 'jobs'}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 mt-0.5 text-sm text-gray-500">
                    <span className="truncate">{office.city}, {office.state}</span>
                    <span>&middot;</span>
                    <span className="shrink-0">{office.phone}</span>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    onClick={() => openEditModal(office)}
                    className="text-gray-600 hover:text-gray-900 text-sm font-medium"
                  >
                    Edit
                  </button>
                  {deleteConfirm === office.id ? (
                    <span className="flex items-center gap-1">
                      <button
                        onClick={() => handleDelete(office.id)}
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
                      onClick={() => setDeleteConfirm(office.id)}
                      className="text-red-500 hover:text-red-700 text-sm font-medium"
                    >
                      Delete
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Desktop table */}
        <div className="hidden md:block card overflow-hidden p-0">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr className="text-left text-sm text-gray-500">
                  <th className="px-6 py-4 font-medium">Name</th>
                  <th className="px-6 py-4 font-medium">Location</th>
                  <th className="px-6 py-4 font-medium">Phone</th>
                  <th className="px-6 py-4 font-medium">Jobs</th>
                  <th className="px-6 py-4 font-medium"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {offices.map((office) => (
                  <tr key={office.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 font-medium text-gray-900">{office.name}</td>
                    <td className="px-6 py-4 text-sm text-gray-500">
                      {office.city}, {office.state}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-500">{office.phone}</td>
                    <td className="px-6 py-4 text-sm text-gray-500">{office._count.jobs}</td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2 justify-end">
                        <button
                          onClick={() => openEditModal(office)}
                          className="text-gray-600 hover:text-gray-900 text-sm font-medium"
                        >
                          Edit
                        </button>
                        {deleteConfirm === office.id ? (
                          <span className="flex items-center gap-1">
                            <button
                              onClick={() => handleDelete(office.id)}
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
                            onClick={() => setDeleteConfirm(office.id)}
                            className="text-red-500 hover:text-red-700 text-sm font-medium"
                          >
                            Delete
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
        </>
      )}

      {/* Create/Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b px-6 py-4 flex justify-between items-center">
              <h2 className="text-xl font-display font-bold uppercase tracking-wide">
                {editingOffice ? 'Edit Office' : 'Add Office'}
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
                <label className="label">Office Name</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="input"
                  placeholder="e.g., Baton Rouge"
                  required
                />
              </div>

              <div>
                <label className="label">Street Address</label>
                <input
                  type="text"
                  value={formData.address}
                  onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                  className="input"
                  placeholder="e.g., 10 Cl Way"
                  required
                />
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="label">City</label>
                  <input
                    type="text"
                    value={formData.city}
                    onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                    className="input"
                    required
                  />
                </div>
                <div>
                  <label className="label">State</label>
                  <input
                    type="text"
                    value={formData.state}
                    onChange={(e) => setFormData({ ...formData, state: e.target.value })}
                    className="input"
                    maxLength={2}
                    required
                  />
                </div>
                <div>
                  <label className="label">ZIP</label>
                  <input
                    type="text"
                    value={formData.zip}
                    onChange={(e) => setFormData({ ...formData, zip: e.target.value })}
                    className="input"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="label">Phone</label>
                <input
                  type="text"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  className="input"
                  placeholder="(225) 555-1234"
                  required
                />
              </div>

              <div className="flex justify-end gap-3 pt-4">
                <button type="button" onClick={closeModal} className="btn btn-secondary">
                  Cancel
                </button>
                <button type="submit" disabled={submitting} className="btn btn-primary">
                  {submitting ? 'Saving...' : editingOffice ? 'Update Office' : 'Add Office'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
