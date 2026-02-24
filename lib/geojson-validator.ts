/**
 * GeoJSON Validator - Soft Validation with Warnings
 * 
 * This module provides non-blocking validation for GeoJSON data.
 * It accepts all valid geometry types as-is without conversion.
 * 
 * Supported Geometry Types:
 * - Point
 * - MultiPoint
 * - LineString
 * - MultiLineString
 * - Polygon
 * - MultiPolygon
 * - GeometryCollection
 * 
 * Validation Rules:
 * - Soft validation: Log warnings instead of throwing errors
 * - Accept all geometry types without conversion
 * - Preserve original coordinates exactly
 * - Handle CRS metadata gracefully (read but don't reject)
 * - Auto-generate IDs for features missing stand_number
 */

import { logger } from '@/lib/logger';

// Supported GeoJSON geometry types
export const SUPPORTED_GEOMETRY_TYPES = [
  'Point',
  'MultiPoint',
  'LineString',
  'MultiLineString',
  'Polygon',
  'MultiPolygon',
  'GeometryCollection'
] as const;

export type GeometryType = typeof SUPPORTED_GEOMETRY_TYPES[number];

export interface ValidationWarning {
  featureIndex: number;
  type: 'missing_stand_number' | 'non_polygon' | 'multipart' | 'missing_properties' | 'invalid_coordinates' | 'crs_present';
  message: string;
  severity: 'info' | 'warning' | 'error';
}

export interface ValidationResult {
  isValid: boolean;
  warnings: ValidationWarning[];
  featureCount: number;
  geometryTypes: Record<string, number>;
  hasCRS: boolean;
  processedFeatures: any[];
}

/**
 * Validate a single coordinate pair [longitude, latitude]
 */
function isValidCoordinate(coord: any): boolean {
  if (!Array.isArray(coord) || coord.length < 2) return false;
  const [lng, lat] = coord;
  return (
    typeof lng === 'number' && 
    typeof lat === 'number' &&
    !isNaN(lng) && 
    !isNaN(lat) &&
    lng >= -180 && lng <= 180 &&
    lat >= -90 && lat <= 90
  );
}

/**
 * Recursively validate coordinates based on geometry type
 */
function validateCoordinates(coords: any, geometryType: string, depth: number = 0): boolean {
  if (!coords) return false;

  switch (geometryType) {
    case 'Point':
      return isValidCoordinate(coords);
    
    case 'MultiPoint':
    case 'LineString':
      return Array.isArray(coords) && coords.every(c => isValidCoordinate(c));
    
    case 'MultiLineString':
    case 'Polygon':
      return Array.isArray(coords) && coords.every(ring => 
        Array.isArray(ring) && ring.every(c => isValidCoordinate(c))
      );
    
    case 'MultiPolygon':
      return Array.isArray(coords) && coords.every(polygon =>
        Array.isArray(polygon) && polygon.every(ring =>
          Array.isArray(ring) && ring.every(c => isValidCoordinate(c))
        )
      );
    
    case 'GeometryCollection':
      // GeometryCollection doesn't have coordinates directly
      return true;
    
    default:
      return false;
  }
}

/**
 * Validate a single GeoJSON feature with soft validation
 * Returns the feature with any auto-generated properties
 */
