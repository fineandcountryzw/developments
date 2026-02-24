# OFFLINE SALES & STATEMENT GENERATION WORKFLOW AUDIT

## 1. EXECUTIVE SUMMARY

| Aspect | Assessment |
|--------|------------|
| **Workflow Reliability** | PARTIAL |
| **Data Integrity Level** | MEDIUM RISK |
| **Biggest Operational Risks** | 1. Duplicate imports possible, 2. No validation on offline payment allocation, 3. No audit trail on imports, 4. Authentication disabled on import API |

---

## 2. WORKFLOW BREAKDOWN

### Current Flow:
```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    OFFLINE SALES WORKFLOW                                   │
├─────────────────────────────────────────────────────────────────────────────┤
│ 1. CSV Import (Admin)                                                      │
│    → POST /api/admin/import/past-sales                                     │
│    → Creates ImportBatch record                                            │
│    → Creates OfflineSale records                                           │
│    → Creates OfflinePayment records (if payments included)                 │
│                                                                             │
│ 2. Manual Offline Entry (Admin)                                            │
│    → POST /api/admin/offline-sales (likely - needs verification)           │
│                                                                             │
│ 3. Statement Generation (Client)                                           │
│    → GET /api/client/statement/download                                    │
│    → Fetches: client.payments + offlineSales + offlinePayments            │
│    → Generates PDF with all transactions                                   │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Weak Points Identified:

| Step | Weakness | Severity |
|------|----------|----------|
| CSV Import | **Authentication disabled** - line 50-56 shows auth is commented out, uses hardcoded 'test-user' | CRITICAL |
| CSV Import | **No duplicate detection** - same CSV can be imported multiple times | HIGH |
| CSV Import | **Stand validation weak** - stand lookups can fail silently | HIGH |
| Payment Recording | **No reference uniqueness check** - duplicate payments possible | HIGH |
| Statement | **No transaction ordering** - payments not sorted by date in final output | MEDIUM |
| Statement | **Hardcoded branch settings** - only Harare/Bulawayo, not extensible | LOW |

---

## 3. DATA INTEGRITY RISKS

| Risk | Severity | Description |
|------|----------|-------------|
| **Duplicate CSV Imports** | HIGH | No check if sales already exist; same data can be imported multiple times |
| **Orphaned Offline Payments** | HIGH | If OfflineSale is deleted, OfflinePayments may become orphaned (check cascade) |
| **Stand Not Found** | MEDIUM | If standNumber/developmentName doesn't match exactly, standId is null |
| **Client Mismatch** | MEDIUM | Email lookup can fail if client exists in different branch |
| **Payment Double-Counting** | MEDIUM | Both regular payments AND offlinePayments combined in statement - potential overlap if data entered in both systems |
| **No Transaction Reversals** | LOW | No mechanism to reverse/correct an imported payment |

---

## 4. STATEMENT ACCURACY RISKS

| Issue | Description |
|-------|-------------|
| **Payment Verification Status Ignored** | Line 58 filters `verificationStatus === 'Verified'` for regular payments but assumes all OfflinePayments are verified |
| **No Date Sorting in PDF** | Transactions added to PDF in query order, not chronological |
| **Balance Calculation** | `totalContractValue - totalVerified` - assumes all verified payments apply to current stands |
| **Missing Currency Handling** | No explicit USD handling - assumes Decimal fields are USD |
| **Deduplication Flaw** | Lines 89-96 deduplicate by stand ID, but doesn't account for same stand appearing in both reservation AND offline sale |

---

## 5. TRACEABILITY GAPS

| Gap | Status |
|-----|--------|
| Source of sale (manual vs CSV) | PARTIAL - has `importBatchId` on OfflineSale |
| Who entered data | **MISSING** - uses hardcoded 'test-user', no actual user tracking |
| When data uploaded | PARTIAL - has `createdAt` but not `importedBy` user |
| Payment batch IDs | PARTIAL - has `importBatchId` but payments don't link back clearly |
| Changes to allocations | **NOT TRACKED** - no audit trail on allocation changes |
| Statement generation timestamp | PRESENT - line 144 shows `Generated: ${new Date().toLocaleDateString()}` |

---

## 6. OFFLINE WORKFLOW SPECIFIC RISKS

| Risk | Description |
|------|-------------|
| **Delayed Data Entry** | No mechanism to track when offline sale actually occurred vs when entered |
| **Conflicting Uploads** | Same stand sold to different clients in quick succession |
| **Missing Stand References** | If development name in CSV doesn't match exactly, standId stays null |
| **Out-of-Order Payments** | Payments can be imported in any order; no date validation |
| **Duplicate Excel Imports** | No hash/comparison check to prevent re-importing same file |
| **Data Loss** | If import fails mid-way, partial data may remain |

---

## 7. UI / OPERATIONAL VISIBILITY

| Feature | Status |
|---------|--------|
| Unallocated payments view | **NOT PRESENT** |
| Payments missing stand view | **NOT PRESENT** |
| Duplicate payment detection | **NOT PRESENT** |
| Statement mismatch warnings | **NOT PRESENT** |
| Reconciliation dashboard | **NOT PRESENT** |
| Last upload summary | Partial - ImportBatch has counts |

---

## 8. PERFORMANCE & SCALABILITY

| Aspect | Assessment |
|--------|------------|
| Statement generation | On-demand (PDF created per request) |
| Query performance | Multiple includes - could be slow with many records |
| Allocations indexed | Yes - @@index on standId, clientId in Payment |
| Large dataset risk | MEDIUM - no pagination on statement query |

---

## 9. FIX PLAN

### P0 - Must Fix Immediately (Data Correctness)

| # | Issue | Fix |
|---|-------|-----|
| P0.1 | Authentication disabled on import API | Enable proper auth, remove hardcoded user |
| P0.2 | Duplicate imports possible | Add import hash or check for existing sale by (clientId, standId, saleDate) |
| P0.3 | OfflinePayment not verified by default | Add verificationStatus field to OfflinePayment |

### P1 - Operational Stability

| # | Issue | Fix |
|---|-------|-----|
| P1.1 | No duplicate detection for payments | Add unique constraint on Payment.reference |
| P1.2 | Stand validation weak | Add validation report showing unmatched stands |
| P1.3 | No audit trail for imports | Log importBatchId + userId on all created records |

### P2 - Optimization / Automation

| # | Issue | Fix |
|---|-------|-----|
| P2.1 | Add reconciliation dashboard | Show: unallocated payments, missing stands, duplicate risks |
| P2.2 | Sort transactions by date in statement | Add orderBy to all payment queries |
| P2.3 | Add payment reversal capability | Allow voiding offline payments with audit trail |

---

## 10. DATA MODEL RECOMMENDATIONS

```prisma
// Add to OfflineSale
source          String    @default("MANUAL") // MANUAL, CSV, API
importedBy      String?   @map("imported_by")
importFileName  String?   @map("import_file_name")

// Add to OfflinePayment  
verificationStatus String @default("Pending") // Pending, Verified, Rejected
verifiedBy         String? @map("verified_by")
verifiedAt         DateTime? @map("verified_at")

// Add unique constraint
@@unique([clientId, standId, saleDate]) // Prevent duplicate sales
```

---

## 11. VALIDATION RULES RECOMMENDATIONS

1. **On CSV Import:**
   - Validate stand exists before creating OfflineSale
   - Validate client email format
   - Check for existing sale (client + stand + date)
   - Generate import hash to prevent re-imports

2. **On Statement Generation:**
   - Warn if payments exceed contract value
   - Flag stands that appear in both reservation and offline sale
   - Show verification status clearly

---

*Audit completed: 2026-02-16*
*System: Fine & Country Zimbabwe ERP*
