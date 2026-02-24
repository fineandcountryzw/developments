'use client';

import React, { useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useSession, signOut } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import {
  User,
  Settings,
  CreditCard,
  FileText,
  LogOut,
  ChevronDown,
  Shield,
  ExternalLink,
  Loader2,
} from 'lucide-react';

// Types
type UserRole = 'ADMIN' | 'AGENT' | 'CLIENT' | 'MANAGER' | 'DEVELOPER' | 'ACCOUNT';

interface ProfileDropdownProps {
  /** Compact mode for mobile - shows only avatar */
  compact?: boolean;
}

// Role badge colors mapped to ERP palette
const getRoleBadgeStyles = (role: UserRole): string => {
  const styles: Record<UserRole, string> = {
    ADMIN: 'bg-erp-primary text-erp-primary-foreground',
    MANAGER: 'bg-erp-accent text-white',
    DEVELOPER: 'bg-emerald-600 text-white',
    AGENT: 'bg-blue-600 text-white',
    CLIENT: 'bg-slate-600 text-white',
    ACCOUNT: 'bg-purple-600 text-white',
  };
  return styles[role] || 'bg-slate-600 text-white';
};

// Get initials from name
const getInitials = (name: string): string => {
  if (!name) return 'U';
  const parts = name.trim().split(' ');
  if (parts.length === 1) return parts[0].charAt(0).toUpperCase();
  return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
};

// Format role for display
const formatRole = (role: string): string => {
  return role.charAt(0).toUpperCase() + role.slice(1).toLowerCase();
};

