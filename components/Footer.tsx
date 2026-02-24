/**
 * Premium Minimal Footer Component
 * Clean, organized, helpful footer with minimal design
 * 
 * Structure:
 * - Top Footer: Logo, tagline, quick links, contact
 * - Bottom Bar: Copyright and legal
 */

'use client';

import React from 'react';
import Link from 'next/link';
import { MapPin, Phone, Mail, ArrowRight } from 'lucide-react';
import { Logo } from './Logo';
import { COMPANY_CONFIG, formatPhoneForTel } from '@/lib/config/company';

export type LegalPageType = 'privacy' | 'terms' | 'cookies';

interface FooterProps {
  /** Legal page handler */
  onLegalPageClick?: (type: LegalPageType) => void;
}

const FOOTER_CONFIG = {
  quickLinks: [
    { label: 'Home', href: '/' },
    { label: 'Developments', href: '#inventory' },
    { label: 'Reserve', href: '#reserve' },
    { label: 'Contact', href: '#contact' },
  ],
  dashboardLinks: [
    { label: 'Developer Access', href: '/dashboards/developer' },
    { label: 'Accounts Access', href: '/dashboards/account' },
    { label: 'Agent Access', href: '/dashboards/agent' },
    { label: 'Manager Access', href: '/dashboards/manager' },
    { label: 'Client Access', href: '/dashboards/client' },
  ],
  legalLinks: [
    { label: 'Refund Policy', type: 'privacy' },
    { label: 'Payment Terms', type: 'terms' },
    { label: 'Privacy Policy', type: 'cookies' },
  ],
};

export const Footer: React.FC<FooterProps> = ({ onLegalPageClick }) => {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="bg-gray-50 border-t border-gray-200">
      {/* Top Footer */}
      <div className="max-w-7xl mx-auto px-4 md:px-6 lg:px-8 py-12 md:py-16">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8 md:gap-12">
          {/* Left: Logo & Tagline */}
          <div className="space-y-4">
            <Logo variant="footer" />
            <p className="text-sm text-gray-600 leading-relaxed max-w-xs">
              {COMPANY_CONFIG.tagline}
            </p>
            <p className="text-xs text-gray-500 leading-relaxed">
              {COMPANY_CONFIG.trustStatement}
            </p>
          </div>

          {/* Quick Links */}
          <div className="space-y-4">
            <h4 className="text-sm font-semibold text-gray-900 uppercase tracking-wider">
              Quick Links
            </h4>
            <nav className="flex flex-col space-y-3">
              {FOOTER_CONFIG.quickLinks.map((link, idx) => (
                <button
                  key={`${link.label}-${idx}`}
                  onClick={() => {
                    if (link.href === '/') {
                      window.scrollTo({ top: 0, behavior: 'smooth' });
                    } else {
                      const targetId = link.href.replace('#', '');
                      const element = document.getElementById(targetId);
                      if (element) {
                        element.scrollIntoView({ behavior: 'smooth', block: 'start' });
                      }
                    }
                  }}
                  className="text-sm text-gray-600 hover:text-fcGold transition-colors duration-150 flex items-center group text-left"
                >
                  <span>{link.label}</span>
                  <ArrowRight size={14} className="ml-2 opacity-0 group-hover:opacity-100 group-hover:translate-x-1 transition-all" />
                </button>
              ))}
            </nav>
          </div>

          {/* Dashboard Access */}
          <div className="space-y-4">
            <h4 className="text-sm font-semibold text-gray-900 uppercase tracking-wider">
              Dashboard Access
            </h4>
            <nav className="flex flex-col space-y-3">
              {FOOTER_CONFIG.dashboardLinks.map((link, idx) => (
                <Link
                  key={`${link.label}-${idx}`}
                  href={link.href}
                  className="text-sm text-gray-600 hover:text-fcGold transition-colors duration-150 flex items-center group"
                >
                  <span>{link.label}</span>
                  <ArrowRight size={14} className="ml-2 opacity-0 group-hover:opacity-100 group-hover:translate-x-1 transition-all" />
                </Link>
              ))}
            </nav>
          </div>

          {/* Right: Contact */}
          <div className="space-y-4">
            <h4 className="text-sm font-semibold text-gray-900 uppercase tracking-wider">
              Contact
            </h4>
            <div className="space-y-6">
              {COMPANY_CONFIG.contacts.map((branch, idx) => (
                <div key={idx} className="space-y-2">
                  <div className="text-xs font-semibold text-gray-900 uppercase tracking-wider">
                    {branch.label}
                  </div>
                  <div className="space-y-2 text-sm text-gray-600">
                    <div className="flex items-start gap-2">
                      <MapPin size={14} className="text-gray-400 mt-0.5 flex-shrink-0" />
                      <span className="leading-relaxed">{branch.address}</span>
                    </div>
                    <a
                      href={`tel:${formatPhoneForTel(branch.phone)}`}
                      className="flex items-center gap-2 hover:text-fcGold transition-colors duration-150"
                    >
                      <Phone size={14} className="text-gray-400 flex-shrink-0" />
                      <span>{branch.phone}</span>
                    </a>
                    <a
                      href={`mailto:${branch.email}`}
                      className="flex items-center gap-2 hover:text-fcGold transition-colors duration-150"
                    >
                      <Mail size={14} className="text-gray-400 flex-shrink-0" />
                      <span>{branch.email}</span>
                    </a>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Legal Links */}
        {onLegalPageClick && (
          <div className="mt-12 pt-8 border-t border-gray-200">
            <div className="flex flex-wrap gap-6">
              {FOOTER_CONFIG.legalLinks.map((link, idx) => (
                <button
                  key={idx}
                  onClick={() => onLegalPageClick(link.type as LegalPageType)}
                  className="text-xs text-gray-500 hover:text-fcGold transition-colors duration-150 uppercase tracking-wider"
                >
                  {link.label}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Bottom Bar */}
      <div className="border-t border-gray-200 bg-white">
        <div className="max-w-7xl mx-auto px-4 md:px-6 lg:px-8 py-6">
          <div className="flex flex-col md:flex-row justify-between items-center gap-4 text-xs text-gray-500">
            <div>
              © {currentYear} Fine & Country Zimbabwe. All rights reserved.
            </div>
            <div className="text-xs text-gray-400">
              Secure • Transparent • Verified
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
