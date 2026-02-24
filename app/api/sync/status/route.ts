/**
 * Sync Status API
 * GET /api/sync/status
 * 
 * Returns current sync queue counts by status.
 */

import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { getSyncQueueStatus } from '@/lib/sync/main-platform-sync';

export async function GET() {
  try {
    const session = await getServerSession();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const stats = await getSyncQueueStatus();
    
    return NextResponse.json(stats);
  } catch (error) {
    console.error('Sync status error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch sync status' },
      { status: 500 }
    );
  }
}
