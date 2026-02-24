import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin, isAdmin } from '@/lib/access-control';
import { getAuthenticatedUser } from '@/lib/adminAuth';
import { Pool } from 'pg';
import { randomBytes } from 'crypto';
import { z } from 'zod';
import { logger, createModuleLogger } from '@/lib/logger';
import { apiSuccess, apiError } from '@/lib/api-response';
import { ErrorCodes } from '@/lib/error-codes';
import { developmentSchema } from '@/lib/validation/schemas';
import { validateRequest } from '@/lib/validation/validator';
import { getDbPool, query as poolQuery } from '@/lib/db-pool';
import { validateGeoJSON, formatWarningsForUI } from '@/lib/geojson-validator';
import { normalizeGeoJSON, extractStandNumbers } from '@/lib/geojson-normalizer';

// Infer type from schema
type DevelopmentInput = z.infer<typeof developmentSchema>;

// Create module-specific logger
const apiLogger = createModuleLogger('API');

// Route segment configuration for API route
export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const maxDuration = 30;

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

/**
 * Generate a CUID-like ID for database records
 */
function generateId(prefix: string = ''): string {
  const timestamp = Date.now().toString(36);
  const randomPart = randomBytes(8).toString('hex').substring(0, 12);
  return prefix ? `${prefix}_${timestamp}${randomPart}` : `${timestamp}${randomPart}`;
}

/**
 * Safe number parsing with defensive checks for toFixed errors
 */
function safeParseNumber(value: unknown, defaultValue: number = 0): number {
  if (value === null || value === undefined || value === '') {
    return defaultValue;
  }
  const num = typeof value === 'number' ? value : parseFloat(String(value));
  return isNaN(num) ? defaultValue : num;
}

/**
 * Clamp a number to a maximum value to prevent database overflow
 */
function clampMax(value: number, max: number): number {
  if (value > max) return max;
  if (value < 0) return 0;
  return value;
}

// Database precision limits for Decimal fields
const DB_LIMITS = {
  price: 999999999999.99,      // Decimal(12, 2)
  pricePerSqm: 99999999.99,    // Decimal(10, 2)
  percentage: 999.99,            // Decimal(5, 2)
  area: 99999999.99,            // Decimal(10, 2)
  fee: 999999999999.99          // Decimal(12, 2)
};

/**
 * Safe integer parsing
 */
function safeParseInt(value: any, defaultValue: number = 0): number {
  if (value === null || value === undefined || value === '') {
    return defaultValue;
  }
  const num = typeof value === 'number' ? Math.floor(value) : parseInt(String(value), 10);
  return isNaN(num) ? defaultValue : num;
}

/**
 * Safe featured tag parsing with validation
 * Ensures only valid values: 'none', 'promo', 'hot'
 */
function safeFeaturedTag(value: unknown, defaultValue: string = 'none'): string {
  const validTags = ['none', 'promo', 'hot'];
  if (value === null || value === undefined || value === '') {
    return defaultValue;
  }
  const tag = String(value).toLowerCase();
  return validTags.includes(tag) ? tag : defaultValue;
}

/**
 * Safe JSON parsing for preventing double-encoding
 * Returns parsed object if string is valid JSON, otherwise returns the original value
 */
function safeParseJSON(value: any): any {
  if (typeof value !== 'string') {
    return value;
  }

  try {
    const parsed = JSON.parse(value);
    // Check if it's still a string (double-encoded)
    if (typeof parsed === 'string') {
      return JSON.parse(parsed);
    }
    return parsed;
  } catch {
    // Not valid JSON, return as-is
    return value;
  }
}

/**
 * Safe stringification for JSONB columns
 * Handles objects, arrays, and already-stringified values
 */
function safeStringifyForDB(value: any): string | null {
  if (value === null || value === undefined) {
    return null;
  }

  const parsed = safeParseJSON(value);

  if (typeof parsed === 'object') {
    return JSON.stringify(parsed);
  }

  return String(parsed);
}

/**
 * Redact SQL parameter values before logging.
 * Keeps logs useful while avoiding sensitive payload leakage.
 */
function redactSqlParam(column: string, value: unknown): unknown {
  if (value === null || value === undefined) return value;

  const key = column.toLowerCase();
  if (key.includes('email')) return '[REDACTED_EMAIL]';
  if (key.includes('phone')) return '[REDACTED_PHONE]';

  if (Array.isArray(value)) {
    return `[array:${value.length}]`;
  }

  if (typeof value === 'object') {
    return '[object]';
  }

  if (typeof value === 'string') {
    return value.length > 120 ? `${value.slice(0, 120)}...` : value;
  }

  return value;
}

/**
 * Calculate map center coordinates from GeoJSON data
 * Handles Polygon, MultiPolygon, LineString, MultiLineString, Point, and MultiPoint
 * Returns { latitude, longitude } or null if calculation fails
 */
function calculateGeoJSONCenter(geoJsonData: any): { latitude: number | null; longitude: number | null } {
  if (!geoJsonData) {
    return { latitude: null, longitude: null };
  }

  try {
    const parsed = typeof geoJsonData === 'string' ? JSON.parse(geoJsonData) : geoJsonData;

    // Handle FeatureCollection
    if (parsed.type === 'FeatureCollection' && Array.isArray(parsed.features)) {
      const centers: { lat: number; lng: number }[] = [];

      for (const feature of parsed.features) {
        const center = calculateGeometryCenter(feature.geometry);
        if (center) {
          centers.push(center);
        }
      }

      if (centers.length > 0) {
        const avgLat = centers.reduce((sum, c) => sum + c.lat, 0) / centers.length;
        const avgLng = centers.reduce((sum, c) => sum + c.lng, 0) / centers.length;
        return { latitude: avgLat, longitude: avgLng };
      }
    }

    // Handle single Feature
    if (parsed.type === 'Feature') {
      const center = calculateGeometryCenter(parsed.geometry);
      if (center) {
        return { latitude: center.lat, longitude: center.lng };
      }
    }

    // Handle geometry directly
    if (parsed.type && parsed.coordinates) {
      const center = calculateGeometryCenter(parsed);
      if (center) {
        return { latitude: center.lat, longitude: center.lng };
      }
    }

    return { latitude: null, longitude: null };
  } catch (e) {
    logger.warn('Failed to calculate GeoJSON center', { module: 'API', action: 'calculateGeoJSONCenter', error: e });
    return { latitude: null, longitude: null };
  }
}

/**
 * Calculate center for a single geometry
 * Handles all GeoJSON geometry types
 */
function calculateGeometryCenter(geometry: any): { lat: number; lng: number } | null {
  if (!geometry || !geometry.type || !geometry.coordinates) {
    return null;
  }

  const coords = geometry.coordinates;

  switch (geometry.type) {
    case 'Point':
      // Point: [longitude, latitude]
      return { lat: coords[1], lng: coords[0] };

    case 'MultiPoint':
      // MultiPoint: [[lng, lat], ...]
      if (coords.length === 0) return null;
      const pointSum = coords.reduce((acc: number[], c: number[]) => [acc[0] + c[1], acc[1] + c[0]], [0, 0]);
      return { lat: pointSum[0] / coords.length, lng: pointSum[1] / coords.length };

    case 'LineString':
      // LineString: [[lng, lat], ...]
      if (coords.length === 0) return null;
      const lineSum = coords.reduce((acc: number[], c: number[]) => [acc[0] + c[1], acc[1] + c[0]], [0, 0]);
      return { lat: lineSum[0] / coords.length, lng: lineSum[1] / coords.length };

    case 'MultiLineString':
      // MultiLineString: [[[lng, lat], ...], ...]
      const linePoints: number[] = [];
      for (const line of coords) {
        for (const point of line) {
          linePoints.push(point[1], point[0]);
        }
      }
      if (linePoints.length === 0) return null;
      return { lat: linePoints[0] / (linePoints.length / 2), lng: linePoints[1] / (linePoints.length / 2) };

    case 'Polygon':
      // Polygon: [[[lng, lat], ...]] - use first ring (outer ring)
      if (!coords[0] || coords[0].length === 0) return null;
      const polyCoords = coords[0];
      const polySum = polyCoords.reduce((acc: number[], c: number[]) => [acc[0] + c[1], acc[1] + c[0]], [0, 0]);
      return { lat: polySum[0] / polyCoords.length, lng: polySum[1] / polyCoords.length };

    case 'MultiPolygon':
      // MultiPolygon: [[[[lng, lat], ...]], ...] - calculate centroid from all polygons
      const allPolyCoords: number[] = [];
      for (const polygon of coords) {
        const ring = polygon[0]; // outer ring
        for (const point of ring) {
          allPolyCoords.push(point[1], point[0]);
        }
      }
      if (allPolyCoords.length === 0) return null;
      return {
        lat: allPolyCoords[0] / (allPolyCoords.length / 2),
        lng: allPolyCoords[1] / (allPolyCoords.length / 2)
      };

    default:
      return null;
  }
}

/**
 * Parse GeoJSON and extract stand features
 * Uses robust normalization - handles stringified JSON, prevents double-encoding
 * Returns parsed features along with validation warnings
 */
