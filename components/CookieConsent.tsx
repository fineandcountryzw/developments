import React, { useState, useEffect } from 'react';
import { ShieldCheck, X } from 'lucide-react';

/**
 * Premium Cookie Consent v1.0
 * Fine & Country Zimbabwe executive standard notice.
 * Implements 30-day persistence logic.
 */

export const CookieConsent: React.FC = () => {
  const [isVisible, setIsVisible] = useState(false);
  const CONSENT_KEY = 'fc_erp_consent';
  const EXPIRY_DAYS = 30;

  useEffect(() => {
    const stored = localStorage.getItem(CONSENT_KEY);
    if (stored) {
      try {
        const { timestamp } = JSON.parse(stored);
        const daysPassed = (Date.now() - timestamp) / (1000 * 60 * 60 * 24);
        if (daysPassed >= EXPIRY_DAYS) {
          setIsVisible(true);
        }
      } catch (e) {
        setIsVisible(true);
      }
    } else {
      // Delay visibility for a smoother UX entrance
      const timer = setTimeout(() => setIsVisible(true), 1500);
      return () => clearTimeout(timer);
    }
    return undefined;
  }, []);

  const handleAccept = () => {
    const consentData = {
      accepted: true,
      timestamp: Date.now()
    };
    localStorage.setItem(CONSENT_KEY, JSON.stringify(consentData));
    setIsVisible(false);
  };

  if (!isVisible) return null;

  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 w-[90%] max-w-xl z-[9999] animate-in slide-in-from-bottom-8 fade-in duration-700 font-sans">
      <div className="bg-white border-t-4 border-fcGold rounded-2xl shadow-[0_20px_60px_-15px_rgba(15,23,42,0.3)] overflow-hidden">
        <div className="p-8 space-y-6">
          <div className="flex items-start justify-between">
            <div className="flex items-center space-x-4">
              <div className="p-3 bg-fcGold/10 rounded-xl text-fcGold">
                <ShieldCheck size={24} />
              </div>
              <h4 className="text-sm font-black text-fcSlate uppercase tracking-[0.2em]">Cookie Notice</h4>
            </div>
            <button 
              onClick={() => setIsVisible(false)}
              className="p-2 text-slate-300 hover:text-fcSlate transition-colors"
            >
              <X size={18} />
            </button>
          </div>

          <p className="text-xs font-medium text-gray-600 leading-relaxed tracking-tight">
            We use cookies to ensure your 72-hour reservation and session data remains persistent. By continuing to use this site, you consent to our use of cookies.
          </p>

          <div className="pt-2 flex justify-end">
            <button
              onClick={handleAccept}
              className="bg-fcGold text-white px-8 py-3.5 rounded-xl text-[10px] font-black uppercase tracking-[0.2em] shadow-xl shadow-fcGold/20 hover:brightness-110 transition-all font-sans"
            >
              Accept & Continue
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};