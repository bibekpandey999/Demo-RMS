import React, { useState, useEffect, useMemo } from 'react';
import {
  TrendingUp,
  ShoppingBag,
  Calendar,
  ArrowRight,
  Activity,
  FileText,
  Loader2,
  PackageX,
  UtensilsCrossed,
  Receipt,
  LayoutGrid,
  ClipboardList,
  ListOrdered,
} from 'lucide-react';
import { Patient, Sale } from '../types';
import { TRANSLATIONS } from '../translations';

// ==========================================
// CONFIG
// ==========================================

const API_BASE = import.meta.env.VITE_API_URL || ' https://demo-rms.onrender.com';
const BILLS_URL = `${API_BASE}/api/bills`;
const ORDERS_URL = `${API_BASE}/api/orders`;

// Key used when the restaurant logs in successfully (adjust if your login page uses a different key)
const RESTAURANT_USER_STORAGE_KEY = 'user';

interface DashboardProps {
  patients: Patient[];
  medicines?: unknown[];
  sales?: unknown[];
  lang: 'en' | 'ne';
  setView: (view: 'dashboard' | 'pos' | 'inventory' | 'billing' | 'staff' | 'settings' | 'orders' | 'tables' | 'kitchen' | 'createbill') => void;
  setSelectedPatient: (patient: Patient | null) => void;
  onViewInvoice: (sale: Sale) => void;
}

// ==========================================
// TYPES — raw shapes returned by the Express + MongoDB backend
// ==========================================

interface RawBillLine {
  _id: string;
  invoiceNo: string;
  billTo: string;
  tableNumber?: string | number;
  paymentMethod: string;
  date: string;
  items: {
    name: string;
    quantity: number;
    unitPrice: number;
    totalPrice: number;
  }[];
  subtotal: number;
  discount: number;
  taxableAmount: number;
  vatCollected: number;
  grandTotal: number;
  createdAt?: string;
  restaurantId?: string;
  restaurantName?: string;
  location?: string;
  panOrVat?: string;
}

interface InvoiceLineItem {
  name: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
}

interface InvoiceRecord {
  invoiceNo: string;
  billTo: string;
  tableNumber: string;
  paymentMethod: string;
  date: string;
  items: InvoiceLineItem[];
  subtotal: number;
  taxableAmount: number;
  vatAmount: number;
  grandTotal: number;
  restaurantId: string;
  restaurantName: string;
  location: string;
  panOrVat: string;
}

// Map a single Bill document (already grouped, since /api/bills returns one row per bill) into a display invoice
const mapBillToInvoice = (bill: RawBillLine): InvoiceRecord => ({
  invoiceNo: bill.invoiceNo,
  billTo: bill.billTo,
  tableNumber: String(bill.tableNumber ?? ''),
  paymentMethod: bill.paymentMethod,
  date: bill.date || bill.createdAt || new Date().toISOString(),
  items: (bill.items || []).map((item) => ({
    name: item.name,
    quantity: Number(item.quantity) || 0,
    unitPrice: Number(item.unitPrice) || 0,
    totalPrice: Number(item.totalPrice) || 0,
  })),
  subtotal: Number(bill.subtotal) || 0,
  taxableAmount: Number(bill.taxableAmount) || 0,
  vatAmount: Number(bill.vatCollected) || 0,
  grandTotal: Number(bill.grandTotal) || 0,
  restaurantId: bill.restaurantId || '',
  restaurantName: bill.restaurantName || '',
  location: bill.location || '',
  panOrVat: bill.panOrVat || '',
});

// Convert an invoice into the Sale shape the invoice/print popup expects
const invoiceRecordToSale = (invoice: InvoiceRecord, patients: Patient[]): Sale => {
  const matchedPatient = patients.find((p) => p.fullName === invoice.billTo);

  return {
    id: invoice.invoiceNo,
    createdAt: invoice.date,
    patientId: matchedPatient?.id || null,
    pharmacyName: invoice.restaurantName,
    location: invoice.location,
    panOrVat: invoice.panOrVat,
    items: invoice.items.map((item) => ({
      medicineId: '',
      name: item.name,
      dosage: '',
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      totalPrice: item.totalPrice,
    })),
    subTotal: invoice.subtotal,
    discount: Math.max(0, invoice.subtotal - invoice.taxableAmount),
    vatRate: invoice.taxableAmount > 0 ? (invoice.vatAmount / invoice.taxableAmount) * 100 : 0,
    vatAmount: invoice.vatAmount,
    grandTotal: invoice.grandTotal,
    paymentMethod: invoice.paymentMethod as Sale['paymentMethod'],
  } as Sale;
};

