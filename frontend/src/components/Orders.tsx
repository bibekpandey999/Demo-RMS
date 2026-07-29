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
  Pencil,
  Plus,
  Minus,
  Trash2,
  X,
  ShoppingCart,
  Utensils,
} from 'lucide-react';

// ==========================================
// CONFIG
// ==========================================

const API_BASE = import.meta.env.VITE_API_URL || 'https://rms-0wk0.onrender.com';
const ORDERS_URL = `${API_BASE}/api/orders`;
const MENU_URL = `${API_BASE}/api/menu`;

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
// Served/Cancel/Edit action buttons anymore, just a status line instead.
const FINISHED_STATUSES = ['Served', 'Completed', 'Cancelled'];

// Footer text shown for each finished status. Anything not in this map
// falls back to a generic "Order finished" instead of silently defaulting
// to "cancelled" like before.
const FINISHED_LABELS = {
  Served: 'Order served',
  Completed: 'Order completed',
  Cancelled: 'Order cancelled',
};

const mapRawToMenuItem = (raw) => ({
  id: raw._id,
  name: raw.itemName || raw.name || 'Unnamed Item',
  description: raw.description || '',
  category: raw.category || 'General',
  price: Number(raw.price ?? raw.itemPrice) || 0,
  available: raw.available !== false,
});

