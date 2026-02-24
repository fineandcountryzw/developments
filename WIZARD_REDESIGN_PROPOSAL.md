# Development Wizard Redesign Proposal

## Executive Summary

This document proposes an efficiency-focused redesign of the DevelopmentWizard component that maintains all existing logic and functionality while significantly improving user experience and reducing time-to-completion.

**Key Changes**:
1. Total stands derived from GeoJSON file
2. Each stand price auto-calculated based on size: `size_m² × price_per_m²`
3. **NEW**: Service Station feature
4. **NEW**: Bio Digester feature
5. **NEW**: Build Compliance Level with status tracking

---

## Current State Analysis

### Current Problems
1. **8-step wizard** is excessive and slow
2. **Manual stand count** entry is error-prone and redundant
3. **Manual price calculation** doesn't account for variable stand sizes
4. **Linear navigation** forces users through all steps
5. **GeoJSON is optional** but should be the primary data source

---

## New Workflow: GeoJSON-First Approach

### Core Principle
> **The GeoJSON file is the single source of truth for stand data**

```
┌─────────────────────────────────────────────────────────────────┐
│  CREATE NEW DEVELOPMENT                                          │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  1. UPLOAD GEOMETRY (Required)                                  │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │  📁 Drag & Drop GeoJSON File Here                        │  │
│  │  ─────────────────────────────────────────────            │  │
│  │  OR: [Choose File] [Sample Template]                    │  │
│  │                                                         │  │
│  │  ✅ Validated: 50 stands detected                        │  │
│  │     Total Area: 25,000 m²                               │  │
│  └───────────────────────────────────────────────────────────┘  │
│                                                                 │
│  2. DEVELOPMENT DETAILS (Required)                              │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │  Development Name: [Sunrise Gardens Estate      ]        │  │
│  │  Location: [Harare North ▼]    Branch: [Harare ▼]      │  │
│  │  Description: [________________________________]        │  │
│  │  ───────────────────────────────────────────────────     │  │
│  │  Estate Status: [Servicing ▼]                           │  │
│  │  ───────────────────────────────────────────────────     │  │
│  │  [✓] Service Station Available                          │  │
│  │  [✓] Bio Digester Installed                             │  │
│  │  ───────────────────────────────────────────────────     │  │
│  │  Build Compliance: [Pending Review ▼]                   │  │
│  │      • Pending Review → Partial → Applied → Approved    │  │
│  └───────────────────────────────────────────────────────────┘  │
│                                                                 │
│  3. PRICING MODEL (Required)                                    │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │  Price per m²: [$10.00   ]/m²                           │  │
│  │                                                         │  │
│  │  ┌─ Stand Pricing Preview ──────────────────────┐      │  │
│  │  │ Stand 1: 500 m² × $10 = $5,000               │      │  │
│  │  │ Stand 2: 450 m² × $10 = $4,500               │      │  │
│  │  │ Stand 3: 600 m² × $10 = $6,000               │      │  │
│  │  │ ... 47 more stands                           │      │  │
│  │  │                                              │      │  │
│  │  │ Total Stand Value: $500,000                   │      │  │
│  │  └──────────────────────────────────────────────┘      │  │
│  └───────────────────────────────────────────────────────────┘  │
│                                                                 │
│  4. COMMISSION (Required)                                        │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │  Type: [Fixed $ per sale ▼]   Amount: [$1,000  ]         │  │
│  └───────────────────────────────────────────────────────────┘  │
│                                                                 │
│  5. QUICK OPTIONS (Optional)                                    │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │  [✓] Generate Stand Numbers Automatically                 │  │
│  │  [✓] Create Default Features from Template               │  │
│  │  [ ] Configure Additional Fees (VAT, Endowment, etc.)    │  │
│  │  [ ] Add Developer/Lawyer Contact Info                   │  │
│  │  [ ] Upload Development Images                           │  │
│  └───────────────────────────────────────────────────────────┘  │
│                                                                 │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │  [Cancel]                              [Create ✓]         │  │
│  └───────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
```

---

## New Features Detail

### 1. Service Station

