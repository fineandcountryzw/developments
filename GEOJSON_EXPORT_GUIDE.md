# GeoJSON Export Guide for Stand Mapping
**For Surveyors, GIS Specialists, and Data Exporters**

---

## 📋 Overview

This guide helps you prepare GeoJSON files for importing stand boundaries into the Fine & Country Zimbabwe development management system. The GeoJSON file will be used to create interactive maps showing stand locations, boundaries, and availability.

---

## 🎯 What is GeoJSON?

GeoJSON is a standard format for encoding geographic data structures using JSON. It's widely supported by GIS software, mapping tools, and web applications.

**Key Points:**
- ✅ Human-readable text format
- ✅ Works with QGIS, ArcGIS, Google Earth, and most GIS tools
- ✅ Can be exported from CAD software (AutoCAD, Civil 3D)
- ✅ Can be created from shapefiles (.shp)

---

## 📐 Required GeoJSON Structure

### Root Structure (Required)

```json
{
  "type": "FeatureCollection",
  "features": [
    // Array of stand features (see below)
  ]
}
```

**Critical Requirements:**
- ✅ Root `type` must be exactly `"FeatureCollection"` (case-sensitive)
- ✅ `features` must be an array (even if only one stand)
- ✅ File must be valid JSON (proper quotes, commas, brackets)

---

## 🏗️ Feature Structure (Each Stand)

Each stand must be a `Feature` object with the following structure:

```json
{
  "type": "Feature",
  "geometry": {
    "type": "Polygon",
    "coordinates": [
      [
        [longitude1, latitude1],
        [longitude2, latitude2],
        [longitude3, latitude3],
        [longitude4, latitude4],
        [longitude1, latitude1]  // First point repeated to close polygon
      ]
    ]
  },
  "properties": {
    "stand_number": "ST001",
    "size_sqm": 800,
    "price": 45000,
    "price_per_sqm": 56.25
  }
}
```

---

## ✅ Required Fields

### 1. Feature Type
```json
"type": "Feature"
```
- **Required:** Yes
- **Value:** Must be exactly `"Feature"` (case-sensitive)
- **Error if missing:** `Feature X: type must be "Feature"`

### 2. Geometry Type
```json
"geometry": {
  "type": "Polygon"
}
```
- **Required:** Yes
- **Value:** Must be exactly `"Polygon"` (not Point, LineString, MultiPolygon)
- **Error if missing:** `Feature X: geometry must be a Polygon`

### 3. Coordinates
```json
"coordinates": [
  [
    [lng1, lat1],
    [lng2, lat2],
    [lng3, lat3],
    [lng1, lat1]  // Must close the polygon
  ]
]
```
- **Required:** Yes
- **Format:** `[longitude, latitude]` (X, Y order)
- **Coordinate System:** WGS84 (EPSG:4326) - standard GPS coordinates
- **Important:** 
  - First and last coordinate must be identical (closed polygon)
  - Minimum 4 points required (3 corners + closing point)
  - Coordinates must be in decimal degrees (e.g., `31.123456`, not `31°12'34"`)

### 4. Stand Number
```json
"properties": {
  "stand_number": "ST001"
}
```
- **Required:** Yes
- **Field Names Accepted:**
  - `stand_number` (preferred)
  - `standNumber` (alternative)
  - `Name` (fallback)
  - `name` (fallback)
- **Format:** String (text)
- **Error if missing:** `Feature X: missing properties.stand_number`
- **Uniqueness:** Must be unique within the development

---

## 📊 Optional Fields (Recommended)

These fields enhance the stand data but are not required:

### Size (Area)
```json
"properties": {
  "size_sqm": 800
}
```
- **Field Names:** `size_sqm`, `sizeSqm`, or `area`
- **Format:** Number (square meters)
- **Example:** `800` = 800 m²
- **If Missing:** Will default to `0` or calculate from polygon area

### Price
```json
"properties": {
  "price": 45000
}
```
- **Field Names:** `price`
- **Format:** Number (USD)
- **Example:** `45000` = $45,000 USD
- **If Missing:** Will use development's base price

### Price Per Square Meter
```json
"properties": {
  "price_per_sqm": 56.25
}
```
- **Field Names:** `price_per_sqm` or `pricePerSqm`
- **Format:** Number (USD per m²)
- **Example:** `56.25` = $56.25 per m²
- **If Missing:** Will calculate from `price / size_sqm` if both available

---

## 📝 Complete Example

### Single Stand Example
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
            [31.056944, -17.825556],
            [31.057222, -17.825556],
            [31.057222, -17.825833],
            [31.056944, -17.825833],
            [31.056944, -17.825556]
          ]
        ]
      },
      "properties": {
        "stand_number": "ST001",
        "size_sqm": 800,
        "price": 45000,
        "price_per_sqm": 56.25
      }
    }
  ]
}
```

### Multiple Stands Example
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
            [31.056944, -17.825556],
            [31.057222, -17.825556],
            [31.057222, -17.825833],
            [31.056944, -17.825833],
            [31.056944, -17.825556]
          ]
        ]
      },
      "properties": {
        "stand_number": "ST001",
        "size_sqm": 800,
        "price": 45000
      }
    },
    {
      "type": "Feature",
      "geometry": {
        "type": "Polygon",
        "coordinates": [
          [
            [31.057222, -17.825556],
            [31.057500, -17.825556],
            [31.057500, -17.825833],
            [31.057222, -17.825833],
            [31.057222, -17.825556]
          ]
        ]
      },
      "properties": {
        "stand_number": "ST002",
        "size_sqm": 750,
        "price": 42000
      }
    }
  ]
}
```

