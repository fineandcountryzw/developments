/**
 * Flag Stands Needing Client Assignment
 * 
 * Utilities for identifying and managing stands that have been
 * imported but don't have a client linked yet.
 */

import prisma from '@/lib/prisma';

/**
 * Count stands with no client linked
 */
export async function flagStandsNeedingClients(
  standIds?: string[]
): Promise<number> {
  const where: any = {
    clientId: null,
    status: 'SOLD',
  };

  if (standIds && standIds.length > 0) {
    where.id = { in: standIds };
  }

  const count = await prisma.stand.count({ where });
  return count;
}

/**
 * Get detailed list of stands needing clients
 */
export async function getStandsNeedingClients(
  options: {
    developmentId?: string;
    limit?: number;
    offset?: number;
  } = {}
): Promise<Array<{
  id: string;
  standNumber: string;
  development: {
    id: string;
    name: string;
    developer: {
      id: string;
      name: string;
    };
  };
  price: number;
  sizeSqm: number;
  soldAt: Date | null;
  agentName: string | null;
  importBatchId: string | null;
  createdAt: Date;
}>> {
  const { developmentId, limit = 50, offset = 0 } = options;

  const where: any = {
    clientId: null,
    status: 'SOLD',
  };

  if (developmentId) {
    where.developmentId = developmentId;
  }

  const stands = await prisma.stand.findMany({
    where,
    include: {
      development: {
        include: {
          developer: true,
        },
      },
      importBatch: true,
    },
    orderBy: {
      soldAt: 'desc',
    },
    take: limit,
    skip: offset,
  });

  return stands.map(stand => ({
    id: stand.id,
    standNumber: stand.standNumber,
    development: {
      id: stand.development.id,
      name: stand.development.name,
      developer: {
        id: stand.development.developer?.id || '',
        name: stand.development.developer?.name || 'Unknown',
      },
    },
    price: Number(stand.price),
    sizeSqm: stand.sizeSqm,
    soldAt: stand.soldAt,
    agentName: stand.agentName,
    importBatchId: stand.importBatchId,
    createdAt: stand.createdAt,
  }));
}

/**
 * Get count of unmatched stands grouped by development
 */
export async function getUnmatchedStandStats(): Promise<{
  totalUnmatched: number;
  byDevelopment: Array<{
    developmentId: string;
    developmentName: string;
    developerName: string;
    count: number;
  }>;
}> {
  const unmatchedStands = await prisma.stand.findMany({
    where: {
      clientId: null,
      status: 'SOLD',
    },
    include: {
      development: {
        include: {
          developer: true,
        },
      },
    },
  });

  const byDevelopment = unmatchedStands.reduce((acc, stand) => {
    const devId = stand.development.id;
    const existing = acc.find(d => d.developmentId === devId);
    
    if (existing) {
      existing.count++;
    } else {
      acc.push({
        developmentId: devId,
        developmentName: stand.development.name,
        developerName: stand.development.developer?.name || 'Unknown',
        count: 1,
      });
    }
    
    return acc;
  }, [] as Array<{
    developmentId: string;
    developmentName: string;
    developerName: string;
    count: number;
  }>);

  return {
    totalUnmatched: unmatchedStands.length,
    byDevelopment: byDevelopment.sort((a, b) => b.count - a.count),
  };
}
