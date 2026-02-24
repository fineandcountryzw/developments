import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/adminAuth';
import { getDbPool } from '@/lib/db-pool';
import { logger } from '@/lib/logger';
import { apiSuccess, apiError } from '@/lib/api-response';
import { ErrorCodes } from '@/lib/error-codes';
import { parseRangeSpec } from '@/lib/standRange';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

/**
 * POST /api/admin/developments/[id]/discounts
 * 
 * Apply a percentage discount to stands by stand number series/range.
 * 
 * @param request - Request containing discount configuration
 * @param request.body.discountPercent - Discount percentage (0 < percent < 100)
 * @param request.body.rangeSpec - Stand number range spec (e.g., "1-20,45-60")
 * @param request.body.active - Whether discount is active (default: true)
 * @param request.body.applyToSold - Whether to apply discount to SOLD stands (default: false)
 * @param request.body.applyToReserved - Whether to apply discount to RESERVED stands (default: true)
 * 
 * @returns Summary of updated stands
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const startTime = Date.now();
  
  try {
    const { id: developmentId } = await params;
    
    logger.info('POST /api/admin/developments/[id]/discounts called', {
      module: 'API',
      action: 'APPLY_DISCOUNT',
      developmentId
    });

    // Require Admin or Developer role
    const authResult = await requireAdmin(request);
    if (authResult.error) {
      return authResult.error;
    }
    const user = authResult.user;

    // Developer can only discount their own developments
    if (user.role === 'DEVELOPER') {
      // Verify development ownership (check if developer_email matches)
      const pool = getDbPool();
      const devCheck = await pool.query(
        'SELECT developer_email FROM developments WHERE id = $1',
        [developmentId]
      );
      
      if (devCheck.rows.length === 0) {
        return apiError('Development not found', 404, ErrorCodes.NOT_FOUND);
      }

      const devEmail = devCheck.rows[0].developer_email;
      if (devEmail !== user.email) {
        return apiError(
          'Unauthorized: You can only apply discounts to your own developments',
          403,
          ErrorCodes.ACCESS_DENIED
        );
      }
    }

    // Parse request body
    let body;
    try {
      body = await request.json();
    } catch (parseError: any) {
      logger.error('JSON parse error', parseError, { module: 'API', action: 'APPLY_DISCOUNT' });
      return apiError('Invalid JSON', 400, ErrorCodes.PARSE_ERROR);
    }

    const {
      discountPercent,
      rangeSpec,
      active = true,
      applyToSold = false,
      applyToReserved = true
    } = body;

    // Validate discountPercent
    if (typeof discountPercent !== 'number' || discountPercent <= 0 || discountPercent >= 100) {
      return apiError(
        'discountPercent must be a number between 0 and 100 (exclusive)',
        400,
        ErrorCodes.VALIDATION_ERROR
      );
    }

    // Validate rangeSpec
    if (!rangeSpec || typeof rangeSpec !== 'string' || !rangeSpec.trim()) {
      return apiError(
        'rangeSpec is required and must be a non-empty string',
        400,
        ErrorCodes.VALIDATION_ERROR
      );
    }

    // Parse range specification
    const pool = getDbPool();
    
    // Get existing stand numbers for validation
    const existingStandsResult = await pool.query(
      'SELECT stand_number FROM stands WHERE development_id = $1',
      [developmentId]
    );
    const existingStandNumbers = existingStandsResult.rows.map((r: any) => r.stand_number);

    const parseResult = parseRangeSpec(rangeSpec, existingStandNumbers);
    
    if (parseResult.errors.length > 0) {
      // Filter out warnings, only return actual errors
      const actualErrors = parseResult.errors.filter(e => !e.startsWith('Warning:'));
      if (actualErrors.length > 0) {
        return apiError(
          `Invalid range specification: ${actualErrors.join('; ')}`,
          400,
          ErrorCodes.VALIDATION_ERROR,
          { errors: actualErrors, warnings: parseResult.errors.filter(e => e.startsWith('Warning:')) }
        );
      }
    }

    if (parseResult.standNumbers.size === 0) {
      return apiError(
        'No valid stand numbers found in range specification',
        400,
        ErrorCodes.VALIDATION_ERROR
      );
    }

    // Build status filter
    const statusFilter: string[] = ['AVAILABLE'];
    if (applyToReserved) {
      statusFilter.push('RESERVED');
    }
    if (applyToSold) {
      statusFilter.push('SOLD');
    }

    // Convert stand numbers set to array for SQL IN clause
    // We need to match stand numbers by their numeric value, not exact string match
    // So we'll use a more flexible query
    const standNumberArray = Array.from(parseResult.standNumbers);
    
    // Extract numeric values for matching
    const numericValues: number[] = [];
    for (const standNum of standNumberArray) {
      const num = parseInt(standNum.replace(/\D/g, ''), 10);
      if (!isNaN(num)) {
        numericValues.push(num);
      }
    }

    if (numericValues.length === 0) {
      return apiError(
        'No valid numeric stand numbers found in range specification',
        400,
        ErrorCodes.VALIDATION_ERROR
      );
    }

    // Update stands: Match by extracting numeric part of stand_number
    // This handles cases like "SL001" matching "1" or "001"
    const updateQuery = `
      UPDATE stands
      SET 
        discount_percent = $1,
        discount_active = $2,
        updated_at = NOW()
      WHERE development_id = $3
        AND status = ANY($4::text[])
        AND (
          -- Exact match
          stand_number = ANY($5::text[])
          OR
          -- Numeric match: extract numeric part and compare
          CAST(REGEXP_REPLACE(stand_number, '[^0-9]', '', 'g') AS INTEGER) = ANY($6::integer[])
        )
      RETURNING id, stand_number, price, discount_percent, status
    `;

    const updateResult = await pool.query(updateQuery, [
      discountPercent,
      active,
      developmentId,
      statusFilter,
      standNumberArray,
      numericValues
    ]);

    const updatedStands = updateResult.rows;
    const updatedCount = updatedStands.length;

    // Count skipped stands (non-existent or wrong status)
    const skippedCount = parseResult.standNumbers.size - updatedCount;

    logger.info('Discount applied successfully', {
      module: 'API',
      action: 'APPLY_DISCOUNT',
      developmentId,
      discountPercent,
      rangeSpec,
      updatedCount,
      skippedCount,
      ranges: parseResult.ranges
    });

    const duration = Date.now() - startTime;

    return apiSuccess({
      updatedCount,
      skippedCount,
      discountPercent,
      rangeSpec,
      ranges: parseResult.ranges,
      active,
      updatedStands: updatedStands.map((s: any) => ({
        id: s.id,
        standNumber: s.stand_number,
        basePrice: parseFloat(s.price),
        discountPercent: s.discount_percent ? parseFloat(s.discount_percent) : null,
        status: s.status
      })),
      duration
    });

  } catch (error: any) {
    logger.error('Error applying discount', error, {
      module: 'API',
      action: 'APPLY_DISCOUNT',
      stack: error?.stack
    });

    return apiError(
      error?.message || 'Failed to apply discount',
      500,
      ErrorCodes.INTERNAL_ERROR,
      process.env.NODE_ENV === 'development' ? { stack: error?.stack } : undefined
    );
  }
}
