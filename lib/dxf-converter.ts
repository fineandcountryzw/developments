/**
 * DXF to GeoJSON Converter
 * 
 * Converts DXF (Drawing Exchange Format) files to GeoJSON format
 * for use in the Development Wizard.
 * 
 * Supported DXF entities:
 * - LWPOLYLINE (lightweight polylines)
 * - POLYLINE
 * - CIRCLE
 * - ELLIPSE
 * - LINE
 * - ARC
 * 
 * Coordinate System Support:
 * - Assumes DXF coordinates are in local/mapping coordinate system
 * - For geographic coordinates (WGS84), provide transformation parameters
 */

import { logger } from '@/lib/logger';

// DXF Entity types that can be converted to polygons
const POLYGON_ENTITIES = ['LWPOLYLINE', 'POLYLINE', 'CIRCLE', 'ELLIPSE'];
const LINE_ENTITIES = ['LINE', 'ARC', 'LWPOLYLINE'];

export interface DXFConversionOptions {
  /**
   * Whether to close open polylines (connect first and last point)
   * @default true
   */
  closePolylines?: boolean;
  
  /**
   * Minimum area threshold (in coordinate units) to filter small features
   * @default 0
   */
  minArea?: number;
  
  /**
   * Minimum number of points for a valid polygon
   * @default 3
   */
  minPoints?: number;
  
  /**
   * Coordinate transformation: multiply X by this factor
   * @default 1
   */
  scaleX?: number;
  
  /**
   * Coordinate transformation: multiply Y by this factor
   * @default 1
   */
  scaleY?: number;
  
  /**
   * Coordinate transformation: add to X
   */
  offsetX?: number;
  
  /**
   * Coordinate transformation: add to Y
   */
  offsetY?: number;
}

export interface DXFConversionResult {
  success: boolean;
  featureCollection?: GeoJSON.FeatureCollection;
  entityCount: number;
  polygonCount: number;
  errorCount: number;
  errors: string[];
  warnings: string[];
}

export interface DXFEntity {
  type: string;
  handle?: string;
  layer?: string;
  color?: number;
  [key: string]: any;
}

/**
 * Safely parse a number, handling edge cases
 */
function safeParseNumber(value: any, defaultValue: number = 0): number {
  if (value === null || value === undefined || value === '') {
    return defaultValue;
  }
  const num = parseFloat(value);
  if (isNaN(num) || !isFinite(num)) {
    return defaultValue;
  }
  // Check for reasonable bounds (avoid overflow)
  if (num > 1e10 || num < -1e10) {
    return defaultValue;
  }
  return num;
}

/**
 * Parse a DXF file string into structured entities
 * Handles various DXF formats and line endings
 */
export function parseDXF(dxfContent: string): {
  entities: DXFEntity[];
  header: Record<string, string>;
} {
  // Normalize line endings
  const lines = dxfContent.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n');
  const entities: DXFEntity[] = [];
  const header: Record<string, string> = {};
  
  let currentSection: string | null = null;
  let currentEntity: DXFEntity | null = null;
  let lastGroupCode: string | null = null;
  let expectValue = false;
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    
    // Skip empty lines
    if (!line || line.trim() === '') {
      continue;
    }
    
    // Check for section start
    if (line === 'SECTION') {
      currentSection = null;
      expectValue = true;
      continue;
    }
    
    if (line === 'ENDSEC') {
      if (currentEntity) {
        entities.push(currentEntity);
      }
      currentSection = null;
      currentEntity = null;
      expectValue = false;
      continue;
    }
    
    // Check if this line is a group code (numeric)
    const isGroupCode = /^\d+$/.test(line.trim());
    
    if (isGroupCode && expectValue) {
      lastGroupCode = line.trim();
      expectValue = false;
      continue;
    }
    
    // If we have a group code and we're expecting a value
    if (lastGroupCode && !expectValue) {
      const groupCode = lastGroupCode;
      const value = line;
      
      // Handle section headers
      if (currentSection === null && groupCode === '2' && value === 'HEADER') {
        currentSection = 'HEADER';
        lastGroupCode = null;
        continue;
      }
      
      if (currentSection === null && groupCode === '2' && value === 'ENTITIES') {
        currentSection = 'ENTITIES';
        lastGroupCode = null;
        continue;
      }
      
      // Handle entity start
      if (groupCode === '0' && value !== 'ENDSEC') {
        if (currentEntity) {
          entities.push(currentEntity);
        }
        currentEntity = { type: value };
        lastGroupCode = null;
        continue;
      }
      
      // Parse entity attributes
      if (currentEntity && currentSection === 'ENTITIES') {
        switch (groupCode) {
          case '8':
            currentEntity.layer = value;
            break;
          case '62':
            currentEntity.color = safeParseNumber(value);
            break;
          case '5':
            currentEntity.handle = value;
            break;
          case '100':
            currentEntity.subclass = value;
            break;
          case '40':
            currentEntity.radius = safeParseNumber(value);
            break;
          case '50':
            currentEntity.angle = safeParseNumber(value);
            break;
          case '90':
            currentEntity.polyfaceMeshVertices = safeParseNumber(value, 0);
            break;
          default:
            // Handle coordinate values (group codes 10-59)
            const codeNum = parseInt(groupCode, 10);
            if (codeNum >= 10 && codeNum <= 59) {
              const coordType = codeNum >= 10 && codeNum <= 19 ? 'x' :
                               codeNum >= 20 && codeNum <= 29 ? 'y' :
                               codeNum >= 30 && codeNum <= 39 ? 'z' : null;
              if (coordType) {
                const numValue = safeParseNumber(value);
                if (!currentEntity[coordType]) {
                  currentEntity[coordType] = [];
                }
                currentEntity[coordType].push(numValue);
              }
            }
        }
        lastGroupCode = null;
      }
    }
  }
  
  // Don't forget the last entity
  if (currentEntity) {
    entities.push(currentEntity);
  }
  
  logger.info('DXF parsing complete', {
    module: 'DXFConverter',
    entityCount: entities.length,
    entityTypes: entities.reduce((acc, e) => {
      acc[e.type] = (acc[e.type] || 0) + 1;
      return acc;
    }, {} as Record<string, number>)
  });
  
  return { entities, header };
}

