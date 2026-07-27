import React, { useState, useEffect, useMemo } from 'react';
import {
  RefreshCw,
  CheckCircle,
  XCircle,
  Clock,
  Loader2,
  PackageX,
  AlertCircle,
  Search,
} from 'lucide-react';

// ==========================================
// CONFIG
// ==========================================

const API_BASE = import.meta.env.VITE_API_URL || 'https://rms-0wk0.onrender.com';
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

const STATUS_STYLES = {
  Pending: 'bg-amber-50 text-amber-700 border-amber-200',
  Preparing: 'bg-blue-50 text-blue-700 border-blue-200',
  Ready: 'bg-purple-50 text-purple-700 border-purple-200',
  Served: 'bg-teal-50 text-teal-700 border-teal-200',
  Completed: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  Cancelled: 'bg-red-50 text-red-700 border-red-200',
};

const PAYMENT_STYLES = {
  Unpaid: 'bg-gray-100 text-gray-600',
  Paid: 'bg-teal-100 text-teal-700',
  Refunded: 'bg-orange-100 text-orange-700',
};

// Statuses that are considered "finished" — these don't show the
// Served/Cancel action buttons anymore, just a status line instead.
const FINISHED_STATUSES = ['Served', 'Completed', 'Cancelled'];

// Footer text shown for each finished status. Anything not in this map
// falls back to a generic "Order finished" instead of silently defaulting
// to "cancelled" like before.
const FINISHED_LABELS = {
  Served: 'Order served',
  Completed: 'Order completed',
  Cancelled: 'Order cancelled',
};

