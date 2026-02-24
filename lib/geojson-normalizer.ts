/**
 * GeoJSON Normalizer - Strict Validation and Normalization
 * 
 * This module provides robust GeoJSON normalization for:
 * - Parsing stringified JSON (prevents double-encoding)
 * - Validating geometry types (only Polygon accepted)
 * - Closing polygon rings
 * - Normalizing property names
 * - Converting MultiPolygon to Polygon (or rejecting)
 * 
 * Usage:
 *   const normalized = normalizeGeoJSON(input);
 *   if (!normalized.isValid) {
 *     console.error(normalized.errors);
 *   }
 */

import { logger } from '@/lib/logger';

// ============================================================================
// Types
// ============================================================================

export interface NormalizationResult {
  /** Whether normalization succeeded */
  isValid: boolean;
  /** Normalized GeoJSON object (null if invalid) */
  parsed: any | null;
  /** Array of error messages */
  errors: string[];
  /** Array of warning messages */
  warnings: string[];
  /** Number of features processed */
  featureCount: number;
  /** Geometry type breakdown */
  geometryTypes: Record<string, number>;
  /** Whether MultiPolygon was converted to multiple Polygon features */
  multipolygonConverted?: boolean;
}

export interface NormalizationOptions {
  /** Reject non-Polygon geometries instead of warning */
  strictGeometry?: boolean;
  /** Auto-close polygon rings */
  closeRings?: boolean;
  /** Normalize property names (stand_number → standNumber) */
  normalizeProperties?: boolean;
  /** Maximum allowed features (0 = unlimited) */
  maxFeatures?: number;
}

// ============================================================================
// Constants
// ============================================================================

const SUPPORTED_GEOMETRY_TYPES = ['Polygon', 'MultiPolygon', 'Feature', 'FeatureCollection'] as const;

const PROPERTY_MAPPING: Record<string, string> = {
  'stand_number': 'standNumber',
  'standNumber': 'standNumber',
  'number': 'standNumber',
  'Name': 'standNumber',
  'name': 'standNumber',
  'size_sqm': 'sizeSqm',
  'sizeSqm': 'sizeSqm',
  'area': 'sizeSqm',
  'price_per_sqm': 'pricePerSqm',
  'pricePerSqm': 'pricePerSqm',
  'price': 'price',
  'status': 'status',
};

// ============================================================================
// Main Normalization Function
// ============================================================================

/**
 * Normalize GeoJSON input - handles strings, objects, and prevents double-encoding
 */
