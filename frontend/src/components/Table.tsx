import React, { useState, useEffect, useCallback } from "react";

const API_BASE = "https://rms-0wk0.onrender.com/api/tables";

interface TableItem {
  id: string;
  _id: string;
  restaurantId: string;
  tableName: string;
  capacity: number;
  status: string;
  createdAt: string;
}

interface FormState {
  tableName: string;
  capacity: number;
  status: string;
}

const initialForm: FormState = {
  tableName: "",
  capacity: 2,
  status: "Available",
};

const STATUS_OPTIONS = ["Available", "Occupied", "Reserved", "Out of Service"];

const STATUS_STYLES: Record<string, { bg: string; text: string; dot: string; border: string }> = {
  Available: { bg: "#ecfdf5", text: "#047857", dot: "#10b981", border: "#a7f3d0" },
  Occupied: { bg: "#fef2f2", text: "#b91c1c", dot: "#ef4444", border: "#fecaca" },
  Reserved: { bg: "#fffbeb", text: "#b45309", dot: "#f59e0b", border: "#fde68a" },
  "Out of Service": { bg: "#f3f4f6", text: "#4b5563", dot: "#9ca3af", border: "#e5e7eb" },
};

const getRestaurantId = (): string => {
  try {
    const raw = localStorage.getItem("user");
    if (!raw) return "";
    const parsed = JSON.parse(raw);
    return parsed?.id || "";
  } catch {
    return "";
  }
};

