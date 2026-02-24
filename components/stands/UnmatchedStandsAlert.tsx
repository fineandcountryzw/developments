'use client';

import React from 'react';
import { UserX, AlertTriangle, ChevronRight } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';

interface UnmatchedStandsAlertProps {
  count: number;
  variant?: 'banner' | 'compact';
}

/**
 * Alert banner shown when there are stands with no client assigned
 * 
 * Usage:
 * - Dashboard: Show full banner at top
 * - Stands page: Show compact version inline
 */
export const UnmatchedStandsAlert: React.FC<UnmatchedStandsAlertProps> = ({
  count,
  variant = 'banner',
}) => {
  if (count === 0) return null;

  if (variant === 'compact') {
    return (
      <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-3 flex items-center gap-3">
        <AlertTriangle className="text-amber-400 flex-shrink-0" size={18} />
        <p className="text-amber-300 text-sm flex-1">
          <span className="font-semibold">{count}</span> stands need client assignment
        </p>
        <Link href="/stands?filter=no-client">
          <Button variant="ghost" size="sm" className="text-amber-300 hover:text-amber-200">
            View <ChevronRight size={14} />
          </Button>
        </Link>
      </div>
    );
  }

  // Full banner variant (dashboard)
  return (
    <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-4 flex items-center justify-between">
      <div className="flex items-center gap-3">
        <div className="p-2 bg-amber-500/20 rounded-full">
          <UserX className="text-amber-400" size={20} />
        </div>
        <div>
          <p className="text-amber-300 font-semibold">
            {count} {count === 1 ? 'stand' : 'stands'} need client assignment
          </p>
          <p className="text-amber-400/70 text-sm">
            These stands were imported but have no client linked yet
          </p>
        </div>
      </div>
      <Link href="/admin/stands?filter=no-client">
        <Button 
          variant="outline" 
          size="sm"
          className="border-amber-500/50 text-amber-300 hover:bg-amber-500/20 hover:text-amber-200"
        >
          Assign Clients <ChevronRight size={14} className="ml-1" />
        </Button>
      </Link>
    </div>
  );
};

export default UnmatchedStandsAlert;