export default function OrdersPage() {
  const restaurantId = getLoggedInRestaurantId();

  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState('All');
  const [updatingId, setUpdatingId] = useState(null);
  const [toast, setToast] = useState(null);

  // ==========================================
  // EDIT / ADD-ITEMS MODAL STATE
  // ==========================================
  const [editingOrder, setEditingOrder] = useState(null); // the order object being edited, or null
  const [editCart, setEditCart] = useState([]); // working copy of items while editing
  const [editNote, setEditNote] = useState('');
  const [menuItems, setMenuItems] = useState([]);
  const [menuLoading, setMenuLoading] = useState(false);
  const [menuError, setMenuError] = useState('');
  const [menuSearch, setMenuSearch] = useState('');
  const [isSavingEdit, setIsSavingEdit] = useState(false);
  const [showEditConfirm, setShowEditConfirm] = useState(false);
  const [editConfirmChecked, setEditConfirmChecked] = useState(false);

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
  // FETCH MENU (only when edit modal opens)
  // ==========================================
  const fetchMenu = async () => {
    setMenuLoading(true);
    setMenuError('');
    try {
      const url = restaurantId
        ? `${MENU_URL}?restaurantId=${encodeURIComponent(restaurantId)}`
        : MENU_URL;
      const res = await fetch(url);
      const result = await res.json();
      if (!res.ok || !result.success) {
        throw new Error(result.message || 'Failed to load menu.');
      }
      setMenuItems((result.data || []).map(mapRawToMenuItem));
    } catch (err) {
      setMenuError(err.message || 'Could not connect to the server.');
    } finally {
      setMenuLoading(false);
    }
  };

  // ==========================================
  // OPEN EDIT MODAL — seed the working cart from the existing order's items
  // ==========================================
  const openEditModal = (order) => {
    setEditingOrder(order);
    setEditCart(
      (order.items || []).map((item, idx) => ({
        // existing lines don't have a menuItemId, so key on index + name
        lineKey: `existing-${idx}-${item.itemName}`,
        menuItemId: null,
        name: item.itemName,
        description: item.description || '',
        unitPrice: Number(item.itemPrice) || 0,
        quantity: Number(item.quantity) || 1,
      }))
    );
    setEditNote(order.orderNote || '');
    setMenuSearch('');
    setEditConfirmChecked(false);
    setShowEditConfirm(false);
    fetchMenu();
  };

  const closeEditModal = () => {
    if (isSavingEdit) return;
    setEditingOrder(null);
    setEditCart([]);
    setEditNote('');
    setShowEditConfirm(false);
    setEditConfirmChecked(false);
  };

  const filteredEditMenu = useMemo(() => {
    const available = menuItems.filter((m) => m.available);
    if (!menuSearch.trim()) return available;
    const q = menuSearch.toLowerCase().trim();
    return available.filter(
      (m) => m.name.toLowerCase().includes(q) || m.category.toLowerCase().includes(q)
    );
  }, [menuSearch, menuItems]);

  // Adding from the menu grid: if that menu item is already a line
  // (matched by menuItemId), bump its quantity instead of duplicating.
  const addMenuItemToEditCart = (item) => {
    setEditCart((prev) => {
      const existingIndex = prev.findIndex((line) => line.menuItemId === item.id);
      if (existingIndex > -1) {
        const updated = [...prev];
        updated[existingIndex] = {
          ...updated[existingIndex],
          quantity: updated[existingIndex].quantity + 1,
        };
        return updated;
      }
      return [
        ...prev,
        {
          lineKey: `new-${item.id}`,
          menuItemId: item.id,
          name: item.name,
          description: item.description,
          unitPrice: item.price,
          quantity: 1,
        },
      ];
    });
  };

  const updateEditQuantity = (lineKey, delta) => {
    setEditCart((prev) =>
      prev
        .map((line) => {
          if (line.lineKey !== lineKey) return line;
          const nextQty = line.quantity + delta;
          if (nextQty <= 0) return null;
          return { ...line, quantity: nextQty };
        })
        .filter(Boolean)
    );
  };

  const removeEditLine = (lineKey) => {
    setEditCart((prev) => prev.filter((line) => line.lineKey !== lineKey));
  };

  const editCartTotal = editCart.reduce((sum, line) => sum + line.unitPrice * line.quantity, 0);
  const editItemsCount = editCart.reduce((sum, line) => sum + line.quantity, 0);

  const handleReviewEdit = () => {
    if (editCart.length === 0) {
      showToast('Order must have at least one item.', 'error');
      return;
    }
    setEditConfirmChecked(false);
    setShowEditConfirm(true);
  };

  // ==========================================
  // SAVE EDIT — PUT the merged items back onto the same order
  // ==========================================
  const saveEditedOrder = async () => {
    if (!editingOrder) return;
    setIsSavingEdit(true);
    try {
      const res = await fetch(`${ORDERS_URL}/${editingOrder._id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          restaurantId: editingOrder.restaurantId,
          customerName: editingOrder.customerName,
          tableNumber: editingOrder.tableNumber,
          orderNote: editNote.trim(),
          items: editCart.map((line) => ({
            itemName: line.name,
            description: line.description,
            itemPrice: line.unitPrice,
            quantity: line.quantity,
          })),
          totalAmount: editCartTotal,
          orderStatus: editingOrder.orderStatus,
          paymentStatus: editingOrder.paymentStatus,
        }),
      });
      const data = await res.json();

      if (res.ok && data?.success) {
        setOrders((prev) =>
          prev.map((o) => (o._id === editingOrder._id ? data.data : o))
        );
        showToast('Order updated successfully.', 'success');
        setEditingOrder(null);
        setEditCart([]);
        setEditNote('');
        setShowEditConfirm(false);
        setEditConfirmChecked(false);
      } else {
        showToast(data?.message || 'Failed to update order.', 'error');
      }
    } catch (err) {
      console.error('🔴 Order edit failed:', err);
      showToast('Could not reach the server. Please try again.', 'error');
    } finally {
      setIsSavingEdit(false);
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
                  <div className="flex items-center gap-1.5">
                    {isActive && (
                      <button
                        onClick={() => openEditModal(order)}
                        disabled={isUpdating}
                        className="p-1.5 bg-gray-50 hover:bg-gray-100 border border-gray-200 rounded-lg text-gray-500 hover:text-gray-900 transition-colors disabled:opacity-50"
                        title="Add items / edit order"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                    )}
                    <span
                      className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                        STATUS_STYLES[order.orderStatus] || 'bg-gray-50 text-gray-600 border-gray-200'
                      }`}
                    >
                      {order.orderStatus}
                    </span>
                  </div>
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

      {/* ==========================================
          EDIT / ADD-ITEMS MODAL
          Same menu-grid + cart pattern as CreateOrder, seeded with the
          existing order's items so the customer's original order stays
          intact and new items just get appended to the same list.
      ========================================== */}
      {editingOrder && (
        <div className="fixed inset-0 bg-gray-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="bg-white rounded-2xl max-w-4xl w-full max-h-[90vh] flex flex-col shadow-2xl border border-gray-100">
            {/* Modal header */}
            <div className="flex justify-between items-center border-b border-gray-100 px-5 py-4 shrink-0">
              <div>
                <h2 className="text-sm font-bold text-gray-900 flex items-center gap-2">
                  <ShoppingCart className="h-4.5 w-4.5 text-teal-600" />
                  Edit Order — {editingOrder.customerName}
                </h2>
                <p className="text-[11px] text-gray-500 mt-0.5">
                  Table {editingOrder.tableNumber} · Add more items below
                </p>
              </div>
              <button
                onClick={closeEditModal}
                disabled={isSavingEdit}
                className="p-1 text-gray-400 hover:text-gray-950"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 p-5 overflow-y-auto">
              {/* LEFT: current cart for this order */}
              <div className="lg:col-span-5 flex flex-col space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">
                    Order Items
                  </span>
                  <span className="bg-teal-50 text-teal-700 px-2 py-0.5 rounded-full text-[10px] font-bold font-mono">
                    {editItemsCount} items
                  </span>
                </div>

                <div>
                  <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block mb-1">
                    Order Note
                  </label>
                  <textarea
                    value={editNote}
                    onChange={(e) => setEditNote(e.target.value)}
                    placeholder="e.g. No onions, extra spicy, allergy notes..."
                    rows={2}
                    className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-xs focus:outline-hidden resize-none"
                  />
                </div>

                <div className="flex-1 overflow-y-auto max-h-[320px] min-h-[140px] space-y-2 pr-1">
                  {editCart.length === 0 ? (
                    <div className="text-center py-10 space-y-2 text-gray-400">
                      <ShoppingCart className="h-8 w-8 mx-auto stroke-1" />
                      <p className="text-xs">No items in this order.</p>
                    </div>
                  ) : (
                    editCart.map((line) => (
                      <div
                        key={line.lineKey}
                        className="p-3 bg-white border border-gray-200 rounded-lg flex items-center justify-between text-xs hover:border-teal-100 transition-all shadow-xs"
                      >
                        <div className="space-y-0.5 max-w-[140px]">
                          <p className="font-bold text-gray-900 leading-tight">{line.name}</p>
                          <p className="text-[10px] font-mono text-teal-600 font-semibold">
                            NPR {line.unitPrice.toFixed(2)} each
                          </p>
                        </div>

                        <div className="flex items-center gap-2">
                          <div className="flex items-center border border-gray-200 rounded-md bg-gray-50">
                            <button
                              type="button"
                              onClick={() => updateEditQuantity(line.lineKey, -1)}
                              className="p-1 hover:bg-gray-100 text-gray-500 hover:text-gray-900"
                            >
                              <Minus className="h-3 w-3" />
                            </button>
                            <span className="px-2 font-mono font-bold text-gray-900 text-xs bg-white min-w-[20px] text-center">
                              {line.quantity}
                            </span>
                            <button
                              type="button"
                              onClick={() => updateEditQuantity(line.lineKey, 1)}
                              className="p-1 hover:bg-gray-100 text-gray-500 hover:text-gray-900"
                            >
                              <Plus className="h-3 w-3" />
                            </button>
                          </div>

                          <button
                            type="button"
                            onClick={() => removeEditLine(line.lineKey)}
                            className="p-1 text-gray-400 hover:text-red-500 rounded hover:bg-gray-50"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>

                        <div className="text-right min-w-[65px]">
                          <div className="font-mono font-bold text-gray-900">
                            NPR {(line.unitPrice * line.quantity).toFixed(2)}
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>

                <div className="border-t border-gray-100 pt-3">
                  <div className="flex justify-between text-sm text-gray-900 font-bold">
                    <span>Order Total</span>
                    <span className="font-mono text-teal-700 text-base">
                      NPR {editCartTotal.toLocaleString('en-NP', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </span>
                  </div>
                </div>

                <button
                  onClick={handleReviewEdit}
                  disabled={editCart.length === 0 || isSavingEdit}
                  className="w-full py-2.5 bg-teal-600 hover:bg-teal-700 disabled:bg-gray-100 disabled:text-gray-400 disabled:cursor-not-allowed text-white text-xs font-bold rounded-xl shadow-xs transition-colors flex items-center justify-center gap-2"
                >
                  <CheckCircle className="h-4 w-4" />
                  Review & Save Changes
                </button>
              </div>

              {/* RIGHT: menu grid to add more items */}
              <div className="lg:col-span-7 flex flex-col space-y-3">
                <div className="relative">
                  <Search className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
                  <input
                    type="text"
                    value={menuSearch}
                    onChange={(e) => setMenuSearch(e.target.value)}
                    placeholder="Search menu items to add..."
                    className="w-full pl-9 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-lg text-xs placeholder-gray-400 focus:outline-hidden"
                  />
                </div>

                <div className="flex-1 overflow-y-auto max-h-[420px] grid grid-cols-1 sm:grid-cols-2 auto-rows-min content-start gap-3 pr-1">
                  {menuLoading ? (
                    <div className="col-span-2 text-center py-16 text-gray-400 space-y-2">
                      <Loader2 className="h-7 w-7 mx-auto animate-spin" />
                      <p className="text-xs font-medium">Loading menu...</p>
                    </div>
                  ) : menuError ? (
                    <div className="col-span-2 text-center py-16 text-red-500 space-y-2">
                      <PackageX className="h-7 w-7 mx-auto" />
                      <p className="text-xs font-medium">{menuError}</p>
                      <button onClick={fetchMenu} className="text-teal-600 font-bold text-xs underline">
                        Retry
                      </button>
                    </div>
                  ) : filteredEditMenu.length === 0 ? (
                    <div className="col-span-2 text-center py-16 text-gray-400 space-y-2">
                      <Utensils className="h-9 w-9 mx-auto stroke-1" />
                      <p className="text-xs font-medium">No items match your search.</p>
                    </div>
                  ) : (
                    filteredEditMenu.map((item) => {
                      const inCartLine = editCart.find((l) => l.menuItemId === item.id);
                      return (
                        <button
                          key={item.id}
                          onClick={() => addMenuItemToEditCart(item)}
                          className={`p-3 text-left border rounded-xl flex flex-col justify-between transition-all group ${
                            inCartLine
                              ? 'bg-teal-50/20 border-teal-300 ring-1 ring-teal-200'
                              : 'bg-white border-gray-200 hover:border-gray-300 shadow-2xs hover:shadow-xs'
                          }`}
                        >
                          <div className="space-y-1 w-full">
                            <div className="flex justify-between items-start">
                              <span className="font-bold text-gray-900 group-hover:text-teal-700 transition-colors text-xs truncate max-w-[150px]">
                                {item.name}
                              </span>
                              <span className="text-[9px] text-gray-400 bg-gray-100 px-1 rounded font-mono font-medium">
                                {item.category}
                              </span>
                            </div>
                            {item.description && (
                              <p className="text-[10px] text-gray-500 line-clamp-2">{item.description}</p>
                            )}
                          </div>

                          <div className="flex justify-between items-end mt-3 border-t border-gray-50 pt-2 w-full">
                            <span className="font-mono font-bold text-gray-900 text-xs">
                              NPR {item.price.toFixed(2)}
                            </span>
                            {inCartLine && (
                              <span className="px-1.5 py-0.5 bg-teal-100 text-teal-700 text-[9px] font-bold rounded">
                                {inCartLine.quantity} in order
                              </span>
                            )}
                          </div>
                        </button>
                      );
                    })
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ==========================================
          EDIT CONFIRMATION SUB-MODAL — mirrors CreateOrder's
          "Are you sure?" checkbox-gated confirm step, but for saving
          an update to an existing order instead of creating a new one.
      ========================================== */}
      {showEditConfirm && editingOrder && (
        <div className="fixed inset-0 bg-gray-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-[55] animate-fade-in">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 space-y-5 shadow-2xl border border-gray-100">
            <div className="flex justify-between items-center border-b border-gray-100 pb-3">
              <span className="font-bold text-gray-900 flex items-center gap-1.5 text-sm">
                <AlertCircle className="h-5 w-5 text-amber-500" />
                Confirm Order Update
              </span>
              <button
                onClick={() => setShowEditConfirm(false)}
                className="p-1 text-gray-400 hover:text-gray-950"
                disabled={isSavingEdit}
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-2 text-xs text-gray-700">
              <div className="flex justify-between">
                <span className="text-gray-500">Customer</span>
                <span className="font-bold">{editingOrder.customerName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Table</span>
                <span className="font-bold">{editingOrder.tableNumber}</span>
              </div>
              {editNote.trim() && (
                <div className="flex justify-between gap-2">
                  <span className="text-gray-500 shrink-0">Note</span>
                  <span className="font-medium text-right">{editNote.trim()}</span>
                </div>
              )}
              <div className="border-t border-gray-100 pt-2 space-y-1 max-h-40 overflow-y-auto">
                {editCart.map((line) => (
                  <div key={line.lineKey} className="flex justify-between items-center">
                    <span>
                      {line.quantity} × {line.name}{' '}
                      <span className="text-gray-400 font-mono text-[10px]">
                        (NPR {line.unitPrice.toFixed(2)} ea)
                      </span>
                    </span>
                    <span className="font-mono">
                      NPR {(line.unitPrice * line.quantity).toFixed(2)}
                    </span>
                  </div>
                ))}
              </div>
              <div className="flex justify-between border-t border-gray-200 pt-2 text-sm font-bold text-gray-900">
                <span>Total</span>
                <span className="font-mono text-teal-700">NPR {editCartTotal.toFixed(2)}</span>
              </div>
            </div>

            <label className="flex items-start gap-2 p-3 bg-amber-50 border border-amber-200 rounded-lg cursor-pointer">
              <input
                type="checkbox"
                checked={editConfirmChecked}
                onChange={(e) => setEditConfirmChecked(e.target.checked)}
                className="mt-0.5"
              />
              <span className="text-xs text-amber-800 font-medium">
                I confirm the updated items, customer name, and table number above are correct and want to save this order.
              </span>
            </label>

            <div className="flex justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setShowEditConfirm(false)}
                disabled={isSavingEdit}
                className="px-5 py-2 bg-gray-100 hover:bg-gray-200 text-gray-800 text-xs font-bold uppercase tracking-wider rounded-lg transition-colors border border-gray-200"
              >
                Back
              </button>
              <button
                type="button"
                onClick={saveEditedOrder}
                disabled={!editConfirmChecked || isSavingEdit}
                className="px-6 py-2 bg-teal-600 hover:bg-teal-700 disabled:bg-gray-200 disabled:text-gray-400 disabled:cursor-not-allowed text-white text-xs font-bold uppercase tracking-wider rounded-lg transition-colors shadow-xs flex items-center gap-1.5"
              >
                {isSavingEdit ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <CheckCircle className="h-4 w-4" />
                    Confirm & Save
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}