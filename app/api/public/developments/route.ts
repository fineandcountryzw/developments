import { NextRequest, NextResponse } from 'next/server';
import { getDbPool } from '@/lib/db-pool';
import { logger } from '@/lib/logger';

// Force dynamic execution for public API
export const dynamic = 'force-dynamic';
export const revalidate = 0;

/**
 * GET /api/public/developments
 * 
 * Public endpoint to fetch developments for the landing page.
 * Returns:
 * - featured: Developments with is_public=true AND featured_rank IS NOT NULL (ordered by rank)
 * - list: Developments with is_public=true (ordered by display_rank)
 * 
 * Strips sensitive internal fields.
 */
export async function GET(request: NextRequest) {
    const startTime = Date.now();

    try {
        // Shared pool for efficiency
        const pool = getDbPool();

        // 1. Fetch ALL public developments in one query for efficiency
        const query = `
      SELECT 
        id, name, location, description, overview,
        phase, status, base_price, price_per_sqm,
        vat_percentage, endowment_fee, total_area_sqm,
        total_stands, available_stands, main_image,
        gallery, geo_json_url, geo_json_data,
        latitude, longitude, image_urls, logo_url,
        document_urls, stand_sizes, stand_types, features,
        installment_periods, deposit_percentage,
        vat_enabled, endowment_enabled, aos_enabled, aos_fee,
        cessions_enabled, cession_fee, admin_fee_enabled, admin_fee,
        is_public, featured_rank, display_rank,
        updated_at
      FROM developments
      WHERE is_public = true
      ORDER BY 
        CASE WHEN featured_rank IS NOT NULL THEN featured_rank ELSE 999999 END ASC,
        CASE WHEN display_rank IS NOT NULL THEN display_rank ELSE 999999 END ASC,
        updated_at DESC
    `;

        const result = await pool.query(query);
        const rows = result.rows;

        // 2. Separate into Featured and List
        // Featured = has non-null featured_rank
        const featured = rows
            .filter(dev => dev.featured_rank !== null)
            .sort((a, b) => (a.featured_rank || 0) - (b.featured_rank || 0));

        // List = all public (can include featured ones, but sorted by display_rank)
        // If you want to exclude featured from list, filter here.
        // Requirement says: "Normal list = where isPublic=true"
        const list = [...rows].sort((a, b) => {
            const rankA = a.display_rank !== null ? a.display_rank : 999999;
            const rankB = b.display_rank !== null ? b.display_rank : 999999;
            if (rankA !== rankB) return rankA - rankB;
            return new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime();
        });

        const duration = Date.now() - startTime;

        // Log minimal stats
        logger.info('Public developments fetched', {
            module: 'API',
            total: rows.length,
            featured: featured.length,
            duration
        });

        return NextResponse.json({
            success: true,
            data: {
                featured,
                list
            }
        });

    } catch (error: any) {
        console.error('API ERROR PUBLIC DEVELOPMENTS:', error);
        logger.error('Failed to fetch public developments', error, { module: 'API' });
        return NextResponse.json(
            { success: false, error: error instanceof Error ? error.message : String(error) },
            { status: 500 }
        );
    }
}
