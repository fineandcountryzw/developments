import { NextRequest, NextResponse } from 'next/server';
import { requireRole } from '@/lib/access-control';
import prisma from '@/lib/prisma';
import {
  getStandsWithFinancials,
  getStandsStatistics,
} from '@/lib/services/stands-financial-service';

/**
 * GET /api/developer/stands-financial
 * Developer Financial View - Limited to developments owned by this developer
 * 
 * This endpoint uses the shared financial service to ensure consistency
 * with Account, Manager, and Admin dashboards.
 */
export async function GET(request: NextRequest) {
  try {
    const authResult = await requireRole(['DEVELOPER']);
    if (authResult.error) {
      return authResult.error;
    }

    if (!authResult.user) {
      return NextResponse.json(
        { success: false, error: 'User not found' },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const branch = searchParams.get('branch');
    const status = searchParams.get('status');
    const search = searchParams.get('search');

    // Get developments owned by this developer (using email)
    const developerDevelopments = await prisma.development.findMany({
      where: { developerEmail: authResult.user.email },
      select: { id: true },
    });

    const developmentIds = developerDevelopments.map((d) => d.id);

    // Fetch stands ONLY for developer's developments
    const stands = await getStandsWithFinancials({
      developmentIds: developmentIds.length > 0 ? developmentIds : undefined,
      branch: branch || undefined,
      status: status || undefined,
      search: search || undefined,
    });

    const stats = await getStandsStatistics({
      developmentIds: developmentIds.length > 0 ? developmentIds : undefined,
      branch: branch || undefined,
    });

    return NextResponse.json({
      success: true,
      stands,
      stats,
      role: 'developer',
      scope: 'owned_developments_only',
    });
  } catch (error) {
    console.error('Error fetching developer stands financial:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch stands' },
      { status: 500 }
    );
  }
}
