import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import axios from 'axios';
import {
  UserPlus,
  Edit3,
  Trash2,
  RefreshCw,
  KeyRound,
  Eye,
  EyeOff,
  User,
  CheckCircle,
  XCircle,
  Activity,
} from 'lucide-react';

// ---- Types ----
interface StaffAccount {
  _id: string;
  id: string;
  pharmacyName: string;
  staffName?: string;
  role: string;
  isActive: boolean;
}

interface StaffManagerProps {
  pharmacyName?: string;
  onClose?: () => void;
}

// 🔧 Updated to match the restaurant role set used in App.tsx's
// ROLE_ACCESS map: Manager, Waiter, Kitchen Staff, Cashier.
const STAFF_ROLES = [
  'Manager',
  'Waiter',
  'Kitchen Staff',
  'Cashier',
];

// 🔧 FIX: baseURL was '/api' (relative), which silently failed unless you
// have a dev-server proxy set up. Every other part of this app talks to
// the backend at this absolute URL, so StaffManager now matches it.
// Move this to an env var when you deploy: import.meta.env.VITE_API_URL
const API_BASE_URL = 'http://localhost:5000/api';

const api = axios.create({ baseURL: API_BASE_URL });
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('authToken'); // 🔧 FIX: matches the key App.tsx actually sets
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

