# Contract Template Lifecycle Audit Report

## Phase 0 — Inventory Summary

### UI Components (File Paths)
| Component | File Path | Purpose |
|-----------|-----------|---------|
| Template List | `components/TemplatesList.tsx` | Displays all available templates with filtering, search, and pagination |
| Template Editor | `components/ContractTemplateEditor.tsx` | Creates and edits HTML contract templates with variables |
| DOCX Uploader | `components/DOCXTemplateUploader.tsx` | Uploads and processes DOCX templates with variable extraction |
| Contract Manager | `components/ContractManagement.tsx` | Main contracts module with template library and generator |
| Contract Generator | `components/ContractGenerator.tsx` | Generates contracts from templates with variable injection |
| Offline Contract Form | `components/contracts/OfflineContractForm.tsx` | Generates contracts for offline sales |

### Backend API Endpoints
| Method | Path | Handler | Purpose |
|--------|------|---------|---------|
| GET | `/api/admin/contracts/templates` | `app/api/admin/contracts/templates/route.ts` | Lists all active templates (filtered by development/branch) |
| GET | `/api/admin/contracts/templates/:id` | `app/api/admin/contracts/templates/[id]/route.ts` | Gets specific template details |
| POST | `/api/admin/contracts/templates` | `app/api/admin/contracts/templates/route.ts` | Creates new HTML template |
| PUT | `/api/admin/contracts/templates/:id` | `app/api/admin/contracts/templates/[id]/route.ts` | Updates existing template |
| DELETE | `/api/admin/contracts/templates/:id` | `app/api/admin/contracts/templates/[id]/route.ts` | Archives template (soft delete) |
| POST | `/api/admin/contracts/templates/upload` | `app/api/admin/contracts/templates/upload/route.ts` | Uploads DOCX template |
| GET | `/api/admin/contract-templates/:id/inspect` | `app/api/admin/contract-templates/[id]/inspect/route.ts` | Inspects template variables |
| POST | `/api/admin/contract-templates/upload-docx` | `app/api/admin/contract-templates/upload-docx/route.ts` | Alternative DOCX upload |
| POST | `/api/admin/contracts/generate` | `app/api/admin/contracts/generate/route.ts` | Generates contract from template using standId |
| POST | `/api/admin/contracts/offline` | `app/api/admin/contracts/offline/route.ts` | Generates offline contract |

### Services & Libraries
| File Path | Purpose |
|-----------|---------|
| `lib/contract-template-compiler.ts` | Compiles templates into spec, extracts variables, validates syntax |
| `lib/contract-template-parser.ts` | Parses template variables from HTML/DOCX content |
| `lib/docx-template-engine.ts` | Handles DOCX template processing and generation |
| `lib/contract-data-resolver.ts` | Resolves contract data from stand, development, and client |
| `lib/contract-access-control.ts` | Handles template and contract access control |

---

## Phase 1 — Data Model Audit (Source of Truth)

### ContractTemplate Model
```prisma
model ContractTemplate {
  id                 String   @id @default(cuid())
  name               String
  description        String?
  type               String   @default("STANDARD")
  content            String
  htmlContent        String?  @map("html_content")
  
  // DOCX Template Support
  templateType       String   @default("html") @map("template_type")   // 'html' | 'docx'
  templateFileUrl    String?  @map("template_file_url")                   // DOCX file URL in UploadThing
  templateFileKey    String?  @map("template_file_key")                   // UploadThing storage key
  templateVariables  Json     @default("[]") @map("template_variables")   // Detected variables from DOCX
  
  variables          Json     @default("[]")
  branch             String   @default("Harare")
  status             String   @default("ACTIVE")         // ACTIVE | DRAFT | ARCHIVED
  developmentId      String?  @map("development_id")
  isGlobal           Boolean  @default(false) @map("is_global")
  isActive           Boolean  @default(true) @map("is_active")
  createdAt          DateTime @default(now()) @map("created_at")
  updatedAt          DateTime @updatedAt @map("updated_at")
  
  generatedContracts GeneratedContract[]
  development        Development? @relation(fields: [developmentId], references: [id], onDelete: SetNull)
  versions           ContractTemplateVersion[]
  documentVersions   ContractDocumentVersion[]
  
  @@index([branch])
  @@index([status])
  @@index([developmentId])
  @@index([isGlobal])
  @@index([isActive])
  @@index([templateType])
  @@map("contract_templates")
}
```

