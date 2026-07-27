import React, { useState, useEffect } from "react";

const API_BASE = "https://rms-0wk0.onrender.com";

export default function PharmacySettings() {
  const [user, setUser] = useState(null);
  const [activeTab, setActiveTab] = useState("details");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState({ type: "", text: "" });

  const [credForm, setCredForm] = useState({ id: "", password: "", confirmPassword: "" });
  const [detailsForm, setDetailsForm] = useState({
    pharmacyName: "",
    phone: "",
    email: "",
    location: "",
    PanOrVat: "",
  });

  useEffect(() => {
    const storedUser = localStorage.getItem("pharmacyUser");
    if (storedUser) {
      const parsed = JSON.parse(storedUser);
      setUser(parsed);
      setCredForm((prev) => ({ ...prev, id: parsed.id }));
      setDetailsForm({
        pharmacyName: parsed.pharmacyName || "",
        phone: parsed.phone || "",
        email: parsed.email || "",
        location: parsed.location || "",
        PanOrVat: parsed.PanOrVat || "",
      });
    }
  }, []);

  const showMessage = (type, text) => {
    setMessage({ type, text });
    setTimeout(() => setMessage({ type: "", text: "" }), 4000);
  };

  const updateUser = async (payload) => {
    if (!user || !user._id) {
      showMessage("error", "User session not found. Please log in again.");
      return null;
    }
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/admin/users/${user._id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      setLoading(false);
      if (!data.success) {
        showMessage("error", data.message || "Something went wrong.");
        return null;
      }
      return data.data;
    } catch (err) {
      setLoading(false);
      showMessage("error", "Network error. Please try again.");
      return null;
    }
  };

  const handleCredentialSubmit = async (e) => {
    e.preventDefault();

    if (!credForm.id.trim()) {
      showMessage("error", "ID cannot be empty.");
      return;
    }
    if (credForm.password && credForm.password.length < 4) {
      showMessage("error", "Password must be at least 4 characters.");
      return;
    }
    if (credForm.password !== credForm.confirmPassword) {
      showMessage("error", "Passwords do not match.");
      return;
    }

    const payload = { id: credForm.id.trim() };
    if (credForm.password) payload.password = credForm.password;

    const updated = await updateUser(payload);
    if (updated) {
      const merged = { ...user, ...updated };
      setUser(merged);
      localStorage.setItem("pharmacyUser", JSON.stringify(merged));
      setCredForm({ id: merged.id, password: "", confirmPassword: "" });
      showMessage("success", "Credentials updated successfully!");
    }
  };

  const handleDetailsSubmit = async (e) => {
    e.preventDefault();

    if (!detailsForm.pharmacyName || !detailsForm.phone || !detailsForm.email || !detailsForm.location) {
      showMessage("error", "Please fill all required fields.");
      return;
    }

    const updated = await updateUser(detailsForm);
    if (updated) {
      const merged = { ...user, ...updated };
      setUser(merged);
      localStorage.setItem("pharmacyUser", JSON.stringify(merged));
      showMessage("success", "Pharmacy details updated successfully!");
    }
  };

  if (!user) {
    return (
      <div style={styles.centerScreen}>
        <p style={{ color: "#64748b", fontSize: 16 }}>
          No user session found. Please log in first.
        </p>
      </div>
    );
  }

  return (
    <div style={styles.page}>
      <div style={styles.container}>
        <div style={styles.header}>
          <h1 style={styles.title}>Restaurant Settings</h1>
          <p style={styles.subtitle}>Manage your Restaurant account and preferences</p>
        </div>

        {message.text && (
          <div
            style={{
              ...styles.banner,
              backgroundColor: message.type === "success" ? "#ecfdf5" : "#fef2f2",
              color: message.type === "success" ? "#065f46" : "#991b1b",
              borderColor: message.type === "success" ? "#a7f3d0" : "#fecaca",
            }}
          >
            {message.text}
          </div>
        )}

        <div style={styles.tabBar}>
          <TabButton
            active={activeTab === "details"}
            onClick={() => setActiveTab("details")}
            label="Our Details"
            icon="🏥"
          />
          <TabButton
            active={activeTab === "credentials"}
            onClick={() => setActiveTab("credentials")}
            label="Change ID & Password"
            icon="🔑"
          />
          <TabButton
            active={activeTab === "otherDetails"}
            onClick={() => setActiveTab("otherDetails")}
            label="Change Other Details"
            icon="✏️"
          />
        </div>

        <div style={styles.card}>
          {activeTab === "details" && (
            <div>
              <h2 style={styles.sectionTitle}>Our Details</h2>
              <p style={styles.sectionDesc}>Your registered Restaurant information</p>
              <div style={styles.detailsGrid}>
                <DetailRow label="Restaurant Name" value={user.pharmacyName} icon="🏥" />
                <DetailRow label="PAN / VAT Number" value={user.PanOrVat || "Not provided"} icon="🧾" />
                <DetailRow label="Phone Number" value={user.phone} icon="📞" />
                <DetailRow label="Email" value={user.email} icon="✉️" />
                <DetailRow label="Location" value={user.location} icon="📍" />
                <DetailRow label="Restaurant ID" value={user.id} icon="🆔" />
                <DetailRow label="Password" value="••••••••" icon="🔒" />
              </div>
            </div>
          )}

          {activeTab === "credentials" && (
            <div>
              <h2 style={styles.sectionTitle}>Change ID & Password</h2>
              <p style={styles.sectionDesc}>Update your login credentials</p>
              <form onSubmit={handleCredentialSubmit} style={styles.form}>
                <FormField
                  label="Pharmacy ID"
                  value={credForm.id}
                  onChange={(v) => setCredForm({ ...credForm, id: v })}
                  placeholder="Enter new ID"
                />
                <FormField
                  label="New Password"
                  type="password"
                  value={credForm.password}
                  onChange={(v) => setCredForm({ ...credForm, password: v })}
                  placeholder="Leave blank to keep current password"
                />
                <FormField
                  label="Confirm New Password"
                  type="password"
                  value={credForm.confirmPassword}
                  onChange={(v) => setCredForm({ ...credForm, confirmPassword: v })}
                  placeholder="Re-enter new password"
                />
                <button type="submit" disabled={loading} style={styles.submitBtn}>
                  {loading ? "Updating..." : "Update Credentials"}
                </button>
              </form>
            </div>
          )}

          {activeTab === "otherDetails" && (
            <div>
              <h2 style={styles.sectionTitle}>Change Other Details</h2>
              <p style={styles.sectionDesc}>Update your pharmacy profile information</p>
              <form onSubmit={handleDetailsSubmit} style={styles.form}>
                <FormField
                  label="Restaurant Name"
                  value={detailsForm.pharmacyName}
                  onChange={(v) => setDetailsForm({ ...detailsForm, pharmacyName: v })}
                  placeholder="Enter Restaurant name"
                />
                <FormField
                  label="PAN / VAT Number"
                  value={detailsForm.PanOrVat}
                  onChange={(v) => setDetailsForm({ ...detailsForm, PanOrVat: v })}
                  placeholder="Enter PAN or VAT number"
                />
                <FormField
                  label="Phone Number"
                  value={detailsForm.phone}
                  onChange={(v) => setDetailsForm({ ...detailsForm, phone: v })}
                  placeholder="Enter phone number"
                />
                <FormField
                  label="Email"
                  type="email"
                  value={detailsForm.email}
                  onChange={(v) => setDetailsForm({ ...detailsForm, email: v })}
                  placeholder="Enter email address"
                />
                <FormField
                  label="Location"
                  value={detailsForm.location}
                  onChange={(v) => setDetailsForm({ ...detailsForm, location: v })}
                  placeholder="Enter Restaurant location"
                />
                <button type="submit" disabled={loading} style={styles.submitBtn}>
                  {loading ? "Saving..." : "Save Changes"}
                </button>
              </form>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function TabButton({ active, onClick, label, icon }) {
  return (
    <button
      onClick={onClick}
      style={{
        ...styles.tabButton,
        backgroundColor: active ? "#0f766e" : "#ffffff",
        color: active ? "#ffffff" : "#334155",
        boxShadow: active ? "0 4px 12px rgba(15,118,110,0.25)" : "0 1px 3px rgba(0,0,0,0.06)",
      }}
    >
      <span style={{ marginRight: 8 }}>{icon}</span>
      {label}
    </button>
  );
}

function DetailRow({ label, value, icon }) {
  return (
    <div style={styles.detailRow}>
      <div style={styles.detailIcon}>{icon}</div>
      <div>
        <div style={styles.detailLabel}>{label}</div>
        <div style={styles.detailValue}>{value}</div>
      </div>
    </div>
  );
}

function FormField({ label, value, onChange, type = "text", placeholder }) {
  return (
    <div style={styles.fieldWrap}>
      <label style={styles.fieldLabel}>{label}</label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        style={styles.input}
      />
    </div>
  );
}

const styles = {
  page: {
    minHeight: "100vh",
    backgroundColor: "#f1f5f9",
    padding: "40px 20px",
    fontFamily: "'Segoe UI', Roboto, -apple-system, sans-serif",
  },
  centerScreen: {
    minHeight: "100vh",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#f1f5f9",
  },
  container: {
    maxWidth: 900,
    margin: "0 auto",
  },
  header: {
    marginBottom: 28,
  },
  title: {
    fontSize: 30,
    fontWeight: 700,
    color: "#0f172a",
    margin: 0,
  },
  subtitle: {
    fontSize: 15,
    color: "#64748b",
    marginTop: 6,
  },
  banner: {
    padding: "12px 16px",
    borderRadius: 10,
    border: "1px solid",
    marginBottom: 20,
    fontSize: 14,
    fontWeight: 500,
  },
  tabBar: {
    display: "flex",
    gap: 10,
    marginBottom: 24,
    flexWrap: "wrap",
  },
  tabButton: {
    padding: "12px 20px",
    borderRadius: 10,
    border: "none",
    cursor: "pointer",
    fontSize: 14,
    fontWeight: 600,
    transition: "all 0.2s ease",
  },
  card: {
    backgroundColor: "#ffffff",
    borderRadius: 16,
    padding: "32px",
    boxShadow: "0 2px 8px rgba(0,0,0,0.06)",
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 700,
    color: "#0f172a",
    margin: 0,
  },
  sectionDesc: {
    fontSize: 14,
    color: "#64748b",
    marginTop: 4,
    marginBottom: 24,
  },
  detailsGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))",
    gap: 16,
  },
  detailRow: {
    display: "flex",
    alignItems: "flex-start",
    gap: 14,
    padding: "16px",
    backgroundColor: "#f8fafc",
    borderRadius: 12,
    border: "1px solid #e2e8f0",
  },
  detailIcon: {
    fontSize: 20,
  },
  detailLabel: {
    fontSize: 12,
    color: "#94a3b8",
    fontWeight: 600,
    textTransform: "uppercase",
    letterSpacing: 0.4,
  },
  detailValue: {
    fontSize: 15,
    color: "#0f172a",
    fontWeight: 600,
    marginTop: 3,
    wordBreak: "break-word",
  },
  form: {
    display: "flex",
    flexDirection: "column",
    gap: 18,
    maxWidth: 480,
  },
  fieldWrap: {
    display: "flex",
    flexDirection: "column",
    gap: 6,
  },
  fieldLabel: {
    fontSize: 13,
    fontWeight: 600,
    color: "#334155",
  },
  input: {
    padding: "12px 14px",
    borderRadius: 10,
    border: "1px solid #cbd5e1",
    fontSize: 14,
    outline: "none",
  },
  submitBtn: {
    marginTop: 10,
    padding: "13px 20px",
    borderRadius: 10,
    border: "none",
    backgroundColor: "#0f766e",
    color: "#ffffff",
    fontSize: 15,
    fontWeight: 600,
    cursor: "pointer",
  },
};