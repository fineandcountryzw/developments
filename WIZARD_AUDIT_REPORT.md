# Wizard Audit Report: Stand Numbers, Price Calculation, and Reservations

**Date:** 2026-02-10  
**Auditor:** Code Analysis  
**Status:** COMPLETE

---

## Executive Summary

The development wizard successfully handles stand numbers from GeoJSON files, with partial support for price calculation from GeoJSON properties. Reservations work correctly for all imported stands.

---

## 1. Stand Number Reading from GeoJSON

### ✅ WORKING - Full Support

#### Frontend (DevelopmentWizardV2.tsx)
- **File:** [`components/DevelopmentWizardV2.tsx:158-182`](components/DevelopmentWizardV2.tsx:158)
- **Function:** `parseGeoJSONFromText()`
- **Supported Properties:**
  - `stand_number`
  - `standNumber`

#### Backend Normalizer (geojson-normalizer.ts)
- **File:** [`lib/geojson-normalizer.ts:517-553`](lib/geojson-normalizer.ts:517)
- **Function:** `extractStandNumbers()`
- **Supported Properties:**
  - `standNumber`
  - `stand_number`

#### Property Mapping (geojson-normalizer.ts)
- **File:** [`lib/geojson-normalizer.ts:58-71`](lib/geojson-normalizer.ts:58)
- Additional aliases supported:
  - `number` → `standNumber`
  - `Name` → `standNumber`
  - `name` → `standNumber`

#### Stand Creation (createStandsFromGeoJSON)
- **File:** [`app/api/admin/developments/route.ts:352-355`](app/api/admin/developments/route.ts:352)
- **Fallback Chain:**
  1. `props.standNumber`
  2. `props.stand_number`
  3. `props.Name`
  4. `props.name`
  5. Auto-generate: `Stand-${i + 1}`

### Verification
```typescript
// From parseGeoJSONFromText (lines 173-175):
if (!feature.properties?.stand_number && !feature.properties?.standNumber) {
  warnings.push(`Feature ${index + 1}: Missing stand_number; a default will be used.`);
}
```

---

## 2. Price Calculation from GeoJSON Properties

### ⚠️ PARTIAL - Limited Support

#### Frontend Price Calculation (DevelopmentWizardV2.tsx)
- **File:** [`components/DevelopmentWizardV2.tsx:259-294`](components/DevelopmentWizardV2.tsx:259)
- **Function:** `standMetrics` useMemo
- **Current Behavior:**
  - Calculates prices as `area * pricePerSqm`
  - Does NOT read `price` from GeoJSON properties
  - Uses development-wide `pricePerSqm` setting

```typescript
// Line 280 - Price is calculated, not read from properties:
const price = area ? area * formData.pricePerSqm : null;
```

#### Backend Price Extraction (createStandsFromGeoJSON)
- **File:** [`app/api/admin/developments/route.ts:357-359`](app/api/admin/developments/route.ts:357)
- **Supported Properties:**
  - `price` - Stand total price
  - `price_per_sqm` - Price per square meter
  - `pricePerSqm` - Alternative property name

```typescript
const pricePerSqm = clampMax(safeParseNumber(props.price_per_sqm || props.pricePerSqm, 0), DB_LIMITS.pricePerSqm);
const price = clampMax(safeParseNumber(props.price, basePrice), DB_LIMITS.price);
```

#### Size Extraction
- **File:** [`app/api/admin/developments/route.ts:357`](app/api/admin/developments/route.ts:357)
- **Supported Properties:**
  - `size_sqm`
  - `sizeSqm`
  - `area`

#### Gap Identified
| Feature | Frontend | Backend |
|---------|----------|--------|
| Read price from GeoJSON | ❌ No | ✅ Yes |
| Read pricePerSqm from GeoJSON | ❌ No | ✅ Yes |
| Read size from GeoJSON | ✅ Yes | ✅ Yes |
| Calculate area-based price | ✅ Yes | ✅ Yes |

---

## 3. Reservation Flow for Imported Stands

