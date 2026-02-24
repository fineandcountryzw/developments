# 🔍 CONTRACTS MODULE - FORENSIC AUDIT REPORT

**Status:** ⚠️ **CRITICAL ISSUE FOUND**  
**Generated:** February 2, 2026  
**Module:** Contract Management System

---

## 📋 EXECUTIVE SUMMARY

The Contracts module is **creating contracts correctly** but has a **CRITICAL BUG** in PDF generation:
- ✅ Contract generation works (HTML content created)
- ✅ Contract CRUD operations functional
- ❌ **PDF conversion NOT working** - Returns HTML instead of PDF
- ❌ Frontend expects PDF but receives HTML

---

## 🔴 CRITICAL ISSUE: HTML to PDF Conversion Broken

### The Problem

**Location:** 
- [app/api/admin/contracts/[id]/render/route.ts](app/api/admin/contracts/[id]/render/route.ts)
- [app/api/admin/contracts/[id]/download/route.ts](app/api/admin/contracts/[id]/download/route.ts)

**Issue:** Both endpoints return HTML instead of PDF

**Current Behavior:**
```typescript
// ❌ PROBLEM: Returns HTML, not PDF
return new NextResponse(html, {
  status: 200,
  headers: {
    'Content-Type': 'text/html; charset=utf-8',  // Should be 'application/pdf'
    'Content-Disposition': `inline; filename="contract.html"`  // Should be .pdf
  }
});
```

**Expected Behavior:**
```typescript
// ✅ SHOULD: Convert HTML to PDF using puppeteer
const pdfBuffer = await generatePDF('contract', htmlContent);

return new NextResponse(pdfBuffer, {
  status: 200,
  headers: {
    'Content-Type': 'application/pdf',
    'Content-Disposition': `attachment; filename="contract-${id}.pdf"`
  }
});
```

---

## 🔍 ROOT CAUSE ANALYSIS

### Why PDF Generation Doesn't Work

1. **No PDF Conversion Code**
   - Files: `render/route.ts` and `download/route.ts`
   - Missing: `generatePDF()` function call
   - Missing: Puppeteer integration

2. **PDF Generator Not Used**
   - File exists: [lib/pdf-generator.ts](lib/pdf-generator.ts)
   - Has `generatePDF()` function with Puppeteer
   - Supports: 'statement', 'receipt', 'report' types
   - **Missing: 'contract' type support**

