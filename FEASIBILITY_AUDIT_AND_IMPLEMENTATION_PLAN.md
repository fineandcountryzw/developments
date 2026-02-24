# Feasibility Audit & Implementation Plan

## Executive Summary

This document outlines the feasibility analysis and implementation plan for three major features:
1. **Stand Numbers Table View** - Alongside GeoJSON map visualization
2. **Past Sales CSV Import** - Import offline sales into the ERP
3. **Offline Contract Generation** - Generate contracts for past sales

**Overall Feasibility: HIGH** - All three features are feasible with moderate to high complexity. The codebase has solid foundations in place.

---

## Module Refactoring Analysis

This section outlines all modules that will require changes for the proposed features.

### Modules Directly Affected

| Module | Changes Required | Impact |
|--------|------------------|--------|
| **Contracts Module** | Refactor generation flow, remove DocuSeal, add offline mode | HIGH |
| **Stands Module** | Add table view, enhance inventory API, map detection | HIGH |
| **Clients Module** | Add standalone stands, bulk import support | MEDIUM |
| **Billing Module** | Statement updates, offline contract linking | HIGH |
| **Payments Module** | Import handling, statement integration | MEDIUM |
| **Developments Module** | GeoJSON detection, hasMap flag | LOW |

### Modules Indirectly Affected

| Module | Changes Required | Impact |
|--------|------------------|--------|
| **Reports Module** | Offline sales metrics, revenue reporting | MEDIUM |
| **Notifications Module** | Remove DocuSeal notifications | LOW |
| **Activity Logs Module** | Offline contract activity tracking | LOW |
| **Admin Module** | Import management UI | MEDIUM |

---

## Detailed Module Refactoring Guide

### 1. CONTRACTS MODULE - Major Refactor

**Affected Files:**
```
app/api/admin/contracts/
├── generate/route.ts         # REFACTOR - Remove DocuSeal, add offline mode
├── [id]/route.ts            # REFACTOR - Remove DocuSeal endpoints
└── offline/route.ts         # NEW - Offline contract generation

app/lib/contract-template-compiler.ts  # REFACTOR - Add payment history data
app/lib/contract-data-resolver.ts     # REFACTOR - Handle offline contracts
app/lib/contract-access-control.ts    # REFACTOR - Offline contract permissions
```

**Changes:**
- Remove DocuSeal submission logic
- Add `isOffline` flag to contract creation
- Include payment history in contract data
- Simplify to: Client → Stand → Template → Generate → Download

**Database Changes:**
```prisma
model GeneratedContract {
  // REMOVE: All DocuSeal fields
  // KEEP: Basic contract fields
  // ADD: isOffline Boolean
  // ADD: offlineSaleId String?
  // ADD: contractDate DateTime?
}
```

### 2. STANDS MODULE - Enhancement

**Affected Files:**
```
app/api/stands/
├── inventory/route.ts        # REFACTOR - Add map availability flag
├── developments/route.ts     # REFACTOR - Add hasMap to response
└── geojson/route.ts          # REFACTOR - Set hasMap on import

app/dashboards/developer/stands/page.tsx  # REFACTOR - Add table view toggle
app/components/stands/
├── StandList.tsx            # REFACTOR - Conditional rendering
├── StandTableView.tsx       # NEW - Table-only component
└── DevelopmentStandMap.tsx  # MODIFY - Check hasMap
```

### 3. CLIENTS MODULE - Enhancement

**Affected Files:**
```
app/api/client/
├── route.ts                 # REFACTOR - Bulk import support
└── [id]/route.ts           # REFACTOR - Add owned stands

app/components/clients/
├── ClientProfile.tsx       # REFACTOR - Add offline contracts
└── ClientStands.tsx        # NEW - Show owned stands
```

### 4. BILLING MODULE - Enhancement

**Affected Files:**
```
app/api/financial/
├── payments/route.ts       # REFACTOR - Import handling
├── statements/route.ts     # REFACTOR - Offline contracts
└── reports/route.ts        # REFACTOR - Import metrics

app/dashboards/accounts/
├── page.tsx                 # REFACTOR - Add import section
└── statements/page.tsx     # REFACTOR - Historical contracts
```

### 5. IMPORTS MODULE - New

