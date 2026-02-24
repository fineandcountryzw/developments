# DXF File Support Guide

This document describes the DXF (Drawing Exchange Format) file support added to the Development Wizard for importing stand layouts.

## Overview

The Development Wizard now accepts both **GeoJSON** and **DXF** files for stand layout imports. DXF files are commonly used in CAD software (AutoCAD, QGIS, etc.) for architectural and engineering drawings.

## Supported DXF Entities

The following DXF entity types are automatically converted to GeoJSON polygons:

| DXF Entity | Description | Conversion Method |
|------------|-------------|-------------------|
| `LWPOLYLINE` | Lightweight Polyline | Direct polygon conversion |
| `POLYLINE` | Polyline | Direct polygon conversion |
| `CIRCLE` | Circle | Approximated as 32-sided polygon |
| `ELLIPSE` | Ellipse | Approximated as polygon |
| `LINE` | Line | Converted to thin polygon |
| `ARC` | Arc | Approximated as polygon arc |

## File Requirements

### Accepted File Types

- **GeoJSON files**: `.geojson`, `.json`
- **DXF files**: `.dxf`

### DXF File Requirements

1. **Entities must be on layers** - Each entity should have a layer name (optional but recommended)
2. **Closed polylines preferred** - LWPOLYLINE entities should be closed for best results
3. **Coordinate system** - DXF files use local/mapping coordinates. For geographic coordinates (WGS84), coordinate transformation parameters can be provided

## Usage

### Via the Wizard UI

1. Navigate to the Development Wizard
2. Click "Upload File" or drag-and-drop a file
3. Select a `.dxf` file (or `.geojson`/`.json`)
4. The file will be automatically detected and converted
5. Preview the converted stands
6. Import to create stand records

### Via API

#### Preview DXF File

```bash
POST /api/developments/:id/geojson/preview
Content-Type: application/json

{
  "geoJsonData": "<DXF file content>",
  "source": "file",
  "fileName": "stand-layout.dxf",
  "isDxf": true
}
```

#### Import DXF File

```bash
POST /api/developments/:id/geojson/import
Content-Type: application/json

{
  "geoJsonData": "<DXF file content>",
  "source": "file",
  "fileName": "stand-layout.dxf",
  "isDxf": true,
  "branch": "Harare",
  "basePrice": 0
}
```

## Coordinate Transformation

For DXF files with non-geographic coordinates, you can provide transformation parameters:

```typescript
interface DXFConversionOptions {
  // Closure settings
  closePolylines?: boolean;  // Default: true
  minArea?: number;          // Minimum polygon area filter
  minPoints?: number;         // Minimum points per polygon (default: 3)
  
  // Coordinate transformation
  scaleX?: number;            // Multiply X by this factor
  scaleY?: number;            // Multiply Y by this factor
  offsetX?: number;           // Add to X
  offsetY?: number;          // Add to Y
}
```

## Generated Properties

When converting DXF entities, the following properties are automatically generated:

| Property | Description |
|----------|-------------|
| `stand_number` | Auto-generated (e.g., "Stand-1", "Stand-2") |
| `layer` | Original DXF layer name |
| `dxf_handle` | DXF entity handle |
| `_dxf_type` | Original DXF entity type |
| `_imported_from` | Set to "dxf" |

## Limitations

1. **Complex entities** - Some complex DXF entities (SOLIDs, 3DFACE, etc.) are not supported
2. **Attribute data** - DXF attribute data is not preserved
3. **Block references** - Block inserts are not expanded
4. **Coordinate system** - Geographic transformation requires manual configuration

## Troubleshooting

### Common Issues

| Issue | Solution |
|-------|----------|
| No stands imported | Check that DXF contains LWPOLYLINE, POLYLINE, CIRCLE, or other supported entities |
| Stands have wrong shape | Verify entities are closed polylines |
| Coordinates are offset | Provide transformation parameters (scaleX, scaleY, offsetX, offsetY) |
| Circles appear as polygons | This is expected - circles are approximated as 32-sided polygons |

### Validation Warnings

The system may show warnings for:
- Non-polygon geometry types
- Polygons with fewer than 3 points
- Missing `stand_number` properties (auto-generated)

## Best Practices

1. **Prepare your DXF file**:
   - Use LWPOLYLINE entities for best results
   - Close all polylines
   - Organize stands on a single layer

2. **Validate before import**:
   - Use the preview endpoint to check conversion results
   - Verify stand numbers are assigned correctly

3. **Backup existing data**:
   - Export existing stand data before importing
   - Test with a small subset first

## Technical Details

### Conversion Process

1. **Parse DXF** - Extract entities from DXF file structure
2. **Filter entities** - Keep only supported polygon entities
3. **Convert coordinates** - Apply transformation parameters
4. **Generate polygons** - Create GeoJSON Polygon features
5. **Add properties** - Auto-generate stand numbers and metadata
6. **Validate** - Run GeoJSON validation
7. **Import** - Persist to database

### File Structure

```
lib/
  dxf-converter.ts    # DXF to GeoJSON conversion logic
components/
  GeoJSONImportPanel.tsx  # Updated import panel with DXF support
app/api/developments/[id]/
  geojson/
    preview/route.ts   # Updated with DXF support
    import/route.ts    # Updated with DXF support
```

## Revision History

| Date | Version | Changes |
|------|---------|---------|
| 2026-02-10 | 1.0 | Initial DXF support implementation |