### ✅ WORKING - Full Support

#### Reservation Creation (app/api/reservations/route.ts)
- **File:** [`app/api/reservations/route.ts:156-392`](app/api/reservations/route.ts:156)
- **Stand Linking:** Uses `standId` (UUID generated for all stands)
- **Status Check:** Validates `stand.status === 'AVAILABLE'`
- **Atomic Update:** Changes stand status to `RESERVED` within transaction

```typescript
// Line 259-268: Fetch stand by ID
const stand = await prisma.stand.findUnique({
  where: { id: standId },
  include: { development: true },
});

if (stand.status !== 'AVAILABLE') {
  return apiError('Stand is not available for reservation', 400, ...);
}
```

#### Marking Stands as Sold (Wizard Stand Actions)
- **File:** [`lib/services/wizard-stand-actions.ts`](lib/services/wizard-stand-actions.ts)
- **Valid Transitions:** `AVAILABLE` or `RESERVED` → `SOLD`
- **Includes:** Audit trail logging and email notifications

#### Reservation Endpoints
| Endpoint | Purpose |
|----------|---------|
| `POST /api/reservations` | Create reservation |
| `GET /api/admin/reservations` | List reservations (admin) |
| `PUT /api/admin/reservations` | Update reservation |
| `DELETE /api/admin/reservations` | Cancel reservation |
| `POST /api/cron/expire-reservations` | Auto-expire after 72 hours |

---

## 4. Gaps Identified

### Critical Gaps
| Gap | Impact | Location |
|-----|--------|----------|
| Frontend doesn't read GeoJSON prices | Users must re-enter prices | DevelopmentWizardV2.tsx |
| No price override UI for individual stands | Can't set per-stand prices in wizard | DevelopmentWizardV2.tsx |
| Frontend uses `pricePerSqm` for all stands | Ignores GeoJSON `price` property | DevelopmentWizardV2.tsx |

### Minor Gaps
| Gap | Impact | Location |
|-----|--------|----------|
| No validation warning when GeoJSON has prices but they're ignored | User unaware of data loss | parseGeoJSONFromText |
| Duplicate stand number detection in GeoJSON | Backend handles duplicates, frontend warns only | parseGeoJSONFromText |

---

## 5. Recommendations

### Immediate Fixes
1. **Frontend Price Reading:**
   - Modify `parseGeoJSONFromText()` to extract `price` and `pricePerSqm` from GeoJSON properties
   - Add warnings when prices are present but will be overridden

2. **Price Override UI:**
   - Add per-stand price display in the GeoJSON preview section
   - Allow users to choose: "Use GeoJSON prices" vs "Calculate from area × pricePerSqm"

### Long-term Improvements
1. **Price Validation:**
   - Add validation to warn if GeoJSON has prices but wizard is using calculated prices
   - Show price statistics in the wizard metrics section

2. **Stand Number Validation:**
   - Add real-time duplicate detection during GeoJSON parsing
   - Block upload if duplicates exist (optional configuration)

3. **Documentation:**
   - Document GeoJSON property expectations clearly
   - Add examples showing supported property names

---

## 6. Test Coverage

### Existing Tests
- **`__tests__/wizard-api.test.ts`** - Tests wizard API endpoints
- **`__tests__/wizard-stand-actions.test.ts`** - Tests mark-sold and apply-discount

### Missing Tests
- GeoJSON price parsing and validation
- Stand number duplicate detection
- Frontend price calculation vs GeoJSON price handling

---

## Conclusion

The wizard successfully imports stand numbers from GeoJSON files and reservations work correctly for all imported stands. The main gap is the frontend's lack of support for reading prices from GeoJSON properties, which forces users to recalculate prices using the development-wide `pricePerSqm` setting.

**Overall Status:** 🟡 PARTIALLY COMPLETE
- Stand Numbers: ✅ Working
- Price Calculation: ⚠️ Partial (backend works, frontend ignores GeoJSON prices)
- Reservations: ✅ Working
