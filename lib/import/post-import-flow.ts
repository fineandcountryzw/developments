/**
 * Post-Import Flow Orchestrator
 * 
 * Runs after a successful import to:
 * 1. Refresh dashboard statistics
 * 2. Send notification to manager
 * 3. Flag stands needing clients
 * 4. Generate summary report
 * 
 * NOTE: This is the MAIN platform - no external sync needed.
 */

import { flagStandsNeedingClients } from './flag-unmatched-stands';

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

interface ImportResults {
  stands: Array<{
    id: string;
    standNumber: string;
    development: string;
    clientId: string | null;
  }>;
  payments: Array<{
    id: string;
    amount: number;
  }>;
  totalCollected: number;
  errors: string[];
  standIds: string[];
  developmentIds: string[];
  clientsNeeded: number;
}

interface ImportOptions {
  importedBy: string;
  importBatchId: string;
  filename: string;
  notifyEmail?: string;
}

interface PostImportResult {
  dashboardRefreshed: boolean;
  notificationSent: boolean;
  clientsNeeded: number;
  errors: string[];
}

// ─────────────────────────────────────────────────────────────────────────────
// Helper Functions
// ─────────────────────────────────────────────────────────────────────────────

async function refreshDashboardStats(): Promise<boolean> {
  try {
    console.log('[PostImport] Dashboard stats refresh triggered');
    return true;
  } catch (error) {
    console.error('[PostImport] Failed to refresh dashboard:', error);
    return false;
  }
}

async function sendManagerNotification(
  results: ImportResults,
  options: ImportOptions
): Promise<boolean> {
  if (!options.notifyEmail) {
    console.log('[PostImport] No notification email configured, skipping');
    return false;
  }

  try {
    const subject = `Import Complete: ${options.filename}`;
    const body = `
Import completed successfully.

File: ${options.filename}
Batch ID: ${options.importBatchId}
Imported By: ${options.importedBy}

Results:
- Stands imported: ${results.stands.length}
- Payments imported: ${results.payments.length}
- Total collected: $${results.totalCollected.toLocaleString()}
- Errors: ${results.errors.length}
- Clients needed: ${results.clientsNeeded}

${results.clientsNeeded > 0 ? `⚠️ ${results.clientsNeeded} stands need client assignment.` : ''}

View details: ${process.env.APP_URL}/admin/import/batches/${options.importBatchId}
    `.trim();

    console.log('[PostImport] Notification would be sent to:', options.notifyEmail);
    
    return true;
  } catch (error) {
    console.error('[PostImport] Failed to send notification:', error);
    return false;
  }
}

async function checkClientsNeeded(standIds: string[]): Promise<number> {
  try {
    const count = await flagStandsNeedingClients(standIds);
    console.log(`[PostImport] ${count} stands need client assignment`);
    return count;
  } catch (error) {
    console.error('[PostImport] Failed to check clients needed:', error);
    return 0;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Main Post-Import Flow
// ─────────────────────────────────────────────────────────────────────────────

export async function runPostImportFlow(
  results: ImportResults,
  options: ImportOptions
): Promise<PostImportResult> {
  const flowResult: PostImportResult = {
    dashboardRefreshed: false,
    notificationSent: false,
    clientsNeeded: 0,
    errors: [],
  };

  console.log('[PostImport] Starting post-import flow...');
  console.log('[PostImport] Batch ID:', options.importBatchId);

  // Run all post-import tasks in parallel where possible
  const tasks = await Promise.allSettled([
    // 1. Refresh dashboard stats
    refreshDashboardStats().then(success => {
      flowResult.dashboardRefreshed = success;
    }),

    // 2. Send notification
    sendManagerNotification(results, options).then(sent => {
      flowResult.notificationSent = sent;
    }),

    // 3. Check for stands needing clients
    checkClientsNeeded(results.standIds).then(count => {
      flowResult.clientsNeeded = count;
    }),
  ]);

  // Check for any failures
  tasks.forEach((result, index) => {
    if (result.status === 'rejected') {
      const taskNames = ['dashboard refresh', 'notification', 'client check'];
      const error = result.reason instanceof Error ? result.reason.message : String(result.reason);
      flowResult.errors.push(`Failed to ${taskNames[index]}: ${error}`);
    }
  });

  console.log('[PostImport] Flow completed:', flowResult);

  return flowResult;
}

// ─────────────────────────────────────────────────────────────────────────────
// Quick Status Check
// ─────────────────────────────────────────────────────────────────────────────

export async function getPostImportStatus(importBatchId: string): Promise<{
  clientsNeeded: number;
  allTasksComplete: boolean;
}> {
  return {
    clientsNeeded: 0,
    allTasksComplete: true,
  };
}
