# Import UI Location Guide

**Date:** 2026-02-24  
**Status:** ✅ UPDATED

---

## Where to Find Import in the UI

### For Admin Users

#### Method 1: Sidebar Navigation (RECOMMENDED)
```
Login → Admin Dashboard → Sidebar → "Administration" section → "Import Data"
```

**Steps:**
1. Log in as ADMIN, MANAGER, or ACCOUNT
2. Look at left sidebar
3. Find "Administration" section (collapsed by default)
4. Click to expand
5. Click "Import Data"

**What you'll see:**
- Excel Import Wizard with drag-and-drop
- Auto-format detection (LakeCity Ledger vs Standard)
- Preview before import
- Progress tracking

---

#### Method 2: Direct URL
```
https://your-domain.com/dashboards/admin/import
```

This page now uses the same `ExcelImportWizard` component as the sidebar.

---

### Import Capabilities by Location

| Location | Excel (.xlsx) | CSV | Format Detection | LakeCity Support |
|----------|---------------|-----|------------------|------------------|
| **Sidebar → Import Data** | ✅ Yes | ✅ Yes | ✅ Auto | ✅ Yes |
| **/dashboards/admin/import** | ✅ Yes | ✅ Yes | ✅ Auto | ✅ Yes |

---

## What Changed

### Before (Old)
```
Sidebar "Import Data" → DataImportModule → CSV only
```

### After (New)
```
Sidebar "Import Data" → ExcelImportWizard → Excel + CSV + Auto-detection
```

---

## UI Components

### ExcelImportWizard Location
**File:** `components/admin/ExcelImportWizard.tsx`

**Features:**
1. **Upload Step** - Drag & drop or select file
2. **Detect Step** - Auto-detects file format
3. **Preview Step** - Shows parsed stands, transactions, validation issues
4. **Import Step** - Executes import with progress
5. **Complete Step** - Results with batch ID

**Supported Formats:**
- LakeCity Ledger Excel (.xlsx) - Multi-sheet with stand blocks
- Standard CSV (.csv) - Flat table format
- Standard Excel (.xlsx) - Flat table format (detection only)

---

## Navigation Structure

```
Admin Dashboard
├── Sidebar
│   ├── Dashboard
│   ├── Developments
│   └── Administration (expandable)
│       ├── Wizard Actions
│       ├── Contracts
│       ├── Offline Contracts
│       ├── ✅ Import Data  ← CLICK HERE
│       ├── Access Control
│       ├── Agents
│       └── Automation
│   └── System (expandable)
│       ├── Audit Trail
│       ├── Backups
│       ├── Diagnostics
│       └── Branding
```

---

## File Locations

### Source Files
| File | Purpose |
|------|---------|
| `components/admin/ExcelImportWizard.tsx` | Main import wizard UI |
| `app/api/import/execute/route.ts` | Unified import API |
| `app/api/import/detect-format/route.ts` | Format detection API |
| `lib/import/excel-parser.ts` | LakeCity Excel parser |
| `lib/import/post-import-flow.ts` | Post-import tasks |

### Entry Points
| File | Purpose |
|------|---------|
| `App.tsx` | Main app with sidebar navigation |
| `components/Sidebar.tsx` | Sidebar menu definition |
| `app/dashboards/admin/import/page.tsx` | Standalone import page |

---

## User Flow

### For LakeCity Excel Import
```
1. User clicks "Import Data" in sidebar
2. Sees ExcelImportWizard with upload area
3. Drops .xlsx file
4. System detects "LakeCity Ledger Format"
5. Shows detected sheets (Kumvura, Highrange, etc.)
6. User clicks Continue
7. Preview shows stands, transactions, total collected
8. User clicks Execute Import
9. Import runs, creates developers/developments/stands/payments
10. Results show batch ID with counts
```

### For CSV Import
```
1. User clicks "Import Data" in sidebar
2. Sees ExcelImportWizard with upload area
3. Selects CSV file
4. System detects "CSV File" format
5. Preview shows data (if implemented)
6. Or: Use legacy DataImportModule for CSV via old endpoint
```

---

## Troubleshooting

### Import Option Not Visible
- **Check role:** Only ADMIN, MANAGER, ACCOUNT see Import Data
- **Check sidebar:** May need to expand "Administration" section
- **Check URL:** Navigate directly to `/dashboards/admin/import`

### Excel Upload Not Working
- Check file size (max 20MB)
- Check file extension (.xlsx or .xls)
- Check browser console for errors
- Verify API is running (`/api/import/detect-format`)

### Format Not Detected
- LakeCity format requires specific sheet names
- Check `lib/import/excel-parser.ts` for supported sheet names
- Supported: Kumvura estate, Hirange KK, $9000, etc.

---

## Recent Changes (2026-02-24)

1. ✅ Updated `App.tsx` to use `ExcelImportWizard` instead of `DataImportModule`
2. ✅ Updated `/dashboards/admin/import/page.tsx` to use `ExcelImportWizard`
3. ✅ Added 20MB body size limit to import API
4. ✅ Added role-based access control (ADMIN/MANAGER/ACCOUNT only)
5. ✅ Fixed error logging for failed imports

---

## Screenshots Expected

### Step 1: Upload
```
┌─────────────────────────────────────────┐
│  Data Import Wizard                     │
│                                         │
│  [Drag & drop area]                     │
│  Drop your file here                    │
│  Supports .xlsx, .xls, and .csv         │
│                                         │
│  [Select File]                          │
└─────────────────────────────────────────┘
```

### Step 2: Format Detected
```
┌─────────────────────────────────────────┐
│  LakeCity Ledger Format                 │
│                                         │
│  Detected Sheets:                       │
│  • Kumvura estate                       │
│  • Hirange KK                           │
│  • Rockridge KCMPM                      │
│                                         │
│  [Continue to Preview]                  │
└─────────────────────────────────────────┘
```

### Step 3: Preview
```
┌─────────────────────────────────────────┐
│  Import Preview                         │
│                                         │
│  [4] Sheets    [12] Stands    [$45k]    │
│                                         │
│  Developers & Developments:             │
│  • Kumvura Estate (5 stands)            │
│  • Highrange (4 stands)                 │
│  • Rockridge (3 stands)                 │
│                                         │
│  [Execute Import]                       │
└─────────────────────────────────────────┘
```