**New Files:**
```
app/api/admin/import/
├── past-sales/route.ts     # NEW - CSV import endpoint
└── [batchId]/route.ts     # NEW - Batch status

app/dashboards/admin/import/
├── page.tsx                # NEW - Import management
└── [batchId]/page.tsx     # NEW - Batch details

app/components/import/
├── CsvUploader.tsx         # NEW - File upload
├── PastSalesForm.tsx       # NEW - Import form
└── ImportPreview.tsx       # NEW - Row preview
```

---

## Feature 1: Stand Numbers Table View Alongside GeoJSON

### Current State Analysis

**Existing Infrastructure:**
- [`app/api/developments/[id]/geojson/import/route.ts`](app/api/developments/[id]/geojson/import/route.ts:1) - GeoJSON import functionality exists
- [`prisma/schema.prisma:115`](prisma/schema.prisma:115) - `Development.geoJsonData` Json field stores GeoJSON
- [`app/api/stands/inventory/route.ts`](app/api/stands/inventory/route.ts:1) - Stands inventory API exists
- [`app/api/stands/developments/route.ts`](app/api/stands/developments/route.ts:1) - Development listing with stand counts exists

**Current Gap:**
- No conditional rendering between map view and table view based on GeoJSON availability
- No table-only display for developments without maps

### Implementation Plan

#### Phase 1: Backend Enhancements (4 hours)

**1.1 Extend Development Model**
```typescript
// Add to prisma/schema.prisma
hasGeoJsonMap Boolean @default(false) @map("has_geo_json_map")
```

**1.2 Create Stand Table API Endpoint**
```
GET /api/developments/:id/stands/table
- Returns paginated stands list for table display
- Filters: status, search, size range, price range
- Includes client details for sold/reserved stands
```

**1.3 Update Development Fetch API**
- Add `hasMap` field to development response
- Return stand counts by status (AVAILABLE, RESERVED, SOLD)

#### Phase 2: Frontend Components (6 hours)

**2.1 Create StandTableView Component**
- Props: `developmentId`, `stands[]`, `onStandClick`
- Features:
  - Search/filter stands
  - Status badges (color-coded)
  - Pagination
  - Export to CSV

**2.2 Update DevelopmentView**
- Check `hasMap` flag
- Render MapView or StandTableView conditionally
- Add toggle switch for manual switching

**2.3 Stands Inventory Dashboard Integration**
- Update [`app/api/stands/inventory/route.ts`](app/api/stands/inventory/route.ts:1) to include map availability
- Add view mode toggle (map/table)

### Time Estimate: **10-12 hours**

---

## Feature 2: Past Sales CSV Import

### Current State Analysis

**Existing Infrastructure:**
- [`prisma/schema.prisma:398`](prisma/schema.prisma:398) - `Payment` model exists
- [`prisma/schema.prisma:368`](prisma/schema.prisma:368) - `Client` model exists
- [`prisma/schema.prisma:444`](prisma/schema.prisma:444) - `InstallmentPlan` model exists
- [`app/api/client/route.ts`](app/api/client/route.ts) - Client management API exists
- Payment processing APIs exist in `app/api/payments/`

**Current Gap:**
- No CSV import functionality for historical sales
- No bulk client creation from imports
- No offline sale transaction linking to existing billing

### Implementation Plan

#### Phase 1: Database Schema Updates (2 hours)

**1.1 Add Offline Sale Tracking**
```prisma
// Add to prisma/schema.prisma
model OfflineSale {
  id                  String   @id @default(cuid())
  clientId            String   @map("client_id")
  standId             String?  @map("stand_id")
  saleDate            DateTime @map("sale_date")
  salePrice           Decimal  @map("sale_price") @db.Decimal(12, 2)
  depositAmount       Decimal  @map("deposit_amount") @db.Decimal(12, 2)
  paymentMethod       String   @map("payment_method")
  referenceNumber     String?  @map("reference_number")
  notes               String?
  importBatchId       String?  @map("import_batch_id")
  createdAt           DateTime @default(now()) @map("created_at")
  
  @@index([clientId])
  @@index([saleDate])
}
```

