/**
 * Development Stands Table API
 * GET /api/developments/[id]/stands/table
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/authOptions';
import prisma from '@/lib/prisma';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // const session = await getServerSession(authOptions);
    // if (!session?.user) {
    //   return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    // }

    const { id: developmentId } = await params;

    const stands = await prisma.stand.findMany({
      where: { developmentId },
      orderBy: { standNumber: 'asc' },
      select: {
        id: true,
        standNumber: true,
        sizeSqm: true,
        price: true,
        status: true,
        soldAt: true,
      },
    });

    // Format stands for frontend
    const formattedStands = stands.map((stand) => ({
      id: stand.id,
      standNumber: stand.standNumber,
      status: stand.status.toLowerCase(),
      price: Number(stand.price),
      size: stand.sizeSqm ? `${stand.sizeSqm} sqm` : undefined,
      ownerName: undefined,
      ownerEmail: undefined,
      reservationDate: undefined,
      saleDate: stand.soldAt?.toISOString().split('T')[0] || undefined,
    }));

    // Get development details to check map settings
    // Note: disableMapView column may not exist yet - use raw query fallback
    let hasGeoJsonMap = false;
    let disableMapView = false;

    try {
      const devResult = await prisma.$queryRaw`
        SELECT has_geo_json_map, geo_json_data,
               COALESCE(disable_map_view, false) as disable_map_view
        FROM developments
        WHERE id = ${developmentId}
      `;

      if (Array.isArray(devResult) && devResult.length > 0) {
        const dev = devResult[0] as any;
        hasGeoJsonMap = !!(dev.has_geo_json_map && dev.geo_json_data);
        disableMapView = !!dev.disable_map_view;
      }
    } catch (error) {
      // If column doesn't exist yet, fall back to basic query
      const development = await prisma.development.findUnique({
        where: { id: developmentId },
        select: { hasGeoJsonMap: true, geoJsonData: true },
      });
      hasGeoJsonMap = !!(development?.hasGeoJsonMap && development?.geoJsonData);
      disableMapView = false;
    }

    return NextResponse.json({
      stands: formattedStands,
      hasGeoJsonMap,
      disableMapView,
    });
  } catch (error) {
    console.error('Fetch stands error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch stands' },
      { status: 500 }
    );
  }
}
