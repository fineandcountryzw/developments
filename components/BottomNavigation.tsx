import React from 'react';
import { Home, Hammer, Layout, User, Globe } from 'lucide-react';

interface BottomNavigationProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
}

export const BottomNavigation: React.FC<BottomNavigationProps> = ({ activeTab, onTabChange }) => {
  const navItems = [
    { id: 'dashboard', label: 'Dashboard', icon: Home },
    { id: 'developments', label: 'Projects', icon: Hammer },
    // { id: 'pipeline', label: 'Pipeline', icon: Layout },
    { id: 'diagnostics', label: 'Health', icon: Globe },
    { id: 'profile', label: 'Profile', icon: User },
  ];

  return (
    <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-fcDivider shadow-2xl md:hidden z-[100]">
      <div className="flex justify-around items-center h-[72px] safe-area-inset-bottom">
        {navItems.map(item => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;
          
          return (
            <button
              key={item.id}
              onClick={() => onTabChange(item.id)}
              className={`flex flex-col items-center justify-center w-full h-full space-y-1 transition-all ${
                isActive
                  ? 'text-fcGold bg-fcGold/5'
                  : 'text-gray-600 hover:text-gray-600'
              }`}
            >
              <Icon size={24} className="stroke-[1.5]" />
              <span className="text-[8px] font-bold uppercase tracking-widest font-sans">
                {item.label}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
};
