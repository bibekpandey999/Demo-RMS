import React, { useState, useEffect, useMemo } from 'react';
import {
  Database,
  Search,
  Plus,
  AlertTriangle,
  Calendar,
  X,
  Pencil,
  Trash2,
  Loader2,
  PackageX,
  CheckCircle2,
  XCircle,
} from 'lucide-react';
import { TRANSLATIONS } from '../translations';

// ==========================================
// CONFIG
// ==========================================

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:5000';
const MENU_URL = `${API_BASE}/api/menu`;

const CATEGORY_OPTIONS = ['Appetizer', 'Main Course', 'Dessert', 'Beverage', 'Side', 'Other'];
const STATUS_OPTIONS = ['Available', 'Unavailable', 'Sold Out'];

// Helper to safely read the logged-in restaurant's ID from localStorage.
// Login stores the whole user object as a JSON string under the key "user":
// {"_id":"6a4d428e8f7fb3fb6111b927","id":"9898","restaurantName":"Butwal Diner","isAdmin":false}
// The restaurant's ID to filter menu items by is the "id" field ("9898"), not "_id".
const getLoggedInRestaurantId = (): string => {
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
// TYPES (shape returned/expected by the Express + MongoDB backend)
// ==========================================

interface MenuItemType {
  _id: string;
  id: string;
  restaurantId: string;
  itemName: string;
  description: string;
  category: string;
  price: number;
  status: string;
  skuBarcodeReference: string;
  createdAt: string;
}

interface MenuFormState {
  restaurantId: string;
  itemName: string;
  description: string;
  category: string;
  price: string;
  status: string;
  skuBarcodeReference: string;
}

const EMPTY_FORM: MenuFormState = {
  restaurantId: '',
  itemName: '',
  description: '',
  category: 'Appetizer',
  price: '',
  status: 'Available',
  skuBarcodeReference: '',
};

interface MenuManagerProps {
  lang: 'en' | 'ne';
  currentUserRole: 'Receptionist' | 'Pharmacist' | 'Owner';
}

type ToastState = { message: string; type: 'success' | 'error' } | null;

export default function MenuManager({ lang, currentUserRole }: MenuManagerProps) {
  const t = TRANSLATIONS[lang];
  const canEditOrDelete = currentUserRole === 'Pharmacist' || currentUserRole === 'Owner';

  // Data state
  const [menuItems, setMenuItems] = useState<MenuItemType[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');

  // List search & filters
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [statusFilter, setStatusFilter] = useState<'All' | 'Available' | 'Unavailable'>('All');

  // Selected item detail
  const [selectedMenuItem, setSelectedMenuItem] = useState<MenuItemType | null>(null);

  // Add / Edit modal
  const [showFormModal, setShowFormModal] = useState(false);
  const [formMode, setFormMode] = useState<'add' | 'edit'>('add');
  const [formData, setFormData] = useState<MenuFormState>(EMPTY_FORM);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState('');

  // Delete confirmation
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Toast
  const [toast, setToast] = useState<ToastState>(null);
  const showToast = (message: string, type: 'success' | 'error') => {
    setToast({ message, type });
    window.setTimeout(() => setToast(null), 3000);
  };

  // ==========================================
  // DATA FETCHING
  // ==========================================

  const fetchMenuItems = async () => {
    setLoading(true);
    setLoadError('');

    // Get the restaurant ID from the logged-in user object in localStorage
    const restaurantId = getLoggedInRestaurantId();

    if (!restaurantId) {
      setLoadError(
        lang === 'en'
          ? 'No restaurant ID found. Please log in again.'
          : 'रेस्टुरेन्ट आईडी फेला परेन। कृपया फेरि लगइन गर्नुहोस्।'
      );
      setMenuItems([]);
      setLoading(false);
      return;
    }

    try {
      // Ask the backend to filter by restaurantId directly (server does the scoping)
      const url = `${MENU_URL}?restaurantId=${encodeURIComponent(restaurantId)}`;
      const res = await fetch(url);
      const result = await res.json();

      if (!res.ok || !result.success) {
        throw new Error(result.message || 'Failed to load menu.');
      }

      // Belt-and-suspenders: also filter client-side in case the backend
      // route hasn't been updated yet to respect ?restaurantId=
      const scoped = (result.data || []).filter(
        (m: MenuItemType) => String(m.restaurantId || '').trim() === String(restaurantId).trim()
      );

      setMenuItems(scoped);
    } catch (err: any) {
      setLoadError(err.message || 'Could not connect to the server.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMenuItems();
  }, []);

  // ==========================================
  // FILTERING (derived, no extra effect needed)
  // ==========================================

  const filteredMenuItems = useMemo(() => {
    let result = menuItems;

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      result = result.filter(
        (m) =>
          m.itemName?.toLowerCase().includes(q) ||
          m.description?.toLowerCase().includes(q) ||
          m.skuBarcodeReference?.toLowerCase().includes(q)
      );
    }

    if (selectedCategory !== 'All') {
      result = result.filter((m) => m.category === selectedCategory);
    }

    if (statusFilter === 'Available') {
      result = result.filter((m) => m.status === 'Available');
    } else if (statusFilter === 'Unavailable') {
      result = result.filter((m) => m.status !== 'Available');
    }

    return result;
  }, [searchQuery, selectedCategory, statusFilter, menuItems]);

  // ==========================================
  // FORM HELPERS
  // ==========================================

  const handleFormChange = (field: keyof MenuFormState, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const openAddModal = () => {
    setFormMode('add');
    setEditingId(null);
    // Restaurant ID is auto-filled from the logged-in session, not typed by the user
    setFormData({ ...EMPTY_FORM, restaurantId: getLoggedInRestaurantId() });
    setFormError('');
    setShowFormModal(true);
  };

  const openEditModal = (item: MenuItemType) => {
    setFormMode('edit');
    setEditingId(item._id);
    setFormData({
      restaurantId: getLoggedInRestaurantId(), // always lock to current restaurant, ignore whatever was on the record
      itemName: item.itemName || '',
      description: item.description || '',
      category: item.category || 'Appetizer',
      price: item.price != null ? String(item.price) : '',
      status: item.status || 'Available',
      skuBarcodeReference: item.skuBarcodeReference || '',
    });
    setFormError('');
    setShowFormModal(true);
  };

  const closeModal = () => {
    setShowFormModal(false);
    setFormData(EMPTY_FORM);
    setEditingId(null);
    setFormError('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.itemName.trim() || !formData.description.trim() || !formData.category.trim() || !formData.price) {
      setFormError('Item name, description, category, and price are required.');
      return;
    }

    const currentRestaurantId = getLoggedInRestaurantId();
    if (!currentRestaurantId) {
      setFormError(
        lang === 'en'
          ? 'No restaurant ID found in your session. Please log in again.'
          : 'तपाईंको सत्रमा रेस्टुरेन्ट आईडी फेला परेन। कृपया फेरि लगइन गर्नुहोस्।'
      );
      return;
    }

    setSubmitting(true);
    setFormError('');

    const payload = {
      restaurantId: currentRestaurantId, // always taken fresh from localStorage, never trusted from form state
      itemName: formData.itemName.trim(),
      description: formData.description.trim(),
      category: formData.category,
      price: Number(formData.price) || 0,
      status: formData.status,
      skuBarcodeReference: formData.skuBarcodeReference.trim(),
    };

    try {
      const url = formMode === 'edit' && editingId ? `${MENU_URL}/${editingId}` : MENU_URL;
      const method = formMode === 'edit' ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const result = await res.json();

      if (!res.ok || !result.success) {
        throw new Error(result.message || 'Request failed.');
      }

      await fetchMenuItems();
      showToast(
        formMode === 'edit' ? 'Menu item updated.' : 'Menu item added.',
        'success'
      );
      closeModal();
    } catch (err: any) {
      setFormError(err.message || 'Something went wrong. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  // ==========================================
  // DELETE
  // ==========================================

  const handleDelete = async (id: string) => {
    setDeletingId(id);
    try {
      const res = await fetch(`${MENU_URL}/${id}`, { method: 'DELETE' });
      const result = await res.json();
      if (!res.ok || !result.success) {
        throw new Error(result.message || 'Delete failed.');
      }
      setMenuItems((prev) => prev.filter((m) => m._id !== id));
      if (selectedMenuItem?._id === id) setSelectedMenuItem(null);
      showToast('Menu item deleted.', 'success');
    } catch (err: any) {
      showToast(err.message || 'Failed to delete menu item.', 'error');
    } finally {
      setDeletingId(null);
      setConfirmDeleteId(null);
    }
  };

  // ==========================================
  // RENDER HELPERS
  // ==========================================

  const isUnavailable = (status: string) => status !== 'Available';

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6" id="menu-root">
      {/* Toast */}
      {toast && (
        <div
          className={`fixed top-5 right-5 z-[60] flex items-center gap-2 px-4 py-3 rounded-lg shadow-lg text-xs font-bold text-white animate-fade-in ${
            toast.type === 'success' ? 'bg-teal-600' : 'bg-red-600'
          }`}
        >
          {toast.type === 'success' ? (
            <CheckCircle2 className="h-4 w-4" />
          ) : (
            <XCircle className="h-4 w-4" />
          )}
          {toast.message}
        </div>
      )}

      {/* LEFT COLUMN: Menu Grid List & Filter bar */}
      <div
        className="lg:col-span-8 bg-white rounded-xl border border-gray-200 shadow-xs p-5 flex flex-col space-y-4"
        id="menu-list-card"
      >
        <div className="flex flex-col sm:flex-row justify-between sm:items-center pb-2 border-b border-gray-100 gap-3">
          <h2 className="text-lg font-bold text-gray-900 tracking-tight flex items-center gap-2">
            <Database className="h-5 w-5 text-teal-600" />
            {lang === 'en' ? 'Menu Management' : 'मेनु व्यवस्थापन'}
          </h2>

          <button
            onClick={openAddModal}
            className="py-1.5 px-3 bg-teal-600 hover:bg-teal-700 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 transition-colors shadow-xs"
          >
            <Plus className="h-4 w-4" />
            {lang === 'en' ? 'Add Menu Item' : 'मेनु वस्तु थप्नुहोस्'}
          </button>
        </div>

        {/* Search and Filter Tabs */}
        <div className="flex flex-col sm:flex-row gap-3 text-xs" id="menu-filters">
          <div className="relative flex-1" id="menu-search-group">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-gray-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={
                lang === 'en'
                  ? 'Search by name, description, or SKU...'
                  : 'नाम, विवरण वा SKU द्वारा खोज्नुहोस्...'
              }
              className="w-full pl-8 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-lg focus:outline-hidden"
            />
          </div>

          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg font-medium focus:outline-hidden text-gray-700"
          >
            <option value="All">{lang === 'en' ? 'All Categories' : 'सबै वर्गहरू'}</option>
            {CATEGORY_OPTIONS.map((cat) => (
              <option key={cat} value={cat}>
                {cat}
              </option>
            ))}
          </select>

          <div className="flex bg-gray-100 p-0.5 rounded-lg border border-gray-200" id="status-tabs">
            <button
              onClick={() => setStatusFilter('All')}
              className={`px-3 py-1.5 rounded-md font-medium transition-colors ${
                statusFilter === 'All' ? 'bg-white text-gray-900 shadow-2xs font-bold' : 'text-gray-500 hover:text-gray-900'
              }`}
            >
              {lang === 'en' ? 'All' : 'सबै'}
            </button>
            <button
              onClick={() => setStatusFilter('Available')}
              className={`px-3 py-1.5 rounded-md font-medium flex items-center gap-1.5 transition-colors ${
                statusFilter === 'Available' ? 'bg-teal-600 text-white shadow-2xs font-bold' : 'text-gray-500 hover:text-teal-600'
              }`}
            >
              <CheckCircle2 className="h-3.5 w-3.5" />
              <span>{lang === 'en' ? 'Available' : 'उपलब्ध'}</span>
            </button>
            <button
              onClick={() => setStatusFilter('Unavailable')}
              className={`px-3 py-1.5 rounded-md font-medium flex items-center gap-1.5 transition-colors ${
                statusFilter === 'Unavailable' ? 'bg-red-500 text-white shadow-2xs font-bold' : 'text-gray-500 hover:text-red-600'
              }`}
            >
              <XCircle className="h-3.5 w-3.5" />
              <span>{lang === 'en' ? 'Unavailable' : 'अनुपलब्ध'}</span>
            </button>
          </div>
        </div>

        {/* Menu Items Table */}
        <div className="overflow-x-auto border border-gray-100 rounded-lg" id="menu-table-wrapper">
          <table className="min-w-full divide-y divide-gray-100 text-xs">
            <thead>
              <tr className="text-left text-gray-400 uppercase tracking-wider bg-gray-50">
                <th className="px-4 py-3">{lang === 'en' ? 'Item Name' : 'वस्तुको नाम'}</th>
                <th className="px-4 py-3 text-center">Category</th>
                <th className="px-4 py-3 text-right">Price (NPR)</th>
                <th className="px-4 py-3 text-center">Status</th>
                <th className="px-4 py-3">SKU / Barcode</th>
                <th className="px-4 py-3 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100" id="menu-table-body">
              {loading ? (
                <tr>
                  <td colSpan={6} className="px-4 py-12 text-center text-gray-400">
                    <Loader2 className="h-5 w-5 animate-spin mx-auto mb-2" />
                    {lang === 'en' ? 'Loading menu...' : 'लोड हुँदैछ...'}
                  </td>
                </tr>
              ) : loadError ? (
                <tr>
                  <td colSpan={6} className="px-4 py-12 text-center text-red-500">
                    <PackageX className="h-6 w-6 mx-auto mb-2" />
                    {loadError}
                    <button
                      onClick={fetchMenuItems}
                      className="block mx-auto mt-2 text-teal-600 font-bold underline"
                    >
                      {lang === 'en' ? 'Retry' : 'फेरि प्रयास गर्नुहोस्'}
                    </button>
                  </td>
                </tr>
              ) : filteredMenuItems.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-12 text-center text-gray-400 italic">
                    {menuItems.length === 0
                      ? lang === 'en'
                        ? 'No menu items yet. Add your first item to get started.'
                        : 'अहिले सम्म कुनै मेनु वस्तु थपिएको छैन।'
                      : lang === 'en'
                      ? 'No menu items match filters.'
                      : 'कुनै वस्तु फेला परेन।'}
                  </td>
                </tr>
              ) : (
                filteredMenuItems.map((item) => {
                  const unavailable = isUnavailable(item.status);

                  return (
                    <tr
                      key={item._id}
                      onClick={() => setSelectedMenuItem(item)}
                      className={`hover:bg-teal-50/10 cursor-pointer transition-colors ${
                        selectedMenuItem?._id === item._id ? 'bg-teal-50/30' : ''
                      }`}
                    >
                      <td className="px-4 py-3.5">
                        <div className="space-y-0.5">
                          <span className="font-bold text-gray-900 block">{item.itemName}</span>
                          <span className="text-[10px] text-gray-400 block truncate max-w-[220px]">
                            {item.description}
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-3.5 text-center font-medium text-gray-600">
                        {item.category}
                      </td>
                      <td className="px-4 py-3.5 text-right font-mono font-bold text-gray-900">
                        NPR {Number(item.price).toFixed(2)}
                      </td>
                      <td className="px-4 py-3.5 text-center">
                        <span
                          className={`inline-flex px-2 py-0.5 text-[9px] font-bold rounded uppercase tracking-wider ${
                            item.status === 'Available'
                              ? 'bg-teal-100 text-teal-800'
                              : item.status === 'Sold Out'
                              ? 'bg-red-100 text-red-700'
                              : 'bg-gray-100 text-gray-600'
                          }`}
                        >
                          {item.status}
                        </span>
                      </td>
                      <td className="px-4 py-3.5">
                        <span className="font-mono text-[11px] text-gray-600">
                          {item.skuBarcodeReference || '—'}
                        </span>
                      </td>
                      <td className="px-4 py-3.5 text-center" onClick={(e) => e.stopPropagation()}>
                        {canEditOrDelete ? (
                          <div className="flex items-center justify-center gap-1.5">
                            <button
                              onClick={() => openEditModal(item)}
                              title={lang === 'en' ? 'Edit' : 'सम्पादन गर्नुहोस्'}
                              className="p-1.5 rounded-md hover:bg-teal-50 text-teal-600 transition-colors"
                            >
                              <Pencil className="h-3.5 w-3.5" />
                            </button>
                            <button
                              onClick={() => setConfirmDeleteId(item._id)}
                              title={lang === 'en' ? 'Delete' : 'मेटाउनुहोस्'}
                              className="p-1.5 rounded-md hover:bg-red-50 text-red-500 transition-colors"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        ) : (
                          <span className="text-[10px] text-gray-300">—</span>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* RIGHT COLUMN: Menu Item Detail Panel */}
      <div className="lg:col-span-4 space-y-6" id="menu-sidebar">
        {selectedMenuItem ? (
          <div className="bg-white rounded-xl border border-gray-200 shadow-xs p-5 space-y-5">
            <div className="flex justify-between items-start border-b border-gray-100 pb-3">
              <div className="space-y-0.5">
                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">
                  {selectedMenuItem.skuBarcodeReference || selectedMenuItem._id}
                </span>
                <h3 className="text-base font-bold text-gray-900 leading-tight">
                  {selectedMenuItem.itemName}
                </h3>
                <p className="text-xs text-teal-600 font-bold">{selectedMenuItem.category}</p>
              </div>
              <button
                onClick={() => setSelectedMenuItem(null)}
                className="p-1 hover:bg-gray-100 rounded"
              >
                <X className="h-4.5 w-4.5" />
              </button>
            </div>

            <div className="p-2.5 bg-gray-50 rounded-lg text-xs">
              <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">
                Description
              </span>
              <span className="font-medium text-gray-800">{selectedMenuItem.description}</span>
            </div>

            <div className="grid grid-cols-2 gap-3 text-xs leading-relaxed" id="menu-detail-box">
              <div className="p-2.5 bg-gray-50 rounded-lg">
                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">
                  Price
                </span>
                <span className="font-bold text-gray-800 font-mono">
                  NPR {Number(selectedMenuItem.price).toFixed(2)}
                </span>
              </div>
              <div className="p-2.5 bg-gray-50 rounded-lg">
                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">
                  Status
                </span>
                <span
                  className={`font-bold ${
                    selectedMenuItem.status === 'Available' ? 'text-teal-700' : 'text-red-600'
                  }`}
                >
                  {selectedMenuItem.status}
                </span>
              </div>
              <div className="p-2.5 bg-gray-50 rounded-lg col-span-2">
                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">
                  SKU / Barcode Reference
                </span>
                <span className="font-bold text-gray-800 text-[11px] font-mono">
                  {selectedMenuItem.skuBarcodeReference || '—'}
                </span>
              </div>
            </div>

            {canEditOrDelete ? (
              <div className="border-t border-gray-100 pt-4 flex gap-2">
                <button
                  onClick={() => openEditModal(selectedMenuItem)}
                  className="flex-1 py-2 bg-teal-600 hover:bg-teal-700 text-white font-bold text-[11px] uppercase tracking-wider rounded-lg flex items-center justify-center gap-1.5 transition-colors"
                >
                  <Pencil className="h-3.5 w-3.5" />
                  {lang === 'en' ? 'Edit' : 'सम्पादन गर्नुहोस्'}
                </button>
                <button
                  onClick={() => setConfirmDeleteId(selectedMenuItem._id)}
                  className="flex-1 py-2 bg-red-50 hover:bg-red-100 text-red-600 font-bold text-[11px] uppercase tracking-wider rounded-lg flex items-center justify-center gap-1.5 transition-colors border border-red-100"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  {lang === 'en' ? 'Delete' : 'मेटाउनुहोस्'}
                </button>
              </div>
            ) : (
              <div className="border-t border-gray-100 pt-4">
                <div className="p-3 bg-red-50/50 rounded-lg border border-red-100 text-xs text-red-800">
                  <p className="font-bold">🔒 {lang === 'en' ? 'Action Restricted' : 'कार्य प्रतिबन्धित'}</p>
                  <p>{t.restrictedAction}</p>
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="bg-white rounded-xl border border-gray-200 shadow-xs p-8 text-center space-y-2">
            <Database className="h-8 w-8 text-gray-300 mx-auto" />
            <p className="text-xs text-gray-400">
              {lang === 'en'
                ? 'Select a menu item from the list to view details.'
                : 'विवरण हेर्न मेनु वस्तु छान्नुहोस्।'}
            </p>
          </div>
        )}

        {/* Unavailable / sold out quick summary */}
        {!loading && !loadError && menuItems.length > 0 && (
          <div className="bg-white rounded-xl border border-gray-200 shadow-xs p-5 space-y-3">
            <h3 className="text-xs font-bold text-gray-900 uppercase tracking-wider flex items-center gap-1.5 border-b border-gray-100 pb-2">
              <AlertTriangle className="h-4 w-4 text-amber-500" />
              {lang === 'en' ? 'Unavailable Items' : 'अनुपलब्ध वस्तुहरू'}
            </h3>
            <div className="space-y-1.5 max-h-[180px] overflow-y-auto pr-1">
              {menuItems.filter((m) => isUnavailable(m.status)).length === 0 ? (
                <p className="text-[11px] text-gray-400 italic">
                  {lang === 'en' ? 'All menu items are available.' : 'सबै वस्तुहरू उपलब्ध छन्।'}
                </p>
              ) : (
                menuItems
                  .filter((m) => isUnavailable(m.status))
                  .map((m) => (
                    <button
                      key={m._id}
                      onClick={() => setSelectedMenuItem(m)}
                      className="w-full flex justify-between items-center text-[11px] p-2 bg-amber-50/50 hover:bg-amber-50 rounded-lg border border-amber-100 transition-colors"
                    >
                      <span className="font-bold text-gray-800 truncate">{m.itemName}</span>
                      <span className="font-mono font-bold text-amber-700">{m.status}</span>
                    </button>
                  ))
              )}
            </div>
          </div>
        )}
      </div>

      {/* ADD / EDIT MENU ITEM MODAL */}
      {showFormModal && (
        <div
          className="fixed inset-0 bg-gray-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in"
          id="menu-form-modal"
        >
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 space-y-5 shadow-2xl border border-gray-100 animate-scale-in max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center border-b border-gray-100 pb-3">
              <h3 className="text-base font-bold text-gray-900 flex items-center gap-1.5">
                <Database className="h-5 w-5 text-teal-600" />
                {formMode === 'edit'
                  ? lang === 'en'
                    ? 'Edit Menu Item'
                    : 'मेनु वस्तु सम्पादन गर्नुहोस्'
                  : lang === 'en'
                  ? 'Add Menu Item'
                  : 'मेनु वस्तु थप्नुहोस्'}
              </h3>
              <button onClick={closeModal} className="p-1 text-gray-400 hover:text-gray-950">
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4 text-xs text-gray-700" id="menu-form">
              {formError && (
                <div className="p-2.5 bg-red-50 border border-red-100 rounded-lg text-[11px] text-red-700 font-medium">
                  {formError}
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">

                <div className="space-y-1 sm:col-span-2">
                  <label className="font-bold text-gray-500 uppercase tracking-wider block">
                    Restaurant ID
                  </label>
                  <input
                    type="text"
                    readOnly
                    disabled
                    value={formData.restaurantId}
                    title={lang === 'en' ? 'Automatically set from your logged-in restaurant account' : 'तपाईंको लगइन गरिएको रेस्टुरेन्ट खाताबाट स्वचालित रूपमा सेट गरिएको'}
                    className="w-full px-3 py-2 bg-gray-100 border border-gray-200 rounded-lg text-xs text-gray-500 cursor-not-allowed"
                  />
                </div>

                <div className="space-y-1 sm:col-span-2">
                  <label className="font-bold text-gray-500 uppercase tracking-wider block">
                    Item Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.itemName}
                    onChange={(e) => handleFormChange('itemName', e.target.value)}
                    placeholder="e.g. Chicken Momo"
                    className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-xs focus:outline-hidden focus:bg-white"
                  />
                </div>

                <div className="space-y-1 sm:col-span-2">
                  <label className="font-bold text-gray-500 uppercase tracking-wider block">
                    Description <span className="text-red-500">*</span>
                  </label>
                  <textarea
                    required
                    rows={2}
                    value={formData.description}
                    onChange={(e) => handleFormChange('description', e.target.value)}
                    placeholder="e.g. Steamed dumplings served with spicy tomato chutney"
                    className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-xs focus:outline-hidden focus:bg-white resize-none"
                  />
                </div>

                <div className="space-y-1">
                  <label className="font-bold text-gray-500 uppercase tracking-wider block">
                    Category <span className="text-red-500">*</span>
                  </label>
                  <select
                    required
                    value={formData.category}
                    onChange={(e) => handleFormChange('category', e.target.value)}
                    className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-xs focus:outline-hidden focus:bg-white"
                  >
                    {CATEGORY_OPTIONS.map((cat) => (
                      <option key={cat} value={cat}>
                        {cat}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="font-bold text-gray-500 uppercase tracking-wider block">
                    Price (NPR) <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="number"
                    required
                    min="0"
                    step="0.01"
                    value={formData.price}
                    onChange={(e) => handleFormChange('price', e.target.value)}
                    className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-xs focus:outline-hidden font-mono font-bold text-gray-900"
                  />
                </div>

                <div className="space-y-1">
                  <label className="font-bold text-gray-500 uppercase tracking-wider block">Status</label>
                  <select
                    value={formData.status}
                    onChange={(e) => handleFormChange('status', e.target.value)}
                    className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-xs focus:outline-hidden focus:bg-white"
                  >
                    {STATUS_OPTIONS.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="font-bold text-gray-500 uppercase tracking-wider block">
                    SKU Barcode Reference
                  </label>
                  <input
                    type="text"
                    value={formData.skuBarcodeReference}
                    onChange={(e) => handleFormChange('skuBarcodeReference', e.target.value)}
                    placeholder="Optional"
                    className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-xs focus:outline-hidden font-mono"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-gray-100">
                <button
                  type="button"
                  onClick={closeModal}
                  disabled={submitting}
                  className="px-5 py-2 bg-white hover:bg-gray-50 text-gray-700 text-xs font-bold uppercase tracking-wider rounded-lg border border-gray-200 disabled:opacity-50"
                >
                  {t.cancel}
                </button>
                <button
                  type="submit"
                  disabled={submitting || !formData.itemName || !formData.description || !formData.price}
                  className="px-6 py-2 bg-teal-600 hover:bg-teal-700 disabled:bg-gray-200 disabled:text-gray-400 text-white text-xs font-bold uppercase tracking-wider rounded-lg transition-colors shadow-xs flex items-center gap-2"
                >
                  {submitting && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                  {formMode === 'edit'
                    ? lang === 'en'
                      ? 'Save Changes'
                      : 'परिवर्तन सुरक्षित गर्नुहोस्'
                    : lang === 'en'
                    ? 'Add Item'
                    : 'थप्नुहोस्'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* DELETE CONFIRMATION MODAL */}
      {confirmDeleteId && (
        <div className="fixed inset-0 bg-gray-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="bg-white rounded-2xl max-w-sm w-full p-6 space-y-4 shadow-2xl border border-gray-100 animate-scale-in">
            <div className="flex items-center gap-2 text-red-600">
              <AlertTriangle className="h-5 w-5" />
              <h3 className="text-sm font-bold uppercase tracking-wider">
                {lang === 'en' ? 'Delete this menu item?' : 'यो मेनु वस्तु मेटाउने हो?'}
              </h3>
            </div>
            <p className="text-xs text-gray-500">
              {lang === 'en'
                ? 'This will permanently remove it from your menu. This cannot be undone.'
                : 'यो कार्य पूर्ववत गर्न सकिँदैन।'}
            </p>
            <div className="flex justify-end gap-3 pt-2">
              <button
                onClick={() => setConfirmDeleteId(null)}
                disabled={deletingId === confirmDeleteId}
                className="px-4 py-2 bg-white hover:bg-gray-50 text-gray-700 text-xs font-bold uppercase tracking-wider rounded-lg border border-gray-200 disabled:opacity-50"
              >
                {t.cancel}
              </button>
              <button
                onClick={() => handleDelete(confirmDeleteId)}
                disabled={deletingId === confirmDeleteId}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white text-xs font-bold uppercase tracking-wider rounded-lg transition-colors flex items-center gap-2 disabled:opacity-70"
              >
                {deletingId === confirmDeleteId && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                {lang === 'en' ? 'Delete' : 'मेटाउनुहोस्'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}