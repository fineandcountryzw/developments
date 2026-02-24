import React, { useRef } from 'react';
import { X, LogOut, User, MapPin, Mail, Phone, Shield, AlertCircle } from 'lucide-react';
import { Role, Branch } from '../types.ts';

interface ProfileDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  onLogout: () => void;
  userName: string;
  userEmail?: string;
  userPhone?: string;
  userRole: Role;
  userBranch: Branch;
}

export const ProfileDrawer: React.FC<ProfileDrawerProps> = ({
  isOpen,
  onClose,
  onLogout,
  userName,
  userEmail,
  userPhone,
  userRole,
  userBranch
}) => {
  const [startY, setStartY] = React.useState(0);
  const [currentY, setCurrentY] = React.useState(0);
  const [showLogoutConfirm, setShowLogoutConfirm] = React.useState(false);

  const handleTouchStart = (e: React.TouchEvent) => {
    setStartY(e.touches[0].clientY);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    const deltaY = e.touches[0].clientY - startY;
    if (deltaY > 0) setCurrentY(deltaY);
  };

  const handleTouchEnd = () => {
    if (currentY > 100) onClose();
    setCurrentY(0);
  };

  const handleLogoutClick = () => {
    setShowLogoutConfirm(true);
  };

  const handleLogoutConfirm = () => {
    // Clear all local storage and session data
    console.log('[FORENSIC][LOGOUT]', {
      user: userName,
      role: userRole,
      branch: userBranch,
      timestamp: new Date().toISOString(),
      clearingLocalStorage: true
    });
    
    // Clear all local storage
    localStorage.clear();
    sessionStorage.clear();
    
    // Call parent logout function
    onLogout();
  };

  const getBranchName = (branch: Branch) => {
    return branch === 'Harare' ? 'Harare HQ' : 'Bulawayo Branch';
  };

  const getRoleBadgeColor = (role: Role) => {
    switch (role) {
      case 'Admin': return 'bg-fcGold text-white';
      case 'Agent': return 'bg-blue-600 text-white';
      case 'Client': return 'bg-green-600 text-white';
      default: return 'bg-slate-600 text-white';
    }
  };

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div 
        className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[100] animate-in fade-in duration-300"
        onClick={onClose}
      />
      
      {/* Drawer */}
      <div 
        className="fixed bottom-0 left-0 right-0 z-[101] animate-in slide-in-from-bottom duration-300"
        style={{ transform: `translateY(${currentY}px)` }}
      >
        {/* Handle */}
        <div 
          className="bg-white rounded-t-[32px] pb-2 pt-4 px-6 touch-manipulation"
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
        >
          <div className="w-12 h-1.5 bg-slate-200 rounded-full mx-auto" />
        </div>

        {/* Content */}
        <div className="bg-white px-6 pb-8 pb-safe max-h-[70vh] overflow-y-auto">
          {/* Header */}
          <div className="flex items-start justify-between mb-6">
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-fcGold to-amber-600 flex items-center justify-center text-white flex-shrink-0">
                <User size={32} strokeWidth={2} />
              </div>
              <div>
                <h2 className="text-2xl font-black text-fcSlate tracking-tight font-sans">
                  {userName}
                </h2>
                <span className={`inline-block mt-1 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider ${getRoleBadgeColor(userRole)} font-sans`}>
                  {userRole}
                </span>
              </div>
            </div>
            <button 
              onClick={onClose}
              className="p-2 -mr-2 text-gray-600 hover:text-gray-600 active:scale-90 transition-all touch-manipulation"
            >
              <X size={24} />
            </button>
          </div>

          {/* User Details */}
          <div className="space-y-4 mb-6">
            {/* Branch */}
            <div className="flex items-center gap-3 p-4 rounded-xl bg-white border border-slate-100">
              <div className="w-10 h-10 rounded-full bg-white flex items-center justify-center text-fcGold flex-shrink-0">
                <MapPin size={18} />
              </div>
              <div className="flex-1">
                <div className="text-xs font-bold text-gray-600 uppercase tracking-wider mb-0.5 font-sans">
                  Regional Node
                </div>
                <div className="text-sm font-black text-fcSlate font-sans">
                  {getBranchName(userBranch)}
                </div>
              </div>
            </div>

            {/* Email */}
            {userEmail && (
              <div className="flex items-center gap-3 p-4 rounded-xl bg-white border border-slate-100">
                <div className="w-10 h-10 rounded-full bg-white flex items-center justify-center text-fcGold flex-shrink-0">
                  <Mail size={18} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-bold text-gray-600 uppercase tracking-wider mb-0.5 font-sans">
                    Email Address
                  </div>
                  <div className="text-sm font-semibold text-fcSlate truncate font-sans">
                    {userEmail}
                  </div>
                </div>
              </div>
            )}

            {/* Phone */}
            {userPhone && (
              <div className="flex items-center gap-3 p-4 rounded-xl bg-white border border-slate-100">
                <div className="w-10 h-10 rounded-full bg-white flex items-center justify-center text-fcGold flex-shrink-0">
                  <Phone size={18} />
                </div>
                <div className="flex-1">
                  <div className="text-xs font-bold text-gray-600 uppercase tracking-wider mb-0.5 font-sans">
                    Contact Number
                  </div>
                  <div className="text-sm font-black text-fcSlate font-sans">
                    {userPhone}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Logout Confirmation */}
          {showLogoutConfirm ? (
            <div className="space-y-4 p-5 rounded-2xl bg-red-50 border-2 border-red-200 mb-6 animate-in fade-in zoom-in-95 duration-200">
              <div className="flex items-start gap-3">
                <AlertCircle size={20} className="text-red-600 flex-shrink-0 mt-0.5" />
                <div>
                  <h3 className="text-sm font-black text-red-900 mb-1 font-sans">
                    Confirm Logout
                  </h3>
                  <p className="text-xs text-red-700 leading-relaxed font-sans">
                    This will end your session and clear all local data. You'll need to log in again to access the system.
                  </p>
                </div>
              </div>
              <div className="flex gap-3">
                <button
                  onClick={() => setShowLogoutConfirm(false)}
                  className="flex-1 h-12 rounded-xl font-bold uppercase tracking-wider text-xs bg-white text-gray-600 border-2 border-slate-200 active:scale-95 transition-all touch-manipulation font-sans"
                >
                  Cancel
                </button>
                <button
                  onClick={handleLogoutConfirm}
                  className="flex-1 h-12 rounded-xl font-bold uppercase tracking-wider text-xs bg-red-600 text-white active:scale-95 transition-all touch-manipulation font-sans"
                >
                  Logout
                </button>
              </div>
            </div>
          ) : (
            /* Logout Button */
            <button
              onClick={handleLogoutClick}
              className="w-full h-14 rounded-2xl bg-gradient-to-r from-red-600 to-red-500 text-white font-black uppercase tracking-wider text-sm flex items-center justify-center gap-3 transition-all active:scale-95 shadow-lg hover:shadow-xl touch-manipulation font-sans"
            >
              <LogOut size={20} />
              <span>Logout</span>
            </button>
          )}

          {/* Security Notice */}
          <div className="mt-6 p-4 rounded-xl bg-amber-50 border border-amber-200">
            <div className="flex items-start gap-3">
              <Shield size={16} className="text-amber-600 flex-shrink-0 mt-0.5" />
              <p className="text-xs text-amber-800 leading-relaxed font-sans">
                <span className="font-bold">Data Privacy:</span> Logging out will clear all cached data from this device to protect your information.
              </p>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};