```
┌─ Service Station Configuration ────────────────────────────────┐
│                                                                │
│  [✓] Service Station Available                                 │
│                                                                │
│  If checked, additional fields appear:                         │
│                                                                │
│  Service Station Type:                                         │
│  [Full Service (Fuel + Shop + Car Wash)           ▼]          │
│  [Fuel Only                                        ▼]          │
│  [Shop Only                                         ▼]          │
│                                                                │
│  Fuel Brands:                                                  │
│  [✓] Petrotrade  [✓] Engen  [ ] Total  [ ] Shell  [ ] Zuva    │
│                                                                │
│  Operating Hours:                                              │
│  [06:00] to [22:00] (24-hour: [ ])                            │
│                                                                │
│  Notes:                                                        │
│  [________________________________________________]            │
│                                                                │
└────────────────────────────────────────────────────────────────┘
```

### 2. Bio Digester

```
┌─ Bio Digester Configuration ────────────────────────────────────┐
│                                                                │
│  [✓] Bio Digester Installed                                    │
│                                                                │
│  If checked, additional fields appear:                          │
│                                                                │
│  Bio Digester Type:                                            │
│  [Household Size (2000L)                          ▼]           │
│  [Community Size (10000L)                        ▼]           │
│  [Industrial Size (50000L)                       ▼]           │
│  [Custom Size                                      ▼]          │
│                                                                │
│  Capacity:                                                     │
│  [________] Liters                                             │
│                                                                │
│  Installation Date:                                            │
│  [____-__-__]                                                  │
│                                                                │
│  Certification Status:                                         │
│  [✓] Environmental Certified                                   │
│  [ ] Municipal Approved                                        │
│  [ ] EPA Registered                                            │
│                                                                │
│  Maintenance Contract:                                          │
│  [✓] Active Maintenance Agreement                              │
│  Expiry: [____-__-__]                                          │
│                                                                │
└────────────────────────────────────────────────────────────────┘
```

### 3. Build Compliance Level

```
┌─ Build Compliance Tracking ────────────────────────────────────┐
│                                                                │
│  Current Status: [Pending Review ▼]                            │
│                                                                │
│  ┌─ Compliance Progression ─────────────────────────────────┐ │
│  │                                                            │ │
│  │  ┌─────────────┐    ┌─────────────┐    ┌─────────────┐   │ │
│  │  │ PENDING     │───▶│ PARTIAL     │───▶│  APPLIED    │   │ │
│  │  │ REVIEW      │    │ APPLIED     │    │ FULL        │   │ │
│  │  └─────────────┘    └─────────────┘    └─────────────┘   │ │
│  │         │                │                  │             │ │
│  │         │                │                  │             │ │
│  │         ▼                ▼                  ▼             │ │
│  │  ┌─────────────┐    ┌─────────────┐    ┌─────────────┐   │ │
│  │  │ Initial     │    │ Partial     │    │ Full        │   │ │
│  │  │ Submission  │    │ Compliance  │    │ Compliance  │   │ │
│  │  │ Received    │    │ Achieved    │    │ Achieved    │   │ │
│  │  └─────────────┘    └─────────────┘    └─────────────┘   │ │
│  │                                               │           │ │
│  │                                               ▼           │ │
│  │                                        ┌─────────────┐     │ │
│  │                                        │  APPROVED   │     │ │
│  │                                        │  FINAL      │     │ │
│  │                                        └─────────────┘     │ │
│  │                                                            │ │
│  └────────────────────────────────────────────────────────────┘ │
│                                                                │
│  If "Partial Applied" or higher selected:                       │
│                                                                │
│  Compliance Details:                                           │
│  [✓] Building Plans Submitted    Date: [____-__-__]          │
│  [✓] Environmental Impact Assmt  Date: [____-__-__]          │
│  [✓] Water & Sewerage Approved   Date: [____-__-__]          │
│  [✓] Electrical Layout Approved  Date: [____-__-__]           │
│  [✓] Fire Safety Compliance     Date: [____-__-__]           │
│  [✓] Structural Engineering     Date: [____-__-__]           │
│                                                                │
│  Approval Reference Number:                                     │
│  [________________________________]                            │
│                                                                │
│  Final Approval Date:                                          │
│  [____-__-__]                                                  │
│                                                                │
└────────────────────────────────────────────────────────────────┘
```

