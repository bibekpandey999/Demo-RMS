import React, { useState, useEffect, useMemo } from 'react';
import {
  FileText,
  Search,
  Activity,
  Loader2,
  PackageX,
  Database,
  Receipt,
  X,
  Printer,
} from 'lucide-react';
import { Sale, Patient } from '../types';
import { TRANSLATIONS } from '../translations';

const API_BASE = import.meta.env.VITE_API_URL || 'https://rms-0wk0.onrender.com';
const BILLS_URL = `${API_BASE}/api/bills`;

const getLoggedInPharmacyId = (): string => {
  try {
    const raw = localStorage.getItem('user'); 
    if (!raw) return '';
    const parsed = JSON.parse(raw);
    return (parsed?.id || parsed?._id) ? String(parsed.id || parsed._id) : '';
  } catch {
    return '';
  }
};

interface BillingManagerProps {
  sales: Sale[];
  patients: Patient[];
  lang: 'en' | 'ne';
  currentUserRole: 'Receptionist' | 'Pharmacist' | 'Owner';
  onBillingUpdated: () => void;
  onViewInvoice: (sale: Sale) => void;
}

interface RawBillItem {
  itemName: string;
  quantity: number;
  rate: number;
  total: number;
}

interface RawBill {
  id: string;
  _id: string;
  restaurantName: string;
  location: string;
  panOrVat: string;
  invoiceNo: string;
  billTo: string;
  tableNumber: string;
  paymentMethod: string;
  date: string;
  items: RawBillItem[];
  subtotal: number;
  discount: number;
  discountPercent?: number;
  taxableAmount: number;
  vatCollected: number;
  vatRate?: number;
  grandTotal: number;
  restaurantId: string;
  createdAt?: string;
}

const rawBillToSale = (bill: RawBill, patients: Patient[]): Sale => {
  const matchedPatient = patients.find((p) => p.fullName === bill.billTo);
  const vatRate = bill.taxableAmount > 0 ? (bill.vatCollected / bill.taxableAmount) * 100 : 0;

  return {
    id: bill.invoiceNo,
    createdAt: bill.date || bill.createdAt,
    patientId: matchedPatient?.id || null,
    pharmacyName: bill.restaurantName,
    location: bill.location,
    panOrVat: bill.panOrVat,
    items: (bill.items || []).map((item) => ({
      medicineId: '',
      name: item.itemName,
      dosage: '',
      quantity: item.quantity,
      unitPrice: item.rate,
      totalPrice: item.total,
    })),
    subTotal: bill.subtotal,
    discount: bill.discount,
    vatRate,
    vatAmount: bill.vatCollected,
    grandTotal: bill.grandTotal,
    paymentMethod: bill.paymentMethod as Sale['paymentMethod'],
  } as Sale;
};

function money(n: number): string {
  return (Number.isFinite(n) ? n : 0).toFixed(2);
}

// ==========================================
// PRINTABLE INVOICE MODAL — same style as CreateBill's BillModal
// Print sizing/visibility for #printable-bill now lives entirely in
// index.css's global @media print block — no local <style> here anymore,
// to avoid two competing print stylesheets fighting over the same ID.
// ==========================================

