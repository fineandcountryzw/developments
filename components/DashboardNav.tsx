/**
 * Dashboard Navigation Component
 * Links to role-specific dashboards
 */

'use client';

import React from 'react';
import Link from 'next/link';
import { useSession } from 'next-auth/react';
import { BarChart3, TrendingUp, Home, DollarSign, ChevronRight } from 'lucide-react';

export function DashboardNav() {
  const { data: session, status } = useSession();
  
  // Don't render anything while loading to prevent flicker
  if (status === 'loading') {
    return null;
  }
  
  const userRole = session?.user?.role;

  const dashboards = [
    {
      role: 'manager',
      label: 'Manager Dashboard',
      href: '/dashboards/manager',
      icon: BarChart3,
      description: 'Team KPIs, branch analytics',
      color: 'from-blue-500 to-blue-600',
    },
    {
      role: 'agent',
      label: 'Agent Dashboard',
      href: '/dashboards/agent',
      icon: TrendingUp,
      description: 'Sales pipeline, prospects',
      color: 'from-green-500 to-green-600',
    },
    {
      role: 'client',
      label: 'Client Portal',
      href: '/dashboards/client',
      icon: Home,
      description: 'Properties, reservations',
      color: 'from-purple-500 to-purple-600',
    },
    {
      role: 'accounts',
      label: 'Accounts Dashboard',
      href: '/dashboards/accounts',
      icon: DollarSign,
      description: 'Invoices, payments',
      color: 'from-orange-500 to-orange-600',
    },
  ];

  if (!userRole) return null;

  const userDashboard = dashboards.find(d => d.role === userRole);

  if (!userDashboard) return null;

  const Icon = userDashboard.icon;

  return (
    <div className="space-y-4">
      {/* Main Dashboard Link */}
      <Link href={userDashboard.href}>
        <div className={`bg-gradient-to-r ${userDashboard.color} rounded-lg p-6 text-white cursor-pointer hover:shadow-lg transition-shadow`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Icon className="w-8 h-8" />
              <div>
                <h3 className="font-semibold text-lg">{userDashboard.label}</h3>
                <p className="text-sm opacity-90">{userDashboard.description}</p>
              </div>
            </div>
            <ChevronRight className="w-6 h-6" />
          </div>
        </div>
      </Link>

      {/* Other Available Dashboards */}
      <div>
        <p className="text-sm font-semibold text-gray-600 mb-3">Other Dashboards</p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {dashboards
            .filter(d => d.role !== userRole)
            .map(dashboard => {
              const Icon = dashboard.icon;
              return (
                <Link
                  key={dashboard.role}
                  href={dashboard.href}
                  className="block p-4 border border-gray-200 rounded-lg hover:border-gray-300 hover:bg-gray-50 transition-colors"
                >
                  <div className="flex items-start gap-3">
                    <Icon className={`w-5 h-5 text-gray-400 mt-1 flex-shrink-0`} />
                    <div>
                      <p className="font-medium text-gray-900">{dashboard.label}</p>
                      <p className="text-xs text-gray-600 mt-1">{dashboard.description}</p>
                    </div>
                  </div>
                </Link>
              );
            })}
        </div>
      </div>
    </div>
  );
}
