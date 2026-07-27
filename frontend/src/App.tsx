import React, { useState, useEffect } from 'react';
import {
  Activity, Users, ShoppingBag, Database, FileText, Globe, Search,
  ShieldAlert, UserCheck, ChevronRight, Printer, X, Stethoscope,
  LogOut, Menu, Lock, User2, AlertCircle, Loader2, ClipboardPlus,
  Settings, ClipboardList, LayoutGrid, Flame
} from 'lucide-react';

import { Patient, Medicine, Sale, Supplier, PurchaseOrder, StockMovement } from './types';
import { TRANSLATIONS } from './translations'; 
import { LocalDB } from './db';
import { Utensils } from "lucide-react";
import Tables from './components/Table';
import KitchenDisplay from './components/KitchenDisplay';
import CreateBill from './components/CreateBill';
import TotalOrder from './components/DailyOrderItem';

import Dashboard from './components/Dashboard';
import CreateOrder from './components/CreateOrder';
import MenuManager from './components/MenuManager';
import BillingManager from './components/BillingManager';
import LoginScreen from './components/LoginScreen';
import AdminDashboard from './components/AdminDashboard';
import StaffManager from './components/StaffManager';
import PharmacySettings from './components/Setting';
import OrdersPage from './components/Orders';

// Base URL for the live Express + MongoDB backend
const API_BASE_URL = 'https://rms-0wk0.onrender.com/api';

/* ------------------------------------------------------------------ */
/*  Staff role -> page access configuration                            */
/* ------------------------------------------------------------------ */

type StaffRole =
  | 'Manager'
  | 'Waiter'
  | 'Kitchen Staff'
  | 'Cashier';

  type AppView = 'dashboard' | 'pos' | 'inventory' | 'billing' | 'staff' | 'settings' | 'orders' | 'tables' | 'kitchen' | 'createbill' | 'totalorder';

interface RoleConfig {
  label: StaffRole;
  pages: AppView[];
  defaultView: AppView;
}

// 🔧 Role -> page access map for the restaurant version:
// - Manager: full access to everything
// - Waiter: menu (inventory view of menu items), orders, create order (pos), kitchen (to check status)
// - Kitchen Staff: kitchen display only
// - Cashier: create bill, tables, billing, and VAT audit (billing includes VAT audit view)
const ROLE_ACCESS: Record<StaffRole, RoleConfig> = {
  Manager: {
    label: 'Manager',
    pages: ['dashboard', 'pos', 'inventory', 'billing', 'staff', 'settings', 'orders', 'tables', 'kitchen', 'createbill','totalorder'],
    defaultView: 'dashboard',
  },
  Waiter: {
    label: 'Waiter',
    pages: ['inventory', 'orders', 'pos'],
    defaultView: 'pos',
  },
  'Kitchen Staff': {
    label: 'Kitchen Staff',
    pages: ['kitchen'],
    defaultView: 'kitchen',
  },
  Cashier: {
    label: 'Cashier',
    pages: ['createbill', 'tables', 'billing','totalorder'],
    defaultView: 'createbill',
  },
};

// Your existing components still expect the old 3-tier role prop
// ('Receptionist' | 'Pharmacist' | 'Owner') for their internal permission
// checks. This maps the new 4-tier staff role onto that so those
// components keep working unmodified.
const LEGACY_ROLE_MAP: Record<StaffRole, 'Receptionist' | 'Pharmacist' | 'Owner'> = {
  Manager: 'Owner',
  Waiter: 'Receptionist',
  'Kitchen Staff': 'Pharmacist',
  Cashier: 'Pharmacist',
};

/* ------------------------------------------------------------------ */
/*  Staff login gate — shown after a non-admin restaurant account logs */
/*  in, before the main system is unlocked.                            */
/* ------------------------------------------------------------------ */

