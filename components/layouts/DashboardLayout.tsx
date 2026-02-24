/**
 * Dashboard Layout Component
 * Provides consistent header, sidebar, and footer across all dashboards
 * Responsive design for desktop and mobile
 */

'use client';

import React, { useState } from 'react';
import { useSession, signOut } from 'next-auth/react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { useLogo } from '@/contexts/LogoContext';
import { DEFAULT_LOGO } from '@/lib/constants';
import { Logo } from '@/components/Logo';

import {
  LayoutDashboard,
  TrendingUp,
  Users,
  MapPin,
  FileText,
  DollarSign,
  Settings,
  LogOut,
  Menu,
  X,
  Bell,
  Search,
  User,
  Home,
  ChevronRight,
  ClipboardCheck,
} from 'lucide-react';
import { Button } from '@/components/ui/button';

interface DashboardLayoutProps {
  children: React.ReactNode;
  title: string;
  description?: string;
  role: 'agent' | 'client' | 'admin' | 'manager';
}

export function DashboardLayout({ children, title, description, role }: DashboardLayoutProps) {
  const { data: session } = useSession();
  const router = useRouter();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { logoUrl } = useLogo();

  const handleLogout = async () => {
    // Clear all local storage and session data before signing out
    localStorage.clear();
    sessionStorage.clear();

    // Sign out and force full page reload to clear any cached state
    await signOut({ redirect: false });
    window.location.href = '/login';
  };

  // Navigation items based on role
  const getNavigationItems = () => {
    switch (role) {
      case 'agent':
        return [
          { label: 'Dashboard', icon: LayoutDashboard, href: '/dashboards/agent' },
          { label: 'My Prospects', icon: Users, href: '/dashboards/agent?tab=prospects' },
          { label: 'Active Deals', icon: TrendingUp, href: '/dashboards/agent?tab=deals' },
          { label: 'Properties', icon: MapPin, href: '/dashboards/agent?tab=properties' },
        ];
      case 'client':
        return [
          { label: 'Dashboard', icon: LayoutDashboard, href: '/dashboards/client' },
          { label: 'Wishlist', icon: MapPin, href: '/dashboards/client?tab=wishlist' },
          { label: 'Reservations', icon: FileText, href: '/dashboards/client?tab=reservations' },
          { label: 'Documents', icon: FileText, href: '/dashboards/client?tab=documents' },
          { label: 'Payments', icon: DollarSign, href: '/dashboards/client?tab=payments' },
        ];
      case 'admin':
        return [
          { label: 'Admin Dashboard', icon: LayoutDashboard, href: '/' },
          { label: 'Users', icon: Users, href: '/?tab=users' },
          { label: 'Settings', icon: Settings, href: '/?tab=settings' },
        ];
      case 'manager':
        return [
          { label: 'Dashboard', icon: LayoutDashboard, href: '/dashboards/manager' },
          { label: 'Team', icon: Users, href: '/dashboards/manager?tab=team' },
          { label: 'Approvals', icon: ClipboardCheck, href: '/dashboards/manager?tab=approvals' },
          { label: 'Reports', icon: FileText, href: '/dashboards/manager?tab=reports' },
        ];
      default:
        return [];
    }
  };

  const navItems = getNavigationItems();

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col overflow-x-hidden">
      {/* Header - Dark Theme for Logo Contrast */}
      <header className="bg-slate-900 border-b border-slate-800 sticky top-0 z-40 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-6 xl:px-8">
          <div className="flex justify-between items-center h-16 gap-2 lg:gap-3 xl:gap-4">
            {/* Logo and Title */}
            <div className="flex items-center gap-2 lg:gap-3 xl:gap-4 flex-shrink-0">
              {/* Mobile menu button */}
              <button
                onClick={() => setSidebarOpen(!sidebarOpen)}
                className="lg:hidden p-2 rounded-md text-gray-300 hover:text-white hover:bg-slate-800"
                aria-label={sidebarOpen ? 'Close menu' : 'Open menu'}
              >
                {sidebarOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
              </button>

              <Link href="/" className="flex items-center gap-2 lg:gap-3" aria-label="Home">
                <Logo variant="header" priority darkBackground />
              </Link>
            </div>

            {/* Search Bar - Hidden on mobile, responsive width */}
            <div className="hidden md:flex flex-1 max-w-[200px] lg:max-w-[280px] xl:max-w-md mx-4 lg:mx-6 xl:mx-8">
              <div className="relative w-full">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" aria-hidden="true" />
                <input
                  type="text"
                  placeholder="Search..."
                  aria-label="Search"
                  className="w-full pl-10 pr-4 py-2 bg-slate-800 border border-slate-700 text-gray-200 placeholder-gray-400 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                />
              </div>
            </div>

            {/* Right side actions */}
            <div className="flex items-center gap-2 lg:gap-3 flex-shrink-0">
              {/* Notifications */}
              <button 
                className="p-2 rounded-md text-gray-300 hover:text-white hover:bg-slate-800 relative"
                aria-label="Notifications"
              >
                <Bell className="w-5 h-5" aria-hidden="true" />
                <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full" aria-label="New notifications"></span>
              </button>

              {/* User menu */}
              <div className="flex items-center gap-2 lg:gap-3 pl-2 lg:pl-3 border-l border-slate-700">
                <div className="hidden sm:block text-right">
                  <div className="text-sm font-semibold text-gray-200 truncate max-w-[100px] lg:max-w-[120px] xl:max-w-none">
                    {session?.user?.name || 'User'}
                  </div>
                  <div className="text-xs text-gray-400 capitalize">{role}</div>
                </div>
                <div className="w-9 h-9 lg:w-10 lg:h-10 bg-gradient-to-br from-blue-600 to-blue-700 rounded-full flex items-center justify-center text-white font-semibold text-sm lg:text-base" aria-hidden="true">
                  {session?.user?.name?.charAt(0) || 'U'}
                </div>
              </div>
            </div>
          </div>
        </div>
      </header>

      <div className="flex flex-1 min-w-0">
        {/* Sidebar - Desktop with Premium Styling */}
        <aside className="hidden lg:flex lg:flex-col w-64 xl:w-64 flex-shrink-0 bg-white border-r border-gray-200 shadow-sm">
          <nav className="flex-1 overflow-y-auto p-3 space-y-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className="flex items-center gap-3 px-4 py-3.5 rounded-xl text-gray-700 hover:bg-gradient-to-r hover:from-blue-50 hover:to-blue-100 hover:text-blue-700 transition-all duration-200 group font-medium"
                >
                  <Icon className="w-5 h-5 group-hover:scale-110 transition-transform" />
                  <span className="text-sm">{item.label}</span>
                </Link>
              );
            })}
          </nav>

          {/* Logout button - Fixed at bottom */}
          <div className="p-3 border-t border-gray-200">
            <button
              onClick={handleLogout}
              className="flex items-center gap-3 px-4 py-3.5 rounded-xl text-red-600 hover:bg-red-50 transition-all duration-200 w-full font-medium group"
            >
              <LogOut className="w-5 h-5 group-hover:scale-110 transition-transform" />
              <span className="text-sm">Logout</span>
            </button>
          </div>
        </aside>

        {/* Mobile Sidebar Overlay with Premium Animations */}
        {sidebarOpen && (
          <>
            <div
              className="fixed inset-0 bg-black/50 backdrop-blur-sm z-40 lg:hidden animate-in fade-in duration-200"
              onClick={() => setSidebarOpen(false)}
            ></div>
            <aside className="fixed top-0 left-0 bottom-0 w-72 bg-white shadow-2xl overflow-y-auto z-50 lg:hidden animate-in slide-in-from-left duration-300">
              {/* Mobile Sidebar Header */}
              <div className="flex items-center justify-between px-6 py-5 border-b bg-gradient-to-r from-slate-50 to-gray-50">
                <div className="flex items-center gap-3">
                  <Logo variant="mobile" />
                  <span className="font-semibold text-slate-900 text-lg">Menu</span>
                </div>
                <button
                  onClick={() => setSidebarOpen(false)}
                  className="p-2 hover:bg-white rounded-lg transition-colors touch-manipulation active:scale-95"
                  aria-label="Close menu"
                >
                  <X className="w-5 h-5 text-slate-600" />
                </button>
              </div>

              {/* Mobile Navigation */}
              <nav className="p-4 space-y-1">
                {navItems.map((item) => {
                  const Icon = item.icon;
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={() => setSidebarOpen(false)}
                      className="flex items-center gap-4 px-5 py-4 rounded-xl text-gray-700 hover:bg-gradient-to-r hover:from-blue-50 hover:to-blue-100 hover:text-blue-700 transition-all duration-200 touch-manipulation active:scale-95 font-medium"
                    >
                      <Icon className="w-5 h-5 flex-shrink-0" />
                      <span className="text-base">{item.label}</span>
                    </Link>
                  );
                })}

                {/* Mobile Logout button */}
                <button
                  onClick={handleLogout}
                  className="flex items-center gap-4 px-5 py-4 rounded-xl text-red-600 hover:bg-red-50 transition-all duration-200 w-full mt-6 touch-manipulation active:scale-95 font-medium"
                >
                  <LogOut className="w-5 h-5 flex-shrink-0" />
                  <span className="text-base">Logout</span>
                </button>
              </nav>
            </aside>
          </>
        )}

        {/* Main Content with improved spacing */}
        <main className="flex-1 min-w-0 overflow-y-auto overflow-x-hidden pb-20 lg:pb-0">
          {/* Page Title with premium hierarchy */}
          <div className="bg-white border-b border-gray-200 px-4 sm:px-6 lg:px-8 py-4 sm:py-6 lg:py-8 shadow-sm">
            <div className="max-w-full lg:max-w-[1280px] mx-auto">
              {/* Breadcrumb */}
              <div className="flex items-center gap-2 text-sm text-gray-500 mb-3">
                <Home className="w-4 h-4" />
                <ChevronRight className="w-3.5 h-3.5" />
                <span className="capitalize font-medium">{role}</span>
                <ChevronRight className="w-3.5 h-3.5" />
                <span className="text-gray-900 font-medium">{title}</span>
              </div>

              <h1 className="text-xl sm:text-2xl lg:text-3xl font-semibold text-gray-900 tracking-tight">{title}</h1>
              {description && (
                <p className="text-sm sm:text-base text-gray-600 mt-2 sm:mt-3 leading-relaxed">{description}</p>
              )}
            </div>
          </div>

          {/* Content Area with consistent spacing and max-width */}
          <div className="max-w-full lg:max-w-[1280px] mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-6 lg:py-8">
            <div className="space-y-6">
              {children}
            </div>
          </div>
        </main>
      </div>

      {/* Footer */}
      <footer className="bg-white border-t border-gray-200 mt-auto">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex flex-col sm:flex-row justify-between items-center gap-4">
            <div className="text-sm text-gray-600">
              © 2026 Fine & Country Zimbabwe. All rights reserved.
            </div>
            <div className="flex gap-6 text-sm text-gray-600">
              <a href="#" className="hover:text-gray-900">Privacy Policy</a>
              <a href="#" className="hover:text-gray-900">Terms of Service</a>
              <a href="#" className="hover:text-gray-900">Support</a>
            </div>
          </div>
        </div>
      </footer>

      {/* Mobile Bottom Navigation - Improved touch targets and clarity */}
      <div className="lg:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 shadow-2xl z-40 safe-area-inset-bottom">
        <div className="flex justify-around items-center h-18 px-2">
          {navItems.slice(0, 4).map((item) => {
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                className="flex flex-col items-center justify-center flex-1 py-3 text-gray-600 hover:text-blue-600 hover:bg-blue-50/50 transition-all duration-200 rounded-lg touch-manipulation active:scale-95 min-h-[60px]"
              >
                <Icon className="w-6 h-6 mb-1" />
                <span className="text-xs font-medium leading-tight">{item.label.split(' ')[0]}</span>
              </Link>
            );
          })}
          <button
            onClick={handleLogout}
            className="flex flex-col items-center justify-center flex-1 py-3 text-red-600 hover:bg-red-50 transition-all duration-200 rounded-lg touch-manipulation active:scale-95 min-h-[60px]"
          >
            <LogOut className="w-6 h-6 mb-1" />
            <span className="text-xs font-medium leading-tight">Logout</span>
          </button>
        </div>
      </div>
    </div>
  );
}