export default function StaffManager({ pharmacyName: propPharmacyName, onClose }: StaffManagerProps) {
  const { pharmacyName: paramPharmacyName } = useParams<{ pharmacyName?: string }>();
  const pharmacyName = propPharmacyName || paramPharmacyName || '';

  const [staff, setStaff] = useState<StaffAccount[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [notification, setNotification] = useState<{ type: 'success' | 'error'; msg: string } | null>(null);

  // Form state
  const [isEditing, setIsEditing] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formId, setFormId] = useState('');
  const [formStaffName, setFormStaffName] = useState('');
  const [formPassword, setFormPassword] = useState('');
  const [formRole, setFormRole] = useState(STAFF_ROLES[0]);
  const [formIsActive, setFormIsActive] = useState(true);
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const showNotice = (type: 'success' | 'error', msg: string) => {
    setNotification({ type, msg });
    setTimeout(() => setNotification(null), 4000);
  };

  // ---- Fetch staff scoped to this pharmacy only ----
  const fetchStaff = async () => {
    if (!pharmacyName) return;
    setIsLoading(true);
    try {
      const res = await api.get(`/admin/staff-by-pharmacy/${encodeURIComponent(pharmacyName)}`);
      const data = res.data?.data ?? res.data;
      setStaff(Array.isArray(data) ? data : []);
    } catch (err) {
      showNotice('error', 'Could not load staff for this pharmacy. Check that the backend is running on port 5000.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchStaff();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pharmacyName]);

  const resetForm = () => {
    setIsEditing(false);
    setEditingId(null);
    setFormId('');
    setFormStaffName('');
    setFormPassword('');
    setFormRole(STAFF_ROLES[0]);
    setFormIsActive(true);
    setShowPassword(false);
  };

  const startEditMode = (s: StaffAccount) => {
    setIsEditing(true);
    setEditingId(s._id);
    setFormId(s.id);
    setFormStaffName(s.staffName || '');
    setFormRole(STAFF_ROLES.includes(s.role) ? s.role : STAFF_ROLES[0]);
    setFormIsActive(s.isActive);
    setFormPassword('');
  };

  // ---- Create ----
const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formId.trim() || !formPassword.trim() || !formStaffName.trim()) {
      showNotice('error', 'Staff name, ID and password are required.');
      return;
    }
    if (formPassword.length < 6) {
      showNotice('error', 'Password must be at least 6 characters.');
      return;
    }

    setIsSubmitting(true);
    try {
      await api.post('/staff/create', {
        pharmacyName,
        staffName: formStaffName,
        id: formId,
        password: formPassword,
        role: formRole,
        isActive: formIsActive,
      });
      showNotice('success', 'Staff account created.');
      await fetchStaff();
      resetForm();
    } catch (err: any) {
      showNotice('error', err?.response?.data?.error || 'Failed to create staff account.');
    } finally {
      setIsSubmitting(false);
    }
  };
  // ---- Update ----
  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingId) return;
    if (!formId.trim()) {
      showNotice('error', 'Staff ID is required.');
      return;
    }
    if (formPassword && formPassword.length < 6) {
      showNotice('error', 'Password must be at least 6 characters.');
      return;
    }

    setIsSubmitting(true);
    try {
      const payload: Record<string, unknown> = {
        id: formId,
        staffName: formStaffName,
        role: formRole,
        isActive: formIsActive,
        pharmacyName,
      };
      if (formPassword.trim()) payload.password = formPassword;

      await api.put(`/staff/${editingId}`, payload);
      showNotice('success', 'Staff account updated.');
      await fetchStaff();
      resetForm();
    } catch (err: any) {
      showNotice('error', err?.response?.data?.error || 'Failed to update staff account.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // ---- Delete ----
  const handleDelete = async (id: string) => {
    if (!window.confirm('Delete this staff member permanently? This cannot be undone.')) return;
    try {
      await api.delete(`/staff/${id}`);
      showNotice('success', 'Staff member deleted.');
      setStaff((prev) => prev.filter((s) => s._id !== id));
      if (editingId === id) resetForm();
    } catch (err: any) {
      showNotice('error', err?.response?.data?.error || 'Failed to delete staff member.');
    }
  };

  if (!pharmacyName) {
    return (
      <div className="p-6 text-center text-slate-500">
        No restaurant specified. Open this page via a restaurant's staff link.
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 p-4 sm:p-8">
      <div className="max-w-6xl mx-auto space-y-6">

        {/* Header */}
        <div className="flex justify-between items-center bg-white p-6 rounded-3xl border border-slate-200 shadow-xs">
          <div>
            <h2 className="text-2xl font-bold text-slate-900">{pharmacyName} — Staff Management</h2>
            <p className="text-slate-500 text-sm mt-1">Create, update, or remove staff login credentials.</p>
          </div>
          {onClose && (
            <button
              onClick={onClose}
              aria-label="Close staff manager"
              className="p-3 bg-slate-100 rounded-full hover:bg-slate-200 transition-colors cursor-pointer"
            >
              <XCircle className="h-6 w-6 text-slate-500" />
            </button>
          )}
        </div>

        {/* Notification toast */}
        {notification && (
          <div
            role="status"
            className={`fixed bottom-5 right-5 z-50 p-4 rounded-2xl shadow-2xl border flex items-center gap-3 max-w-md text-sm font-semibold text-white ${
              notification.type === 'success' ? 'bg-emerald-600 border-emerald-500' : 'bg-rose-600 border-rose-500'
            }`}
          >
            <Activity className="h-5 w-5 shrink-0" />
            <p>{notification.msg}</p>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">

          {/* Staff table */}
          <div className="lg:col-span-2 bg-white p-6 rounded-3xl border border-slate-200 shadow-xs">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-sm font-bold uppercase tracking-wider text-slate-400 flex items-center gap-2">
                <User className="h-4 w-4 text-teal-600" /> Staff Directory
              </h3>
              <button
                onClick={fetchStaff}
                aria-label="Refresh staff list"
                className="p-2 hover:bg-slate-100 border border-slate-200 rounded-xl transition-all cursor-pointer text-slate-500 hover:text-teal-600"
              >
                <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin text-teal-600' : ''}`} />
              </button>
            </div>

            <div className="overflow-x-auto rounded-2xl border border-slate-200/60">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200/60 text-slate-400 font-bold uppercase tracking-wider">
                    <th className="p-3">Staff Name</th>
                    <th className="p-3">Staff ID</th>
                    <th className="p-3">Role</th>
                    <th className="p-3">Status</th>
                    <th className="p-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                  {staff.length > 0 ? (
                    staff.map((s) => (
                      <tr key={s._id} className="hover:bg-slate-50/60 transition-colors">
                        <td className="p-3 font-bold text-slate-900">{s.staffName || '—'}</td>
                        <td className="p-3 font-mono text-slate-500 font-semibold">{s.id}</td>
                        <td className="p-3">{s.role || 'Staff'}</td>
                        <td className="p-3">
                          <span
                            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                              s.isActive
                                ? 'bg-emerald-50 text-emerald-700 border border-emerald-100'
                                : 'bg-rose-50 text-rose-700 border border-rose-100'
                            }`}
                          >
                            {s.isActive ? <CheckCircle className="h-3 w-3" /> : <XCircle className="h-3 w-3" />}
                            {s.isActive ? 'Active' : 'Inactive'}
                          </span>
                        </td>
                        <td className="p-3 text-right space-x-2 whitespace-nowrap">
                          <button
                            onClick={() => startEditMode(s)}
                            aria-label={`Edit ${s.id}`}
                            className="p-2 bg-slate-50 hover:bg-teal-50 text-slate-600 hover:text-teal-700 border border-slate-200 hover:border-teal-200 rounded-xl transition-all cursor-pointer inline-flex items-center"
                          >
                            <Edit3 className="h-3.5 w-3.5" />
                          </button>
                          <button
                            onClick={() => handleDelete(s._id)}
                            aria-label={`Delete ${s.id}`}
                            className="p-2 bg-slate-50 hover:bg-rose-50 text-slate-600 hover:text-rose-700 border border-slate-200 hover:border-rose-200 rounded-xl transition-all cursor-pointer inline-flex items-center"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={5} className="p-10 text-center text-slate-400 font-medium bg-slate-50/30">
                        {isLoading ? 'Loading staff...' : 'No staff members found for this Restaurant.'}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Create / Edit form */}
          <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-xs space-y-5">
            <div>
              <div className="h-9 w-9 bg-teal-50 text-teal-700 rounded-xl flex items-center justify-center mb-3">
                {isEditing ? <Edit3 className="h-4.5 w-4.5" /> : <UserPlus className="h-5 w-5" />}
              </div>
              <h3 className="text-base font-bold text-slate-900 tracking-tight">
                {isEditing ? 'Edit Staff Member' : 'Add Staff Member'}
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Restaurant: <span className="font-semibold text-slate-600">{pharmacyName}</span>
              </p>
            </div>

            <form onSubmit={isEditing ? handleUpdate : handleCreate} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                  Staff Name
                </label>
                <div className="relative">
                  <User className="absolute left-3 top-3 w-4 h-4 text-slate-400" />
                  <input
                    type="text"
                    required
                    placeholder="e.g. Ramesh Sharma"
                    value={formStaffName}
                    onChange={(e) => setFormStaffName(e.target.value)}
                    className="w-full pl-9 pr-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-hidden focus:border-teal-500 transition-all font-medium"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                  Staff ID
                </label>
                <div className="relative">
                  <User className="absolute left-3 top-3 w-4 h-4 text-slate-400" />
                  <input
                    type="text"
                    required
                    disabled={isEditing}
                    placeholder="Alphanumeric code string"
                    value={formId}
                    onChange={(e) => setFormId(e.target.value)}
                    className="w-full pl-9 pr-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-hidden focus:border-teal-500 transition-all font-mono font-medium disabled:bg-slate-100 disabled:text-slate-400"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                  {isEditing ? 'New Password (optional)' : 'Password'}
                </label>
                <div className="relative">
                  <KeyRound className="absolute left-3 top-3 w-4 h-4 text-slate-400" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required={!isEditing}
                    minLength={formPassword ? 6 : undefined}
                    placeholder={isEditing ? '•••••••• (preserve current)' : 'Minimum 6 characters'}
                    value={formPassword}
                    onChange={(e) => setFormPassword(e.target.value)}
                    className="w-full pl-9 pr-10 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-hidden focus:border-teal-500 transition-all font-medium"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                    className="absolute right-3 top-3 text-slate-400 hover:text-slate-600 transition-colors"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Role</label>
                <select
                  value={formRole}
                  onChange={(e) => setFormRole(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-hidden focus:border-teal-500 transition-all font-medium"
                >
                  {STAFF_ROLES.map((role) => (
                    <option key={role} value={role}>{role}</option>
                  ))}
                </select>
              </div>

              <div className="flex items-center justify-between p-3.5 bg-slate-50 rounded-xl border border-slate-200/60 select-none">
                <div>
                  <span className="text-[11px] font-bold text-slate-700 block">Account Active</span>
                  <span className="text-[10px] text-slate-400 font-medium">Allow this staff member to log in</span>
                </div>
                <input
                  type="checkbox"
                  checked={formIsActive}
                  onChange={(e) => setFormIsActive(e.target.checked)}
                  className="w-5 h-5 rounded-md border-slate-300 accent-teal-600 cursor-pointer"
                />
              </div>

              <div className="space-y-2 pt-2">
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full py-3 bg-teal-600 hover:bg-teal-500 disabled:opacity-60 disabled:cursor-not-allowed text-white font-bold text-xs uppercase tracking-wider rounded-xl transition-all shadow-md shadow-teal-600/10 hover:shadow-lg active:scale-[0.99] cursor-pointer"
                >
                  {isSubmitting ? 'Saving...' : isEditing ? 'Save Changes' : 'Create Staff Account'}
                </button>

                {isEditing && (
                  <button
                    type="button"
                    onClick={resetForm}
                    className="w-full py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs uppercase tracking-wider rounded-xl transition-all text-center cursor-pointer"
                  >
                    Cancel
                  </button>
                )}
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}