function validateFeature(
  feature: any, 
  index: number, 
  warnings: ValidationWarning[]
): any | null {
  // Check if feature has basic structure
  if (!feature || typeof feature !== 'object') {
    warnings.push({
      featureIndex: index,
      type: 'invalid_coordinates',
      message: `Feature ${index + 1}: Invalid feature structure (not an object)`,
      severity: 'error'
    });
    return null;
  }

  // Check feature type
  if (feature.type !== 'Feature') {
    warnings.push({
      featureIndex: index,
      type: 'invalid_coordinates',
      message: `Feature ${index + 1}: Missing or invalid type (expected 'Feature')`,
      severity: 'error'
    });
    return null;
  }

  // Check geometry exists
  if (!feature.geometry) {
    warnings.push({
      featureIndex: index,
      type: 'invalid_coordinates',
      message: `Feature ${index + 1}: Missing geometry`,
      severity: 'error'
    });
    return null;
  }

  const geometry = feature.geometry;
  const geometryType = geometry.type;

  // Check geometry type is supported
  if (!SUPPORTED_GEOMETRY_TYPES.includes(geometryType)) {
    warnings.push({
      featureIndex: index,
      type: 'invalid_coordinates',
      message: `Feature ${index + 1}: Unsupported geometry type '${geometryType}'`,
      severity: 'error'
    });
    return null;
  }

  // Validate coordinates (except for GeometryCollection)
  if (geometryType !== 'GeometryCollection') {
    if (!geometry.coordinates) {
      warnings.push({
        featureIndex: index,
        type: 'invalid_coordinates',
        message: `Feature ${index + 1}: Missing coordinates`,
        severity: 'error'
      });
      return null;
    }

    if (!validateCoordinates(geometry.coordinates, geometryType)) {
      warnings.push({
        featureIndex: index,
        type: 'invalid_coordinates',
        message: `Feature ${index + 1}: Invalid coordinates for ${geometryType}`,
        severity: 'error'
      });
      return null;
    }
  }

  // Soft warnings for non-Polygon geometries
  if (geometryType !== 'Polygon') {
    warnings.push({
      featureIndex: index,
      type: 'non_polygon',
      message: `Feature ${index + 1}: Rendered as ${geometryType} (non-Polygon geometry)`,
      severity: 'info'
    });
  }

  // Soft warnings for multipart geometries
  if (geometryType.startsWith('Multi')) {
    warnings.push({
      featureIndex: index,
      type: 'multipart',
      message: `Feature ${index + 1}: ${geometryType} rendered as multiple regions`,
      severity: 'info'
    });
  }

  // Process properties
  const props = feature.properties || {};
  const processedProps = { ...props };

  // Check for stand_number and auto-generate if missing
  const standNumber = props.stand_number || props.standNumber || props.number || props.Name || props.name;
  if (!standNumber) {
    // Auto-generate a temporary internal ID
    processedProps._auto_generated_id = `auto-${index + 1}`;
    processedProps._unassigned = true;
    warnings.push({
      featureIndex: index,
      type: 'missing_stand_number',
      message: `Feature ${index + 1}: Rendered with missing stand_number (auto-generated ID: auto-${index + 1})`,
      severity: 'warning'
    });
  }

  // Check for missing optional properties
  const optionalProps = ['size_sqm', 'price', 'status'];
  const missingOptional = optionalProps.filter(p => !props[p]);
  if (missingOptional.length > 0) {
    warnings.push({
      featureIndex: index,
      type: 'missing_properties',
      message: `Feature ${index + 1}: Missing optional properties: ${missingOptional.join(', ')}`,
      severity: 'info'
    });
  }

  // Return processed feature with original geometry preserved
  return {
    ...feature,
    properties: processedProps
  };
}

/**
 * Validate a GeoJSON FeatureCollection with soft validation
 * 
 * @param geoJson - The GeoJSON data to validate
 * @returns ValidationResult with processed features and warnings
 */