**1.2 Add Import Batch Tracking**
```prisma
model ImportBatch {
  id            String   @id @default(cuid())
  fileName      String   @map("file_name")
  importType    String   @map("import_type") // 'past_sales', 'clients', 'payments'
  status        String   @default("PENDING") // PENDING, PROCESSING, COMPLETED, FAILED
  totalRecords  Int      @default(0) @map("total_records")
  processedRecords Int   @default(0) @map("processed_records")
  failedRecords Int      @default(0) @map("failed_records")
  errorLog      Json?    @map("error_log")
  importedBy    String   @map("imported_by")
  createdAt     DateTime @default(now()) @map("created_at")
  completedAt   DateTime? @map("completed_at")
}
```

#### Phase 2: CSV Import API (6 hours)

**2.1 Create Import API Endpoint**
```
POST /api/admin/import/past-sales
- Accepts: multipart/form-data (CSV file)
- Validates: client details, payment dates, amounts
- Creates: Client records, Payments, InstallmentPlans, OfflineSale records
```

**2.2 CSV Parser Service**
```typescript
// Required CSV Columns:
interface PastSaleCSVRow {
  clientName: string;
  clientEmail: string;
  clientPhone: string;
  clientNationalId?: string;
  standNumber: string;
  developmentName: string;
  saleDate: Date;
  salePrice: number;
  depositAmount: number;
  paymentMethod: string;
  referenceNumber?: string;
  installmentsPaid?: number;
  notes?: string;
}
```

**2.3 Import Logic Flow**
1. Parse CSV file
2. Validate all rows
3. Create/find clients by email
4. Create/find stands by number + development
5. Create Payment records
6. Create InstallmentPlan records
7. Update Stand status to SOLD
8. Create OfflineSale record
9. Generate receipts
10. Update Client statements

#### Phase 3: Frontend Import UI (4 hours)

**3.1 Create Import Page**
- File upload component
- CSV template download
- Preview table (first 10 rows)
- Progress indicator
- Error reporting

**3.2 Import History Dashboard**
- List all import batches
- Show status and error counts
- Allow retry of failed imports

### Time Estimate: **12-16 hours**

---

## Dashboard Updates Required

### Billing Dashboard Updates

The Billing Dashboard will need updates to reflect imported past sales and offline contracts:

**1. Revenue Reporting Enhancements**
- Filter option: "Include Offline Sales"
- Separate reporting for imported vs. online sales
- Historical sale date filtering

**2. Accounts Receivable Updates**
- Include offline contracts in aging reports
- Show contract date alongside payment dates
- Mark imported payments with source indicator

**3. Client Statements**
- Offline contract display with historical dates
- Imported payment history
- Link to OfflineSale records

**4. Payment Verification Queue**
- Auto-verify imported payments (skip verification step)
- Mark as "Imported - Pre-verified"

### Developer Dashboard Updates

The Developer Dashboard will need updates for stand inventory management:

**1. Development Overview**
- Show table view toggle for developments without maps
- Display stand counts by status
- Development health indicators

**2. Stand Management**
- Table view for stand inventory (where no GeoJSON exists)
- Bulk operations: export, status update
- Stand search and filtering

**3. Sales Analytics**
- Include imported sales in revenue metrics
- Offline contract counts
- Historical sales reporting

**4. Import Management**
- View past sales import history
- Retry failed imports
- Import batch status tracking

---

## Feature 3: Offline Contract Generation (Simplified)

### Requirement Change
**Remove DocuSeal e-signature integration** - Contracts are now offline/generation only.