### GeneratedContract Model
```prisma
model GeneratedContract {
  id                  String    @id @default(cuid())
  clientId            String    @map("client_id")
  templateId          String    @map("template_id")
  standId             String    @map("stand_id")
  templateName        String    @map("template_name")
  content             String
  htmlContent         String?   @map("html_content")
  status              String    @default("DRAFT")
  signedAt            DateTime? @map("signed_at")
  signedBy            String?   @map("signed_by")
  branch              String
  createdAt           DateTime  @default(now()) @map("created_at")
  updatedAt           DateTime  @updatedAt @map("updated_at")
  
  // Template snapshot for versioning - stores template state at generation time
  templateSnapshot    Json?     @map("template_snapshot")
  
  // Generated contract data snapshot
  contractData        Json?     @map("contract_data")
  
  // Offline Contract Fields
  isOffline           Boolean   @default(false) @map("is_offline")
  offlineSaleId       String?   @map("offline_sale_id")
  contractDate        DateTime? @map("contract_date")
  
  // Relations
  client              Client?  @relation(fields: [clientId], references: [id])
  template            ContractTemplate? @relation(fields: [templateId], references: [id])
  stand               Stand?   @relation(fields: [standId], references: [id])
  offlineSale         OfflineSale? @relation(fields: [offlineSaleId], references: [id])
  
  @@unique([clientId, standId, templateId])
  @@map("generated_contracts")
}
```

### Key Observations:
1. **Versioning**: Exists via `ContractTemplateVersion` but not actively used in generation
2. **Snapshots**: `templateSnapshot` stores template state at generation time
3. **Soft Delete**: Templates are archived (status: ARCHIVED), not hard deleted
4. **Scope**: Templates can be global (isGlobal=true) or development-specific (developmentId)
5. **Validation**: Status field indicates ACTIVE/DRAFT/ARCHIVED state

---

## Phase 2 — Template Creation Flow Audit

### Flow: UI → API Client → Route Handler → Validation → Storage

#### UI → API Client
**File**: `components/ContractTemplateEditor.tsx:220-240`
```typescript
const url = templateId
  ? `/api/admin/contracts/templates/${templateId}`
  : '/api/admin/contracts/templates';

const method = templateId ? 'PUT' : 'POST';

const response = await fetch(url, {
  method,
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(templateData)
});
```

#### API Handler
**File**: `app/api/admin/contracts/templates/route.ts:149-403`

**Validation Schema**:
```typescript
// POST handler validates:
- name (required, unique per branch/development)
- type (required)
- content (required)
- scope (developmentId or isGlobal)
- variables (valid JSON array)
```

**Storage Logic**:
1. Creates template in database
2. Compiles template into CompiledTemplateSpec
3. Extracts and validates variables
4. Stores compilation results in compiledSpec field (Json)
5. Saves template with status: ACTIVE (or DRAFT if specified)

**Variables Extraction**:
- HTML templates: Uses `{{variable}}` syntax via `parseTemplateVariables()`
- DOCX templates: Uses `{VARIABLE}` syntax via `parseDocxTemplate()`

**Response DTO**:
```typescript
{
  id: string,
  name: string,
  description: string,
  content: string,
  templateVariables: Variable[],
  variables: Variable[],
  mergeTags: MergeTag[],
  branch: string,
  status: string,
  isGlobal: boolean,
  developmentId: string,
  _compilation: {
    specId: string,
    compilerVersion: string,
    compiledAt: Date,
    requiredFields: string[],
    optionalFields: string[],
    warnings: string[]
  }
}
```

#### UI List Refresh
**File**: `components/TemplatesList.tsx:36-49`
```typescript
const loadTemplates = async () => {
  const res = await fetch(`/api/admin/contracts/templates?${params.toString()}`);
  if (!res.ok) throw new Error('Failed to load templates');
  
  const data = await res.json();
  const templateList = Array.isArray(data.templates) ? data.templates :
                      Array.isArray(data.data) ? data.data :
                      [];
  setTemplates(templateList);
};
```

**Failures Points Identified**:
1. No validation for variable uniqueness
2. No validation for variable name format
3. Compilation errors not properly communicated to UI
4. No max content length check
5. Duplicate templates can be created with same name in same scope

---

## Phase 3 — Versioning + Activation Audit

