import React, { useState, useEffect, useMemo } from 'react';
import {
  Search,
  ShoppingCart,
  Trash2,
  Plus,
  Minus,
  CheckCircle,
  X,
  AlertCircle,
  Loader2,
  PackageX,
  Utensils,
} from 'lucide-react';

// ==========================================
// CONFIG
// ==========================================

const API_BASE = import.meta.env.VITE_API_URL || 'https://rms-0wk0.onrender.com';
const MENU_URL = `${API_BASE}/api/menu`;       // <-- adjust to your actual menu-items endpoint
const ORDERS_URL = `${API_BASE}/api/orders`;   // matches your index.js routes

// Reads the logged-in restaurant's ID from localStorage, same pattern the
// pharmacy version used. Adjust the key/shape if your restaurant login
// response differs.
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

// ==========================================
// TYPES (JSDoc only, no TS needed here)
// ==========================================

/**
 * @typedef {Object} MenuItem
 * @property {string} id
 * @property {string} name
 * @property {string} description
 * @property {string} category
 * @property {number} price
 * @property {boolean} available
 */

/**
 * @typedef {Object} CartLine
 * @property {string} menuItemId
 * @property {string} name
 * @property {string} description
 * @property {number} unitPrice
 * @property {number} quantity
 */

const mapRawToMenuItem = (raw) => ({
  id: raw._id,
  name: raw.itemName || raw.name || 'Unnamed Item',
  description: raw.description || '',
  category: raw.category || 'General',
  price: Number(raw.price ?? raw.itemPrice) || 0,
  available: raw.available !== false,
});

export default function CreateOrder({ onOrderCreated }) {
  const restaurantId = getLoggedInRestaurantId();

  // Menu catalog
  const [menuItems, setMenuItems] = useState([]);
  const [menuLoading, setMenuLoading] = useState(true);
  const [menuError, setMenuError] = useState('');
  const [searchQuery, setSearchQuery] = useState('');

  // Order details
  const [customerName, setCustomerName] = useState('');
  const [tableNumber, setTableNumber] = useState('');
  const [cart, setCart] = useState(/** @type {CartLine[]} */ ([]));
  const [orderNote, setOrderNote] = useState('');

  // UI state
  const [errorMessage, setErrorMessage] = useState('');
  const [toast, setToast] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Confirmation checkbox + modal — nothing is saved until this is checked
  // AND the "Confirm & Place Order" button in the modal is clicked.
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [confirmChecked, setConfirmChecked] = useState(false);

  const showToast = (message, type) => {
    setToast({ message, type });
    window.setTimeout(() => setToast(null), 3000);
  };

  // ==========================================
  // FETCH MENU
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
      const items = (result.data || []).map(mapRawToMenuItem);
      setMenuItems(items);
    } catch (err) {
      setMenuError(err.message || 'Could not connect to the server.');
    } finally {
      setMenuLoading(false);
    }
  };

  useEffect(() => {
    fetchMenu();
  }, []);

  const filteredMenu = useMemo(() => {
    const available = menuItems.filter((m) => m.available);
    if (!searchQuery.trim()) return available;
    const q = searchQuery.toLowerCase().trim();
    return available.filter(
      (m) =>
        m.name.toLowerCase().includes(q) ||
        m.category.toLowerCase().includes(q)
    );
  }, [searchQuery, menuItems]);

  // ==========================================
  // CART OPERATIONS
  // ==========================================
  const addToCart = (item) => {
    setErrorMessage('');
    const existingIndex = cart.findIndex((line) => line.menuItemId === item.id);
    if (existingIndex > -1) {
      const updated = [...cart];
      updated[existingIndex].quantity += 1;
      setCart(updated);
    } else {
      setCart([
        ...cart,
        {
          menuItemId: item.id,
          name: item.name,
          description: item.description,
          unitPrice: item.price,
          quantity: 1,
        },
      ]);
    }
  };

  const updateQuantity = (menuItemId, delta) => {
    setCart(
      cart
        .map((line) => {
          if (line.menuItemId !== menuItemId) return line;
          const nextQty = line.quantity + delta;
          if (nextQty <= 0) return null;
          return { ...line, quantity: nextQty };
        })
        .filter(Boolean)
    );
  };

  const removeFromCart = (menuItemId) => {
    setCart(cart.filter((line) => line.menuItemId !== menuItemId));
  };

  const cartTotal = cart.reduce((sum, line) => sum + line.unitPrice * line.quantity, 0);
  const totalItemsCount = cart.reduce((sum, line) => sum + line.quantity, 0);

  const hasRequiredDetails = customerName.trim().length > 0 && tableNumber.trim().length > 0;
  const canOpenConfirm = cart.length > 0 && hasRequiredDetails && !isSubmitting;

  // ==========================================
  // SUBMIT — opens confirmation modal first, nothing is saved yet
  // ==========================================
  const handleReviewOrder = () => {
    setErrorMessage('');

    if (cart.length === 0) {
      setErrorMessage('Please add at least one item to the order.');
      return;
    }
    if (!hasRequiredDetails) {
      setErrorMessage('Please enter both a customer name and a table number.');
      return;
    }

    setConfirmChecked(false);
    setShowConfirmModal(true);
  };

  // Actually persists the order — one document per cart line, all sharing
  // the same restaurantId / customerName / tableNumber, matching the
  // single-item Order schema in createorder.js.
  // The orderNote (if any) is saved into the `description` field of each
  // line item, so it shows up alongside that item's own description.
