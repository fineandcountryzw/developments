/**
 * Dashboard Router - Routes users to their role-specific dashboard
 */

'use client';

import React from 'react';
import { useSession } from 'next-auth/react';
import { redirect } from 'next/navigation';
import { ManagerDashboard, AgentDashboard, ClientDashboard } from '@/components/dashboards';

interface DashboardRouterProps {
  userRole?: string;
}

export function DashboardRouter({ userRole }: DashboardRouterProps) {
  const { data: session, status } = useSession();

  if (status === 'loading') {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  if (!session) {
    redirect('/login');
    return null;
  }

  const role = userRole || session.user?.role;

  return (
    <main className="p-6 bg-gray-50 min-h-screen">
      {role === 'admin' && <div className="text-center py-12"><h2 className="text-2xl font-bold text-gray-900">Admin Dashboard</h2><p className="text-gray-600 mt-2">Redirecting to Admin dashboard...</p></div>}
      {role === 'manager' && <ManagerDashboard />}
      {role === 'agent' && <AgentDashboard />}
      {role === 'client' && <ClientDashboard />}
      {!['admin', 'manager', 'agent', 'client'].includes(role) && (
        <div className="text-center py-12">
          <h2 className="text-2xl font-bold text-red-600">Unauthorized</h2>
          <p className="text-gray-600 mt-2">Your role is not configured for dashboard access</p>
        </div>
      )}
    </main>
  );
}
