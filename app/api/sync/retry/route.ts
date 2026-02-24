/**
 * Sync Retry API
 * POST /api/sync/retry
 * 
 * Retries failed sync items.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { retryFailedSyncs } from '@/lib/sync/main-platform-sync';

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Optional max retries from request
    const body = await request.json().catch(() => ({}));
    const maxRetries = body.maxRetries || 3;

    const queued = await retryFailedSyncs(maxRetries);
    
    return NextResponse.json({
      success: true,
      queued,
      message: `Queued ${queued} failed items for retry`,
    });
  } catch (error) {
    console.error('Sync retry error:', error);
    return NextResponse.json(
      { error: 'Failed to retry failed items' },
      { status: 500 }
    );
  }
}
