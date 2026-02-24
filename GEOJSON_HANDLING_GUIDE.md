# GeoJSON Import and Rendering Guide

This document describes the GeoJSON handling rules for the development stands mapping system.

## Geometry Handling Rules

### Accepted Geometry Types

The system reads, validates, and renders geometries **exactly as provided** without forcing geometry type conversion or shape alteration.

| Type | Description | Rendering |
|------|-------------|-----------|
| `Polygon` | Single polygon shape | ✅ Standard rendering |
| `MultiPolygon` | Multiple polygon shapes | ✅ Renders as multiple regions |
| `LineString` | Single line | ✅ Renders as line |
| `MultiLineString` | Multiple lines | ✅ Renders as multiple lines |
| `Point` | Single point | ✅ Renders as marker |
| `MultiPoint` | Multiple points | ✅ Renders as multiple markers |
| `GeometryCollection` | Mixed geometry types | ✅ Renders all contained types |

### ❌ Prohibited Actions

- **No auto-conversion**: MultiPolygon will NOT be converted to Polygon
- **No coordinate mutation**: Coordinates are never simplified, smoothed, snapped, or reordered
- **No type coercion**: LineString will NOT become Polygon
- **No ring restructuring**: Outer/inner ring order is preserved

## CRS Handling

### Default Assumption
- Coordinates are assumed to be **WGS84 (EPSG:4326)** unless explicitly stated

### CRS Metadata
- If CRS metadata exists in the GeoJSON, it is **read but not rejected**
- A warning is logged: "CRS metadata present - assuming WGS84 (EPSG:4326)"
- The system does NOT fail import due to CRS presence

## Validation Logic (Non-Blocking)

### Soft Validation Approach

The system uses **soft validation** - warnings are logged instead of throwing blocking errors for:

| Condition | Severity | Behavior |
|-----------|----------|----------|
| Non-Polygon geometries | Info | Feature renders with geometry type |
| Missing optional properties | Info | Uses defaults or empty values |
| Multipart geometries | Info | Rendered as multiple regions |
| Missing stand_number | Warning | Auto-generates internal ID (`auto-N`) |

### Blocking Errors

Only these conditions block import:

1. **Malformed JSON**: Invalid JSON structure
2. **Invalid coordinates**: Numbers outside valid ranges
3. **Missing required fields**: No `type` field or `coordinates`
4. **Invalid geometry structure**: Missing required geometry components

## Property Handling

### Stand Number Generation

If `properties.stand_number` is missing:

1. The system checks fallbacks: `standNumber`, `number`, `Name`, `name`
2. If still missing, auto-generates: `auto-{featureIndex + 1}`
3. Feature is marked with `_unassigned: true` property
4. Warning is displayed in UI

### Optional Properties

These properties are optional and will use defaults if missing:

| Property | Default | Type |
|----------|---------|------|
| `size_sqm` | `0` | number |
| `price` | `basePrice` | number |
| `status` | `'AVAILABLE'` | string |
| `price_per_sqm` | Calculated | number |

## API Response Format

### GET /api/stands/geojson

```json
{
  "type": "FeatureCollection",
  "features": [...],
  "metadata": {
    "developmentId": "...",
    "loadedFrom": "database",
    "enrichedAt": "2024-01-01T00:00:00Z",
    "featureCount": 100,
    "geometryTypes": {
      "Polygon": 95,
      "MultiPolygon": 5
    },
    "hasCRS": false,
    "validation": {
      "isValid": true,
      "warningCount": 3,
      "errorCount": 0,
      "warnings": {
        "missing_stand_number": [
          "Feature 42: Rendered with missing stand_number (auto-generated ID: auto-42)"
        ],
        "multipart": [
          "Feature 42: MultiPolygon rendered as multiple regions"
        ]
      }
    }
  }
}
```

### UI Warning Display

When validation warnings are present, an amber warning banner appears in the top-right corner of the map:

```
┌─────────────────────────────────────┐
│ ⚠ GeoJSON Import Warnings          │
│ • Feature rendered with missing    │
│   stand_number                     │
│ • MultiPolygon rendered as         │
│   multiple regions                 │
└─────────────────────────────────────┘
```

## Frontend Rendering

### Map Rendering Behavior

1. **All valid geometries render**: Every feature with valid geometry is displayed
2. **Geometry-based styling**: Styling is determined by geometry type, not import acceptance
3. **Visual parity**: Source GeoJSON and rendered map should match visually
4. **Multi-region handling**: MultiPolygon features render as multiple distinct regions

### Error Feedback

| Message | Meaning |
|---------|---------|
| "Feature rendered with missing stand_number" | Auto-generated ID used |
| "MultiPolygon rendered as multiple regions" | Normal behavior for MultiPolygon |
| "Non-polygon geometry rendered" | Line/Point geometry displayed |

## Error Handling

### Non-Blocking Errors

- Single-feature issues do NOT fail the entire import
- Failed features are logged but processing continues
- Valid features from the same file still render

### Example Scenarios

```javascript
// Scenario 1: Mix of Polygon and MultiPolygon
// All features render correctly, warnings for MultiPolygon
{
  "features": [
    { "geometry": { "type": "Polygon", ... } },  // Renders
    { "geometry": { "type": "MultiPolygon", ... } }  // Renders + warning
  ]
}

// Scenario 2: Missing stand_number
// Feature renders with auto-generated ID
{
  "properties": {},  // No stand_number
  "geometry": { "type": "Polygon", ... }
}

// Scenario 3: Mixed geometry types
// All types render correctly
{
  "features": [
    { "geometry": { "type": "Point", ... } },      // Marker
    { "geometry": { "type": "LineString", ... } }, // Line
    { "geometry": { "type": "Polygon", ... } }     // Shape
  ]
}
```

## Coordinate System

### WGS84 (EPSG:4326)

GeoJSON uses longitude, latitude order:

```json
{
  "type": "Point",
  "coordinates": [longitude, latitude]
  // Example: [28.0473, -26.2041] = Johannesburg
}
```

### Valid Coordinate Ranges

| Coordinate | Minimum | Maximum |
|------------|---------|---------|
| Longitude | -180 | 180 |
| Latitude | -90 | 90 |

## Best Practices for GeoJSON Files

1. **Use consistent geometry types** throughout your file
2. **Include stand_number** in properties for better UX
3. **Validate JSON syntax** before upload
4. **Use WGS84** coordinates (default assumption)
5. **Keep coordinates precise** - don't round or simplify

## Troubleshooting

### Common Issues

| Issue | Solution |
|-------|----------|
| Map not displaying | Check browser console for errors |
| Features missing | Verify JSON is valid FeatureCollection |
| Wrong location | Confirm coordinates are [longitude, latitude] |
| Warnings appearing | Review auto-generated IDs for missing stand_number |

### Debug Logging

Enable debug logging by checking browser console for:

```
[PlotSelectorMap] Received geometry: {
  featureCount: 100,
  geometryTypes: { Polygon: 95, MultiPolygon: 5 }
}
```

## File Structure

```
lib/
├── geojson-validator.ts    # Soft validation utilities
└── logger.ts               # Logging configuration

app/api/stands/
└── geojson/route.ts        # GeoJSON API endpoint

app/api/admin/
└── developments/route.ts    # Development CRUD with GeoJSON import

components/
└── PlotSelectorMap.tsx     # Map rendering component
```
