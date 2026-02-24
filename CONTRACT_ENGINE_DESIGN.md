# Contract Templating + Document Merge Engine — Technical Design

## 1. Architecture Overview

### Core Flow
```
┌─────────────────┐     ┌──────────────────┐     ┌─────────────────┐
│  Upload DOCX    │────▶│  Extract merge   │────▶│  Store as HTML  │
│  Template       │     │  tags {{...}}    │     │  + metadata     │
└─────────────────┘     └──────────────────┘     └─────────────────┘
                                │
                                ▼
┌─────────────────┐     ┌──────────────────┐     ┌─────────────────┐
│  Generate PDF   │◀────│  Replace tags    │◀────│  Fetch data     │
│  Contract       │     │  with data       │     │  (standId)      │
└─────────────────┘     └──────────────────┘     └─────────────────┘
```

### Technology Choices
| Component | Choice | Rationale |
|-----------|--------|-----------|
| Template Format | DOCX (upload) → HTML (storage) | Lawyers use Word; HTML renders universally |
| DOCX Parsing | `docx` npm package | Pure JS, no native deps, Vercel-compatible |
| PDF Generation | `puppeteer` (serverless) or `jspdf` | Puppeteer for quality, jsPDF for speed |
| Variable Schema | Dot notation `{{client.fullName}}` | Explicit, no NLP guessing |
| Data Fetch | Prisma with eager loading | Single query for stand + development + client |

---

## 2. Template Variable Schema

### Full Namespace Reference

#### **client.*** — Client Information
| Tag | Source | Example |
|-----|--------|---------|
| `{{client.fullName}}` | `Client.name` | "John Smith" |
| `{{client.firstName}}` | `Client.firstName` | "John" |
| `{{client.lastName}}` | `Client.lastName` | "Smith" |
| `{{client.email}}` | `Client.email` | "john@example.com" |
| `{{client.phone}}` | `Client.phone` | "+263 77 123 4567" |
| `{{client.nationalId}}` | `Client.national_id` | "63-1234567A89" |
| `{{client.address}}` | `Client.address` | "15 Nigels Lane, Harare" |
| `{{client.branch}}` | `Client.branch` | "Harare" |

#### **stand.*** — Stand/Plot Information
| Tag | Source | Example |
|-----|--------|---------|
| `{{stand.standNumber}}` | `Stand.standNumber` | "A-15" |
| `{{stand.price}}` | `Stand.price` | "$45,000.00" |
| `{{stand.pricePerSqm}}` | `Stand.pricePerSqm` | "$150.00" |
| `{{stand.sizeSqm}}` | `Stand.sizeSqm` | "300" |
| `{{stand.status}}` | `Stand.status` | "Available" |
| `{{stand.discountPercent}}` | `Stand.discountPercent` | "10%" |

#### **development.*** — Development/Estate Information
| Tag | Source | Example |
|-----|--------|---------|
| `{{development.name}}` | `Development.name` | "Highlands Estate" |
| `{{development.location}}` | `Development.location` | "Borrowdale, Harare" |
| `{{development.description}}` | `Development.description` | "Premium residential..." |
| `{{development.phase}}` | `Development.phase` | "SERVICING" |
| `{{development.basePrice}}` | `Development.basePrice` | "$40,000.00" |
| `{{development.developerName}}` | `Development.developerName` | "ABC Developers" |
| `{{development.developerEmail}}` | `Development.developerEmail` | "dev@abc.com" |
| `{{development.developerPhone}}` | `Development.developerPhone` | "+263 24 123 4567" |
| `{{development.lawyerName}}` | `Development.lawyerName` | "Jane Doe Legal" |
| `{{development.lawyerEmail}}` | `Development.lawyerEmail` | "legal@janedoe.com" |

