'use client';

/**
 * Developer Stands Portal
 * Access to stands from owned developments only
 */

import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import StandsDashboardView from '@/components/stands/StandsDashboardView';
import { PageContainer } from '@/components/layouts/PageContainer';

export default function DeveloperStandsPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [branch, setBranch] = useState('all');

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/auth/login');
    } else if (status === 'authenticated' && session?.user?.role !== 'DEVELOPER') {
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

  if (!session || session.user.role !== 'DEVELOPER') {
    return null;
  }

  return (
    <PageContainer>
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">My Development Stands</h1>
        <p className="text-gray-600">
          Track stands and payments for your development properties
        </p>
      </div>

      <StandsDashboardView
        apiEndpoint="/api/developer/stands-financial"
        branch={branch}
        role="developer"
        canRecordPayments={false}
        title="My Stands"
        subtitle="View-only access to stands from your development(s)"
      />
    </PageContainer>
  );
}
