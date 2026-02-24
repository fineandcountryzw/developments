/**
 * Automation Worker Endpoint
 * Starts the automation worker to process pending jobs
 * 
 * @module app/api/automation/worker
 */

import { NextRequest, NextResponse } from 'next/server';
import { startAutomationWorker } from '@/lib/automation/worker';

let workerStarted = false;

export async function GET(request: NextRequest) {
  try {
    // Start worker on first request (singleton)
    if (!workerStarted) {
      await startAutomationWorker();
      workerStarted = true;
    }
    
    return NextResponse.json({
      status: 'running',
      message: 'Automation worker is running'
    });
  } catch (error: any) {
    return NextResponse.json(
      {
        status: 'error',
        error: error.message || 'Failed to start worker'
      },
      { status: 500 }
    );
  }
}