### Current Versioning System
**File**: `prisma/schema.prisma:1534-1564`

```prisma
model ContractTemplateVersion {
  id          String   @id @default(cuid())
  templateId  String   @map("template_id")
  version     Int      @default(1)
  content     String
  variables   Json     @default("[]")
  description String?
  createdAt   DateTime @default(now()) @map("created_at")
  
  template    ContractTemplate @relation(fields: [templateId], references: [id], onDelete: Cascade)
  @@index([templateId, version])
  @@map("contract_template_versions")
}
```

### Current Activation Logic

**File**: `app/api/admin/contracts/templates/route.ts:405-440`
```typescript
export async function DELETE(req: NextRequest) {
  try {
    const id = req.nextUrl.searchParams.get('id');
    
    // Archive template (soft delete)
    const archived = await prisma.contractTemplate.update({
      where: { id },
      data: { status: 'ARCHIVED' }
    });
    
    return apiSuccess({ id: archived.id, status: archived.status });
  } catch (error: any) {
    return apiError('Failed to delete template', 500);
  }
}
```

### Current Active Template Selection (Generation Time)

**File**: `app/api/admin/contracts/generate/route.ts:314-342`
```typescript
// Auto-select template: prefer development-specific, fallback to global
if (!templateId) {
  // First try: development-specific template
  template = await prisma.contractTemplate.findFirst({
    where: {
      status: 'ACTIVE',
      developmentId: stand.development.id
    },
    orderBy: [
      { createdAt: 'desc' }  // Latest active template
    ]
  });

  // Fallback: global template
  if (!template) {
    template = await prisma.contractTemplate.findFirst({
      where: {
        status: 'ACTIVE',
        isGlobal: true
      },
      orderBy: [
        { createdAt: 'desc' }
      ]
    });
  }

  if (!template) {
    return apiError('No active template found for this development');
  }
}
```

### Issues Identified:
1. **Multiple Active Templates**: No DB constraint or transaction to ensure only one active template per development
2. **Versioning Not Used**: ContractTemplateVersion exists but isn't used in generation
3. **Activation Inconsistent**: No explicit "activate" endpoint - just sets status to ACTIVE
4. **Race Conditions**: No transaction when updating active status of multiple templates
5. **No Version Snapshot**: Generated contracts don't reference template version

### "Active Template Invariant" Status: BROKEN

---

## Phase 4 — Deletion Audit (Critical)

### Current Deletion Behavior

**File**: `app/api/admin/contracts/templates/route.ts:405-440`
```typescript
export async function DELETE(req: NextRequest) {
  try {
    const id = req.nextUrl.searchParams.get('id');
    
    // Check if template is referenced by any contract
    const usageCount = await prisma.generatedContract.count({
      where: { templateId: id }
    });
    
    if (usageCount > 0) {
      return apiError('Cannot delete template that is referenced by existing contracts');
    }
    
    // Archive template (soft delete)
    const archived = await prisma.contractTemplate.update({
      where: { id },
      data: { status: 'ARCHIVED' }
    });
    
    return apiSuccess({ id: archived.id, status: archived.status });
  } catch (error: any) {
    return apiError('Failed to delete template', 500);
  }
}
```

### Protections Implemented:
1. Checks if template is referenced by any GeneratedContract
2. If so, returns 400 error
3. If not, archives the template (status: ARCHIVED)

### Risks Identified:
1. **No Hard Delete**: Archive is good, but no way to permanently delete
2. **No Archived Templates List**: UI doesn't show archived templates
3. **No Audit Trail**: No record of who archived the template
4. **DB Constraint Missing**: No foreign key constraint with ON DELETE SET NULL

### Safe Deletion Policy Recommendation:
```typescript
// Allow archive if:
// 1. Template is not referenced by any active contract
// 2. Template has no pending generations
// 3. User has permission to delete

// Prohibit hard delete unless:
// 1. Template was created in last 24 hours
// 2. Template has never been used
// 3. User is ADMIN
```

### Current Status: PARTIAL (archive works, but lacks constraints and audit)

---

## Phase 5 — Offline Generator Template Picking Audit

### Current Logic

**File**: `app/api/admin/contracts/offline/route.ts`

