import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/access-control';
import { logger } from '@/lib/logger';
import { apiError, apiSuccess } from '@/lib/api-response';
import { ErrorCodes } from '@/lib/error-codes';
import { validateGeoJSON } from '@/lib/geojson-validator';
import { isDXFFile, convertDXFToGeoJSON, parseDXF } from '@/lib/dxf-converter';
import { getDbPool } from '@/lib/db-pool';

/**
 * Parse DXF content and extract entity statistics
 */
function analyzeDXFEntities(dxfContent: string): {
  layers: string[];
  stats: {
    totalEntities: number;
    polygonEntities: number;
    circleEntities: number;
    polylineEntities: number;
    ellipseEntities: number;
    lineEntities: number;
    arcEntities: number;
  };
} {
  const { entities } = parseDXF(dxfContent);
  const layers = new Set<string>();
  const stats = {
    totalEntities: entities.length,
    polygonEntities: 0,
    circleEntities: 0,
    polylineEntities: 0,
    ellipseEntities: 0,
    lineEntities: 0,
    arcEntities: 0,
  };

  entities.forEach(entity => {
    if (entity.layer) {
      layers.add(entity.layer);
    }
    
    switch (entity.type) {
      case 'LWPOLYLINE':
      case 'POLYLINE':
        stats.polylineEntities++;
        stats.polygonEntities++;
        break;
      case 'CIRCLE':
        stats.circleEntities++;
        stats.polygonEntities++;
        break;
      case 'ELLIPSE':
        stats.ellipseEntities++;
        stats.polygonEntities++;
        break;
      case 'LINE':
        stats.lineEntities++;
        break;
      case 'ARC':
        stats.arcEntities++;
        break;
    }
  });

  return {
    layers: Array.from(layers),
    stats
  };
}

/**
 * POST /api/developments/:id/geojson/preview
 * 
 * Preview endpoint for GeoJSON and DXF import validation.
 * Parses and validates files without persisting to DB.
 * 
 * Request Body:
 * - geoJsonData: The file content (GeoJSON string, object, or DXF string)
 * - source: 'file' | 'paste' (optional, defaults to 'paste')
 * - fileName: Original filename (optional, helps detect file type)
 * - isDxf: Boolean flag indicating DXF content (optional, auto-detected if not provided)
 * 
 * Returns PreviewReport with importSource field indicating 'geojson' or 'dxf'
 */
