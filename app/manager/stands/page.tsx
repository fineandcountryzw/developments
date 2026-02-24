'use client';

/**
 * Manager Stands Portal
 * Access to stands from assigned developments only
 */

import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import StandsDashboardView from '@/components/stands/StandsDashboardView';
import { PageContainer } from '@/components/layouts/PageContainer';

export default function ManagerStandsPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [branch, setBranch] = useState('all');

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/auth/login');
    } else if (status === 'authenticated' && session?.user?.role !== 'MANAGER') {
      router.push('/dashboard');
    }
  }, [status, session, router]);

  if (status === 'loading') {
    return (
      <PageContainer>
        <div className="flex items-center justify-center h-screen">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#B8860B]"></div>
        </div>
      </PageContainer>
    );
  }

  if (!session || session.user.role !== 'MANAGER') {
    return null;
  }

  return (
    <PageContainer>
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">My Stands</h1>
        <p className="text-gray-600">
          Stands from developments you manage
        </p>
      </div>

      <StandsDashboardView
        apiEndpoint="/api/manager/stands-financial"
        branch={branch}
        role="manager"
        canRecordPayments={true}
        title="Managed Stands"
        subtitle="Access limited to developments assigned to you"
      />
    </PageContainer>
  );
}
