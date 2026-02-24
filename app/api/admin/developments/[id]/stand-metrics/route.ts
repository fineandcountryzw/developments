import { NextRequest } from 'next/server';
import { getDbPool } from '@/lib/db-pool';
import { apiSuccess, apiError } from '@/lib/api-response';
import { ErrorCodes } from '@/lib/error-codes';
import { requireAdmin } from '@/lib/access-control';

/**
 * GET /api/admin/developments/[id]/stand-metrics
 * 
 * Computes stand metrics from database for a development:
 * - totalValue: Sum of all stand values (size_sqm × price_per_sqm with optional VAT)
 * - avgValue: Average stand value
 * - minSize: Smallest stand size in m²
 * - maxSize: Largest stand size in m²
 * 
 * Stands without size_sqm OR price_per_sqm are excluded from value calculations.
 * Archived stands are excluded from all calculations.
 */
export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const authResult = await requireAdmin();
        if (authResult.error) return authResult.error;

        const { id } = await params;
        const pool = getDbPool();

        // 1. Get development settings for VAT calculation
        const devQuery = await pool.query(
            `SELECT vat_enabled, vat_percentage FROM developments WHERE id = $1`,
            [id]
        );

        if (devQuery.rows.length === 0) {
            return apiError('Development not found', 404, ErrorCodes.NOT_FOUND);
        }

        const dev = devQuery.rows[0];
        const vatMultiplier = dev.vat_enabled
            ? 1 + (parseFloat(dev.vat_percentage || '15') / 100)
            : 1;

        // 2. Compute metrics from stands table
        const metricsQuery = await pool.query(`
      SELECT 
        COUNT(*) as total_stands,
        COUNT(CASE 
            WHEN (size_sqm IS NOT NULL AND price_per_sqm IS NOT NULL) OR price > 0 
            THEN 1 
        END) as valid_stands,
        SUM(
          CASE 
            WHEN price > 0 THEN price * $1
            WHEN size_sqm IS NOT NULL AND price_per_sqm IS NOT NULL 
            THEN size_sqm * price_per_sqm * $1
            ELSE 0 
          END
        ) as total_value,
        MIN(size_sqm) as min_size,
        MAX(size_sqm) as max_size
      FROM stands 
      WHERE development_id = $2 
        AND status != 'ARCHIVED'
    `, [vatMultiplier, id]);

        const metrics = metricsQuery.rows[0];
        const validStands = parseInt(metrics.valid_stands || '0', 10);
        const totalStands = parseInt(metrics.total_stands || '0', 10);
        const totalValue = parseFloat(metrics.total_value || '0');
        const avgValue = validStands > 0 ? totalValue / validStands : null;

        return apiSuccess({
            totalValue: totalValue > 0 ? totalValue : null,
            avgValue,
            minSize: metrics.min_size ? parseFloat(metrics.min_size) : null,
            maxSize: metrics.max_size ? parseFloat(metrics.max_size) : null,
            validStands,
            totalStands,
            hasPartialData: validStands < totalStands && validStands > 0,
            allMissingData: validStands === 0 && totalStands > 0
        });
    } catch (error: any) {
        console.error('Stand metrics error:', error);
        return apiError(error?.message || 'Server error', 500, ErrorCodes.FETCH_ERROR);
    }
}