const placeOrder = async () => {
    setIsSubmitting(true);
    setErrorMessage('');

    try {
      const res = await fetch(ORDERS_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          restaurantId,
          customerName: customerName.trim(),
          tableNumber: tableNumber.trim(),
          orderNote: orderNote.trim(),
          items: cart.map((line) => ({
            itemName: line.name,
            description: line.description,
            itemPrice: line.unitPrice,
            quantity: line.quantity,
          })),
          totalAmount: cartTotal,
          orderStatus: "Pending",
          paymentStatus: 'Unpaid',
        }),
      });

      const data = await res.json();

      if (res.ok && data?.success) {
        showToast('Order placed successfully!', 'success');
        setCart([]);
        setCustomerName('');
        setTableNumber('');
        setOrderNote('');
        setShowConfirmModal(false);
        setConfirmChecked(false);
        onOrderCreated?.();
      } else {
        showToast(data?.message || 'Failed to place order. Please retry.', 'error');
      }
    } catch (err) {
      console.error('🔴 Order submission failed:', err);
      showToast('Could not reach the server. Please try again.', 'error');
    } finally {
      setIsSubmitting(false);
    }
};

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6" id="create-order-root">
      {toast && (
        <div
          className={`fixed top-5 right-5 z-[60] flex items-center gap-2 px-4 py-3 rounded-lg shadow-lg text-xs font-bold text-white animate-fade-in ${
            toast.type === 'success' ? 'bg-teal-600' : 'bg-red-600'
          }`}
        >
          {toast.message}
        </div>
      )}

      {/* LEFT: Order details + Cart */}
      <div className="lg:col-span-5 bg-white rounded-xl border border-gray-200 shadow-xs p-5 flex flex-col space-y-4">
        <div className="flex justify-between items-center border-b border-gray-100 pb-3">
          <h2 className="text-lg font-bold text-gray-900 tracking-tight flex items-center gap-2">
            <ShoppingCart className="h-5 w-5 text-teal-600" />
            New Order
          </h2>
          <span className="bg-teal-50 text-teal-700 px-2.5 py-0.5 rounded-full text-xs font-bold font-mono">
            {totalItemsCount} items
          </span>
        </div>

        {/* Customer + Table inputs */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block mb-1">
              Customer Name
            </label>
            <input
              type="text"
              value={customerName}
              onChange={(e) => setCustomerName(e.target.value)}
              placeholder="Enter customer name "
              className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-xs focus:outline-hidden"
            />
          </div>
          <div>
            <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block mb-1">
              Table 
            </label>
            <input
              type="text"
              value={tableNumber}
              onChange={(e) => setTableNumber(e.target.value)}
              placeholder="Enter table name "
              className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-xs focus:outline-hidden"
            />
          </div>
        </div>

        {/* Order Note — saved into `description` for each item on submit */}
        <div>
          <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block mb-1">
            Order Note
          </label>
          <textarea
            value={orderNote}
            onChange={(e) => setOrderNote(e.target.value)}
            placeholder="e.g. No onions, extra spicy, allergy notes..."
            rows={2}
            className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-xs focus:outline-hidden resize-none"
          />
        </div>

        {errorMessage && (
          <div className="p-3 bg-red-50 border border-red-200 text-xs text-red-800 rounded-lg flex items-center gap-2">
            <AlertCircle className="h-4.5 w-4.5 text-red-600 shrink-0" />
            <p className="font-medium">{errorMessage}</p>
          </div>
        )}

        {/* Cart list */}
        <div className="flex-1 overflow-y-auto max-h-[300px] min-h-[140px] space-y-2 pr-1">
          {cart.length === 0 ? (
            <div className="text-center py-10 space-y-2 text-gray-400">
              <ShoppingCart className="h-8 w-8 mx-auto stroke-1" />
              <p className="text-xs">No items added yet.</p>
            </div>
          ) : (
            cart.map((line) => (
              <div
                key={line.menuItemId}
                className="p-3 bg-white border border-gray-200 rounded-lg flex items-center justify-between text-xs hover:border-teal-100 transition-all shadow-xs"
              >
                <div className="space-y-0.5 max-w-[170px]">
                  <p className="font-bold text-gray-900 leading-tight">{line.name}</p>
                  {/* Per-unit price, e.g. "NPR 50.00 each" for 1 tea's price even if qty is 5 */}
                  <p className="text-[10px] font-mono text-teal-600 font-semibold">
                    NPR {line.unitPrice.toFixed(2)} each
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <div className="flex items-center border border-gray-200 rounded-md bg-gray-50">
                    <button
                      type="button"
                      onClick={() => updateQuantity(line.menuItemId, -1)}
                      className="p-1 hover:bg-gray-100 text-gray-500 hover:text-gray-900"
                    >
                      <Minus className="h-3 w-3" />
                    </button>
                    <span className="px-2 font-mono font-bold text-gray-900 text-xs bg-white min-w-[20px] text-center">
                      {line.quantity}
                    </span>
                    <button
                      type="button"
                      onClick={() => updateQuantity(line.menuItemId, 1)}
                      className="p-1 hover:bg-gray-100 text-gray-500 hover:text-gray-900"
                    >
                      <Plus className="h-3 w-3" />
                    </button>
                  </div>

                  <button
                    type="button"
                    onClick={() => removeFromCart(line.menuItemId)}
                    className="p-1 text-gray-400 hover:text-red-500 rounded hover:bg-gray-50"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>

                <div className="text-right min-w-[70px]">
                  <div className="font-mono font-bold text-gray-900">
                    NPR {(line.unitPrice * line.quantity).toFixed(2)}
                  </div>
                  <div className="text-[9px] text-gray-400 font-mono">
                    ({line.quantity} × {line.unitPrice.toFixed(2)})
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Total */}
        <div className="border-t border-gray-100 pt-3.5">
          <div className="flex justify-between text-sm text-gray-900 font-bold">
            <span>Order Total</span>
            <span className="font-mono text-teal-700 text-base">
              NPR {cartTotal.toLocaleString('en-NP', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
          </div>
        </div>

        {/* Opens confirmation modal — does NOT save anything yet */}
        <button
          onClick={handleReviewOrder}
          disabled={!canOpenConfirm}
          className="w-full py-3 bg-teal-600 hover:bg-teal-700 disabled:bg-gray-100 disabled:text-gray-400 disabled:cursor-not-allowed text-white text-sm font-bold rounded-xl shadow-xs transition-colors flex items-center justify-center gap-2"
        >
          <CheckCircle className="h-4.5 w-4.5" />
          Review Order
        </button>
      </div>

      {/* RIGHT: Menu grid */}
      <div className="lg:col-span-7 bg-white rounded-xl border border-gray-200 shadow-xs p-5 flex flex-col space-y-4">
        <div className="relative">
          <Search className="absolute left-3 top-2.5 h-4.5 w-4.5 text-gray-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search menu items..."
            className="w-full pl-9 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-lg text-xs placeholder-gray-400 focus:outline-hidden"
          />
        </div>

        <div className="flex-1 overflow-y-auto max-h-[580px] grid grid-cols-1 sm:grid-cols-2 auto-rows-min content-start gap-3 pr-1">
          {menuLoading ? (
            <div className="col-span-2 text-center py-20 text-gray-400 space-y-2">
              <Loader2 className="h-8 w-8 mx-auto animate-spin" />
              <p className="text-sm font-medium">Loading menu...</p>
            </div>
          ) : menuError ? (
            <div className="col-span-2 text-center py-20 text-red-500 space-y-2">
              <PackageX className="h-8 w-8 mx-auto" />
              <p className="text-sm font-medium">{menuError}</p>
              <button onClick={fetchMenu} className="text-teal-600 font-bold text-xs underline">
                Retry
              </button>
            </div>
          ) : filteredMenu.length === 0 ? (
            <div className="col-span-2 text-center py-20 text-gray-400 space-y-2">
              <Utensils className="h-10 w-10 mx-auto stroke-1" />
              <p className="text-sm font-medium">
                {menuItems.length === 0
                  ? 'No menu items yet. Add items from the Menu tab.'
                  : 'No items match your search.'}
              </p>
            </div>
          ) : (
            filteredMenu.map((item) => {
              const inCartLine = cart.find((l) => l.menuItemId === item.id);
              return (
                <button
                  key={item.id}
                  onClick={() => addToCart(item)}
                  className={`p-3.5 text-left border rounded-xl flex flex-col justify-between transition-all group ${
                    inCartLine
                      ? 'bg-teal-50/20 border-teal-300 ring-1 ring-teal-200'
                      : 'bg-white border-gray-200 hover:border-gray-300 shadow-2xs hover:shadow-xs'
                  }`}
                >
                  <div className="space-y-1 w-full">
                    <div className="flex justify-between items-start">
                      <span className="font-bold text-gray-900 group-hover:text-teal-700 transition-colors text-sm truncate max-w-[170px]">
                        {item.name}
                      </span>
                      <span className="text-[10px] text-gray-400 bg-gray-100 px-1 rounded font-mono font-medium">
                        {item.category}
                      </span>
                    </div>
                    {item.description && (
                      <p className="text-[11px] text-gray-500 line-clamp-2">{item.description}</p>
                    )}
                  </div>

                  <div className="flex justify-between items-end mt-4 border-t border-gray-50 pt-2.5 w-full">
                    <span className="font-mono font-bold text-gray-900 text-sm">
                      NPR {item.price.toFixed(2)}
                    </span>
                    {inCartLine && (
                      <span className="px-2 py-0.5 bg-teal-100 text-teal-700 text-[10px] font-bold rounded">
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

      {/* CONFIRMATION MODAL — "Are you sure?" with checkbox gate.
          Nothing is written to the DB until confirmChecked is true AND
          the confirm button below is clicked. */}
      {showConfirmModal && (
        <div className="fixed inset-0 bg-gray-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 space-y-5 shadow-2xl border border-gray-100">
            <div className="flex justify-between items-center border-b border-gray-100 pb-3">
              <span className="font-bold text-gray-900 flex items-center gap-1.5 text-sm">
                <AlertCircle className="h-5 w-5 text-amber-500" />
                Confirm Order
              </span>
              <button
                onClick={() => setShowConfirmModal(false)}
                className="p-1 text-gray-400 hover:text-gray-950"
                disabled={isSubmitting}
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-2 text-xs text-gray-700">
              <div className="flex justify-between">
                <span className="text-gray-500">Customer</span>
                <span className="font-bold">{customerName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Table</span>
                <span className="font-bold">{tableNumber}</span>
              </div>
              {orderNote.trim() && (
                <div className="flex justify-between gap-2">
                  <span className="text-gray-500 shrink-0">Note</span>
                  <span className="font-medium text-right">{orderNote.trim()}</span>
                </div>
              )}
              <div className="border-t border-gray-100 pt-2 space-y-1 max-h-40 overflow-y-auto">
                {cart.map((line) => (
                  <div key={line.menuItemId} className="flex justify-between items-center">
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
                <span className="font-mono text-teal-700">NPR {cartTotal.toFixed(2)}</span>
              </div>
            </div>

            <label className="flex items-start gap-2 p-3 bg-amber-50 border border-amber-200 rounded-lg cursor-pointer">
              <input
                type="checkbox"
                checked={confirmChecked}
                onChange={(e) => setConfirmChecked(e.target.checked)}
                className="mt-0.5"
              />
              <span className="text-xs text-amber-800 font-medium">
                I confirm the items, customer name, and table number above are correct and want to place this order.
              </span>
            </label>

            <div className="flex justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setShowConfirmModal(false)}
                disabled={isSubmitting}
                className="px-5 py-2 bg-gray-100 hover:bg-gray-200 text-gray-800 text-xs font-bold uppercase tracking-wider rounded-lg transition-colors border border-gray-200"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={placeOrder}
                disabled={!confirmChecked || isSubmitting}
                className="px-6 py-2 bg-teal-600 hover:bg-teal-700 disabled:bg-gray-200 disabled:text-gray-400 disabled:cursor-not-allowed text-white text-xs font-bold uppercase tracking-wider rounded-lg transition-colors shadow-xs flex items-center gap-1.5"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Placing...
                  </>
                ) : (
                  <>
                    <CheckCircle className="h-4 w-4" />
                    Confirm & Place Order
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