---

## 🔍 Validation Checklist

Before submitting your GeoJSON file, verify:

### Structure Validation
- [ ] Root `type` is exactly `"FeatureCollection"`
- [ ] `features` is an array (not an object)
- [ ] File is valid JSON (no syntax errors)
- [ ] File extension is `.geojson` or `.json`

### Feature Validation (for each feature)
- [ ] `type` is exactly `"Feature"`
- [ ] `geometry.type` is exactly `"Polygon"`
- [ ] `geometry.coordinates` is an array
- [ ] Polygon coordinates array has at least 4 points
- [ ] First and last coordinate are identical (closed polygon)
- [ ] Coordinates are in `[longitude, latitude]` format
- [ ] Coordinates are in decimal degrees (WGS84)
- [ ] `properties.stand_number` exists and is unique

### Data Quality
- [ ] Stand numbers are sequential/logical (e.g., ST001, ST002, ST003)
- [ ] No duplicate stand numbers
- [ ] Coordinates are within Zimbabwe (approximately 25°S to 18°S, 25°E to 33°E)
- [ ] Polygon boundaries don't overlap incorrectly
- [ ] Size values are realistic (typically 200-2000 m² for residential stands)

---

## ⚠️ Common Errors and Solutions

### Error: "Root must be a FeatureCollection"
**Problem:** Root type is incorrect
```json
// ❌ WRONG
{
  "type": "Feature",  // Wrong!
  "geometry": {...}
}

// ✅ CORRECT
{
  "type": "FeatureCollection",
  "features": [...]
}
```

### Error: "geometry must be a Polygon"
**Problem:** Using Point or LineString instead of Polygon
```json
// ❌ WRONG
"geometry": {
  "type": "Point",  // Wrong!
  "coordinates": [31.056944, -17.825556]
}

// ✅ CORRECT
"geometry": {
  "type": "Polygon",
  "coordinates": [[[...]]]
}
```

### Error: "missing properties.stand_number"
**Problem:** Stand number field missing or wrong name
```json
// ❌ WRONG
"properties": {
  "stand_id": "ST001",  // Wrong field name!
  "number": "ST001"     // Wrong field name!
}

// ✅ CORRECT
"properties": {
  "stand_number": "ST001"
}
```

### Error: "Invalid JSON"
**Problem:** JSON syntax errors
```json
// ❌ WRONG - Missing comma
{
  "type": "FeatureCollection"
  "features": []  // Missing comma!
}

// ❌ WRONG - Trailing comma (in some parsers)
{
  "type": "FeatureCollection",
  "features": [],  // Trailing comma may cause issues
}

// ✅ CORRECT
{
  "type": "FeatureCollection",
  "features": []
}
```

### Error: Polygon Not Closed
**Problem:** First and last coordinate don't match
```json
// ❌ WRONG
"coordinates": [
  [
    [31.056944, -17.825556],
    [31.057222, -17.825556],
    [31.057222, -17.825833],
    [31.056944, -17.825833]
    // Missing closing point!
  ]
]

// ✅ CORRECT
"coordinates": [
  [
    [31.056944, -17.825556],
    [31.057222, -17.825556],
    [31.057222, -17.825833],
    [31.056944, -17.825833],
    [31.056944, -17.825556]  // First point repeated
  ]
]
```

### Error: Wrong Coordinate Order
**Problem:** Using [latitude, longitude] instead of [longitude, latitude]
```json
// ❌ WRONG - Latitude first
"coordinates": [
  [
    [-17.825556, 31.056944],  // Wrong order!
    ...
  ]
]

// ✅ CORRECT - Longitude first
"coordinates": [
  [
    [31.056944, -17.825556],  // Longitude, then latitude
    ...
  ]
]
```

---

## 🛠️ Tools for Creating/Validating GeoJSON

### Online Validators
1. **GeoJSONLint** - https://geojsonlint.com/
   - Paste your GeoJSON and validate structure
   - Shows errors with line numbers

2. **JSONLint** - https://jsonlint.com/
   - Validates JSON syntax
   - Useful for catching syntax errors

### GIS Software Export Options

#### QGIS (Free, Recommended)
1. Open your shapefile or CAD file
2. Right-click layer → Export → Save Features As
3. Format: GeoJSON
4. CRS: EPSG:4326 (WGS84)
5. Ensure "stand_number" field exists in attribute table
6. Click OK to export

#### ArcGIS
1. Right-click layer → Data → Export Data
2. Format: GeoJSON
3. Coordinate System: WGS 1984 (EPSG:4326)
4. Export

#### AutoCAD / Civil 3D
1. Use MAPEXPORT command
2. Format: GeoJSON
3. Coordinate System: WGS84
4. Export