/**
 * Convert parsed DXF entities to GeoJSON FeatureCollection
 */
export function convertEntitiesToGeoJSON(
  entities: DXFEntity[],
  options: DXFConversionOptions = {}
): DXFConversionResult {
  const {
    closePolylines = true,
    minArea = 0,
    minPoints = 3,
    scaleX = 1,
    scaleY = 1,
    offsetX = 0,
    offsetY = 0
  } = options;
  
  const result: DXFConversionResult = {
    success: false,
    entityCount: entities.length,
    polygonCount: 0,
    errorCount: 0,
    errors: [],
    warnings: []
  };
  
  const features: GeoJSON.Feature[] = [];
  
  for (let i = 0; i < entities.length; i++) {
    const entity = entities[i];
    
    try {
      switch (entity.type) {
        case 'LWPOLYLINE':
        case 'POLYLINE':
          convertPolyline(entity, i, features, options);
          break;
        case 'CIRCLE':
          convertCircle(entity, i, features, options);
          break;
        case 'ELLIPSE':
          convertEllipse(entity, i, features, options);
          break;
        case 'LINE':
          convertLine(entity, i, features, options);
          break;
        case 'ARC':
          convertArc(entity, i, features, options);
          break;
        default:
          result.warnings.push(`Entity ${i + 1}: Unsupported type '${entity.type}'`);
      }
    } catch (error: any) {
      result.errorCount++;
      result.errors.push(`Entity ${i + 1}: ${error.message}`);
    }
  }
  
  result.polygonCount = features.length;
  result.featureCollection = {
    type: 'FeatureCollection',
    features
  };
  result.success = features.length > 0;
  
  logger.info('DXF to GeoJSON conversion complete', {
    module: 'DXFConverter',
    success: result.success,
    polygonCount: result.polygonCount,
    errorCount: result.errorCount
  });
  
  return result;
}

/**
 * Convert LWPOLYLINE to polygon
 */
function convertPolyline(
  entity: DXFEntity,
  index: number,
  features: GeoJSON.Feature[],
  options: DXFConversionOptions
): void {
  const { closePolylines = true, minPoints = 3 } = options;
  
  if (!entity.x || !entity.y || entity.x.length < 2) {
    throw new Error('Insufficient coordinates for polyline');
  }
  
  const scaleX = options.scaleX || 1;
  const scaleY = options.scaleY || 1;
  const offsetX = options.offsetX || 0;
  const offsetY = options.offsetY || 0;
  
  // Build coordinate array with safe parsing
  let coordinates: [number, number][] = entity.x.map((x: number, i: number) => {
    const safeX = safeParseNumber(x);
    const safeY = safeParseNumber(entity.y[i]);
    return [
      safeX * scaleX + offsetX,
      safeY * scaleY + offsetY
    ];
  });
  
  // Close the polyline if requested and not already closed
  if (closePolylines && coordinates.length > 0) {
    const first = coordinates[0];
    const last = coordinates[coordinates.length - 1];
    if (first[0] !== last[0] || first[1] !== last[1]) {
      coordinates.push([...first]);
    }
  }
  
  // Check minimum points
  if (coordinates.length < minPoints) {
    throw new Error(`Polyline has only ${coordinates.length} points, minimum ${minPoints} required`);
  }
  
  features.push({
    type: 'Feature',
    properties: {
      stand_number: `Stand-${index + 1}`,
      layer: entity.layer || '0',
      dxf_handle: entity.handle || `entity-${index}`,
      _dxf_type: 'LWPOLYLINE',
      _imported_from: 'dxf'
    },
    geometry: {
      type: 'Polygon',
      coordinates: [coordinates]
    }
  });
}