function StaffLoginGate({
  lang,
  pharmacyName,
  onStaffLoginSuccess,
  onBackToPharmacyLogin,
}: {
  lang: 'en' | 'ne';
  pharmacyName: string;
  onStaffLoginSuccess: (role: StaffRole, staffId: string, pharmacyName: string) => void;
  onBackToPharmacyLogin: () => void;
}) {
  const [id, setId] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!id.trim() || !password.trim()) {
      setError(
        lang === 'en'
          ? 'Enter both staff ID and password.'
          : 'कर्मचारी आईडी र पासवर्ड दुवै भर्नुहोस्।'
      );
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/staff/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: id.trim(), password, pharmacyName }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(
          data?.message ||
            (lang === 'en' ? 'Invalid staff ID or password.' : 'गलत आईडी वा पासवर्ड।')
        );
        setLoading(false);
        return;
      }

      const role = data?.user?.role as StaffRole;
      const returnedPharmacy: string | undefined = data?.user?.pharmacyName;

      if (!role || !ROLE_ACCESS[role]) {
        setError(
          lang === 'en'
            ? 'This staff account has no recognized role. Contact your admin.'
            : 'यो कर्मचारी खातासँग मान्य भूमिका छैन। एडमिनलाई सम्पर्क गर्नुहोस्।'
        );
        setLoading(false);
        return;
      }

      // Defensive check: your backend currently looks up staff by ID alone
      // (it doesn't filter by pharmacyName), so a staff ID from a different
      // restaurant could otherwise slip through here. Block it client-side
      // until the /api/staff/login route is updated to query by
      // { id, pharmacyName } together.
      if (returnedPharmacy && returnedPharmacy !== pharmacyName) {
        setError(
          lang === 'en'
            ? 'This staff account does not belong to this restaurant.'
            : 'यो कर्मचारी खाता यो रेस्टुरेन्टसँग सम्बन्धित छैन।'
        );
        setLoading(false);
        return;
      }

      setLoading(false);
      onStaffLoginSuccess(role, data.user.id, returnedPharmacy || pharmacyName);
    } catch (err) {
      setError(
        lang === 'en'
          ? 'Could not reach the server. Please try again.'
          : 'सर्भरसम्म पुग्न सकिएन। फेरि प्रयास गर्नुहोस्।'
      );
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4 font-sans">
      <div className="w-full max-w-sm bg-white rounded-2xl shadow-lg border border-gray-100 p-8">
        <div className="flex items-center gap-2.5 mb-6">
          <div className="h-10 w-10 bg-teal-600 rounded-xl flex items-center justify-center text-white shadow-xs">
            <Utensils className="h-5 w-5" />
          </div>
          <div>
            <p className="text-[10px] font-bold text-teal-600 uppercase tracking-widest leading-none">
              {lang === 'en' ? 'Staff Terminal' : 'कर्मचारी टर्मिनल'}
            </p>
            <h1 className="text-base font-extrabold text-gray-900 leading-tight">
              {pharmacyName || (lang === 'en' ? 'Restaurant' : '')}
            </h1>
          </div>
        </div>

        <h2 className="text-lg font-bold text-gray-900 mb-1">
          {lang === 'en' ? 'Staff sign in' : 'कर्मचारी लगइन'}
        </h2>
        <p className="text-xs text-gray-500 mb-6">
          {lang === 'en'
            ? 'Enter the ID and password issued by your restaurant admin.'
            : 'रेस्टुरेन्ट एडमिनले दिएको आईडी र पासवर्ड प्रविष्ट गर्नुहोस्।'}
        </p>

        {error && (
          <div className="mb-4 flex items-start gap-2 rounded-md border border-amber-300/50 bg-amber-50 px-3 py-2.5 text-xs text-amber-800">
            <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <label className="block text-xs font-semibold text-gray-700 mb-1.5">
            {lang === 'en' ? 'Staff ID' : 'कर्मचारी आईडी'}
          </label>
          <div className="mb-4 flex items-center gap-2 rounded-lg border border-gray-200 focus-within:border-teal-600 focus-within:ring-1 focus-within:ring-teal-600 px-3 py-2.5 bg-white">
            <User2 className="h-4 w-4 text-gray-400" />
            <input
              type="text"
              value={id}
              onChange={(e) => setId(e.target.value)}
              placeholder="e.g. STF-0042"
              className="w-full outline-none text-sm text-gray-900 placeholder:text-gray-300 font-mono"
              autoComplete="username"
            />
          </div>

          <label className="block text-xs font-semibold text-gray-700 mb-1.5">
            {lang === 'en' ? 'Password' : 'पासवर्ड'}
          </label>
          <div className="mb-6 flex items-center gap-2 rounded-lg border border-gray-200 focus-within:border-teal-600 focus-within:ring-1 focus-within:ring-teal-600 px-3 py-2.5 bg-white">
            <Lock className="h-4 w-4 text-gray-400" />
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="w-full outline-none text-sm text-gray-900 placeholder:text-gray-300"
              autoComplete="current-password"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full flex items-center justify-center gap-2 rounded-lg bg-teal-600 text-white text-sm font-bold py-2.5 hover:bg-teal-700 disabled:opacity-70 transition-colors cursor-pointer"
          >
            {loading && <Loader2 className="h-4 w-4 animate-spin" />}
            {loading
              ? lang === 'en' ? 'Checking credentials…' : 'जाँच गर्दै…'
              : lang === 'en' ? 'Sign in' : 'लगइन गर्नुहोस्'}
          </button>
        </form>

        <button
          type="button"
          onClick={onBackToPharmacyLogin}
          className="w-full text-center text-xs text-gray-500 mt-5 hover:text-teal-700 transition-colors cursor-pointer"
        >
          {lang === 'en' ? '← Back to restaurant login' : '← रेस्टुरेन्ट लगइनमा फर्कनुहोस्'}
        </button>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */

export default function App() {
  // Global View states
  const [currentView, setCurrentView] = useState<AppView>('dashboard');
  const [lang, setLang] = useState<'en' | 'ne'>('en');
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  // Unified authentication state to prevent asynchronous state synchronization drops
  const [authState, setAuthState] = useState<{
    isAuthenticated: boolean | null;
    isAdmin: boolean;
  }>({
    isAuthenticated: null,
    isAdmin: false
  });

  const [currentUserPayload, setCurrentUserPayload] = useState<{ _id: string; id: string; pharmacyName: string } | null>(null);

  // Staff-level authentication (sits "inside" a logged-in restaurant account)
  const [staffAuthState, setStaffAuthState] = useState<{
    isAuthenticated: boolean;
    role: StaffRole | null;
  }>({
    isAuthenticated: false,
    role: null,
  });
  const [staffPayload, setStaffPayload] = useState<{ id: string; role: StaffRole; pharmacyName: string } | null>(null);

  // Database lists
  const [patients, setPatients] = useState<Patient[]>([]);
  const [medicines, setMedicines] = useState<Medicine[]>([]);
  const [sales, setSales] = useState<Sale[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [purchaseOrders, setPurchaseOrders] = useState<PurchaseOrder[]>([]);
  const [stockMovements, setStockMovements] = useState<StockMovement[]>([]);

  // Sub-selection shortcut states
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null);
  const [invoiceToView, setInvoiceToView] = useState<Sale | null>(null);

  // Global search input
  const [globalSearchQuery, setGlobalSearchQuery] = useState('');
  const [showGlobalSearchResults, setShowGlobalSearchResults] = useState(false);

  // Fetch patients live from MongoDB via the Express backend
  const fetchPatients = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/patients`);
      const result = await response.json();
      if (result.success && Array.isArray(result.data)) {
        setPatients(result.data);
      } else {
        console.error('Unexpected response shape while fetching patients:', result);
      }
    } catch (error) {
      console.error('🔴 Failed to fetch patients from MongoDB:', error);
    }
  };

  // Load and refresh the non-patient state arrays from local storage DB
  const refreshLocalData = () => {
    setMedicines(LocalDB.getMedicines());
    setSales(LocalDB.getSales());
    setSuppliers(LocalDB.getSuppliers());
    setPurchaseOrders(LocalDB.getPurchaseOrders());
    setStockMovements(LocalDB.getStockMovements());
  };

  // Combined refresh: called after any mutation
  const refreshData = () => {
    fetchPatients();
    refreshLocalData();
  };

  // Automatically read directly from persistent local storage during verification check
  useEffect(() => {
    refreshData();

    const checkSession = async () => {
      const token = localStorage.getItem('authToken');
      if (!token) {
        setAuthState({ isAuthenticated: false, isAdmin: false });
        return;
      }
      try {
        const response = await fetch(`${API_BASE_URL}/auth/verify`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token })
        });
        const data = await response.json();

        if (response.ok && data.success) {
          const targetUser = data.user || data.data?.user || data.data || data;

          const isAdminUser = !!(
            targetUser?.isAdmin === true ||
            targetUser?.role === 'Admin' ||
            String(targetUser?.role).toLowerCase() === 'admin' ||
            String(targetUser?.id).toLowerCase() === 'admin'
          );

          setCurrentUserPayload({
            _id: targetUser?._id || targetUser?.id || 'user-id',
            id: targetUser?.id || targetUser?._id || 'user-id',
            pharmacyName: targetUser?.pharmacyName || 'Restaurant Workspace'
          });

          setAuthState({ isAuthenticated: true, isAdmin: isAdminUser });
        } else {
          localStorage.removeItem('authToken');
          setAuthState({ isAuthenticated: false, isAdmin: false });
        }
      } catch (err) {
        localStorage.removeItem('authToken');
        setAuthState({ isAuthenticated: false, isAdmin: false });
      }
    };
    checkSession();
  }, []);

  // Once a non-admin restaurant account is confirmed, try to restore a
  // staff session that was previously active for THIS specific restaurant.
  useEffect(() => {
    if (
      authState.isAuthenticated === true &&
      !authState.isAdmin &&
      currentUserPayload &&
      !staffAuthState.isAuthenticated
    ) {
      const savedRole = localStorage.getItem('staffRole') as StaffRole | null;
      const savedId = localStorage.getItem('staffId');
      const savedPharmacy = localStorage.getItem('staffPharmacyName');

      if (
        savedRole &&
        savedId &&
        savedPharmacy &&
        savedPharmacy === currentUserPayload.pharmacyName &&
        ROLE_ACCESS[savedRole]
      ) {
        setStaffPayload({ id: savedId, role: savedRole, pharmacyName: savedPharmacy });
        setStaffAuthState({ isAuthenticated: true, role: savedRole });
        setCurrentView(ROLE_ACCESS[savedRole].defaultView);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authState.isAuthenticated, authState.isAdmin, currentUserPayload]);

  // Keep currentView valid whenever the staff role changes
  useEffect(() => {
    if (staffPayload && !ROLE_ACCESS[staffPayload.role].pages.includes(currentView)) {
      setCurrentView(ROLE_ACCESS[staffPayload.role].defaultView);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [staffPayload]);

  // Full logout: clears both restaurant session and any staff session
  const handleLogout = () => {
    localStorage.removeItem('authToken');
    localStorage.removeItem('user');
    localStorage.removeItem('staffRole');
    localStorage.removeItem('staffId');
    localStorage.removeItem('staffPharmacyName');
    setCurrentUserPayload(null);
    setStaffPayload(null);
    setStaffAuthState({ isAuthenticated: false, role: null });
    setAuthState({ isAuthenticated: false, isAdmin: false });
  };

  // Staff-only logout: keeps the restaurant session, returns to staff login
  const handleStaffLogout = () => {
    localStorage.removeItem('staffRole');
    localStorage.removeItem('staffId');
    localStorage.removeItem('staffPharmacyName');
    setStaffPayload(null);
    setStaffAuthState({ isAuthenticated: false, role: null });
  };

  // Validates role data dynamically using the parameters returned by LoginScreen
  const handleLoginSuccess = (token: string, userDetails?: any) => {
    localStorage.setItem('authToken', token);

    let isUserAdmin = false;
    let decodedPayload: any = null;

    if (token && token.includes('.')) {
      try {
        const base64Url = token.split('.')[1];
        const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
        const jsonPayload = decodeURIComponent(
          window.atob(base64)
            .split('')
            .map(c => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
            .join('')
          );
        decodedPayload = JSON.parse(jsonPayload);
      } catch (e) {
        console.error("Failed to parse token claims", e);
      }
    }

    const roleSource = userDetails?.user || userDetails?.data?.user || userDetails?.data || userDetails || decodedPayload || {};

    if (
      roleSource.isAdmin === true ||
      roleSource.role === 'Admin' ||
      String(roleSource.role).toLowerCase() === 'admin' ||
      roleSource.isSystemAdmin === true ||
      String(roleSource.id).toLowerCase() === 'admin'
    ) {
      isUserAdmin = true;
    }

    setCurrentUserPayload({
      _id: roleSource._id || roleSource.id || 'user-id',
      id: roleSource.id || roleSource._id || 'user-id',
      pharmacyName: roleSource.pharmacyName || 'Restaurant Workspace'
    });

    localStorage.setItem('user', JSON.stringify({
      _id: roleSource._id || roleSource.id || '',
      id: roleSource.id || roleSource._id || '',
      pharmacyName: roleSource.pharmacyName || '',
    }));

    setAuthState({
      isAuthenticated: true,
      isAdmin: isUserAdmin
    });
  };

  // Called by StaffLoginGate once a staff member successfully authenticates
  const handleStaffLoginSuccess = (role: StaffRole, staffId: string, pharmacyName: string) => {
    localStorage.setItem('staffRole', role);
    localStorage.setItem('staffId', staffId);
    localStorage.setItem('staffPharmacyName', pharmacyName);
    setStaffPayload({ id: staffId, role, pharmacyName });
    setStaffAuthState({ isAuthenticated: true, role });
    setCurrentView(ROLE_ACCESS[role].defaultView);
  };

  // ========================================================
  // STRICT SYSTEM GATEWAY ROUTING TREE
  // ========================================================

  // Gateway 1: Session verification pending
  if (authState.isAuthenticated === null) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col justify-center items-center font-sans">
        <div className="flex flex-col items-center space-y-4">
          <div className="h-12 w-12 rounded-xl bg-teal-50 border border-teal-100 flex items-center justify-center animate-spin">
            <Activity className="h-6 w-6 text-teal-600" />
          </div>
          <p className="text-slate-500 text-xs tracking-wider animate-pulse font-medium">
            {lang === 'en' ? 'Verifying session secure keys...' : 'सेसन सुरक्षित कुञ्जीहरू रुजु गर्दै...'}
          </p>
        </div>
      </div>
    );
  }

  // Gateway 2: Not Logged In -> Restaurant / Admin login
  if (authState.isAuthenticated === false) {
    return (
      <LoginScreen
        lang={lang}
        setLang={setLang}
        onLoginSuccess={(token, user) => handleLoginSuccess(token, user)}
      />
    );
  }

  // Gateway 3: MUST BE ADMIN -> Opens Admin Dashboard exclusively
  if (authState.isAuthenticated && authState.isAdmin === true) {
    const adminTranslations = TRANSLATIONS[lang];
    return (
      <AdminDashboard
        lang={lang}
        setLang={setLang}
        onLogout={handleLogout}
        currentUserPayload={currentUserPayload}
        user={currentUserPayload}
        payload={currentUserPayload}
        t={adminTranslations}
        translations={adminTranslations}
        langData={adminTranslations}
      />
    );
  }

  // Gateway 4: Restaurant account is logged in, but no staff member has
  // signed in on this terminal yet -> require staff login first.
  if (authState.isAuthenticated && !authState.isAdmin && !staffAuthState.isAuthenticated) {
    return (
      <StaffLoginGate
        lang={lang}
        pharmacyName={currentUserPayload?.pharmacyName || ''}
        onStaffLoginSuccess={handleStaffLoginSuccess}
        onBackToPharmacyLogin={handleLogout}
      />
    );
  }

  // Gateway 5: FALLTHROUGH -> Standard system, scoped to the logged-in staff role
  const t = TRANSLATIONS[lang];
  const staffRole: StaffRole = staffPayload?.role ?? 'Waiter';
  const legacyRole = LEGACY_ROLE_MAP[staffRole];
  const canAccess = (view: AppView) => ROLE_ACCESS[staffRole].pages.includes(view);
  // 🔧 The restaurant this whole session belongs to — needed by StaffManager
  // so it only ever shows/edits staff for this restaurant.
  const activePharmacyName = staffPayload?.pharmacyName || currentUserPayload?.pharmacyName || '';

  const matchingGlobalPatients = globalSearchQuery.trim()
    ? patients.filter(p =>
        (p.fullName || (p as any).name || '').toLowerCase().includes(globalSearchQuery.toLowerCase()) ||
        (p.phone || (p as any).phoneNumber || '').includes(globalSearchQuery) ||
        String(p.id || p._id || '').toLowerCase().includes(globalSearchQuery.toLowerCase())
      )
    : [];

  const handleGlobalSearchSelect = (patient: Patient) => {
    setSelectedPatient(patient);
    setGlobalSearchQuery('');
    setShowGlobalSearchResults(false);
  };

  return (
    <div className="min-h-screen bg-[#f8fafc] flex flex-col md:flex-row font-sans text-gray-800 antialiased" id="app-root">

      {/* SIDEBAR NAVIGATION PANEL — sticky so it stays put while <main> scrolls */}
      <aside className="hidden md:flex md:w-64 md:sticky md:top-0 md:h-screen md:overflow-y-auto bg-white border-r border-gray-200 flex-col justify-between shrink-0" id="app-sidebar">
        <div className="p-5 flex flex-col space-y-6">

          {/* Restaurant Brand Identity */}
          <div className="flex items-center gap-2.5" id="sidebar-brand">
            <div className="h-10 w-10 bg-teal-600 rounded-xl flex items-center justify-center text-white shadow-xs">
              <Utensils className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-base font-extrabold text-gray-900 tracking-tight leading-tight">{t.title}</h2>
              <span className="text-[10px] font-bold text-teal-600 uppercase tracking-widest block leading-none">{t.location}</span>
            </div>
          </div>

          {/* Tab Navigation links — filtered by staff role access */}
          <nav className="space-y-1" id="sidebar-nav">
            {canAccess('dashboard') && (
              <button
                onClick={() => { setCurrentView('dashboard'); setSelectedPatient(null); }}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-semibold transition-all ${
                  currentView === 'dashboard'
                    ? 'bg-teal-50 text-teal-800'
                    : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                }`}
              >
                <Activity className={`h-4.5 w-4.5 ${currentView === 'dashboard' ? 'text-teal-600' : 'text-gray-400'}`} />
                <span>{t.dashboard}</span>
              </button>
            )}

            {canAccess('totalorder') && (
  <button
    onClick={() => { setCurrentView('totalorder'); setSelectedPatient(null); }}
    className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-semibold transition-all ${
      currentView === 'totalorder'
        ? 'bg-teal-50 text-teal-800'
        : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
    }`}
  >
    <ClipboardList className={`h-4.5 w-4.5 ${currentView === 'totalorder' ? 'text-teal-600' : 'text-gray-400'}`} />
    <span>{lang === 'en' ? 'Total Sales' : 'कुल बिक्री'}</span>
  </button>
)}

            {canAccess('createbill') && (
              <button
                onClick={() => { setCurrentView('createbill'); setSelectedPatient(null); }}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-semibold transition-all ${
                  currentView === 'createbill'
                    ? 'bg-teal-50 text-teal-800'
                    : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                }`}
              >
                <FileText className={`h-4.5 w-4.5 ${currentView === 'createbill' ? 'text-teal-600' : 'text-gray-400'}`} />
                <span>{lang === 'en' ? 'Create Bill' : 'बिल बनाउनुहोस्'}</span>
              </button>
            )}

            {canAccess('kitchen') && (
              <button
                onClick={() => { setCurrentView('kitchen'); setSelectedPatient(null); }}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-semibold transition-all ${
                  currentView === 'kitchen'
                    ? 'bg-teal-50 text-teal-800'
                    : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                }`}
              >
                <Flame className={`h-4.5 w-4.5 ${currentView === 'kitchen' ? 'text-teal-600' : 'text-gray-400'}`} />
                <span>{lang === 'en' ? 'Kitchen' : 'भान्सा'}</span>
              </button>
            )}

            {canAccess('tables') && (
              <button
                onClick={() => { setCurrentView('tables'); setSelectedPatient(null); }}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-semibold transition-all ${
                  currentView === 'tables' ? 'bg-teal-50 text-teal-800' : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                }`}
              >
                <LayoutGrid className={`h-4.5 w-4.5 ${currentView === 'tables' ? 'text-teal-600' : 'text-gray-400'}`} />
                <span>{lang === 'en' ? 'Tables' : 'टेबलहरू'}</span>
              </button>
            )}

            {canAccess('pos') && (
              <button
                onClick={() => { setCurrentView('pos'); }}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-semibold transition-all ${
                  currentView === 'pos'
                    ? 'bg-teal-50 text-teal-800'
                    : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                }`}
              >
                <ShoppingBag className={`h-4.5 w-4.5 ${currentView === 'pos' ? 'text-teal-600' : 'text-gray-400'}`} />
                <span>{lang === 'en' ? 'Create Order' : 'अर्डर बनाउनुहोस्'}</span>
              </button>
            )}

            {canAccess('orders') && (
              <button
                onClick={() => { setCurrentView('orders'); setSelectedPatient(null); }}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-semibold transition-all ${
                  currentView === 'orders'
                    ? 'bg-teal-50 text-teal-800'
                    : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                }`}
              >
                <ClipboardList className={`h-4.5 w-4.5 ${currentView === 'orders' ? 'text-teal-600' : 'text-gray-400'}`} />
                <span>{lang === 'en' ? 'Orders' : 'अर्डरहरू'}</span>
              </button>
            )}

            {canAccess('inventory') && (
              <button
                onClick={() => { setCurrentView('inventory'); setSelectedPatient(null); }}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-semibold transition-all ${
                  currentView === 'inventory'
                    ? 'bg-teal-50 text-teal-800'
                    : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                }`}
              >
                <Database className={`h-4.5 w-4.5 ${currentView === 'inventory' ? 'text-teal-600' : 'text-gray-400'}`} />
                <span>{lang === 'en' ? 'Menu' : 'मेनु'}</span>
              </button>
            )}

            {canAccess('billing') && (
              <button
                onClick={() => { setCurrentView('billing'); setSelectedPatient(null); }}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-semibold transition-all ${
                  currentView === 'billing'
                    ? 'bg-teal-50 text-teal-800'
                    : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                }`}
              >
                <FileText className={`h-4.5 w-4.5 ${currentView === 'billing' ? 'text-teal-600' : 'text-gray-400'}`} />
                <span>{lang === 'en' ? 'Billing & VAT Audit' : 'बिलिङ र भ्याट अडिट'}</span>
              </button>
            )}

            {/* Manager-only: Manage Staff */}
            {canAccess('staff') && (
              <button
                onClick={() => { setCurrentView('staff'); setSelectedPatient(null); }}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-semibold transition-all ${
                  currentView === 'staff'
                    ? 'bg-teal-50 text-teal-800'
                    : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                }`}
              >
                <UserCheck className={`h-4.5 w-4.5 ${currentView === 'staff' ? 'text-teal-600' : 'text-gray-400'}`} />
                <span>{lang === 'en' ? 'Manage Staff' : 'कर्मचारी व्यवस्थापन'}</span>
              </button>
            )}

            {/* Manager-only: Settings */}
            {canAccess('settings') && (
              <button
                onClick={() => { setCurrentView('settings'); setSelectedPatient(null); }}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-semibold transition-all ${
                  currentView === 'settings'
                    ? 'bg-teal-50 text-teal-800'
                    : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                }`}
              >
                <Settings className={`h-4.5 w-4.5 ${currentView === 'settings' ? 'text-teal-600' : 'text-gray-400'}`} />
                <span>{lang === 'en' ? 'Settings' : 'सेटिङ्स'}</span>
              </button>
            )}
          </nav>
        </div>

        {/* Sidebar Footer: real staff identity + logout */}
        <div className="p-5 border-t border-gray-100 space-y-3" id="sidebar-footer">
          <div className="space-y-1">
            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">{t.role}</span>
            <div className="p-2.5 bg-gray-50 rounded-lg border border-gray-150 text-[10px] text-gray-500 flex items-center gap-1.5">
              <UserCheck className="h-3.5 w-3.5 text-teal-600 shrink-0" />
              <div className="leading-tight">
                <span className="font-semibold block text-gray-800">{staffRole}</span>
                <span className="font-mono text-gray-400">{staffPayload?.id}</span>
              </div>
            </div>
          </div>

          <button
            onClick={handleStaffLogout}
            className="w-full mt-2 py-2 px-3 bg-red-50 hover:bg-red-100 text-red-600 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition-colors border border-red-200/50 cursor-pointer"
            id="sidebar-logout-btn"
          >
            <LogOut className="h-3.5 w-3.5" />
            <span>{lang === 'en' ? 'Log Out Staff' : 'कर्मचारी बाहिर निस्कनुहोस्'}</span>
          </button>

          <button
            onClick={handleLogout}
            className="w-full text-center text-[10px] text-gray-400 hover:text-gray-700 transition-colors cursor-pointer"
          >
            {lang === 'en' ? 'Switch restaurant account' : 'रेस्टुरेन्ट खाता बदल्नुहोस्'}
          </button>
        </div>
      </aside>

      {/* MAIN VIEWPORT WRAPPER */}
      <div className="flex-1 flex flex-col min-w-0" id="app-viewport">

        {/* TOP STATUS HEADER BAR */}
        <header className="h-16 bg-white border-b border-gray-200 px-4 sm:px-5 flex items-center justify-between shrink-0 sticky top-0 z-20" id="app-header">
          {/* Left side: View Title + Search trigger */}
          <div className="flex items-center gap-2 sm:gap-6" id="header-left">
            <button
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              className="p-1.5 rounded-lg border border-gray-200 text-gray-600 hover:text-gray-900 hover:bg-gray-50 md:hidden"
              id="mobile-menu-toggle"
              title="Open Navigation Menu"
            >
              <Menu className="h-5 w-5" />
            </button>

            <h1 className="text-sm sm:text-base font-extrabold text-gray-900">
              {currentView === 'dashboard' ? t.dashboard :
               currentView === 'pos' ? (lang === 'en' ? 'Create Order' : 'अर्डर बनाउनुहोस्') :
               currentView === 'inventory' ? (lang === 'en' ? 'Menu' : 'मेनु') :
               currentView === 'orders' ? (lang === 'en' ? 'Orders' : 'अर्डरहरू') :
               currentView === 'kitchen' ? (lang === 'en' ? 'Kitchen' : 'भान्सा') :
               currentView === 'tables' ? (lang === 'en' ? 'Tables' : 'टेबलहरू') :
               currentView === 'createbill' ? (lang === 'en' ? 'Create Bill' : 'बिल बनाउनुहोस्') :
               currentView === 'staff' ? (lang === 'en' ? 'Manage Staff' : 'कर्मचारी व्यवस्थापन') :
               currentView === 'settings' ? (lang === 'en' ? 'Settings' : 'सेटिङ्स') :
               (lang === 'en' ? 'Billing & VAT Audit' : 'बिलिङ र भ्याट अडिट')}
            </h1>
          </div>

          {/* Right side: active role tag */}
          <div className="flex items-center gap-4" id="header-right">
            <div className="hidden lg:flex items-center gap-2 text-xs font-semibold text-gray-600 font-mono bg-gray-50 px-3 py-1.5 rounded-lg border border-gray-200" id="utc-clock">
              <span className="inline-block h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
              <span> ACTIVE</span>
            </div>
          </div>
        </header>

        {/* CONTAINER VIEWPORT WORKSPACE */}
        <main className="flex-1 overflow-y-auto p-4 sm:p-6" id="app-main-viewport">
          {currentView === 'dashboard' && canAccess('dashboard') && (
            <Dashboard
              patients={patients}
              medicines={medicines}
              sales={sales}
              lang={lang}
              setView={(view) => setCurrentView(view as any)}
              setSelectedPatient={setSelectedPatient}
              onViewInvoice={(sale) => setInvoiceToView(sale)}
            />
          )}
          {currentView === 'totalorder' && canAccess('totalorder') && (
  <TotalOrder restaurantId={activePharmacyName} />
)}

          {currentView === 'kitchen' && canAccess('kitchen') && (
            <KitchenDisplay />
          )}

          {currentView === 'createbill' && canAccess('createbill') && (
            <CreateBill />
          )}

          {currentView === 'tables' && canAccess('tables') && (
            <Tables />
          )}

          {currentView === 'pos' && canAccess('pos') && (
            <CreateOrder onOrderCreated={refreshData} />
          )}

          {currentView === 'orders' && canAccess('orders') && (
            <OrdersPage />
          )}

          {currentView === 'inventory' && canAccess('inventory') && (
            <MenuManager
              lang={lang}
              currentUserRole={legacyRole}
            />
          )}

          {currentView === 'billing' && canAccess('billing') && (
            <BillingManager
              sales={sales}
              patients={patients}
              lang={lang}
              currentUserRole={legacyRole}
              onBillingUpdated={refreshData}
              onViewInvoice={(sale) => setInvoiceToView(sale)}
              initialInvoice={invoiceToView}
              onClearInitialInvoice={() => setInvoiceToView(null)}
            />
          )}

          {/* Manager-only: Manage Staff, scoped to this restaurant */}
          {canAccess('staff') && currentView === 'staff' && (
            <StaffManager pharmacyName={activePharmacyName} />
          )}

          {/* Manager-only: Settings */}
          {canAccess('settings') && currentView === 'settings' && (
            <PharmacySettings />
          )}
        </main>
      </div>

      {/* APP-WIDE GLOBAL INVOICE OVERLAY POPUP */}
      {invoiceToView && (
        <div className="fixed inset-0 bg-gray-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in" id="global-invoice-modal">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 space-y-6 shadow-2xl border border-gray-100">
            <div className="flex justify-between items-center border-b border-gray-100 pb-3">
              <span className="font-bold text-gray-900 flex items-center gap-1.5 text-sm">
                <FileText className="h-5 w-5 text-teal-600" />
                {lang === 'en' ? 'Tax Invoice Audit View' : 'कर बिजक विवरण'}
              </span>
              <button onClick={() => setInvoiceToView(null)} className="p-1 text-gray-400 hover:text-gray-950 cursor-pointer">
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Invoice Printable layout block */}
            <div className="p-5 border border-gray-300 rounded-xl bg-[#fafafa] font-sans text-xs text-gray-800 space-y-4 shadow-inner max-h-[400px] overflow-y-auto" id="global-printable-receipt">
              <div className="text-center space-y-1 pb-3 border-b border-gray-300 border-dashed">
                <h3 className="text-base font-bold text-gray-950 uppercase tracking-tight">{invoiceToView.pharmacyName || t.title}</h3>
                <p className="text-[10px] text-gray-500">{invoiceToView.location || t.location}</p>
                <p className="font-semibold text-[10px]">PAN / VAT No: {invoiceToView.panOrVat || 'N/A'}</p>
                <h4 className="text-xs font-extrabold text-gray-950 uppercase border-y border-gray-200 py-1 tracking-wider mt-2">{t.invoice}</h4>
                {invoiceToView.paymentStatus === 'Refunded' && (
                  <div className="my-1.5 py-1 bg-red-100 text-red-800 border-2 border-red-300 font-bold rounded uppercase tracking-widest text-[11px]" id="invoice-void-banner">
                    VOID / REFUNDED INVOICE
                  </div>
                )}
              </div>

              {/* metadata rows */}
              <div className="grid grid-cols-2 gap-y-1 border-b border-gray-200 pb-2 leading-relaxed">
                <div>Invoice No: <span className="font-mono font-bold text-gray-950">{invoiceToView.id}</span></div>
                <div className="text-right">Date: <span className="font-mono">{new Date(invoiceToView.createdAt).toLocaleString()}</span></div>

                {invoiceToView.patientId && (
                  <div className="col-span-2">
                    {t.receiptTo}: <span className="font-bold text-gray-900">
                      {patients.find(p => (p.id || p._id) === invoiceToView.patientId)?.fullName || (patients.find(p => (p.id || p._id) === invoiceToView.patientId) as any)?.name || 'N/A'}
                    </span>
                    <span className="text-[10px] text-gray-500 font-mono ml-1">({invoiceToView.patientId})</span>
                  </div>
                )}

                <div className="col-span-2">Payment Method: <span className="font-semibold text-gray-950">{invoiceToView.paymentMethod}</span></div>
              </div>

              {/* items */}
              <table className="w-full text-[11px] leading-relaxed">
                <thead>
                  <tr className="border-b border-gray-300 font-bold text-gray-950 text-left">
                    <th className="pb-1">Item</th>
                    <th className="pb-1 text-center">Qty</th>
                    <th className="pb-1 text-right">Rate</th>
                    <th className="pb-1 text-right">Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 border-b border-gray-300">
                  {invoiceToView.items.map((item, idx) => (
                    <tr key={idx} className="py-1">
                      <td className="py-1">
                        <p className="font-bold text-gray-950">{item.name}</p>
                        <p className="text-[9px] text-gray-500">{item.dosage}</p>
                      </td>
                      <td className="py-1 text-center font-mono">{item.quantity}</td>
                      <td className="py-1 text-right font-mono">NPR {item.unitPrice.toFixed(2)}</td>
                      <td className="py-1 text-right font-mono">NPR {item.totalPrice.toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {/* totals */}
              <div className="space-y-1 text-[11px] text-gray-700 max-w-[200px] ml-auto">
                <div className="flex justify-between">
                  <span>Subtotal:</span>
                  <span className="font-mono">NPR {invoiceToView.subTotal.toFixed(2)}</span>
                </div>
                {invoiceToView.discount > 0 && (
                  <div className="flex justify-between text-red-600">
                    <span>Discount:</span>
                    <span className="font-mono">-NPR {invoiceToView.discount.toFixed(2)}</span>
                  </div>
                )}
                <div className="flex justify-between font-medium">
                  <span>Taxable Post-Discount:</span>
                  <span className="font-mono">NPR {(invoiceToView.subTotal - invoiceToView.discount).toFixed(2)}</span>
                </div>
                <div className="flex justify-between">
                  <span>VAT Collected ({invoiceToView.vatRate}%):</span>
                  <span className="font-mono">NPR {invoiceToView.vatAmount.toFixed(2)}</span>
                </div>
                <div className="flex justify-between border-t border-gray-400 pt-1 text-xs text-gray-950 font-bold">
                  <span>GRAND TOTAL:</span>
                  <span className="font-mono text-teal-700">NPR {invoiceToView.grandTotal.toFixed(2)}</span>
                </div>
              </div>

              {invoiceToView.refundReason && (
                <div className="p-2.5 bg-red-50 border border-red-200 rounded-lg text-red-800 space-y-0.5 mt-3">
                  <p className="font-bold uppercase text-[9px]">Refund Audit Reason Log:</p>
                  <p className="italic">"{invoiceToView.refundReason}"</p>
                  <p className="text-[9px] font-mono text-right">Refunded on: {new Date(invoiceToView.refundedAt || '').toLocaleString()}</p>
                </div>
              )}

              {/* Sign footer block */}
              <div className="pt-8 flex justify-between items-end border-t border-dashed border-gray-300">
                <div className="text-center font-bold text-[9px] text-gray-400 border-t border-gray-300 pt-1 w-24">
                  Customer Sign
                </div>
                <div className="text-center italic text-[10px] text-gray-500">
                  {t.thankYou}
                </div>
                <div className="text-center font-bold text-[9px] text-gray-400 border-t border-gray-300 pt-1 w-24">
                  {t.authorizedSign}
                </div>
              </div>
            </div>

            {/* Print / Close */}
            <div className="flex justify-end gap-3 pt-4 border-t border-gray-100">
              <button
                type="button"
                onClick={() => setInvoiceToView(null)}
                className="px-5 py-2 bg-gray-100 hover:bg-gray-200 text-gray-800 text-xs font-bold uppercase tracking-wider rounded-lg border border-gray-200 cursor-pointer"
              >
                Close
              </button>
              <button
                type="button"
                onClick={() => window.print()}
                className="px-6 py-2 bg-teal-600 hover:bg-teal-700 text-white text-xs font-bold uppercase tracking-wider rounded-lg transition-colors shadow-xs flex items-center gap-1.5 cursor-pointer"
              >
                <Printer className="h-4 w-4" />
                Print Invoice
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MOBILE DRAWER OVERLAY */}
      {isMobileMenuOpen && (
        <div className="fixed inset-0 z-40 md:hidden flex" id="mobile-drawer-overlay">
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-gray-900/60 backdrop-blur-xs transition-opacity"
            onClick={() => setIsMobileMenuOpen(false)}
          />

          {/* Drawer Content */}
          <div className="relative w-72 max-w-[85vw] bg-white h-full flex flex-col justify-between shadow-2xl z-50 border-r border-gray-150">
            <div className="p-5 flex flex-col space-y-6">
              {/* Header with Close Button */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="h-9 w-9 bg-teal-600 rounded-lg flex items-center justify-center text-white">
                    <Utensils className="h-5 w-5" />
                  </div>
                  <div>
                    <h2 className="text-sm font-extrabold text-gray-900 leading-tight">{t.title}</h2>
                    <span className="text-[9px] font-bold text-teal-600 uppercase tracking-widest block leading-none">{t.location}</span>
                  </div>
                </div>
                <button
                  onClick={() => setIsMobileMenuOpen(false)}
                  className="p-1.5 rounded-lg border border-gray-100 text-gray-400 hover:text-gray-950 hover:bg-gray-50 cursor-pointer"
                  title="Close Menu"
                >
                  <X className="h-4.5 w-4.5" />
                </button>
              </div>

              {/* Navigation links — filtered by staff role access */}
              <nav className="space-y-1">
                {canAccess('dashboard') && (
                  <button
                    onClick={() => { setCurrentView('dashboard'); setSelectedPatient(null); setIsMobileMenuOpen(false); }}
                    className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-semibold transition-all ${
                      currentView === 'dashboard' ? 'bg-teal-50 text-teal-800' : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                    }`}
                  >
                    <Activity className={`h-4.5 w-4.5 ${currentView === 'dashboard' ? 'text-teal-600' : 'text-gray-400'}`} />
                    <span>{t.dashboard}</span>
                  </button>
                )}

                {canAccess('totalorder') && (
  <button
    onClick={() => { setCurrentView('totalorder'); setSelectedPatient(null); setIsMobileMenuOpen(false); }}
    className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-semibold transition-all ${
      currentView === 'totalorder' ? 'bg-teal-50 text-teal-800' : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
    }`}
  >
    <ClipboardList className={`h-4.5 w-4.5 ${currentView === 'totalorder' ? 'text-teal-600' : 'text-gray-400'}`} />
    <span>{lang === 'en' ? 'Total Sales' : 'कुल बिक्री'}</span>
  </button>
)}

                {canAccess('createbill') && (
                  <button
                    onClick={() => { setCurrentView('createbill'); setSelectedPatient(null); setIsMobileMenuOpen(false); }}
                    className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-semibold transition-all ${
                      currentView === 'createbill' ? 'bg-teal-50 text-teal-800' : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                    }`}
                  >
                    <FileText className={`h-4.5 w-4.5 ${currentView === 'createbill' ? 'text-teal-600' : 'text-gray-400'}`} />
                    <span>{lang === 'en' ? 'Create Bill' : 'बिल बनाउनुहोस्'}</span>
                  </button>
                )}

                {canAccess('kitchen') && (
                  <button
                    onClick={() => { setCurrentView('kitchen'); setSelectedPatient(null); setIsMobileMenuOpen(false); }}
                    className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-semibold transition-all ${
                      currentView === 'kitchen' ? 'bg-teal-50 text-teal-800' : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                    }`}
                  >
                    <Flame className={`h-4.5 w-4.5 ${currentView === 'kitchen' ? 'text-teal-600' : 'text-gray-400'}`} />
                    <span>{lang === 'en' ? 'Kitchen' : 'भान्सा'}</span>
                  </button>
                )}

                {canAccess('tables') && (
                  <button
                    onClick={() => { setCurrentView('tables'); setSelectedPatient(null); setIsMobileMenuOpen(false); }}
                    className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-semibold transition-all ${
                      currentView === 'tables' ? 'bg-teal-50 text-teal-800' : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                    }`}
                  >
                    <LayoutGrid className={`h-4.5 w-4.5 ${currentView === 'tables' ? 'text-teal-600' : 'text-gray-400'}`} />
                    <span>{lang === 'en' ? 'Tables' : 'टेबलहरू'}</span>
                  </button>
                )}

                {canAccess('pos') && (
                  <button
                    onClick={() => { setCurrentView('pos'); setIsMobileMenuOpen(false); }}
                    className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-semibold transition-all ${
                      currentView === 'pos' ? 'bg-teal-50 text-teal-800' : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                    }`}
                  >
                    <ShoppingBag className={`h-4.5 w-4.5 ${currentView === 'pos' ? 'text-teal-600' : 'text-gray-400'}`} />
                    <span>{lang === 'en' ? 'Create Order' : 'अर्डर बनाउनुहोस्'}</span>
                  </button>
                )}

                {canAccess('orders') && (
                  <button
                    onClick={() => { setCurrentView('orders'); setSelectedPatient(null); setIsMobileMenuOpen(false); }}
                    className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-semibold transition-all ${
                      currentView === 'orders' ? 'bg-teal-50 text-teal-800' : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                    }`}
                  >
                    <ClipboardList className={`h-4.5 w-4.5 ${currentView === 'orders' ? 'text-teal-600' : 'text-gray-400'}`} />
                    <span>{lang === 'en' ? 'Orders' : 'अर्डरहरू'}</span>
                  </button>
                )}

                {canAccess('inventory') && (
                  <button
                    onClick={() => { setCurrentView('inventory'); setSelectedPatient(null); setIsMobileMenuOpen(false); }}
                    className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-semibold transition-all ${
                      currentView === 'inventory' ? 'bg-teal-50 text-teal-800' : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                    }`}
                  >
                    <Database className={`h-4.5 w-4.5 ${currentView === 'inventory' ? 'text-teal-600' : 'text-gray-400'}`} />
                    <span>{lang === 'en' ? 'Menu' : 'मेनु'}</span>
                  </button>
                )}

                {canAccess('billing') && (
                  <button
                    onClick={() => { setCurrentView('billing'); setSelectedPatient(null); setIsMobileMenuOpen(false); }}
                    className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-semibold transition-all ${
                      currentView === 'billing' ? 'bg-teal-50 text-teal-800' : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                    }`}
                  >
                    <FileText className={`h-4.5 w-4.5 ${currentView === 'billing' ? 'text-teal-600' : 'text-gray-400'}`} />
                    <span>{lang === 'en' ? 'Billing & VAT Audit' : 'बिलिङ र भ्याट अडिट'}</span>
                  </button>
                )}

                {canAccess('staff') && (
                  <button
                    onClick={() => {
                      setCurrentView('staff');
                      setSelectedPatient(null);
                      setIsMobileMenuOpen(false);
                    }}
                    className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-semibold transition-all ${
                      currentView === 'staff' ? 'bg-teal-50 text-teal-800' : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                    }`}
                  >
                    <UserCheck className={`h-4.5 w-4.5 ${currentView === 'staff' ? 'text-teal-600' : 'text-gray-400'}`} />
                    <span>{lang === 'en' ? 'Manage Staff' : 'कर्मचारी व्यवस्थापन'}</span>
                  </button>
                )}

                {canAccess('settings') && (
                  <button
                    onClick={() => {
                      setCurrentView('settings');
                      setSelectedPatient(null);
                      setIsMobileMenuOpen(false);
                    }}
                    className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-semibold transition-all ${
                      currentView === 'settings' ? 'bg-teal-50 text-teal-800' : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                    }`}
                  >
                    <Settings className={`h-4.5 w-4.5 ${currentView === 'settings' ? 'text-teal-600' : 'text-gray-400'}`} />
                    <span>{lang === 'en' ? 'Settings' : 'सेटिङ्स'}</span>
                  </button>
                )}
              </nav>
            </div>

            {/* Staff identity & logout */}
            <div className="p-5 border-t border-gray-100 space-y-3 bg-gray-50/50">
              <div className="space-y-1">
                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">{t.role}</span>
                <div className="p-2.5 bg-white rounded-lg border border-gray-150 text-[10px] text-gray-500 flex items-center gap-1.5">
                  <UserCheck className="h-3.5 w-3.5 text-teal-600 shrink-0" />
                  <div className="leading-tight">
                    <span className="font-semibold block text-gray-800">{staffRole}</span>
                    <span className="font-mono text-gray-400">{staffPayload?.id}</span>
                  </div>
                </div>
              </div>

              <button
                onClick={() => { handleStaffLogout(); setIsMobileMenuOpen(false); }}
                className="w-full mt-2 py-2 px-3 bg-red-50 hover:bg-red-100 text-red-600 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition-colors border border-red-200/50 cursor-pointer"
              >
                <LogOut className="h-3.5 w-3.5" />
                <span>{lang === 'en' ? 'Log Out Staff' : 'कर्मचारी बाहिर निस्कनुहोस्'}</span>
              </button>

              <button
                onClick={() => { handleLogout(); setIsMobileMenuOpen(false); }}
                className="w-full text-center text-[10px] text-gray-400 hover:text-gray-700 transition-colors cursor-pointer"
              >
                {lang === 'en' ? 'Switch restaurant account' : 'रेस्टुरेन्ट खाता बदल्नुहोस्'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
