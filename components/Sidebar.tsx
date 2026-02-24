
import React, { useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { LayoutDashboard, Map as MapIcon, ListChecks, LogOut, Users, CreditCard, Layers, Settings, UserPlus, Database, Briefcase, FileDown, ShieldCheck, UserCog, Scale, FileSignature, Activity, Layout, PieChart, TrendingUp, Building2, BarChart3, AlertCircle, Clock, CalendarDays, Receipt, ChevronDown, ChevronRight, Wallet, Shield, Wrench, CircleDollarSign, Wand2, ClipboardList, Upload, FileText } from 'lucide-react';
import { Role, Branch } from '../types.ts';
import { generateTechnicalWhitepaper } from '../services/whitepaperService.ts';
import { DEFAULT_LOGO } from '@/lib/constants';
import { useLogo } from '@/contexts/LogoContext';
import { logger } from '@/lib/logger';
import { Logo } from './Logo';

interface SidebarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  onLogout: () => void;
  role: Role;
  /** @deprecated Logo comes from useLogo() – same source everywhere. */
  logoUrl?: string;
  activeBranch: Branch;
}

// Menu item type
interface MenuItem {
  id: string;
  label: string;
  icon: any;
  href?: string; // Optional href for external navigation
}

// Section group type for collapsible sections
interface MenuSection {
  id: string;
  label: string;
  icon: any;
  items: MenuItem[];
  defaultCollapsed?: boolean;
}