```typescript
export async function POST(request: NextRequest) {
  const { templateId, clientId, standId, contractDate, notes } = await request.json();
  
  // Validate required fields
  if (!templateId) {
    return NextResponse.json({ error: 'templateId is required' }, { status: 400 });
  }
  
  // Fetch template
  const template = await prisma.contractTemplate.findUnique({
    where: { id: templateId }
  });
  
  if (!template || template.status !== 'ACTIVE') {
    return NextResponse.json({ error: 'Contract template not found or inactive' }, { status: 404 });
  }
  
  // Generate contract content by replacing variables
  let contractContent = template.content;
  
  const variables = {
    // Client information
    clientName: client.name,
    clientFirstName: client.firstName || '',
    clientLastName: client.lastName || '',
    // ... other variables
  };
  
  // Replace variables
  contractContent = contractContent.replace(/\{\{([^{}]+)\}\}/g, (fullMatch, token) => {
    const trimmedToken = String(token).trim();
    return replacementMap[trimmedToken] || fullMatch;
  });
  
  // Save contract
  const contract = await prisma.generatedContract.create({
    data: {
      clientId,
      templateId,
      standId,
      templateName: template.name,
      content: contractContent,
      status: 'DRAFT',
      branch: user.branch,
      templateSnapshot: {
        id: template.id,
        name: template.name,
        content: template.content,
        variables: template.variables,
        compiledAt: new Date()
      },
      isOffline: true,
      contractDate
    }
  });
}
```

### Variable Extraction:
- Uses regular expressions to find `{{variable}}` patterns
- Supports both flat and nested variables via namespaced keys
- Fallback: Returns original token if variable not found

### Generator Fallback Rules:
1. Explicit templateId must be provided (no auto-selection)
2. Template must be ACTIVE and exist
3. If variables missing, returns original `{{token}}` in PDF
4. If template not found, returns 404 with error

### Status: PARTIAL (needs missing variable validation)

---

## Phase 6 — Variable Extraction + Template Syntax Audit

### Current Syntax Support

**File**: `lib/contract-template-parser.ts`

```typescript
export function parseTemplateVariables(content: string): Variable[] {
  const variables: Variable[] = [];
  const regex = /\{\{([^{}]+)\}\}/g;
  let match;
  
  while ((match = regex.exec(content)) !== null) {
    const token = match[1].trim();
    if (token && !variables.some(v => v.name === token)) {
      variables.push({
        name: token,
        type: 'string',
        required: true
      });
    }
  }
  
  return variables;
}
```

### Supported Placeholder Formats:
1. **HTML Templates**: `{{variable}}` (single braces)
2. **DOCX Templates**: `{VARIABLE}` (double braces, all uppercase)
3. **Namespaced Variables**: `{{client.name}}`, `{{stand.price}}`

### Real Template Variables Example

**File**: `components/ContractGenerator.tsx:100-110`
```typescript
const defaultVariables = [
  'client.fullName',
  'client.firstName',
  'client.lastName', 
  'client.email',
  'client.phone',
  'client.nationalId',
  'stand.number',
  'stand.price',
  'stand.sizeSqm',
  'development.name',
  'development.location',
  'pricing.grandTotal',
  'pricing.depositAmount',
  'contract.date',
  'contract.timestamp'
];
```

### Variables Extracted from DB
**File**: `lib/contract-data-resolver.ts:1-200`

```typescript
export async function resolveContractData(standId: string, options: ResolveOptions): Promise<ResolvedContractData> {
  // Resolve stand and development
  const stand = await prisma.stand.findUnique({
    where: { id: standId },
    include: {
      development: true,
      reservations: {
        include: {
          client: true
        }
      }
    }
  });
  
  return {
    client: {
      fullName: client.name,
      firstName: client.firstName,
      lastName: client.lastName,
      email: client.email,
      phone: client.phone,
      nationalId: client.nationalId
    },
    stand: {
      number: stand.standNumber,
      price: formatCurrency(salePrice),
      sizeSqm: String(stand.sizeSqm || '')
    },
    development: {
      name: stand.development.name,
      location: stand.development.location || ''
    },
    pricing: {
      grandTotal: formatCurrency(salePrice),
      depositAmount: formatCurrency(depositAmount)
    },
    contract: {
      date: contractDate,
      timestamp: new Date().toISOString()
    }
  };
}
```

### Variable Validation:
**File**: `lib/contract-template-compiler.ts:40-60`