/**
 * Convert CIRCLE to approximate polygon (circle as 32-sided polygon)
 */
function convertCircle(
  entity: DXFEntity,
  index: number,
  features: GeoJSON.Feature[],
  options: DXFConversionOptions
): void {
  const radius = safeParseNumber(entity.radius, 1);
  
  if (radius <= 0) {
    throw new Error('Invalid circle radius');
  }
  
  const centerX = safeParseNumber(entity.x?.[0], 0) * (options.scaleX || 1) + (options.offsetX || 0);
  const centerY = safeParseNumber(entity.y?.[0], 0) * (options.scaleY || 1) + (options.offsetY || 0);
  
  // Create circle as 32-sided polygon
  const segments = 32;
  const coordinates: [number, number][] = [];
  
  for (let i = 0; i < segments; i++) {
    const angle = (i / segments) * 2 * Math.PI;
    coordinates.push([
      centerX + Math.cos(angle) * radius * (options.scaleX || 1),
      centerY + Math.sin(angle) * radius * (options.scaleY || 1)
    ]);
  }
  
  // Close the polygon
  coordinates.push([...coordinates[0]]);
  
  features.push({
    type: 'Feature',
    properties: {
      stand_number: `Stand-${index + 1}`,
      layer: entity.layer || '0',
      dxf_handle: entity.handle || `entity-${index}`,
      _dxf_type: 'CIRCLE',
      _imported_from: 'dxf'
    },
    geometry: {
      type: 'Polygon',
      coordinates: [coordinates]
    }
  });
}

/**
 * Convert ELLIPSE to approximate polygon
 */
function convertEllipse(
  entity: DXFEntity,
  index: number,
  features: GeoJSON.Feature[],
  options: DXFConversionOptions
): void {
  // Simplified ellipse conversion
  // For accurate results, consider using a proper ellipse-to-polygon algorithm
  const centerX = (entity.x?.[0] || 0) * (options.scaleX || 1) + (options.offsetX || 0);
  const centerY = (entity.y?.[0] || 0) * (options.scaleY || 1) + (options.offsetY || 0);
  
  // Major and minor axis lengths (simplified)
  const majorAxis = entity.x?.[1] ? Math.abs(entity.x[1] - centerX) * (options.scaleX || 1) : 10;
  const minorAxis = entity.y?.[1] ? Math.abs(entity.y[1] - centerY) * (options.scaleY || 1) : 5;
  
  const segments = 32;
  const coordinates: [number, number][] = [];
  
  for (let i = 0; i < segments; i++) {
    const angle = (i / segments) * 2 * Math.PI;
    coordinates.push([
      centerX + Math.cos(angle) * majorAxis,
      centerY + Math.sin(angle) * minorAxis
    ]);
  }
  
  coordinates.push([...coordinates[0]]);
  
  features.push({
    type: 'Feature',
    properties: {
      stand_number: `Stand-${index + 1}`,
      layer: entity.layer || '0',
      dxf_handle: entity.handle || `entity-${index}`,
      _dxf_type: 'ELLIPSE',
      _imported_from: 'dxf'
    },
    geometry: {
      type: 'Polygon',
      coordinates: [coordinates]
    }
  });
}

/**
 * Convert LINE to a thin polygon (line as degenerate polygon)
 */
function convertLine(
  entity: DXFEntity,
  index: number,
  features: GeoJSON.Feature[],
  options: DXFConversionOptions
): void {
  // Lines are converted as thin polygons with some width
  // This is a simplified approach - real CAD files would have line weights
  
  const width = 0.5; // Default line width for conversion
  
  if (!entity.x || entity.x.length < 2) {
    throw new Error('Line has insufficient endpoints');
  }
  
  const x1 = entity.x[0] * (options.scaleX || 1) + (options.offsetX || 0);
  const y1 = entity.y[0] * (options.scaleY || 1) + (options.offsetY || 0);
  const x2 = entity.x[1] * (options.scaleX || 1) + (options.offsetX || 0);
  const y2 = entity.y[1] * (options.scaleY || 1) + (options.offsetY || 0);
  
  // Calculate perpendicular offset
  const dx = x2 - x1;
  const dy = y2 - y1;
  const length = Math.sqrt(dx * dx + dy * dy);
  
  if (length === 0) {
    throw new Error('Line has zero length');
  }
  
  const perpX = -dy / length * width;
  const perpY = dx / length * width;
  
  const coordinates: [number, number][] = [
    [x1 + perpX, y1 + perpY],
    [x2 + perpX, y2 + perpY],
    [x2 - perpX, y2 - perpY],
    [x1 - perpX, y1 - perpY],
    [x1 + perpX, y1 + perpY]  // Close the polygon
  ];
  
  features.push({
    type: 'Feature',
    properties: {
      stand_number: `Stand-${index + 1}`,
      layer: entity.layer || '0',
      dxf_handle: entity.handle || `entity-${index}`,
      _dxf_type: 'LINE',
      _imported_from: 'dxf'
    },
    geometry: {
      type: 'Polygon',
      coordinates: [coordinates]
    }
  });
}

