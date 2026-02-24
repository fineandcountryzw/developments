import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { logger } from '@/lib/logger';
import { apiError, apiSuccess } from '@/lib/api-response';
import { ErrorCodes } from '@/lib/error-codes';
import { validateGeoJSON, createValidatedFeatureCollection } from '@/lib/geojson-validator';

/**
 * GET /api/stands/geojson?developmentId=<id>&source=database|file|hybrid
 * 
 * Forensic GeoJSON Enrichment with Multiple Source Support
 * 1. Hybrid Mode (default): Tries database geometry, falls back to file
 * 2. Database Mode: Uses geometry stored in Neon database
 * 3. File Mode: Uses static GeoJSON from public folder
 * 
 * All modes:
 * - Accept all geometry types as-is without conversion
 * - Preserve original coordinates exactly
 * - Use soft validation (warnings instead of blocking errors)
 * - Handle CRS metadata gracefully (read but don't reject)
 */

interface GeoJSONFeature {
  type: 'Feature';
  geometry: any;
  properties: Record<string, any>;
}

interface GeoJSONCollection {
  type: 'FeatureCollection';
  features: GeoJSONFeature[];
}

interface StandRecord {
  id: string;
  standNumber: string;
  status: string;
  price: number | null;
  sizeSqm: number | null;
  pricePerSqm: number | null;
  createdAt: Date;
}

type GeometrySource = 'database' | 'file' | 'hybrid';

async function loadGeometryFromFile(developmentId: string): Promise<GeoJSONCollection | null> {
  try {
    // Try multiple file locations
    const fileLocations = [
      path.join(process.cwd(), 'public', 'geojson', `${developmentId}.geojson`),
      path.join(process.cwd(), 'public', 'data', 'stands.geojson'),
      path.join(process.cwd(), 'data', `${developmentId}.geojson`),
    ];

    for (const filePath of fileLocations) {
      if (fs.existsSync(filePath)) {
        logger.info('Loading geometry from file', { module: 'API', action: 'GET_STANDS_GEOJSON', filePath });
        const fileContent = fs.readFileSync(filePath, 'utf-8');
        const geojson = JSON.parse(fileContent);

        // Validate GeoJSON structure (accepts all geometry types)
        // Coordinates and geometry types are preserved exactly as-is
        if (geojson.type === 'FeatureCollection' && Array.isArray(geojson.features)) {
          return geojson;
        }
      }
    }

    logger.warn('No geometry file found for development', { module: 'API', action: 'GET_STANDS_GEOJSON', developmentId });
    return null;
  } catch (error: any) {
    logger.error('Error loading geometry file', error, { module: 'API', action: 'GET_STANDS_GEOJSON', developmentId });
    return null;
  }
}

