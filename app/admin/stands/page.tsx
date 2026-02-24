'use client';

/**
 * Admin Stands Portal
 * Full access to all stands across all developments
 */

import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import StandsDashboardView from '@/components/stands/StandsDashboardView';
import { PageContainer } from '@/components/layouts/PageContainer';

export default function AdminStandsPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [branch, setBranch] = useState('all');

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/auth/login');
    } else if (status === 'authenticated' && session?.user?.role !== 'ADMIN') {
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

  if (!session || session.user.role !== 'ADMIN') {
    return null;
  }

  return (
    <PageContainer>
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Stands Management</h1>
        <p className="text-gray-600">
          Complete overview of all stands across all developments with financial tracking
        </p>
      </div>

      <StandsDashboardView
        apiEndpoint="/api/admin/stands-financial"
        branch={branch}
        role="admin"
        canRecordPayments={true}
        title="All Stands"
        subtitle="Full access to stands across all developments and branches"
      />
    </PageContainer>
  );
}
