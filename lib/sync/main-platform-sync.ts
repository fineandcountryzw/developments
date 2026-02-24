/**
 * Main Fine & Country Platform Sync
 * 
 * Syncs imported stands to the main F&C platform via its API.
 * This runs asynchronously after import via a queue system.
 */

import prisma from '@/lib/prisma';
import { v4 as uuidv4 } from 'uuid';

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export interface SyncStandData {
  standNumber: string;
  development: string;
  developer: string;
  status: string;
  priceUsd: number;
  sizeSqm: number;
  soldAt: Date | null;
  client: {
    fullName: string;
    phone: string;
    email: string;
    nationalId: string | null;
  } | null;
  totalPaid: number;
  hasAgreement: boolean;
  source: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Queue Management
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Queue stands for sync to main platform
 */
export async function queueMainPlatformSync(
  standIds: string[]
): Promise<number> {
  // Get existing pending items to avoid duplicates
  const existingPending = await prisma.syncQueue.findMany({
    where: {
      entityId: { in: standIds },
      targetPlatform: 'MAIN_FC',
      status: { in: ['PENDING', 'PROCESSING'] },
    },
    select: { entityId: true },
  });

  const existingIds = new Set(existingPending.map(p => p.entityId));
  const newIds = standIds.filter(id => !existingIds.has(id));

  if (newIds.length === 0) return 0;

  // Create sync queue entries
  await prisma.syncQueue.createMany({
    data: newIds.map(standId => ({
      id: uuidv4(),
      entityType: 'STAND',
      entityId: standId,
      status: 'PENDING',
      targetPlatform: 'MAIN_FC',
      retryCount: 0,
      createdAt: new Date(),
    })),
    skipDuplicates: true,
  });

  return newIds.length;
}

/**
 * Get sync queue status
 */
export async function getSyncQueueStatus(): Promise<{
  pending: number;
  processing: number;
  completed: number;
  failed: number;
  total: number;
}> {
  const [pending, processing, completed, failed] = await Promise.all([
    prisma.syncQueue.count({ where: { status: 'PENDING', targetPlatform: 'MAIN_FC' } }),
    prisma.syncQueue.count({ where: { status: 'PROCESSING', targetPlatform: 'MAIN_FC' } }),
    prisma.syncQueue.count({ where: { status: 'COMPLETED', targetPlatform: 'MAIN_FC' } }),
    prisma.syncQueue.count({ where: { status: 'FAILED', targetPlatform: 'MAIN_FC' } }),
  ]);

  return {
    pending,
    processing,
    completed,
    failed,
    total: pending + processing + completed + failed,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Sync Processing
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Process sync queue - called by background job or webhook
 */
export async function processSyncQueue(batchSize: number = 50): Promise<{
  processed: number;
  succeeded: number;
  failed: number;
}> {
  const pending = await prisma.syncQueue.findMany({
    where: { 
      status: 'PENDING', 
      targetPlatform: 'MAIN_FC',
      retryCount: { lt: 5 }, // Max 5 retries
    },
    take: batchSize,
    orderBy: { createdAt: 'asc' },
  });

  let succeeded = 0;
  let failed = 0;

  for (const item of pending) {
    try {
      // Mark as processing
      await prisma.syncQueue.update({
        where: { id: item.id },
        data: { 
          status: 'PROCESSING',
          processedAt: new Date(),
        },
      });

      // Fetch stand data
      const stand = await prisma.stand.findUnique({
        where: { id: item.entityId },
        include: {
          development: { 
            include: { developer: true } 
          },
          client: true,
          offlineSales: {
            include: { payments: true },
            orderBy: { createdAt: 'desc' },
            take: 1,
          },
        },
      });

      if (!stand) {
        await prisma.syncQueue.update({
          where: { id: item.id },
          data: {
            status: 'FAILED',
            error: 'Stand not found',
          },
        });
        failed++;
        continue;
      }

      // Calculate total paid
      const totalPaid = stand.offlineSales[0]?.payments.reduce(
        (sum, p) => sum + Number(p.amount), 
        0
      ) ?? 0;

      // Prepare sync data
      const syncData: SyncStandData = {
        standNumber: stand.standNumber,
        development: stand.development.name,
        developer: stand.development.developer?.name || 'Unknown',
        status: stand.status,
        priceUsd: Number(stand.price),
        sizeSqm: stand.sizeSqm,
        soldAt: stand.soldAt,
        client: stand.client ? {
          fullName: stand.client.name,
          phone: stand.client.phone,
          email: stand.client.email,
          nationalId: stand.client.nationalId,
        } : null,
        totalPaid,
        hasAgreement: false, // Could be determined from sale data
        source: 'FC_LEGACY_IMPORT',
      };

      // Push to main platform API
      const mainPlatformUrl = process.env.MAIN_PLATFORM_URL;
      const syncSecret = process.env.SYNC_SECRET_KEY;

      if (!mainPlatformUrl || !syncSecret) {
        throw new Error('Missing sync configuration (MAIN_PLATFORM_URL or SYNC_SECRET_KEY)');
      }

      const response = await fetch(
        `${mainPlatformUrl}/api/legacy/stands/sync`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Sync-Secret': syncSecret,
          },
          body: JSON.stringify(syncData),
        }
      );

      if (response.ok) {
        await prisma.syncQueue.update({
          where: { id: item.id },
          data: {
            status: 'COMPLETED',
            processedAt: new Date(),
            error: null,
          },
        });
        succeeded++;
      } else {
        const errorText = await response.text();
        throw new Error(`Main platform returned ${response.status}: ${errorText}`);
      }

    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      
      await prisma.syncQueue.update({
        where: { id: item.id },
        data: {
          status: 'FAILED',
          processedAt: new Date(),
          error: errorMsg,
          retryCount: { increment: 1 },
        },
      });
      failed++;
    }
  }

  return {
    processed: pending.length,
    succeeded,
    failed,
  };
}

/**
 * Retry failed sync items
 */
export async function retryFailedSyncs(maxRetries: number = 3): Promise<number> {
  const failed = await prisma.syncQueue.updateMany({
    where: {
      status: 'FAILED',
      targetPlatform: 'MAIN_FC',
      retryCount: { lt: maxRetries },
    },
    data: {
      status: 'PENDING',
    },
  });

  return failed.count;
}

// ─────────────────────────────────────────────────────────────────────────────
// Manual Sync Trigger
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Manually trigger sync for specific stands
 */
export async function triggerManualSync(
  standIds: string[]
): Promise<{ queued: number; message: string }> {
  const queued = await queueMainPlatformSync(standIds);
  
  return {
    queued,
    message: `${queued} stands queued for sync to main platform`,
  };
}

/**
 * Get sync history for a stand
 */
export async function getStandSyncHistory(standId: string): Promise<Array<{
  id: string;
  status: string;
  createdAt: Date;
  processedAt: Date | null;
  error: string | null;
  retryCount: number;
}>> {
  const history = await prisma.syncQueue.findMany({
    where: {
      entityId: standId,
      targetPlatform: 'MAIN_FC',
    },
    orderBy: { createdAt: 'desc' },
  });

  return history.map(h => ({
    id: h.id,
    status: h.status,
    createdAt: h.createdAt,
    processedAt: h.processedAt,
    error: h.error,
    retryCount: h.retryCount,
  }));
}
