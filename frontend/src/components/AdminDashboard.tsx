import React, { useState, useEffect } from 'react';
import { 
  Building2, 
  UserPlus, 
  Edit3, 
  Trash2, 
  LogOut, 
  ShieldCheck, 
  Activity, 
  Search,
  CheckCircle,
  XCircle,
  RefreshCw,
  KeyRound,
  Eye,
  EyeOff,
  User,
  Plus,
  Phone,
  Mail,
  MapPin,
  FileText
} from 'lucide-react';

interface UserPayload {
  _id: string;
  id: string;
  pharmacyName: string;
}

// Pharmacy-level login account (saved in PharmacyUser collection only)
interface PharmacyAccount {
  _id: string;
  id: string;
  pharmacyName: string;
  isActive: boolean;
  password?: string; // Optional field if returned by API
  phone?: string;
  email?: string;
  location?: string;
  PanOrVat?: string;
}

// Staff login account (saved in PharmacyStaff collection only)
interface StaffAccount {
  _id: string;
  id: string;
  pharmacyName: string;
  staffName?: string;
  role: string;
  isActive: boolean;
  password?: string;
}

interface AdminDashboardProps {
  user: UserPayload;
  lang: 'en' | 'ne';
  onLogout: () => void;
}

// Role options for staff accounts (PharmacyStaff collection)
// 🔧 Updated to match the restaurant role set used in App.tsx's
// ROLE_ACCESS map: Manager, Waiter, Kitchen Staff, Cashier.
const STAFF_ROLES = [
  'Manager',
  'Waiter',
  'Kitchen Staff',
  'Cashier',
];

