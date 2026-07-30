import React, { useState } from 'react';
import { 
  ShieldAlert, 
  Lock, 
  User, 
  Eye, 
  EyeOff, 
  Globe, 
  Activity,
  Building2
} from 'lucide-react';
import { Utensils, ChefHat, Soup } from "lucide-react";
interface LoginScreenProps {
  lang: 'en' | 'ne';
  setLang: (l: 'en' | 'ne') => void;
  onLoginSuccess: (token: string, userDetails?: any) => void;
}

export default function LoginScreen({ lang, setLang, onLoginSuccess }: LoginScreenProps) {
  const [pharmacyName, setPharmacyName] = useState('');
  const [staffId, setStaffId] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const t = {
    en: {
      portalTitle: "Authentication Portal",
      subtitle: "Restaurant Management System",
      pharmacyLabel: "Restaurant Name",
      pharmacyPlaceholder: "Enter registered Restaurant name",
      idLabel: "User ID",
      idPlaceholder: "Enter your ID",
      passLabel: "Access Password",
      passPlaceholder: "Enter password",
      loginBtn: "Authenticate & Enter",
      authenticating: "Verifying credentials...",
      errorHeader: "Access Denied",
      unauthorizedTip: "Only authorized people are permitted to access this panel.",
      envNote: "Staff credentials are secure and checked in real-time with server database records.",
      viewTitle: "Digital Restaurant",
      location: ""
    },
    ne: {
      portalTitle: "प्रमाणीकरण पोर्टल",
      subtitle: "क्लिनिक र फार्मेसी व्यवस्थापन प्रणाली",
      pharmacyLabel: "फार्मेसीको नाम",
      pharmacyPlaceholder: "फार्मेसीको नाम हाल्नुहोस्",
      idLabel: "प्रयोगकर्ता ID",
      idPlaceholder: "आफ्नो ID हाल्नुहोस्",
      passLabel: "पहुँच पासवर्ड",
      passPlaceholder: "पासवर्ड हाल्नुहोस्",
      loginBtn: "प्रमाणित गर्नुहोस् र प्रवेश गर्नुहोस्",
      authenticating: "प्रमाणीकरण हुँदैछ...",
      errorHeader: "पहुँच अस्वीकृत",
      unauthorizedTip: "केवल अधिकृत स्वास्थ्य र फार्मेसी कर्मचारीहरूलाई मात्र यो प्रणाली पहुँच गर्न अनुमति छ।",
      envNote: "कर्मचारी परिचयपत्र सुरक्षित छन् र वास्तविक-समय डाटाबेस रेकर्डहरूसँग जाँच गरिन्छ।",
      viewTitle: "डिजिटल फार्मेसी",
      location: "अस्पताल रोड, बुटवल"
    }
  }[lang];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setIsLoading(true);

    try {
      const response = await fetch(' https://demo-rms.onrender.com/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          pharmacyName: pharmacyName.trim(), 
          id: staffId.trim(),                
          password                        
        }),
      });

      const data = await response.json();

      if (response.ok && data.success) {
        // index.js login route returns { success, message, user: {...} } — use data.user directly
        const userDetails = data.user;

        // PharmacySettings.jsx reads localStorage.getItem("pharmacyUser"), so this MUST be the key used here
        localStorage.setItem('pharmacyUser', JSON.stringify(userDetails));

        // Forward to App.tsx, which will route based on userDetails.isAdmin / role
        onLoginSuccess(data.token, userDetails);
      } else {
        setErrorMsg(data.message || t.errorHeader);
      }
    } catch (err) {
      setErrorMsg(lang === 'en' ? 'Unable to connect to authentication server.' : 'प्रमाणीकरण सर्भरमा जडान गर्न असमर्थ।');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col justify-center items-center p-4 relative overflow-hidden font-sans text-slate-800 selection:bg-teal-100 selection:text-teal-900">
      
      {/* Visual background details */}
      <div className="absolute top-[-20%] left-[-10%] w-[50%] h-[50%] rounded-full bg-teal-200/20 blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[-20%] right-[-10%] w-[50%] h-[50%] rounded-full bg-indigo-200/20 blur-[120px] pointer-events-none" />

      {/* Floating Language Switcher */}
    

      <div className="w-full max-w-md space-y-6" id="login-container">
        
        {/* Core Auth Card */}
        <div className="bg-white border border-slate-100 rounded-3xl shadow-xl p-6 sm:p-8 space-y-6 relative" id="login-card">
          
          {/* Medical Icon Emblem */}
          <div className="flex flex-col items-center text-center space-y-3" id="login-header">
            <div className="h-14 w-14 bg-orange-50 rounded-2xl flex items-center justify-center text-orange-600 border border-orange-100 shadow-xs relative group">
  <div className="absolute inset-0 bg-orange-400/5 rounded-2xl blur-xs group-hover:blur-md transition-all animate-pulse" />
  <Utensils className="h-7 w-7 relative z-10" />
</div>
            
            <div className="space-y-1">
              <h2 className="text-xl font-black text-slate-900 tracking-tight">{t.viewTitle}</h2>
              <p className="text-[10px] text-teal-600 uppercase tracking-widest font-extrabold">{t.location}</p>
              <h3 className="text-sm font-semibold text-slate-500 pt-1.5">{t.portalTitle}</h3>
              <p className="text-[10px] text-slate-400 max-w-xs mx-auto">{t.subtitle}</p>
            </div>
          </div>

          {/* Alert messages */}
          {errorMsg && (
            <div className="p-3.5 bg-red-50 border border-red-100 rounded-2xl text-xs text-red-700 flex gap-2.5 items-start" id="login-error-alert">
              <ShieldAlert className="h-4.5 w-4.5 text-red-500 shrink-0 mt-0.5" />
              <div className="space-y-0.5">
                <span className="font-bold block">{t.errorHeader}</span>
                <p className="opacity-90">{errorMsg}</p>
              </div>
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4" id="login-form">
            
            {/* Pharmacy Name Field */}
            <div className="space-y-1.5">
              <label className="text-[10px] font-extrabold text-slate-500 uppercase tracking-wider block">{t.pharmacyLabel}</label>
              <div className="relative">
                <Building2 className="absolute left-3.5 top-3 w-4.5 h-4.5 text-slate-400" />
                <input
                  type="text"
                  required
                  value={pharmacyName}
                  onChange={(e) => setPharmacyName(e.target.value)}
                  placeholder={t.pharmacyPlaceholder}
                  disabled={isLoading}
                  className="w-full pl-10 pr-4 py-2.5 bg-slate-50/55 border border-slate-200 rounded-xl text-sm placeholder-slate-400 focus:outline-hidden focus:border-teal-500 focus:ring-1 focus:ring-teal-500 transition-all text-slate-800 font-medium"
                />
              </div>
            </div>

            {/* Staff ID Field */}
            <div className="space-y-1.5">
              <label className="text-[10px] font-extrabold text-slate-500 uppercase tracking-wider block">{t.idLabel}</label>
              <div className="relative">
                <User className="absolute left-3.5 top-3 w-4.5 h-4.5 text-slate-400" />
                <input
                  type="text"
                  required
                  value={staffId}
                  onChange={(e) => setStaffId(e.target.value)}
                  placeholder={t.idPlaceholder}
                  disabled={isLoading}
                  className="w-full pl-10 pr-4 py-2.5 bg-slate-50/55 border border-slate-200 rounded-xl text-sm placeholder-slate-400 focus:outline-hidden focus:border-teal-500 focus:ring-1 focus:ring-teal-500 transition-all text-slate-800 font-medium"
                />
              </div>
            </div>

            {/* Password Field */}
            <div className="space-y-1.5">
              <label className="text-[10px] font-extrabold text-slate-500 uppercase tracking-wider block">{t.passLabel}</label>
              <div className="relative">
                <Lock className="absolute left-3.5 top-3 w-4.5 h-4.5 text-slate-400" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder={t.passPlaceholder}
                  disabled={isLoading}
                  className="w-full pl-10 pr-10 py-2.5 bg-slate-50/55 border border-slate-200 rounded-xl text-sm placeholder-slate-400 focus:outline-hidden focus:border-teal-500 focus:ring-1 focus:ring-teal-500 transition-all text-slate-800 font-medium"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-3 text-slate-400 hover:text-slate-600 transition-colors cursor-pointer"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            {/* Submit Button */}
           <button
  type="submit"
  disabled={isLoading}
  className="w-full py-3 bg-teal-600 hover:bg-teal-500 disabled:bg-slate-100 disabled:text-slate-400 text-white font-bold text-xs uppercase tracking-wider rounded-xl transition-all shadow-md shadow-orange-600/10 hover:shadow-orange-600/20 active:scale-[0.98] cursor-pointer mt-2"
>
  {isLoading ? t.authenticating : t.loginBtn}
</button>
          </form>
        </div>

        {/* Security watermark footer */}
        <div className="text-center space-y-1 opacity-80">
          <p className="text-[10px] text-slate-400">{t.unauthorizedTip}</p>
          <p className="text-[9px] font-bold uppercase tracking-wider">{t.envNote}</p>
        </div>

              <p>Restaurant Name = Test</p>
              <p>Id = 321</p>
              <p>Password = 321</p>


      </div>
    </div>
  );
}