import React, { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { Loader2, Lock, User2, ShieldCheck, AlertCircle } from "lucide-react";

/* ------------------------------------------------------------------ */
/*  Role → access configuration                                        */
/*  Export this map so ProtectedRoute / App.tsx can reuse the same     */
/*  source of truth instead of hardcoding role strings elsewhere.      */
/* ------------------------------------------------------------------ */

export type StaffRole =
  | "Manager"
  | "Doctor"
  | "Receptionist"
  | "Inventory Manager"
  | "Accounts & Billing Officer";

interface RoleConfig {
  label: StaffRole;
  description: string;
  pages: string[];
  redirectTo: string;
}
 
export const ROLE_ACCESS: Record<StaffRole, RoleConfig> = {
 Manager: {
    label: "Manager",
    description: "Full access including settings",
    pages: ["Dashboard", "Patients", "EMR", "POS", "Inventory", "Staff", "Settings"], 
    redirectTo: "/dashboard",
  },
  Doctor: {
    label: "Doctor",
    description: "Patient records & prescriptions access",
    pages: ["EMR (Electronic Medical Records)", "Patients & Registrations"],
    redirectTo: "/emr",
  },
  
  Receptionist: {
    label: "Receptionist",
    description: "Front-desk & medical record access",
    pages: ["Patients & Registrations", "EMR (Electronic Medical Records)"],
    redirectTo: "/patients",
  },
  "Inventory Manager": {
    label: "Inventory Manager",
    description: "Stock & purchasing access only",
    pages: ["Inventory & POs"],
    redirectTo: "/inventory",
  },
  "Accounts & Billing Officer": {
    label: "Accounts & Billing Officer",
    description: "Sales & billing access only",
    pages: ["Pharmacy POS (Sales)", "Billing & VAT Audit"],
    redirectTo: "/pos",
  },
};

const API_URL = process.env.REACT_APP_API_URL || " https://demo-rms.onrender.com";

/* ------------------------------------------------------------------ */

const StaffLogin: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();

  // pharmacyName is handed off from the pharmacy login page via route state.
  // Fall back to localStorage in case of a page refresh on this screen.
  const pharmacyName: string =
    (location.state as { pharmacyName?: string })?.pharmacyName ||
    localStorage.getItem("pharmacyName") ||
    "";

  const [id, setId] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [unlockedRole, setUnlockedRole] = useState<StaffRole | null>(null);

  useEffect(() => {
    if (!pharmacyName) {
      // No pharmacy context — staff can't log in without knowing which
      // pharmacy they belong to, so bounce back to the pharmacy login.
      setError("No pharmacy selected. Please log in from the pharmacy login page first.");
    }
  }, [pharmacyName]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!id.trim() || !password.trim()) {
      setError("Enter both staff ID and password.");
      return;
    }
    if (!pharmacyName) {
      setError("No pharmacy selected. Please log in from the pharmacy login page first.");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/api/staff/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: id.trim(), password, pharmacyName }),
      });

   const data = await res.json();

