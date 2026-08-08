import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { Flame, ChefHat, Bell, RefreshCw, AlertTriangle, Loader2, Printer } from 'lucide-react';

// ==========================================
// CONFIG
// ==========================================

const API_BASE = import.meta.env.VITE_API_URL || ' https://demo-rms.onrender.com';
const ORDERS_URL = `${API_BASE}/api/orders`;

const getLoggedInRestaurantId = () => {
  try {
    const raw = localStorage.getItem('user');
    if (!raw) return '';
    const parsed = JSON.parse(raw);
    return parsed?.id ? String(parsed.id) : '';
  } catch {
    return '';
  }
};

// How long a ticket can sit in a stage before it's flagged as running hot.
const WARN_AFTER_MIN = 8;
const CRITICAL_AFTER_MIN = 15;

// Poll interval for picking up new tickets fired in from the floor.
const POLL_MS = 8000;

type OrderStatus = 'Pending' | 'Preparing' | 'Ready' | 'Served' | 'Cancelled';

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
  orderStatus: OrderStatus;
  paymentStatus: string;
  createdAt?: string;
  updatedAt?: string;
}

// The kitchen only ever sees tickets in these three lanes. Served and
// Cancelled tickets leave the pass immediately.
const LANES: { status: OrderStatus; label: string; next: OrderStatus | null }[] = [
  { status: 'Pending', label: 'New', next: 'Preparing' },
  { status: 'Preparing', label: 'Cooking', next: 'Ready' },
  { status: 'Ready', label: 'Ready to serve', next: null },
];

const LANE_STYLES: Record<string, { accent: string; glow: string; chip: string; ring: string }> = {
  Pending: {
    accent: 'text-amber-600',
    glow: 'shadow-[0_0_0_1px_rgba(245,158,11,0.25)]',
    chip: 'bg-amber-50 text-amber-700 border-amber-300',
    ring: 'border-amber-400/40',
  },
  Preparing: {
    accent: 'text-sky-600',
    glow: 'shadow-[0_0_0_1px_rgba(56,189,248,0.25)]',
    chip: 'bg-sky-50 text-sky-700 border-sky-300',
    ring: 'border-sky-400/40',
  },
  Ready: {
    accent: 'text-emerald-600',
    glow: 'shadow-[0_0_0_1px_rgba(52,211,153,0.25)]',
    chip: 'bg-emerald-50 text-emerald-700 border-emerald-300',
    ring: 'border-emerald-400/40',
  },
};

// ==========================================
// TIME HELPERS
// ==========================================

function minutesSince(iso?: string, now: number = Date.now()): number {
  if (!iso) return 0;
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return 0;
  return Math.max(0, (now - then) / 60000);
}