/**
 * Convert ARC to polygon
 */
function convertArc(
  entity: DXFEntity,
  index: number,
  features: GeoJSON.Feature[],
  options: DXFConversionOptions
): void {
  const centerX = (entity.x?.[0] || 0) * (options.scaleX || 1) + (options.offsetX || 0);
  const centerY = (entity.y?.[0] || 0) * (options.scaleY || 1) + (options.offsetY || 0);
  const radius = entity.radius || 1;
  const startAngle = entity.startAngle || 0;
  const endAngle = entity.endAngle || 360;
  
  const segments = 16;
  const coordinates: [number, number][] = [];
  
  // Convert from degrees to radians
  const startRad = (startAngle * Math.PI) / 180;
  const endRad = (endAngle * Math.PI) / 180;
  const step = (endRad - startRad) / segments;
  
  for (let i = 0; i <= segments; i++) {
    const angle = startRad + i * step;
    coordinates.push([
      centerX + Math.cos(angle) * radius * (options.scaleX || 1),
      centerY + Math.sin(angle) * radius * (options.scaleY || 1)
    ]);
  }
  
  coordinates.push([...coordinates[0]]);  // Close
  
  features.push({
    type: 'Feature',
    properties: {
      stand_number: `Stand-${index + 1}`,
      layer: entity.layer || '0',
      dxf_handle: entity.handle || `entity-${index}`,
      _dxf_type: 'ARC',
      _imported_from: 'dxf'
    },
    geometry: {
      type: 'Polygon',
      coordinates: [coordinates]
    }
  });
}

/**
 * Complete DXF to GeoJSON conversion
 * This is the main entry point for DXF conversion
 */
export function convertDXFToGeoJSON(
  dxfContent: string,
  options: DXFConversionOptions = {}
): DXFConversionResult {
  logger.info('Starting DXF to GeoJSON conversion', { module: 'DXFConverter' });
  
  try {
    const { entities, header } = parseDXF(dxfContent);
    
    if (entities.length === 0) {
      return {
        success: false,
        entityCount: 0,
        polygonCount: 0,
        errorCount: 1,
        errors: ['No entities found in DXF file'],
        warnings: []
      };
    }
    
    return convertEntitiesToGeoJSON(entities, options);
  } catch (error: any) {
    logger.error('DXF conversion failed', { module: 'DXFConverter', error: error.message });
    return {
      success: false,
      entityCount: 0,
      polygonCount: 0,
      errorCount: 1,
      errors: [error.message],
      warnings: []
    };
  }
}

/**
 * Check if a string appears to be a DXF file
 * DXF files have specific group codes and section markers
 */
export function isDXFFile(content: string): boolean {
  const trimmed = content.trim();
  
  // Normalize line endings to \n for consistent matching
  const normalized = trimmed.replace(/\r?\n/g, '\n');
  
  // Check for DXF header markers
  if (normalized.startsWith('DXF') || 
      normalized.startsWith('999\n') ||
      normalized.includes('SECTION') ||
      normalized.includes('ENTITIES')) {
    // Additional check: DXF files have group codes (numeric) followed by values
    const hasGroupCodes = /\n\d+\n/.test(normalized);
    if (hasGroupCodes) {
      return true;
    }
  }
  
  // Check for specific DXF section markers with various formats
  if (normalized.includes('0\nSECTION\n2\nHEADER') || 
      normalized.includes('0\nSECTION\n2\nENTITIES') ||
      normalized.includes('0\nSECTION\n2\nBLOCKS') ||
      normalized.includes('0\nSECTION\n2\nOBJECTS')) {
    return true;
  }
  
  // Check for entity markers (common in DXF)
  const entityCount = (normalized.match(/\n0\nLWPOLYLINE/g) || []).length +
                     (normalized.match(/\n0\nPOLYLINE/g) || []).length +
                     (normalized.match(/\n0\nCIRCLE/g) || []).length +
                     (normalized.match(/\n0\nLINE/g) || []).length +
                     (normalized.match(/\n0\nARC/g) || []).length +
                     (normalized.match(/\n0\nELLIPSE/g) || []).length;
  
  if (entityCount >= 1) {
    return true;
  }
  
  return false;
}
