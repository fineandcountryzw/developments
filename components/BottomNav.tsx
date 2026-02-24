
import React from 'react';
import { LayoutDashboard, Map as MapIcon, ListChecks, Users, CreditCard, TrendingUp, Layers, Building2, Home, Clock, User, FileSignature } from 'lucide-react';
import { Role } from '../types.ts';

interface BottomNavProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  role: Role;
}

export const BottomNav: React.FC<BottomNavProps> = ({ activeTab, setActiveTab, role }) => {
  /**
   * MOBILE BOTTOM NAVIGATION
   * Agent: 5 icons (Home/Performance, Deals, Clients, Branch, Profile)
   * Client: 3 icons (Home, Estates, Profile)
   * Admin: 5 icons (Home, Estates, Deals, Pay, Clients)
   * 
   * Responsive Design:
   * - Mobile (< 768px): Full-width, evenly spaced items
   * - Tablet (768px - 1024px): Still visible, optimized spacing
   * - Desktop (> 1024px): Hidden (lg:hidden)
   */
  
  let navItems: { id: string; label: string; icon: any }[] = [];

  if (role === 'Agent') {
    // AGENT MOBILE NAV: 4 icons with Profile
    navItems = [
      { id: 'dashboard', label: 'Home', icon: TrendingUp },

      { id: 'portfolio', label: 'Clients', icon: Users },
      { id: 'branch', label: 'Branch', icon: Building2 },
      { id: 'profile', label: 'Profile', icon: User },
    ];
  } else if (role === 'Client') {
    // CLIENT MOBILE NAV: Investment terminal with Profile
    navItems = [
      { id: 'portfolio', label: 'Invest', icon: TrendingUp },
      { id: 'legal', label: 'Assets', icon: Home },
      { id: 'profile', label: 'Profile', icon: User },
    ];
  } else {
    // ADMIN/DEFAULT MOBILE NAV
    navItems = [
      { id: 'dashboard', label: 'Home', icon: LayoutDashboard },
      { id: 'developments', label: 'Estates', icon: Layers },
      { id: 'payments', label: 'Pay', icon: CreditCard },
      { id: 'legal', label: 'Contracts', icon: FileSignature },
      { id: 'portfolio', label: 'Clients', icon: Users },
    ];
  }

  const itemCount = navItems.length;

  // Defensive check to ensure navItems is always an array
  if (!Array.isArray(navItems)) {
    console.error('[BottomNav] navItems is not an array:', navItems);
    return null;
  }

  return (
    <nav 
      className="lg:hidden fixed bottom-0 left-0 right-0 w-full bg-white border-t border-gray-100 z-[60] shadow-[0_-4px_20px_-10px_rgba(0,0,0,0.1)] safe-area-inset-bottom font-sans"
      style={{ 
        paddingBottom: 'max(env(safe-area-inset-bottom), 8px)',
        minHeight: '64px',
        height: 'auto'
      }}
    >
      <div className="w-full flex items-center justify-evenly px-1 sm:px-2 md:px-3 py-2 sm:py-2.5 md:py-3">
        {navItems.map((item, index) => (
          <button
            key={item.id}
            onClick={() => {
              setActiveTab(item.id);
              if (window.navigator.vibrate) window.navigator.vibrate(5);
            }}
            className={`
              flex flex-col items-center justify-center 
              flex-1
              min-w-0
              space-y-0.5 sm:space-y-1
              transition-all duration-200
              touch-manipulation
              active:scale-95
              rounded-lg
              px-0.5 sm:px-1 md:px-1.5
              ${activeTab === item.id 
                ? 'text-fcGold scale-105 bg-fcGold/5' 
                : 'text-gray-600 hover:text-gray-800 hover:bg-gray-50'
              }
            `}
            style={{
              minHeight: '56px',
              maxWidth: 'none',
            }}
            aria-label={item.label}
          >
            <item.icon 
              size={itemCount === 3 ? 24 : 20} 
              strokeWidth={activeTab === item.id ? 2.5 : 2}
              className="flex-shrink-0"
            />
            <span className={`
              text-[9px] sm:text-[10px] md:text-[11px]
              font-semibold uppercase 
              tracking-wide
              text-center
              leading-tight
              whitespace-nowrap
              block
              w-full
              px-0.5
            `}>
              {item.label}
            </span>
          </button>
        ))}
      </div>
    </nav>
  );
};