#### **terms.*** — Payment Terms (from Development Wizard)
| Tag | Source | Example |
|-----|--------|---------|
| `{{terms.depositPercentage}}` | `Development.depositPercentage` | "30%" |
| `{{terms.depositAmount}}` | Calculated | "$13,500.00" |
| `{{terms.installmentPeriods}}` | `Development.installmentPeriods` | "12, 24, 48 months" |
| `{{terms.vatEnabled}}` | `Development.vatEnabled` | "Yes" |
| `{{terms.vatPercentage}}` | `Development.vatPercentage` | "15%" |
| `{{terms.vatAmount}}` | Calculated | "$6,750.00" |
| `{{terms.endowmentEnabled}}` | `Development.endowmentEnabled` | "Yes" |
| `{{terms.endowmentFee}}` | `Development.endowmentFee` | "$500.00" |
| `{{terms.aosEnabled}}` | `Development.aosEnabled` | "Yes" |
| `{{terms.aosFee}}` | `Development.aosFee` | "$500.00" |
| `{{terms.cessionsEnabled}}` | `Development.cessionsEnabled` | "Yes" |
| `{{terms.cessionFee}}` | `Development.cessionFee` | "$250.00" |
| `{{terms.adminFeeEnabled}}` | `Development.adminFeeEnabled` | "Yes" |
| `{{terms.adminFee}}` | `Development.adminFee` | "$100.00" |

#### **pricing.*** — Calculated Pricing
| Tag | Calculation | Example |
|-----|-------------|---------|
| `{{pricing.standPrice}}` | `Stand.price` | "$45,000.00" |
| `{{pricing.vatAmount}}` | `price * (vat% / 100)` | "$6,750.00" |
| `{{pricing.subtotal}}` | `price + vat` | "$51,750.00" |
| `{{pricing.endowmentFee}}` | `Development.endowmentFee` | "$500.00" |
| `{{pricing.aosFee}}` | `Development.aosFee` if enabled | "$500.00" |
| `{{pricing.cessionFee}}` | `Development.cessionFee` if enabled | "$250.00" |
| `{{pricing.adminFee}}` | `Development.adminFee` if enabled | "$100.00" |
| `{{pricing.totalFees}}` | Sum of all fees | "$1,350.00" |
| `{{pricing.grandTotal}}` | `subtotal + fees` | "$53,100.00" |
| `{{pricing.depositAmount}}` | `grandTotal * (deposit% / 100)` | "$15,930.00" |
| `{{pricing.balanceAmount}}` | `grandTotal - deposit` | "$37,170.00" |
| `{{pricing.currency}}` | Hardcoded | "USD" |

#### **contract.*** — Contract Metadata
| Tag | Source | Example |
|-----|--------|---------|
| `{{contract.date}}` | Generation date | "01 February 2026" |
| `{{contract.timestamp}}` | ISO timestamp | "2026-02-01T09:30:00Z" |
| `{{contract.contractId}}` | Generated UUID | "cnt_abc123xyz" |
| `{{contract.templateName}}` | Template name | "Standard Purchase Agreement" |
| `{{contract.templateVersion}}` | Version number | "1" |

---

## 3. API Endpoints

### 3.1 Upload Template
```http
POST /api/admin/contracts/templates/upload
Content-Type: multipart/form-data

Body:
  - file: DOCX file
  - name: "Standard Purchase Agreement"
  - description: "Default template for plot purchases"
  - developmentId: "dev_abc123" (optional, for dev-specific templates)

Response:
{
  "success": true,
  "template": {
    "id": "tmpl_abc123",
    "name": "Standard Purchase Agreement",
    "content": "<html>...</html>",
    "variables": ["client.fullName", "stand.price", "development.name"],
    "extractedTags": ["{{client.fullName}}", "{{stand.price}}"],
    "invalidTags": ["{{invalid.tag}}"],
    "developmentId": "dev_abc123",
    "isGlobal": false
  }
}
```

### 3.2 List Templates
```http
GET /api/admin/contracts/templates?developmentId=dev_abc123&includeGlobal=true

Response:
{
  "templates": [
    {
      "id": "tmpl_abc123",
      "name": "Standard Purchase Agreement",
      "description": "...",
      "isGlobal": false,
      "developmentId": "dev_abc123",
      "development": { "name": "Highlands Estate" },
      "variableCount": 15,
      "usageCount": 42,
      "createdAt": "2026-01-15T10:00:00Z"
    }
  ]
}
```