function parseGeoJSONFeatures(geoJsonData: any): { features: any[]; warnings: any[] } {
  if (!geoJsonData) {
    logger.warn('[FORENSIC] parseGeoJSONFeatures received null/undefined geoJsonData');
    return { features: [], warnings: [] };
  }

  // FORENSIC: Log input type and structure
  logger.info('[FORENSIC] parseGeoJSONFeatures input analysis', {
    inputType: typeof geoJsonData,
    isString: typeof geoJsonData === 'string',
    isObject: typeof geoJsonData === 'object',
    hasType: geoJsonData?.type,
    hasFeatures: Array.isArray(geoJsonData?.features)
  });

  // Use robust normalization - handles string parsing and double-encoding
  const normalized = normalizeGeoJSON(geoJsonData, {
    strictGeometry: true,  // Only accept Polygon geometries
    closeRings: true,       // Auto-close polygon rings
    normalizeProperties: true,  // Normalize property names
    maxFeatures: 5000,      // Reasonable limit
  });

  // FORENSIC: Log normalization result
  logger.info('[FORENSIC] GeoJSON normalization result', {
    isValid: normalized.isValid,
    featureCount: normalized.featureCount,
    errorCount: normalized.errors.length,
    warningCount: normalized.warnings.length,
    geometryTypes: normalized.geometryTypes,
    multipolygonConverted: normalized.multipolygonConverted
  });

  // Convert normalization errors/warnings to the expected format
  const warnings = [
    ...normalized.errors.map((msg: string) => ({
      featureIndex: -1,
      type: 'invalid_coordinates' as const,
      message: msg,
      severity: 'error' as const
    })),
    ...normalized.warnings.map((msg: string) => ({
      featureIndex: -1,
      type: 'missing_properties' as const,
      message: msg,
      severity: 'warning' as const
    }))
  ];

  if (!normalized.isValid || !normalized.parsed) {
    return { features: [], warnings };
  }

  // Extract features from normalized GeoJSON
  let features: any[] = [];
  if (normalized.parsed.type === 'FeatureCollection' && Array.isArray(normalized.parsed.features)) {
    features = normalized.parsed.features;
  } else if (normalized.parsed.type === 'Feature') {
    features = [normalized.parsed];
  }

  // FORENSIC: Log extracted features
  logger.info('[FORENSIC] Extracted features from normalized GeoJSON', {
    featureCount: features.length,
    hasStandNumbers: features.filter((f: any) => f.properties?.standNumber).length
  });

  return { features, warnings };
}

/**
 * Create Stand records from GeoJSON features
 * - Handles missing stand_number gracefully (auto-generates)
 * - Continues processing even if individual features fail
 * - Returns detailed success/error summary
 */
async function createStandsFromGeoJSON(
  pool: Pool,
  developmentId: string,
  branch: string,
  basePrice: number,
  geoJsonData: any
): Promise<{ created: number; errors: string[]; warnings: string[] }> {
  const { features, warnings: validationWarnings } = parseGeoJSONFeatures(geoJsonData);
  const errors: string[] = [];
  let created = 0;

  logger.info('Creating stands from GeoJSON', { module: 'API', action: 'createStandsFromGeoJSON', developmentId, featureCount: features.length });

  for (let i = 0; i < features.length; i++) {
    const feature = features[i];
    try {
      const props = feature.properties || {};

      // AUTO-GENERATE stand_number if missing (flexible fallback chain)
      // Check for auto-generated ID from validation
      const standNumber = props.standNumber || props.stand_number || props.Name || props.name ||
        (props._auto_generated_id ? `Stand-${i + 1}` : `Stand-${i + 1}`);

      const sizeSqm = clampMax(safeParseNumber(props.size_sqm || props.sizeSqm || props.area, 0), DB_LIMITS.area);
      const pricePerSqm = clampMax(safeParseNumber(props.price_per_sqm || props.pricePerSqm, 0), DB_LIMITS.pricePerSqm);
      const price = clampMax(safeParseNumber(props.price, basePrice), DB_LIMITS.price);

      const standId = generateId('std');

      await pool.query(`
        INSERT INTO stands (
          id, stand_number, development_id, branch, price, price_per_sqm, size_sqm, status, created_at, updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW(), NOW())
        ON CONFLICT (development_id, stand_number) 
        DO UPDATE SET 
          price = EXCLUDED.price,
          price_per_sqm = EXCLUDED.price_per_sqm,
          size_sqm = EXCLUDED.size_sqm,
          updated_at = NOW()
        -- NOTE: Removed status filter to allow updating RESERVED/SOLD stands when geometry changes
      `, [standId, standNumber, developmentId, branch, price, pricePerSqm || null, sizeSqm || null, 'AVAILABLE']);

      created++;
    } catch (err: any) {
      // Log error but continue processing remaining features (non-blocking)
      const errorMsg = `Stand ${i + 1}: ${err?.message || 'Unknown error'}`;
      errors.push(errorMsg);
      logger.error('Error creating stand from GeoJSON', err, { module: 'API', action: 'createStandsFromGeoJSON', standIndex: i + 1, errorMsg });
    }
  }

  // Format validation warnings for UI
  const formattedWarnings = validationWarnings
    .filter(w => w.severity !== 'info')
    .map(w => w.message);

  logger.info('Stand creation from GeoJSON complete', { module: 'API', action: 'createStandsFromGeoJSON', created, errorCount: errors.length, warningCount: formattedWarnings.length });
  return { created, errors, warnings: formattedWarnings };
}

/**
 * Create Stand records from Manual Numbering (Sequential)
 * EFFICIENCY: Uses batch INSERT for better performance
 */
async function createStandsManually(
  pool: Pool,
  developmentId: string,
  branch: string,
  options: {
    count: number;
    prefix: string;
    startNumber: number;
    defaultSize: number;
    defaultPrice: number;
    sizes?: number[]; // Array of sizes to cycle through
  }
): Promise<{ created: number; errors: string[]; warnings: string[] }> {
  const { count, prefix, startNumber, defaultSize, defaultPrice, sizes } = options;
  const errors: string[] = [];

  if (count <= 0 || count > 10000) {
    return { created: 0, errors: ['Invalid stand count (must be 1-10000)'], warnings: [] };
  }

  logger.info('Creating stands manually', { module: 'API', action: 'createStandsManually', developmentId, count, prefix, startNumber, defaultSize, defaultPrice, sizes });

  // Build batch insert values for efficiency (chunks of 100)
  const BATCH_SIZE = 100;
  let created = 0;

  for (let batch = 0; batch < Math.ceil(count / BATCH_SIZE); batch++) {
    const batchStart = batch * BATCH_SIZE;
    const batchEnd = Math.min(batchStart + BATCH_SIZE, count);
    const batchCount = batchEnd - batchStart;

    // Build parameterized values for this batch
    const values: any[] = [];
    const placeholders: string[] = [];
    let paramIndex = 1;

    for (let i = 0; i < batchCount; i++) {
      const standNum = startNumber + batchStart + i;
      const paddedNum = String(standNum).padStart(3, '0');
      const standNumber = prefix ? `${prefix}${paddedNum}` : paddedNum;
      const standId = generateId('std');

      // Use sizes array if provided, otherwise use default size
      let size = defaultSize;
      if (sizes && sizes.length > 0) {
        size = sizes[(batchStart + i) % sizes.length];
      }

      const clampedSize = clampMax(safeParseNumber(size, 0), DB_LIMITS.area);
      const clampedPrice = clampMax(safeParseNumber(defaultPrice, 0), DB_LIMITS.price);
      const clampedPricePerSqm = clampedSize > 0 ? clampMax(clampedPrice / clampedSize, DB_LIMITS.pricePerSqm) : null;

      values.push(
        standId,
        standNumber,
        developmentId,
        branch,
        clampedPrice,
        clampedPricePerSqm,
        clampedSize,
        'AVAILABLE'
      );

      placeholders.push(`($${paramIndex}, $${paramIndex + 1}, $${paramIndex + 2}, $${paramIndex + 3}, $${paramIndex + 4}, $${paramIndex + 5}, $${paramIndex + 6}, $${paramIndex + 7}, NOW(), NOW())`);
      paramIndex += 8;
    }

    try {
      await pool.query(`
        INSERT INTO stands (
          id, stand_number, development_id, branch, price, price_per_sqm, size_sqm, status, created_at, updated_at
        ) VALUES ${placeholders.join(', ')}
        ON CONFLICT (development_id, stand_number) DO NOTHING
      `, values);

      created += batchCount;
      logger.debug(`Batch ${batch + 1} complete`, { module: 'API', action: 'createStandsManually', batch: batch + 1, standCount: batchCount });
    } catch (err: any) {
      const errorMsg = `Batch ${batch + 1}: ${err?.message || 'Unknown error'}`;
      errors.push(errorMsg);
      logger.error('Batch error during manual stand creation', err, { module: 'API', action: 'createStandsManually', batch: batch + 1, errorMsg });
    }
  }

  logger.info('Manual stand creation complete', { module: 'API', action: 'createStandsManually', created, errorCount: errors.length });
  return { created, errors, warnings: [] };
}

/**
 * Create Stand records from CSV Import
 * EFFICIENCY: Uses batch INSERT for better performance
 */