if (!res.ok) {
  // Catch the 403 status specifically
  if (res.status === 403) {
    setError("Your account is deactivated. Only active staff can log in.");
  } else {
    setError(data?.message || "Invalid staff ID or password.");
  }
  setLoading(false);
  return;
}      

      const role = data?.user?.role as StaffRole;
      if (!role || !ROLE_ACCESS[role]) {
        setError("This staff account has no recognized role. Contact your admin.");
        setLoading(false);
        return;
      }

      // Persist session
      localStorage.setItem("staffToken", data.token);
      localStorage.setItem("staffId", data.user.id);
      localStorage.setItem("staffRole", role);
      localStorage.setItem("pharmacyName", data.user.pharmacyName || pharmacyName);

      // Briefly reveal which access key unlocked before redirecting
      setUnlockedRole(role);
      setLoading(false);

      setTimeout(() => {
        navigate(ROLE_ACCESS[role].redirectTo, { replace: true });
      }, 700);
    } catch (err) {
      setError("Could not reach the server. Please try again.");
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-full flex bg-white font-[Inter]">
      {/* ---------------- Brand / access panel ---------------- */}
      <div className="hidden md:flex md:w-[42%] flex-col justify-between bg-[#123832] text-[#EFF7F3] px-10 py-12 relative overflow-hidden">
        <div
          className="pointer-events-none absolute -right-24 -top-24 w-72 h-72 rounded-full opacity-20"
          style={{ background: "radial-gradient(circle, #7FE3C6 0%, transparent 70%)" }}
        />
        <div>
          <p className="uppercase tracking-[0.2em] text-xs text-[#7FE3C6] font-[IBM_Plex_Mono,monospace]">
            Staff Terminal
          </p>
          <h1
            className="mt-3 text-4xl leading-tight font-[Fraunces,serif]"
            style={{ fontOpticalSizing: "auto" }}
          >
            {pharmacyName || "Select a restaurant"}
          </h1>
          <p className="mt-4 text-sm text-[#B9D6CC] max-w-xs">
            Sign in with your staff ID. What you see next depends on your role —
            not everyone at the counter needs the same keys.
          </p>
        </div>

        {/* Signature element: role access keys, one lights up on success */}
        <div className="space-y-3 relative z-10">
          {(Object.keys(ROLE_ACCESS) as StaffRole[]).map((roleKey) => {
            const role = ROLE_ACCESS[roleKey];
            const isActive = unlockedRole === roleKey;
            return (
              <div
                key={roleKey}
                className={`flex items-start gap-3 rounded-md border px-4 py-3 transition-all duration-500 ${
                  isActive
                    ? "border-[#7FE3C6] bg-[#0F2A2E] shadow-[0_0_0_1px_#7FE3C6]"
                    : "border-[#2A554C] bg-transparent opacity-70"
                }`}
              >
                <ShieldCheck
                  size={18}
                  className={`mt-0.5 shrink-0 ${isActive ? "text-[#7FE3C6]" : "text-[#4C7A6F]"}`}
                />
                <div>
                  <p
                    className={`text-sm font-medium font-[IBM_Plex_Mono,monospace] ${
                      isActive ? "text-[#7FE3C6]" : "text-[#DCE6E2]"
                    }`}
                  >
                    {role.label}
                  </p>
                  <p className="text-xs text-[#9FC2B7] mt-0.5">{role.pages.join(" · ")}</p>
                </div>
              </div>
            );
          })}
        </div>

        <p className="text-xs text-[#5C8A7D] relative z-10">
          Wrong counter? Head back to the pharmacy login to switch accounts.
        </p>
      </div>

      {/* ---------------- Form panel ---------------- */}
      <div className="flex-1 flex items-center justify-center px-6 py-16 bg-[#F5F2EA] md:bg-white">
        <form onSubmit={handleSubmit} className="w-full max-w-sm">
          <div className="md:hidden mb-8">
            <p className="uppercase tracking-[0.2em] text-xs text-[#4C7A6F] font-[IBM_Plex_Mono,monospace]">
              Staff Terminal
            </p>
            <h1 className="mt-1 text-2xl font-[Fraunces,serif] text-[#123832]">
              {pharmacyName || "Select a restaurant"}
            </h1>
          </div>

          <h2 className="text-2xl font-[Fraunces,serif] text-[#123832] mb-1">Staff sign in</h2>
          <p className="text-sm text-[#5B6B66] mb-8">
            Enter the ID and password issued by your pharmacy admin.
          </p>

          {error && (
            <div className="mb-5 flex items-start gap-2 rounded-md border border-[#E2A33D]/40 bg-[#FBF1DD] px-3 py-2.5 text-sm text-[#7A5416]">
              <AlertCircle size={16} className="mt-0.5 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <label className="block text-xs font-medium tracking-wide text-[#1C2B28] mb-1.5">
            Staff ID
          </label>
          <div className="mb-5 flex items-center gap-2 rounded-md border border-[#DCE6E2] focus-within:border-[#123832] focus-within:ring-1 focus-within:ring-[#123832] px-3 py-2.5 bg-white transition-colors">
            <User2 size={16} className="text-[#5B6B66]" />
            <input
              type="text"
              value={id}
              onChange={(e) => setId(e.target.value)}
              placeholder="Enter ID
              className="w-full outline-none text-sm text-[#1C2B28] placeholder:text-[#A9B6B1] font-[IBM_Plex_Mono,monospace]"
              autoComplete="username"
            />
          </div>

          <label className="block text-xs font-medium tracking-wide text-[#1C2B28] mb-1.5">
            Password
          </label>
          <div className="mb-6 flex items-center gap-2 rounded-md border border-[#DCE6E2] focus-within:border-[#123832] focus-within:ring-1 focus-within:ring-[#123832] px-3 py-2.5 bg-white transition-colors">
            <Lock size={16} className="text-[#5B6B66]" />
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="w-full outline-none text-sm text-[#1C2B28] placeholder:text-[#A9B6B1]"
              autoComplete="current-password"
            />
          </div>

          <button
            type="submit"
            disabled={loading || !!unlockedRole}
            className="w-full flex items-center justify-center gap-2 rounded-md bg-[#123832] text-[#EFF7F3] text-sm font-medium py-3 hover:bg-[#0F2A2E] disabled:opacity-70 transition-colors"
          >
            {loading && <Loader2 size={16} className="animate-spin" />}
            {unlockedRole
              ? `Welcome, ${unlockedRole} — redirecting…`
              : loading
              ? "Checking credentials…"
              : "Sign in"}
          </button>

          <button
            type="button"
            onClick={() => navigate("/")}
            className="w-full text-center text-xs text-[#5B6B66] mt-5 hover:text-[#123832] transition-colors"
          >
            ← Back to Restaurant login
          </button>
        </form>
      </div>
    </div>
  );
};

export default StaffLogin;