### Simplified Workflow:
1. Select Client (by name/email)
2. Select Stand (by number or from client's owned stands)
3. Select Template
4. Generate Contract with:
   - Client details
   - Stand details
   - Payment history (all payments already made)
   - Balance information
5. Download PDF directly (no e-signature flow)

### Implementation Plan

#### Phase 1: Backend Extensions (6 hours)

**1.1 Simplify Contract Generation API**
```
POST /api/admin/contracts/offline-generate

Request Body:
{
  clientId: string;
  standId: string;
  templateId: string;
}

Flow:
1. Fetch client with all payment history
2. Fetch stand details
3. Fetch all payments for this stand/client
4. Calculate totals: deposit paid, balance remaining
5. Generate contract with payment summary
6. Return PDF download URL
```

**1.2 Payment History in Contract Data**
```typescript
interface ContractPaymentSummary {
  totalSalePrice: number;
  depositPaid: number;
  balanceRemaining: number;
  payments: {
    date: Date;
    amount: number;
    method: string;
    reference: string;
  }[];
  installmentStatus: string;
}
```

**1.3 Remove DocuSeal Fields**
```prisma
// Remove from GeneratedContract model:
// - docusealSubmissionId
// - docusealStatus
// - docusealSignerClientId
// - docusealSignerClientStatus
// - docusealSignerDevId
// - docusealSignerDevStatus
// - signedPdfUrl
// - sentForSignatureAt
// - fullySignedAt

// Keep simple fields:
isOffline          Boolean @default(false) @map("is_offline")
offlineSaleId      String? @map("offline_sale_id")
contractDate       DateTime @map("contract_date")
```

**1.4 PDF Generation**
- Generate PDF locally using puppeteer or similar
- Include payment history table in contract
- Direct download, no email sending

#### Phase 2: Frontend (4 hours)

**2.1 Offline Contract Form**
- Client search with autocomplete
- Stand selector (filtered by client's stands)
- Template dropdown
- Generate button
- PDF download

**2.2 Client Stand Link**
- Show client's stands in selection
- Quick pick from owned stands

#### Phase 3: Integration (2 hours)

**3.1 Client Statements**
- Show generated offline contracts
- Link to PDF download

### Time Estimate: **10-14 hours** (reduced from 18-22h)

---

## Additional Task: DocuSeal Removal

### Current State
DocuSeal e-signature integration exists in:
- `GeneratedContract` model (multiple fields)
- `app/api/admin/contracts/generate/route.ts`
- Frontend contract pages

### Removal Plan

**Backend (2 hours)**
- Remove DocuSeal fields from `GeneratedContract` model
- Remove DocuSeal API calls from contract generation
- Remove DocuSeal status checks
- Keep contract generation flow (simplified)

**Frontend (2 hours)**
- Remove "Send for Signature" button
- Remove DocuSeal status displays
- Remove signer management UI
- Add direct PDF download button

**Database Migration**
```sql
ALTER TABLE generated_contracts 
DROP COLUMN IF EXISTS docuseal_submission_id,
DROP COLUMN IF EXISTS docuseal_status,
DROP COLUMN IF EXISTS docuseal_signer_client_id,
DROP COLUMN IF EXISTS docuseal_signer_client_status,
DROP COLUMN IF EXISTS docuseal_signer_dev_id,
DROP COLUMN IF EXISTS docuseal_signer_dev_status,
DROP COLUMN IF EXISTS signed_pdf_url,
DROP COLUMN IF EXISTS sent_for_signature_at,
DROP COLUMN IF EXISTS fully_signed_at;
```

### Time Estimate: **4 hours**

---

## Implementation Timeline

| Feature | Phase | Hours | Total |
|---------|-------|-------|-------|
| **Stand Table View** | Backend | 4h | |
| | Frontend | 6h | **10-12h** |
| **Past Sales Import** | Schema | 2h | |
| | API | 6h | |
| | Frontend | 4h | **12-16h** |
| **Offline Contracts** | Backend | 8h | |
| | Frontend | 6h | |
| | Integration | 4h | **18-22h** |
| **TOTAL** | | | **40-50 hours** |

### Recommended Phasing

**Phase 1 (Week 1): Stand Table View**
- 10-12 hours
- Delivers immediate value for developments without maps
- Developer Dashboard updates included

**Phase 2 (Week 2): Past Sales Import**
- 12-16 hours
- Enables bulk migration of historical sales
- Billing Dashboard updates included

**Phase 3 (Week 3): Offline Contracts (Simplified)**
- 10-14 hours
- Simplified: no DocuSeal, includes payment history
- Direct PDF generation and download

---

## Updated Time Estimates (Including Dashboard Updates)

| Feature | Backend | Frontend | Dashboards | Total |
|---------|---------|----------|------------|-------|
| **Stand Table View** | 4h | 6h | 2h (Developer) | **12-14h** |
| **Past Sales Import** | 8h | 4h | 4h (Billing) | **16-20h** |
| **Offline Contracts** | 6h | 4h | 2h (Billing) | **12-16h** |
| **DocuSeal Cleanup** | 2h | 2h | 0h | **4h** |
| **TOTAL** | 20h | 16h | 8h | **44-54 hours**

---

## Technical Dependencies

### External Services
- **DocuSeal API** - Existing integration for e-signatures
- **UploadThing** - Existing file upload infrastructure

### Database
- **PostgreSQL** - All models already defined
- **Prisma ORM** - Already in use

### Frontend
- **React/Next.js** - Existing codebase
- **Tailwind CSS** - Existing styling
- **TanStack Table** - Recommend for table components

---

## Risk Assessment

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| CSV format variations | Medium | Medium | Template download + validation |
| Missing client data | Medium | Low | Allow manual entry during import |
| Historical pricing conflicts | Low | High | Use provided sale price, not current |
| Contract template compatibility | Low | High | Template validation before generation |
| Performance with large imports | Low | Medium | Batch processing + progress indicator |

---

## Success Criteria

### Feature 1: Stand Table View
- [ ] Developments without GeoJSON show table view
- [ ] Manual toggle between map/table works
- [ ] Table search and filters function correctly
- [ ] Export to CSV works

### Feature 2: Past Sales Import
- [ ] CSV import succeeds with valid data
- [ ] Client records created/updated correctly
- [ ] Payments linked to stands
- [ ] Client statements updated
- [ ] Error handling displays row-level errors

### Feature 3: Offline Contracts
- [ ] Contract generation for past sales works
- [ ] Historical dates display correctly
- [ ] Contracts appear in client module
- [ ] Statements reflect historical contracts

---

## Files to Modify/Create

### New Files
```
app/api/admin/import/past-sales/route.ts
app/api/admin/contracts/offline/route.ts
app/api/developments/[id]/stands/table/route.ts
app/components/stands/StandTableView.tsx
app/components/import/PastSalesImportForm.tsx
app/components/contracts/OfflineContractForm.tsx
app/dashboards/admin/import/page.tsx
app/dashboards/admin/contracts/offline/page.tsx
app/dashboards/accounts/import-history/page.tsx
app/dashboards/developer/stands/table-view.tsx
lib/services/csv-parser.ts
lib/services/offline-contract-service.ts
```

### Modified Files - Billing Dashboard
```
app/dashboards/accounts/page.tsx - Add offline sale filters
app/dashboards/accounts/receivables/page.tsx - Include offline contracts
app/dashboards/accounts/statements/page.tsx - Historical contract display
app/dashboards/accounts/reports/page.tsx - Import sales reporting
app/api/financial/reports/route.ts - Offline sale metrics
```

### Modified Files - Developer Dashboard
```
app/dashboards/developer/developments/page.tsx - Map/table toggle
app/dashboards/developer/stands/page.tsx - Table view component
app/components/stands/StandList.tsx - Conditional rendering
app/components/developments/DevelopmentCard.tsx - HasMap indicator
app/api/stands/inventory/route.ts - Include map availability
```

### Modified Files - Backend
```
prisma/schema.prisma - Add OfflineSale, ImportBatch models, remove DocuSeal fields
app/lib/services/stands-inventory-service.ts - Map availability check
app/lib/services/client-statement-service.ts - Offline contract support
app/api/admin/contracts/generate/route.ts - Remove DocuSeal calls, add offline support
app/api/admin/contracts/[id]/route.ts - Remove DocuSeal status endpoints
```

### Modified Files - Frontend
```
app/dashboards/admin/contracts/page.tsx - Remove DocuSeal UI
app/dashboards/admin/contracts/[id]/page.tsx - Remove signer management
app/components/contracts/ContractActions.tsx - Remove "Send for Signature"
app/components/contracts/DocusealStatus.tsx - Remove entire component
app/components/contracts/OfflineContractForm.tsx - New simplified form
```
app/lib/services/stands-inventory-service.ts
app/dashboards/[role]/developments/page.tsx
app/components/stands/StandList.tsx
```

---

## Recommendation

**Proceed with implementation.** All three features are technically feasible and align with the existing codebase architecture. The estimated 40-50 hours of development time is reasonable for the scope.

Start with **Feature 1 (Stand Table View)** for immediate value, then proceed to **Feature 2 (Past Sales Import)** to enable historical data migration, and finally **Feature 3 (Offline Contracts)** to complete the workflow.
