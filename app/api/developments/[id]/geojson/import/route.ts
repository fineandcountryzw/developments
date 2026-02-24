import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/access-control';
import { logger } from '@/lib/logger';
import { apiError, apiSuccess } from '@/lib/api-response';
import { ErrorCodes } from '@/lib/error-codes';
import { validateGeoJSON } from '@/lib/geojson-validator';
import { isDXFFile, convertDXFToGeoJSON } from '@/lib/dxf-converter';
import { getDbPool } from '@/lib/db-pool';
import { randomBytes } from 'crypto';

/**
 * POST /api/developments/:id/geojson/import
 * 
 * Import endpoint that persists GeoJSON or DXF features to the database.
 * Upserts by stable key (stand_number + developmentId).
 */
export async function POST(request: NextRequest) {
  const requestId = `import-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  const startTime = Date.now();

  try {
    // Admin authorization
    const authResult = await requireAdmin(request, { limit: 10, windowMs: 60000 });
    if (authResult.error) {
      return authResult.error;
    }

    // Extract developmentId from URL
    const url = new URL(request.url);
    const developmentId = url.pathname.split('/')[3];
    
    if (!developmentId) {
      return apiError('Development ID is required', 400, ErrorCodes.VALIDATION_ERROR);
    }

    // Variables for import processing
    let parsedGeoJson: any;
    let isDxf = false;
    let branchValue: any = 'Harare';
    let basePriceValue: any = 0;
    let contentString = '';

    // Try to read as JSON first
    const contentType = request.headers.get('content-type') || '';
    
    if (contentType.includes('application/json')) {
      try {
        const body = await request.json();
        const { geoJsonData, branch = 'Harare', basePrice = 0, source = 'paste', fileName, isDxf: explicitIsDxf } = body;

        if (!geoJsonData) {
          return apiError('Data is required', 400, ErrorCodes.VALIDATION_ERROR, {
            field: 'geoJsonData',
            message: 'Provide GeoJSON or DXF content'
          });
        }

        logger.info('[IMPORT] Starting import', {
          module: 'API',
          action: 'IMPORT',
          requestId,
          developmentId,
          source,
          fileName
        });

        branchValue = branch;
        basePriceValue = basePrice;
        contentString = typeof geoJsonData === 'string' ? geoJsonData : JSON.stringify(geoJsonData);
        isDxf = explicitIsDxf !== undefined 
          ? explicitIsDxf 
          : (fileName?.toLowerCase().endsWith('.dxf') || isDXFFile(contentString));

        if (isDxf) {
          // DXF Conversion from JSON body
          logger.info('[IMPORT] Converting DXF to GeoJSON', {
            module: 'API',
            action: 'DXF_CONVERT',
            requestId
          });

          const dxfResult = convertDXFToGeoJSON(contentString);

          if (!dxfResult.success || !dxfResult.featureCollection) {
            return apiError('DXF conversion failed', 400, ErrorCodes.VALIDATION_ERROR, {
              field: 'dxfContent',
              message: dxfResult.errors.join('; ') || 'Failed to convert DXF to GeoJSON',
              entityCount: dxfResult.entityCount,
              polygonCount: dxfResult.polygonCount,
              errorCount: dxfResult.errorCount
            });
          }

          parsedGeoJson = dxfResult.featureCollection;

          logger.info('[IMPORT] DXF conversion complete', {
            module: 'API',
            action: 'DXF_CONVERT',
            requestId,
            entityCount: dxfResult.entityCount,
            polygonCount: dxfResult.polygonCount
          });
        } else {
          // GeoJSON Parsing
          try {
            parsedGeoJson = typeof geoJsonData === 'string' 
              ? JSON.parse(geoJsonData) 
              : geoJsonData;
          } catch (parseError: any) {
            return apiError('Invalid JSON format', 400, ErrorCodes.VALIDATION_ERROR, {
              field: 'geoJsonData',
              message: parseError.message
            });
          }
        }

      } catch (jsonError: any) {
        // JSON parsing failed, try as raw DXF
        const rawText = await request.text();
        
        if (rawText.includes('SECTION') && (rawText.includes('ENTITIES') || rawText.includes('HEADER'))) {
          // Handle raw DXF content
          logger.info('[IMPORT] Processing raw DXF content', {
            module: 'API',
            action: 'IMPORT',
            requestId,
            developmentId
          });

          const dxfResult = convertDXFToGeoJSON(rawText);

           if (!dxfResult.success || !dxfResult.featureCollection) {
             return NextResponse.json({
               success: false,
               insertedCount: 0,
               updatedCount: 0,
               skippedCount: 0,
               rejectedCount: dxfResult.entityCount || 0,
               rejectedReasons: dxfResult.errors.slice(0, 50),
               featureIds: [],
               totalProcessed: 0,
               durationMs: Date.now() - startTime,
               developmentId,
               developmentName: '',
               importSource: 'dxf',
               message: 'DXF conversion failed: ' + (dxfResult.errors.join('; ') || 'Unknown error')
             }, { status: 400 });
           }

          parsedGeoJson = dxfResult.featureCollection;
          isDxf = true;

          logger.info('[IMPORT] Raw DXF conversion complete', {
            module: 'API',
            action: 'IMPORT',
            requestId,
            entityCount: dxfResult.entityCount,
            polygonCount: dxfResult.polygonCount
          });
        } else {
          return apiError('Invalid JSON format', 400, ErrorCodes.VALIDATION_ERROR, {
            field: 'body',
            message: jsonError.message || 'Request body is not valid JSON',
            hint: 'If uploading a DXF file, ensure it has .dxf extension'
          });
        }
      }
    } else {
      // Non-JSON content type, try as raw DXF
      const rawText = await request.text();
      
      if (rawText.includes('SECTION') && (rawText.includes('ENTITIES') || rawText.includes('HEADER'))) {
        logger.info('[IMPORT] Processing raw DXF content (non-JSON content-type)', {
          module: 'API',
          action: 'IMPORT',
          requestId,
          developmentId,
          contentType
        });

        const dxfResult = convertDXFToGeoJSON(rawText);

           if (!dxfResult.success || !dxfResult.featureCollection) {
             return NextResponse.json({
               success: false,
               insertedCount: 0,
               updatedCount: 0,
               skippedCount: 0,
               rejectedCount: dxfResult.entityCount || 0,
               rejectedReasons: dxfResult.errors.slice(0, 50),
               featureIds: [],
               totalProcessed: 0,
               durationMs: Date.now() - startTime,
               developmentId,
               developmentName: '',
               importSource: 'dxf',
               message: 'DXF conversion failed: ' + (dxfResult.errors.join('; ') || 'Unknown error')
             }, { status: 400 });
           }

        parsedGeoJson = dxfResult.featureCollection;
        isDxf = true;
      } else {
        return apiError('Invalid content format', 400, ErrorCodes.VALIDATION_ERROR, {
          field: 'body',
          message: 'Content does not appear to be valid JSON or DXF',
          hint: 'Use Content-Type: application/json for GeoJSON/DXF data'
        });
      }
    }

    // Run validation
    const validation = validateGeoJSON(parsedGeoJson);

    if (validation.processedFeatures.length === 0) {
      return apiError(
        'No valid features to import',
        400,
        ErrorCodes.VALIDATION_ERROR,
        {
          validationErrors: validation.warnings.map(w => w.message)
        }
      );
    }

    // Get database pool
    const pool = await getDbPool();

    // Verify development exists
    const devResult = await pool.query(
      `SELECT id, name FROM developments WHERE id = $1`,
      [developmentId]
    );

    if (devResult.rows.length === 0) {
      return apiError('Development not found', 404, ErrorCodes.NOT_FOUND);
    }

    const developmentName = devResult.rows[0].name;

    // Save geometry to development if provided
    if (parsedGeoJson && typeof parsedGeoJson === 'object') {
      try {
        const geometryJson = JSON.stringify(parsedGeoJson);
        await pool.query(
          `UPDATE developments SET geojson_data = $1, updated_at = NOW() WHERE id = $2`,
          [geometryJson, developmentId]
        );
        logger.info('[IMPORT] Saved geometry to development', {
          module: 'API',
          action: 'IMPORT',
          requestId,
          developmentId,
          featureCount: validation.processedFeatures.length,
          importSource: isDxf ? 'dxf' : 'geojson'
        });
      } catch (geoError: any) {
        logger.warn('[IMPORT] Failed to save geometry to development', {
          module: 'API',
          action: 'IMPORT',
          requestId,
          error: geoError.message
        });
      }
    }

    // Prepare counters
    let insertedCount = 0;
    let updatedCount = 0;
    let skippedCount = 0;
    const rejectedReasons: string[] = [];
    const featureIds: string[] = [];
    let rejectCount = 0;

    // Process each feature
    for (let i = 0; i < validation.processedFeatures.length; i++) {
      const feature = validation.processedFeatures[i];
      const props = feature.properties || {};

      // Determine stand number
      const standNumber = props.stand_number || props.standNumber || props.number || props.Name || props.name;
      
      if (!standNumber) {
        skippedCount++;
        rejectedReasons.push(`Feature ${i + 1}: Missing stand_number property`);
        continue;
      }

      // Generate stand ID
      const timestamp = Date.now().toString(36);
      const randomPart = randomBytes(8).toString('hex').substring(0, 12);
      const standId = `std_${timestamp}${randomPart}`;

      // Parse numeric values
      const sizeSqm = parseFloat(props.size_sqm || props.sizeSqm || props.area) || 0;
      const pricePerSqm = parseFloat(props.price_per_sqm || props.pricePerSqm) || 0;
      const price = parseFloat(props.price) || basePriceValue;

      try {
        const result = await pool.query(`
          INSERT INTO stands (
            id, stand_number, development_id, branch, price, price_per_sqm, 
            size_sqm, status, created_at, updated_at
          ) VALUES (
            $1, $2, $3, $4, $5, $6, $7, 'AVAILABLE', NOW(), NOW()
          )
          ON CONFLICT (development_id, stand_number) 
          DO UPDATE SET 
            price = EXCLUDED.price,
            price_per_sqm = EXCLUDED.price_per_sqm,
            size_sqm = EXCLUDED.size_sqm,
            updated_at = NOW()
          WHERE stands.status = 'AVAILABLE'
          RETURNING id, (xmax = 0) as inserted
        `, [standId, standNumber, developmentId, branchValue, price, pricePerSqm || null, sizeSqm || null]);

        if (result.rows[0]?.inserted) {
          featureIds.push(standId);
        }

      } catch (dbError: any) {
        rejectCount++;
        rejectedReasons.push(`Feature ${i + 1} (${standNumber}): ${dbError.message}`);
        
        if (rejectedReasons.length >= 50) {
          break;
        }
      }
    }

    const durationMs = Date.now() - startTime;

    const importResult = {
      insertedCount: featureIds.length,
      updatedCount: validation.processedFeatures.length - featureIds.length - skippedCount - rejectCount,
      skippedCount,
      rejectedCount: rejectCount,
      rejectedReasons: rejectedReasons.slice(0, 50),
      featureIds,
      totalProcessed: validation.processedFeatures.length,
      durationMs,
      developmentId,
      developmentName,
      importSource: isDxf ? 'dxf' : 'geojson'
    };

    logger.info('[IMPORT] Import complete', {
      module: 'API',
      action: 'IMPORT',
      requestId,
      ...importResult
    });

    if (featureIds.length === 0 && importResult.updatedCount === 0) {
      return NextResponse.json({
        success: false,
        ...importResult,
        message: 'Import failed: No stands could be created or updated'
      }, { status: 400 });
    }

    return NextResponse.json({
      success: true,
      ...importResult
    });

  } catch (error: any) {
    logger.error('[IMPORT] Import failed', error, {
      module: 'API',
      action: 'IMPORT',
      requestId
    });

    return apiError(
      'Import failed',
      500,
      ErrorCodes.FETCH_ERROR,
      {
        requestId,
        message: error.message
      }
    );
  }
}