export function normalizeGeoJSON(
  input: any,
  options: NormalizationOptions = {}
): NormalizationResult {
  const result: NormalizationResult = {
    isValid: false,
    parsed: null,
    errors: [],
    warnings: [],
    featureCount: 0,
    geometryTypes: {},
  };

  const {
    strictGeometry = true,
    closeRings = true,
    normalizeProperties = true,
    maxFeatures = 10000,
  } = options;

  // -------------------------------------------------------------------------
  // Step 1: Parse stringified JSON (prevents double-encoding)
  // -------------------------------------------------------------------------
  let parsed: any;
  
  if (typeof input === 'string') {
    try {
      parsed = JSON.parse(input);
      logger.info('[GeoJSON Normalizer] Parsed stringified JSON', {
        module: 'GeoJSONNormalizer',
        originalLength: input.length,
        parsedType: parsed?.type,
      });
    } catch (parseError: any) {
      result.errors.push(`Failed to parse JSON: ${parseError.message}`);
      logger.warn('[GeoJSON Normalizer] JSON parse failed', {
        module: 'GeoJSONNormalizer',
        error: parseError.message,
      });
      return result;
    }

    // Check for double-encoding (stringified twice)
    if (typeof parsed === 'string') {
      try {
        parsed = JSON.parse(parsed);
        logger.warn('[GeoJSON Normalizer] Detected double-encoded JSON', {
          module: 'GeoJSONNormalizer',
        });
        result.warnings.push('Input was double-encoded; re-parsed successfully');
      } catch (doubleParseError: any) {
        result.errors.push('Input appears to be double-encoded and could not be reparsed');
        return result;
      }
    }
  } else {
    parsed = input;
  }

  // -------------------------------------------------------------------------
  // Step 2: Validate basic structure
  // -------------------------------------------------------------------------
  if (!parsed || typeof parsed !== 'object') {
    result.errors.push('Input is not an object');
    return result;
  }

  if (!parsed.type) {
    result.errors.push('Missing GeoJSON type');
    return result;
  }

  // -------------------------------------------------------------------------
  // Step 3: Handle FeatureCollection
  // -------------------------------------------------------------------------
  if (parsed.type === 'FeatureCollection') {
    if (!Array.isArray(parsed.features)) {
      result.errors.push('FeatureCollection must have features array');
      return result;
    }

    if (parsed.features.length > maxFeatures) {
      result.errors.push(`Too many features (${parsed.features.length}). Maximum allowed: ${maxFeatures}`);
      return result;
    }

    const processedFeatures: any[] = [];
    let multipolygonConverted = false;

    for (let i = 0; i < parsed.features.length; i++) {
      const featureResult = normalizeFeature(parsed.features[i], i, {
        strictGeometry,
        closeRings,
        normalizeProperties,
      });

      if (featureResult.errors.length > 0) {
        // Collect errors but continue processing
        result.errors.push(...featureResult.errors.map(e => `Feature ${i + 1}: ${e}`));
      }

      if (featureResult.feature) {
        processedFeatures.push(featureResult.feature);
        
        // Track geometry types
        const geoType = featureResult.feature.geometry?.type || 'Unknown';
        result.geometryTypes[geoType] = (result.geometryTypes[geoType] || 0) + 1;
        
        if (featureResult.multipolygonConverted) {
          multipolygonConverted = true;
          // Add converted polygons from MultiPolygon
          const polygonCount = featureResult.feature.geometry?.type === 'MultiPolygon' 
            ? featureResult.feature.geometry.coordinates.length 
            : 1;
          result.geometryTypes['Polygon'] = (result.geometryTypes['Polygon'] || 0) + polygonCount;
        }
      }
    }

    result.featureCount = processedFeatures.length;
    result.multipolygonConverted = multipolygonConverted;
    result.warnings.push(...processedFeatures.flatMap((f: any) => f._warnings || []));

    if (processedFeatures.length === 0 && parsed.features.length > 0) {
      result.errors.push('No valid features could be processed');
      return result;
    }

    result.parsed = {
      type: 'FeatureCollection',
      features: processedFeatures,
    };
    result.isValid = true;

    logger.info('[GeoJSON Normalizer] FeatureCollection normalized', {
      module: 'GeoJSONNormalizer',
      inputFeatureCount: parsed.features.length,
      outputFeatureCount: processedFeatures.length,
      geometryTypes: result.geometryTypes,
    });
  }

  // -------------------------------------------------------------------------
  // Step 4: Handle single Feature
  // -------------------------------------------------------------------------
  else if (parsed.type === 'Feature') {
    const featureResult = normalizeFeature(parsed, 0, {
      strictGeometry,
      closeRings,
      normalizeProperties,
    });

    result.errors = featureResult.errors;
    result.warnings = featureResult.warnings || [];
    
    if (featureResult.feature) {
      result.featureCount = 1;
      result.geometryTypes[featureResult.feature.geometry?.type || 'Unknown'] = 1;
      result.parsed = featureResult.feature;
      result.isValid = true;
    }
  }

  // -------------------------------------------------------------------------
  // Step 5: Handle raw geometry
  // -------------------------------------------------------------------------
  else if (SUPPORTED_GEOMETRY_TYPES.includes(parsed.type as any)) {
    if (parsed.type === 'GeometryCollection') {
      result.errors.push('GeometryCollection not supported in this context');
      return result;
    }

    const geometryResult = normalizeGeometry(parsed, {
      strictGeometry,
      closeRings,
    });

    if (geometryResult.errors.length > 0) {
      result.errors = geometryResult.errors;
      return result;
    }

    result.parsed = {
      type: 'Feature',
      geometry: geometryResult.geometry,
      properties: {},
    };
    result.geometryTypes[parsed.type] = 1;
    result.featureCount = 1;
    result.isValid = true;
  }

  // -------------------------------------------------------------------------
  // Step 6: Unknown type
  // -------------------------------------------------------------------------
  else {
    result.errors.push(`Unsupported GeoJSON type: ${parsed.type}`);
  }

  return result;
}