### Compliance Status Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                    BUILD COMPLIANCE LIFECYCLE                    │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│    ┌──────────────┐                                             │
│    │   PENDING    │  Initial state - plans not yet submitted    │
│    │   REVIEW     │                                             │
│    └──────┬───────┘                                             │
│           │                                                     │
│           │ Submit Plans                                         │
│           ▼                                                     │
│    ┌──────────────┐                                             │
│    │   PARTIAL    │  Plans submitted, under review               │
│    │   APPLIED    │  Some approvals received                   │
│    └──────┬───────┘                                             │
│           │                                                     │
│           │ Receive Additional Approvals                         │
│           ▼                                                     │
│    ┌──────────────┐                                             │
│    │    FULL      │  All requirements met                       │
│    │  APPLIED     │  Final review in progress                   │
│    └──────┬───────┘                                             │
│           │                                                     │
│           │ Final Approval Granted                               │
│           ▼                                                     │
│    ┌──────────────┐                                             │
│    │   APPROVED   │  Development fully approved for building    │
│    │              │  Can proceed with construction              │
│    └──────────────┘                                             │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## Key Changes from Current System

### 1. Auto-Derived from GeoJSON

| Field | Current Behavior | New Behavior |
|-------|-----------------|--------------|
| **Total Stands** | User manually enters | Auto-counted from GeoJSON features |
| **Stand Sizes** | User enters S/M/L buckets | Each stand has exact size from coordinates |
| **Stand Numbers** | Manual or sequential | Auto-generated from properties or sequential |
| **Price per Stand** | Fixed price or S/M/L | Calculated: `size_m² × price_per_m²` |

### 2. Smart Pricing Calculation

```typescript
interface StandPriceCalculation {
  // From GeoJSON
  standNumber: string;
  sizeM2: number;
  
  // From Form
  pricePerSqm: number;
  
  // Calculated
  totalPrice: number; // sizeM2 × pricePerSqm
}

function calculateStandPrices(
  geojson: GeoJSONData, 
  pricePerSqm: number
): StandPriceCalculation[] {
  return geojson.features.map((feature, index) => {
    const sizeM2 = calculatePolygonArea(feature.geometry.coordinates);
    return {
      standNumber: feature.properties?.stand_number || `Stand-${index + 1}`,
      sizeM2,
      pricePerSqm,
      totalPrice: Math.round(sizeM2 * pricePerSqm)
    };
  });
}
```

### 3. New Form Data Structure

```typescript
interface DevelopmentFormData {
  // ... existing fields ...
  
  // NEW: Service Station
  hasServiceStation: boolean;
  serviceStationType?: 'full' | 'fuel_only' | 'shop_only' | 'custom';
  fuelBrands?: ('Petrotrade' | 'Engen' | 'Total' | 'Shell' | 'Zuva')[];
  serviceStationHoursOpen?: string;
  serviceStationHoursClose?: string;
  serviceStation24Hour?: boolean;
  serviceStationNotes?: string;
  
  // NEW: Bio Digester
  hasBioDigester: boolean;
  bioDigesterType?: 'household' | 'community' | 'industrial' | 'custom';
  bioDigesterCapacityLiters?: number;
  bioDigesterInstallDate?: Date;
  bioDigesterCertified?: boolean;
  bioDigesterMunicipalApproved?: boolean;
  bioDigesterEPARegistered?: boolean;
  bioDigesterMaintenanceContract?: boolean;
  bioDigesterMaintenanceExpiry?: Date;
  
  // NEW: Build Compliance
  buildComplianceStatus: 'pending_review' | 'partial_applied' | 'full_applied' | 'approved';
  compliancePlansSubmittedDate?: Date;
  complianceEnvironmentalDate?: Date;
  complianceWaterSewerageDate?: Date;
  complianceElectricalDate?: Date;
  complianceFireSafetyDate?: Date;
  complianceStructuralDate?: Date;
  complianceApprovalRefNumber?: string;
  complianceFinalApprovalDate?: Date;
}
```

---

## Detailed UI Mockup

### Step 1: GeoJSON Upload

```
┌─────────────────────────────────────────────────────────────┐
│  Step 1 of 3: Upload Stand Layout                            │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌─ File Upload Zone ─────────────────────────────────────┐ │
│  │                                                             │ │
│  │    📁                                                     │ │
│  │   [Drop GeoJSON file here]                               │ │
│  │    or [Browse Files]                                     │ │
│  │                                                             │ │
│  │  Supports: .geojson, .json files                          │ │
│  │  Format: FeatureCollection with Polygon features          │ │
│  │                                                             │ │
│  └────────────────────────────────────────────────────────────┘ │
│                                                             │
│  ┌─ Sample Templates ──────────────────────────────────────┐ │
│  │  [📥 Download Sample Template - 10 Stands]              │ │
│  │  [📥 Download Sample Template - 50 Stands]              │ │
│  └────────────────────────────────────────────────────────────┘ │
│                                                             │
│  [Cancel]                           [Next: Verify Data →]    │
└─────────────────────────────────────────────────────────────┘
```