// ==========================================
// TYPES — raw shape returned by /api/orders
// ==========================================

interface RawOrder {
  id: string;
  _id: string;
  restaurantId: string;
  customerName: string;
  tableNumber?: string | number;
  orderNote?: string;
  items: unknown[];
  totalAmount: number;
  orderStatus: string;
  paymentStatus: string;
  createdAt: string;
}

export default function Dashboard({
  patients,
  lang,
  setView,
  setSelectedPatient,
  onViewInvoice,
}: DashboardProps) {
  const t = TRANSLATIONS[lang];

  const [time, setTime] = useState<Date>(new Date());

  useEffect(() => {
    const timer = setInterval(() => {
      setTime(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const formatDateTime = (date: Date) => {
    const options: Intl.DateTimeFormatOptions = {
      weekday: 'short',
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: true,
    };
    return date.toLocaleDateString(lang === 'en' ? 'en-US' : 'ne-NP', options);
  };

  // Today's date, computed live (not hardcoded)
  const todayStr = new Date().toISOString().slice(0, 10);

  // ==========================================
  // LOGGED-IN RESTAURANT ID — read once from localStorage
  // ==========================================
  const [restaurantId, setRestaurantId] = useState<string>('');

  useEffect(() => {
    try {
      const raw = localStorage.getItem(RESTAURANT_USER_STORAGE_KEY);
      if (raw) {
        const storedUser = JSON.parse(raw);
        const id =
          storedUser?.id ||
          storedUser?._id ||
          storedUser?.restaurant?.id ||
          storedUser?.restaurant?._id ||
          '';
        setRestaurantId(String(id));
      } else {
        console.warn('No item found in localStorage under key:', RESTAURANT_USER_STORAGE_KEY);
      }
    } catch (err) {
      console.error('Failed to parse restaurant user from localStorage:', err);
    }
  }, []);

  // Helper: safely get a patient's display name (Mongo/legacy field variants)
  const getPatientName = (p: any): string => p?.fullName || p?.name || 'Unknown';

  // ==========================================
  // LIVE BILLING LEDGER (for Recent Restaurant Transactions + Daily/Total Revenue + Daily Sales)
  // ==========================================
  const [invoices, setInvoices] = useState<InvoiceRecord[]>([]);
  const [billsLoading, setBillsLoading] = useState(true);
  const [billsError, setBillsError] = useState('');

  const fetchBills = async (rid: string) => {
    setBillsLoading(true);
    setBillsError('');
    try {
      const res = await fetch(`${BILLS_URL}?restaurantId=${encodeURIComponent(rid)}`);
      const result = await res.json();
      if (!res.ok || !result.success) {
        throw new Error(result.message || 'Failed to load billing ledger.');
      }
      // Only keep bills whose restaurantId matches the logged-in restaurant (localStorage id),
      // as an extra client-side safety net in case the backend filter is ever bypassed.
      const scoped = (result.data || []).filter((bill: RawBillLine) => bill.restaurantId === rid);
      const mapped = scoped
        .map(mapBillToInvoice)
        .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
      setInvoices(mapped);
    } catch (err: any) {
      setBillsError(err.message || 'Could not connect to the server.');
    } finally {
      setBillsLoading(false);
    }
  };

  useEffect(() => {
    if (!restaurantId) return;
    fetchBills(restaurantId);
  }, [restaurantId]);

  // ==========================================
  // LIVE ORDERS (for Total Orders stat)
  // ==========================================
  const [orders, setOrders] = useState<RawOrder[]>([]);
  const [ordersLoading, setOrdersLoading] = useState(true);
  const [ordersError, setOrdersError] = useState('');

  const fetchOrders = async (rid: string) => {
    setOrdersLoading(true);
    setOrdersError('');
    try {
      const res = await fetch(`${ORDERS_URL}?restaurantId=${encodeURIComponent(rid)}`);
      const result = await res.json();
      if (!res.ok || !result.success) {
        throw new Error(result.message || 'Failed to load orders.');
      }
      // Only keep orders whose restaurantId matches the logged-in restaurant (localStorage id),
      // as an extra client-side safety net in case the backend filter is ever bypassed.
      const scoped = (result.data || []).filter((o: RawOrder) => o.restaurantId === rid);
      setOrders(scoped);
    } catch (err: any) {
      setOrdersError(err.message || 'Could not connect to the server.');
    } finally {
      setOrdersLoading(false);
    }
  };

  useEffect(() => {
    if (!restaurantId) return;
    fetchOrders(restaurantId);
  }, [restaurantId]);

  // Filter today's invoices (for Daily Revenue + Daily Sales)
  const todayInvoices = useMemo(
    () => invoices.filter((inv) => inv.date.startsWith(todayStr)),
    [invoices, todayStr]
  );

  // Daily Revenue: sum of grandTotal for today's bills only (same restaurantId as localStorage)
  const dailyRevenue = useMemo(
    () => todayInvoices.reduce((sum, inv) => sum + inv.grandTotal, 0),
    [todayInvoices]
  );

  // Daily Sales: count of today's bills only (same restaurantId as localStorage)
  const dailySalesCount = todayInvoices.length;

  // Total Revenue: sum of grandTotal across ALL bills for this restaurant (not just today)
  const totalRevenue = useMemo(
    () => invoices.reduce((sum, inv) => sum + inv.grandTotal, 0),
    [invoices]
  );

  // Total Orders: count of all orders for this restaurant
  const totalOrdersCount = orders.length;

  // Recent transactions (top 5), live from MongoDB
  const recentInvoicesList = invoices.slice(0, 5);

  // If there's no restaurantId in localStorage, the user isn't logged in — don't render restaurant data
  if (!restaurantId) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center space-y-2" id="dashboard-no-restaurant">
        <UtensilsCrossed className="h-8 w-8 text-amber-500" />
        <p className="text-sm font-medium text-gray-700">
          {lang === 'en'
            ? 'No restaurant session found. Please log in again.'
            : 'रेस्टुरेन्ट सत्र फेला परेन। कृपया फेरि लगइन गर्नुहोस्।'}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6" id="dashboard-container">
      {/* Title block */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center border-b border-gray-100 pb-5" id="dashboard-header">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 tracking-tight flex items-center gap-2">
            <Activity className="h-6 w-6 text-teal-600" id="activity-icon" />
            {t.statsOverview}
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            {t.location} • {lang === 'en' ? 'Live System Feed' : 'लाइभ फिड'}
          </p>
        </div>
        <div className="mt-3 sm:mt-0 px-4 py-2 bg-teal-50/60 rounded-full text-xs font-semibold text-teal-900 flex items-center gap-2 border border-teal-100/80 transition-all hover:bg-teal-50 shadow-xs" id="dashboard-date">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-teal-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-teal-500"></span>
          </span>
          <Calendar className="h-3.5 w-3.5 text-teal-600 shrink-0" />
          <span className="font-mono text-xs">{formatDateTime(time)}</span>
        </div>
      </div>

      {/* Grid Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4" id="stats-grid">
        {/* Daily Revenue */}
        <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-xs flex items-center justify-between" id="stat-daily-revenue">
          <div className="space-y-1">
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">
              {lang === 'en' ? 'Daily Revenue' : 'दैनिक आम्दानी'}
            </p>
            <h3 className="text-2xl font-bold text-gray-900">
              {billsLoading ? '...' : `NPR ${dailyRevenue.toLocaleString('en-NP', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
            </h3>
          </div>
          <div className="p-3 bg-teal-50 rounded-lg text-teal-600">
            <TrendingUp className="h-6 w-6" />
          </div>
        </div>

        {/* Daily Sales (bill count) */}
        <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-xs flex items-center justify-between" id="stat-daily-sales">
          <div className="space-y-1">
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">
              {lang === 'en' ? 'Daily Sales' : 'दैनिक बिक्री'}
            </p>
            <h3 className="text-2xl font-bold text-gray-900">{billsLoading ? '...' : dailySalesCount}</h3>
            <p className="text-xs text-gray-400">{lang === 'en' ? 'Bills today' : 'आजका बिलहरू'}</p>
          </div>
          <div className="p-3 bg-blue-50 rounded-lg text-blue-600">
            <ShoppingBag className="h-6 w-6" />
          </div>
        </div>

        {/* Total Revenue */}
        <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-xs flex items-center justify-between" id="stat-total-revenue">
          <div className="space-y-1">
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">
              {lang === 'en' ? 'Total Revenue' : 'कुल आम्दानी'}
            </p>
            <h3 className="text-2xl font-bold text-gray-900">
              {billsLoading ? '...' : `NPR ${totalRevenue.toLocaleString('en-NP', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
            </h3>
            <p className="text-xs text-gray-400">{lang === 'en' ? 'All-time total' : 'सबै समयको जम्मा'}</p>
          </div>
          <div className="p-3 bg-indigo-50 rounded-lg text-indigo-600">
            <Receipt className="h-6 w-6" />
          </div>
        </div>

        {/* Total Orders */}
        <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-xs flex items-center justify-between" id="stat-total-orders">
          <div className="space-y-1">
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">
              {lang === 'en' ? 'Total Orders' : 'कुल अर्डर'}
            </p>
            <h3 className="text-2xl font-bold text-gray-900">{ordersLoading ? '...' : totalOrdersCount}</h3>
            <p className="text-xs text-gray-400">{lang === 'en' ? 'All-time orders' : 'सबै समयका अर्डरहरू'}</p>
          </div>
          <div className="p-3 bg-orange-50 rounded-lg text-orange-600">
            <ListOrdered className="h-6 w-6" />
          </div>
        </div>
      </div>

      {/* Two column breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6" id="dashboard-detail-grid">
        {/* Left Column: Recent Transactions */}
        <div className="lg:col-span-8 bg-white rounded-xl border border-gray-200 shadow-xs p-5 space-y-4" id="recent-sales-card">
          <div className="flex justify-between items-center">
            <h2 className="text-lg font-bold text-gray-900 tracking-tight">
              {lang === 'en' ? 'Recent Restaurant Transactions' : 'हालैका रेस्टुरेन्ट कारोबार'}
            </h2>
            
          </div>

          <div className="overflow-x-auto" id="recent-sales-table-wrapper">
            <table className="min-w-full divide-y divide-gray-100 text-sm">
              <thead>
                <tr className="text-left text-xs font-medium text-gray-400 uppercase tracking-wider bg-gray-50">
                  <th className="px-4 py-3 rounded-l-lg">{lang === 'en' ? 'Bill' : 'बिल'}</th>
                  <th className="px-4 py-3">{lang === 'en' ? 'Customer/Table' : 'ग्राहक/टेबल'}</th>
                  <th className="px-4 py-3">{lang === 'en' ? 'Payment' : 'भुक्तानी'}</th>
                  <th className="px-4 py-3 text-right">{lang === 'en' ? 'Amount' : 'रकम'}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100" id="recent-sales-table-body">
                {billsLoading ? (
                  <tr>
                    <td colSpan={5} className="px-4 py-8 text-center text-gray-400">
                      <Loader2 className="h-5 w-5 mx-auto animate-spin mb-1" />
                      {lang === 'en' ? 'Loading transactions...' : 'लोड हुँदैछ...'}
                    </td>
                  </tr>
                ) : billsError ? (
                  <tr>
                    <td colSpan={5} className="px-4 py-8 text-center text-red-500">
                      <PackageX className="h-5 w-5 mx-auto mb-1" />
                      {billsError}
                      <button onClick={() => fetchBills(restaurantId)} className="block mx-auto mt-1 text-teal-600 font-bold text-xs underline">
                        {lang === 'en' ? 'Retry' : 'फेरि प्रयास गर्नुहोस्'}
                      </button>
                    </td>
                  </tr>
                ) : recentInvoicesList.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-4 py-8 text-center text-gray-400">
                      {t.noSalesToday}
                    </td>
                  </tr>
                ) : (
                  recentInvoicesList.map((invoice) => {
                    const patient = patients.find((p) => getPatientName(p) === invoice.billTo);
                    return (
                      <tr key={invoice.invoiceNo} className="hover:bg-gray-50 transition-colors">
                        <td className="px-4 py-3.5 font-mono text-xs text-gray-500">{invoice.invoiceNo}</td>
                        <td className="px-4 py-3.5">
                          <div className="space-y-0.5">
                            <span className="font-medium text-gray-900">
                              {patient ? getPatientName(patient) : invoice.billTo || t.walkIn}
                            </span>
                            {invoice.tableNumber && (
                              <div className="flex gap-1.5 items-center">
                                <span className="text-[10px] font-mono text-gray-400 bg-gray-100 px-1 py-0.5 rounded">
                                  {lang === 'en' ? 'Table' : 'टेबल'} {invoice.tableNumber}
                                </span>
                              </div>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-3.5">
                          <span className={`inline-flex px-2 py-0.5 text-xs font-medium rounded-full ${
                            invoice.paymentMethod === 'Cash' ? 'bg-emerald-50 text-emerald-700 border border-emerald-100' :
                            invoice.paymentMethod === 'eSewa' ? 'bg-[#60bb46]/10 text-[#60bb46] font-bold border border-[#60bb46]/20' :
                            invoice.paymentMethod === 'Khalti' ? 'bg-[#5c2d91]/10 text-[#5c2d91] font-bold border border-[#5c2d91]/20' :
                            'bg-indigo-50 text-indigo-700 border border-indigo-100'
                          }`}>
                            {invoice.paymentMethod}
                          </span>
                        </td>
                        <td className="px-4 py-3.5 text-right font-medium text-gray-900 font-mono">
                          NPR {invoice.grandTotal.toFixed(2)}
                        </td>
                       
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Right Column: Quick Operations */}
        {/* Right Column: Quick Operations */}
<div className="lg:col-span-4 space-y-6" id="dashboard-sidebar">
  <div className="bg-white rounded-xl border border-gray-200 shadow-xs p-5 space-y-3" id="quick-links-card">
    <h2 className="text-sm font-bold text-gray-900 uppercase tracking-wider">
      {lang === 'en' ? 'Quick Operations' : 'द्रुत कार्यहरू'}
    </h2>
    <div className="grid grid-cols-1 gap-2">
      <button
        onClick={() => setView('inventory')}
        className="w-full py-2.5 px-3 bg-teal-600 hover:bg-teal-700 text-white font-medium rounded-lg text-sm flex items-center justify-between transition-colors shadow-xs"
      >
        <span>{lang === 'en' ? 'Menu' : 'मेनु'}</span>
        <UtensilsCrossed className="h-4 w-4" />
      </button>
      <button
        onClick={() => setView('createbill')}
        className="w-full py-2.5 px-3 bg-white hover:bg-gray-50 text-teal-700 font-medium rounded-lg text-sm flex items-center justify-between transition-colors border border-gray-200"
      >
        <span>{lang === 'en' ? 'Create Bill' : 'बिल बनाउनुहोस्'}</span>
        <Receipt className="h-4 w-4 text-teal-600" />
      </button>
      <button
        onClick={() => setView('tables')}
        className="w-full py-2.5 px-3 bg-white hover:bg-gray-50 text-gray-700 font-medium rounded-lg text-sm flex items-center justify-between transition-colors border border-gray-200"
      >
        <span>{lang === 'en' ? 'Table' : 'टेबल'}</span>
        <LayoutGrid className="h-4 w-4 text-indigo-500" />
      </button>
      <button
        onClick={() => setView('orders')}
        className="w-full py-2.5 px-3 bg-white hover:bg-gray-50 text-gray-700 font-medium rounded-lg text-sm flex items-center justify-between transition-colors border border-gray-200"
      >
        <span>{lang === 'en' ? 'Order' : 'अर्डर'}</span>
        <ClipboardList className="h-4 w-4 text-orange-500" />
      </button>
    </div>
  </div>
</div>
      </div>
    </div>
  );
}