async function loadGeometryFromDatabase(
  prisma: any,
  developmentId: string
): Promise<GeoJSONCollection | null> {
  try {
    logger.info('Loading geometry from Neon database', { module: 'API', action: 'GET_STANDS_GEOJSON', developmentId });

    const development = await prisma.development.findUnique({
      where: { id: developmentId },
      select: {
        geoJsonUrl: true,
        geoJsonData: true,
        name: true,
        disableMapView: true,
      }
    });

    if (!development) {
      logger.warn('Development not found', { module: 'API', action: 'GET_STANDS_GEOJSON', developmentId });
      return null;
    }

    // CHECK: Table-only mode
    if (development.disableMapView) {
      logger.info('Map view disabled for development', { module: 'API', action: 'GET_STANDS_GEOJSON', developmentId });
      return { type: 'FeatureCollection', features: [] };
    }

    // First, check if geoJsonData is stored directly in the database
    if (development.geoJsonData) {
      logger.info('Found geoJsonData in database', { module: 'API', action: 'GET_STANDS_GEOJSON', developmentId });

      const geoData = typeof development.geoJsonData === 'string'
        ? JSON.parse(development.geoJsonData)
        : development.geoJsonData;

      // Validate it's a proper FeatureCollection with features
      // All geometry types accepted (Polygon, MultiPolygon, LineString, etc.)
      // Coordinates are preserved exactly as stored
      if (geoData?.type === 'FeatureCollection' && Array.isArray(geoData.features)) {
        // Only return if there are actual features to display
        if (geoData.features.length > 0) {
          logger.info('Returning features from geoJsonData', { module: 'API', action: 'GET_STANDS_GEOJSON', developmentId, featureCount: geoData.features.length });
          return geoData;
        } else {
          logger.warn('geoJsonData has empty features array', { module: 'API', action: 'GET_STANDS_GEOJSON', developmentId });
        }
      }
    }

    // If no direct geoJsonData, try fetching from geoJsonUrl
    if (development.geoJsonUrl) {
      logger.info('Attempting to fetch from geoJsonUrl', { module: 'API', action: 'GET_STANDS_GEOJSON', developmentId, url: development.geoJsonUrl?.substring(0, 50) + '***' });
      try {
        const response = await fetch(development.geoJsonUrl);
        if (response.ok) {
          const geoData = await response.json();
          if (geoData?.type === 'FeatureCollection' && Array.isArray(geoData.features)) {
            logger.info('Fetched features from URL', { module: 'API', action: 'GET_STANDS_GEOJSON', developmentId, featureCount: geoData.features.length });
            return geoData;
          }
        }
      } catch (fetchError: any) {
        logger.error('Failed to fetch from geoJsonUrl', fetchError, { module: 'API', action: 'GET_STANDS_GEOJSON', developmentId });
      }
    }

    logger.warn('No valid GeoJSON data found for development', { module: 'API', action: 'GET_STANDS_GEOJSON', developmentId });
    return null;
  } catch (error: any) {
    logger.error('Error loading geometry from database', error, { module: 'API', action: 'GET_STANDS_GEOJSON', developmentId });
    return null;
  }
}