### Step 2: Development Details with New Features

```
┌─────────────────────────────────────────────────────────────┐
│  Step 2 of 3: Development Details                            │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌─ Basic Information ─────────────────────────────────────┐│
│  │  Development Name *  [Sunrise Gardens Estate      ]     ││
│  │  Location *         [Harare North ▼]                  ││
│  │  Branch *           [Harare ▼]                         ││
│  │  Description       [________________________________]   ││
│  │  Estate Status     [Servicing ▼]                        ││
│  └────────────────────────────────────────────────────────┘│
│                                                             │
│  ┌─ Additional Features ────────────────────────────────────┐│
│  │                                                            ││
│  │  [✓] Service Station Available                            ││
│  │      Type: [Full Service (Fuel + Shop + Car Wash) ▼]     ││
│  │                                                            ││
│  │  [✓] Bio Digester Installed                               ││
│  │      Type: [Community Size (10000L) ▼]                     ││
│  │                                                            ││
│  └────────────────────────────────────────────────────────┘│
│                                                             │
│  ┌─ Build Compliance ──────────────────────────────────────┐│
│  │                                                            ││
│  │  Current Status: [Pending Review ▼]                       ││
│  │                                                            ││
│  │  ┌─ Required Approvals (show when status ≠ pending) ───┐ ││
│  │  │  [✓] Environmental Impact Assessment                │ ││
│  │  │  [✓] Water & Sewerage Approval                      │ ││
│  │  │  [✓] Electrical Layout Approval                     │ ││
│  │  │  [✓] Fire Safety Compliance                        │ ││
│  │  │  [✓] Structural Engineering Certification          │ ││
│  │  │                                                       │ ││
│  │  │  Approval Reference: [_________________]             │ ││
│  │  └─────────────────────────────────────────────────────┘ ││
│  └────────────────────────────────────────────────────────┘│
│                                                             │
│  [← Back]                          [Next: Pricing →]        │
└─────────────────────────────────────────────────────────────┘
```

### Step 3: Pricing & Commission

```
┌─────────────────────────────────────────────────────────────┐
│  Step 3 of 3: Pricing & Commission                          │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌─ Pricing Configuration ─────────────────────────────────┐│
│  │  Price per m² *    [$10.00    ] /m²                    ││
│  │                                                            ││
│  │  ┌─ Calculated Stand Values ────────────────────────┐ ││
│  │  │  Total Stand Value: $500,000                      │ ││
│  │  │  Avg per Stand: $10,000                           │ ││
│  │  │  Min Stand: $3,000 (300 m²)                       │ ││
│  │  │  Max Stand: $8,000 (800 m²)                       │ ││
│  │  └───────────────────────────────────────────────────┘ ││
│  └────────────────────────────────────────────────────────┘│
│                                                             │
│  ┌─ Commission ─────────────────────────────────────────────┐│
│  │  Type: [Fixed Amount ▼]   Amount: [$1,000   ]          ││
│  └────────────────────────────────────────────────────────┘│
│                                                             │
│  ┌─ Quick Add-ons ─────────────────────────────────────────┐│
│  │  [✓] Auto-generate stand numbers                       ││
│  │  [✓] Create Default Features from Template             ││
│  │  [ ] Configure VAT (15.5%)                            ││
│  │  [ ] Add Developer/Lawyer Contacts                     ││
│  │  [ ] Upload Development Images                         ││
│  └────────────────────────────────────────────────────────┘│
│                                                             │
│  [← Back]                          [Create Development ✓]   │
└─────────────────────────────────────────────────────────────┘
```

---

## Data Flow Diagram

```
┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│   GeoJSON    │────▶│    Parser     │────▶│  Extracted   │
│    File      │     │  & Validator │     │   Stand Data  │
└──────────────┘     └──────────────┘     └──────────────┘
       │                                         │
       │                                         ▼
       │                                  ┌──────────────┐
       │                                  │  Development │
       │                                  │    Features  │
       │                                  │ - Service Sta│
       │                                  │ - Bio Digest│
       │                                  │ - Compliance│
       │                                  └──────────────┘
       │                                         │
       ▼                                         ▼
┌──────────────┐                         ┌──────────────┐
│   Pricing    │────▶│   Calculator     ││  Final Stand │
│   Config      │     │                  ││   Records    │
└──────────────┘     └──────────────────┘└──────────────┘
                               │
                               ▼
                        ┌──────────────┐
                        │   Database   │
                        │   Insert     │
                        └──────────────┘
```