### 3.3 Preview Template Variables
```http
POST /api/admin/contracts/templates/preview
Content-Type: application/json

Body:
{
  "templateId": "tmpl_abc123",
  "standId": "stand_xyz789"
}

Response:
{
  "success": true,
  "variables": {
    "client.fullName": { "value": "John Smith", "source": "Client.name" },
    "stand.price": { "value": "$45,000.00", "source": "Stand.price" },
    "development.name": { "value": "Highlands Estate", "source": "Development.name" },
    "pricing.vatAmount": { "value": "$6,750.00", "source": "calculated" }
  },
  "missingData": [],
  "warnings": ["stand.sizeSqm is null"]
}
```

### 3.4 Set Active Template
```http
PUT /api/admin/contracts/templates/:id/activate

Response:
{
  "success": true,
  "message": "Template activated for Highlands Estate"
}
```

### 3.5 Generate Contract
```http
POST /api/admin/contracts/generate
Content-Type: application/json

Body:
{
  "standId": "stand_xyz789",
  "clientId": "client_abc123", // optional, will use stand's reserved client
  "templateId": "tmpl_abc123", // optional, uses active template if not provided
  "format": "pdf" // "pdf" | "html"
}

Response:
{
  "success": true,
  "contract": {
    "id": "cnt_def456",
    "standId": "stand_xyz789",
    "clientId": "client_abc123",
    "templateId": "tmpl_abc123",
    "content": "<html>...</html>",
    "renderedContent": "<html>with replaced vars...</html>",
    "templateSnapshot": { /* full template state */ },
    "variableValues": { /* all replaced values */ },
    "pdfUrl": "/api/admin/contracts/cnt_def456/download",
    "status": "DRAFT"
  }
}
```

---

## 4. Data Fetch Logic

### Prisma Query (Single Efficient Query)
```typescript
const contractData = await prisma.stand.findUnique({
  where: { id: standId },
  include: {
    development: true,
    reservations: {
      where: { status: { in: ['ACTIVE', 'CONFIRMED', 'PENDING'] } },
      orderBy: { createdAt: 'desc' },
      take: 1,
      include: {
        client: true
      }
    },
    installmentPlans: {
      where: { status: 'ACTIVE' },
      orderBy: { createdAt: 'desc' },
      take: 1
    }
  }
});
```

### Variable Resolution Map
```typescript
const variableResolvers = {
  'client.fullName': (data) => data.reservations[0]?.client?.name,
  'client.email': (data) => data.reservations[0]?.client?.email,
  'stand.price': (data) => formatCurrency(data.price),
  'stand.sizeSqm': (data) => data.sizeSqm,
  'development.name': (data) => data.development?.name,
  'development.depositPercentage': (data) => data.development?.depositPercentage,
  'pricing.vatAmount': (data) => calculateVat(data.price, data.development?.vatPercentage),
  'pricing.depositAmount': (data) => calculateDeposit(data.price, data.development),
  // ... etc
};
```

---

## 5. Security & RBAC

### Authorization Rules
| Role | Upload Template | Generate Contract | View Contract |
|------|-----------------|-------------------|---------------|
| **ADMIN** | Any development | Any stand | All |
| **MANAGER** | Their branch only | Their branch stands | Their branch |
| **DEVELOPER** | Own developments only | Own development stands | Own developments |
| **AGENT** | ❌ | Stands with their assigned clients | Their clients |
| **CLIENT** | ❌ | ❌ | Own contracts only |

### IDOR Prevention
```typescript
// Server-side validation before generation
async function canGenerateContract(user, standId) {
  const stand = await prisma.stand.findUnique({
    where: { id: standId },
    include: { development: true, reservations: { include: { client: true } } }
  });
  
  if (!stand) return false;
  
  switch (user.role) {
    case 'ADMIN': return true;
    case 'MANAGER': return stand.development.branch === user.branch;
    case 'DEVELOPER': return stand.development.developerEmail === user.email;
    case 'AGENT': return stand.reservations.some(r => r.client?.agentId === user.id);
    default: return false;
  }
}
```

---

## 6. Template Versioning & Storage