export function validateGeoJSON(geoJson: any): ValidationResult {
  const warnings: ValidationWarning[] = [];
  const geometryTypes: Record<string, number> = {};
  const processedFeatures: any[] = [];
  let hasCRS = false;

  // Check basic structure
  if (!geoJson || typeof geoJson !== 'object') {
    return {
      isValid: false,
      warnings: [{
        featureIndex: -1,
        type: 'invalid_coordinates',
        message: 'Invalid GeoJSON: not an object',
        severity: 'error'
      }],
      featureCount: 0,
      geometryTypes: {},
      hasCRS: false,
      processedFeatures: []
    };
  }

  // Check for CRS metadata (read but don't reject)
  if (geoJson.crs) {
    hasCRS = true;
    warnings.push({
      featureIndex: -1,
      type: 'crs_present',
      message: 'CRS metadata present - assuming WGS84 (EPSG:4326)',
      severity: 'info'
    });
    logger.info('GeoJSON contains CRS metadata', { 
      module: 'GeoJSONValidator', 
      crs: geoJson.crs 
    });
  }

  // Handle FeatureCollection
  if (geoJson.type === 'FeatureCollection') {
    if (!Array.isArray(geoJson.features)) {
      return {
        isValid: false,
        warnings: [{
          featureIndex: -1,
          type: 'invalid_coordinates',
          message: 'Invalid FeatureCollection: features is not an array',
          severity: 'error'
        }],
        featureCount: 0,
        geometryTypes: {},
        hasCRS,
        processedFeatures: []
      };
    }

    // Validate each feature
    for (let i = 0; i < geoJson.features.length; i++) {
      const feature = geoJson.features[i];
      const processed = validateFeature(feature, i, warnings);
      
      if (processed) {
        processedFeatures.push(processed);
        const geoType = processed.geometry?.type || 'Unknown';
        geometryTypes[geoType] = (geometryTypes[geoType] || 0) + 1;
      }
    }
  }
  // Handle single Feature
  else if (geoJson.type === 'Feature') {
    const processed = validateFeature(geoJson, 0, warnings);
    if (processed) {
      processedFeatures.push(processed);
      const geoType = processed.geometry?.type || 'Unknown';
      geometryTypes[geoType] = (geometryTypes[geoType] || 0) + 1;
    }
  }
  // Handle raw geometry
  else if (SUPPORTED_GEOMETRY_TYPES.includes(geoJson.type)) {
    const wrappedFeature = {
      type: 'Feature',
      geometry: geoJson,
      properties: {}
    };
    const processed = validateFeature(wrappedFeature, 0, warnings);
    if (processed) {
      processedFeatures.push(processed);
      geometryTypes[geoJson.type] = 1;
    }
  }
  else {
    return {
      isValid: false,
      warnings: [{
        featureIndex: -1,
        type: 'invalid_coordinates',
        message: `Invalid GeoJSON type: ${geoJson.type}`,
        severity: 'error'
      }],
      featureCount: 0,
      geometryTypes: {},
      hasCRS,
      processedFeatures: []
    };
  }

  // Determine overall validity (only invalid if no features could be processed)
  const isValid = processedFeatures.length > 0;

  // Log validation summary
  logger.info('GeoJSON validation complete', {
    module: 'GeoJSONValidator',
    isValid,
    featureCount: processedFeatures.length,
    geometryTypes,
    warningCount: warnings.length,
    errorCount: warnings.filter(w => w.severity === 'error').length
  });

  return {
    isValid,
    warnings,
    featureCount: processedFeatures.length,
    geometryTypes,
    hasCRS,
    processedFeatures
  };
}

/**
 * Format validation warnings for UI display
 */
export function formatWarningsForUI(warnings: ValidationWarning[]): string[] {
  return warnings
    .filter(w => w.severity !== 'info') // Only show warnings and errors in UI
    .map(w => {
      switch (w.type) {
        case 'missing_stand_number':
          return `Feature rendered with missing stand_number`;
        case 'multipart':
          return `MultiPolygon rendered as multiple regions`;
        case 'non_polygon':
          return `Non-polygon geometry rendered`;
        case 'crs_present':
          return `CRS metadata detected - using WGS84`;
        default:
          return w.message;
      }
    });
}

/**
 * Create a validated FeatureCollection from processed features
 */
export function createValidatedFeatureCollection(
  processedFeatures: any[],
  originalMetadata?: any
): any {
  return {
    type: 'FeatureCollection',
    features: processedFeatures,
    // Preserve any original metadata except CRS (we normalize to WGS84)
    ...(originalMetadata?.name && { name: originalMetadata.name }),
    ...(originalMetadata?.description && { description: originalMetadata.description })
  };
}