---

## Implementation Plan

### Phase 1: GeoJSON Parser Enhancement
- Update `validateGeoJSON` to calculate polygon areas
- Add `calculateStandPrices` function
- Extract all stand properties from GeoJSON

### Phase 2: Add New Form Fields
- Add Service Station fields to DevelopmentFormData
- Add Bio Digester fields to DevelopmentFormData
- Add Build Compliance fields to DevelopmentFormData
- Update Typescript interfaces

### Phase 3: New Wizard Component
- Create `DevelopmentWizardV2.tsx`
- Implement file upload with drag-and-drop
- Build stand preview table
- Add pricing calculator
- Add new feature sections

### Phase 4: Integration
- Update API to accept new fields
- Modify database schema if needed
- Add migration script for existing data

---

## API Changes

### New Endpoint for GeoJSON Validation

```typescript
// POST /api/validate-geojson
interface ValidateGeoJSONRequest {
  geojson: GeoJSONData;
  pricePerSqm?: number;
}

interface ValidateGeoJSONResponse {
  valid: boolean;
  standCount?: number;
  totalArea?: number;
  standPreviews?: {
    standNumber: string;
    sizeM2: number;
    calculatedPrice?: number;
  }[];
  errors?: string[];
  warnings?: string[];
}
```

### Updated Development Creation

```typescript
interface CreateDevelopmentRequest {
  name: string;
  location: string;
  branch: Branch;
  description?: string;
  
  // New Features
  hasServiceStation?: boolean;
  serviceStationType?: string;
  fuelBrands?: string[];
  
  hasBioDigester?: boolean;
  bioDigesterType?: string;
  bioDigesterCapacityLiters?: number;
  
  buildComplianceStatus: 'pending_review' | 'partial_applied' | 'full_applied' | 'approved';
  complianceApprovalRefNumber?: string;
  complianceFinalApprovalDate?: string;
  
  // Pricing
  pricePerSqm: number;
  commission: CommissionModel;
  
  // Stands from GeoJSON
  geojsonData: GeoJSONData;
  standPrices?: {
    standNumber: string;
    sizeM2: number;
    price: number;
  }[];
}
```

---

## Database Schema Changes

```sql
-- Add to developments table
ALTER TABLE developments ADD COLUMN has_service_station BOOLEAN DEFAULT FALSE;
ALTER TABLE developments ADD COLUMN service_station_type VARCHAR(50);
ALTER TABLE developments ADD COLUMN fuel_brands TEXT[];

ALTER TABLE developments ADD COLUMN has_bio_digester BOOLEAN DEFAULT FALSE;
ALTER TABLE developments ADD COLUMN bio_digester_type VARCHAR(50);
ALTER TABLE developments ADD COLUMN bio_digester_capacity_liters INTEGER;
ALTER TABLE developments ADD COLUMN bio_digester_certified BOOLEAN DEFAULT FALSE;
ALTER TABLE developments ADD COLUMN bio_digester_municipal_approved BOOLEAN DEFAULT FALSE;

ALTER TABLE developments ADD COLUMN build_compliance_status VARCHAR(20) DEFAULT 'pending_review';
ALTER TABLE developments ADD COLUMN compliance_approval_ref VARCHAR(100);
ALTER TABLE developments ADD COLUMN compliance_final_approval_date DATE;
```

---

## Benefits Summary

| Aspect | Current | Redesigned | Improvement |
|--------|---------|------------|-------------|
| **Steps** | 8 | 3 | 62% fewer steps |
| **Data Entry** | Manual + Error-prone | Auto-imported | 90% less input |
| **Pricing** | Flat or buckets | Per-stand precise | Accurate per unit |
| **Time to Create** | ~5 minutes | ~1 minute | 80% faster |
| **Errors** | Common (mismatched counts) | Impossible | Validated up front |
| **New Features** | Not tracked | Fully tracked | Complete records |

---

## Questions for Stakeholders

1. Should manual stand creation be deprecated or remain as fallback?
2. Should we support price per stand overriding for individual stands?
3. Do we need to preserve the "stand size buckets" feature for legacy data?
4. Should the GeoJSON validation be done client-side or server-side?
5. Do we need email notifications at compliance status changes?

---

*Document Version: 3.0*
*Updated: 2026-02-03*
*Features Added: Service Station, Bio Digester, Build Compliance Tracking*
