/**
 * Premium White Header Component
 * Reusable header with white background, ensuring logo visibility
 *
 * Features:
 * - Solid white background (#FFFFFF)
 * - Subtle bottom border or shadow
 * - Consistent height (desktop 72-80px, mobile 60-64px)
 * - Sticky behavior with scroll state
 * - Logo always visible
 * - Clean navigation and CTA
 */

"use client";

import React, { useState, useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import { useSession } from "next-auth/react";
import { Menu, X } from "lucide-react";
import { Logo } from "./Logo";
import { useSessionManager } from "@/hooks/useSessionManager";
import { NotificationBell } from "./notifications";

interface HeaderProps {
  /** Primary CTA text */
  primaryCTA?: string;
  /** Primary CTA action */
  onPrimaryCTAClick?: () => void;
  /** Navigation links */
  navLinks?: Array<{ label: string; href: string }>;
  /** Show mobile menu */
  showMobileMenu?: boolean;
}

export const Header: React.FC<HeaderProps> = ({
  primaryCTA = "Reserve Your Stand",
  onPrimaryCTAClick,
  navLinks = [],
  showMobileMenu = true,
}) => {
  const router = useRouter();
  const pathname = usePathname();
  const { isSessionActive, signOut, session, status } = useSessionManager();
  // const { data: session, status } = useSession({
  //    required: true,
  //   onUnauthenticated() {
  //     // The user is not authenticated, handle it here.
  //   },
  // });
  const [isScrolled, setIsScrolled] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Handle scroll state
  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 20);
    };
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const handleAccessPortal = async () => {
    // Prevent action during auth check
    if (status === "loading") return;

    // Force refresh session from server (bypasses client cache)
    const sessionResponse = await fetch("/api/auth/session?t=" + Date.now(), {
      cache: "no-store", // Prevent any caching
      headers: { "Cache-Control": "no-cache" },
    });
    const currentSession = await sessionResponse.json();

    // If authenticated, route directly to dashboard (via post-login)
    if (isSessionActive) {
      router.push("/post-login");
      return;
    }

    // If not authenticated, route to login screen
    router.push("/login");
  };

  const defaultNavLinks = [
    { label: "Home", href: "/" },
    { label: "Developments", href: "#inventory" },
    { label: "How It Works", href: "#process-timeline" },
  ];

  const links = navLinks.length > 0 ? navLinks : defaultNavLinks;

  return (
    <header
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-500 ${isScrolled
          ? "h-16 md:h-20 bg-white/80 backdrop-blur-md border-b border-gray-100 shadow-forensic-sm"
          : "h-20 md:h-24 bg-transparent border-b border-transparent"
        }`}
    >
      <div className="max-w-7xl mx-auto h-full px-4 md:px-6 lg:px-8">
        <div className="flex items-center justify-between h-full">
          {/* Logo */}
          <div className="flex items-center shrink-0">
            <button
              onClick={() => router.push("/")}
              className="flex items-center"
              aria-label="Home"
            >
              <Logo variant="header" priority />
            </button>
          </div>

          {/* Desktop Navigation */}
          <nav className="hidden lg:flex items-center gap-10">
            {links.map((link) => {
              const isActive =
                pathname === link.href ||
                (link.href === "/" && pathname === "/");
              return (
                <a
                  key={link.href}
                  href={link.href}
                  className={`relative text-sm font-medium tracking-wide transition-all duration-300 group ${isActive ? "text-fcGold" : "text-fcSlate hover:text-fcGold"
                    } ${!isScrolled && "text-fcSlate"}`}
                >
                  {link.label}
                  <span className={`absolute -bottom-1 left-0 w-0 h-0.5 bg-fcGold transition-all duration-300 group-hover:w-full ${isActive ? 'w-full' : ''}`} />
                </a>
              );
            })}
          </nav>

          {/* Desktop CTA */}
          <div className="hidden lg:flex items-center gap-6">
            {/* Notification Bell - only show when authenticated */}
            {isSessionActive && <NotificationBell />}

            {onPrimaryCTAClick ? (
              <button
                onClick={onPrimaryCTAClick}
                className="px-8 py-3 bg-fcGold text-white font-bold text-xs uppercase tracking-widest rounded-xl hover:bg-fcGold/90 hover:shadow-lg hover:shadow-fcGold/20 transition-all duration-300 active:scale-95"
              >
                {primaryCTA}
              </button>
            ) : (
              <button
                onClick={() => {
                  const inventorySection = document.getElementById("inventory");
                  inventorySection?.scrollIntoView({
                    behavior: "smooth",
                    block: "start",
                  });
                }}
                className="px-8 py-3 bg-fcGold text-white font-bold text-xs uppercase tracking-widest rounded-xl hover:bg-fcGold/90 hover:shadow-lg hover:shadow-fcGold/20 transition-all duration-300 active:scale-95"
              >
                {primaryCTA}
              </button>
            )}
            <button
              onClick={handleAccessPortal}
              disabled={status === "loading"}
              className="px-6 py-2.5 bg-white border border-gray-200 text-gray-700 font-semibold text-sm rounded-xl hover:border-fcGold hover:text-fcGold focus:outline-none focus:ring-2 focus:ring-fcGold focus:ring-offset-2 transition-all duration-150 ease-out disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {status === "loading"
                ? "Checking..."
                : status === "authenticated" && session?.user
                  ? "Go to Dashboard"
                  : "Access Portal (Login)"}
            </button>
          </div>

          {/* Mobile Menu Button */}
          {showMobileMenu && (
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="lg:hidden p-2 text-gray-700 hover:text-fcGold transition-colors"
              aria-label="Toggle menu"
            >
              {mobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
            </button>
          )}
        </div>
      </div>

      {/* Mobile Menu */}
      {mobileMenuOpen && showMobileMenu && (
        <div className="lg:hidden absolute top-full left-0 right-0 bg-white border-t border-gray-100 shadow-lg">
          <nav className="px-4 py-6 space-y-4">
            {links.map((link) => {
              const isActive =
                pathname === link.href ||
                (link.href === "/" && pathname === "/");
              return (
                <a
                  key={link.href}
                  href={link.href}
                  onClick={() => setMobileMenuOpen(false)}
                  className={`block text-base font-medium transition-colors duration-150 ${isActive ? "text-fcGold" : "text-gray-700 hover:text-fcGold"
                    }`}
                >
                  {link.label}
                </a>
              );
            })}
            <div className="pt-4 border-t border-gray-100 space-y-3">
              {onPrimaryCTAClick ? (
                <button
                  onClick={() => {
                    setMobileMenuOpen(false);
                    onPrimaryCTAClick();
                  }}
                  className="w-full px-6 py-3 bg-fcGold text-white font-semibold text-base rounded-xl hover:bg-fcGold/90 transition-all duration-150 ease-out shadow-sm"
                >
                  {primaryCTA}
                </button>
              ) : (
                <button
                  onClick={() => {
                    setMobileMenuOpen(false);
                    const inventorySection =
                      document.getElementById("inventory");
                    inventorySection?.scrollIntoView({
                      behavior: "smooth",
                      block: "start",
                    });
                  }}
                  className="w-full px-6 py-3 bg-fcGold text-white font-semibold text-base rounded-xl hover:bg-fcGold/90 transition-all duration-150 ease-out shadow-sm"
                >
                  {primaryCTA}
                </button>
              )}
              <button
                onClick={() => {
                  setMobileMenuOpen(false);
                  handleAccessPortal();
                }}
                disabled={status === "loading"}
                className="w-full px-6 py-3 bg-white border border-gray-200 text-gray-700 font-semibold text-base rounded-xl hover:border-fcGold hover:text-fcGold transition-all duration-150 ease-out disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {status === "loading"
                  ? "Checking..."
                  : isSessionActive
                    ? "Go to Dashboard"
                    : "Access Portal (Login)"}
              </button>
            </div>
          </nav>
        </div>
      )}
    </header>
  );
};

export default Header;