export const ProfileDropdown: React.FC<ProfileDropdownProps> = ({ compact = false }) => {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [isSigningOut, setIsSigningOut] = useState(false);

  // Handle sign out
  const handleSignOut = async () => {
    setIsSigningOut(true);
    try {
      // Clear local storage
      localStorage.clear();
      sessionStorage.clear();
      
      // Sign out via NextAuth
      await signOut({ callbackUrl: '/login', redirect: true });
    } catch (error) {
      console.error('Sign out error:', error);
      // Force redirect on error
      window.location.href = '/login';
    }
  };

  // Close dropdown when clicking outside
  React.useEffect(() => {
    if (!isOpen) {
      return undefined;
    }
    
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest('[data-profile-dropdown]')) {
        setIsOpen(false);
      }
    };

    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, [isOpen]);

  // Loading state
  if (status === 'loading') {
    return (
      <div className="flex items-center gap-2 px-3 py-2">
        <div className="w-9 h-9 rounded-full bg-erp-surface animate-pulse" />
        {!compact && <div className="w-24 h-4 bg-erp-surface animate-pulse rounded" />}
      </div>
    );
  }

  // Not authenticated
  if (!session?.user) {
    return (
      <Link
        href="/login"
        className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-erp-primary hover:bg-erp-surface rounded-lg transition-colors"
      >
        <User size={18} />
        <span>Sign In</span>
      </Link>
    );
  }

  const user = session.user;
  const userName = user.name || 'User';
  const userEmail = user.email || '';
  const userRole = (user.role as UserRole) || 'CLIENT';
  const userImage = user.image;

  // Menu items
  const menuItems = [
    {
      id: 'profile',
      label: 'Profile',
      icon: User,
      href: '/dashboard/profile',
      show: true,
    },
    {
      id: 'settings',
      label: 'Settings',
      icon: Settings,
      href: '/dashboard/settings',
      show: ['ADMIN', 'MANAGER'].includes(userRole),
    },
    {
      id: 'billing',
      label: 'Subscription',
      icon: CreditCard,
      href: '/dashboard/billing',
      show: ['ADMIN', 'DEVELOPER'].includes(userRole),
    },
    {
      id: 'terms',
      label: 'Terms & Policies',
      icon: FileText,
      href: '/terms',
      external: true,
      show: true,
    },
  ];

  return (
    <div className="relative" data-profile-dropdown>
      {/* Trigger Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`
          flex items-center gap-2.5 rounded-xl transition-all duration-200 
          hover:bg-erp-surface/80 active:scale-[0.98]
          ${compact ? 'p-1.5' : 'px-3 py-2'}
          ${isOpen ? 'bg-erp-surface ring-2 ring-erp-accent/20' : ''}
        `}
        aria-expanded={isOpen}
        aria-haspopup="true"
      >
        {/* Avatar with gradient ring */}
        <div className="relative">
          <div className="w-9 h-9 rounded-full bg-gradient-to-br from-erp-accent to-erp-primary p-[2px]">
            <div className="w-full h-full rounded-full bg-white overflow-hidden flex items-center justify-center">
              {userImage ? (
                <Image
                  src={userImage}
                  alt={userName}
                  width={36}
                  height={36}
                  className="w-full h-full object-cover"
                />
              ) : (
                <span className="text-sm font-bold text-erp-primary">
                  {getInitials(userName)}
                </span>
              )}
            </div>
          </div>
          {/* Online indicator */}
          <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-green-500 border-2 border-white rounded-full" />
        </div>

        {/* Name & Email (Desktop only) */}
        {!compact && (
          <div className="hidden sm:block text-left max-w-[140px]">
            <p className="text-sm font-semibold text-gray-900 truncate">{userName}</p>
            <p className="text-xs text-gray-500 truncate">{userEmail}</p>
          </div>
        )}

        {/* Chevron */}
        {!compact && (
          <ChevronDown
            size={16}
            className={`text-gray-400 transition-transform duration-200 ${
              isOpen ? 'rotate-180' : ''
            }`}
          />
        )}
      </button>

      {/* Dropdown Menu */}
      {isOpen && (
        <div
          className="
            absolute right-0 top-full mt-2 w-72 
            bg-white/95 backdrop-blur-xl 
            rounded-2xl shadow-xl shadow-black/10 
            border border-erp-border
            overflow-hidden z-50
            animate-in fade-in slide-in-from-top-2 duration-200
          "
        >
          {/* Accent line at top */}
          <div className="h-1 bg-gradient-to-r from-erp-accent via-erp-primary to-erp-accent" />

          {/* User Header */}
          <div className="p-4 border-b border-erp-border">
            <div className="flex items-center gap-3">
              {/* Avatar */}
              <div className="relative flex-shrink-0">
                <div className="w-12 h-12 rounded-full bg-gradient-to-br from-erp-accent to-erp-primary p-[2px]">
                  <div className="w-full h-full rounded-full bg-white overflow-hidden flex items-center justify-center">
                    {userImage ? (
                      <Image
                        src={userImage}
                        alt={userName}
                        width={48}
                        height={48}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <span className="text-lg font-bold text-erp-primary">
                        {getInitials(userName)}
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-gray-900 truncate">{userName}</p>
                <p className="text-xs text-gray-500 truncate">{userEmail}</p>
                
                {/* Role Badge */}
                <div className="flex items-center gap-2 mt-1.5">
                  <span
                    className={`
                      inline-flex items-center gap-1 px-2 py-0.5 rounded-full 
                      text-[10px] font-bold uppercase tracking-wider
                      ${getRoleBadgeStyles(userRole)}
                    `}
                  >
                    <Shield size={10} />
                    {formatRole(userRole)}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Menu Items */}
          <div className="py-2">
            {menuItems
              .filter((item) => item.show)
              .map((item) => (
                <React.Fragment key={item.id}>
                  {item.external ? (
                    <a
                      href={item.href}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="
                        flex items-center gap-3 px-4 py-2.5 
                        text-sm text-gray-700 
                        hover:bg-erp-surface hover:text-erp-primary
                        transition-colors
                      "
                      onClick={() => setIsOpen(false)}
                    >
                      <item.icon size={18} className="text-gray-400" />
                      <span className="flex-1">{item.label}</span>
                      <ExternalLink size={14} className="text-gray-300" />
                    </a>
                  ) : (
                    <Link
                      href={item.href}
                      className="
                        flex items-center gap-3 px-4 py-2.5 
                        text-sm text-gray-700 
                        hover:bg-erp-surface hover:text-erp-primary
                        transition-colors
                      "
                      onClick={() => setIsOpen(false)}
                    >
                      <item.icon size={18} className="text-gray-400" />
                      <span>{item.label}</span>
                    </Link>
                  )}
                </React.Fragment>
              ))}
          </div>

          {/* Sign Out */}
          <div className="border-t border-erp-border p-2">
            <button
              onClick={handleSignOut}
              disabled={isSigningOut}
              className="
                flex items-center gap-3 w-full px-4 py-2.5 rounded-lg
                text-sm text-erp-danger font-medium
                hover:bg-red-50 active:bg-red-100
                transition-colors disabled:opacity-50
              "
            >
              {isSigningOut ? (
                <Loader2 size={18} className="animate-spin" />
              ) : (
                <LogOut size={18} />
              )}
              <span>{isSigningOut ? 'Signing out...' : 'Sign Out'}</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default ProfileDropdown;