### Converting from Other Formats

#### Shapefile (.shp) to GeoJSON
```bash
# Using ogr2ogr (GDAL)
ogr2ogr -f GeoJSON output.geojson input.shp

# Using QGIS
Layer → Export → Save Features As → GeoJSON
```

#### KML to GeoJSON
```bash
# Using ogr2ogr
ogr2ogr -f GeoJSON output.geojson input.kml
```

#### CSV with Coordinates to GeoJSON
Use online tools like:
- https://www.gpsvisualizer.com/
- https://geojson.io/ (draw polygons manually)

---

## 📋 Pre-Submission Checklist

Before sending your GeoJSON file:

- [ ] File is valid JSON (test with JSONLint)
- [ ] File structure is FeatureCollection
- [ ] All features are type "Feature"
- [ ] All geometries are type "Polygon"
- [ ] All polygons are closed (first = last coordinate)
- [ ] All features have `stand_number` in properties
- [ ] Stand numbers are unique
- [ ] Coordinates are in [longitude, latitude] order
- [ ] Coordinates are in WGS84 (decimal degrees)
- [ ] File size is reasonable (< 10MB for typical developments)
- [ ] Tested with GeoJSONLint validator

---

## 📧 File Naming Convention

**Recommended Format:**
```
{development-name}-stands.geojson
```

**Examples:**
- `st-lucia-norton-stands.geojson`
- `borrowdale-estate-stands.geojson`
- `mount-pleasant-stands.geojson`

**Avoid:**
- Spaces in filename (use hyphens)
- Special characters (use only letters, numbers, hyphens)
- Very long names (keep under 50 characters)

---

## 💡 Best Practices

### 1. Stand Numbering
- Use consistent format: `ST001`, `ST002`, `ST003` or `A001`, `A002`, `B001`
- Avoid special characters in stand numbers
- Keep stand numbers sequential where possible

### 2. Coordinate Precision
- Use 6 decimal places for precision (~10cm accuracy)
- Example: `31.056944` (not `31.056944444444`)
- More precision is fine but not necessary

### 3. Polygon Complexity
- Keep polygon vertices reasonable (4-20 points per stand)
- Too many vertices (>100) can slow down rendering
- Too few vertices (<4) may not accurately represent boundaries

### 4. Data Completeness
- Include `size_sqm` if available (more accurate than calculated)
- Include `price` if different from development base price
- Include `price_per_sqm` if you have exact calculations

### 5. File Organization
- One GeoJSON file per development
- Don't mix multiple developments in one file
- Keep file size manageable (< 10MB)

---

## 🔄 Coordinate System Reference

### WGS84 (EPSG:4326) - Required
- **Longitude Range:** -180° to +180° (East is positive)
- **Latitude Range:** -90° to +90° (North is positive)
- **Zimbabwe Approximate Range:**
  - Longitude: 25°E to 33°E
  - Latitude: 18°S to 25°S

### Converting from Other Systems

#### From UTM (Zone 35S / 36S)
```python
# Using pyproj or similar
from pyproj import Transformer
transformer = Transformer.from_crs("EPSG:32735", "EPSG:4326")
lon, lat = transformer.transform(easting, northing)
```

#### From Local Grid
- Export from your GIS software with WGS84 target CRS
- Most GIS software handles conversion automatically

---

## 📞 Support & Questions

If you encounter issues:

1. **Validate your file** using GeoJSONLint first
2. **Check this guide** for common errors
3. **Test with a small sample** (2-3 stands) before exporting full dataset
4. **Contact:** Include your GeoJSON file and specific error message

---

## 📄 Example Template

Use this template as a starting point:

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
            [LONGITUDE1, LATITUDE1],
            [LONGITUDE2, LATITUDE2],
            [LONGITUDE3, LATITUDE3],
            [LONGITUDE4, LATITUDE4],
            [LONGITUDE1, LATITUDE1]
          ]
        ]
      },
      "properties": {
        "stand_number": "ST001",
        "size_sqm": 800,
        "price": 45000,
        "price_per_sqm": 56.25
      }
    }
  ]
}
```

**Replace:**
- `LONGITUDE1`, `LATITUDE1`, etc. with actual coordinates
- `ST001` with actual stand number
- `800`, `45000`, `56.25` with actual values (or remove if not available)

---

## ✅ Quick Reference Card

| Field | Required | Format | Example |
|-------|----------|--------|---------|
| Root `type` | ✅ Yes | String | `"FeatureCollection"` |
| `features` | ✅ Yes | Array | `[...]` |
| Feature `type` | ✅ Yes | String | `"Feature"` |
| Geometry `type` | ✅ Yes | String | `"Polygon"` |
| Coordinates | ✅ Yes | Array | `[[[lng,lat],...]]` |
| `stand_number` | ✅ Yes | String | `"ST001"` |
| `size_sqm` | ⚠️ Optional | Number | `800` |
| `price` | ⚠️ Optional | Number | `45000` |
| `price_per_sqm` | ⚠️ Optional | Number | `56.25` |

---

**Last Updated:** January 26, 2026  
**Version:** 1.0