function formatElapsed(mins: number): string {
  const total = Math.floor(mins);
  const h = Math.floor(total / 60);
  const m = total % 60;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

function ageClass(mins: number): string {
  if (mins >= CRITICAL_AFTER_MIN) return 'text-red-600';
  if (mins >= WARN_AFTER_MIN) return 'text-amber-600';
  return 'text-gray-500';
}

function formatTicketDateTime(iso?: string): string {
  const d = iso ? new Date(iso) : new Date();
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleString('en-US', {
    weekday: 'short',
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: true,
  });
}

// Builds a stable fingerprint of an order's items so we can tell whether
// the item list actually changed between polls (added items, changed
// quantities, etc), independent of whatever the backend does to updatedAt.
function itemsSignature(order: Order): string {
  return (order.items || [])
    .map((i) => `${i.itemName}|${i.quantity}|${i.itemPrice}`)
    .join('~');
}

// ==========================================
// AUTO-PRINT: builds a kitchen-ticket HTML doc and sends it straight to
// the browser print dialog inside a hidden iframe, no user click needed.
// ==========================================

function escapeHtml(str: string): string {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// isUpdate flags the ticket as an updated order (new items added after
// the original was fired) so the kitchen can tell it apart from a fresh
// ticket at a glance.
function buildTicketHtml(order: Order, isUpdate: boolean = false): string {
  const itemRows = (order.items || [])
    .map(
      (item) => `
        <tr>
          <td class="qty">${escapeHtml(String(item.quantity))}×</td>
          <td class="name">
            ${escapeHtml(item.itemName)}
            ${item.description ? `<div class="desc">${escapeHtml(item.description)}</div>` : ''}
          </td>
        </tr>`
    )
    .join('');

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8" />
<title>Kitchen Ticket</title>
<style>
  @page { size: 80mm auto; margin: 0; }
  * { 
    box-sizing: border-box; 
    -webkit-print-color-adjust: exact; 
  }
  body {
    font-family: 'Courier New', Courier, monospace;
    width: 72mm;
    margin: 0 auto;
    padding: 4mm 0;
    color: #000000;
    background: #ffffff;
    font-weight: 900; /* Forces maximum black fill on thermal heads */
  }
  .center { text-align: center; }
  h1 {
    font-size: 18px;
    font-weight: 900;
    margin: 0 0 4px;
    letter-spacing: 1px;
  }
  .update-flag {
    display: inline-block;
    font-size: 13px;
    font-weight: 900;
    border: 2px solid #000;
    padding: 2px 8px;
    margin-bottom: 6px;
  }
  .meta {
    font-size: 14px;
    font-weight: 900;
    line-height: 1.5;
    border-bottom: 2px solid #000;
    padding-bottom: 6px;
    margin-bottom: 8px;
  }
  .meta-row {
    display: table;
    width: 100%;
  }
  .meta-label, .meta-val {
    display: table-cell;
    padding: 1px 0;
    font-weight: 900;
  }
  .meta-val {
    text-align: right;
  }
  table { 
    width: 100%; 
    border-collapse: collapse; 
    margin-bottom: 8px; 
  }
  td { 
    font-size: 16px; 
    font-weight: 900; 
    padding: 4px 0; 
    vertical-align: top; 
    color: #000000;
  }
  td.qty { 
    width: 35px; 
  } 
  td.name { 
    font-weight: 900; 
  }
  .desc { 
    font-size: 12px; 
    font-weight: 900; 
    color: #000000; 
    margin-top: 2px;
  }
  .note {
    font-size: 14px;
    font-weight: 900;
    border-top: 2px dashed #000;
    border-bottom: 2px dashed #000;
    padding: 6px 0;
    margin-top: 6px;
    margin-bottom: 6px;
  }
  .footer {
    text-align: center;
    font-size: 12px;
    font-weight: 900;
    border-top: 1px solid #000;
    margin-top: 10px;
    padding-top: 6px;
  }
</style>
</head>
<body>
  <div class="center">
    ${isUpdate ? '<div class="update-flag">*** UPDATED ORDER ***</div><br/>' : ''}
    <h1>KITCHEN TICKET</h1>
  </div>
  <div class="meta">
    <div class="meta-row"><span class="meta-label">Table:</span><span class="meta-val">${escapeHtml(order.tableNumber)}</span></div>
    <div class="meta-row"><span class="meta-label">Customer:</span><span class="meta-val">${escapeHtml(order.customerName)}</span></div>
    <div class="meta-row"><span class="meta-label">Order #:</span><span class="meta-val">${escapeHtml(order._id.slice(-6).toUpperCase())}</span></div>
    <div class="meta-row"><span class="meta-label">Placed:</span><span class="meta-val">${escapeHtml(formatTicketDateTime(order.createdAt))}</span></div>
  </div>
  <table>
    <tbody>
      ${itemRows}
    </tbody>
  </table>
  ${
    order.orderNote
      ? `<div class="note"><strong>NOTE:</strong> ${escapeHtml(order.orderNote)}</div>`
      : ''
  }
  <div class="footer">Printed: ${escapeHtml(formatTicketDateTime(new Date().toISOString()))}</div>
</body>
</html>`;
}

// Prints via a hidden iframe rather than window.open, so no new tab/window
// ever appears — the ticket just goes straight to the print dialog/printer.
function autoPrintOrder(order: Order, isUpdate: boolean = false) {
  const iframe = document.createElement('iframe');
  iframe.style.position = 'fixed';
  iframe.style.right = '0';
  iframe.style.bottom = '0';
  iframe.style.width = '0';
  iframe.style.height = '0';
  iframe.style.border = '0';
  iframe.setAttribute('aria-hidden', 'true');
  document.body.appendChild(iframe);

  const doc = iframe.contentWindow?.document;
  if (!doc) {
    document.body.removeChild(iframe);
    return;
  }

  doc.open();
  doc.write(buildTicketHtml(order, isUpdate));
  doc.close();

  const cleanup = () => {
    window.setTimeout(() => {
      if (iframe.parentNode) iframe.parentNode.removeChild(iframe);
    }, 1000);
  };

  // Give the iframe a tick to lay out the doc before invoking print.
  const win = iframe.contentWindow;
  if (win) {
    win.onafterprint = cleanup;
    window.setTimeout(() => {
      try {
        win.focus();
        win.print();
      } catch {
        cleanup();
      }
      // Fallback cleanup in case onafterprint never fires (some browsers).
      window.setTimeout(cleanup, 5000);
    }, 250);
  } else {
    cleanup();
  }
}

// ==========================================
// TICKET CARD
// ==========================================

function TicketCard({
  order,
  now,
  onAdvance,
  onReprint,
  isUpdating,
}: {
  order: Order;
  now: number;
  onAdvance: (order: Order, next: OrderStatus) => void;
  onReprint: (order: Order) => void;
  isUpdating: boolean;
}) {
  const lane = LANES.find((l) => l.status === order.orderStatus);
  const styles = LANE_STYLES[order.orderStatus] || LANE_STYLES.Pending;
  const age = minutesSince(order.updatedAt || order.createdAt, now);
  const isHot = age >= CRITICAL_AFTER_MIN;
  const itemCount = (order.items || []).reduce((sum, i) => sum + (i.quantity || 0), 0);

  return (
    <div
      className={`group relative rounded-2xl bg-white border border-gray-200 ${styles.glow} p-4 flex flex-col gap-3 transition-all shadow-sm ${
        isHot ? 'ring-2 ring-red-400' : ''
      }`}
    >
      {isHot && (
        <div className="absolute -top-2 -right-2 flex items-center gap-1 bg-red-500 text-white text-[10px] font-bold px-2 py-1 rounded-full uppercase tracking-wide shadow">
          <AlertTriangle className="h-3 w-3" />
          Running late
        </div>
      )}

      {/* Ticket header: table + elapsed time + reprint */}
      <div className="flex items-start justify-between">
        <div>
          <p className="font-mono text-[11px] uppercase tracking-widest text-gray-400">
            Table
          </p>
          <p className="font-mono text-2xl font-bold text-gray-900 leading-none mt-0.5">
            {order.tableNumber}
          </p>
        </div>
        <div className="flex items-start gap-2">
          <div className="text-right">
            <p className="font-mono text-[11px] uppercase tracking-widest text-gray-400">
              Fired
            </p>
            <p className={`font-mono text-lg font-bold leading-none mt-0.5 ${ageClass(age)}`}>
              {formatElapsed(age)}
            </p>
          </div>
          <button
            onClick={() => onReprint(order)}
            className="p-1.5 bg-gray-50 hover:bg-gray-100 border border-gray-200 rounded-lg text-gray-500 hover:text-gray-900 transition-colors"
            title="Print ticket again"
          >
            <Printer className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {/* Customer name + item count chip */}
      <div className="flex items-center justify-between border-t border-gray-100 pt-2.5">
        <p className="text-sm font-semibold text-gray-800 truncate pr-2">
          {order.customerName}
        </p>
        <span className="shrink-0 font-mono text-[11px] font-bold text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full">
          {itemCount} item{itemCount !== 1 ? 's' : ''}
        </span>
      </div>

      {/* Items — the part that gets scanned fastest, so it's the biggest text on the card */}
      <div className="flex-1 space-y-1.5">
        {(order.items || []).map((item, idx) => (
          <div key={idx} className="flex items-baseline gap-2">
            <span className="font-mono text-base font-bold text-gray-900 shrink-0 w-6 text-right">
              {item.quantity}×
            </span>
            <span className="text-base font-medium text-gray-800 leading-tight">
              {item.itemName}
            </span>
          </div>
        ))}
      </div>

      {order.orderNote && (
        <div className="text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-2.5 py-1.5 flex items-start gap-1.5">
          <Bell className="h-3.5 w-3.5 text-amber-500 shrink-0 mt-0.5" />
          <span>{order.orderNote}</span>
        </div>
      )}

      {/* Advance button — one tap moves the ticket to the next lane */}
      {lane?.next && (
        <button
          onClick={() => onAdvance(order, lane.next as OrderStatus)}
          disabled={isUpdating}
          className={`mt-1 w-full py-3 rounded-xl font-bold text-sm uppercase tracking-wide transition-colors flex items-center justify-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed ${
            order.orderStatus === 'Pending'
              ? 'bg-sky-500 hover:bg-sky-600 text-white'
              : order.orderStatus === 'Preparing'
              ? 'bg-emerald-500 hover:bg-emerald-600 text-white'
              : 'bg-gray-900 hover:bg-gray-800 text-white'
          }`}
        >
          {isUpdating ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : order.orderStatus === 'Pending' ? (
            <Flame className="h-4 w-4" />
          ) : order.orderStatus === 'Preparing' ? (
            <ChefHat className="h-4 w-4" />
          ) : (
            <Bell className="h-4 w-4" />
          )}
          {order.orderStatus === 'Pending'
            ? 'Start cooking'
            : order.orderStatus === 'Preparing'
            ? 'Mark ready'
            : 'Mark served'}
        </button>
      )}
    </div>
  );
}

// ==========================================
// LANE COLUMN
// ==========================================

function LaneColumn({
  status,
  label,
  orders,
  now,
  onAdvance,
  onReprint,
  updatingId,
}: {
  status: OrderStatus;
  label: string;
  orders: Order[];
  now: number;
  onAdvance: (order: Order, next: OrderStatus) => void;
  onReprint: (order: Order) => void;
  updatingId: string | null;
}) {
  const styles = LANE_STYLES[status];
  const hotCount = orders.filter(
    (o) => minutesSince(o.updatedAt || o.createdAt, now) >= CRITICAL_AFTER_MIN
  ).length;

  return (
    <div className="flex flex-col min-w-0 h-full">
      <div className="flex items-center justify-between px-1 pb-3">
        <div className="flex items-center gap-2">
          <span className={`h-2.5 w-2.5 rounded-full ${styles.accent.replace('text-', 'bg-')}`} />
          <h2 className={`font-mono text-xs font-bold uppercase tracking-widest ${styles.accent}`}>
            {label}
          </h2>
          <span className="font-mono text-xs font-bold text-gray-500 bg-gray-100 rounded-full px-2 py-0.5">
            {orders.length}
          </span>
        </div>
        {hotCount > 0 && (
          <span className="flex items-center gap-1 text-[10px] font-bold text-red-500">
            <AlertTriangle className="h-3 w-3" />
            {hotCount}
          </span>
        )}
      </div>

      <div className="flex-1 space-y-3 overflow-y-auto pr-1 pb-4">
        {orders.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-gray-300 py-12 text-center">
            <p className="text-xs font-medium text-gray-400">Nothing here</p>
          </div>
        ) : (
          orders.map((order) => (
            <TicketCard
              key={order._id}
              order={order}
              now={now}
              onAdvance={onAdvance}
              onReprint={onReprint}
              isUpdating={updatingId === order._id}
            />
          ))
        )}
      </div>
    </div>
  );
}

// ==========================================
// MAIN DISPLAY
// ==========================================

export default function KitchenDisplay() {
  const restaurantId = getLoggedInRestaurantId();

  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [now, setNow] = useState(Date.now());
  const [flash, setFlash] = useState<string | null>(null);

  const knownIds = useRef<Set<string>>(new Set());
  const isFirstLoad = useRef(true);
  // Separate from knownIds — tracks which order _ids have already been sent
  // to the printer, so a ticket is never auto-printed twice across polls
  // even if it lingers in the Pending lane for several fetch cycles.
  const printedIds = useRef<Set<string>>(new Set());
  // Tracks the items-signature we last printed for each order, so we can
  // tell when an already-seen order comes back from a poll with new/changed
  // items (i.e. it was edited via the Orders page) and print an update
  // ticket for just the delta — without reprinting on every unrelated poll.
  const printedSignatures = useRef<Map<string, string>>(new Map());

  // Tick every 15s so elapsed-time counters and the "running late" ring stay live
  // without re-rendering the whole board every second.
  useEffect(() => {
    const t = window.setInterval(() => setNow(Date.now()), 15000);
    return () => window.clearInterval(t);
  }, []);

  const fetchOrders = useCallback(async () => {
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

      const kitchenOrders: Order[] = (result.data || []).filter((o: Order) =>
        ['Pending', 'Preparing', 'Ready'].includes(o.orderStatus)
      );

      if (!isFirstLoad.current) {
        // Brand-new tickets that have never been seen before at all.
        const newPendingTickets = kitchenOrders.filter(
          (o) => o.orderStatus === 'Pending' && !knownIds.current.has(o._id)
        );

        // Tickets we HAVE seen before, but whose item list changed since the
        // last time we printed them — this is the "order was edited and new
        // items were added" case from the Orders page.
        const updatedTickets = kitchenOrders.filter((o) => {
          if (!knownIds.current.has(o._id)) return false; // handled above as "new"
          const lastSig = printedSignatures.current.get(o._id);
          const currentSig = itemsSignature(o);
          return lastSig !== undefined && lastSig !== currentSig;
        });

        if (newPendingTickets.length > 0 || updatedTickets.length > 0) {
          if (newPendingTickets.length > 0) {
            const first = newPendingTickets[0];
            setFlash(
              newPendingTickets.length === 1
                ? `New order — Table ${first.tableNumber}`
                : `${newPendingTickets.length} new orders`
            );
          } else if (updatedTickets.length > 0) {
            const first = updatedTickets[0];
            setFlash(
              updatedTickets.length === 1
                ? `Order updated — Table ${first.tableNumber}`
                : `${updatedTickets.length} orders updated`
            );
          }
          window.setTimeout(() => setFlash(null), 4000);

          newPendingTickets.forEach((ticket) => {
            if (!printedIds.current.has(ticket._id)) {
              printedIds.current.add(ticket._id);
              printedSignatures.current.set(ticket._id, itemsSignature(ticket));
              autoPrintOrder(ticket, false);
            }
          });

          updatedTickets.forEach((ticket) => {
            printedSignatures.current.set(ticket._id, itemsSignature(ticket));
            autoPrintOrder(ticket, true);
          });
        }
      } else {
        // On the very first load of the board, don't mass-print every ticket
        // that was already sitting there — only mark them as seen/printed so
        // future genuinely-new tickets or edits trigger the printer correctly.
        kitchenOrders.forEach((o) => {
          printedIds.current.add(o._id);
          printedSignatures.current.set(o._id, itemsSignature(o));
        });
      }

      knownIds.current = new Set(kitchenOrders.map((o) => o._id));
      isFirstLoad.current = false;

      setOrders(kitchenOrders);
    } catch (err: any) {
      setError(err.message || 'Could not connect to the server.');
    } finally {
      setLoading(false);
    }
  }, [restaurantId]);

  useEffect(() => {
    fetchOrders();
    const poll = window.setInterval(fetchOrders, POLL_MS);
    return () => window.clearInterval(poll);
  }, [fetchOrders]);

  // Manual reprint — always available from each ticket card, doesn't touch
  // printedIds/printedSignatures bookkeeping since it's user-initiated, not
  // part of the new/updated detection.
  const reprintOrder = useCallback((order: Order) => {
    autoPrintOrder(order, false);
  }, []);

  // Advancing a ticket sends the full order payload, same shape the existing
  // Orders page uses, so the backend's findByIdAndUpdate + runValidators pass.
  const advanceOrder = async (order: Order, newStatus: OrderStatus) => {
    setUpdatingId(order._id);

    // Optimistic update: Served tickets should feel like they leave the pass
    // instantly, not after a round trip.
    const prevOrders = orders;
    if (newStatus === 'Served') {
      setOrders((prev) => prev.filter((o) => o._id !== order._id));
    } else {
      setOrders((prev) =>
        prev.map((o) => (o._id === order._id ? { ...o, orderStatus: newStatus } : o))
      );
    }

    try {
      const res = await fetch(`${ORDERS_URL}/${order._id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          restaurantId: order.restaurantId,
          customerName: order.customerName,
          tableNumber: order.tableNumber,
          orderNote: order.orderNote,
          items: order.items,
          totalAmount: order.totalAmount,
          orderStatus: newStatus,
          paymentStatus: order.paymentStatus,
        }),
      });
      const data = await res.json();

      if (!res.ok || !data?.success) {
        // Roll back on failure so the board reflects reality, not the tap.
        setOrders(prevOrders);
        setError(data?.message || 'Failed to update order.');
        window.setTimeout(() => setError(''), 4000);
      }
    } catch (err) {
      setOrders(prevOrders);
      setError('Could not reach the server. Please try again.');
      window.setTimeout(() => setError(''), 4000);
    } finally {
      setUpdatingId(null);
    }
  };

  const ordersByLane = useMemo(() => {
    const grouped: Record<string, Order[]> = { Pending: [], Preparing: [], Ready: [] };
    for (const o of orders) {
      if (grouped[o.orderStatus]) grouped[o.orderStatus].push(o);
    }
    // Oldest first within each lane — the ticket that's waited longest sits
    // at the top, where it should get picked up first.
    for (const key of Object.keys(grouped)) {
      grouped[key].sort(
        (a, b) =>
          new Date(a.createdAt || 0).getTime() - new Date(b.createdAt || 0).getTime()
      );
    }
    return grouped;
  }, [orders]);

  return (
    <div className="h-screen bg-[#f8fafc] flex flex-col overflow-hidden" id="kitchen-display-root">
      {/* New-ticket flash banner */}
      {flash && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 bg-sky-500 text-white text-sm font-bold px-4 py-2.5 rounded-full shadow-lg animate-bounce">
          <Bell className="h-4 w-4" />
          {flash}
        </div>
      )}

      {/* Error banner */}
      {error && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 bg-red-500 text-white text-sm font-bold px-4 py-2.5 rounded-full shadow-lg">
          <AlertTriangle className="h-4 w-4" />
          {error}
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 bg-white shrink-0">
        <div className="flex items-center gap-3">
          <div className="h-9 w-9 rounded-xl bg-gray-50 border border-gray-200 flex items-center justify-center">
            <ChefHat className="h-5 w-5 text-gray-500" />
          </div>
          <div>
            <h1 className="font-mono text-sm font-bold text-gray-900 uppercase tracking-widest">
              Kitchen Display
            </h1>
            <p className="text-[11px] text-gray-400">
              {orders.length} active ticket{orders.length !== 1 ? 's' : ''}
            </p>
          </div>
        </div>
        <button
          onClick={fetchOrders}
          className="p-2.5 bg-white hover:bg-gray-50 border border-gray-200 rounded-xl text-gray-500 hover:text-gray-900 transition-colors shadow-sm"
          title="Refresh"
        >
          <RefreshCw className="h-4 w-4" />
        </button>
      </div>

      {/* Board */}
      {loading ? (
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center space-y-2">
            <Loader2 className="h-8 w-8 mx-auto animate-spin text-gray-400" />
            <p className="text-sm font-medium text-gray-500">Loading tickets...</p>
          </div>
        </div>
      ) : (
        <div className="flex-1 grid grid-cols-3 gap-6 px-6 pt-4 min-h-0">
          {LANES.map((lane) => (
            <LaneColumn
              key={lane.status}
              status={lane.status}
              label={lane.label}
              orders={ordersByLane[lane.status] || []}
              now={now}
              onAdvance={advanceOrder}
              onReprint={reprintOrder}
              updatingId={updatingId}
            />
          ))}
        </div>
      )}
    </div>
  );
}