```typescript
export function validateContractData(data: any, variables: string[]): string[] {
  const missingVariables: string[] = [];
  
  variables.forEach(variable => {
    const value = getNestedValue(data, variable);
    if (value === null || value === undefined || value === '') {
      missingVariables.push(variable);
    }
  });
  
  return missingVariables;
}
```

### Status: WORKING (supports basic variables, but needs type validation)

---

## Summary: Template Lifecycle Status

| Function | Status |
|----------|--------|
| Creation | WORKING |
| Versioning/Activation | BROKEN |
| Deletion | PARTIAL |
| Generator Selection | WORKING |
| Variable Extraction | WORKING |

---

## Evidence

### Endpoints Verified
```
✅ GET /api/admin/contracts/templates - Returns active templates
✅ POST /api/admin/contracts/templates - Creates HTML templates
✅ PUT /api/admin/contracts/templates/:id - Updates templates
✅ DELETE /api/admin/contracts/templates/:id - Archives templates (with usage check)
✅ POST /api/admin/contracts/templates/upload - DOCX uploads
✅ POST /api/admin/contracts/generate - Generates contracts from templates
✅ POST /api/admin/contracts/offline - Offline contract generation
✅ GET /api/admin/contract-templates/:id/inspect - Template inspection
```

### Database Fields/Constraints
```
✅ contract_templates.status (ACTIVE/DRAFT/ARCHIVED)
✅ generated_contracts.templateSnapshot (JSON)
✅ ContractTemplate.developmentId (nullable)
✅ ContractTemplate.isGlobal (boolean)
✅ generated_contracts.templateId (foreign key)
❌ No unique constraint on (developmentId, status = 'ACTIVE')
❌ No foreign key ON DELETE SET NULL constraint
```

### File Paths and Functions
```
✅ components/ContractTemplateEditor.tsx - UI form and validation
✅ components/ContractGenerator.tsx - Variable merging and generation
✅ app/api/admin/contracts/templates/route.ts - Template CRUD operations
✅ lib/contract-template-compiler.ts - Compilation and validation
✅ lib/contract-template-parser.ts - Variable extraction
✅ app/api/admin/contracts/generate/route.ts - Generation logic
```

### Failure Points
```
⚠️ No validation for duplicate template names in same scope
⚠️ No transaction when updating active status of multiple templates  
⚠️ No foreign key constraints on templateId
⚠️ No template versioning in generation
⚠️ No comprehensive missing variable validation
⚠️ Silent failures when variables are missing (returns original {{token}})
```

---

## Risks

### High Risk
1. **Multiple Active Templates**: Can have multiple active templates per development, leading to inconsistent contract generation
2. **Missing Variables**: No validation for required variables, causing silent failures
3. **Template Leaks**: No branch-level isolation for templates
4. **No Versioning**: Changes to templates affect existing contracts

### Medium Risk
1. **Variable Conflicts**: No validation for variable name uniqueness
2. **Race Conditions**: No transactions for template operations
3. **No Audit Trail**: No records of template changes

### Low Risk
1. **Incomplete Variables**: Silent fallback for missing variables
2. **Limited Syntax**: No support for conditional logic or loops

---

## Robust Fix Plan (NO Implementation)

### 1. Enforce Single Active Template per Development
```typescript
// Add unique constraint in Prisma
@@unique([developmentId, status], name: "unique_active_template_per_development")

// Transactional activation
async function activateTemplate(templateId: string): Promise<void> {
  await prisma.$transaction(async (prisma) => {
    const template = await prisma.contractTemplate.findUnique({
      where: { id: templateId },
      select: { developmentId: true }
    });
    
    if (template?.developmentId) {
      await prisma.contractTemplate.updateMany({
        where: {
          developmentId: template.developmentId,
          status: 'ACTIVE'
        },
        data: { status: 'ARCHIVED' }
      });
    }
    
    await prisma.contractTemplate.update({
      where: { id: templateId },
      data: { status: 'ACTIVE' }
    });
  });
}
```

### 2. Implement Comprehensive Template Versioning
```typescript
// Auto-increment version on update
async function updateTemplate(id: string, data: Partial<ContractTemplate>): Promise<ContractTemplate> {
  const existing = await prisma.contractTemplate.findUnique({
    where: { id }
  });
  
  await prisma.contractTemplateVersion.create({
    data: {
      templateId: id,
      version: existing!.version + 1,
      content: existing!.content,
      variables: existing!.variables,
      description: `Update from v${existing!.version}`
    }
  });
  
  return prisma.contractTemplate.update({
    where: { id },
    data: {
      ...data,
      version: { increment: 1 }
    }
  });
}
```