export default function OrdersPage() {
  const restaurantId = getLoggedInRestaurantId();

  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState('All');
  const [updatingId, setUpdatingId] = useState(null);
  const [toast, setToast] = useState(null);

  const showToast = (message, type) => {
    setToast({ message, type });
    window.setTimeout(() => setToast(null), 3000);
  };

  // ==========================================
  // FETCH ORDERS
  // ==========================================
  const fetchOrders = async () => {
    setLoading(true);
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
      setOrders(result.data || []);
    } catch (err) {
      setError(err.message || 'Could not connect to the server.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOrders();
  }, []);

  // ==========================================
  // UPDATE STATUS (Served / Completed / Cancelled)
  // ==========================================
  const updateOrderStatus = async (order, newStatus) => {
    setUpdatingId(order._id);
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

      if (res.ok && data?.success) {
        setOrders((prev) =>
          prev.map((o) => (o._id === order._id ? { ...o, orderStatus: newStatus } : o))
        );
        showToast(
          newStatus === 'Served'
            ? 'Order marked as served.'
            : newStatus === 'Completed'
            ? 'Order marked as completed.'
            : 'Order cancelled.',
          'success'
        );
      } else {
        showToast(data?.message || 'Failed to update order.', 'error');
      }
    } catch (err) {
      console.error('🔴 Order update failed:', err);
      showToast('Could not reach the server. Please try again.', 'error');
    } finally {
      setUpdatingId(null);
    }
  };

  // ==========================================
  // FILTER + SEARCH
  // ==========================================
  const filteredOrders = useMemo(() => {
    let list = [...orders];

    if (filterStatus !== 'All') {
      list = list.filter((o) => o.orderStatus === filterStatus);
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      list = list.filter(
        (o) =>
          o.customerName?.toLowerCase().includes(q) ||
          o.tableNumber?.toLowerCase().includes(q)
      );
    }

    return list;
  }, [orders, filterStatus, searchQuery]);

  const statusCounts = useMemo(() => {
    const counts = { All: orders.length };
    orders.forEach((o) => {
      counts[o.orderStatus] = (counts[o.orderStatus] || 0) + 1;
    });
    return counts;
  }, [orders]);

  const filterTabs = ['All', 'Pending', 'Preparing', 'Ready', 'Served', 'Completed', 'Cancelled'];

  return (
    <div className="space-y-5" id="orders-page-root">
      {toast && (
        <div
          className={`fixed top-5 right-5 z-[60] flex items-center gap-2 px-4 py-3 rounded-lg shadow-lg text-xs font-bold text-white animate-fade-in ${
            toast.type === 'success' ? 'bg-teal-600' : 'bg-red-600'
          }`}
        >
          {toast.message}
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-lg font-bold text-gray-900 tracking-tight">Orders</h1>
          <p className="text-xs text-gray-500 mt-0.5">
            {orders.length} total order{orders.length !== 1 ? 's' : ''}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search customer or table..."
              className="pl-9 pr-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-xs placeholder-gray-400 focus:outline-hidden w-56"
            />
          </div>
          <button
            onClick={fetchOrders}
            className="p-2 bg-gray-50 hover:bg-gray-100 border border-gray-200 rounded-lg text-gray-500 hover:text-gray-900 transition-colors"
            title="Refresh"
          >
            <RefreshCw className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Status filter tabs */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1">
        {filterTabs.map((tab) => (
          <button
            key={tab}
            onClick={() => setFilterStatus(tab)}
            className={`px-3 py-1.5 rounded-full text-xs font-bold whitespace-nowrap border transition-colors ${
              filterStatus === tab
                ? 'bg-gray-900 text-white border-gray-900'
                : 'bg-white text-gray-500 border-gray-200 hover:border-gray-300'
            }`}
          >
            {tab}
            {statusCounts[tab] ? (
              <span className={`ml-1.5 ${filterStatus === tab ? 'text-gray-300' : 'text-gray-400'}`}>
                {statusCounts[tab]}
              </span>
            ) : null}
          </button>
        ))}
      </div>

      {/* Orders list */}
      {loading ? (
        <div className="text-center py-24 text-gray-400 space-y-2">
          <Loader2 className="h-8 w-8 mx-auto animate-spin" />
          <p className="text-sm font-medium">Loading orders...</p>
        </div>
      ) : error ? (
        <div className="text-center py-24 text-red-500 space-y-2">
          <PackageX className="h-8 w-8 mx-auto" />
          <p className="text-sm font-medium">{error}</p>
          <button onClick={fetchOrders} className="text-teal-600 font-bold text-xs underline">
            Retry
          </button>
        </div>
      ) : filteredOrders.length === 0 ? (
        <div className="text-center py-24 text-gray-400 space-y-2">
          <Clock className="h-10 w-10 mx-auto stroke-1" />
          <p className="text-sm font-medium">
            {orders.length === 0 ? 'No orders yet.' : 'No orders match your search.'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filteredOrders.map((order) => {
            const isActive = !FINISHED_STATUSES.includes(order.orderStatus);
            const isUpdating = updatingId === order._id;

            return (
              <div
                key={order._id}
                className="bg-white rounded-xl border border-gray-200 shadow-xs p-4 flex flex-col space-y-3"
              >
                {/* Card header */}
                <div className="flex justify-between items-start">
                  <div>
                    <p className="font-bold text-gray-900 text-sm">{order.customerName}</p>
                    <p className="text-[11px] text-gray-500">Table {order.tableNumber}</p>
                  </div>
                  <span
                    className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                      STATUS_STYLES[order.orderStatus] || 'bg-gray-50 text-gray-600 border-gray-200'
                    }`}
                  >
                    {order.orderStatus}
                  </span>
                </div>

                {/* Items */}
                <div className="space-y-1 border-t border-gray-50 pt-2.5 max-h-32 overflow-y-auto">
                  {(order.items || []).map((item, idx) => (
                    <div key={idx} className="flex justify-between text-xs">
                      <span className="text-gray-700">
                        {item.quantity} × {item.itemName}
                      </span>
                      <span className="font-mono text-gray-500">
                        NPR {(item.itemPrice * item.quantity).toFixed(2)}
                      </span>
                    </div>
                  ))}
                </div>

                {order.orderNote && (
                  <div className="text-[11px] text-gray-500 bg-gray-50 rounded-lg px-2.5 py-1.5 flex items-start gap-1.5">
                    <AlertCircle className="h-3.5 w-3.5 text-gray-400 shrink-0 mt-0.5" />
                    <span>{order.orderNote}</span>
                  </div>
                )}

                {/* Footer: total + payment */}
                <div className="flex justify-between items-center border-t border-gray-50 pt-2.5">
                  <span
                    className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                      PAYMENT_STYLES[order.paymentStatus] || 'bg-gray-100 text-gray-600'
                    }`}
                  >
                    {order.paymentStatus}
                  </span>
                  <span className="font-mono font-bold text-teal-700 text-sm">
                    NPR {Number(order.totalAmount).toFixed(2)}
                  </span>
                </div>

                {/* Actions */}
                {isActive ? (
                  <div className="flex gap-2 pt-1">
                    <button
                      onClick={() => updateOrderStatus(order, 'Served')}
                      disabled={isUpdating}
                      className="flex-1 py-2 bg-teal-600 hover:bg-teal-700 disabled:bg-gray-100 disabled:text-gray-400 text-white text-xs font-bold rounded-lg transition-colors flex items-center justify-center gap-1.5"
                    >
                      {isUpdating ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <CheckCircle className="h-3.5 w-3.5" />
                      )}
                      Served
                    </button>
                    <button
                      onClick={() => updateOrderStatus(order, 'Cancelled')}
                      disabled={isUpdating}
                      className="flex-1 py-2 bg-red-50 hover:bg-red-100 disabled:bg-gray-100 disabled:text-gray-400 text-red-700 text-xs font-bold rounded-lg transition-colors flex items-center justify-center gap-1.5 border border-red-100"
                    >
                      {isUpdating ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <XCircle className="h-3.5 w-3.5" />
                      )}
                      Cancel
                    </button>
                  </div>
                ) : (
                  <div className="text-center text-[11px] text-gray-400 pt-1">
                    {FINISHED_LABELS[order.orderStatus] || 'Order finished'}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}