### Storage Schema
```typescript
interface ContractTemplate {
  id: string;
  name: string;
  description?: string;
  
  // Source (DOCX converted to HTML)
  originalFormat: 'DOCX' | 'HTML';
  content: string; // HTML content with {{variables}}
  
  // Metadata
  variables: string[]; // Extracted variable names
  developmentId?: string; // null = global template
  isGlobal: boolean;
  isActive: boolean;
  version: number;
  
  // Audit
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
}

interface GeneratedContract {
  id: string;
  standId: string;
  clientId: string;
  templateId: string;
  
  // Rendered output
  content: string; // Final HTML with variables replaced
  
  // Versioning snapshot
  templateSnapshot: {
    id: string;
    name: string;
    content: string; // Original template HTML
    variables: string[];
    version: number;
    snapshottedAt: string;
  };
  
  // Variable values used (for audit/debugging)
  variableValues: Record<string, string>;
  
  status: 'DRAFT' | 'SENT' | 'SIGNED' | 'ARCHIVED';
  createdAt: Date;
}
```

---

## 7. Implementation Plan

### Phase 1: Core Engine (Week 1)
- [ ] Install `docx` npm package
- [ ] Create `lib/contract-template-parser.ts`
  - DOCX to HTML conversion
  - Variable extraction regex
  - Validation against allowlist
- [ ] Create `lib/contract-data-resolver.ts`
  - Prisma query builder
  - Variable resolution map
  - Pricing calculations
- [ ] Update `ContractTemplate` Prisma schema
  - Add `originalFormat`, `variables` fields

### Phase 2: API Endpoints (Week 2)
- [ ] `POST /api/admin/contracts/templates/upload`
- [ ] `GET /api/admin/contracts/templates`
- [ ] `POST /api/admin/contracts/templates/preview`
- [ ] `PUT /api/admin/contracts/templates/:id/activate`
- [ ] `POST /api/admin/contracts/generate`
- [ ] Add RBAC middleware to all endpoints

### Phase 3: PDF Generation (Week 3)
- [ ] Choose: Puppeteer vs jsPDF
- [ ] Implement `lib/contract-pdf-generator.ts`
- [ ] Add `GET /api/admin/contracts/:id/download` (PDF)
- [ ] Style contract PDF with Fine & Country branding

### Phase 4: UI Integration (Week 4)
- [ ] Update `ContractTemplateEditor`
  - Add DOCX upload button
  - Show extracted variables
  - Preview with sample data
- [ ] Update `ContractGenerator`
  - Show template preview before generation
  - Display variable values being used
  - Download PDF button

### Phase 5: Testing & Deployment
- [ ] Unit tests for template parser
- [ ] Integration tests for contract generation
- [ ] Test with real DOCX templates
- [ ] Deploy to staging
- [ ] User acceptance testing

---

## 8. Safety Considerations

### DOCX Parsing Safety
- **Sanitize HTML output** — Strip `<script>`, `<iframe>`, event handlers
- **Limit file size** — Max 10MB for DOCX uploads
- **Validate file type** — Check MIME type, not just extension
- **Scan for malicious content** — Basic XSS prevention

### Data Privacy
- **Never log variable values** — May contain PII
- **Encrypt template snapshots** — At rest in database
- **Audit trail** — Log who generated what contract when

### Error Handling
- **Missing data** — Return clear error: "stand.sizeSqm is required but not set"
- **Invalid variables** — Warn about unrecognized tags: "{{invalid.tag}} not found"
- **Template not found** — 404 with helpful message
- **Permission denied** — 403 with role explanation

---

## 9. Dependencies to Add

```json
{
  "dependencies": {
    "docx": "^9.0.0",           // DOCX parsing
    "puppeteer-core": "^21.0.0", // PDF generation (optional)
    "@sparticuz/chromium": "^119.0.0", // For Vercel serverless
    "dompurify": "^3.0.0",      // HTML sanitization
    "jsdom": "^24.0.0"          // Server-side DOM for DOMPurify
  }
}
```

---

## 10. Success Metrics

- ✅ Template upload works with any valid DOCX
- ✅ All merge tags extracted and validated
- ✅ Contract generation completes in < 3 seconds
- ✅ PDF output matches template styling
- ✅ RBAC prevents unauthorized access
- ✅ Old contracts render correctly even after template updates

---

**Ready for implementation. Awaiting confirmation to proceed with Phase 1.**