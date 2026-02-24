/**
 * Dashboard Header Component
 * Unified header component for all dashboards
 * Mobile-optimized: Minimal header with Logo + Title + Menu
 *
 * @module components/dashboards/shared/DashboardHeader
 */

import React, { useState, useEffect } from "react";
import { useSession, signOut } from "next-auth/react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { Logo } from "@/components/Logo";
import { Bell, LogOut, RefreshCw, Menu, X, User, Home } from "lucide-react";
import { Button } from "@/components/ui/button";
import { NotificationPanel } from "@/components/NotificationPanel";
import { useLogo } from "@/contexts/LogoContext";
import { ProfileDropdown } from "@/components/dashboard/profile-dropdown";

interface DashboardHeaderProps {
  title: string;
  subtitle?: string;
  onRefresh?: () => void;
  refreshing?: boolean;
  actions?: React.ReactNode;
  showNotifications?: boolean;
  onNotificationsClick?: () => void;
  onBrowseClick?: () => void;
}

export function DashboardHeader({
  title,
  subtitle,
  onRefresh,
  refreshing = false,
  actions,
  showNotifications = true,
  onNotificationsClick,
  onBrowseClick,
}: DashboardHeaderProps) {
  const { data: session } = useSession();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [notificationPanelOpen, setNotificationPanelOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);

  // Fetch unread notification count
  useEffect(() => {
    if (!session?.user?.id || !showNotifications) return;

    const fetchUnreadCount = async () => {
      try {
        const response = await fetch(
          "/api/notifications?unreadOnly=true&limit=1",
        );
        if (response.ok) {
          const data = await response.json();
          if (data.success) {
            setUnreadCount(data.data.unreadCount || 0);
          }
        }
      } catch (error) {
        // Silent fail - don't break header
      }
    };

    fetchUnreadCount();
    // Poll every 30 seconds
    const interval = setInterval(fetchUnreadCount, 30000);
    return () => clearInterval(interval);
  }, [session?.user?.id, showNotifications]);
  const { logoUrl } = useLogo();
  const router = useRouter();
  const [isSigningOut, setIsSigningOut] = useState(false);

  const handleSignOut = async () => {
    try {
      setIsSigningOut(true);
      // Sign out and immediately redirect to login with full page reload
      // This clears NextAuth's client-side session cache
      await signOut({
        redirect: true,
        callbackUrl: "/login?signout=true",
      });
      // The redirect: true will cause a full page redirect to /login
      // which clears the session cache on the client
    } catch (error) {
      console.error("Sign out error:", error);
      setIsSigningOut(false);
      // Fallback: force redirect to login
      router.push("/login");
    }
  };

  return (
    <>
      <header
        className="bg-white border-b border-gray-200 sticky top-0 z-50"
        role="banner"
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          {/* Mobile Header: Logo + Title + Menu (56px height) */}
          <div className="flex items-center justify-between h-14 md:hidden">
            {/* Left: Logo */}
            <Link href="/" className="flex items-center" aria-label="Home">
              <Logo variant="header" priority />
            </Link>

            {/* Center: Title (optional, can be empty) */}
            <h1 className="text-base font-semibold text-gray-900 flex-1 text-center px-2 truncate">
              {title}
            </h1>

            {/* Right: Menu Button */}
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="p-2 -mr-2 hover:bg-gray-50 rounded-lg transition-colors"
              aria-label="Menu"
              aria-expanded={mobileMenuOpen}
            >
              {mobileMenuOpen ? (
                <X size={20} className="text-gray-700" aria-hidden="true" />
              ) : (
                <Menu size={20} className="text-gray-700" aria-hidden="true" />
              )}
            </button>
          </div>

          {/* Desktop Header: Full layout */}
          <div className="hidden md:flex items-center justify-between h-16">
            {/* Logo & Title */}
            <div className="flex items-center gap-4">
              <Link
                href="/"
                className="flex items-center gap-2"
                aria-label="Home"
              >
                <Logo variant="header" priority />
                <div>
                  <h1 className="text-lg font-semibold text-gray-900">
                    {title}
                  </h1>
                  {subtitle && (
                    <p className="text-xs text-gray-500">{subtitle}</p>
                  )}
                </div>
              </Link>
            </div>

            {/* Actions & User Menu */}
            <div className="flex items-center gap-4">
              {/* Custom Actions */}
              {actions}

              {/* Refresh Button */}
              {onRefresh && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={onRefresh}
                  disabled={refreshing}
                  aria-label="Refresh data"
                  className="gap-2"
                >
                  <RefreshCw
                    className={`w-4 h-4 ${refreshing ? "animate-spin" : ""}`}
                    aria-hidden="true"
                  />
                  <span className="hidden sm:inline">
                    {refreshing ? "Refreshing..." : "Refresh"}
                  </span>
                </Button>
              )}

              {/* Notifications */}
              {showNotifications && (
                <div className="relative">
                  <button
                    onClick={() => {
                      if (onNotificationsClick) {
                        onNotificationsClick();
                      } else {
                        setNotificationPanelOpen(!notificationPanelOpen);
                      }
                    }}
                    className="p-2 hover:bg-gray-100 rounded-lg relative"
                    aria-label="Notifications"
                    aria-expanded={notificationPanelOpen}
                  >
                    <Bell
                      size={20}
                      className="text-gray-600"
                      aria-hidden="true"
                    />
                    {unreadCount > 0 && (
                      <span
                        className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full"
                        aria-label={`${unreadCount} unread notifications`}
                      >
                        <span className="sr-only">{unreadCount} unread</span>
                      </span>
                    )}
                  </button>
                </div>
              )}

              {/* Profile Dropdown - Premium User Menu */}
              <div className="pl-2 border-l border-gray-200">
                <ProfileDropdown />
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Mobile Menu Drawer */}
      {mobileMenuOpen && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-black/20 z-40 md:hidden"
            onClick={() => setMobileMenuOpen(false)}
            aria-hidden="true"
          />

          {/* Drawer */}
          <div className="fixed top-14 right-0 bottom-0 w-72 bg-white shadow-xl z-50 md:hidden animate-in slide-in-from-right duration-200">
            <div className="flex flex-col h-full">
              {/* User Profile Section - Premium ProfileDropdown */}
              <div className="p-4 border-b border-gray-100 bg-gradient-to-br from-slate-50 to-gray-50">
                <ProfileDropdown compact />
              </div>

              {/* Menu Items */}
              <div className="flex-1 overflow-y-auto p-4 space-y-2">
                {onBrowseClick && (
                  <button
                    onClick={() => {
                      onBrowseClick();
                      setMobileMenuOpen(false);
                    }}
                    className="w-full flex items-center gap-3 px-4 py-3 text-sm font-medium text-gray-700 hover:bg-gray-50 rounded-xl transition-colors"
                  >
                    <Home className="w-5 h-5 text-gray-500" />
                    <span>Browse Developments</span>
                  </button>
                )}

                {onRefresh && (
                  <button
                    onClick={() => {
                      onRefresh();
                      setMobileMenuOpen(false);
                    }}
                    disabled={refreshing}
                    className="w-full flex items-center gap-3 px-4 py-3 text-sm font-medium text-gray-700 hover:bg-gray-50 rounded-xl transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <RefreshCw
                      className={`w-5 h-5 text-gray-500 ${refreshing ? "animate-spin" : ""}`}
                    />
                    <span>{refreshing ? "Refreshing..." : "Refresh"}</span>
                  </button>
                )}

                {showNotifications && (
                  <button
                    onClick={() => {
                      if (onNotificationsClick) {
                        onNotificationsClick();
                      } else {
                        setNotificationPanelOpen(true);
                      }
                      setMobileMenuOpen(false);
                    }}
                    className="w-full flex items-center gap-3 px-4 py-3 text-sm font-medium text-gray-700 hover:bg-gray-50 rounded-xl transition-colors relative"
                  >
                    <Bell className="w-5 h-5 text-gray-500" />
                    <span>Notifications</span>
                    {unreadCount > 0 && (
                      <span
                        className="absolute right-4 top-1/2 -translate-y-1/2 w-2 h-2 bg-red-500 rounded-full"
                        aria-label={`${unreadCount} unread notifications`}
                      >
                        <span className="sr-only">{unreadCount} unread</span>
                      </span>
                    )}
                  </button>
                )}
              </div>
            </div>
          </div>
        </>
      )}

      {/* Notification Panel */}
      {notificationPanelOpen && (
        <>
          {/* Desktop: Dropdown */}
          <div className="hidden md:block absolute right-4 top-full mt-2 w-96 bg-white rounded-2xl shadow-xl border border-gray-200 z-50 animate-in fade-in slide-in-from-top-2 duration-200 max-h-[600px] overflow-hidden">
            <NotificationPanel
              onClose={() => setNotificationPanelOpen(false)}
            />
          </div>
          {/* Mobile: Full Panel */}
          <div className="md:hidden fixed inset-0 z-50">
            {/* Backdrop */}
            <div
              className="absolute inset-0 bg-black/20"
              onClick={() => setNotificationPanelOpen(false)}
              aria-hidden="true"
            />
            {/* Panel */}
            <div className="absolute right-0 top-0 bottom-0 w-full max-w-sm bg-white shadow-xl animate-in slide-in-from-right duration-200">
              <NotificationPanel
                onClose={() => setNotificationPanelOpen(false)}
              />
            </div>
          </div>
        </>
      )}
    </>
  );
}
