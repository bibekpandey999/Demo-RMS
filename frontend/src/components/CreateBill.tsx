import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Receipt, Users, Hash, Wallet, Banknote, Smartphone, CreditCard,
  CheckCircle2, X, Printer, Loader2, AlertTriangle, RefreshCw,
  ClipboardList, ShoppingBag, PlusCircle, Percent, Clock,
} from 'lucide-react';

// ==========================================
// CONFIG
// ==========================================

const API_BASE = import.meta.env.VITE_API_URL || ' https://demo-rms.onrender.com';
const ORDERS_URL = `${API_BASE}/api/orders`;
const BILLS_URL = `${API_BASE}/api/bills`;

const DEFAULT_VAT_RATE = 0; // % — now editable, defaults to 0

const getLoggedInUser = () => {
  try {
    const raw = localStorage.getItem('pharmacyUser');
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
};

interface OrderItem {
  itemName: string;
  description?: string;
  itemPrice: number;
  quantity: number;
}

interface Order {
  _id: string;
  restaurantId: string;
  customerName: string;
  tableNumber: string;
  orderNote?: string;
  items: OrderItem[];
  totalAmount: number;
  orderStatus: string;
  paymentStatus: string;
  createdAt?: string;
  updatedAt?: string;
}

interface BillItem {
  itemName: string;
  quantity: number;
  rate: number;
  total: number;
}

type PaymentMethod = 'Cash' | 'eSewa' | 'Khalti' | 'IMEPay' | 'Pending';

const PAYMENT_METHODS: { id: PaymentMethod; label: string; icon: React.ElementType; accent: string }[] = [
  { id: 'Cash', label: 'Cash', icon: Banknote, accent: 'emerald' },
  { id: 'eSewa', label: 'eSewa', icon: Smartphone, accent: 'green' },
  { id: 'Khalti', label: 'Khalti', icon: Wallet, accent: 'purple' },
  { id: 'IMEPay', label: 'IMEPay', icon: CreditCard, accent: 'sky' },
  { id: 'Pending', label: 'Pending', icon: Clock, accent: 'amber' },
];

const ACCENT_CLASSES: Record<string, { border: string; bg: string; text: string; ring: string }> = {
  emerald: { border: 'border-emerald-500', bg: 'bg-emerald-50', text: 'text-emerald-700', ring: 'ring-emerald-500/20' },
  green: { border: 'border-green-500', bg: 'bg-green-50', text: 'text-green-700', ring: 'ring-green-500/20' },
  purple: { border: 'border-purple-500', bg: 'bg-purple-50', text: 'text-purple-700', ring: 'ring-purple-500/20' },
  sky: { border: 'border-sky-500', bg: 'bg-sky-50', text: 'text-sky-700', ring: 'ring-sky-500/20' },
  amber: { border: 'border-amber-500', bg: 'bg-amber-50', text: 'text-amber-700', ring: 'ring-amber-500/20' },
};

function money(n: number): string {
  return (Number.isFinite(n) ? n : 0).toFixed(2);
}

// ==========================================
// SERVED ORDER CARD (left list)
// ==========================================

function ServedOrderCard({
  order,
  isSelected,
  onSelect,
}: {
  order: Order;
  isSelected: boolean;
  onSelect: (order: Order) => void;
}) {
  const itemCount = (order.items || []).reduce((sum, i) => sum + (i.quantity || 0), 0);
  const isBilled = order.paymentStatus === 'Paid';

  return (
    <button
      onClick={() => !isBilled && onSelect(order)}
      disabled={isBilled}
      className={`w-full text-left rounded-2xl border p-4 transition-all ${
        isBilled
          ? 'bg-gray-50 border-gray-150 opacity-50 cursor-not-allowed'
          : isSelected
          ? 'bg-teal-50 border-teal-400 ring-2 ring-teal-500/20 shadow-sm'
          : 'bg-white border-gray-200 hover:border-teal-300 hover:shadow-sm cursor-pointer'
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-gray-400">
            <Hash className="h-3 w-3" />
            Table
          </div>
          <p className="font-mono text-lg font-bold text-gray-900 leading-tight mt-0.5">
            {order.tableNumber}
          </p>
        </div>
        <span
          className={`shrink-0 text-[10px] font-bold px-2 py-1 rounded-full uppercase tracking-wide ${
            isBilled ? 'bg-gray-100 text-gray-400' : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
          }`}
        >
          {isBilled ? 'Billed' : 'Served'}
        </span>
      </div>

      <div className="mt-2.5 flex items-center justify-between border-t border-gray-100 pt-2.5">
        <p className="text-sm font-semibold text-gray-800 truncate pr-2">{order.customerName}</p>
        <span className="shrink-0 font-mono text-[11px] font-bold text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full">
          {itemCount} item{itemCount !== 1 ? 's' : ''}
        </span>
      </div>

      <p className="mt-1 text-right font-mono text-sm font-bold text-teal-700">
        NPR {money(order.totalAmount)}
      </p>
    </button>
  );
}

// ==========================================
// PRINTABLE BILL MODAL
// ==========================================

function BillModal({
  bill,
  lang,
  onClose,
}: {
  bill: any;
  lang: 'en' | 'ne';
  onClose: () => void;
}) {
  const billItems: BillItem[] = bill?.items ?? [];
  const vatRate = bill?.vatRate ?? 0;
  const hasVat = vatRate > 0;
  const hasDiscount = (bill?.discountPercent ?? 0) > 0;

  return (
    <div className="fixed inset-0 bg-gray-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-[60] animate-fade-in">
      {/* Print-only styles: constrain the page to 80mm thermal-receipt width */}
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
          #printable-bill, #printable-bill * {
            visibility: visible;
          }
          #printable-bill {
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
          #printable-bill h3 {
            font-size: 12px;
          }
          #printable-bill h4 {
            font-size: 10px;
          }
          #printable-bill table {
            font-size: 8.5px;
          }
          #printable-bill .pt-8 {
            padding-top: 12px;
          }
        }
      `}</style>

      <div className="bg-white rounded-2xl max-w-lg w-full p-6 space-y-6 shadow-2xl border border-gray-100">
        <div className="flex justify-between items-center border-b border-gray-100 pb-3">
          <span className="font-bold text-gray-900 flex items-center gap-1.5 text-sm">
            <Receipt className="h-5 w-5 text-teal-600" />
            {lang === 'en' ? 'Bill Created' : 'बिल तयार भयो'}
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
              Date: <span className="font-mono">{new Date(bill.date).toLocaleString()}</span>
            </div>
            <div className="col-span-2">
              Bill To: <span className="font-bold text-gray-900">{bill.billTo}</span>
              <span className="text-[10px] text-gray-500 font-mono ml-1">(Table {bill.tableNumber})</span>
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
              {billItems.map((item: BillItem, idx: number) => (
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
                <span>Discount ({bill.discountPercent}%):</span>
                <span className="font-mono">-NPR {money(bill.discount)}</span>
              </div>
            )}
            <div className="flex justify-between font-medium">
              <span>Taxable Amount:</span>
              <span className="font-mono">NPR {money(bill.taxableAmount)}</span>
            </div>
            {hasVat && (
              <div className="flex justify-between">
                <span>VAT ({vatRate}%):</span>
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
// MAIN CREATE BILL PAGE
// ==========================================

export default function CreateBill({ lang = 'en' as 'en' | 'ne' }: { lang?: 'en' | 'ne' }) {
  const user = getLoggedInUser();
  const restaurantId = user?.id ? String(user.id) : '';
  const restaurantName = user?.pharmacyName || user?.restaurantName || 'Restaurant';
  const restaurantLocation = user?.location || 'N/A';
  const restaurantPanOrVat = user?.PanOrVat || user?.panOrVat || 'N/A';

  const [servedOrders, setServedOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod | null>(null);
  const [discountPercent, setDiscountPercent] = useState<number>(0);
  const [vatRate, setVatRate] = useState<number>(DEFAULT_VAT_RATE);
  const [submitting, setSubmitting] = useState(false);
  const [createdBill, setCreatedBill] = useState<any | null>(null);

  const fetchServedOrders = useCallback(async () => {
    setError('');
    try {
      const url = restaurantId
        ? `${ORDERS_URL}?restaurantId=${encodeURIComponent(restaurantId)}`
        : ORDERS_URL;
      const res = await fetch(url);
      const result = await res.json();
      if (!res.ok || !result.success) {
        throw new Error(result.message || 'Failed to load orders.');
      }
      const served: Order[] = (result.data || []).filter(
  (o: Order) => o.orderStatus === 'Served' && o.paymentStatus !== 'Paid' && o.paymentStatus !== 'Pending'
);
      setServedOrders(served);
    } catch (err: any) {
      setError(err.message || 'Could not connect to the server.');
    } finally {
      setLoading(false);
    }
  }, [restaurantId]);

  useEffect(() => {
    fetchServedOrders();
  }, [fetchServedOrders]);

  // Reset discount + payment method + VAT whenever the selected order changes
  useEffect(() => {
    setDiscountPercent(0);
    setPaymentMethod(null);
    setVatRate(DEFAULT_VAT_RATE);
  }, [selectedOrder?._id]);

  const billItems: BillItem[] = useMemo(() => {
    if (!selectedOrder) return [];
    return (selectedOrder.items || []).map((i) => ({
      itemName: i.itemName,
      quantity: i.quantity,
      rate: i.itemPrice,
      total: i.itemPrice * i.quantity,
    }));
  }, [selectedOrder]);

  const subtotal = useMemo(() => billItems.reduce((s, i) => s + i.total, 0), [billItems]);

  const safeDiscountPercent = Math.min(Math.max(discountPercent || 0, 0), 100);
  const safeVatRate = Math.min(Math.max(vatRate || 0, 0), 100);

  const discountAmount = (subtotal * safeDiscountPercent) / 100;
  const taxableAmount = Math.max(subtotal - discountAmount, 0);
  const hasVat = safeVatRate > 0;
  const vatCollected = hasVat ? (taxableAmount * safeVatRate) / 100 : 0;
  const grandTotal = taxableAmount + vatCollected;

  const canCreateBill = !!selectedOrder && !!paymentMethod && !submitting;

const handleCreateBill = async () => {
    if (!selectedOrder || !paymentMethod) return;
    setSubmitting(true);
    setError('');

    const isPending = paymentMethod === 'Pending';

    const payload = {
      restaurantName,
      location: restaurantLocation,
      panOrVat: restaurantPanOrVat,
      invoiceNo: `INV-${Date.now()}`,
      billTo: selectedOrder.customerName,
      tableNumber: selectedOrder.tableNumber,
      paymentMethod,
      date: new Date().toISOString(),
      items: billItems,
      subtotal,
      discountPercent: safeDiscountPercent,
      discount: discountAmount,
      vatRate: hasVat ? safeVatRate : 0,
      taxableAmount,
      vatCollected,
      grandTotal,
      restaurantId,
       orderId: selectedOrder._id,
    };

   try {
  const res = await fetch(BILLS_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const data = await res.json();

  if (!res.ok || !data?.success) {
    throw new Error(data?.message || 'Failed to create bill.');
  }

const orderUpdateRes = await fetch(`${ORDERS_URL}/${selectedOrder._id}`, {
  method: 'PUT',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    paymentStatus: isPending ? 'Pending' : 'Paid',
    orderStatus: 'Completed',
  }),
});

if (!orderUpdateRes.ok) {
  const errText = await orderUpdateRes.text().catch(() => '');
  console.error('Order update failed:', orderUpdateRes.status, errText);
  throw new Error('Bill was created but order status failed to update. Please refresh and check.');
}

  setServedOrders((prev) => prev.filter((o) => o._id !== selectedOrder._id));

  if (!isPending) {
    setCreatedBill(data.data || payload);
  }

  setSelectedOrder(null);
  setPaymentMethod(null);
  setDiscountPercent(0);
  setVatRate(DEFAULT_VAT_RATE);
} catch (err: any) {
  setError(err.message || 'Could not save the bill. Please try again.');
  window.setTimeout(() => setError(''), 5000);
} finally {
  setSubmitting(false);
}
  };

  return (
    <div className="h-full flex flex-col" id="create-bill-root">
      {/* Page header */}
      <div className="flex items-center justify-between mb-5 shrink-0">
        <div className="flex items-center gap-2.5">
          <div className="h-10 w-10 bg-teal-600 rounded-xl flex items-center justify-center text-white shadow-xs">
            <Receipt className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-base font-extrabold text-gray-900 leading-tight">
              {lang === 'en' ? 'Create Bill' : 'बिल तयार गर्नुहोस्'}
            </h1>
            <p className="text-xs text-gray-500">
              {lang === 'en'
                ? 'Select a served order and generate an invoice.'
                : 'सर्भ भएको अर्डर छान्नुहोस् र बिजक बनाउनुहोस्।'}
            </p>
          </div>
        </div>
        <button
          onClick={fetchServedOrders}
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
        {/* LEFT: served orders list */}
        <div className="min-h-0 flex flex-col">
          <div className="flex items-center gap-2 mb-3 shrink-0">
            <ClipboardList className="h-4 w-4 text-gray-400" />
            <h2 className="text-xs font-bold uppercase tracking-widest text-gray-500">
              {lang === 'en' ? 'Served Orders' : 'सर्भ भएका अर्डरहरू'}
            </h2>
            <span className="font-mono text-[11px] font-bold text-gray-500 bg-gray-100 rounded-full px-2 py-0.5">
              {servedOrders.length}
            </span>
          </div>

          <div className="flex-1 overflow-y-auto pr-1">
            {loading ? (
              <div className="flex items-center justify-center py-16">
                <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
              </div>
            ) : servedOrders.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-gray-300 py-16 text-center">
                <ShoppingBag className="h-8 w-8 mx-auto text-gray-300 mb-2" />
                <p className="text-sm font-medium text-gray-400">
                  {lang === 'en' ? 'No served orders waiting for billing' : 'बिलिङका लागि कुनै अर्डर छैन'}
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
                {servedOrders.map((order) => (
                  <ServedOrderCard
                    key={order._id}
                    order={order}
                    isSelected={selectedOrder?._id === order._id}
                    onSelect={setSelectedOrder}
                  />
                ))}
              </div>
            )}
          </div>
        </div>

        {/* RIGHT: bill builder panel */}
        <div className="min-h-0 flex flex-col bg-white border border-gray-200 rounded-2xl shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100 shrink-0">
            <h2 className="text-sm font-bold text-gray-900">
              {lang === 'en' ? 'Bill Summary' : 'बिल सारांश'}
            </h2>
          </div>

          {!selectedOrder ? (
            <div className="flex-1 flex flex-col items-center justify-center text-center px-6 py-10">
              <Receipt className="h-9 w-9 text-gray-200 mb-3" />
              <p className="text-sm font-medium text-gray-400">
                {lang === 'en'
                  ? 'Select a served order on the left to build a bill'
                  : 'बिल बनाउन बायाँबाट अर्डर छान्नुहोस्'}
              </p>
            </div>
          ) : (
            <>
              <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
                {/* Customer + table info */}
                <div className="rounded-xl bg-gray-50 border border-gray-150 p-3.5 space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="flex items-center gap-1.5 text-gray-500">
                      <Users className="h-3.5 w-3.5" />
                      {lang === 'en' ? 'Customer' : 'ग्राहक'}
                    </span>
                    <span className="font-semibold text-gray-900">{selectedOrder.customerName}</span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="flex items-center gap-1.5 text-gray-500">
                      <Hash className="h-3.5 w-3.5" />
                      {lang === 'en' ? 'Table' : 'टेबल'}
                    </span>
                    <span className="font-mono font-bold text-gray-900">{selectedOrder.tableNumber}</span>
                  </div>
                </div>

                {/* Items table */}
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-2">
                    {lang === 'en' ? 'Items' : 'परिकारहरू'}
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
                        {billItems.map((item, idx) => (
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

                {/* Discount + VAT inputs */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-1.5 flex items-center gap-1.5">
                      <Percent className="h-3 w-3" />
                      {lang === 'en' ? 'Discount (%)' : 'छुट (%)'}
                    </label>
                    <input
                      type="number"
                      min={0}
                      max={100}
                      value={discountPercent === 0 ? '' : discountPercent}
                      onChange={(e) => setDiscountPercent(Number(e.target.value) || 0)}
                      placeholder="0"
                      className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm font-mono focus:outline-none focus:border-teal-600 focus:ring-1 focus:ring-teal-600"
                    />
                  </div>

                  <div>
                    <label className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-1.5 flex items-center gap-1.5">
                      <Percent className="h-3 w-3" />
                      {lang === 'en' ? 'VAT (%)' : 'भ्याट (%)'}
                    </label>
                    <input
                      type="number"
                      min={0}
                      max={100}
                      value={vatRate === 0 ? '' : vatRate}
                      onChange={(e) => setVatRate(Number(e.target.value) || 0)}
                      placeholder="0"
                      className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm font-mono focus:outline-none focus:border-teal-600 focus:ring-1 focus:ring-teal-600"
                    />
                  </div>
                </div>

                {/* Totals breakdown */}
                <div className="rounded-xl border border-gray-150 p-3.5 space-y-1.5 text-sm">
                  <div className="flex justify-between text-gray-600">
                    <span>{lang === 'en' ? 'Subtotal' : 'उप-जम्मा'}</span>
                    <span className="font-mono">NPR {money(subtotal)}</span>
                  </div>
                  {safeDiscountPercent > 0 && (
                    <div className="flex justify-between text-red-600">
                      <span>{lang === 'en' ? 'Discount' : 'छुट'} ({safeDiscountPercent}%)</span>
                      <span className="font-mono">-NPR {money(discountAmount)}</span>
                    </div>
                  )}
                  {hasVat && (
                    <div className="flex justify-between text-gray-600">
                      <span>{lang === 'en' ? 'VAT' : 'भ्याट'} ({safeVatRate}%)</span>
                      <span className="font-mono">NPR {money(vatCollected)}</span>
                    </div>
                  )}
                  <div className="flex justify-between pt-1.5 mt-1.5 border-t border-gray-150 text-base font-bold text-gray-900">
                    <span>{lang === 'en' ? 'Grand Total' : 'कुल जम्मा'}</span>
                    <span className="font-mono text-teal-700">NPR {money(grandTotal)}</span>
                  </div>
                </div>

                {/* Payment method */}
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-2">
                    {lang === 'en' ? 'Payment Method' : 'भुक्तानी विधि'}
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
                  onClick={handleCreateBill}
                  disabled={!canCreateBill}
                  className="w-full flex items-center justify-center gap-2 rounded-xl bg-teal-600 hover:bg-teal-700 disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-bold py-3 transition-colors shadow-sm cursor-pointer"
                >
                  {submitting ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <PlusCircle className="h-4 w-4" />
                  )}
                  {submitting
                    ? lang === 'en' ? 'Creating bill…' : 'बिल बनाउँदै…'
                    : lang === 'en' ? 'Create Bill' : 'बिल बनाउनुहोस्'}
                </button>
                {!paymentMethod && (
                  <p className="text-[11px] text-gray-400 text-center mt-2">
                    {lang === 'en' ? 'Select a payment method to continue' : 'भुक्तानी विधि छान्नुहोस्'}
                  </p>
                )}
              </div>
            </>
          )}
        </div>
      </div>

      {/* Printable bill modal, opened right after a bill is created */}
      {createdBill && (
        <BillModal bill={createdBill} lang={lang} onClose={() => setCreatedBill(null)} />
      )}
    </div>
  );
}