const Tables: React.FC = () => {
  const restaurantId = getRestaurantId();

  const [tables, setTables] = useState<TableItem[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string>("");
  const [form, setForm] = useState<FormState>(initialForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [showForm, setShowForm] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>("");

  const fetchTables = useCallback(async () => {
    if (!restaurantId) {
      setError("No restaurant session found. Please log in again.");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`${API_BASE}?restaurantId=${encodeURIComponent(restaurantId)}`);
      const json = await res.json();

      if (!res.ok || !json.success) {
        throw new Error(json.message || "Failed to fetch tables.");
      }

      setTables(json.data || []);
    } catch (err: any) {
      console.error("Error fetching tables:", err);
      setError(err.message || "Something went wrong while fetching tables.");
    } finally {
      setLoading(false);
    }
  }, [restaurantId]);

  useEffect(() => {
    fetchTables();
  }, [fetchTables]);

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) => {
    const { name, value } = e.target;
    setForm((prev) => ({
      ...prev,
      [name]: name === "capacity" ? Number(value) : value,
    }));
  };

  const resetForm = () => {
    setForm(initialForm);
    setEditingId(null);
    setShowForm(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!restaurantId) {
      setError("No restaurant session found. Please log in again.");
      return;
    }
    setSubmitting(true);
    setError("");

    try {
      const isEditing = Boolean(editingId);
      const url = isEditing ? `${API_BASE}/${editingId}` : API_BASE;
      const method = isEditing ? "PUT" : "POST";

      const payload = { ...form, restaurantId };

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const json = await res.json();

      if (!res.ok || !json.success) {
        throw new Error(json.message || "Failed to save table.");
      }

      if (isEditing) {
        setTables((prev) =>
          prev.map((t) => (t._id === editingId ? json.data : t))
        );
      } else {
        setTables((prev) => [json.data, ...prev]);
      }

      resetForm();
    } catch (err: any) {
      console.error("Error saving table:", err);
      setError(err.message || "Something went wrong while saving the table.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleEdit = (table: TableItem) => {
    setEditingId(table._id);
    setForm({
      tableName: table.tableName || "",
      capacity: table.capacity || 2,
      status: table.status || "Available",
    });
    setShowForm(true);
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm("Are you sure you want to delete this table?")) return;

    setError("");
    try {
      const res = await fetch(`${API_BASE}/${id}`, { method: "DELETE" });
      const json = await res.json();

      if (!res.ok || !json.success) {
        throw new Error(json.message || "Failed to delete table.");
      }

      setTables((prev) => prev.filter((t) => t._id !== id));

      if (editingId === id) {
        resetForm();
      }
    } catch (err: any) {
      console.error("Error deleting table:", err);
      setError(err.message || "Something went wrong while deleting the table.");
    }
  };

  const filteredTables = tables.filter((t) => {
    const matchesRestaurant = String(t.restaurantId) === String(restaurantId);
    const matchesSearch = t.tableName.toLowerCase().includes(searchQuery.toLowerCase().trim());
    return matchesRestaurant && matchesSearch;
  });

  const counts = filteredTables.reduce<Record<string, number>>((acc, t) => {
    acc[t.status] = (acc[t.status] || 0) + 1;
    return acc;
  }, {});

  return (
    <div style={{ maxWidth: 1200, margin: "0 auto", padding: "12px 16px 48px", fontFamily: "inherit" }}>
      {/* Header */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: 16,
          marginBottom: 28,
          borderBottom: "1px solid #e5e7eb",
          paddingBottom: 16,
        }}
      >
        <div>
          <span style={{ fontSize: 13, fontWeight: 700, color: "#0d9488", textTransform: "uppercase", letterSpacing: "0.5px" }}>
            Billing & VAT Audit
          </span>
          <h1 style={{ fontSize: 28, fontWeight: 800, color: "#111827", margin: "2px 0 4px" }}>
            Tables Management
          </h1>
          <p style={{ fontSize: 14, color: "#6b7280", margin: 0 }}>
            Monitor live dining floors, structural table capacities, and active states.
          </p>
        </div>

        <button
          onClick={() => {
            resetForm();
            setShowForm((s) => !s);
          }}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            background: "#0d9488",
            color: "#fff",
            border: "none",
            borderRadius: 12,
            padding: "14px 22px",
            fontWeight: 700,
            fontSize: 15,
            cursor: "pointer",
            boxShadow: "0 4px 12px rgba(13, 148, 136, 0.2)",
            transition: "all 0.2s ease",
          }}
        >
          {showForm ? "Cancel Form" : "+ Add Table"}
        </button>
      </div>

      {/* Status Summary Cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 16, marginBottom: 24 }}>
        {STATUS_OPTIONS.map((status) => {
          const style = STATUS_STYLES[status];
          return (
            <div
              key={status}
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                background: "#fff",
                border: `1px solid ${style.border}`,
                borderLeft: `6px solid ${style.dot}`,
                borderRadius: 16,
                padding: "22px 24px",
                boxShadow: "0 2px 6px rgba(0,0,0,0.03)",
              }}
            >
              <div>
                <div style={{ fontSize: 13, color: "#4b5563", fontWeight: 700, marginBottom: 6 }}>{status}</div>
                <div style={{ fontSize: 32, fontWeight: 800, color: "#111827" }}>
                  {counts[status] || 0}
                </div>
              </div>
              <div
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: "12px",
                  background: style.bg,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <span
                  style={{
                    height: 14,
                    width: 14,
                    borderRadius: "50%",
                    background: style.dot,
                    display: "inline-block",
                  }}
                />
              </div>
            </div>
          );
        })}
      </div>

      {/* Search Bar */}
      <div style={{ marginBottom: 24 }}>
        <input
          type="text"
          placeholder="🔍 Search table by name..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          style={{
            width: "100%",
            padding: "16px 20px",
            borderRadius: 14,
            border: "1px solid #d1d5db",
            fontSize: 15,
            outline: "none",
            background: "#fff",
            boxShadow: "0 1px 3px rgba(0,0,0,0.02)",
            boxSizing: "border-box",
          }}
        />
      </div>

      {error && (
        <div
          style={{
            background: "#fef2f2",
            color: "#b91c1c",
            padding: "14px 16px",
            borderRadius: 12,
            marginBottom: 20,
            fontSize: 13,
            fontWeight: 600,
            border: "1px solid #fecaca",
          }}
        >
          {error}
        </div>
      )}

      {/* Create / Update Form */}
      {showForm && (
        <form
          onSubmit={handleSubmit}
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
            gap: 16,
            marginBottom: 28,
            background: "#fff",
            border: "1px solid #e5e7eb",
            padding: 28,
            borderRadius: 18,
            boxShadow: "0 10px 25px -5px rgba(0,0,0,0.05)",
          }}
        >
          <div>
            <label style={{ fontSize: 13, fontWeight: 700, color: "#374151", display: "block", marginBottom: 6 }}>
              Table Name
            </label>
            <input
              type="text"
              name="tableName"
              value={form.tableName}
              onChange={handleChange}
              required
              placeholder="Enter Table Name"
              style={{
                width: "100%",
                padding: "14px 16px",
                borderRadius: 12,
                border: "1px solid #d1d5db",
                fontSize: 15,
                boxSizing: "border-box",
                outline: "none",
              }}
            />
          </div>

          <div>
            <label style={{ fontSize: 13, fontWeight: 700, color: "#374151", display: "block", marginBottom: 6 }}>
              Capacity (Seats)
            </label>
            <input
              type="number"
              name="capacity"
              min={1}
              value={form.capacity}
              onChange={handleChange}
              required
              style={{
                width: "100%",
                padding: "14px 16px",
                borderRadius: 12,
                border: "1px solid #d1d5db",
                fontSize: 15,
                boxSizing: "border-box",
                outline: "none",
              }}
            />
          </div>

          <div>
            <label style={{ fontSize: 13, fontWeight: 700, color: "#374151", display: "block", marginBottom: 6 }}>
              Status
            </label>
            <select
              name="status"
              value={form.status}
              onChange={handleChange}
              style={{
                width: "100%",
                padding: "14px 16px",
                borderRadius: 12,
                border: "1px solid #d1d5db",
                fontSize: 15,
                boxSizing: "border-box",
                background: "#fff",
                outline: "none",
              }}
            >
              {STATUS_OPTIONS.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>

          <div style={{ gridColumn: "1 / -1", display: "flex", gap: 12, marginTop: 8 }}>
            <button
              type="submit"
              disabled={submitting}
              style={{
                padding: "14px 28px",
                background: "#0d9488",
                color: "#fff",
                border: "none",
                borderRadius: 12,
                fontWeight: 700,
                fontSize: 15,
                cursor: submitting ? "not-allowed" : "pointer",
                opacity: submitting ? 0.7 : 1,
              }}
            >
              {submitting ? "Saving..." : editingId ? "Save Changes" : "Create Table"}
            </button>
            <button
              type="button"
              onClick={resetForm}
              style={{
                padding: "14px 28px",
                background: "#f3f4f6",
                color: "#374151",
                border: "1px solid #e5e7eb",
                borderRadius: 12,
                fontWeight: 700,
                fontSize: 15,
                cursor: "pointer",
              }}
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      {/* Table Cards Grid Block */}
      {loading ? (
        <div style={{ textAlign: "center", padding: "40px", color: "#6b7280", fontSize: 15 }}>Loading tables...</div>
      ) : filteredTables.length === 0 ? (
        <div
          style={{
            textAlign: "center",
            padding: "60px 20px",
            background: "#fff",
            border: "1px dashed #d1d5db",
            borderRadius: 18,
            color: "#6b7280",
          }}
        >
          <p style={{ fontSize: 16, fontWeight: 700, margin: 0, color: "#374151" }}>No matching tables found</p>
          <p style={{ fontSize: 14, margin: "6px 0 0" }}>Try checking your search criteria or add a new table.</p>
        </div>
      ) : (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))",
            gap: 24,
          }}
        >
          {filteredTables.map((t) => {
            const style = STATUS_STYLES[t.status] || STATUS_STYLES.Available;
            return (
              <div
                key={t._id}
                style={{
                  background: "#fff",
                  border: "1px solid #e5e7eb",
                  borderRadius: 20,
                  padding: "36px 26px", // Increased vertical padding for more height
                  minHeight: "220px",    // Added a minimum height property
                  boxShadow: "0 6px 15px -3px rgba(0,0,0,0.05), 0 4px 6px -2px rgba(0,0,0,0.025)",
                  display: "flex",
                  flexDirection: "column",
                  justifyContent: "space-between",
                  gap: 20,
                  transition: "transform 0.2s ease, box-shadow 0.2s ease",
                }}
              >
                <div>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16 }}>
                    <h3 style={{ margin: 0, fontSize: 20, fontWeight: 800, color: "#111827" }}>
                      {t.tableName}
                    </h3>
                    <span
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 6,
                        background: style.bg,
                        color: style.text,
                        fontSize: 13,
                        fontWeight: 700,
                        padding: "8px 14px",
                        borderRadius: 999,
                      }}
                    >
                      <span style={{ height: 8, width: 8, borderRadius: "50%", background: style.dot }} />
                      {t.status}
                    </span>
                  </div>

                  <div style={{ fontSize: 14, color: "#4b5563", background: "#f9fafb", padding: "14px 18px", borderRadius: 12, display: "flex", justifyContent: "space-between", alignItems: "center", border: "1px solid #f3f4f6" }}>
                    <span>Capacity Seats:</span>
                    <strong style={{ color: "#111827", fontSize: 16 }}>{t.capacity} Persons</strong>
                  </div>
                </div>

                <div style={{ display: "flex", gap: 12 }}>
                  <button
                    onClick={() => handleEdit(t)}
                    style={{
                      flex: 1,
                      padding: "12px 0",
                      background: "#f0fdfa",
                      color: "#0d9488",
                      border: "1px solid #99f6e4",
                      borderRadius: 12,
                      fontWeight: 700,
                      fontSize: 14,
                      cursor: "pointer",
                      transition: "background 0.2s",
                    }}
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => handleDelete(t._id)}
                    style={{
                      flex: 1,
                      padding: "12px 0",
                      background: "#fef2f2",
                      color: "#dc2626",
                      border: "1px solid #fecaca",
                      borderRadius: 12,
                      fontWeight: 700,
                      fontSize: 14,
                      cursor: "pointer",
                      transition: "background 0.2s",
                    }}
                  >
                    Delete
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default Tables;