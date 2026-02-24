# Contract Generation Feasibility Audit

**Date:** February 16, 2026  
**Status:** Complete  
**System:** ERP Contract Auto-Build Feature

---

## Executive Summary

This audit evaluates the feasibility of improving contract document generation from the ERP system. The current system uses a hybrid approach (HTML templates + DOCX template support) but suffers from formatting inconsistencies when users paste content from Microsoft Word.

**Key Finding:** The system already has DOCX template infrastructure (Option A) partially implemented. The issue is likely in the HTML→PDF conversion pipeline and lack of proper styling enforcement.

---

## 1. Root Cause Analysis

### Why Pasting from Word Breaks Formatting

When users paste contract content from Microsoft Word into the ERP, several transformation layers cause formatting loss:

| Layer | Problem | Impact |
|-------|---------|--------|
| **Word → HTML Clipboard** | Word uses proprietary XML (WordML) not compatible with HTML | Rich text converted to plain text with minimal styling |
| **HTML Sanitization** | Security filtering removes `<script>`, `onclick`, styles | All inline styles stripped |
| **Variable Substitution** | Simple string replacement `{{field}}` | No intelligent paragraph/table handling |
| **HTML → PDF** | Library converts HTML to PDF line-by-line | Fonts, margins, tables not preserved |

### Specific Issues Identified

1. **Word Styles vs HTML Rendering**
   - Word uses **styles** (Heading 1, Normal, List Bullet) for formatting
   - HTML uses **tags** (`<h1>`, `<p>`, `<ul>`) without inherent styling
   - Word's "Heading 1" becomes generic `<h1>` without Times New Roman, 14pt, bold

2. **Typography Loss**
   - Font family: Word fonts → system defaults (usually Arial/Helvetica)
   - Font size: Exact pt values often rounded or ignored
   - Bold/Italic: Preserved but font weight differences cause visual shift

3. **Margin & Spacing Collapse**
   - Word uses "Before" and "After" spacing on paragraphs
   - HTML uses `margin-top/bottom` which renders differently
   - PDF converters often ignore or mishandle these

4. **Clause Numbering Breaks**
   - Word multi-level numbering (1.1, 1.1.1) → plain text "1.1."
   - Automatic numbering doesn't transfer to HTML lists
   - PDF generators can't recreate Word's outline numbering

5. **Table Misalignment**
   - Word tables with merged cells, nested tables → HTML tables
   - Column widths specified in inches (Word) vs pixels/percent (HTML)
   - Borders and shading often lost entirely

6. **HTML → PDF Limitations**
   - Libraries like `html-pdf-node`, `puppeteer` render HTML as if in browser
   - CSS `@media print` rules often ignored or incompletely applied
   - No support for Word-specific features (track changes, comments)

7. **Rich Text Sanitization**
   - [`lib/contract-template-parser.ts:374-378`](lib/contract-template-parser.ts:374) shows basic sanitization
   - Removes script tags and event handlers
   - Strips ALL inline styles as security measure

8. **Lack of Style System**
   - Current templates lack consistent CSS class structure
   - No design tokens (colors, fonts, spacing constants)
   - No print-specific stylesheet for PDF output

---

## 2. Feasibility Options (Ranked Best → Worst)

### ✅ OPTION A: DOCX Template Engine (RECOMMENDED)

**Current Implementation Status:** Partially Complete

The system already has infrastructure for this approach:
- [`lib/docx-template-engine.ts`](lib/docx-template-engine.ts) - DOCX processing with docxtemplater
- [`lib/contract-template-parser.ts`](lib/contract-template-parser.ts) - Variable extraction
- [`lib/contract-generator.ts`](lib/contract-generator.ts:90-101) - Template type routing
- UploadThing integration for DOCX file storage

