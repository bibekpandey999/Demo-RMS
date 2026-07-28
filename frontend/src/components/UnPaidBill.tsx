import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Receipt, Users, Hash, CheckCircle2, X, Printer, Loader2,
  AlertTriangle, RefreshCw, ClipboardList, ShoppingBag, Clock,
  Banknote, Smartphone, Wallet, CreditCard,
} from 'lucide-react';

// ==========================================
// CONFIG
// ==========================================

const API_BASE = import.meta.env.VITE_API_URL || 'https://rms-0wk0.onrender.com';
const BILLS_URL = `${API_BASE}/api/bills`;

const getLoggedInUser = () => {
  try {
    const raw = localStorage.getItem('pharmacyUser');
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
};

interface BillItem {
  itemName: string;
  quantity: number;
  rate: number;
  total: number;
}

interface Bill {
  _id: string;
  id?: string;
  restaurantName: string;
  location?: string;
  panOrVat?: string;
  invoiceNo: string;
  billTo: string;
  tableNumber?: string;
  paymentMethod: string;
  date: string;
  items: BillItem[];
  subtotal: number;
  discount?: number;
  discountPercent?: number;
  taxableAmount?: number;
  vatCollected?: number;
  vatRate?: number;
  grandTotal: number;
  restaurantId: string;
  createdAt?: string;
}

type PaymentMethod = 'Cash' | 'eSewa' | 'Khalti' | 'IMEPay';

const PAYMENT_METHODS: { id: PaymentMethod; label: string; icon: React.ElementType; accent: string }[] = [
  { id: 'Cash', label: 'Cash', icon: Banknote, accent: 'emerald' },
  { id: 'eSewa', label: 'eSewa', icon: Smartphone, accent: 'green' },
  { id: 'Khalti', label: 'Khalti', icon: Wallet, accent: 'purple' },
  { id: 'IMEPay', label: 'IMEPay', icon: CreditCard, accent: 'sky' },
];

const ACCENT_CLASSES: Record<string, { border: string; bg: string; text: string; ring: string }> = {
  emerald: { border: 'border-emerald-500', bg: 'bg-emerald-50', text: 'text-emerald-700', ring: 'ring-emerald-500/20' },
  green: { border: 'border-green-500', bg: 'bg-green-50', text: 'text-green-700', ring: 'ring-green-500/20' },
  purple: { border: 'border-purple-500', bg: 'bg-purple-50', text: 'text-purple-700', ring: 'ring-purple-500/20' },
  sky: { border: 'border-sky-500', bg: 'bg-sky-50', text: 'text-sky-700', ring: 'ring-sky-500/20' },
};

function money(n: number): string {
  return (Number.isFinite(n) ? n : 0).toFixed(2);
}

function normalizeName(name: string): string {
  return (name || '').trim().toLowerCase();
}

// ==========================================
// GROUPED PENDING "CUSTOMER" — merges every
// pending bill that shares the same billTo
// ==========================================

interface GroupedPending {
  key: string;
  billTo: string;
  billIds: string[];
  bills: Bill[];
  tableNumbers: string[];
  mergedItems: BillItem[];
  subtotal: number;
  discount: number;
  taxableAmount: number;
  vatCollected: number;
  grandTotal: number;
  earliestDate: string;
  restaurantId: string;
  restaurantName: string;
  location?: string;
  panOrVat?: string;
}

function groupPendingBills(bills: Bill[]): GroupedPending[] {
  const groups = new Map<string, Bill[]>();

  for (const bill of bills) {
    const key = normalizeName(bill.billTo);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(bill);
  }

  const result: GroupedPending[] = [];

  groups.forEach((groupBills, key) => {
    // Merge line items across all bills for this person.
    // Same item name + same rate => combine quantity & total.
    // Different rate for the same item name => kept as a separate line
    // (prevents silently averaging/mismatching prices).
    const itemMap = new Map<string, BillItem>();

    for (const bill of groupBills) {
      for (const item of bill.items || []) {
        const itemKey = `${item.itemName}__${item.rate}`;
        if (itemMap.has(itemKey)) {
          const existing = itemMap.get(itemKey)!;
          existing.quantity += item.quantity;
          existing.total += item.total;
        } else {
          itemMap.set(itemKey, { ...item });
        }
      }
    }

    const mergedItems = Array.from(itemMap.values());

    const sortedByDate = [...groupBills].sort(
      (a, b) => new Date(a.date || a.createdAt || 0).getTime() - new Date(b.date || b.createdAt || 0).getTime()
    );

    const subtotal = groupBills.reduce((s, b) => s + (b.subtotal || 0), 0);
    const discount = groupBills.reduce((s, b) => s + (b.discount || 0), 0);
    const taxableAmount = groupBills.reduce((s, b) => s + (b.taxableAmount ?? b.subtotal ?? 0), 0);
    const vatCollected = groupBills.reduce((s, b) => s + (b.vatCollected || 0), 0);
    const grandTotal = groupBills.reduce((s, b) => s + (b.grandTotal || 0), 0);

    const tableNumbers = Array.from(
      new Set(groupBills.map((b) => b.tableNumber).filter(Boolean) as string[])
    );

    result.push({
      key,
      billTo: groupBills[0].billTo,
      billIds: groupBills.map((b) => b._id),
      bills: groupBills,
      tableNumbers,
      mergedItems,
      subtotal,
      discount,
      taxableAmount,
      vatCollected,
      grandTotal,
      earliestDate: sortedByDate[0]?.date || sortedByDate[0]?.createdAt || new Date().toISOString(),
      restaurantId: groupBills[0].restaurantId,
      restaurantName: groupBills[0].restaurantName,
      location: groupBills[0].location,
      panOrVat: groupBills[0].panOrVat,
    });
  });

  // Most recently active customer first
  result.sort((a, b) => new Date(b.earliestDate).getTime() - new Date(a.earliestDate).getTime());

  return result;
}

// ==========================================
// PENDING CUSTOMER CARD (left list)
// ==========================================

function PendingGroupCard({
  group,
  isSelected,
  onSelect,
}: {
  group: GroupedPending;
  isSelected: boolean;
  onSelect: (group: GroupedPending) => void;
}) {
  const itemCount = group.mergedItems.reduce((sum, i) => sum + (i.quantity || 0), 0);

  return (
    <button
      onClick={() => onSelect(group)}
      className={`w-full text-left rounded-2xl border p-4 transition-all cursor-pointer ${
        isSelected
          ? 'bg-amber-50 border-amber-400 ring-2 ring-amber-500/20 shadow-sm'
          : 'bg-white border-gray-200 hover:border-amber-300 hover:shadow-sm'
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-gray-400">
            <Users className="h-3 w-3" />
            Customer
          </div>
          <p className="font-semibold text-sm text-gray-900 leading-tight mt-0.5 truncate">
            {group.billTo}
          </p>
        </div>
        <span className="shrink-0 text-[10px] font-bold px-2 py-1 rounded-full uppercase tracking-wide bg-amber-50 text-amber-700 border border-amber-200">
          Pending
        </span>
      </div>

      <div className="mt-2.5 flex items-center justify-between border-t border-gray-100 pt-2.5">
        <span className="font-mono text-[11px] font-bold text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full">
          {group.billIds.length} bill{group.billIds.length !== 1 ? 's' : ''}
        </span>
        <span className="font-mono text-[11px] font-bold text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full">
          {itemCount} item{itemCount !== 1 ? 's' : ''}
        </span>
      </div>

      {group.tableNumbers.length > 0 && (
        <p className="mt-1.5 text-[11px] text-gray-400 truncate">
          Tables: <span className="font-mono">{group.tableNumbers.join(', ')}</span>
        </p>
      )}

      <p className="mt-1 text-right font-mono text-sm font-bold text-amber-700">
        NPR {money(group.grandTotal)}
      </p>
    </button>
  );
}

// ==========================================
// PRINTABLE MERGED BILL MODAL (80mm thermal)
// ==========================================

function MergedBillModal({
  group,
  lang,
  onClose,
}: {
  group: GroupedPending;
  lang: 'en' | 'ne';
  onClose: () => void;
}) {
  const invoiceLabel = `PEND-${group.billIds
    .map((id) => id.slice(-4))
    .join('-')}`;

  return (
    <div className="fixed inset-0 bg-gray-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-[60] animate-fade-in">
      <style>{`
        @media print {
          @page {
            size: 80mm auto;
            margin: 2mm;
          }
          html, body {
            width: 80mm;
          }
          body * {
            visibility: hidden;
          }
          #printable-merged-bill, #printable-merged-bill * {
            visibility: visible;
          }
          #printable-merged-bill {
            position: absolute;
            left: 0;
            top: 0;
            width: 76mm;
            max-width: 76mm;
            max-height: none !important;
            overflow: visible !important;
            border: none !important;
            box-shadow: none !important;
            background: #fff !important;
            padding: 0 !important;
            margin: 0 !important;
            font-size: 9px;
            line-height: 1.35;
          }
          #printable-merged-bill h3 {
            font-size: 12px;
          }
          #printable-merged-bill h4 {
            font-size: 10px;
          }
          #printable-merged-bill table {
            font-size: 8.5px;
          }
          #printable-merged-bill .pt-8 {
            padding-top: 12px;
          }
        }
      `}</style>

      <div className="bg-white rounded-2xl max-w-lg w-full p-6 space-y-6 shadow-2xl border border-gray-100">
        <div className="flex justify-between items-center border-b border-gray-100 pb-3">
          <span className="font-bold text-gray-900 flex items-center gap-1.5 text-sm">
            <Receipt className="h-5 w-5 text-amber-600" />
            {lang === 'en' ? 'Combined Pending Bill' : 'संयुक्त बाँकी बिल'}
          </span>
          <button onClick={onClose} className="p-1 text-gray-400 hover:text-gray-950 cursor-pointer">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div
          id="printable-merged-bill"
          className="p-5 border border-gray-300 rounded-xl bg-[#fafafa] font-sans text-xs text-gray-800 space-y-4 shadow-inner max-h-[420px] overflow-y-auto"
        >
          <div className="text-center space-y-1 pb-3 border-b border-gray-300 border-dashed">
            <h3 className="text-base font-bold text-gray-950 uppercase tracking-tight">
              {group.restaurantName}
            </h3>
            <p className="text-[10px] text-gray-500">{group.location}</p>
            <p className="font-semibold text-[10px]">PAN / VAT No: {group.panOrVat}</p>
            <h4 className="text-xs font-extrabold text-gray-950 uppercase border-y border-gray-200 py-1 tracking-wider mt-2">
              {lang === 'en' ? 'Combined Invoice' : 'संयुक्त बिजक'}
            </h4>
          </div>

          <div className="grid grid-cols-2 gap-y-1 border-b border-gray-200 pb-2 leading-relaxed">
            <div>
              Invoice No: <span className="font-mono font-bold text-gray-950">{invoiceLabel}</span>
            </div>
            <div className="text-right">
              Date: <span className="font-mono">{new Date().toLocaleString()}</span>
            </div>
            <div className="col-span-2">
              Bill To: <span className="font-bold text-gray-900">{group.billTo}</span>
              {group.tableNumbers.length > 0 && (
                <span className="text-[10px] text-gray-500 font-mono ml-1">
                  (Tables {group.tableNumbers.join(', ')})
                </span>
              )}
            </div>
            <div className="col-span-2">
              {lang === 'en' ? 'Merged from' : 'बाट मर्ज गरिएको'}:{' '}
              <span className="font-semibold text-gray-950">
                {group.billIds.length} {lang === 'en' ? 'bill(s)' : 'बिल(हरू)'}
              </span>
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
              {group.mergedItems.map((item, idx) => (
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
              <span className="font-mono">NPR {money(group.subtotal)}</span>
            </div>
            {group.discount > 0 && (
              <div className="flex justify-between text-red-600">
                <span>Discount:</span>
                <span className="font-mono">-NPR {money(group.discount)}</span>
              </div>
            )}
            <div className="flex justify-between font-medium">
              <span>Taxable Amount:</span>
              <span className="font-mono">NPR {money(group.taxableAmount)}</span>
            </div>
            {group.vatCollected > 0 && (
              <div className="flex justify-between">
                <span>VAT:</span>
                <span className="font-mono">NPR {money(group.vatCollected)}</span>
              </div>
            )}
            <div className="flex justify-between border-t border-gray-400 pt-1 text-xs text-gray-950 font-bold">
              <span>GRAND TOTAL:</span>
              <span className="font-mono text-amber-700">NPR {money(group.grandTotal)}</span>
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
            className="px-6 py-2 bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold uppercase tracking-wider rounded-lg transition-colors shadow-xs flex items-center gap-1.5 cursor-pointer"
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
// MAIN UNPAID BILL PAGE
// ==========================================

export default function UnpaidBill({ lang = 'en' as 'en' | 'ne' }: { lang?: 'en' | 'ne' }) {
  const user = getLoggedInUser();
  const restaurantId = user?.id ? String(user.id) : '';

  const [allBills, setAllBills] = useState<Bill[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [printGroup, setPrintGroup] = useState<GroupedPending | null>(null);

  const fetchBills = useCallback(async () => {
    setError('');
    try {
      const url = restaurantId
        ? `${BILLS_URL}?restaurantId=${encodeURIComponent(restaurantId)}`
        : BILLS_URL;
      const res = await fetch(url);
      const result = await res.json();
      if (!res.ok || !result.success) {
        throw new Error(result.message || 'Failed to load bills.');
      }
      setAllBills(result.data || []);
    } catch (err: any) {
      setError(err.message || 'Could not connect to the server.');
    } finally {
      setLoading(false);
    }
  }, [restaurantId]);

  useEffect(() => {
    fetchBills();
  }, [fetchBills]);

  const pendingBills = useMemo(
    () => allBills.filter((b) => b.paymentMethod === 'Pending'),
    [allBills]
  );

  const groupedPending = useMemo(() => groupPendingBills(pendingBills), [pendingBills]);

  const selectedGroup = useMemo(
    () => groupedPending.find((g) => g.key === selectedKey) || null,
    [groupedPending, selectedKey]
  );

  // Reset payment method whenever the selected customer group changes
  useEffect(() => {
    setPaymentMethod(null);
  }, [selectedKey]);

  const canMarkPaid = !!selectedGroup && !!paymentMethod && !submitting;

  const handleMarkPaid = async () => {
    if (!selectedGroup || !paymentMethod) return;
    setSubmitting(true);
    setError('');

    try {
      // Flip every bill in this customer's pending group over to the chosen
      // payment method, one PATCH per bill (backend has no bulk endpoint).
      const results = await Promise.allSettled(
        selectedGroup.billIds.map((id) =>
          fetch(`${BILLS_URL}/${id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ paymentMethod }),
          }).then(async (res) => {
            const data = await res.json();
            if (!res.ok || !data?.success) {
              throw new Error(data?.message || `Failed to update bill ${id}`);
            }
            return data;
          })
        )
      );

      const failures = results.filter((r) => r.status === 'rejected');
      if (failures.length > 0) {
        throw new Error(
          `${failures.length} of ${selectedGroup.billIds.length} bill(s) failed to update. Refresh and retry for those.`
        );
      }

      // Remove this customer's bills from local state
      setAllBills((prev) => prev.filter((b) => !selectedGroup.billIds.includes(b._id)));
      setSelectedKey(null);
      setPaymentMethod(null);
    } catch (err: any) {
      setError(err.message || 'Could not update payment status. Please try again.');
      window.setTimeout(() => setError(''), 6000);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="h-full flex flex-col" id="unpaid-bill-root">
      {/* Page header */}
      <div className="flex items-center justify-between mb-5 shrink-0">
        <div className="flex items-center gap-2.5">
          <div className="h-10 w-10 bg-amber-600 rounded-xl flex items-center justify-center text-white shadow-xs">
            <Clock className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-base font-extrabold text-gray-900 leading-tight">
              {lang === 'en' ? 'Pending Bills' : 'बाँकी बिलहरू'}
            </h1>
            <p className="text-xs text-gray-500">
              {lang === 'en'
                ? 'Bills under the same name are combined into one invoice.'
                : 'उही नामका बिलहरू एउटै बिजकमा मिसिन्छन्।'}
            </p>
          </div>
        </div>
        <button
          onClick={fetchBills}
          className="p-2.5 bg-white hover:bg-gray-50 border border-gray-200 rounded-xl text-gray-500 hover:text-gray-900 transition-colors shadow-sm"
          title="Refresh"
        >
          <RefreshCw className="h-4 w-4" />
        </button>
      </div>

      {error && (
        <div className="mb-4 flex items-start gap-2 rounded-md border border-red-300/50 bg-red-50 px-3 py-2.5 text-xs text-red-700 shrink-0">
          <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <div className="flex-1 grid grid-cols-1 lg:grid-cols-[1fr_420px] gap-6 min-h-0">
        {/* LEFT: pending customer groups */}
        <div className="min-h-0 flex flex-col">
          <div className="flex items-center gap-2 mb-3 shrink-0">
            <ClipboardList className="h-4 w-4 text-gray-400" />
            <h2 className="text-xs font-bold uppercase tracking-widest text-gray-500">
              {lang === 'en' ? 'Pending Customers' : 'बाँकी ग्राहकहरू'}
            </h2>
            <span className="font-mono text-[11px] font-bold text-gray-500 bg-gray-100 rounded-full px-2 py-0.5">
              {groupedPending.length}
            </span>
          </div>

          <div className="flex-1 overflow-y-auto pr-1">
            {loading ? (
              <div className="flex items-center justify-center py-16">
                <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
              </div>
            ) : groupedPending.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-gray-300 py-16 text-center">
                <ShoppingBag className="h-8 w-8 mx-auto text-gray-300 mb-2" />
                <p className="text-sm font-medium text-gray-400">
                  {lang === 'en' ? 'No pending bills right now' : 'अहिले कुनै बाँकी बिल छैन'}
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
                {groupedPending.map((group) => (
                  <PendingGroupCard
                    key={group.key}
                    group={group}
                    isSelected={selectedKey === group.key}
                    onSelect={(g) => setSelectedKey(g.key)}
                  />
                ))}
              </div>
            )}
          </div>
        </div>

        {/* RIGHT: combined bill + settle panel */}
        <div className="min-h-0 flex flex-col bg-white border border-gray-200 rounded-2xl shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100 shrink-0 flex items-center justify-between">
            <h2 className="text-sm font-bold text-gray-900">
              {lang === 'en' ? 'Combined Bill' : 'संयुक्त बिल'}
            </h2>
            {selectedGroup && (
              <button
                onClick={() => setPrintGroup(selectedGroup)}
                className="flex items-center gap-1.5 text-xs font-bold text-gray-500 hover:text-gray-900 cursor-pointer"
              >
                <Printer className="h-3.5 w-3.5" />
                {lang === 'en' ? 'Print' : 'प्रिन्ट'}
              </button>
            )}
          </div>

          {!selectedGroup ? (
            <div className="flex-1 flex flex-col items-center justify-center text-center px-6 py-10">
              <Receipt className="h-9 w-9 text-gray-200 mb-3" />
              <p className="text-sm font-medium text-gray-400">
                {lang === 'en'
                  ? 'Select a pending customer on the left to view their combined bill'
                  : 'संयुक्त बिल हेर्न बायाँबाट ग्राहक छान्नुहोस्'}
              </p>
            </div>
          ) : (
            <>
              <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
                {/* Customer + tables info */}
                <div className="rounded-xl bg-gray-50 border border-gray-150 p-3.5 space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="flex items-center gap-1.5 text-gray-500">
                      <Users className="h-3.5 w-3.5" />
                      {lang === 'en' ? 'Customer' : 'ग्राहक'}
                    </span>
                    <span className="font-semibold text-gray-900">{selectedGroup.billTo}</span>
                  </div>
                  {selectedGroup.tableNumbers.length > 0 && (
                    <div className="flex items-center justify-between text-sm">
                      <span className="flex items-center gap-1.5 text-gray-500">
                        <Hash className="h-3.5 w-3.5" />
                        {lang === 'en' ? 'Tables' : 'टेबलहरू'}
                      </span>
                      <span className="font-mono font-bold text-gray-900">
                        {selectedGroup.tableNumbers.join(', ')}
                      </span>
                    </div>
                  )}
                  <div className="flex items-center justify-between text-sm">
                    <span className="flex items-center gap-1.5 text-gray-500">
                      <Receipt className="h-3.5 w-3.5" />
                      {lang === 'en' ? 'Merged bills' : 'मर्ज गरिएका बिलहरू'}
                    </span>
                    <span className="font-mono font-bold text-gray-900">
                      {selectedGroup.billIds.length}
                    </span>
                  </div>
                </div>

                {/* Merged items table */}
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-2">
                    {lang === 'en' ? 'Items (merged)' : 'परिकारहरू (मर्ज गरिएको)'}
                  </p>
                  <div className="border border-gray-150 rounded-xl overflow-hidden">
                    <table className="w-full text-xs">
                      <thead className="bg-gray-50 text-gray-500">
                        <tr>
                          <th className="text-left font-semibold px-3 py-2">Item</th>
                          <th className="text-center font-semibold px-2 py-2">Qty</th>
                          <th className="text-right font-semibold px-2 py-2">Rate</th>
                          <th className="text-right font-semibold px-3 py-2">Total</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {selectedGroup.mergedItems.map((item, idx) => (
                          <tr key={idx}>
                            <td className="px-3 py-2 font-medium text-gray-800">{item.itemName}</td>
                            <td className="px-2 py-2 text-center font-mono text-gray-600">{item.quantity}</td>
                            <td className="px-2 py-2 text-right font-mono text-gray-600">{money(item.rate)}</td>
                            <td className="px-3 py-2 text-right font-mono font-semibold text-gray-900">
                              {money(item.total)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Totals breakdown */}
                <div className="rounded-xl border border-gray-150 p-3.5 space-y-1.5 text-sm">
                  <div className="flex justify-between text-gray-600">
                    <span>{lang === 'en' ? 'Subtotal' : 'उप-जम्मा'}</span>
                    <span className="font-mono">NPR {money(selectedGroup.subtotal)}</span>
                  </div>
                  {selectedGroup.discount > 0 && (
                    <div className="flex justify-between text-red-600">
                      <span>{lang === 'en' ? 'Discount' : 'छुट'}</span>
                      <span className="font-mono">-NPR {money(selectedGroup.discount)}</span>
                    </div>
                  )}
                  {selectedGroup.vatCollected > 0 && (
                    <div className="flex justify-between text-gray-600">
                      <span>{lang === 'en' ? 'VAT' : 'भ्याट'}</span>
                      <span className="font-mono">NPR {money(selectedGroup.vatCollected)}</span>
                    </div>
                  )}
                  <div className="flex justify-between pt-1.5 mt-1.5 border-t border-gray-150 text-base font-bold text-gray-900">
                    <span>{lang === 'en' ? 'Grand Total' : 'कुल जम्मा'}</span>
                    <span className="font-mono text-amber-700">NPR {money(selectedGroup.grandTotal)}</span>
                  </div>
                </div>

                {/* Payment method — choosing one marks the whole group Paid */}
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-2">
                    {lang === 'en' ? 'Settle With' : 'भुक्तानी विधि'}
                  </p>
                  <div className="grid grid-cols-2 gap-2.5">
                    {PAYMENT_METHODS.map((pm) => {
                      const Icon = pm.icon;
                      const accent = ACCENT_CLASSES[pm.accent];
                      const isActive = paymentMethod === pm.id;
                      return (
                        <button
                          key={pm.id}
                          type="button"
                          onClick={() => setPaymentMethod(pm.id)}
                          className={`flex items-center gap-2 rounded-xl border px-3 py-2.5 text-sm font-semibold transition-all cursor-pointer ${
                            isActive
                              ? `${accent.border} ${accent.bg} ${accent.text} ring-2 ${accent.ring}`
                              : 'border-gray-200 text-gray-600 hover:border-gray-300 hover:bg-gray-50'
                          }`}
                        >
                          <Icon className={`h-4 w-4 ${isActive ? '' : 'text-gray-400'}`} />
                          {pm.label}
                          {isActive && <CheckCircle2 className="h-3.5 w-3.5 ml-auto" />}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* Sticky action footer */}
              <div className="border-t border-gray-100 p-4 shrink-0 bg-white">
                <button
                  onClick={handleMarkPaid}
                  disabled={!canMarkPaid}
                  className="w-full flex items-center justify-center gap-2 rounded-xl bg-amber-600 hover:bg-amber-700 disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-bold py-3 transition-colors shadow-sm cursor-pointer"
                >
                  {submitting ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <CheckCircle2 className="h-4 w-4" />
                  )}
                  {submitting
                    ? lang === 'en' ? 'Marking paid…' : 'भुक्तानी हुँदै…'
                    : lang === 'en' ? `Mark ${selectedGroup.billIds.length} Bill(s) Paid` : 'भुक्तानी भएको चिन्ह लगाउनुहोस्'}
                </button>
                {!paymentMethod && (
                  <p className="text-[11px] text-gray-400 text-center mt-2">
                    {lang === 'en' ? 'Select a payment method to settle' : 'भुक्तानी विधि छान्नुहोस्'}
                  </p>
                )}
              </div>
            </>
          )}
        </div>
      </div>

      {printGroup && (
        <MergedBillModal group={printGroup} lang={lang} onClose={() => setPrintGroup(null)} />
      )}
    </div>
  );
}