'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

/**
 * Redirect page: /developments/browse -> /#inventory
 * 
 * This redirects users from the old duplicate developments page
 * to the landing page developments section for a consistent experience.
 * 
 * Backward compatibility: Preserves bookmarks and deep links.
 */
export default function BrowseDevelopmentsPage() {
  const router = useRouter();

  useEffect(() => {
    // Redirect to landing page developments section
    // Use window.location for anchor navigation to work properly
    window.location.href = '/#inventory';
  }, [router]);

  // Show minimal loading state during redirect
  return (
    <div className="min-h-screen flex items-center justify-center bg-white">
      <div className="text-center space-y-3">
        <p className="text-base text-gray-600 font-normal">Redirecting to developments...</p>
      </div>
    </div>
  );
}
