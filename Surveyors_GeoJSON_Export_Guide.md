# Surveyors' Guide to Exporting GeoJSON Maps

This guide is specifically for surveyors who need to export GeoJSON files from their surveying software (such as AutoCAD, ArcGIS, QGIS) for use in the developmentsfc system.

## Key System Requirements

### Coordinate System
- **Required**: WGS84 (EPSG:4326) - World Geodetic System
- **Units**: Decimal degrees
- **Order**: [longitude, latitude] - important!

### GeoJSON Structure
- **Required Type**: FeatureCollection with individual Feature objects
- **Geometry Types**: Polygon (preferred), MultiPolygon, LineString, MultiLineString, Point, MultiPoint, GeometryCollection
- **Properties**: Must include `stand_number` for each feature

## Step-by-Step Export Instructions

### 1. Coordinate System Configuration

#### QGIS
```
1. Open your map layer
2. Go to Layer > Save As
3. Select Format: GeoJSON
4. Choose a location and filename
5. Under "CRS", click the CRS selector
6. Search for "EPSG:4326" or "WGS 84"
7. Select WGS 84 (EPSG:4326)
8. Under "Layer options", ensure:
   - "Write GeoJSON feature IDs" is enabled
   - "Coordinate precision" is set to at least 6 decimal places
```

#### ArcGIS Pro
```
1. Open your map
2. Go to Share > Export Map > Save As
3. Select Format: GeoJSON
4. Under "Options":
   - Spatial Reference: WGS 84 (EPSG:4326)
   - Coordinate precision: Keep at 6-8 decimal places
   - Output feature IDs: Include
```

#### AutoCAD Map 3D
```
1. Open your drawing
2. Go to Output > Map Export
3. Select Format: GeoJSON
4. In the export wizard:
   - Coordinate System: WGS 84 (EPSG:4326)
   - Precision: 0.000001 (6 decimal places)
5. Verify features have stand number properties
```

### 2. Required Properties

Each feature must include:
```json
{
  "properties": {
    "stand_number": "123",
    "size_sqm": 250,
    "price": 50000,
    "status": "AVAILABLE"
  }
}
```

#### Required Fields:
- `stand_number`: Unique identifier for each stand (required)
- `size_sqm`: Stand size in square meters (optional, default: 0)
- `price`: Stand price (optional, default: basePrice)
- `status`: Availability status (optional, default: "AVAILABLE")

### 3. Geometry Requirements

#### Polygon Features (Preferred for Stands)
```json
{
  "type": "Feature",
  "geometry": {
    "type": "Polygon",
    "coordinates": [
      [
        [28.0473, -26.2041],
        [28.0475, -26.2041],
        [28.0475, -26.2043],
        [28.0473, -26.2043],
        [28.0473, -26.2041]
      ]
    ]
  },
  "properties": {
    "stand_number": "101"
  }
}
```

**Important**: Polygon coordinates must be closed (start and end points identical).

## Validation and Testing

### Pre-Export Validation Check
```javascript
// Test if coordinates are in valid range
function isValidCoordinates(coords) {
  const [lng, lat] = coords;
  return lng >= -180 && lng <= 180 && lat >= -90 && lat <= 90;
}

// Example valid coordinates: [28.0473, -26.2041] (Johannesburg)
```

### System Validation Logic

The system will validate your GeoJSON file with the following rules:

#### Non-blocking Warnings:
- Missing `stand_number` - auto-generates temporary ID
- Non-Polygon geometry types (LineString, Point)
- MultiPolygon geometries
- CRS metadata present (system assumes WGS84)

#### Blocking Errors:
- Malformed JSON structure
- Invalid coordinates outside [-180, 180] longitude or [-90, 90] latitude
- Missing geometry or properties
- Unsupported geometry types

## Best Practices

### File Size
- Keep files under 10MB for optimal performance
- If you have many features, consider splitting into multiple files

### Precision
- Use at least 6 decimal places for coordinates
- Example: [28.047319, -26.204108] is 0.1 meter accuracy

### Naming Conventions
- Use lowercase filenames with underscores: `example_development.geojson`
- Include project name and date: `spitzkop_phase1_2024.geojson`

## Troubleshooting

### Common Issues

1. **Map not displaying**: Check coordinates are in [longitude, latitude] order
2. **Features missing**: Verify GeoJSON is valid FeatureCollection
3. **Locations incorrect**: Confirm coordinate system is WGS84 (EPSG:4326)
4. **Warnings about stand numbers**: Ensure each feature has `stand_number` property

### Validation Tools
- Use online validators like:
  - https://geojsonlint.com/
  - https://mapshaper.org/
  - https://gdal.org/programs/ogrinfo.html

### System Debugging

The system provides detailed validation feedback in the browser console:
```
[PlotSelectorMap] GeoJSON validation summary:
- Feature count: 150
- Geometry types: { Polygon: 145, MultiPolygon: 5 }
- Warnings: 3 missing stand_number
- Errors: 0
```

## Example GeoJSON File

```json
{
  "type": "FeatureCollection",
  "features": [
    {
      "type": "Feature",
      "geometry": {
        "type": "Polygon",
        "coordinates": [
          [
            [28.0473, -26.2041],
            [28.0475, -26.2041],
            [28.0475, -26.2043],
            [28.0473, -26.2043],
            [28.0473, -26.2041]
          ]
        ]
      },
      "properties": {
        "stand_number": "101",
        "size_sqm": 250,
        "price": 50000,
        "status": "AVAILABLE"
      }
    },
    {
      "type": "Feature",
      "geometry": {
        "type": "Polygon",
        "coordinates": [
          [
            [28.0475, -26.2041],
            [28.0477, -26.2041],
            [28.0477, -26.2043],
            [28.0475, -26.2043],
            [28.0475, -26.2041]
          ]
        ]
      },
      "properties": {
        "stand_number": "102",
        "size_sqm": 275,
        "price": 55000,
        "status": "SOLD"
      }
    }
  ],
  "metadata": {
    "name": "Example Development Phase 1",
    "description": "First phase of example development",
    "source": "Surveyor's Office",
    "survey_date": "2024-01-01"
  }
}
```

## Conversion Tools

### DXF to GeoJSON (QGIS)
1. Open QGIS
2. Layer > Add Layer > Add Vector Layer
3. Select your DXF file
4. Right-click layer > Save As > GeoJSON
5. Set CRS to WGS 84 (EPSG:4326)

### Shapefile to GeoJSON (GDAL)
```bash
# Install GDAL if not already installed
# Windows: choco install gdal
# macOS: brew install gdal
# Linux: apt-get install gdal-bin

# Convert shapefile to GeoJSON with WGS84 coordinate system
ogr2ogr -f GeoJSON -t_srs EPSG:4326 output.geojson input.shp
```

## Contact Information

For assistance with GeoJSON export or validation:
- System Administrator: [contact email]
- Surveyor Support: [support number]
- Documentation: [link to full API docs]

## Version History

- **v1.0** - Initial guide for basic GeoJSON export
- **v1.1** - Added detailed QGIS and ArcGIS export instructions
- **v1.2** - Added coordinate system validation rules
- **v1.3** - Updated with system's soft validation approach