async function createStandsFromCSV(
  pool: Pool,
  developmentId: string,
  branch: string,
  csvStands: Array<{ standNumber: string; size: number; price?: number }>,
  basePrice: number,
  pricePerSqm: number
): Promise<{ created: number; errors: string[]; warnings: string[] }> {
  const errors: string[] = [];

  if (!csvStands || csvStands.length === 0) {
    return { created: 0, errors: ['No valid stands in CSV data'], warnings: [] };
  }

  if (csvStands.length > 10000) {
    return { created: 0, errors: ['CSV import cannot exceed 10,000 stands'], warnings: [] };
  }

  logger.info('Creating stands from CSV', { module: 'API', action: 'createStandsFromCSV', developmentId, standCount: csvStands.length });

  // Build batch insert values for efficiency (chunks of 100)
  const BATCH_SIZE = 100;
  let created = 0;

  for (let batch = 0; batch < Math.ceil(csvStands.length / BATCH_SIZE); batch++) {
    const batchStart = batch * BATCH_SIZE;
    const batchEnd = Math.min(batchStart + BATCH_SIZE, csvStands.length);
    const batchCount = batchEnd - batchStart;

    // Build parameterized values for this batch
    const values: any[] = [];
    const placeholders: string[] = [];
    let paramIndex = 1;

    for (let i = 0; i < batchCount; i++) {
      const stand = csvStands[batchStart + i];
      const standId = generateId('std');

      const clampedSize = clampMax(safeParseNumber(stand.size, 0), DB_LIMITS.area);
      // Use price from CSV if provided, otherwise calculate from basePrice or pricePerSqm
      let clampedPrice = basePrice;
      if (stand.price !== undefined && stand.price !== null) {
        clampedPrice = clampMax(safeParseNumber(stand.price, 0), DB_LIMITS.price);
      } else if (pricePerSqm > 0) {
        clampedPrice = clampMax(clampedSize * pricePerSqm, DB_LIMITS.price);
      }
      const clampedPricePerSqm = clampedSize > 0 ? clampMax(clampedPrice / clampedSize, DB_LIMITS.pricePerSqm) : null;

      values.push(
        standId,
        stand.standNumber,
        developmentId,
        branch,
        clampedPrice,
        clampedPricePerSqm,
        clampedSize,
        'AVAILABLE'
      );

      placeholders.push(`($${paramIndex}, $${paramIndex + 1}, $${paramIndex + 2}, $${paramIndex + 3}, $${paramIndex + 4}, $${paramIndex + 5}, $${paramIndex + 6}, $${paramIndex + 7}, NOW(), NOW())`);
      paramIndex += 8;
    }

    try {
      await pool.query(`
        INSERT INTO stands (
          id, stand_number, development_id, branch, price, price_per_sqm, size_sqm, status, created_at, updated_at
        ) VALUES ${placeholders.join(', ')}
        ON CONFLICT (development_id, stand_number) DO NOTHING
      `, values);

      created += batchCount;
      logger.debug(`Batch ${batch + 1} complete`, { module: 'API', action: 'createStandsFromCSV', batch: batch + 1, standCount: batchCount });
    } catch (err: any) {
      const errorMsg = `Batch ${batch + 1}: ${err?.message || 'Unknown error'}`;
      errors.push(errorMsg);
      logger.error('Batch error during CSV stand creation', err, { module: 'API', action: 'createStandsFromCSV', batch: batch + 1, errorMsg });
    }
  }

  logger.info('CSV stand creation complete', { module: 'API', action: 'createStandsFromCSV', created, errorCount: errors.length });
  return { created, errors, warnings: [] };
}

// =============================================================================
// POST - Create Development
// =============================================================================

/**
 * POST /api/admin/developments
 * 
 * Creates a new development with optional stand creation (GeoJSON or manual).
 * 
 * @param {NextRequest} request - Request object containing development data
 * @param {Object} request.body - Development data
 * @param {string} request.body.name - Development name (required)
 * @param {string} request.body.location - Location (required)
 * @param {number} request.body.basePrice - Base price in USD (required)
 * @param {Object} [request.body.geoJsonData] - GeoJSON for stand creation
 * @param {number} [request.body.standCountToCreate] - Manual stand count
 * @param {string} [request.body.standNumberPrefix] - Prefix for stand numbers
 * @param {number} [request.body.defaultStandSize] - Default stand size in sqm
 * @param {number} [request.body.defaultStandPrice] - Default stand price
 * 
 * @returns {NextResponse} Created development with stand creation results
 * @throws {401} Unauthorized - Admin role required
 * @throws {400} Validation error - Invalid input data
 * @throws {409} Conflict - Development ID already exists
 * @throws {500} Server error - Database or internal error
 * 
 * @example
 * ```typescript
 * const response = await fetch('/api/admin/developments', {
 *   method: 'POST',
 *   headers: { 'Content-Type': 'application/json' },
 *   body: JSON.stringify({
 *     name: 'New Estate',
 *     location: 'Harare',
 *     basePrice: 50000,
 *     standCountToCreate: 100
 *   })
 * });
 * ```
 */