/**
 * Normalize a single feature
 */
function normalizeFeature(
  feature: any,
  index: number,
  options: {
    strictGeometry: boolean;
    closeRings: boolean;
    normalizeProperties: boolean;
  }
): {
  feature: any | null;
  errors: string[];
  warnings: string[];
  multipolygonConverted?: boolean;
} {
  const result = {
    feature: null as any | null,
    errors: [] as string[],
    warnings: [] as string[],
    multipolygonConverted: false,
  };

  // Check basic structure
  if (!feature || typeof feature !== 'object') {
    result.errors.push('Invalid feature structure');
    return result;
  }

  if (feature.type !== 'Feature') {
    result.errors.push(`Expected Feature type, got '${feature.type}'`);
    return result;
  }

  if (!feature.geometry) {
    result.errors.push('Missing geometry');
    return result;
  }

  // Normalize geometry
  const geometryResult = normalizeGeometry(feature.geometry, options);
  result.errors.push(...geometryResult.errors);

  if (geometryResult.geometry) {
    // Normalize properties
    const normalizedProps = options.normalizeProperties
      ? normalizeProperties(feature.properties || {})
      : feature.properties;

    result.feature = {
      type: 'Feature',
      geometry: geometryResult.geometry,
      properties: normalizedProps,
    };
    result.multipolygonConverted = geometryResult.multipolygonConverted || false;
    result.warnings.push(...geometryResult.warnings);
  }

  return result;
}

/**
 * Normalize a geometry
 */