export async function POST(request: NextRequest) {
  const requestId = `preview-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  const startTime = Date.now();
  
  try {
    // Admin authorization
    const authResult = await requireAdmin(request, { limit: 20, windowMs: 60000 });
    if (authResult.error) {
      return authResult.error;
    }

    // Extract developmentId from URL
    const url = new URL(request.url);
    const developmentId = url.pathname.split('/')[3]; // /api/developments/:id/geojson/preview
    
    if (!developmentId) {
      return apiError('Development ID is required', 400, ErrorCodes.VALIDATION_ERROR);
    }

    // Parse request body
    let body: any;
    let rawText: string = '';
    try {
      body = await request.json();
    } catch (parseError: any) {
      logger.error('[PREVIEW] JSON parse failed, trying as raw text', { module: 'API', action: 'PREVIEW', error: parseError.message });
      
      // Try to read as text to check if it's a DXF file
      rawText = await request.text();
      
      // Check if it's DXF content - detect from raw text using filename
      const url = new URL(request.url);
      const pathParts = url.pathname.split('/');
      const detectedFileName = pathParts[pathParts.length - 1] || undefined;
      
      if (rawText.includes('SECTION') && (rawText.includes('ENTITIES') || rawText.includes('HEADER'))) {
        // Handle DXF file directly
        const dxfResult = await handleDXFContent(rawText, detectedFileName, requestId, startTime);
        if (dxfResult) {
          return NextResponse.json(dxfResult);
        }
      }
      
      return apiError('Invalid JSON format', 400, ErrorCodes.VALIDATION_ERROR, {
        field: 'body',
        message: parseError.message,
        hint: 'If uploading a DXF file, ensure it has .dxf extension'
      });
    }
    
    const { geoJsonData, source = 'paste', fileName, isDxf: explicitIsDxf } = body;

    if (!geoJsonData) {
      return apiError('Data is required', 400, ErrorCodes.VALIDATION_ERROR, {
        field: 'geoJsonData',
        message: 'Provide GeoJSON or DXF content'
      });
    }

    logger.info('[PREVIEW] Starting preview', {
      module: 'API',
      action: 'PREVIEW',
      requestId,
      developmentId,
      source,
      fileName
    });

    // Determine if content is DXF
    const contentString = typeof geoJsonData === 'string' ? geoJsonData : JSON.stringify(geoJsonData);
    const isDxf = explicitIsDxf !== undefined 
      ? explicitIsDxf 
      : (fileName?.toLowerCase().endsWith('.dxf') || isDXFFile(contentString));
    
    let parsedGeoJson: any;
    let importSource: 'geojson' | 'dxf' = 'geojson';
    let dxfLayers: string[] = [];
    let dxfStats: any = null;

    if (isDxf) {
      // DXF Conversion
      logger.info('[PREVIEW] Converting DXF to GeoJSON', {
        module: 'API',
        action: 'DXF_CONVERT',
        requestId
      });

      importSource = 'dxf';
      
      // Analyze DXF entities before conversion
      const dxfAnalysis = analyzeDXFEntities(contentString);
      dxfLayers = dxfAnalysis.layers;
      dxfStats = dxfAnalysis.stats;
      
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

      logger.info('[PREVIEW] DXF conversion complete', {
        module: 'API',
        action: 'DXF_CONVERT',
        requestId,
        entityCount: dxfResult.entityCount,
        polygonCount: dxfResult.polygonCount
      });
    } else {
      // GeoJSON Parsing
      importSource = 'geojson';
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

    // Run validation (soft validation)
    const validation = validateGeoJSON(parsedGeoJson);

    // Calculate computed bounds
    const bounds = calculateBounds(parsedGeoJson);

    // Count missing properties
    const missingPropertiesCounts = {
      stand_number: 0,
      size_sqm: 0,
      price: 0
    };

    validation.processedFeatures.forEach((feature: any) => {
      const props = feature.properties || {};
      if (!props.stand_number && !props.standNumber && !props.number) {
        missingPropertiesCounts.stand_number++;
      }
      if (!props.size_sqm && !props.sizeSqm) {
        missingPropertiesCounts.size_sqm++;
      }
      if (!props.price) {
        missingPropertiesCounts.price++;
      }
    });

    // Collect sample errors
    const sampleErrors = validation.warnings
      .filter(w => w.severity === 'error' || w.severity === 'warning')
      .slice(0, 20)
      .map(w => w.message);

    // Get sample feature (first valid, redacted)
    const sampleFeature = validation.processedFeatures.length > 0
      ? {
          type: 'Feature',
          geometry: validation.processedFeatures[0].geometry,
          properties: {
            stand_number: validation.processedFeatures[0].properties?.stand_number || 'N/A',
            _redacted: true
          }
        }
      : null;

    const durationMs = Date.now() - startTime;

    // Build preview report
    const previewReport = {
      requestId,
      totalFeatures: validation.featureCount,
      validFeatures: validation.processedFeatures.length,
      invalidFeatures: validation.featureCount - validation.processedFeatures.length,
      geometryTypeCounts: validation.geometryTypes,
      sampleErrors,
      sampleFeature,
      computedBounds: bounds,
      missingPropertiesCounts,
      hasCRS: validation.hasCRS,
      warnings: validation.warnings.filter(w => w.severity === 'info').map(w => ({
        type: w.type,
        message: w.message
      })),
      durationMs,
      importSource,
      dxfLayers,
      dxfStats
    };

    logger.info('[PREVIEW] Preview complete', {
      module: 'API',
      action: 'PREVIEW',
      ...previewReport
    });

    return NextResponse.json(previewReport);

  } catch (error: any) {
    logger.error('[PREVIEW] Preview failed', error, {
      module: 'API',
      action: 'PREVIEW',
      requestId
    });

    return apiError(
      'Preview failed',
      500,
      ErrorCodes.FETCH_ERROR,
      {
        requestId,
        message: error.message
      }
    );
  }
}

/**
 * Handle DXF content directly (for raw DXF file uploads)
 */
async function handleDXFContent(
  dxfContent: string,
  fileName: string | undefined,
  requestId: string,
  startTime: number
): Promise<any> {
  try {
    logger.info('[PREVIEW] Processing raw DXF content', {
      module: 'API',
      action: 'DXF_RAW',
      requestId,
      fileName
    });

    // Analyze DXF entities
    const dxfAnalysis = analyzeDXFEntities(dxfContent);
    
    // Convert to GeoJSON
    const dxfResult = convertDXFToGeoJSON(dxfContent);

    if (!dxfResult.success || !dxfResult.featureCollection) {
      return apiError('DXF conversion failed', 400, ErrorCodes.VALIDATION_ERROR, {
        field: 'dxfContent',
        message: dxfResult.errors.join('; ') || 'Failed to convert DXF to GeoJSON',
        entityCount: dxfResult.entityCount,
        polygonCount: dxfResult.polygonCount,
        errorCount: dxfResult.errorCount
      });
    }

    const parsedGeoJson = dxfResult.featureCollection;
    
    // Run validation
    const validation = validateGeoJSON(parsedGeoJson);
    
    // Calculate bounds
    const bounds = calculateBounds(parsedGeoJson);
    
    // Count missing properties
    const missingPropertiesCounts = {
      stand_number: 0,
      size_sqm: 0,
      price: 0
    };

    validation.processedFeatures.forEach((feature: any) => {
      const props = feature.properties || {};
      if (!props.stand_number && !props.standNumber && !props.number) {
        missingPropertiesCounts.stand_number++;
      }
      if (!props.size_sqm && !props.sizeSqm) {
        missingPropertiesCounts.size_sqm++;
      }
      if (!props.price) {
        missingPropertiesCounts.price++;
      }
    });

    const durationMs = Date.now() - startTime;

    return {
      requestId,
      totalFeatures: validation.featureCount,
      validFeatures: validation.processedFeatures.length,
      invalidFeatures: validation.featureCount - validation.processedFeatures.length,
      geometryTypeCounts: validation.geometryTypes,
      sampleErrors: [],
      sampleFeature: validation.processedFeatures.length > 0
        ? {
            type: 'Feature',
            geometry: validation.processedFeatures[0].geometry,
            properties: {
              stand_number: validation.processedFeatures[0].properties?.stand_number || 'N/A',
              _redacted: true
            }
          }
        : null,
      computedBounds: bounds,
      missingPropertiesCounts,
      hasCRS: validation.hasCRS,
      warnings: validation.warnings.filter(w => w.severity === 'info').map(w => ({
        type: w.type,
        message: w.message
      })),
      durationMs,
      importSource: 'dxf' as const,
      dxfLayers: dxfAnalysis.layers,
      dxfStats: dxfAnalysis.stats
    };
  } catch (error: any) {
    logger.error('[PREVIEW] DXF raw processing failed', error, {
      module: 'API',
      action: 'DXF_RAW',
      requestId
    });
    return null;
  }
}

/**
 * Calculate bounding box from GeoJSON
 */
function calculateBounds(geoJson: any): { minLng: number; minLat: number; maxLng: number; maxLat: number } | null {
  let minLng = Infinity;
  let minLat = Infinity;
  let maxLng = -Infinity;
  let maxLat = -Infinity;

  function processCoordinates(coords: any) {
    if (!Array.isArray(coords)) return;

    coords.forEach((c: any) => {
      if (Array.isArray(c[0])) {
        // Recurse into nested arrays
        c.forEach((inner: any) => processCoordinates(inner));
      } else if (c.length >= 2 && typeof c[0] === 'number') {
        // Actual coordinate [lng, lat]
        minLng = Math.min(minLng, c[0]);
        maxLng = Math.max(maxLng, c[0]);
        minLat = Math.min(minLat, c[1]);
        maxLat = Math.max(maxLat, c[1]);
      }
    });
  }

  if (geoJson.type === 'FeatureCollection' && Array.isArray(geoJson.features)) {
    geoJson.features.forEach((feature: any) => {
      if (feature.geometry && feature.geometry.coordinates) {
        processCoordinates(feature.geometry.coordinates);
      }
    });
  } else if (geoJson.type === 'Feature' && geoJson.geometry?.coordinates) {
    processCoordinates(geoJson.geometry.coordinates);
  } else if (geoJson.coordinates) {
    processCoordinates(geoJson.coordinates);
  }

  if (minLng === Infinity) {
    return null;
  }

  return { minLng, minLat, maxLng, maxLat };
}