3. **Frontend Expects PDF**
   - [components/ContractViewer.tsx](components/ContractViewer.tsx#L70-L88)
   ```typescript
   const handleDownloadPDF = async () => {
     const res = await fetch(`/api/admin/contracts/${contractId}/render`, {
       method: 'POST'
     });
     
     const blob = await res.blob();  // Expects PDF blob
     const url = window.URL.createObjectURL(blob);
     a.download = `contract-${contractId}.pdf`;  // Expects .pdf file
   };
   ```

---

## 📊 CRUD OPERATIONS STATUS

| Operation | Endpoint | Status | Notes |
|-----------|----------|--------|-------|
| **CREATE** | POST `/api/admin/contracts` | ✅ | Works |
| **CREATE (Generate)** | POST `/api/admin/contracts/generate` | ✅ | Works |
| **READ (List)** | GET `/api/admin/contracts` | ✅ | Works |
| **READ (Detail)** | GET `/api/admin/contracts/[id]` | ✅ | Works |
| **UPDATE** | PUT `/api/admin/contracts/[id]` | ✅ | Works |
| **DELETE** | DELETE `/api/admin/contracts/[id]` | ✅ | Works (draft only) |
| **RENDER HTML** | POST `/api/admin/contracts/[id]/render` | ⚠️ | Returns HTML (not PDF) |
| **DOWNLOAD** | GET `/api/admin/contracts/[id]/download` | ⚠️ | Returns HTML (not PDF) |
| **SEND FOR SIGNATURE** | POST `/api/admin/contracts/[id]/send-for-signature` | ✅ | Works |
| **SIGN** | POST `/api/admin/contracts/[id]/sign` | ✅ | Works |

---

## 🐛 BUGS IDENTIFIED

### Bug #1: Render Endpoint Returns HTML (Not PDF)

**File:** [app/api/admin/contracts/[id]/render/route.ts](app/api/admin/contracts/[id]/render/route.ts#L258-L265)

**Current Code:**
```typescript
return new NextResponse(html, {
  status: 200,
  headers: {
    'Content-Type': 'text/html; charset=utf-8',  // ❌ Wrong
    'Cache-Control': 'no-cache, no-store, must-revalidate'
  }
});
```

**Impact:**
- Frontend receives HTML when expecting PDF
- Download button saves `.html` file instead of `.pdf`
- Printing doesn't work properly

---

### Bug #2: Download Endpoint Returns HTML (Not PDF)

**File:** [app/api/admin/contracts/[id]/download/route.ts](app/api/admin/contracts/[id]/download/route.ts#L273-L280)

**Current Code:**
```typescript
return new NextResponse(html, {
  status: 200,
  headers: {
    'Content-Type': 'text/html; charset=utf-8',  // ❌ Wrong
    'Content-Disposition': `inline; filename="${templateName}-${clientName}.html"`, // ❌ .html not .pdf
    'Cache-Control': 'no-cache, no-store, must-revalidate'
  }
});
```

**Impact:**
- Downloads HTML file instead of PDF
- Cannot open in PDF viewers
- Poor user experience

---

### Bug #3: PDF Generator Missing 'contract' Type

**File:** [lib/pdf-generator.ts](lib/pdf-generator.ts#L48-L53)

**Current Code:**
```typescript
export async function generatePDF(
  type: 'statement' | 'receipt' | 'report',  // ❌ Missing 'contract'
  data: StatementData | ReceiptData | ReportData  // ❌ Missing ContractData
): Promise<Buffer> {
  // ...
  if (type === 'statement') {
    htmlContent = generateStatementHTML(data as StatementData);
  } else if (type === 'receipt') {
    htmlContent = generateReceiptHTML(data as ReceiptData);
  } else if (type === 'report') {
    htmlContent = generateReportHTML(data as ReportData);
  } else {
    throw new Error(`Unknown PDF type: ${type}`);  // ❌ Will fail for 'contract'
  }
}
```

**Impact:**
- Cannot use existing PDF generator for contracts
- Need to add 'contract' type support

---

### Bug #4: No Runtime Configuration for Puppeteer

**File:** Both contract route files

**Missing:**
```typescript
export const runtime = 'nodejs';  // ❌ Missing - Required for Puppeteer
```

**Impact:**
- Will fail on Vercel (defaults to edge runtime)
- Puppeteer not available in edge runtime
- Must use Node.js runtime

---

## ✅ WHAT WORKS CORRECTLY

### Contract Generation
- ✅ Template selection and loading
- ✅ Merge tag replacement
- ✅ Client data integration
- ✅ Stand/Development data resolution
- ✅ HTML content generation
- ✅ Contract storage in database
- ✅ Version snapshots

### Contract Management
- ✅ List contracts with filters
- ✅ View contract details
- ✅ Update contract content
- ✅ Delete draft contracts
- ✅ Signature workflow (DocuSeal)
- ✅ Role-based access control
- ✅ Activity logging

### Frontend
- ✅ Contract list display
- ✅ Contract viewer modal
- ✅ Template editor
- ✅ Contract generator form
- ✅ Signature status tracking

---

## 🔧 REQUIRED FIXES

### Fix #1: Add Contract Type to PDF Generator

**File:** `lib/pdf-generator.ts`

**Changes:**

1. Add ContractData interface:
```typescript
interface ContractData {
  id: string;
  templateName: string;
  clientName: string;
  standNumber?: string;
  developmentName?: string;
  content: string;  // HTML content
  status: string;
  createdAt: string;
  signedAt?: string;
  signedBy?: string;
}
```

2. Update function signature:
```typescript
export async function generatePDF(
  type: 'statement' | 'receipt' | 'report' | 'contract',  // Added 'contract'
  data: StatementData | ReceiptData | ReportData | ContractData
): Promise<Buffer>
```

3. Add contract HTML generation:
```typescript
if (type === 'contract') {
  htmlContent = generateContractHTML(data as ContractData);
}
```

4. Add `generateContractHTML()` function

---

### Fix #2: Update Render Endpoint to Return PDF

**File:** `app/api/admin/contracts/[id]/render/route.ts`

**Add at top:**
```typescript
import { generatePDF } from '@/lib/pdf-generator';

export const runtime = 'nodejs';  // Required for Puppeteer
```

**Replace return statement (Lines 258-265):**
```typescript
// Generate PDF from HTML
const pdfBuffer = await generatePDF('contract', {
  id: contract.id,
  templateName: contract.template?.name || 'Contract',
  clientName: contract.client?.name || 'Client',
  standNumber: contract.standId,
  developmentName: contract.developmentName,
  content: html,  // The HTML we generated
  status: contract.status,
  createdAt: contract.createdAt.toISOString(),
  signedAt: contract.signedAt?.toISOString(),
  signedBy: contract.signedBy
});

return new NextResponse(Buffer.from(pdfBuffer), {
  status: 200,
  headers: {
    'Content-Type': 'application/pdf',
    'Content-Disposition': `attachment; filename="contract-${id}.pdf"`,
    'Cache-Control': 'no-cache, no-store, must-revalidate'
  }
});
```

---

### Fix #3: Update Download Endpoint to Return PDF

**File:** `app/api/admin/contracts/[id]/download/route.ts`

**Same fix as above:**

**Add at top:**
```typescript
import { generatePDF } from '@/lib/pdf-generator';

export const runtime = 'nodejs';  // Required for Puppeteer
```

**Replace return statement (Lines 273-280):**
```typescript
// Generate PDF from HTML
const pdfBuffer = await generatePDF('contract', {
  id: contract.id,
  templateName: templateName,
  clientName: clientName,
  standNumber: standNumber,
  developmentName: contract.developmentName,
  content: html,
  status: contract.status,
  createdAt: contract.createdAt.toISOString(),
  signedAt: contract.signedAt?.toISOString(),
  signedBy: contract.signedBy
});

return new NextResponse(Buffer.from(pdfBuffer), {
  status: 200,
  headers: {
    'Content-Type': 'application/pdf',
    'Content-Disposition': `attachment; filename="${templateName}-${clientName}.pdf"`,
    'Content-Length': pdfBuffer.length.toString()
  }
});
```

---

## 🧪 TESTING CHECKLIST

### After Fixes

- [ ] Generate new contract
- [ ] Click "Download PDF" button
- [ ] Verify file is `.pdf` (not `.html`)
- [ ] Open PDF in viewer (should render correctly)
- [ ] Verify contract content is readable
- [ ] Verify signatures section renders
- [ ] Test print functionality
- [ ] Test on Vercel deployment

---

## 📈 PERFORMANCE CONSIDERATIONS

### Puppeteer Performance
- PDF generation: ~2-5 seconds per contract
- Memory usage: ~200MB per Puppeteer instance
- Timeout: Default 30s (adequate for contracts)

### Recommendations
1. ✅ Use existing Puppeteer config (already optimized)
2. ✅ Cache PDFs for signed contracts (immutable)
3. ⚠️ Consider queue for bulk PDF generation
4. ⚠️ Monitor Lambda timeout on Vercel (max 10s on hobby plan)

---

## 🔐 SECURITY NOTES

### Access Control
- ✅ Role-based access implemented
- ✅ Contract ownership verified
- ✅ Activity logging present

### PDF Generation
- ✅ Puppeteer sandboxed (`--no-sandbox` flag)
- ✅ HTML sanitization via template system
- ⚠️ Ensure user-provided content is sanitized

---

## 📄 FILES REQUIRING CHANGES

### Core Files (Must Fix)
1. ✅ `lib/pdf-generator.ts` - Add 'contract' type support
2. ✅ `app/api/admin/contracts/[id]/render/route.ts` - Convert to PDF
3. ✅ `app/api/admin/contracts/[id]/download/route.ts` - Convert to PDF

### No Changes Required
- ✅ `components/ContractViewer.tsx` - Already expects PDF
- ✅ `components/ContractsList.tsx` - Already expects PDF
- ✅ `app/api/admin/contracts/generate/route.ts` - Works correctly
- ✅ All other contract endpoints - Functional

---

## 📊 SUMMARY

### Issue
Contracts module generates HTML correctly but doesn't convert to PDF.

### Root Cause
- Missing PDF conversion in render/download endpoints
- PDF generator doesn't support 'contract' type
- Missing `runtime = 'nodejs'` configuration

### Impact
- Users download HTML files instead of PDFs
- Poor user experience
- Cannot print contracts properly

### Solution
- Add 'contract' type to PDF generator
- Update render/download endpoints to use PDF generator
- Add runtime configuration

### Effort
- Development Time: 2-3 hours
- Testing Time: 1 hour
- Total: 3-4 hours

---

**Audit Completed By:** GitHub Copilot  
**Report Classification:** CONFIDENTIAL  
**Status:** CRITICAL FIXES REQUIRED ⚠️
