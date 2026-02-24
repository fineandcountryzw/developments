# GeoJSON Enrichment API Documentation

## Overview

The GeoJSON Enrichment API merges raw geometric data (stand polygons) with Neon database state (stand status, pricing, availability). This enables the PlotSelectorMap to dynamically color stands based on their current database status.

## Architecture

```
┌─────────────────────┐
│   PlotSelectorMap   │ (React Component)
│   (Browser)         │
└──────────┬──────────┘
           │ fetch('/api/stands/geojson?developmentId=xxx')
           ▼
┌─────────────────────────────────────────┐
│  GET /api/stands/geojson (Node.js)      │
│  ┌─────────────────────────────────────┐│
│  │ 1. Fetch Development with Geometry  ││
│  │ 2. Fetch all Stands from Neon       ││
│  │ 3. Loop through GeoJSON features    ││
│  │ 4. Inject stand_status into props   ││
│  │ 5. Return enriched GeoJSON          ││
│  └─────────────────────────────────────┘│
└─────────────────┬──────────────────────┘
                  │
                  ▼
        ┌──────────────────┐
        │ Neon Database    │
        │ (Prisma Client)  │
        └──────────────────┘
```

## Endpoint

### GET `/api/stands/geojson`

**Query Parameters:**
- `developmentId` (required): UUID of the development

**Response:**
```json
{
  "type": "FeatureCollection",
  "features": [
    {
      "type": "Feature",
      "geometry": { "type": "Polygon", "coordinates": [...] },
      "properties": {
        "stand_number": "ST001",
        "id": "stand-uuid",
        "status": "AVAILABLE",     // Injected from Neon
        "price": "50000",          // Injected from Neon
        "sizeSqm": "350",          // Injected from Neon
        "pricePerSqm": "142.86"    // Injected from Neon
      }
    }
  ]
}
```

## Stand Status Values

The `status` property in enriched features uses these values:

- **`AVAILABLE`** → Displayed in F&C Gold (#85754E)
- **`RESERVED`** → Displayed in Soft Grey (#D1D1D1)
- **`SOLD`** → Displayed in Burgundy (#4A0E0E)

These are mapped in `PlotSelectorMap.tsx`:

```typescript
const STATUS_COLORS: Record<StandStatus, string> = {
  'AVAILABLE': '#85754E',    // F&C Gold
  'RESERVED': '#D1D1D1',     // Soft Grey
  'SOLD': '#4A0E0E'          // Burgundy
};
```

## How It Works

### 1. **Initial Load**
PlotSelectorMap mounts and initializes the Leaflet map:
```typescript
// PlotSelectorMap.tsx
useEffect(() => {
  // Initialize map container, set center, add tile layer
  mapRef.current = L.map(container, { center, zoom, ... });
}, []);
```

### 2. **Fetch Enriched Data**
When the development ID is available, fetch enriched GeoJSON:
```typescript
useEffect(() => {
  const response = await fetch(`/api/stands/geojson?developmentId=${development.id}`);
  const enrichedGeometry = await response.json();
  // Render with L.geoJSON(enrichedGeometry, { style, onEachFeature })
}, [development.id, isMapReady]);
```

### 3. **Dynamic Styling**
Each feature is colored based on its status:
```typescript
geoLayerRef.current = L.geoJSON(enrichedGeometry, {
  style: (feature) => ({
    fillColor: STATUS_COLORS[feature?.properties?.status] || '#EFECE7',
    fillOpacity: 0.6,
    weight: 1.5,
    color: 'white'
  })
});
```

### 4. **Fallback Behavior**
If the API fails, PlotSelectorMap falls back to static geometry:
```typescript
catch (error) {
  console.error('Error fetching enriched geometry:', error);
  // Use development.geometry as fallback
  geoLayerRef.current = L.geoJSON(development.geometry, { ... });
}
```

## Server-Side Implementation

The API endpoint (`/api/stands/geojson/route.ts`) performs these steps:

### 1. **Validate Request**
```typescript
const developmentId = searchParams.get('developmentId');
if (!developmentId) return NextResponse.json({ error: '...' }, { status: 400 });
```

### 2. **Initialize Prisma with Neon Adapter**
```typescript
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaNeon(pool);
const prisma = new PrismaClient({ adapter });
```

### 3. **Fetch Development Geometry**
```typescript
const development = await prisma.development.findUnique({
  where: { id: developmentId },
  select: { id, name, geometry }
});
```

### 4. **Fetch Stand Data**
```typescript
const stands = await prisma.stand.findMany({
  where: { developmentId },
  select: { id, standNumber, status, price, sizeSqm, pricePerSqm }
});
```

### 5. **Build Stand Map**
```typescript
const standMap = new Map(
  stands.map(stand => [
    stand.standNumber,
    { id: stand.id, status: stand.status, price: stand.price, ... }
  ])
);
```

### 6. **Enrich GeoJSON Features**
```typescript
const enrichedGeometry = {
  type: 'FeatureCollection',
  features: development.geometry.features.map(feature => ({
    ...feature,
    properties: {
      ...feature.properties,
      ...(standMap.get(feature.properties.stand_number) || { status: 'AVAILABLE' })
    }
  }))
};
```

### 7. **Return with Caching Headers**
```typescript
response.headers.set('Cache-Control', 'public, max-age=300');
return NextResponse.json(enrichedGeometry);
```

## Testing

Run the test script to verify the enrichment logic:

```bash
DATABASE_URL="postgresql://..." npx tsx scripts/test-geojson-api.ts
```

Expected output:
```
🔍 Testing GeoJSON Enrichment API...

✅ Found development: Borrowdale Heights
   ID: dev-123
✅ Found 47 stands

📊 Stand Status Breakdown:
   AVAILABLE: 35
   RESERVED: 10
   SOLD: 2

✅ Enrichment successful! 47 features enriched

🚀 API endpoint ready at: /api/stands/geojson?developmentId=dev-123
```

## Performance Considerations

1. **Caching**: API responses are cached for 5 minutes (`Cache-Control: public, max-age=300`)
2. **Database Query**: Prisma uses `findMany()` with selective field selection to minimize data transfer
3. **Lazy Loading**: PlotSelectorMap only fetches GeoJSON when the map is ready (`isMapReady`)
4. **Fallback**: Static geometry is used if the API fails, ensuring UI stability

## Error Handling

The API returns appropriate HTTP status codes:

- **400**: Missing `developmentId` query parameter
- **404**: Development not found or has no geometry
- **500**: Database connection or processing error

The PlotSelectorMap catches API errors and uses static geometry as fallback.

## Future Enhancements

1. **WebSocket Updates**: Push stand status changes to connected clients
2. **Real-time Filtering**: Filter stands by status in the UI
3. **Bulk Operations**: Allow admins to update multiple stand statuses
4. **Historical Tracking**: Show stand status changes over time
5. **PDF Export**: Export map with current stand statuses as PDF