function InvoiceModal({
  bill,
  lang,
  onClose,
}: {
  bill: RawBill;
  lang: 'en' | 'ne';
  onClose: () => void;
}) {
  const billItems: RawBillItem[] = bill?.items ?? [];
  const vatRate = bill?.vatRate ?? (bill?.taxableAmount > 0 ? (bill.vatCollected / bill.taxableAmount) * 100 : 0);
  const hasVat = (bill?.vatCollected ?? 0) > 0;
  const discountPercent = bill?.discountPercent ?? 0;
  const hasDiscount = (bill?.discount ?? 0) > 0;

  return (
    <div className="fixed inset-0 bg-gray-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-[60] animate-fade-in">
      <div className="bg-white rounded-2xl max-w-lg w-full p-6 space-y-6 shadow-2xl border border-gray-100">
        <div className="flex justify-between items-center border-b border-gray-100 pb-3">
          <span className="font-bold text-gray-900 flex items-center gap-1.5 text-sm">
            <Receipt className="h-5 w-5 text-teal-600" />
            {lang === 'en' ? 'Invoice' : 'बिजक'}
          </span>
          <button onClick={onClose} className="p-1 text-gray-400 hover:text-gray-950 cursor-pointer">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div
          id="printable-bill"
          className="p-5 border border-gray-300 rounded-xl bg-[#fafafa] font-sans text-xs text-gray-800 space-y-4 shadow-inner max-h-[420px] overflow-y-auto"
        >
          <div className="text-center space-y-1 pb-3 border-b border-gray-300 border-dashed">
            <h3 className="text-base font-bold text-gray-950 uppercase tracking-tight">
              {bill.restaurantName}
            </h3>
            <p className="text-[10px] text-gray-500">{bill.location}</p>
            <p className="font-semibold text-[10px]">PAN / VAT No: {bill.panOrVat}</p>
            <h4 className="text-xs font-extrabold text-gray-950 uppercase border-y border-gray-200 py-1 tracking-wider mt-2">
              {lang === 'en' ? 'Invoice' : 'बिजक'}
            </h4>
          </div>

          <div className="grid grid-cols-2 gap-y-1 border-b border-gray-200 pb-2 leading-relaxed">
            <div>
              Invoice No: <span className="font-mono font-bold text-gray-950">{bill.invoiceNo}</span>
            </div>
            <div className="text-right">
              Date: <span className="font-mono">{new Date(bill.date || bill.createdAt || '').toLocaleString()}</span>
            </div>
            <div className="col-span-2">
              Bill To: <span className="font-bold text-gray-900">{bill.billTo}</span>
              {bill.tableNumber && (
                <span className="text-[10px] text-gray-500 font-mono ml-1">(Table {bill.tableNumber})</span>
              )}
            </div>
            <div className="col-span-2">
              Payment Method: <span className="font-semibold text-gray-950">{bill.paymentMethod}</span>
            </div>
          </div>

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
              {billItems.map((item, idx) => (
                <tr key={idx}>
                  <td className="py-1 font-bold text-gray-950">{item.itemName}</td>
                  <td className="py-1 text-center font-mono">{item.quantity}</td>
                  <td className="py-1 text-right font-mono">NPR {money(item.rate)}</td>
                  <td className="py-1 text-right font-mono">NPR {money(item.total)}</td>
                </tr>
              ))}
            </tbody>
          </table>

          <div className="space-y-1 text-[11px] text-gray-700 max-w-[220px] ml-auto">
            <div className="flex justify-between">
              <span>Subtotal:</span>
              <span className="font-mono">NPR {money(bill.subtotal)}</span>
            </div>
            {hasDiscount && (
              <div className="flex justify-between text-red-600">
                <span>Discount ({discountPercent}%):</span>
                <span className="font-mono">-NPR {money(bill.discount)}</span>
              </div>
            )}
            <div className="flex justify-between font-medium">
              <span>Taxable Amount:</span>
              <span className="font-mono">NPR {money(bill.taxableAmount)}</span>
            </div>
            {hasVat && (
              <div className="flex justify-between">
                <span>VAT ({vatRate.toFixed(1)}%):</span>
                <span className="font-mono">NPR {money(bill.vatCollected)}</span>
              </div>
            )}
            <div className="flex justify-between border-t border-gray-400 pt-1 text-xs text-gray-950 font-bold">
              <span>GRAND TOTAL:</span>
              <span className="font-mono text-teal-700">NPR {money(bill.grandTotal)}</span>
            </div>
          </div>

          <div className="pt-8 flex justify-between items-end border-t border-dashed border-gray-300">
            <div className="text-center font-bold text-[9px] text-gray-400 border-t border-gray-300 pt-1 w-24">
              Customer Sign
            </div>
            <div className="text-center italic text-[10px] text-gray-500">Thank you, visit again!</div>
            <div className="text-center font-bold text-[9px] text-gray-400 border-t border-gray-300 pt-1 w-24">
              Authorized Sign
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-3 pt-4 border-t border-gray-100">
          <button
            type="button"
            onClick={onClose}
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
  );
}