**How It Works:**
1. Admin uploads professionally formatted DOCX master template
2. Template contains placeholders: `{{client.fullName}}`, `{{stand.standNumber}}`, etc.
3. [`docxtemplater`](https://docxtemplater.com/) replaces placeholders preserving all formatting
4. Output is native DOCX with perfect fidelity

**Pros:**
- ✅ **Perfect formatting preservation** - Word styles, fonts, tables, numbering intact
- ✅ **Native Word editing** - Can open output in Word for manual tweaks
- ✅ **Lawyer-friendly** - Lawyers work in Word, deliver in Word
- ✅ **PDF conversion** - Use Microsoft Word or LibreOffice for reliable conversion
- ✅ **Already partially implemented** - Infrastructure exists

**Cons:**
- ❌ Requires admin to create/upload DOCX templates
- ❌ DOCX variable syntax must be exact (`{{namespace.field}}`)
- ❌ More complex template management

**Implementation Priority:** **HIGH** - Already exists, needs refinement

---

### ✅ OPTION B: Uploadable Template + Field Mapping

**Current Implementation Status:** Not Started

Extends Option A with admin UI for template management:

1. **Admin uploads DOCX template** via [`components/contracts/DOCXTemplateUploader.tsx`](components/contracts/DOCXTemplateUploader.tsx) (file missing, needs creation)
2. **System auto-detects variables** using [`extractVariablesFromDocx()`](lib/docx-template-engine.ts:110)
3. **Admin maps ERP fields to placeholders** via UI
4. **Generate contracts with mapped data**

**Pros:**
- ✅ Non-technical admin can manage templates
- ✅ Field mapping prevents errors
- ✅ Version control for templates
- ✅ Works with existing DOCX templates

**Cons:**
- ❌ Requires significant UI development
- ❌ Field mapping complexity for users

**Implementation Priority:** MEDIUM

---

### ⚠️ OPTION C: HTML Contract Template + Strict Print CSS

**Current Implementation Status:** Partial (HTML templates exist, print CSS incomplete)

If continuing with HTML approach, requires significant improvement:

1. **Single source HTML template** with embedded CSS
2. **Strict `@media print` rules** for PDF output
3. **CSS custom properties** for design tokens

**Required Improvements:**
```css
/* Design Tokens */
:root {
  --font-primary: 'Times New Roman', serif;
  --font-size-base: 12pt;
  --line-height: 1.5;
  --margin-body: 1in;
  --clause-number-width: 0.5in;
}

/* Print Styles */
@media print {
  body { font-family: var(--font-primary); }
  .clause { margin-left: var(--clause-number-width); }
  @page { margin: 1in; size: A4; }
}
```

**Pros:**
- ✅ Single format for web preview + PDF
- ✅ CSS provides consistent styling
- ✅ Can use puppeteer for reliable PDF

**Cons:**
- ❌ Still loses some Word-specific formatting
- ❌ Requires complete template redesign
- ❌ Not as polished as native DOCX

**Implementation Priority:** LOW (Use Option A instead)

---

### ❌ OPTION D: Rich-Text Paste → Document Generation (NOT RECOMMENDED)

**Current Implementation Status:** The Problem Being Solved

This is the current fragile approach:
1. User pastes Word content into ERP text field
2. System stores as HTML (with all the issues above)
3. Variables replace placeholders in HTML content
4. HTML converted to PDF

**Why This Fails:**

| Issue | Root Cause |
|-------|------------|
| Inconsistent fonts | Clipboard HTML uses Word's font definitions |
| Broken numbering | Word multi-level lists don't map to HTML |
| Misaligned tables | Cell widths in inches vs HTML percentages |
| Poor PDF output | html-pdf-node doesn't support print CSS |

**This approach should be DEPRECATED** in favor of Option A.

---

## 3. Visual Quality Requirements

### What "Properly Formatted Contract" Means

A professionally formatted contract must meet these standards:

#### 3.1 Typography

| Requirement | Standard |
|-------------|----------|
| **Font Family** | Times New Roman or Georgia (serif) for body; Arial for headers |
| **Font Size** | Body: 12pt; Headers: 14pt bold; Clause numbers: 12pt bold |
| **Line Height** | 1.5 (single-spaced with gap) |
| **Paragraph Spacing** | 12pt after each paragraph |

#### 3.2 Margins

| Element | Requirement |
|---------|-------------|
| **Page Margins** | 1 inch (2.54cm) all sides |
| **Clause Indent** | First line 0.5 inch for numbered clauses |
| **Signature Block** | 2 inches from bottom of page |

#### 3.3 Clause Numbering

```
1. DEFINITIONS
   1.1 "Agreement" means...
   1.2 "Property" means...

2. TERMS AND CONDITIONS
   2.1 The Seller agrees...
```

- Must use hierarchical numbering (1, 1.1, 1.1.1)
- Numbers must be bold
- Sub-clauses indented consistently

#### 3.4 Signature Block

```
SIGNED by the parties hereto:

_____________________________          _____________________________
Client Name                                     Developer Name
Date: _____________                            Date: _____________

_____________________________          _____________________________
Witness                                           Witness
```

- Two-column layout
- Equal spacing
- Clear labels (Client, Developer, Witness)
- Date fields aligned

#### 3.5 Tables

| Requirement | Standard |
|-------------|----------|
| Borders | Thin (0.5pt) black lines |
| Header Row | Gray background, bold text |
| Cell Padding | 6pt all sides |
| Alignment | Left-align text, right-align numbers |

---

## 4. Recommended Implementation Path

### Phase 1: Complete DOCX Template Engine (Week 1-2)

**Immediate Actions:**
1. ✅ Verify [`docxtemplater`](https://docxtemplater.com/) is working correctly
2. ✅ Create sample professionally formatted DOCX template
3. ✅ Test variable replacement end-to-end
4. ✅ Verify DOCX→PDF conversion quality

**Required Files:**
- `templates/contract-master.docx` (sample template)
- Update [`lib/docx-template-engine.ts`](lib/docx-template-engine.ts) for production use

### Phase 2: Admin Template Management (Week 3-4)

1. Create [`components/contracts/DOCXTemplateUploader.tsx`](components/contracts/DOCXTemplateUploader.tsx)
2. Build template listing and selection UI
3. Add template versioning

### Phase 3: PDF Generation Pipeline (Week 5-6)

1. Use LibreOffice headless for DOCX→PDF (better than html-pdf)
2. Implement proper print CSS as fallback
3. Add PDF preview functionality

---

## 5. Technical Recommendations

### Use Native DOCX Preservation

The single most important recommendation:

> **Generate DOCX, not HTML→PDF**

This preserves:
- All Word formatting
- Editable text
- Track changes capability
- Print-quality PDF via Word/LibreOffice

### Variable Schema (Already Defined)

The system already supports proper variable namespaces:

```typescript
// From lib/docx-template-engine.ts:78-88
const namespaceSchema = {
  client: { fullName: true, email: true, phone: false, ... },
  stand: { number: true, price: true, sizeSqm: false, ... },
  development: { name: true, location: true, ... },
  terms: { depositPercentage: true, vatEnabled: true, ... },
  pricing: { grandTotal: true, depositAmount: true, ... },
  contract: { date: true, id: true }
};
```

### PDF Conversion Options

| Method | Quality | Speed | Reliability |
|--------|---------|-------|-------------|
| **LibreOffice headless** | ⭐⭐⭐⭐⭐ | Fast | High |
| **Microsoft Word (COM)** | ⭐⭐⭐⭐⭐ | Medium | Requires Windows |
| **Puppeteer** | ⭐⭐⭐ | Fast | Medium |
| **html-pdf-node** | ⭐⭐ | Fast | Low |

**Recommendation:** Use LibreOffice (`libreoffice-convert`) for production PDF generation.

---

## 6. Conclusion

The ERP system has the **foundation for proper contract generation** (Option A partially implemented). The issue is that the HTML-based approach is being used as the primary method, which cannot produce lawyer-quality documents.

**Primary Recommendation:**
1. Complete the DOCX template engine implementation
2. Create professional DOCX master templates
3. Use DOCX as primary output format
4. Convert to PDF only when needed (via LibreOffice)

This approach will produce contracts that look like they were prepared by a lawyer, with perfect formatting preservation.

---

## Appendix: Relevant Files

| File | Purpose |
|------|---------|
| [`lib/docx-template-engine.ts`](lib/docx-template-engine.ts) | DOCX processing, variable extraction |
| [`lib/contract-template-parser.ts`](lib/contract-template-parser.ts) | HTML parsing, merge tag extraction |
| [`lib/contract-generator.ts`](lib/contract-generator.ts) | Contract generation orchestration |
| [`CONTRACT_TEMPLATE_ARCHITECTURE.md`](CONTRACT_TEMPLATE_ARCHITECTURE.md) | Full system architecture |
| [`CONTRACT_ENGINE_DESIGN.md`](CONTRACT_ENGINE_DESIGN.md) | Variable schema and design |