export default function AdminDashboard({ user, lang, onLogout }: AdminDashboardProps) {
  const [pharmacies, setPharmacies] = useState<PharmacyAccount[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [notification, setNotification] = useState<{ type: 'success' | 'error'; msg: string } | null>(null);
  const [showPassword, setShowPassword] = useState(false);

  // Form States for Creating/Editing Pharmacy Accounts
  const [isEditing, setIsEditing] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formPharmacyName, setFormPharmacyName] = useState('');
  const [formId, setFormId] = useState('');
  const [formPassword, setFormPassword] = useState('');
  const [formIsActive, setFormIsActive] = useState(true);
  const [formPhone, setFormPhone] = useState('');
  const [formEmail, setFormEmail] = useState('');
  const [formLocation, setFormLocation] = useState('');
  const [formPanOrVat, setFormPanOrVat] = useState('');

  const BACKEND_URL = 'https://rms-0wk0.onrender.com';

  const t = {
    en: {
      dashTitle: "Admin Central Command",
      welcome: "Logged in as Admin:",
      searchPlaceholder: "Search Restaurant by name or ID...",
      createHeading: "Register New Restaurant User",
      editHeading: "Modify Restaurant Account Details",
      tableAction: "Actions",
      tableName: "Restaurant Store Name",
      tableId: "System ID",
      tableStatus: "Account Status",
      tableLocation: "Location",
      submitCreate: "Register System Account",
      submitUpdate: "Save Configuration Changes",
      cancelBtn: "Discard Changes",
      active: "Active",
      inactive: "Deactivated"
    },
    ne: {
      dashTitle: "प्रशासक केन्द्रीय कमान्ड",
      welcome: "एडमिनको रूपमा लगइन गरिएको छ:",
      searchPlaceholder: "रेस्टुरेन्टको नाम वा ID खोज्नुहोस्...",
      createHeading: "नयाँ रेस्टुरेन्ट प्रयोगकर्ता दर्ता गर्नुहोस्",
      editHeading: "रेस्टुरेन्ट खाता विवरण परिमार्जन गर्नुहोस्",
      tableAction: "कार्यहरू",
      tableName: "रेस्टुरेन्ट पसलको नाम",
      tableId: "प्रणाली ID",
      tableStatus: "खाता स्थिति",
      tableLocation: "स्थान",
      submitCreate: "प्रणाली खाता दर्ता गर्नुहोस्",
      submitUpdate: "परिवर्तनहरू बचत गर्नुहोस्",
      cancelBtn: "रद्द गर्नुहोस्",
      active: "सक्रिय",
      inactive: "निष्क्रिय"
    }
  }[lang];

  // 🔄 FETCH PHARMACY LOGIN ACCOUNTS (PharmacyUser collection — NOT staff)
  const fetchAllPharmacies = async () => {
    setIsLoading(true);
    try {
      const response = await fetch(`${BACKEND_URL}/api/admin/users`);
      const resData = await response.json();

      if (response.ok && resData.success) {
        setPharmacies(Array.isArray(resData.data) ? resData.data : []);
      } else {
        showNotice('error', resData.message || 'Failed to fetch user list.');
      }
    } catch (err) {
      showNotice('error', 'Database connection failed.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchAllPharmacies();
  }, []);

  const showNotice = (type: 'success' | 'error', msg: string) => {
    setNotification({ type, msg });
    setTimeout(() => setNotification(null), 4000);
  };

  // ➕ CREATE NEW PHARMACY LOGIN ACCOUNT (PharmacyUser)
  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formPhone.trim() || !formEmail.trim() || !formLocation.trim()) {
      showNotice('error', 'Phone, email and location are required.');
      return;
    }

    try {
      const response = await fetch(`${BACKEND_URL}/api/admin/users`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          pharmacyName: formPharmacyName,
          id: formId,
          password: formPassword,
          phone: formPhone,
          email: formEmail,
          location: formLocation,
          PanOrVat: formPanOrVat
        })
      });
      const data = await response.json();

      if (response.ok && data.success) {
        showNotice('success', 'Successfully generated new secure account profile!');
        if (data.data) {
          setPharmacies(prev => [...prev, data.data]);
        }
        resetForm();
      } else {
        showNotice('error', data.message || 'Validation matching check rejected.');
      }
    } catch (err) {
      showNotice('error', 'Server offline during registration processing.');
    }
  };

  // ✏️ UPDATE PHARMACY LOGIN ACCOUNT (PharmacyUser)
  const handleUpdateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingId) return;

    try {
      const response = await fetch(`${BACKEND_URL}/api/admin/users/${editingId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          pharmacyName: formPharmacyName,
          isActive: formIsActive,
          password: formPassword || undefined,
          phone: formPhone,
          email: formEmail,
          location: formLocation,
          PanOrVat: formPanOrVat
        })
      });
      const data = await response.json();

      if (response.ok && data.success) {
        showNotice('success', 'Profile properties committed seamlessly.');
        setPharmacies(prev => prev.map(item => item._id === editingId ? {
          ...item,
          pharmacyName: formPharmacyName,
          isActive: formIsActive,
          phone: formPhone,
          email: formEmail,
          location: formLocation,
          PanOrVat: formPanOrVat
        } : item));
        resetForm();
      } else {
        showNotice('error', data.message || 'Refused to write database adjustments.');
      }
    } catch (err) {
      showNotice('error', 'Database connection handshake failure during save.');
    }
  };

  // ❌ DELETE PHARMACY LOGIN ACCOUNT (PharmacyUser)
  const handleDeleteUser = async (id: string) => {
    if (!window.confirm("Are you absolutely sure you want to permanently delete this system user profile? This cannot be undone.")) return;

    try {
      const response = await fetch(`${BACKEND_URL}/api/admin/users/${id}`, {
        method: 'DELETE'
      });
      const data = await response.json();

      if (response.ok && data.success) {
        showNotice('success', 'Target entity wiped cleanly from collections.');
        setPharmacies(prev => prev.filter(p => p._id !== id));
        if (editingId === id) resetForm();
      } else {
        showNotice('error', data.message || 'Deletion parameters denied.');
      }
    } catch (err) {
      showNotice('error', 'Network crash prevented data deletion.');
    }
  };

  const startEditMode = (pharm: PharmacyAccount) => {
    setIsEditing(true);
    setEditingId(pharm._id);
    setFormPharmacyName(pharm.pharmacyName);
    setFormId(pharm.id);
    setFormIsActive(pharm.isActive);
    setFormPassword('');
    setFormPhone(pharm.phone || '');
    setFormEmail(pharm.email || '');
    setFormLocation(pharm.location || '');
    setFormPanOrVat(pharm.PanOrVat || '');
  };

  const resetForm = () => {
    setIsEditing(false);
    setEditingId(null);
    setFormPharmacyName('');
    setFormId('');
    setFormPassword('');
    setFormIsActive(true);
    setShowPassword(false);
    setFormPhone('');
    setFormEmail('');
    setFormLocation('');
    setFormPanOrVat('');
  };

  const filteredPharmacies = pharmacies.filter(pharm => 
    pharm.pharmacyName.toLowerCase().includes(searchQuery.toLowerCase()) ||
    pharm.id.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // ============================================================
  // STAFF MANAGEMENT (separate from pharmacy login accounts above)
  // Wired to /api/staff endpoints -> PharmacyStaff collection only.
  // Only loads when a specific pharmacy name is clicked, and only
  // ever shows staff belonging to that one pharmacy.
  // ============================================================

  const [selectedPharmacy, setSelectedPharmacy] = useState<string | null>(null);
  const [pharmacyStaff, setPharmacyStaff] = useState<StaffAccount[]>([]);
  const [isStaffLoading, setIsStaffLoading] = useState(false);

  const [isStaffEditing, setIsStaffEditing] = useState(false);
  const [staffEditingId, setStaffEditingId] = useState<string | null>(null);
  const [staffFormId, setStaffFormId] = useState('');
  const [staffFormName, setStaffFormName] = useState('');
  const [staffFormPassword, setStaffFormPassword] = useState('');
  const [staffFormRole, setStaffFormRole] = useState(STAFF_ROLES[0]);
  const [staffFormIsActive, setStaffFormIsActive] = useState(true);
  const [showStaffPassword, setShowStaffPassword] = useState(false);

  const fetchStaffForPharmacy = async (name: string) => {
    setIsStaffLoading(true);
    try {
      const response = await fetch(`${BACKEND_URL}/api/admin/staff-by-pharmacy/${encodeURIComponent(name)}`);
      const resData = await response.json();
      if (response.ok && resData.success) {
        setPharmacyStaff(Array.isArray(resData.data) ? resData.data : []);
      } else {
        showNotice('error', resData.message || 'Could not load pharmacy staff.');
      }
    } catch (err) {
      showNotice('error', 'Could not load pharmacy staff.');
    } finally {
      setIsStaffLoading(false);
    }
  };

  const openPharmacyDetails = async (name: string) => {
    setSelectedPharmacy(name);
    resetStaffForm();
    await fetchStaffForPharmacy(name);
  };

  const closePharmacyDetails = () => {
    setSelectedPharmacy(null);
    setPharmacyStaff([]);
    resetStaffForm();
  };

  const resetStaffForm = () => {
    setIsStaffEditing(false);
    setStaffEditingId(null);
    setStaffFormId('');
    setStaffFormName('');
    setStaffFormPassword('');
    setStaffFormRole(STAFF_ROLES[0]);
    setStaffFormIsActive(true);
    setShowStaffPassword(false);
  };

  const startStaffEditMode = (staff: StaffAccount) => {
    setIsStaffEditing(true);
    setStaffEditingId(staff._id);
    setStaffFormId(staff.id);
    setStaffFormName(staff.staffName || '');
    setStaffFormRole(STAFF_ROLES.includes(staff.role) ? staff.role : STAFF_ROLES[0]);
    setStaffFormIsActive(staff.isActive);
    setStaffFormPassword('');
  };

  // ➕ CREATE NEW STAFF LOGIN ACCOUNT (PharmacyStaff)
const handleCreateStaff = async (e: React.FormEvent) => {
  e.preventDefault();

  // --- ADD THIS VALIDATION ---
  if (!staffFormId.trim() || !staffFormPassword.trim() || !staffFormName.trim()) {
    showNotice('error', 'Please fill in all required fields (Name, ID and Password).');
    return; // Stops the function here so no request is sent
  }
  // ---------------------------

  try {
    const response = await fetch(`${BACKEND_URL}/api/staff/create`, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Authorization': 'Bearer mock-jwt-token' 
      },
      body: JSON.stringify({
        pharmacyName: selectedPharmacy,
        staffName: staffFormName,
        id: staffFormId,
        password: staffFormPassword,
        role: staffFormRole,
        isActive: staffFormIsActive
      })
    });
    
    const data = await response.json();
    
    if (response.ok) {
      showNotice('success', 'Staff account created.');
      resetStaffForm(); // Clears form after success
      await fetchStaffForPharmacy(selectedPharmacy); 
    } else {
      showNotice('error', data.message || 'Failed to create account.');
    }
  } catch (err) {
    showNotice('error', 'Server offline.');
  }
};
  // ✏️ UPDATE STAFF LOGIN ACCOUNT (PharmacyStaff)
  const handleUpdateStaff = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!staffEditingId || !selectedPharmacy) return;

    if (!staffFormId.trim()) {
      showNotice('error', 'Staff ID is required.');
      return;
    }

    try {
      const payload: Record<string, unknown> = {
        id: staffFormId,
        staffName: staffFormName,
        role: staffFormRole,
        isActive: staffFormIsActive,
        pharmacyName: selectedPharmacy
      };
      if (staffFormPassword.trim()) {
        payload.password = staffFormPassword;
      }

      const response = await fetch(`${BACKEND_URL}/api/staff/${staffEditingId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await response.json();

      if (response.ok) {
        showNotice('success', 'Staff account updated.');
        await fetchStaffForPharmacy(selectedPharmacy);
        resetStaffForm();
      } else {
        showNotice('error', data.error || 'Failed to update staff account.');
      }
    } catch (err) {
      showNotice('error', 'Database connection handshake failure during save.');
    }
  };

  // ❌ DELETE STAFF LOGIN ACCOUNT (PharmacyStaff)
  const handleDeleteStaff = async (id: string) => {
    if (!selectedPharmacy) return;
    if (!window.confirm("Delete this staff member permanently? This cannot be undone.")) return;

    try {
      const response = await fetch(`${BACKEND_URL}/api/staff/${id}`, {
        method: 'DELETE'
      });
      const data = await response.json();

      if (response.ok) {
        showNotice('success', 'Staff member deleted.');
        setPharmacyStaff(prev => prev.filter(s => s._id !== id));
        if (staffEditingId === id) resetStaffForm();
      } else {
        showNotice('error', data.error || 'Failed to delete staff member.');
      }
    } catch (err) {
      showNotice('error', 'Network crash prevented staff deletion.');
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 antialiased font-sans">
      
      {/* Upper Navigation Canopy */}
      <nav className="bg-white border-b border-slate-200/80 sticky top-0 z-50 px-6 py-4 flex flex-col sm:flex-row justify-between items-center gap-4 shadow-xs">
        <div className="flex items-center gap-3">
          <div className="h-11 w-11 bg-teal-600 rounded-xl flex items-center justify-center text-white shadow-lg shadow-teal-600/20">
            <ShieldCheck className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-xl font-extrabold tracking-tight text-slate-900">{t?.dashTitle || "Admin Dashboard"}</h1>
            <p className="text-xs text-slate-500 font-medium">{t.welcome} <span className="text-teal-600 font-bold">{user.pharmacyName}</span></p>
          </div>
        </div>

        <button 
          onClick={onLogout}
          className="flex items-center gap-2 px-4 py-2 bg-rose-50 hover:bg-rose-100 text-rose-700 text-xs font-bold uppercase tracking-wider rounded-xl transition-all border border-rose-100 cursor-pointer"
        >
          <LogOut className="h-4 w-4" />
          <span>Exit Panel</span>
        </button>
      </nav>

      {/* Main Operations Canvas */}
      <main className="max-w-7xl mx-auto p-4 sm:p-6 lg:p-8 grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Dynamic Notification Toast */}
        {notification && (
          <div className={`fixed bottom-5 right-5 z-50 p-4 rounded-2xl shadow-2xl border flex items-center gap-3 max-w-md transition-all duration-300 text-sm font-semibold text-white ${
            notification.type === 'success' ? 'bg-emerald-600 border-emerald-500' : 'bg-rose-600 border-rose-500'
          }`}>
            <Activity className="h-5 w-5 shrink-0 animate-pulse" />
            <p>{notification.msg}</p>
          </div>
        )}

        {/* Column 1 & 2: Pharmacy Login Account Directory */}
        <div className="lg:col-span-2 space-y-4">
          <div className="bg-white rounded-3xl border border-slate-200/60 shadow-xs p-6 space-y-5">
            <div className="flex justify-between items-center flex-wrap gap-2">
              <h2 className="text-sm font-bold uppercase tracking-wider text-slate-400 flex items-center gap-2">
                <Building2 className="h-4 w-4 text-teal-600" /> System Registries
              </h2>
              <button 
                onClick={fetchAllPharmacies}
                className="p-2 hover:bg-slate-100 border border-slate-200 rounded-xl transition-all cursor-pointer text-slate-500 hover:text-teal-600"
                title="Refresh Database Connection"
              >
                <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin text-teal-600' : ''}`} />
              </button>
            </div>

            {/* Live Search Engine */}
            <div className="relative">
              <Search className="absolute left-3.5 top-3.5 w-4.5 h-4.5 text-slate-400" />
              <input 
                type="text"
                placeholder={t.searchPlaceholder}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-hidden focus:border-teal-500 focus:ring-2 focus:ring-teal-500/10 transition-all placeholder-slate-400 font-medium"
              />
            </div>

            {/* Core CRUD Table Layout — clicking pharmacy name opens ONLY that pharmacy's staff */}
            <div className="overflow-x-auto rounded-2xl border border-slate-200/60">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200/60 text-slate-500 font-bold uppercase tracking-wider">
                    <th className="p-4">{t.tableName}</th>
                    <th className="p-4">{t.tableId}</th>
                    <th className="p-4">{t.tableLocation}</th>
                    <th className="p-4">{t.tableStatus}</th>
                    <th className="p-4 text-right">{t.tableAction}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                  {filteredPharmacies.length > 0 ? (
                    filteredPharmacies.map((pharm) => (
                      <tr key={pharm._id} className="hover:bg-slate-50/60 transition-colors">
                        <td 
                          className="p-4 font-bold text-slate-900 text-sm cursor-pointer hover:text-teal-600 underline"
                          onClick={() => openPharmacyDetails(pharm.pharmacyName)}
                        >
                          {pharm.pharmacyName}
                        </td>
                        <td className="p-4 font-mono text-slate-500 font-semibold">{pharm.id}</td>
                        <td className="p-4 text-slate-600 font-medium">
                          <span className="inline-flex items-center gap-1.5">
                            <MapPin className="h-3.5 w-3.5 text-slate-400" />
                            {pharm.location || '—'}
                          </span>
                        </td>
                        <td className="p-4">
                          <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                            pharm.isActive ? 'bg-emerald-50 text-emerald-700 border border-emerald-100' : 'bg-rose-50 text-rose-700 border border-rose-100'
                          }`}>
                            {pharm.isActive ? <CheckCircle className="h-3 w-3" /> : <XCircle className="h-3 w-3" />}
                            {pharm.isActive ? t.active : t.inactive}
                          </span>
                        </td>
                        <td className="p-4 text-right space-x-2 whitespace-nowrap">
                          <button 
                            onClick={() => startEditMode(pharm)}
                            className="p-2 bg-slate-50 hover:bg-teal-50 text-slate-600 hover:text-teal-700 border border-slate-200 hover:border-teal-200 rounded-xl transition-all cursor-pointer inline-flex items-center"
                          >
                            <Edit3 className="h-3.5 w-3.5" />
                          </button>
                          <button 
                            onClick={() => handleDeleteUser(pharm._id)}
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
                        No active matching user configurations found.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Column 3: Pharmacy Login Account Mutator Box */}
        <div className="lg:col-span-1">
          <div className="bg-white rounded-3xl border border-slate-200/60 shadow-xs p-6 space-y-5 sticky top-24">
            <div>
              <div className="h-9 w-9 bg-teal-50 text-teal-700 rounded-xl flex items-center justify-center mb-3">
                {isEditing ? <Edit3 className="h-4.5 w-4.5" /> : <Plus className="h-5 w-5" />}
              </div>
              <h2 className="text-base font-bold text-slate-900 tracking-tight">
                {isEditing ? t.editHeading : t.createHeading}
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">Configure access accounts directly into MongoDB environment parameters.</p>
            </div>

            <form onSubmit={isEditing ? handleUpdateUser : handleCreateUser} className="space-y-4">
              
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Restaurant Store Name</label>
                <div className="relative">
                  <Building2 className="absolute left-3 top-3 w-4 h-4 text-slate-400" />
                  <input 
                    type="text"
                    required
                    placeholder="e.g. Everest Kitchen"
                    value={formPharmacyName}
                    onChange={(e) => setFormPharmacyName(e.target.value)}
                    className="w-full pl-9 pr-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-hidden focus:border-teal-500 transition-all font-medium"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Login Access ID</label>
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
                  {isEditing ? "New Security Password (Optional)" : "Security Password"}
                </label>
                <div className="relative">
                  <KeyRound className="absolute left-3 top-3 w-4 h-4 text-slate-400" />
                  <input 
                    type={showPassword ? "text" : "password"}
                    required={!isEditing}
                    placeholder={isEditing ? "•••••••• (Preserve current)" : "Minimum 6 credentials"}
                    value={formPassword}
                    onChange={(e) => setFormPassword(e.target.value)}
                    className="w-full pl-9 pr-10 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-hidden focus:border-teal-500 transition-all font-medium"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-3 text-slate-400 hover:text-slate-600 transition-colors"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* Phone / Email / Location / PAN-VAT — always in the form (create + edit),
                  but only VISIBLE in the table for edit mode users clicking Edit.
                  These fields appear in both create and edit modes here since the
                  edit panel IS this same form. */}
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Phone Number</label>
                <div className="relative">
                  <Phone className="absolute left-3 top-3 w-4 h-4 text-slate-400" />
                  <input 
                    type="text"
                    required
                    placeholder="e.g. 98XXXXXXXX"
                    value={formPhone}
                    onChange={(e) => setFormPhone(e.target.value)}
                    className="w-full pl-9 pr-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-hidden focus:border-teal-500 transition-all font-medium"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Email Address</label>
                <div className="relative">
                  <Mail className="absolute left-3 top-3 w-4 h-4 text-slate-400" />
                  <input 
                    type="email"
                    required
                    placeholder="e.g. Restaurant@example.com"
                    value={formEmail}
                    onChange={(e) => setFormEmail(e.target.value)}
                    className="w-full pl-9 pr-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-hidden focus:border-teal-500 transition-all font-medium"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Location</label>
                <div className="relative">
                  <MapPin className="absolute left-3 top-3 w-4 h-4 text-slate-400" />
                  <input 
                    type="text"
                    required
                    placeholder="e.g. Kathmandu, Nepal"
                    value={formLocation}
                    onChange={(e) => setFormLocation(e.target.value)}
                    className="w-full pl-9 pr-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-hidden focus:border-teal-500 transition-all font-medium"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">PAN / VAT Number</label>
                <div className="relative">
                  <FileText className="absolute left-3 top-3 w-4 h-4 text-slate-400" />
                  <input 
                    type="text"
                    placeholder="e.g. 600123456"
                    value={formPanOrVat}
                    onChange={(e) => setFormPanOrVat(e.target.value)}
                    className="w-full pl-9 pr-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-hidden focus:border-teal-500 transition-all font-medium"
                  />
                </div>
              </div>

              {isEditing && (
                <div className="flex items-center justify-between p-3.5 bg-slate-50 rounded-xl border border-slate-200/60 select-none">
                  <div>
                    <span className="text-[11px] font-bold text-slate-700 block">Account Token Node</span>
                    <span className="text-[10px] text-slate-400 font-medium">Allow system queries access</span>
                  </div>
                  <input 
                    type="checkbox"
                    id="isActiveToggle"
                    checked={formIsActive}
                    onChange={(e) => setFormIsActive(e.target.checked)}
                    className="w-4 h-4 rounded-md border-slate-300 text-teal-600 focus:ring-teal-500/20 h-5 w-5 accent-teal-600 cursor-pointer"
                  />
                </div>
              )}

              <div className="space-y-2 pt-2">
                <button
                  type="submit"
                  className="w-full py-3 bg-teal-600 hover:bg-teal-500 text-white font-bold text-xs uppercase tracking-wider rounded-xl transition-all shadow-md shadow-teal-600/10 hover:shadow-lg hover:shadow-teal-600/20 active:scale-[0.99] cursor-pointer"
                >
                  {isEditing ? t.submitUpdate : t.submitCreate}
                </button>

                {isEditing && (
                  <button
                    type="button"
                    onClick={resetForm}
                    className="w-full py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs uppercase tracking-wider rounded-xl transition-all text-center cursor-pointer"
                  >
                    {t.cancelBtn}
                  </button>
                )}
              </div>
            </form>
          </div>
        </div>
      </main>

      {/* ============================================================ */}
      {/* FULL-SCREEN STAFF MANAGEMENT OVERLAY (PharmacyStaff collection) */}
      {/* Only staff for the clicked pharmacy are ever loaded/shown.     */}
      {/* ============================================================ */}
      {selectedPharmacy && (
        <div className="fixed inset-0 z-[100] bg-slate-50 overflow-y-auto">
          <div className="max-w-6xl mx-auto p-4 sm:p-8 space-y-6">

            {/* Header with X close */}
            <div className="flex justify-between items-center bg-white p-6 rounded-3xl border border-slate-200 shadow-xs">
              <div>
                <h2 className="text-2xl font-bold text-slate-900">{selectedPharmacy} — Staff Management</h2>
                <p className="text-slate-500 text-sm mt-1">Add, edit, or remove personnel credentials for this Restaurant.</p>
              </div>
              <button
                onClick={closePharmacyDetails}
                className="p-3 bg-slate-100 rounded-full hover:bg-slate-200 transition-colors cursor-pointer"
                title="Close"
              >
                <XCircle className="h-6 w-6 text-slate-500" />
              </button>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">

              {/* List of Staff for this pharmacy only */}
              <div className="lg:col-span-2 bg-white p-6 rounded-3xl border border-slate-200 shadow-xs">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-sm font-bold uppercase tracking-wider text-slate-400 flex items-center gap-2">
                    <User className="h-4 w-4 text-teal-600" /> Staff Directory
                  </h3>
                  <button
                    onClick={() => fetchStaffForPharmacy(selectedPharmacy)}
                    className="p-2 hover:bg-slate-100 border border-slate-200 rounded-xl transition-all cursor-pointer text-slate-500 hover:text-teal-600"
                    title="Refresh"
                  >
                    <RefreshCw className={`h-4 w-4 ${isStaffLoading ? 'animate-spin text-teal-600' : ''}`} />
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
                        <th className="p-3 text-right">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                      {pharmacyStaff.length > 0 ? (
                        pharmacyStaff.map((staff) => (
                          <tr key={staff._id} className="hover:bg-slate-50/60 transition-colors">
                            <td className="p-3 font-bold text-slate-900">{staff.staffName || '—'}</td>
                            <td className="p-3 font-mono text-slate-500 font-semibold">{staff.id}</td>
                            <td className="p-3">{staff.role || 'Staff'}</td>
                            <td className="p-3">
                              <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                                staff.isActive ? 'bg-emerald-50 text-emerald-700 border border-emerald-100' : 'bg-rose-50 text-rose-700 border border-rose-100'
                              }`}>
                                {staff.isActive ? <CheckCircle className="h-3 w-3" /> : <XCircle className="h-3 w-3" />}
                                {staff.isActive ? 'Active' : 'Inactive'}
                              </span>
                            </td>
                            <td className="p-3 text-right space-x-2 whitespace-nowrap">
                              <button
                                onClick={() => startStaffEditMode(staff)}
                                className="p-2 bg-slate-50 hover:bg-teal-50 text-slate-600 hover:text-teal-700 border border-slate-200 hover:border-teal-200 rounded-xl transition-all cursor-pointer inline-flex items-center"
                              >
                                <Edit3 className="h-3.5 w-3.5" />
                              </button>
                              <button
                                onClick={() => handleDeleteStaff(staff._id)}
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
                            No staff members found for this Restaurant.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Create / Edit Staff Form */}
              <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-xs space-y-5">
                <div>
                  <div className="h-9 w-9 bg-teal-50 text-teal-700 rounded-xl flex items-center justify-center mb-3">
                    {isStaffEditing ? <Edit3 className="h-4.5 w-4.5" /> : <UserPlus className="h-5 w-5" />}
                  </div>
                  <h3 className="text-base font-bold text-slate-900 tracking-tight">
                    {isStaffEditing ? 'Edit Staff Member' : 'Add Staff Member'}
                  </h3>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Restaurant: <span className="font-semibold text-slate-600">{selectedPharmacy}</span>
                  </p>
                </div>

               <form onSubmit={isStaffEditing ? handleUpdateStaff : handleCreateStaff} className="space-y-4">
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Staff Name</label>
                    <div className="relative">
                      <User className="absolute left-3 top-3 w-4 h-4 text-slate-400" />
                      <input
                        type="text"
                        required
                        placeholder="e.g. Ramesh Sharma"
                        value={staffFormName}
                        onChange={(e) => setStaffFormName(e.target.value)}
                        className="w-full pl-9 pr-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-hidden focus:border-teal-500 transition-all font-medium"
                      />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Staff ID</label>
                    <div className="relative">
                      <User className="absolute left-3 top-3 w-4 h-4 text-slate-400" />
                      <input
                        type="text"
                        required
                        placeholder="Alphanumeric code string"
                        value={staffFormId}
                        onChange={(e) => setStaffFormId(e.target.value)}
                        className="w-full pl-9 pr-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-hidden focus:border-teal-500 transition-all font-mono font-medium"
                      />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                      {isStaffEditing ? 'New Password (optional)' : 'Password'}
                    </label>
                    <div className="relative">
                      <KeyRound className="absolute left-3 top-3 w-4 h-4 text-slate-400" />
                      <input
                        type={showStaffPassword ? "text" : "password"}
                        required={!isStaffEditing}
                        placeholder={isStaffEditing ? "•••••••• (Preserve current)" : "Minimum 6 credentials"}
                        value={staffFormPassword}
                        onChange={(e) => setStaffFormPassword(e.target.value)}
                        className="w-full pl-9 pr-10 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-hidden focus:border-teal-500 transition-all font-medium"
                      />
                      <button
                        type="button"
                        onClick={() => setShowStaffPassword(!showStaffPassword)}
                        className="absolute right-3 top-3 text-slate-400 hover:text-slate-600 transition-colors"
                      >
                        {showStaffPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Role</label>
                    <select
                      value={staffFormRole}
                      onChange={(e) => setStaffFormRole(e.target.value)}
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
                      checked={staffFormIsActive}
                      onChange={(e) => setStaffFormIsActive(e.target.checked)}
                      className="w-4 h-4 rounded-md border-slate-300 text-teal-600 focus:ring-teal-500/20 h-5 w-5 accent-teal-600 cursor-pointer"
                    />
                  </div>

                  <div className="space-y-2 pt-2">
                    <button
                      type="button"
                       onClick={isStaffEditing ? handleUpdateStaff : handleCreateStaff}
                        className="w-full py-3 bg-teal-600 hover:bg-teal-500 text-white font-bold text-xs uppercase tracking-wider rounded-xl transition-all shadow-md shadow-teal-600/10 hover:shadow-lg hover:shadow-teal-600/20 active:scale-[0.99] cursor-pointer"
>
                          {isStaffEditing ? 'Save Changes' : 'Create Staff Account'}
                    </button>

                    {isStaffEditing && (
                      <button
                        type="button"
                        onClick={resetStaffForm}
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
      )}

    </div>
  );
}