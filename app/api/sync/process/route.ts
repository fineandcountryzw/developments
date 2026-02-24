/**
 * Sync Process API
 * POST /api/sync/process
 * 
 * Triggers processing of the sync queue.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { processSyncQueue } from '@/lib/sync/main-platform-sync';

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Optional batch size from request
    const body = await request.json().catch(() => ({}));
    const batchSize = body.batchSize || 50;

    const result = await processSyncQueue(batchSize);
    
    return NextResponse.json({
      success: true,
      processed: result.processed,
      succeeded: result.succeeded,
      failed: result.failed,
      message: `Processed ${result.processed} items: ${result.succeeded} succeeded, ${result.failed} failed`,
    });
  } catch (error) {
    console.error('Sync process error:', error);
    return NextResponse.json(
      { error: 'Failed to process sync queue' },
      { status: 500 }
    );
  }
}