// ==========================================
// MAIN BILLING MANAGER
// ==========================================

export default function BillingManager({
  patients,
  lang,
  onViewInvoice,
}: BillingManagerProps) {
  const t = TRANSLATIONS[lang];
  const [pharmacyId, setPharmacyId] = useState<string>(getLoggedInPharmacyId());
  const [bills, setBills] = useState<RawBill[]>([]);
  const [billsLoading, setBillsLoading] = useState(true);
  const [billsError, setBillsError] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [viewingBill, setViewingBill] = useState<RawBill | null>(null);

  const fetchBills = async () => {
    setBillsLoading(true);
    setBillsError('');

    const currentPharmacyId = getLoggedInPharmacyId();
    setPharmacyId(currentPharmacyId);

    if (!currentPharmacyId) {
      setBillsError(
        lang === 'en'
          ? 'No pharmacy ID found. Please log in again.'
          : 'फार्मेसी आईडी फेला परेन। कृपया फेरि लगइन गर्नुहोस्।'
      );
      setBills([]);
      setBillsLoading(false);
      return;
    }

    try {
      const url = `${BILLS_URL}?restaurantId=${encodeURIComponent(currentPharmacyId)}`;
      const res = await fetch(url);
      const result = await res.json();
      if (!res.ok || !result.success) {
        throw new Error(result.message || 'Failed to load billing ledger.');
      }

      setBills(result.data || []);
    } catch (err: any) {
      setBillsError(err.message || 'Could not connect to the server.');
    } finally {
      setBillsLoading(false);
    }
  };

  useEffect(() => {
    fetchBills();
  }, []);

  const filteredInvoices = useMemo(() => {
    if (!searchQuery.trim()) return bills;
    const q = searchQuery.toLowerCase().trim();
    return bills.filter((inv) => {
      const patient = patients.find((p) => p.fullName === inv.billTo);
      return (
        inv.invoiceNo.toLowerCase().includes(q) ||
        (inv.billTo || '').toLowerCase().includes(q) ||
        (patient && patient.id.toLowerCase().includes(q))
      );
    });
  }, [searchQuery, bills, patients]);

  const todayStr = new Date().toISOString().slice(0, 10);
  const todaysInvoices = bills.filter((inv) => (inv.date || inv.createdAt || '').startsWith(todayStr));

  const cashToday = todaysInvoices.filter((s) => s.paymentMethod === 'Cash').reduce((sum, s) => sum + s.grandTotal, 0);
  const esewaToday = todaysInvoices.filter((s) => s.paymentMethod === 'eSewa').reduce((sum, s) => sum + s.grandTotal, 0);
  const khaltiToday = todaysInvoices.filter((s) => s.paymentMethod === 'Khalti').reduce((sum, s) => sum + s.grandTotal, 0);
  const imeToday = todaysInvoices.filter((s) => s.paymentMethod === 'IMEPay').reduce((sum, s) => sum + s.grandTotal, 0);

  const totalTaxableToday = todaysInvoices.reduce((sum, s) => sum + (s.taxableAmount || 0), 0);
  const totalVatToday = todaysInvoices.reduce((sum, s) => sum + (s.vatCollected || 0), 0);

  return (
    <div className="grid grid-cols-1 gap-6" id="billing-root">
      <div className="space-y-6" id="billing-ledger-card">
        <div className="bg-white rounded-xl border border-gray-200 shadow-xs p-5 space-y-4" id="daily-summary-ledger">
          <h2 className="text-base font-bold text-gray-900 tracking-tight flex items-center gap-1.5 uppercase">
            <Activity className="h-5 w-5 text-teal-600" />
            {t.dailySummary}
          </h2>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4" id="daily-summary-grid">
            <div className="p-4 bg-gray-50 border border-gray-150 rounded-xl space-y-1">
              <span className="text-[10px] uppercase font-bold text-gray-400 block tracking-wider">💵 CASH RECONC.</span>
              <p className="font-mono font-bold text-gray-900 text-sm">NPR {cashToday.toFixed(2)}</p>
            </div>
            <div className="p-4 bg-gray-50 border border-gray-150 rounded-xl space-y-1">
              <span className="text-[10px] uppercase font-bold text-[#60bb46] block tracking-wider">🟢 eSewa Total</span>
              <p className="font-mono font-bold text-gray-900 text-sm">NPR {esewaToday.toFixed(2)}</p>
            </div>
            <div className="p-4 bg-gray-50 border border-gray-150 rounded-xl space-y-1">
              <span className="text-[10px] uppercase font-bold text-[#5c2d91] block tracking-wider">🟣 Khalti Total</span>
              <p className="font-mono font-bold text-gray-900 text-sm">NPR {khaltiToday.toFixed(2)}</p>
            </div>
            <div className="p-4 bg-gray-50 border border-gray-150 rounded-xl space-y-1">
              <span className="text-[10px] uppercase font-bold text-red-500 block tracking-wider">🔴 IME Pay Total</span>
              <p className="font-mono font-bold text-gray-900 text-sm">NPR {imeToday.toFixed(2)}</p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 border-t border-gray-100 pt-3 text-xs text-gray-600" id="daily-vat-summary">
            <div className="flex justify-between items-center p-3.5 bg-teal-50/20 border border-teal-100 rounded-xl">
              <span className="font-bold text-teal-800 uppercase tracking-wider text-[10px]">{lang === 'en' ? 'Taxable Revenue' : 'कर योग्य कुल संकलन'}</span>
              <span className="font-mono font-bold text-gray-900">NPR {totalTaxableToday.toFixed(2)}</span>
            </div>
            <div className="flex justify-between items-center p-3.5 bg-indigo-50/20 border border-indigo-100 rounded-xl">
              <span className="font-bold text-indigo-800 uppercase tracking-wider text-[10px]">{t.vatCollected} (VAT)</span>
              <span className="font-mono font-bold text-teal-700">NPR {totalVatToday.toFixed(2)}</span>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 shadow-xs p-5 space-y-4" id="invoices-ledger-panel">
          <div className="flex flex-col sm:flex-row justify-between sm:items-center pb-2 border-b border-gray-100 gap-3">
            <h2 className="text-base font-bold text-gray-900 tracking-tight flex items-center gap-2">
              <FileText className="h-5 w-5 text-teal-600" />
              {t.invoiceList}
            </h2>
            {billsLoading ? null : (
              <button onClick={fetchBills} className="text-[11px] font-bold text-teal-600 hover:text-teal-700 uppercase tracking-wider">
                {lang === 'en' ? 'Refresh' : 'ताजा गर्नुहोस्'}
              </button>
            )}
          </div>

          <div className="relative text-xs" id="invoice-search-group">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-gray-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={lang === 'en' ? 'Search by Invoice No, Patient ID, or Patient Name...' : 'बिल नम्बर वा बिरामीको नाम हाल्नुहोस्...'}
              className="w-full pl-8 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-lg focus:outline-hidden"
            />
          </div>

          <div className="overflow-x-auto border border-gray-100 rounded-lg" id="invoice-ledger-table-wrapper">
            <table className="min-w-full divide-y divide-gray-100 text-xs">
              <thead>
                <tr className="text-left text-gray-400 uppercase tracking-wider bg-gray-50">
                  <th className="px-4 py-3">Invoice ID</th>
                  <th className="px-4 py-3">{lang === 'en' ? 'Patient Client' : 'बिरामी'}</th>
                  <th className="px-4 py-3">{lang === 'en' ? 'Method' : 'भुक्तानी'}</th>
                  <th className="px-4 py-3 text-right">{t.taxableAmount}</th>
                  <th className="px-4 py-3 text-right">VAT</th>
                  <th className="px-4 py-3 text-right">Total Invoice</th>
                  <th className="px-4 py-3 text-center">{t.actions}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100" id="invoice-ledger-table-body">
                {billsLoading ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-12 text-center text-gray-400">
                      <Loader2 className="h-6 w-6 mx-auto animate-spin mb-2" />
                      {lang === 'en' ? 'Loading billing ledger...' : 'लोड हुँदैछ...'}
                    </td>
                  </tr>
                ) : billsError ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-12 text-center text-red-500">
                      <PackageX className="h-6 w-6 mx-auto mb-2" />
                      <p>{billsError}</p>
                      <button onClick={fetchBills} className="text-teal-600 font-bold text-xs underline mt-1">
                        {lang === 'en' ? 'Retry' : 'फेरि प्रयास गर्नुहोस्'}
                      </button>
                    </td>
                  </tr>
                ) : filteredInvoices.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-12 text-center text-gray-400 italic">
                      <Database className="h-6 w-6 mx-auto mb-2 stroke-1" />
                      No invoices match criteria.
                    </td>
                  </tr>
                ) : (
                  filteredInvoices.map((invoice) => {
                    const pat = patients.find((p) => p.fullName === invoice.billTo);

                    return (
                      <tr key={invoice.invoiceNo} className="hover:bg-gray-50/50 transition-colors">
                        <td className="px-4 py-3.5 font-mono text-gray-500 font-bold">{invoice.invoiceNo}</td>
                        <td className="px-4 py-3.5">
                          {pat ? (
                            <div className="space-y-0.5">
                              <span className="font-bold text-gray-900">{pat.fullName}</span>
                              <span className="text-[10px] text-gray-400 block font-mono">({pat.id})</span>
                            </div>
                          ) : (
                            <span className="text-gray-400 italic">{invoice.billTo || t.walkIn}</span>
                          )}
                        </td>
                        <td className="px-4 py-3.5">
                          <span className={`inline-flex px-1.5 py-0.2 rounded font-bold text-[10px] uppercase border ${
                            invoice.paymentMethod === 'Cash' ? 'bg-emerald-50 text-emerald-800 border-emerald-200' :
                            invoice.paymentMethod === 'eSewa' ? 'bg-[#60bb46]/10 text-[#4c9b36] border-[#60bb46]/30' :
                            'bg-indigo-50 text-indigo-700 border-indigo-200'
                          }`}>
                            {invoice.paymentMethod}
                          </span>
                        </td>
                        <td className="px-4 py-3.5 text-right font-mono">
                          NPR {(invoice.taxableAmount || 0).toFixed(2)}
                        </td>
                        <td className="px-4 py-3.5 text-right font-mono">
                          NPR {(invoice.vatCollected || 0).toFixed(2)}
                        </td>
                        <td className="px-4 py-3.5 text-right font-mono font-bold text-teal-700 font-semibold">
                          NPR {invoice.grandTotal.toFixed(2)}
                        </td>
                        <td className="px-4 py-3.5 text-center">
                          <button
                            onClick={() => setViewingBill(invoice)}
                            className="p-1 hover:bg-gray-100 rounded text-gray-500 hover:text-teal-600"
                            title="View/Print Thermal Invoice"
                          >
                            <FileText className="h-4 w-4" />
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {viewingBill && (
        <InvoiceModal
          bill={viewingBill}
          lang={lang}
          onClose={() => setViewingBill(null)}
        />
      )}
    </div>
  );
}