async function enrichWithStandStatus(
  prisma: any,
  geometry: GeoJSONCollection,
  developmentId: string
): Promise<GeoJSONCollection> {
  try {
    // Fetch all stands with their current status
    const stands = await prisma.stand.findMany({
      where: { developmentId },
      select: {
        id: true,
        standNumber: true,
        status: true,
        price: true,
        sizeSqm: true,
        pricePerSqm: true,
        createdAt: true,
      }
    });

    logger.info('Enriching features with stand records', {
      module: 'API',
      action: 'GET_STANDS_GEOJSON',
      featureCount: geometry.features.length,
      standCount: stands.length
    });

    // Create lookup map for efficient matching
    const standById = new Map(stands.map((s: StandRecord) => [s.id, s]));
    const standByNumber = new Map(stands.map((s: StandRecord) => [s.standNumber, s]));

    // Enrich features with stand data
    const enrichedFeatures = geometry.features.map((feature: GeoJSONFeature) => {
      const props = feature.properties || {};

      // Try to match by ID first, then by stand number
      const stanId = (props.id || props.stand_id || props.standId) as string | undefined;
      const standNumber = (props.stand_number || props.standNumber || props.number) as string | undefined;

      let standData: StandRecord | null = null;
      if (stanId) {
        const found = standById.get(stanId);
        // Ensure we only assign valid StandRecord objects from the map
        if (found) {
          standData = found as StandRecord;
        }
      }
      if (!standData && standNumber) {
        const foundByNumber = standByNumber.get(standNumber);
        if (foundByNumber) {
          standData = foundByNumber as StandRecord;
        }
      }

      const dbStandId = standData?.id || null;
      const dbStandNumber = standData?.standNumber || null;

      return {
        ...feature,
        properties: {
          ...props,
          // Inject live data from Neon
          id: stanId || props.id || dbStandId,
          stand_db_id: dbStandId,
          stand_number: dbStandNumber || standNumber || props.stand_number,
          status: standData?.status || 'AVAILABLE',
          price: standData?.price?.toString() || props.price || '0',
          size_sqm: standData?.sizeSqm?.toString() || props.size_sqm || 'N/A',
          price_per_sqm: standData?.pricePerSqm?.toString() || props.price_per_sqm || 'N/A',
          // Metadata
          db_enriched: !!standData,
          enriched_at: new Date().toISOString(),
          enrichment_source: standData ? 'neon' : 'geojson',
        }
      };
    });

    return {
      type: 'FeatureCollection',
      features: enrichedFeatures
    };
  } catch (error: any) {
    logger.error('Error enriching features', error, { module: 'API', action: 'GET_STANDS_GEOJSON', developmentId });
    // Return original geometry if enrichment fails
    return geometry;
  }
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const developmentId = searchParams.get('developmentId');
  const source = (searchParams.get('source') || 'hybrid') as GeometrySource;

  if (!developmentId) {
    return apiError('developmentId query parameter is required', 400, ErrorCodes.VALIDATION_ERROR);
  }

  // Validate source parameter
  if (!['database', 'file', 'hybrid'].includes(source)) {
    return apiError('Invalid source parameter. Must be one of: database, file, hybrid', 400, ErrorCodes.VALIDATION_ERROR);
  }

  try {
    // Use global Prisma client
    const prismaCl = (await import('@/lib/prisma')).default;

    let geometry: GeoJSONCollection | null = null;
    let loadedFrom = '';

    // Load geometry based on source preference
    if (source === 'database' || source === 'hybrid') {
      geometry = await loadGeometryFromDatabase(prismaCl, developmentId);
      if (geometry) {
        loadedFrom = 'database';
      }
    }

    if (!geometry && (source === 'file' || source === 'hybrid')) {
      geometry = await loadGeometryFromFile(developmentId);
      if (geometry) {
        loadedFrom = 'file';
      }
    }

    // If no geometry found, return error
    if (!geometry) {
      logger.error('No geometry available for development', { module: 'API', action: 'GET_STANDS_GEOJSON', developmentId });
      return apiError('Development not found or has no geometry', 404, ErrorCodes.NOT_FOUND);
    }

    // Enrich with live stand status from Neon
    const enrichedGeometry = await enrichWithStandStatus(prismaCl, geometry, developmentId);

    // Validate geometry with soft validation (preserves all geometry types)
    const validationResult = validateGeoJSON(enrichedGeometry);

    // Build validation warnings for metadata
    const warningsByType: Record<string, string[]> = {};
    validationResult.warnings.forEach(w => {
      const key = w.type;
      if (!warningsByType[key]) warningsByType[key] = [];
      warningsByType[key].push(w.message);
    });

    // Add metadata with validation results
    const response = {
      ...enrichedGeometry,
      metadata: {
        developmentId,
        loadedFrom,
        enrichedAt: new Date().toISOString(),
        featureCount: validationResult.featureCount,
        enrichedFeatures: enrichedGeometry.features.filter(f => f.properties?.db_enriched).length,
        geometryTypes: validationResult.geometryTypes,
        hasCRS: validationResult.hasCRS,
        validation: {
          isValid: validationResult.isValid,
          warningCount: validationResult.warnings.filter(w => w.severity === 'warning').length,
          errorCount: validationResult.warnings.filter(w => w.severity === 'error').length,
          warnings: warningsByType
        }
      }
    };

    // Cache response for 5 minutes
    const cacheResponse = NextResponse.json(response);
    cacheResponse.headers.set('Cache-Control', 'public, max-age=300, stale-while-revalidate=600');
    cacheResponse.headers.set('X-Geometry-Source', loadedFrom);

    // Global Prisma client doesn't need disconnect in serverless

    return cacheResponse;
  } catch (error: any) {
    logger.error('GeoJSON API Error', error, { module: 'API', action: 'GET_STANDS_GEOJSON', developmentId });
    return apiError('Failed to generate enriched GeoJSON', 500, ErrorCodes.FETCH_ERROR, {
      details: process.env.NODE_ENV === 'development' ? (error instanceof Error ? error.message : 'Unknown error') : undefined
    });
  }
}