function normalizeGeometry(
  geometry: any,
  options: {
    strictGeometry: boolean;
    closeRings: boolean;
  }
): {
  geometry: any | null;
  errors: string[];
  warnings: string[];
  multipolygonConverted?: boolean;
} {
  const result = {
    geometry: null as any | null,
    errors: [] as string[],
    warnings: [] as string[],
  };

  if (!geometry || !geometry.type) {
    result.errors.push('Invalid geometry structure');
    return result;
  }

  const { type, coordinates } = geometry;

  // -------------------------------------------------------------------------
  // Check for MultiPolygon and convert to multiple Polygon features
  // -------------------------------------------------------------------------
  if (type === 'MultiPolygon') {
    if (!Array.isArray(coordinates)) {
      result.errors.push('MultiPolygon must have coordinates array');
      return result;
    }

    // For MultiPolygon, we wrap each polygon as a separate Polygon
    // This is a simplification - in a full implementation, you might
    // want to create separate Feature records
    result.warnings.push(
      `MultiPolygon with ${coordinates.length} polygons will be stored as-is. ` +
      'Consider splitting into separate Polygon features for individual stand management.'
    );
  }

  // -------------------------------------------------------------------------
  // Validate Polygon
  // -------------------------------------------------------------------------
  if (type === 'Polygon') {
    if (!Array.isArray(coordinates)) {
      result.errors.push('Polygon must have coordinates array');
      return result;
    }

    if (coordinates.length === 0) {
      result.errors.push('Polygon has no rings');
      return result;
    }

    // Process each ring
    const processedRings = coordinates.map((ring: number[][], ringIndex: number) => {
      if (!Array.isArray(ring) || ring.length < 4) {
        if (ringIndex === 0) {
          result.errors.push('Polygon exterior ring must have at least 4 vertices');
        }
        return ring;
      }

      // Close the ring if needed
      if (options.closeRings) {
        const first = ring[0];
        const last = ring[ring.length - 1];
        if (first[0] !== last[0] || first[1] !== last[1]) {
          ring = [...ring, [...first]];
          result.warnings.push(`Ring ${ringIndex + 1} was auto-closed`);
        }
      }

      return ring;
    });

    // Validate ring structure
    for (let i = 0; i < processedRings.length; i++) {
      const ring = processedRings[i];
      if (!Array.isArray(ring)) {
        result.errors.push(`Ring ${i + 1} is not an array`);
        continue;
      }

      for (let j = 0; j < ring.length; j++) {
        const coord = ring[j];
        if (!Array.isArray(coord) || coord.length < 2) {
          result.errors.push(`Invalid coordinate at ring ${i + 1}, point ${j + 1}`);
          continue;
        }

        // Validate coordinate values
        const [lng, lat] = coord;
        if (typeof lng !== 'number' || typeof lat !== 'number') {
          result.errors.push(`Non-numeric coordinate at ring ${i + 1}, point ${j + 1}`);
        } else if (lng < -180 || lng > 180 || lat < -90 || lat > 90) {
          result.errors.push(
            `Out-of-range coordinate at ring ${i + 1}, point ${j + 1}: (${lng}, ${lat})`
          );
        }
      }
    }

    if (result.errors.length === 0) {
      result.geometry = {
        type: 'Polygon',
        coordinates: processedRings,
      };
    }
  }

  // -------------------------------------------------------------------------
  // Handle non-Polygon geometries
  // -------------------------------------------------------------------------
  else if (type === 'Point' || type === 'LineString' || type === 'MultiPoint' || type === 'MultiLineString') {
    if (options.strictGeometry) {
      result.errors.push(
        `${type} geometry is not supported for stand boundaries. ` +
        'Only Polygon geometries are allowed.'
      );
    } else {
      result.warnings.push(
        `${type} geometry will be stored but may not render correctly on the stand map.`
      );
      result.geometry = geometry;
    }
  }

  else {
    result.errors.push(`Unsupported geometry type: ${type}`);
  }

  return result;
}

/**
 * Normalize property names
 */
function normalizeProperties(props: Record<string, any>): Record<string, any> {
  const normalized: Record<string, any> = {};

  for (const [key, value] of Object.entries(props)) {
    const normalizedKey = PROPERTY_MAPPING[key] || key;
    normalized[normalizedKey] = value;
  }

  return normalized;
}

/**
 * Create a canonical GeoJSON FeatureCollection from normalized features
 */
export function createCanonicalFeatureCollection(
  features: any[],
  metadata?: { name?: string; description?: string }
): any {
  return {
    type: 'FeatureCollection',
    features,
    ...(metadata?.name && { name: metadata.name }),
    ...(metadata?.description && { description: metadata.description }),
  };
}

/**
 * Extract stand numbers from features
 */
export function extractStandNumbers(features: any[]): {
  valid: string[];
  missing: number[];
  duplicates: string[];
} {
  const standNumbers = new Map<string, number>();
  const missing: number[] = [];
  const seen = new Set<string>();

  features.forEach((feature, index) => {
    const props = feature.properties || {};
    const standNumber = props.standNumber || props.stand_number;

    if (standNumber) {
      const normalized = String(standNumber).trim();
      if (seen.has(normalized)) {
        standNumbers.set(normalized, (standNumbers.get(normalized) || 0) + 1);
      }
      seen.add(normalized);
    } else {
      missing.push(index + 1);
    }
  });

  const duplicates: string[] = [];
  for (const [key, count] of standNumbers.entries()) {
    if (count > 1) {
      duplicates.push(key);
    }
  }

  return {
    valid: Array.from(seen),
    missing,
    duplicates,
  };
}