export const Sidebar: React.FC<SidebarProps> = ({ activeTab, setActiveTab, onLogout, role, activeBranch }) => {
  const router = useRouter();

  // Collapsible section state - Finance expanded, Admin/System collapsed by default
  const [collapsedSections, setCollapsedSections] = useState<Record<string, boolean>>({
    finance: false,
    admin: true,
    system: true,
  });

  const toggleSection = (sectionId: string) => {
    setCollapsedSections(prev => ({
      ...prev,
      [sectionId]: !prev[sectionId]
    }));
  };

  // Check if any item in a section is active (to auto-expand)
  const isSectionActive = (items: MenuItem[]) => {
    return items.some(item => item.id === activeTab);
  };

  /**
   * AGENT-ONLY NAVIGATION (Strict Permission Lockdown)
   * Shows only: Dashboard, Developments, Pipeline, Clients, Profile
   * Hides all admin features: System Diagnostics, Global Settings, All Users
   */

  let menuItems: MenuItem[] = [];
  let menuSections: MenuSection[] = [];

  if (role === 'Agent') {
    // AGENT VIEW: Personal sales performance only - flat list
    menuItems = [
      { id: 'dashboard', label: 'My Performance', icon: TrendingUp },
      { id: 'portfolio', label: 'My Clients', icon: Users },
      { id: 'clients-add', label: 'Add New Client', icon: UserPlus },

      { id: 'properties', label: 'Properties', icon: MapIcon },
      { id: 'reservations', label: 'Reservations', icon: ClipboardList },
      { id: 'commissions', label: 'Commissions', icon: CreditCard },
      { id: 'developments', label: 'All Estates', icon: Layers },
      { id: 'branch', label: 'My Branch', icon: Building2 },
    ];
  } else if (role === 'Client') {
    // CLIENT VIEW: Investment terminal navigation - flat list
    menuItems = [
      { id: 'portfolio', label: 'My Investments', icon: TrendingUp },
      { id: 'legal', label: 'My Assets', icon: Layout }
    ];
  } else if (role === 'Admin' || role === 'Account' || role === 'Manager') {
    // ADMIN/ACCOUNTANT/MANAGER VIEW: Grouped into collapsible sections for leanness
    // Core items always visible at top
    menuItems = [
      { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
      { id: 'developments', label: 'Developments', icon: Layers },
    ];

    // Collapsible sections
    menuSections = [
      {
        id: 'landsales',
        label: 'Land & Sales',
        icon: MapIcon,
        items: [
          { id: 'stands', label: 'Stands', icon: MapIcon },
          { id: 'reservations', label: 'Reservations', icon: ClipboardList },
          { id: 'client-management', label: 'Clients', icon: Users },
        ],
        defaultCollapsed: false,
      },
      {
        id: 'finance',
        label: 'Finance',
        icon: Wallet,
        items: [
          { id: 'billing', label: 'Billing', icon: CircleDollarSign },
          { id: 'payments', label: 'Payments', icon: CreditCard },
          { id: 'recon', label: 'Reconciliation', icon: PieChart },
        ],
        defaultCollapsed: false,
      },
      {
        id: 'admin',
        label: 'Administration',
        icon: Shield,
        items: [
          { id: 'wizard', label: 'Wizard Actions', icon: Wand2 },
          { id: 'legal', label: 'Contracts', icon: FileSignature },
          { id: 'offline-contracts', label: 'Offline Contracts', icon: FileText },
          { id: 'import', label: 'Import Data', icon: Upload },
          { id: 'users', label: 'Access Control', icon: UserCog },
          { id: 'agents', label: 'Agents', icon: Users, href: '/dashboards/admin/agents' },
          { id: 'automation', label: 'Automation', icon: Clock },
        ],
        defaultCollapsed: true,
      },
      {
        id: 'system',
        label: 'System',
        icon: Wrench,
        items: [
          { id: 'audit', label: 'Audit Trail', icon: AlertCircle },
          { id: 'backup', label: 'Backups', icon: Database },
          { id: 'diagnostics', label: 'Diagnostics', icon: Settings },
          { id: 'settings', label: 'Branding', icon: Settings },
        ],
        defaultCollapsed: true,
      },
    ];
  } else if (role === 'Developer') {
    // DEVELOPER VIEW: Property developer-focused navigation
    menuItems = [
      { id: 'developments', label: 'My Developments', icon: Layers },
      { id: 'stands', label: 'Stands', icon: MapIcon },
      { id: 'legal', label: 'Contracts', icon: FileSignature },
    ];
  }

  const handleDownloadWhitepaper = () => {
    generateTechnicalWhitepaper(activeBranch);
  };

  // Render a single menu button
  const renderMenuItem = (item: MenuItem, compact: boolean = false) => {
    const isActive = activeTab === item.id;
    
    // If item has href, use Link for navigation
    if (item.href) {
      return (
        <Link
          key={item.id}
          href={item.href}
          className={`flex items-center w-full text-left transition-all duration-200 rounded-lg group ${compact
              ? 'space-x-2.5 px-3 py-2 ml-2'
              : 'space-x-3 xl:space-x-3.5 px-3.5 xl:px-4 py-2 xl:py-2.5'
            } ${isActive
              ? 'bg-[#C5A059] text-white shadow-md shadow-[#C5A059]/20'
              : 'text-gray-400 hover:text-white hover:bg-[#1A1A1A]'
            }`}
        >
          <item.icon
            size={compact ? 15 : 16}
            strokeWidth={isActive ? 2.5 : 1.75}
            className="flex-shrink-0"
          />
          <span className={`font-medium tracking-tight truncate ${compact ? 'text-[12px]' : 'text-[12px] xl:text-[13px]'
            } ${isActive ? 'text-white' : 'text-gray-400 group-hover:text-white'
            }`}>
            {item.label}
          </span>
        </Link>
      );
    }
    
    // Otherwise use button with setActiveTab
    return (
      <button
        key={item.id}
        onClick={() => setActiveTab(item.id)}
        className={`flex items-center w-full text-left transition-all duration-200 rounded-lg group ${compact
            ? 'space-x-2.5 px-3 py-2 ml-2'
            : 'space-x-3 xl:space-x-3.5 px-3.5 xl:px-4 py-2 xl:py-2.5'
          } ${activeTab === item.id
            ? 'bg-[#C5A059] text-white shadow-md shadow-[#C5A059]/20'
            : 'text-gray-400 hover:text-white hover:bg-[#1A1A1A]'
          }`}
      >
        <item.icon
          size={compact ? 15 : 16}
          strokeWidth={activeTab === item.id ? 2.5 : 1.75}
          className="flex-shrink-0"
        />
        <span className={`font-medium tracking-tight truncate ${compact ? 'text-[12px]' : 'text-[12px] xl:text-[13px]'
          } ${activeTab === item.id ? 'text-white' : 'text-gray-400 group-hover:text-white'
          }`}>
          {item.label}
        </span>
      </button>
    );
  };

  // Render a collapsible section
  const renderSection = (section: MenuSection) => {
    const isCollapsed = collapsedSections[section.id];
    const hasActiveItem = isSectionActive(section.items);

    // Auto-expand if section contains active item
    React.useEffect(() => {
      if (hasActiveItem && collapsedSections[section.id]) {
        setCollapsedSections(prev => ({ ...prev, [section.id]: false }));
      }
    }, [activeTab]);

    return (
      <div key={section.id} className="space-y-0.5">
        {/* Section header */}
        <button
          onClick={() => toggleSection(section.id)}
          className={`flex items-center justify-between w-full text-left px-3.5 xl:px-4 py-1.5 xl:py-2 rounded-lg transition-all duration-200 group ${hasActiveItem
              ? 'text-[#C5A059]'
              : 'text-gray-500 hover:text-gray-300 hover:bg-[#1A1A1A]'
            }`}
        >
          <div className="flex items-center space-x-2.5">
            <section.icon size={14} strokeWidth={1.5} className="flex-shrink-0 opacity-70" />
            <span className="text-[10px] xl:text-[11px] font-semibold uppercase tracking-wider">
              {section.label}
            </span>
          </div>
          {isCollapsed ? (
            <ChevronRight size={14} className="opacity-50" />
          ) : (
            <ChevronDown size={14} className="opacity-50" />
          )}
        </button>

        {/* Section items */}
        {!isCollapsed && (
          <div className="space-y-0.5 pb-1">
            {Array.isArray(section.items) && section.items.map(item => renderMenuItem(item, true))}
          </div>
        )}
      </div>
    );
  };

  return (
    <nav className="hidden lg:flex fixed left-0 top-0 h-full w-64 xl:w-64 border-r border-[#2A2A2A] p-4 xl:p-6 flex-col bg-black z-50 shadow-xl font-sans">
      {/* Fine & Country Branding Header */}
      <div className="mb-4 xl:mb-6 px-2 space-y-2 xl:space-y-3">
        <div className="flex items-center space-x-3">
          <Logo variant="sidebar" darkBackground />
        </div>
        {role === 'Agent' && (
          <div className="pt-2 xl:pt-3 border-t border-gray-800">
            <div className="text-[9px] xl:text-[10px] font-semibold uppercase tracking-widest text-[#C5A059]">
              Agent Terminal
            </div>
            <div className="text-[11px] text-gray-500 mt-0.5">
              {activeBranch === 'Harare' ? 'Harare HQ' : 'Bulawayo Branch'}
            </div>
          </div>
        )}
      </div>

      {/* Navigation Menu */}
      <div className="flex-1 space-y-0.5 xl:space-y-1 overflow-y-auto no-scrollbar pr-1">
        {/* Core menu items (flat list for Agent/Client, top items for Admin) */}
        {Array.isArray(menuItems) && menuItems.map(item => renderMenuItem(item))}

        {/* Collapsible sections (Admin only) */}
        {role === 'Admin' && Array.isArray(menuSections) && menuSections.length > 0 && (
          <div className="pt-3 xl:pt-4 mt-2 xl:mt-3 border-t border-gray-800 space-y-1 xl:space-y-1.5">
            {menuSections.map(section => renderSection(section))}
          </div>
        )}

        {/* Admin-Only Architecture Manual */}
        {role === 'Admin' && (
          <div className="pt-3 xl:pt-4 mt-2 xl:mt-3 border-t border-gray-800 px-1">
            <button
              onClick={handleDownloadWhitepaper}
              className="flex items-center space-x-2.5 w-full text-left py-1.5 group"
            >
              <div className="p-1 bg-[#C5A059]/10 rounded text-[#C5A059] group-hover:bg-[#C5A059]/20 transition-colors flex-shrink-0">
                <FileDown size={12} />
              </div>
              <span className="text-[9px] xl:text-[10px] font-semibold text-gray-500 uppercase tracking-wider group-hover:text-[#C5A059] transition-colors">
                Architecture Manual
              </span>
            </button>
          </div>
        )}
      </div>

      {/* User Profile & Logout */}
      <div className="pt-3 xl:pt-4 border-t border-gray-800 space-y-3 xl:space-y-4 px-1">
        <div className="flex items-center space-x-2.5 xl:space-x-3">
          <div className="w-9 h-9 xl:w-10 xl:h-10 rounded-xl bg-[#C5A059] flex items-center justify-center text-white font-bold text-[10px] xl:text-xs shadow-md flex-shrink-0">
            {role === 'Client' ? 'PC' : role === 'Agent' ? 'AG' : 'SM'}
          </div>
          <div className="overflow-hidden min-w-0">
            <div className="text-[12px] xl:text-[13px] font-semibold text-white truncate">
              {role === 'Client' ? 'Private Client' : role === 'Agent' ? 'Sarah Moyo' : 'Admin User'}
            </div>
            <div className="text-[8px] xl:text-[9px] text-gray-500 font-semibold uppercase tracking-wider">
              {role} ACCESS
            </div>
          </div>
        </div>
        <button
          onClick={onLogout}
          className="flex items-center space-x-2.5 w-full text-left py-1.5 text-gray-500 hover:text-[#C5A059] transition-all group"
        >
          <LogOut size={14} strokeWidth={1.75} className="flex-shrink-0" />
          <span className="text-[10px] xl:text-[11px] font-semibold uppercase tracking-wider">Sign Out</span>
        </button>
      </div>
    </nav>
  );
};