export async function POST(request: NextRequest) {
  const startTime = Date.now();

  try {
    apiLogger.debug('POST /api/admin/developments called');

    // UNIFIED ADMIN AUTH: Single pattern using getServerSession with rate limiting
    const authResult = await requireAdmin(request, { limit: 10, windowMs: 60000 }); // 10 requests per minute
    if (authResult.error) {
      return authResult.error;
    }
    const user = authResult.user;
    logger.info('Admin verified', { module: 'API', email: user.email, role: user.role });

    let rawData;
    try {
      rawData = await request.json();
      logger.debug('Request payload received', {
        module: 'API',
        payloadKeys: rawData && typeof rawData === 'object' ? Object.keys(rawData).sort() : [],
        payloadKeyCount: rawData && typeof rawData === 'object' ? Object.keys(rawData).length : 0,
        name: rawData.name,
        branch: rawData.branch,
        total_stands: rawData.total_stands,
        base_price: rawData.base_price,
        hasGeoJSON: !!rawData.geo_json_data
      });
    } catch (parseError: any) {
      logger.error('JSON parse error', parseError, { module: 'API' });
      return apiError('Invalid JSON', 400, 'PARSE_ERROR', parseError?.message);
    }

    // Validate with Zod schema
    const validation = validateRequest<DevelopmentInput>(developmentSchema, rawData);
    if (!validation.success) {
      return validation.error;
    }

    // Use validated data for core fields, rawData (cast as any) for optional extended fields
    const data = validation.data;
    const extendedData = rawData as Record<string, any>;

    // Use shared database pool
    const pool = getDbPool();

    try {
      // Generate development ID
      const developmentId = data.id || generateId('dev');
      const branch = data.branch || 'Harare';
      const totalStands = safeParseInt(data.totalStands, 0);
      const basePrice = clampMax(safeParseNumber(data.basePrice, 0), DB_LIMITS.price);
      const location = data.locationName || data.location || '';

      // FORENSIC: Log estate_progress if present
      if (extendedData.estate_progress) {
        logger.debug('Estate progress details received', { module: 'API', action: 'createDevelopment', estate_progress: extendedData.estate_progress });
      }

      logger.info('Creating development', { module: 'API', action: 'createDevelopment', id: developmentId, name: data.name, branch, totalStands, basePrice, hasEstateProgress: !!extendedData.estate_progress });

      // Insert development record
      // Calculate center coordinates from GeoJSON if provided
      const geoJsonData = extendedData.geojsonData || data.geoJsonData;
      const { latitude, longitude } = calculateGeoJSONCenter(geoJsonData);

      logger.info('Calculated map center from GeoJSON', { module: 'API', action: 'createDevelopment', latitude, longitude });

      // Enforce DB enum values before INSERT to avoid runtime 22P02 errors.
      const phase = (data.phase || 'SERVICING').toUpperCase();
      const allowedPhases = new Set(['SERVICING', 'READY_TO_BUILD', 'COMPLETED']);
      if (!allowedPhases.has(phase)) {
        return apiError(
          `Invalid phase '${data.phase}'. Allowed values: SERVICING, READY_TO_BUILD, COMPLETED.`,
          400,
          ErrorCodes.VALIDATION_ERROR
        );
      }

      const insertData: Record<string, unknown> = {
        id: developmentId,
        name: data.name,
        location: location,
        description: data.description || null,
        overview: data.overview || null,
        phase,
        servicing_progress: safeParseNumber(data.servicingProgress, 0),
        status: data.status || 'Active',
        base_price: basePrice,
        price_per_sqm: (data.pricePerSqm || extendedData.pricePerSqm)
          ? clampMax(safeParseNumber(data.pricePerSqm || extendedData.pricePerSqm, 0), DB_LIMITS.pricePerSqm)
          : null,
        vat_percentage: clampMax(safeParseNumber(data.vatPercentage, 15), DB_LIMITS.percentage),
        endowment_fee: clampMax(safeParseNumber(data.endowmentFee, 0), DB_LIMITS.fee),
        total_area_sqm: data.totalAreaSqm ? clampMax(safeParseNumber(data.totalAreaSqm, 0), DB_LIMITS.area) : null,
        total_stands: totalStands,
        available_stands: totalStands,
        main_image: data.mainImage || null,
        gallery: data.gallery && data.gallery.length > 0 ? data.gallery : null,
        geo_json_url: data.geoJsonUrl || null,
        geo_json_data: safeStringifyForDB(extendedData.geojsonData || data.geoJsonData),
        has_geo_json_map: !!geoJsonData,
        latitude: latitude,
        longitude: longitude,
        image_urls: (() => {
          const urls = extendedData.image_urls || extendedData.imageUrls;
          return urls && Array.isArray(urls) && urls.length > 0 ? urls : null;
        })(),
        logo_url: extendedData.logo_url || null,
        document_urls: (() => {
          const urls = extendedData.document_urls || extendedData.documentUrls;
          return urls && Array.isArray(urls) && urls.length > 0 ? urls : null;
        })(),
        stand_sizes: (() => {
          const sizes = extendedData.standSizes ?? extendedData.stand_sizes;
          // Ensure it's always an object before stringifying - prevent integer to JSONB cast error
          if (sizes === null || sizes === undefined) {
            return null;
          }
          if (typeof sizes === 'number') {
            // If it's a primitive number, convert to object format
            return JSON.stringify({ "0": sizes });
          }
          if (typeof sizes === 'object' && sizes !== null) {
            return JSON.stringify(sizes);
          }
          // If it's a string, try to parse and return
          try {
            const parsed = JSON.parse(sizes);
            return JSON.stringify(parsed);
          } catch {
            return null;
          }
        })(),
        stand_types: (() => {
          const types = extendedData.standTypes ?? extendedData.stand_types;
          return Array.isArray(types) && types.length > 0 ? types : null;
        })(),
        features: extendedData.features && extendedData.features.length > 0 ? extendedData.features : null,
        commission_model: (() => {
          const model = extendedData.commissionModel ?? extendedData.commission_model ?? extendedData.commission;
          return model ? JSON.stringify(model) : null;
        })(),
        developer_name: data.developerName || extendedData.developerName || null,
        developer_email: data.developerEmail || extendedData.developerEmail || null,
        developer_phone: data.developerPhone || extendedData.developerPhone || null,
        lawyer_name: data.lawyerName || extendedData.lawyerName || null,
        lawyer_email: data.lawyerEmail || extendedData.lawyerEmail || null,
        lawyer_phone: data.lawyerPhone || extendedData.lawyerPhone || null,
        estate_progress: extendedData.estate_progress ? JSON.stringify(extendedData.estate_progress) : null,
        installment_periods: (() => {
          const periods = extendedData.installmentPeriods || extendedData.installment_periods;
          if (Array.isArray(periods) && periods.length > 0) {
            return periods.map((v: any) => parseInt(v, 10)).filter((v: number) => !isNaN(v));
          }
          return [12, 24, 48];
        })(),
        deposit_percentage: clampMax(
          safeParseNumber(extendedData.depositPercentage || extendedData.deposit_percentage, 30),
          DB_LIMITS.percentage
        ),
        vat_enabled: data.vatEnabled !== undefined ? data.vatEnabled : (extendedData.vatEnabled !== undefined ? extendedData.vatEnabled : true),
        endowment_enabled: data.endowmentEnabled !== undefined ? data.endowmentEnabled : (extendedData.endowmentEnabled !== undefined ? extendedData.endowmentEnabled : false),
        aos_enabled: data.aosEnabled !== undefined ? data.aosEnabled : (extendedData.aosEnabled !== undefined ? extendedData.aosEnabled : false),
        aos_fee: clampMax(safeParseNumber(data.aosFee || extendedData.aosFee, 500), DB_LIMITS.fee),
        cessions_enabled: data.cessionsEnabled !== undefined ? data.cessionsEnabled : (extendedData.cessionsEnabled !== undefined ? extendedData.cessionsEnabled : false),
        cession_fee: clampMax(safeParseNumber(data.cessionFee || extendedData.cessionFee, 250), DB_LIMITS.fee),
        admin_fee_enabled: data.adminFeeEnabled !== undefined ? data.adminFeeEnabled : (extendedData.adminFeeEnabled !== undefined ? extendedData.adminFeeEnabled : false),
        admin_fee: clampMax(safeParseNumber(data.adminFee || extendedData.adminFee, 0), DB_LIMITS.fee),
        disable_map_view: Boolean(extendedData.disableMapView ?? extendedData.disable_map_view ?? data.disableMapView ?? false),
        branch: branch,
        featured_tag: safeFeaturedTag(data.featuredTag || extendedData.featuredTag || extendedData.featured_tag, 'none'),
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      const jsonbColumns = new Set([
        'geo_json_data',
        'stand_sizes',
        'commission_model',
        'estate_progress',
      ]);

      const insertEntries = Object.entries(insertData).filter(([, value]) => value !== undefined);
      const insertColumns = insertEntries.map(([column]) => column);
      const values = insertEntries.map(([, value]) => value);
      const valueExpressions = insertColumns.map((column, index) => {
        const placeholder = `$${index + 1}`;
        return jsonbColumns.has(column) ? `${placeholder}::jsonb` : placeholder;
      });

      const insertQuery = `
        INSERT INTO developments (${insertColumns.join(', ')})
        VALUES (${valueExpressions.join(', ')})
        RETURNING *;
      `;

      const redactedParams = values.map((value, index) => redactSqlParam(insertColumns[index], value));
      logger.info('Prepared development INSERT', {
        module: 'API',
        action: 'createDevelopment',
        sql: insertQuery.replace(/\s+/g, ' ').trim(),
        columnCount: insertColumns.length,
        valueCount: values.length,
        columns: insertColumns,
        params: redactedParams,
      });

      const result = await pool.query(insertQuery, values);

      if (result.rows.length === 0) {
        throw new Error('Development INSERT returned no rows');
      }

      const created = result.rows[0];
      logger.info('Development created successfully', { module: 'API', action: 'createDevelopment', id: created.id, name: created.name });

      // Create stands from GeoJSON if provided OR from Manual creation settings
      let standResult = { created: 0, errors: [] as string[], warnings: [] as string[] };

      if (extendedData.useManualStandCreation && extendedData.standCountToCreate && extendedData.standCountToCreate > 0) {
        // MANUAL STAND CREATION MODE
        logger.info('Using MANUAL stand creation mode', { module: 'API', action: 'createDevelopment' });

        // Parse manual stand sizes from CSV string
        let sizes: number[] | undefined;
        if (extendedData.manualStandSizes && typeof extendedData.manualStandSizes === 'string' && extendedData.manualStandSizes.trim()) {
          sizes = extendedData.manualStandSizes
            .split(',')
            .map(s => parseFloat(s.trim()))
            .filter(s => !isNaN(s) && s > 0);
        }

        standResult = await createStandsManually(
          pool,
          developmentId,
          branch,
          {
            count: extendedData.standCountToCreate || 0,
            prefix: extendedData.standNumberPrefix || '',
            startNumber: extendedData.standNumberStart ? (typeof extendedData.standNumberStart === 'string' ? parseInt(extendedData.standNumberStart, 10) : extendedData.standNumberStart) : 1,
            defaultSize: extendedData.defaultStandSize ? (typeof extendedData.defaultStandSize === 'string' ? parseFloat(extendedData.defaultStandSize) : extendedData.defaultStandSize) : 0,
            defaultPrice: extendedData.defaultStandPrice ? (typeof extendedData.defaultStandPrice === 'string' ? parseFloat(extendedData.defaultStandPrice) || basePrice || 0 : extendedData.defaultStandPrice) : (basePrice || 0),
            sizes: sizes && sizes.length > 0 ? sizes : undefined
          }
        );
      } else if (extendedData.parsedCsvStands && Array.isArray(extendedData.parsedCsvStands) && extendedData.parsedCsvStands.length > 0) {
        // CSV IMPORT MODE
        logger.info('Using CSV import mode', { module: 'API', action: 'createDevelopment', standCount: extendedData.parsedCsvStands.length });

        standResult = await createStandsFromCSV(
          pool,
          developmentId,
          branch,
          extendedData.parsedCsvStands,
          basePrice || 0,
          extendedData.pricePerSqm || 0
        );
      } else if (data.geoJsonData || extendedData.geojsonData) {
        // GEOJSON STAND CREATION MODE
        logger.info('Using GeoJSON stand creation mode', { module: 'API', action: 'createDevelopment' });
        standResult = await createStandsFromGeoJSON(
          pool,
          developmentId,
          branch,
          basePrice || 0,
          data.geoJsonData || extendedData.geojsonData
        );
      } else {
        logger.info('No stand creation method specified - skipping stand creation', { module: 'API', action: 'createDevelopment' });
      }

      // Note: Using shared pool - do NOT call pool.end() as it's reused across requests

      const duration = Date.now() - startTime;
      logger.info('POST completed', { module: 'API', action: 'createDevelopment', duration });

      return apiSuccess({
        ...created,
        stands: standResult,
        duration
      }, 201);

    } catch (dbError: any) {
      logger.error('Database error during CREATE', dbError, { module: 'API', action: 'createDevelopment', code: dbError?.code, detail: dbError?.detail });

      // Note: Using shared pool - do NOT call pool.end() on error

      // Handle specific database errors
      if (dbError?.code === '23505') {
        return apiError(
          'Development with this ID already exists',
          409,
          ErrorCodes.DUPLICATE_KEY
        );
      }

      // Invalid input/constraint issues should return 400, not 500
      if (['23502', '22P02', '22001', '22003', '23514'].includes(dbError?.code)) {
        return apiError(
          `Invalid development payload: ${dbError?.detail || dbError?.message || 'Validation failed'}`,
          400,
          ErrorCodes.VALIDATION_ERROR
        );
      }

      throw dbError;
    }

  } catch (error: any) {
    logger.error('POST error', error, { module: 'API', action: 'createDevelopment', code: error?.code });

    // Note: Using shared pool - do NOT call pool.end() on error

    return apiError(
      error?.message || 'Failed to create development',
      500,
      ErrorCodes.CREATE_ERROR,
      process.env.NODE_ENV === 'development' ? { stack: error?.stack } : undefined
    );
  }
}

// Legacy Prisma code reference removed - using direct pg pool queries now

export async function GET(request: NextRequest) {
  try {
    logger.debug('GET /api/admin/developments called', { module: 'API' });

    // Public endpoint - no auth required for listing developments

    // Parse query parameters
    const branch = request.nextUrl.searchParams.get('branch');
    const status = request.nextUrl.searchParams.get('status');
    const id = request.nextUrl.searchParams.get('id');

    // Pagination parameters
    const page = Math.max(1, safeParseInt(request.nextUrl.searchParams.get('page'), 1));
    const limit = Math.min(100, Math.max(1, safeParseInt(request.nextUrl.searchParams.get('limit'), 50)));
    const skip = (page - 1) * limit;

    // Use shared database pool for efficient connection reuse
    let pool;
    try {
      pool = getDbPool();
      logger.debug('Database pool obtained', { module: 'API' });
    } catch (poolError: any) {
      logger.error('Failed to get database pool', poolError, { module: 'API' });
      return apiSuccess([], 200, { page: 1, limit: 50, total: 0, pages: 0 });
    }

    // Build query with optional filters
    // TEMPORARY: Start with simple query like test endpoint to debug
    // Use COALESCE for columns that might not exist in older schemas
    // IMPORTANT: Do not filter by status or branch unless explicitly requested
    // This ensures all developments are returned by default
    let query = `
      SELECT 
        id, name, location, description, 
        COALESCE(overview, '') as overview,
        phase, servicing_progress, 
        COALESCE(status, 'Active') as status, 
        base_price, price_per_sqm, vat_percentage, endowment_fee,
        total_area_sqm, total_stands, available_stands, main_image,
        COALESCE(gallery, ARRAY[]::TEXT[]) as gallery,
        geo_json_url, 
        COALESCE(geo_json_data, '{}'::jsonb) as geo_json_data,
        latitude, longitude,
        COALESCE(image_urls, ARRAY[]::TEXT[]) as image_urls,
        logo_url, 
        COALESCE(document_urls, ARRAY[]::TEXT[]) as document_urls,
        COALESCE(stand_sizes, '{}'::jsonb) as stand_sizes,
        COALESCE(stand_types, ARRAY[]::TEXT[]) as stand_types,
        COALESCE(features, ARRAY[]::TEXT[]) as features,
        COALESCE(commission_model, '{}'::jsonb) as commission_model,
        COALESCE(estate_progress, '{}'::jsonb) as estate_progress,
        COALESCE(branch, 'Harare') as branch,
        developer_name, developer_email, developer_phone,
        lawyer_name, lawyer_email, lawyer_phone,
        COALESCE(installment_periods, ARRAY[12, 24, 48]::INT[]) as installment_periods,
        COALESCE(deposit_percentage, 30) as deposit_percentage,
        COALESCE(vat_enabled, true) as vat_enabled,
        COALESCE(endowment_enabled, false) as endowment_enabled,
        COALESCE(aos_enabled, false) as aos_enabled,
        COALESCE(aos_fee, 500) as aos_fee,
        COALESCE(cessions_enabled, false) as cessions_enabled,
        COALESCE(cession_fee, 250) as cession_fee,
         COALESCE(admin_fee_enabled, false) as admin_fee_enabled,
         COALESCE(admin_fee, 0) as admin_fee,
         COALESCE(disable_map_view, false) as disable_map_view,
         last_updated_by_id, created_at, updated_at
      FROM developments 
      WHERE 1=1
    `;

    logger.debug('Building query with filters', { module: 'API', action: 'getDevelopments', branch, status, id });
    const params: any[] = [];
    let paramIdx = 1;

    // Filter by specific development ID
    if (id) {
      query += ` AND id = $${paramIdx}`;
      params.push(id);
      paramIdx++;
    }

    // Filter by branch ONLY if explicitly provided
    // Handle NULL branch values by using COALESCE in the comparison
    if (branch) {
      query += ` AND COALESCE(branch, 'Harare') = $${paramIdx}`;
      params.push(branch);
      paramIdx++;
    }

    // Filter by status ONLY if explicitly provided
    // Do NOT filter by status by default - show all developments regardless of status
    if (status) {
      query += ` AND COALESCE(status, 'Active') = $${paramIdx}`;
      params.push(status);
      paramIdx++;
    }

    query += ` ORDER BY created_at DESC`;

    // Get total count for pagination (before LIMIT/OFFSET)
    // Use a simpler count query to avoid column issues
    let countQuery = 'SELECT COUNT(*) as count FROM developments WHERE 1=1';
    const countParams: any[] = [];
    let countParamIdx = 1;

    if (id) {
      countQuery += ` AND id = $${countParamIdx}`;
      countParams.push(id);
      countParamIdx++;
    }
    if (branch) {
      countQuery += ` AND COALESCE(branch, 'Harare') = $${countParamIdx}`;
      countParams.push(branch);
      countParamIdx++;
    }
    if (status) {
      countQuery += ` AND COALESCE(status, 'Active') = $${countParamIdx}`;
      countParams.push(status);
      countParamIdx++;
    }

    logger.debug('Executing count query', {
      module: 'API',
      countQuery,
      paramsCount: countParams.length,
      filters: { branch, status, id }
    });

    let countResult;
    try {
      countResult = await pool.query(countQuery, countParams);
    } catch (countError: any) {
      logger.error('Count query failed', countError, {
        module: 'API',
        countQuery,
        params: countParams,
        errorMessage: countError.message,
        errorCode: countError.code
      });
      // Fallback: try simple count without filters
      try {
        countResult = await pool.query('SELECT COUNT(*) as count FROM developments');
        logger.warn('Used fallback count query (no filters)', { module: 'API' });
      } catch (fallbackError: any) {
        logger.error('Fallback count query also failed', fallbackError, { module: 'API' });
        throw countError; // Throw original error
      }
    }

    const total = parseInt(countResult.rows[0]?.count || '0', 10);

    logger.info('Count query result', {
      module: 'API',
      total,
      rawCount: countResult.rows[0]?.count,
      filters: { branch, status, id }
    });

    // Log count query result
    logger.debug('Count query result', { module: 'API', action: 'getDevelopments', total });

    // Apply pagination
    // IMPORTANT: paramIdx is the next available parameter index
    // So LIMIT uses paramIdx, OFFSET uses paramIdx + 1
    query += ` LIMIT $${paramIdx} OFFSET $${paramIdx + 1}`;
    params.push(limit, skip);

    logger.debug('Final query params', {
      module: 'API', action: 'getDevelopments',
      paramIdx,
      limitParam: `$${paramIdx}`,
      offsetParam: `$${paramIdx + 1}`,
      limitValue: limit,
      skipValue: skip,
      totalParams: params.length,
      params: params
    });

    logger.debug('Executing developments query', {
      module: 'API',
      query: query.substring(0, 300) + '...',
      fullQuery: query,
      paramsCount: params.length,
      params: params,
      filters: { branch, status, id },
      pagination: { page, limit, skip }
    });

    // Log query execution
    logger.debug('Executing query with params', {
      module: 'API', action: 'getDevelopments', total, page, limit, skip,
      filters: { branch, status, id },
      paramCount: params.length
    });

    let result;
    try {
      logger.debug('Executing query', { module: 'API', action: 'getDevelopments', query: query.substring(0, 500), paramCount: params.length });
      result = await pool.query(query, params);
      logger.debug('Query succeeded', { module: 'API', action: 'getDevelopments', rowsReturned: result.rows.length });
    } catch (queryError: any) {
      // CRITICAL: Log full error details for forensic analysis
      const errorDetails = {
        message: queryError.message,
        code: queryError.code,
        detail: queryError.detail,
        hint: queryError.hint,
        position: queryError.position,
        where: queryError.where,
        schema: queryError.schema,
        table: queryError.table,
        column: queryError.column,
        constraint: queryError.constraint,
        file: queryError.file,
        line: queryError.line,
        routine: queryError.routine
      };

      // Log full error details for forensic analysis
      logger.error('Query failed - full error details', queryError, {
        module: 'API',
        action: 'getDevelopments',
        query: query.substring(0, 1000),
        params,
        errorDetails
      });

      // Fallback: Try simpler query with only essential columns (like test endpoint)
      logger.warn('Attempting fallback query with minimal columns', { module: 'API', action: 'getDevelopments' });

      try {
        let fallbackQuery = `
          SELECT 
            id, name, location, description,
            COALESCE(status, 'Active') as status,
            COALESCE(branch, 'Harare') as branch,
            base_price, created_at, updated_at
          FROM developments 
          WHERE 1=1
        `;
        const fallbackParams: any[] = [];
        let fallbackParamIdx = 1;

        if (id) {
          fallbackQuery += ` AND id = $${fallbackParamIdx}`;
          fallbackParams.push(id);
          fallbackParamIdx++;
        }
        if (branch) {
          fallbackQuery += ` AND COALESCE(branch, 'Harare') = $${fallbackParamIdx}`;
          fallbackParams.push(branch);
          fallbackParamIdx++;
        }
        if (status) {
          fallbackQuery += ` AND COALESCE(status, 'Active') = $${fallbackParamIdx}`;
          fallbackParams.push(status);
          fallbackParamIdx++;
        }

        fallbackQuery += ` ORDER BY created_at DESC LIMIT $${fallbackParamIdx} OFFSET $${fallbackParamIdx + 1}`;
        fallbackParams.push(limit, skip);

        logger.debug('Fallback query', { module: 'API', action: 'GET_DEVELOPMENTS', query: fallbackQuery, params: fallbackParams });

        result = await pool.query(fallbackQuery, fallbackParams);

        logger.info('Fallback query succeeded', { module: 'API', action: 'GET_DEVELOPMENTS', rowsReturned: result.rows.length });

        logger.info('Fallback query succeeded', {
          module: 'API',
          count: result.rows.length,
          usedFallback: true
        });
      } catch (fallbackError: any) {
        logger.error('Fallback query also failed', fallbackError, {
          module: 'API',
          errorMessage: fallbackError.message,
          errorCode: fallbackError.code,
          errorDetail: fallbackError.detail
        });

        // Return error response instead of empty arrays to surface the issue
        return apiError(
          `Database query failed: ${fallbackError.message || 'Unknown error'}. Check server logs for details.`,
          500,
          'QUERY_FAILED',
          {
            originalError: queryError.message,
            fallbackError: fallbackError.message,
            hint: 'Check database schema matches Prisma schema. Run: npx prisma migrate status'
          }
        );
      }
    }

    logger.info('Fetched developments from Neon', {
      module: 'API',
      count: result.rows.length,
      total,
      page,
      limit,
      filters: { branch, status, id },
      sampleIds: result.rows.slice(0, 3).map(r => ({ id: r.id, name: r.name, branch: r.branch, status: r.status }))
    });

    // Critical: Log if query returned 0 rows but count says there should be data
    if (result.rows.length === 0 && total > 0) {
      logger.error('CRITICAL: Query returned 0 rows but count query says total > 0', {
        module: 'API',
        total,
        resultRowCount: result.rows.length,
        page,
        limit,
        skip,
        query: query.substring(0, 500),
        params
      });

      // Try a simpler fallback query with only essential columns
      logger.warn('Attempting fallback query with minimal columns', { module: 'API' });
      try {
        const fallbackQuery = `
          SELECT 
            id, name, location, description,
            COALESCE(status, 'Active') as status,
            COALESCE(branch, 'Harare') as branch,
            base_price, created_at, updated_at
          FROM developments 
          WHERE 1=1
          ${id ? ` AND id = $1` : ''}
          ${branch ? ` AND COALESCE(branch, 'Harare') = $${id ? 2 : 1}` : ''}
          ${status ? ` AND COALESCE(status, 'Active') = $${id ? (branch ? 3 : 2) : (branch ? 2 : 1)}` : ''}
          ORDER BY created_at DESC
          LIMIT $${(id ? 1 : 0) + (branch ? 1 : 0) + (status ? 1 : 0) + 1} OFFSET $${(id ? 1 : 0) + (branch ? 1 : 0) + (status ? 1 : 0) + 2}
        `;
        const fallbackParams: any[] = [];
        if (id) fallbackParams.push(id);
        if (branch) fallbackParams.push(branch);
        if (status) fallbackParams.push(status);
        fallbackParams.push(limit, skip);

        const fallbackResult = await pool.query(fallbackQuery, fallbackParams);
        if (fallbackResult.rows.length > 0) {
          logger.info('Fallback query succeeded', {
            module: 'API',
            count: fallbackResult.rows.length
          });
          result = fallbackResult;
        }
      } catch (fallbackError: any) {
        logger.error('Fallback query also failed', fallbackError, { module: 'API' });
      }
    }

    // Additional debug: Log if no results but total > 0 (pagination issue)
    if (result.rows.length === 0 && total > 0) {
      logger.warn('Pagination issue detected', {
        module: 'API',
        total,
        page,
        limit,
        skip,
        calculatedSkip: (page - 1) * limit
      });
    }

    // Additional debug: Log if total is 0 (no developments in DB)
    if (total === 0) {
      logger.warn('No developments found in database', {
        module: 'API',
        filters: { branch, status, id },
        query: query.substring(0, 300)
      });
    }

    // Note: Using shared pool - do NOT call pool.end() as it's reused across requests

    // RBAC: Filter sensitive fields (lawyer/developer contacts) for CLIENT role
    // These fields should only be visible to ADMIN, MANAGER, DEVELOPER roles
    const user = await getAuthenticatedUser();
    const userRole = user?.role?.toUpperCase() || 'CLIENT';
    const allowedRoles = ['ADMIN', 'MANAGER', 'DEVELOPER', 'ACCOUNT'];
    const shouldFilterSensitiveFields = !allowedRoles.includes(userRole);

    let filteredRows = result.rows;
    if (shouldFilterSensitiveFields) {
      // Remove lawyer and developer contact fields for CLIENT/public access
      filteredRows = result.rows.map((row: any) => {
        const { lawyer_name, lawyer_email, lawyer_phone, developer_email, developer_phone, ...rest } = row;
        // Keep developer_name for display purposes but remove contact details
        return {
          ...rest,
          developer_name: rest.developer_name, // Keep name but remove email/phone
        };
      });
      logger.debug('Filtered sensitive fields for non-admin role', {
        module: 'API',
        action: 'getDevelopments',
        userRole,
        filteredCount: filteredRows.length
      });
    }

    // Map database snake_case columns to frontend camelCase properties
    const mappedRows = filteredRows.map((row: any) => ({
      ...row,
      // Map keys that differ
      locationName: row.location, // Map location -> locationName
      basePrice: row.base_price,
      vatPercentage: row.vat_percentage,
      endowmentFee: row.endowment_fee,
      totalAreaSqm: row.total_area_sqm,
      totalStands: row.total_stands,
      availableStands: row.available_stands,
      mainImage: row.main_image,
      geoJsonUrl: row.geo_json_url,
      geoJsonData: row.geo_json_data, // Already matches but explicit for clarity
      imageUrls: row.image_urls || [],
      logoUrl: row.logo_url,
      documentUrls: row.document_urls || [],
      standSizes: row.stand_sizes,
      standTypes: row.stand_types,
      commissionModel: row.commission_model,
      estateProgress: row.estate_progress,

      // Developer/Lawyer info
      developerName: row.developer_name,
      developerEmail: row.developer_email,
      developerPhone: row.developer_phone,
      lawyerName: row.lawyer_name,
      lawyerEmail: row.lawyer_email,
      lawyerPhone: row.lawyer_phone,

      // Financial configuration
      installmentPeriods: row.installment_periods,
      depositPercentage: row.deposit_percentage,
      vatEnabled: row.vat_enabled,
      endowmentEnabled: row.endowment_enabled,
      aosEnabled: row.aos_enabled,
      aosFee: row.aos_fee,
      cessionsEnabled: row.cessions_enabled,
      cessionFee: row.cession_fee,
      adminFeeEnabled: row.admin_fee_enabled,
      adminFee: row.admin_fee,

      // Other flags
      disableMapView: row.disable_map_view,
      featuredTag: row.featured_tag,

      createdAt: row.created_at,
      updatedAt: row.updated_at,
    }));

    return apiSuccess(
      mappedRows,
      200,
      {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    );
  } catch (error: any) {
    logger.error('Development fetch error', error, { module: 'API' });
    // Return 200 with empty data so landing page and other public callers can render (no 500)
    // Note: Using shared pool - do NOT call pool.end() on error
    return apiSuccess([], 200, { page: 1, limit: 50, total: 0, pages: 0 });
  }
}

export async function PUT(request: NextRequest) {
  const startTime = Date.now();

  try {
    logger.debug('PUT /api/admin/developments called', { module: 'API' });

    // UNIFIED ADMIN AUTH: Single pattern using getServerSession with rate limiting
    const authResult = await requireAdmin(request, { limit: 10, windowMs: 60000 }); // 10 requests per minute
    if (authResult.error) {
      return authResult.error;
    }
    const user = authResult.user;
    logger.info('Admin verified for update', { module: 'API', email: user.email, role: user.role });

    let body;
    try {
      body = await request.json();
    } catch (parseError: any) {
      logger.error('JSON parse error', parseError, { module: 'API', action: 'PUT_DEVELOPMENT' });
      return apiError('Invalid JSON', 400, ErrorCodes.PARSE_ERROR);
    }

    logger.debug('PUT request body received', {
      module: 'API',
      action: 'PUT_DEVELOPMENT',
      id: body.id,
      name: body.name,
      branch: body.branch,
      fieldsCount: Object.keys(body).length,
      hasGeoJSON: !!body.geo_json_data
    });

    const { id, geo_json_data, ...updateData } = body;

    // FORENSIC: Log geo_json_data structure to diagnose double-encoding issues
    logger.info('[FORENSIC] geo_json_data analysis', {
      module: 'API',
      action: 'PUT_DEVELOPMENT',
      geoJsonDataType: typeof geo_json_data,
      geoJsonDataIsNull: geo_json_data === null,
      geoJsonDataIsUndefined: geo_json_data === undefined,
      geoJsonDataLength: typeof geo_json_data === 'string' ? geo_json_data.length : 'N/A',
      geoJsonDataStartsWith: typeof geo_json_data === 'string' ? geo_json_data.substring(0, 50) : 'N/A',
      geoJsonDataIsObject: typeof geo_json_data === 'object',
      geoJsonDataTypeProperty: typeof geo_json_data === 'object' ? geo_json_data?.type : 'N/A',
      geoJsonDataHasFeatures: typeof geo_json_data === 'object' ? Array.isArray(geo_json_data?.features) : false
    });

    if (!id) {
      return apiError('Development ID is required', 400, ErrorCodes.INVALID_REQUEST);
    }

    // Use shared database pool for efficient connection reuse
    const pool = getDbPool();

    try {
      // First verify the development exists
      const existsCheck = await pool.query('SELECT id, name FROM developments WHERE id = $1', [id]);
      if (existsCheck.rows.length === 0) {
        logger.warn('Development not found for update', { module: 'API', action: 'PUT_DEVELOPMENT', id });
        // Note: Using shared pool - do NOT call pool.end()
        return apiError('Development not found', 404, ErrorCodes.DEVELOPMENT_NOT_FOUND);
      }

      // Build dynamic UPDATE query based on provided fields
      const fieldsToUpdate: string[] = [];
      const values: any[] = [];
      let paramCount = 1;

      // Map all possible field names to database columns
      const fieldMap: Record<string, string> = {
        'name': 'name',
        'location': 'location',
        'location_name': 'location',
        'description': 'description',
        'overview': 'overview',
        'status': 'status',
        'phase': 'phase',
        'estateProgress': 'phase', // Map wizard field to phase column
        'base_price': 'base_price',
        'price_per_sqm': 'price_per_sqm',
        'pricePerSqm': 'price_per_sqm', // Map wizard field
        'vat_percentage': 'vat_percentage',
        'endowment_fee': 'endowment_fee',
        'total_area_sqm': 'total_area_sqm',
        'total_stands': 'total_stands',
        'available_stands': 'available_stands',
        'main_image': 'main_image',
        'gallery': 'gallery',
        'geo_json_url': 'geo_json_url',
        'geo_json_data': 'geo_json_data',
        'geojsonData': 'geo_json_data',
        'has_geo_json_map': 'has_geo_json_map',
        'hasGeoJsonMap': 'has_geo_json_map',
        'image_urls': 'image_urls',
        'imageUrls': 'image_urls',
        'logo_url': 'logo_url',
        'document_urls': 'document_urls',
        'documentUrls': 'document_urls',
        'servicing_progress': 'servicing_progress',
        'stand_sizes': 'stand_sizes',
        'standSizes': 'stand_sizes',
        'stand_types': 'stand_types',
        'standTypes': 'stand_types',
        'features': 'features', // Amenities/features array
        'commission_model': 'commission_model',
        'commissionModel': 'commission_model',
        'commission': 'commission_model', // Map wizard field
        // Installment configuration
        'installment_periods': 'installment_periods',
        'installmentPeriods': 'installment_periods',
        'deposit_percentage': 'deposit_percentage',
        'depositPercentage': 'deposit_percentage',
        // Developer info fields (for reports)
        'developer_name': 'developer_name',
        'developerName': 'developer_name',
        'developer_email': 'developer_email',
        'developerEmail': 'developer_email',
        'developer_phone': 'developer_phone',
        'developerPhone': 'developer_phone',
        // Lawyer info fields (for DocuSeal signing workflows)
        'lawyer_name': 'lawyer_name',
        'lawyerName': 'lawyer_name',
        'lawyer_email': 'lawyer_email',
        'lawyerEmail': 'lawyer_email',
        'lawyer_phone': 'lawyer_phone',
        'lawyerPhone': 'lawyer_phone',
        // Estate Progress (Infrastructure milestones)
        'estate_progress': 'estate_progress',
        'estateProgressDetails': 'estate_progress', // Map wizard field
        'branch': 'branch',
        // Fee Configuration (toggles)
        'vat_enabled': 'vat_enabled',
        'vatEnabled': 'vat_enabled',
        'endowment_enabled': 'endowment_enabled',
        'endowmentEnabled': 'endowment_enabled',
        'aos_enabled': 'aos_enabled',
        'aosEnabled': 'aos_enabled',
        'aos_fee': 'aos_fee',
        'aosFee': 'aos_fee',
        'cessions_enabled': 'cessions_enabled',
        'cessionsEnabled': 'cessions_enabled',
        'cession_fee': 'cession_fee',
        'cessionFee': 'cession_fee',
        'admin_fee_enabled': 'admin_fee_enabled',
        'adminFeeEnabled': 'admin_fee_enabled',
        'admin_fee': 'admin_fee',
        'adminFee': 'admin_fee',
        'featured_tag': 'featured_tag',
        'featuredTag': 'featured_tag',
        // Map view toggle
        'disable_map_view': 'disable_map_view',
        'disableMapView': 'disable_map_view',
      };

      // Build SET clause dynamically with safe parsing
      for (const [key, value] of Object.entries(updateData)) {
        if (value !== null && value !== undefined && fieldMap[key]) {
          const dbField = fieldMap[key];

          // Handle different data types appropriately with defensive parsing
          if (['base_price', 'price_per_sqm', 'pricePerSqm', 'vat_percentage', 'endowment_fee', 'total_area_sqm', 'servicing_progress', 'deposit_percentage', 'depositPercentage', 'aos_fee', 'aosFee', 'cession_fee', 'cessionFee', 'admin_fee', 'adminFee'].includes(key)) {
            fieldsToUpdate.push(`${dbField} = $${paramCount}`);
            values.push(safeParseNumber(value, 0));
          } else if (['total_stands', 'available_stands'].includes(key)) {
            fieldsToUpdate.push(`${dbField} = $${paramCount}`);
            values.push(safeParseInt(value, 0));
          } else if (['vat_enabled', 'vatEnabled', 'endowment_enabled', 'endowmentEnabled', 'aos_enabled', 'aosEnabled', 'cessions_enabled', 'cessionsEnabled', 'admin_fee_enabled', 'adminFeeEnabled', 'has_geo_json_map', 'hasGeoJsonMap', 'disable_map_view', 'disableMapView'].includes(key)) {
            // Handle BOOLEAN columns for fee toggles
            fieldsToUpdate.push(`${dbField} = $${paramCount}`);
            values.push(Boolean(value));
          } else if (['installment_periods', 'installmentPeriods'].includes(key)) {
            // Handle INT[] columns for installment periods
            fieldsToUpdate.push(`${dbField} = $${paramCount}`);
            const periods = Array.isArray(value) ? value.map((v: any) => parseInt(v, 10)).filter((v: number) => !isNaN(v)) : [12, 24, 48];
            values.push(periods.length > 0 ? periods : [12, 24, 48]);
          } else if (['standTypes', 'stand_types', 'features', 'image_urls', 'imageUrls', 'document_urls', 'documentUrls', 'gallery'].includes(key)) {
            // Handle TEXT[] columns - pass array directly or null for empty
            fieldsToUpdate.push(`${dbField} = $${paramCount}`);
            values.push(Array.isArray(value) && value.length > 0 ? value : null);
          } else if (['standSizes', 'stand_sizes', 'commission_model', 'commissionModel', 'commission', 'geo_json_data', 'geojsonData', 'estate_progress', 'estateProgressDetails'].includes(key)) {
            // Handle JSONB columns with proper parsing to prevent double-encoding
            let jsonValue: any = value;

            // If it's a primitive number, convert to object format to prevent integer to JSONB cast error
            if (typeof value === 'number') {
              jsonValue = { "0": value };
            } else if (typeof value === 'string') {
              // If it's a string, try to parse it (handles double-encoding)
              try {
                const parsed = JSON.parse(value);
                // Check if it's still a string (double-encoded)
                if (typeof parsed === 'string') {
                  jsonValue = JSON.parse(parsed);
                  logger.warn('[FORENSIC] Detected double-encoded JSON, reparsed', {
                    module: 'API',
                    action: 'PUT_DEVELOPMENT',
                    key
                  });
                } else {
                  jsonValue = parsed;
                }
              } catch (e) {
                // It's a valid string, keep as-is
                jsonValue = value;
              }
            }

            // FORENSIC: Log before storing
            if (key === 'geo_json_data' || key === 'geojsonData') {
              logger.info('[FORENSIC] Storing geo_json_data to DB', {
                module: 'API',
                action: 'PUT_DEVELOPMENT',
                inputType: typeof value,
                finalType: typeof jsonValue,
                isFeatureCollection: jsonValue?.type === 'FeatureCollection',
                featureCount: jsonValue?.features?.length
              });
            }

            fieldsToUpdate.push(`${dbField} = $${paramCount}::jsonb`);
            // Always stringify for JSONB columns to prevent casting errors
            values.push(typeof jsonValue === 'object' ? JSON.stringify(jsonValue) : JSON.stringify(jsonValue));

            // FORENSIC: Log estate_progress updates
            if (key === 'estateProgressDetails' || key === 'estate_progress') {
              logger.debug('Updating estate_progress', { module: 'API', action: 'PUT_DEVELOPMENT', value: JSON.stringify(jsonValue) });
            }
          } else if (['featured_tag', 'featuredTag'].includes(key)) {
            // Handle featured_tag with validation
            fieldsToUpdate.push(`${dbField} = $${paramCount}`);
            values.push(safeFeaturedTag(value, 'none'));
          } else {
            fieldsToUpdate.push(`${dbField} = $${paramCount}`);
            values.push(value);
          }
          paramCount++;
        }
      }

      // Always add updated_at timestamp
      fieldsToUpdate.push(`updated_at = $${paramCount}`);
      values.push(new Date().toISOString());
      paramCount++;

      // Auto-update has_geo_json_map if geo_json_data is being updated
      if (geo_json_data && !updateData.has_geo_json_map && !updateData.hasGeoJsonMap) {
        fieldsToUpdate.push(`has_geo_json_map = $${paramCount}`);
        values.push(true);
        paramCount++;
      }

      // If no fields to update except timestamp, just return current data
      if (fieldsToUpdate.length <= 1) {
        logger.debug('No valid fields to update, checking for GeoJSON changes', { module: 'API', action: 'PUT_DEVELOPMENT' });
      }

      // Add the ID as the last parameter
      const query = `
        UPDATE developments 
        SET ${fieldsToUpdate.join(', ')}
        WHERE id = $${paramCount}
        RETURNING *;
      `;
      values.push(id);

      logger.debug('Executing update query', { module: 'API', action: 'PUT_DEVELOPMENT', fields: fieldsToUpdate });

      const result = await pool.query(query, values);

      const updated = result.rows[0];
      logger.info('Development updated successfully', {
        module: 'API',
        action: 'PUT_DEVELOPMENT',
        id: updated.id,
        name: updated.name,
        updated_at: updated.updated_at
      });

      // Handle Stand updates from GeoJSON, CSV, or Manual creation if provided
      let standResult: { created: number; updated?: number; preserved?: number; errors: string[]; warnings: string[] } = { created: 0, errors: [], warnings: [] };

      if (body.useManualStandCreation && body.standCountToCreate && body.standCountToCreate > 0) {
        // MANUAL STAND CREATION MODE
        logger.info('Using MANUAL stand creation mode', { module: 'API', action: 'PUT_DEVELOPMENT' });

        // Parse manual stand sizes from CSV string
        let sizes: number[] | undefined;
        if (body.manualStandSizes && typeof body.manualStandSizes === 'string' && body.manualStandSizes.trim()) {
          sizes = body.manualStandSizes
            .split(',')
            .map((s: string) => parseFloat(s.trim()))
            .filter((s: number) => !isNaN(s) && s > 0);
        }

        standResult = await createStandsManually(
          pool,
          id,
          body.branch || 'Harare',
          {
            count: body.standCountToCreate || 0,
            prefix: body.standNumberPrefix || '',
            startNumber: body.standNumberStart ? (typeof body.standNumberStart === 'string' ? parseInt(body.standNumberStart, 10) : body.standNumberStart) : 1,
            defaultSize: body.defaultStandSize ? (typeof body.defaultStandSize === 'string' ? parseFloat(body.defaultStandSize) : body.defaultStandSize) : 0,
            defaultPrice: body.defaultStandPrice ? (typeof body.defaultStandPrice === 'string' ? parseFloat(body.defaultStandPrice) || (body.base_price || updated.base_price || 0) : body.defaultStandPrice) : (body.base_price || updated.base_price || 0),
            sizes: sizes && sizes.length > 0 ? sizes : undefined
          }
        );
      } else if (body.parsedCsvStands && Array.isArray(body.parsedCsvStands) && body.parsedCsvStands.length > 0) {
        // CSV IMPORT MODE
        logger.info('Using CSV import mode', { module: 'API', action: 'PUT_DEVELOPMENT', standCount: body.parsedCsvStands.length });

        standResult = await createStandsFromCSV(
          pool,
          id,
          body.branch || 'Harare',
          body.parsedCsvStands,
          body.base_price || updated.base_price || 0,
          body.pricePerSqm || body.price_per_sqm || 0
        );
      } else if (geo_json_data) {
        // GEOJSON STAND CREATION MODE
        logger.debug('Processing GeoJSON for Stand updates', { module: 'API', action: 'PUT_DEVELOPMENT' });
        const branch = body.branch || 'Harare';
        const basePrice = clampMax(safeParseNumber(body.base_price || updated.base_price, 0), DB_LIMITS.price);

        // Use the helper function that preserves RESERVED/SOLD status
        const result = await createStandsFromGeoJSON(
          pool,
          id,
          branch,
          basePrice,
          geo_json_data
        );
        standResult = { ...result, updated: 0, preserved: 0 };
      } else {
        logger.info('No stand creation method specified - skipping stand creation', { module: 'API', action: 'PUT_DEVELOPMENT' });
      }

      // Update available_stands count if we created any stands
      if (standResult.created > 0) {
        const countResult = await pool.query(
          `SELECT COUNT(*) as available FROM stands WHERE development_id = $1 AND status = 'AVAILABLE'`,
          [id]
        );
        const availableCount = parseInt(countResult.rows[0]?.available || '0', 10);

        await pool.query(
          `UPDATE developments SET available_stands = $1 WHERE id = $2`,
          [availableCount, id]
        );

        logger.debug('Updated available_stands', { module: 'API', action: 'PUT_DEVELOPMENT', availableCount });
      }

      // Note: Using shared pool - do NOT call pool.end() as it's reused across requests

      const duration = Date.now() - startTime;
      logger.debug('PUT completed', { module: 'API', action: 'PUT_DEVELOPMENT', duration });

      return apiSuccess({
        ...updated,
        stands: standResult,
        duration
      });

    } catch (dbError: any) {
      // Note: Using shared pool - do NOT call pool.end() on error
      logger.error('Database query error', dbError, { module: 'API', action: 'PUT_DEVELOPMENT' });
      throw dbError;
    }

  } catch (error: any) {
    logger.error('Development update error', error, { module: 'API', action: 'PUT_DEVELOPMENT' });

    // Note: Using shared pool - do NOT call pool.end() on error

    return apiError(
      error?.message || 'Unknown error during update',
      500,
      ErrorCodes.UPDATE_ERROR,
      process.env.NODE_ENV === 'development' ? { stack: error?.stack } : undefined
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    logger.debug('DELETE /api/admin/developments called', { module: 'API' });

    // UNIFIED ADMIN AUTH: Single pattern using getServerSession with rate limiting
    const authResult = await requireAdmin(request, { limit: 10, windowMs: 60000 }); // 10 requests per minute
    if (authResult.error) {
      return authResult.error;
    }
    const user = authResult.user;
    logger.info('Admin verified for delete', { module: 'API', email: user.email, role: user.role });

    // Parse request body
    let data;
    try {
      data = await request.json();
      logger.debug('DELETE request body received', { module: 'API', action: 'DELETE_DEVELOPMENT', id: data.id });
    } catch (parseError: any) {
      logger.error('JSON parse error', parseError, { module: 'API', action: 'DELETE_DEVELOPMENT' });
      return apiError(
        'Invalid JSON',
        400,
        ErrorCodes.PARSE_ERROR,
        { details: parseError?.message }
      );
    }

    // Validate required fields
    const { id } = data;

    if (!id || typeof id !== 'string' || id.trim() === '') {
      logger.error('Invalid development ID provided', { module: 'API', action: 'DELETE_DEVELOPMENT', id });
      return apiError('Development ID is required and must be a non-empty string', 400, ErrorCodes.INVALID_ID);
    }

    // Use shared database pool for efficient connection reuse
    const pool = getDbPool();

    try {
      // First, verify the development exists and get its details
      logger.debug('Checking if development exists', { module: 'API', action: 'DELETE_DEVELOPMENT', id });
      const checkResult = await pool.query(
        'SELECT id, name, branch FROM developments WHERE id = $1',
        [id]
      );

      if (checkResult.rows.length === 0) {
        logger.warn('Development not found for deletion', { module: 'API', action: 'DELETE_DEVELOPMENT', id });
        // Note: Using shared pool - do NOT call pool.end()
        return apiError('Development not found', 404, ErrorCodes.DEVELOPMENT_NOT_FOUND);
      }

      const developmentToDelete = checkResult.rows[0];
      logger.debug('Development found for deletion', {
        module: 'API',
        action: 'DELETE_DEVELOPMENT',
        id: developmentToDelete.id,
        name: developmentToDelete.name,
        branch: developmentToDelete.branch
      });

      // Delete related stands first (if cascade not set in schema)
      // The schema shows Stand has onDelete: Cascade on development relation
      // so this is technically optional, but let's be explicit
      logger.debug('Deleting related stands for development', { module: 'API', action: 'DELETE_DEVELOPMENT', id });
      const standsResult = await pool.query(
        'DELETE FROM stands WHERE development_id = $1 RETURNING id',
        [id]
      );
      logger.debug('Deleted stands', { module: 'API', action: 'DELETE_DEVELOPMENT', count: standsResult.rows.length });

      // Delete reservations related to the stands (if needed)
      // Note: Reservations are linked via stands, so cascade should handle this

      // Delete the development itself
      logger.debug('Deleting development', { module: 'API', action: 'DELETE_DEVELOPMENT', id });
      const deleteResult = await pool.query(
        'DELETE FROM developments WHERE id = $1 RETURNING id, name, branch',
        [id]
      );

      if (deleteResult.rows.length === 0) {
        // This shouldn't happen since we verified it exists, but just in case
        logger.error('Failed to delete development', { module: 'API', action: 'DELETE_DEVELOPMENT', id });
        // Note: Using shared pool - do NOT call pool.end()
        return apiError('Failed to delete development', 500, ErrorCodes.DELETE_ERROR);
      }

      const deleted = deleteResult.rows[0];
      logger.info('Development deleted successfully', {
        module: 'API',
        action: 'DELETE_DEVELOPMENT',
        id: deleted.id,
        name: deleted.name,
        branch: deleted.branch,
        deletedBy: user?.email
      });

      // Note: Using shared pool - do NOT call pool.end() as it's reused across requests

      return apiSuccess({
        id: deleted.id,
        name: deleted.name,
        branch: deleted.branch,
        message: `Development "${deleted.name}" successfully deleted`
      });

    } catch (dbError: any) {
      // Note: Using shared pool - do NOT call pool.end() on error
      logger.error('Database query error during delete', dbError, { module: 'API', action: 'DELETE_DEVELOPMENT', developmentId: id });

      // Handle specific database errors
      if (dbError?.code === '23503') {
        // Foreign key violation
        return apiError(
          'Cannot delete development due to related records',
          409,
          ErrorCodes.CONSTRAINT_VIOLATION,
          { details: 'This development has related data that must be deleted first' }
        );
      }

      throw dbError;
    }

  } catch (error: any) {
    logger.error('Development delete error', error, { module: 'API', action: 'DELETE_DEVELOPMENT' });

    return apiError(
      error?.message || 'Unknown error during deletion',
      500,
      ErrorCodes.DELETE_ERROR,
      process.env.NODE_ENV === 'development' ? { stack: error?.stack } : undefined
    );
  }
}
// Handle CORS preflight and unsupported methods
export async function OPTIONS(request: NextRequest) {
  logger.debug('OPTIONS /api/admin/developments called', { module: 'API', action: 'OPTIONS_DEVELOPMENTS' });
  return NextResponse.json(
    {},
    {
      status: 200,
      headers: {
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      },
    }
  );
}