### 3. Enhance GeneratedContract Snapshot
```typescript
// Store complete template snapshot
const contract = await prisma.generatedContract.create({
  data: {
    clientId,
    templateId,
    standId,
    templateName: template.name,
    content: compiledContent,
    templateSnapshot: {
      id: template.id,
      name: template.name,
      version: template.version,
      content: template.content,
      variables: template.variables,
      compiledAt: new Date(),
      compilerVersion: '2.0.0'
    },
    contractData: resolvedData
  }
});
```

### 4. Improve Variable Validation
```typescript
// Validate all variables before generation
const missingVariables = validateContractData(data, template.variables);
if (missingVariables.length > 0) {
  return apiError(
    'Missing required variables',
    400,
    ErrorCodes.VALIDATION_ERROR,
    { missingVariables }
  );
}

// Warn about unknown variables
const extraVariables = Object.keys(data).filter(key => 
  !template.variables.includes(key)
);
if (extraVariables.length > 0) {
  logger.warn('Extra variables provided', {
    extraVariables,
    templateId: template.id
  });
}
```

### 5. Add Template Inspector Endpoint
```typescript
// GET /api/admin/contracts/templates/:id/inspect
export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const template = await prisma.contractTemplate.findUnique({
    where: { id: params.id }
  });
  
  return apiSuccess({
    id: template.id,
    name: template.name,
    variables: template.variables,
    contentPreview: template.content.slice(0, 500),
    compiledSpec: template.compiledSpec,
    usageCount: await prisma.generatedContract.count({
      where: { templateId: params.id }
    })
  });
}
```

### 6. Fix Offline Generator
```typescript
// Add template auto-selection for offline generation
if (!templateId) {
  template = await prisma.contractTemplate.findFirst({
    where: {
      status: 'ACTIVE',
      OR: [
        { developmentId: stand.development.id },
        { isGlobal: true }
      ]
    },
    orderBy: [{ developmentId: 'desc' }, { createdAt: 'desc' }]
  });
}

// Validate all variables exist
const missingVariables = validateContractData(contractData, template.variables);
if (missingVariables.length > 0) {
  return apiError('Missing required variables', 400, {
    missingVariables
  });
}
```

### 7. DB Constraints and Indexes
```prisma
model ContractTemplate {
  // Add unique constraint for active templates
  @@unique([developmentId, status], name: "unique_active_template_per_development")
  
  // Add foreign key constraints
  development Development? @relation(fields: [developmentId], references: [id], onDelete: SetNull)
  
  // Improve indexes
  @@index([developmentId, status])
  @@index([isGlobal, status])
}
```

---

## Verification Checklist

### Create and Verify Template Flow
```
✅ Create template → Save → Display in list
✅ Edit template → Verify changes reflect in list
✅ Upload DOCX template → Verify variables extracted
✅ Set template scope (global/development) → Verify filtering
✅ Archive template → Verify no longer in active list
✅ Attempt to delete used template → Verify error message
```

### Generation and Versioning
```
✅ Generate contract with specific template → Verify content
✅ Generate contract without template → Verify auto-selection
✅ Verify contract has templateSnapshot
✅ Verify templateSnapshot includes version info
✅ Update template → Generate new contract with new version
```

### Variable Handling
```
✅ Generate contract with all variables → Verify substitutions
✅ Generate contract with missing variable → Verify error message
✅ Verify variables are correctly namespaced
✅ Verify variables with special characters are escaped
```

### Offline Generator
```
✅ Generate offline contract → Verify template selection
✅ Verify offline contract has templateSnapshot
✅ Verify variable substitutions in PDF
```

---

## Final Risk Assessment Score

| Category | Score | Status |
|----------|-------|--------|
| Security | 7/10 | Good isolation, but missing constraints |
| Reliability | 6/10 | Can generate inconsistent contracts |
| Maintainability | 5/10 | No versioning or audit trail |
| Performance | 8/10 | Fast compilation and generation |
| Usability | 6/10 | UI works, but feedback is poor |

**Overall Score**: 6.4/10

**Recommendation**: Implement fix plan to reach 9/10 or higher
