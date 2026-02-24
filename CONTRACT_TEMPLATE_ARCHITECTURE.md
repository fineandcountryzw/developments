# Contract Template System Architecture Manual

**Version:** 1.0  
**Date:** February 9, 2026  
**Status:** ✅ Complete

---

## Table of Contents

1. [System Overview](#1-system-overview)
2. [Architecture Diagram](#2-architecture-diagram)
3. [Data Models](#3-data-models)
4. [API Endpoints](#4-api-endpoints)
5. [DOCX Template Processing](#5-docx-template-processing)
6. [Document Versioning](#6-document-versioning)
7. [PDF Generation](#7-pdf-generation)
8. [Access Control](#8-access-control)
9. [UploadThing Integration](#9-uploadthing-integration)
10. [Usage Guide](#10-usage-guide)

---

## 1. System Overview

The Contract Template System is a comprehensive module for managing contract templates, generating contracts in multiple formats (HTML, DOCX, PDF), and maintaining version history for compliance and audit purposes.

### Key Capabilities

| Capability | Status | Description |
|------------|---------|-------------|
| HTML Templates | ✅ | Traditional HTML-based contract templates with variable substitution |
| DOCX Templates | ✅ | Microsoft Word templates with advanced formatting |
| Template Versioning | ✅ | Track changes to templates over time |
| Document Versioning | ✅ | Store generated contract documents with versioning |
| PDF Generation | ✅ | Convert contracts to PDF format |
| Multi-Signer Contracts | ✅ | Support for 4+ signatories (Client, Developer, Lawyer, Principal Agent) |
| DocuSeal Integration | ✅ | E-signature workflow with DocuSeal |
| Role-Based Access | ✅ | Granular permissions for template management |

---

## 2. Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         Contract Template System                             │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐       │
│  │  Admin Portal    │    │  Manager Portal │    │ Developer Portal│       │
│  └────────┬────────┘    └────────┬────────┘    └────────┬────────┘       │
│           │                      │                      │                  │
│           └──────────────────────┼──────────────────────┘                  │
│                                  │                                          │
│                                  ▼                                          │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                      API Gateway / Next.js                          │   │
│  │  ┌──────────────────────────────────────────────────────────────┐  │   │
│  │  │                    Access Control Layer                       │  │   │
│  │  │  - buildContractScopeWhere()  │ canManageTemplate()         │  │   │
│  │  │  - canUploadDocxTemplate()   │ canDeleteDocxTemplate()    │  │   │
│  │  └──────────────────────────────────────────────────────────────┘  │   │
│  │                                                                      │   │
│  │  ┌──────────────────────────────────────────────────────────────┐  │   │
│  │  │                   Template Routes                             │  │   │
│  │  │  - GET    /api/admin/contracts/templates                     │  │   │
│  │  │  - POST   /api/admin/contracts/templates                    │  │   │
│  │  │  - POST   /api/admin/contract-templates/upload-docx         │  │   │
│  │  │  - GET    /api/admin/contracts/templates/[id]               │  │   │
│  │  │  - PUT    /api/admin/contracts/templates/[id]               │  │   │
│  │  │  - DELETE /api/admin/contracts/templates/[id]               │  │   │
│  │  └──────────────────────────────────────────────────────────────┘  │   │
│  │                                                                      │   │
│  │  ┌──────────────────────────────────────────────────────────────┐  │   │
│  │  │                   Contract Routes                            │  │   │
│  │  │  - POST   /api/admin/contracts                               │  │   │
│  │  │  - GET    /api/admin/contracts                               │  │   │
│  │  │  - POST   /api/admin/contracts/[id]/sign                    │  │   │
│  │  │  - POST   /api/admin/contracts/[id]/send                   │  │   │
│  │  │  - GET    /api/admin/contracts/[id]/download                │  │   │
│  │  └──────────────────────────────────────────────────────────────┘  │   │
│  │                                                                      │   │
│  │  ┌──────────────────────────────────────────────────────────────┐  │   │
│  │  │                   UploadThing Routes                          │  │   │
│  │  │  - docxTemplate()  - Upload DOCX template files            │  │   │
│  │  │  - signedContractPdf() - Store signed PDFs                  │  │   │
│  │  └──────────────────────────────────────────────────────────────┘  │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                  │                                          │
│                                  ▼                                          │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                       Service Layer                                  │   │
│  │  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐      │   │
│  │  │ ContractGenerator│  │DocxTemplate    │  │ContractTemplate│      │   │
│  │  │                  │  │Engine          │  │Compiler        │      │   │
│  │  │ - generateFrom   │  │ - extractVars  │  │ - compileTemp  │      │   │
│  │  │   Template()    │  │ - generateDocx │  │ - validateTags │      │   │
│  │  │ - createVersion()│  │ - validateDocx │  │ - parseMerges │      │   │
│  │  └─────────────────┘  └─────────────────┘  └─────────────────┘      │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                  │                                          │
│                                  ▼                                          │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                          Database (Neon/PostgreSQL)                   │   │
│  │  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐      │   │
│  │  │contract_templates│  │generated_       │  │contract_doc_   │      │   │
│  │  │                  │  │contracts        │  │ument_versions  │      │   │
│  │  │ - template_type │  │ - docuseal_*   │  │ - document_type│      │   │
│  │  │ - template_file │  │ - signers       │  │ - storage_key │      │   │
│  │  │   _url/key      │  │ - html_content  │  │ - checksum     │      │   │
│  │  │ - template_vars │  │ - contract_data │  │                │      │   │
│  │  └─────────────────┘  └─────────────────┘  └─────────────────┘      │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 3. Data Models

### 3.1 ContractTemplate

```prisma
model ContractTemplate {
  id                 String   @id @default(cuid())
  name               String
  description        String?
  type               String   @default("STANDARD")
  content            String
  htmlContent        String?  @map("html_content")
  
  // DOCX Template Support
  templateType       String   @default("html") @map("template_type")
                      // 'html' | 'docx'
  templateFileUrl    String?  @map("template_file_url")
                      // UploadThing URL for DOCX file
  templateFileKey    String?  @map("template_file_key")
                      // UploadThing storage key
  templateVariables  Json     @default("[]") @map("template_variables")
                      // Detected variables from DOCX
  
  variables          Json     @default("[]")
  branch             String   @default("Harare")
  status             String   @default("ACTIVE")
  developmentId      String?  @map("development_id")
  isGlobal           Boolean  @default(false) @map("is_global")
  isActive           Boolean  @default(true) @map("is_active")
  
  createdAt          DateTime @default(now()) @map("created_at")
  updatedAt          DateTime @updatedAt @map("updated_at")
  
  generatedContracts GeneratedContract[]
  versions           ContractTemplateVersion[]
  documentVersions   ContractDocumentVersion[]
}
```

### 3.2 GeneratedContract

```prisma
model GeneratedContract {
  id                 String    @id @default(cuid())
  clientId           String    @map("client_id")
  templateId         String    @map("template_id")
  standId            String    @map("stand_id")
  templateName       String    @map("template_name")
  content            String
  htmlContent        String?   @map("html_content")
  status             String    @default("DRAFT")
  signedAt           DateTime? @map("signed_at")
  signedBy           String?    @map("signed_by")
  branch             String
  
  // Template snapshot for versioning
  templateSnapshot   Json?     @map("template_snapshot")
  
  // Contract data snapshot
  contractData       Json?     @map("contract_data")
  
  // DocuSeal Integration
  docusealSubmissionId String?  @map("docuseal_submission_id")
  docusealStatus      String?   @map("docuseal_status")
  docusealSignerClientId     Int?  @map("docuseal_signer_client_id")
  docusealSignerClientStatus String? @map("docuseal_signer_client_status")
  docusealSignerDevId        Int?  @map("docuseal_signer_dev_id")
  docusealSignerDevStatus     String? @map("docuseal_signer_dev_status")
  signedPdfUrl        String?   @map("signed_pdf_url")
  sentForSignatureAt  DateTime? @map("sent_for_signature_at")
  fullySignedAt       DateTime? @map("fully_signed_at")
  developerEmail      String?   @map("developer_email")
  developerName       String?   @map("developer_name")
  
  createdAt           DateTime  @default(now()) @map("created_at")
  updatedAt           DateTime  @updatedAt @map("updated_at")
  
  client              Client?   @relation(fields: [clientId], references: [id])
  template            ContractTemplate? @relation(fields: [templateId], references: [id])
  stand               Stand?    @relation(fields: [standId], references: [id])
  signers             GeneratedContractSigner[]
  documentVersions    ContractDocumentVersion[]
}
```

### 3.3 ContractDocumentVersion

```prisma
model ContractDocumentVersion {
  id            String   @id @default(cuid())
  contractId    String   @map("contract_id")
  templateId    String   @map("template_id")
  version       Int
  documentType  String   @map("document_type")
                // 'html' | 'docx' | 'pdf'
  storageKey    String   @map("storage_key")
  storageUrl    String   @map("storage_url")
  fileSize      Int?     @map("file_size")
  checksum      String?                // SHA-256 hash
  generatedAt   DateTime @default(now()) @map("generated_at")
  generatedBy   String?  @map("generated_by")
  
  contract      GeneratedContract @relation(fields: [contractId], references: [id], onDelete: Cascade)
  template      ContractTemplate @relation(fields: [templateId], references: [id], onDelete: Cascade)
  
  @@unique([contractId, version, documentType])
  @@index([contractId])
  @@index([templateId])
}
```

### 3.4 GeneratedContractSigner

```prisma
model GeneratedContractSigner {
  id              String   @id @default(cuid())
  contractId      String   @map("contract_id")
  role            String   @map("role")
                  // client | developer | lawyer | principal_agent
  name            String?  @map("name")
  email           String   @map("email")
  status          String   @default("not_invited") @map("status")
                  // not_invited | pending | opened | signed | declined | expired
  docusealSignerId Int?    @map("docuseal_signer_id")
  invitedAt       DateTime? @map("invited_at")
  openedAt        DateTime? @map("opened_at")
  signedAt        DateTime? @map("signed_at")
  declinedAt      DateTime? @map("declined_at")
  createdAt       DateTime  @default(now()) @map("created_at")
  updatedAt       DateTime  @updatedAt @map("updated_at")
  
  contract        GeneratedContract @relation(fields: [contractId], references: [id], onDelete: Cascade)
  
  @@unique([contractId, role])
}
```

---

## 4. API Endpoints

### 4.1 Template Management

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/admin/contracts/templates` | List all templates (with role-based filtering) |
| POST | `/api/admin/contracts/templates` | Create new template |
| GET | `/api/admin/contracts/templates/[id]` | Get template details |
| PUT | `/api/admin/contracts/templates/[id]` | Update template |
| DELETE | `/api/admin/contracts/templates/[id]` | Delete template |
| POST | `/api/admin/contract-templates/upload-docx` | Upload DOCX template file |

### 4.2 Contract Management

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/admin/contracts` | List all contracts |
| POST | `/api/admin/contracts` | Generate new contract |
| GET | `/api/admin/contracts/[id]` | Get contract details |
| PUT | `/api/admin/contracts/[id]` | Update contract |
| POST | `/api/admin/contracts/[id]/sign` | Sign contract |
| POST | `/api/admin/contracts/[id]/send` | Send for signature |
| GET | `/api/admin/contracts/[id]/download` | Download contract document |

### 4.3 Client Contract Access

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/client/contracts` | List client's contracts |
| GET | `/api/client/documents/[id]/download` | Download document |

---

## 5. DOCX Template Processing

### 5.1 Supported Variable Formats

DOCX templates support the following variable formats:

| Format | Example | Description |
|--------|---------|-------------|
| Simple namespace | `{{client.fullName}}` | Client's full name |
| Stand details | `{{stand.standNumber}}` | Stand number |
| Development | `{{development.name}}` | Development name |
| Pricing | `{{pricing.totalPrice}}` | Total price |
| Terms | `{{terms.paymentTerms}}` | Payment terms |
| Loops | `{% for item in items %}`...`{% endfor %}` | Repeat sections |

### 5.2 Variable Namespaces

```typescript
const VALID_NAMESPACES = [
  'client',      // Client information
  'stand',       // Stand details
  'development', // Development information
  'terms',       // Terms and conditions
  'pricing',     // Pricing information
  'contract',    // Contract metadata
  'loop',        // Loop arrays
];
```

### 5.3 DOCX Template Engine

Located at: [`lib/docx-template-engine.ts`](lib/docx-template-engine.ts)

```typescript
// Extract variables from DOCX
const variables = extractVariablesFromDocx(docxBuffer);

// Validate template structure
const validation = validateDocxTemplate(fileBuffer);

// Generate DOCX with variables
const generated = generateDocxFromTemplate(templateBuffer, context);
```

---

## 6. Document Versioning

### 6.1 Versioning Strategy

Each generated contract maintains multiple document versions:

```
Contract: CNT-001
├── Version 1 (Draft)
│   ├── html (stored in contract_document_versions)
│   ├── docx (generated from template)
│   └── pdf (converted)
├── Version 2 (Sent for Signature)
│   ├── html
│   ├── docx
│   └── pdf
└── Version 3 (Signed)
    ├── html
    ├── docx
    └── pdf (signed from DocuSeal)
```

### 6.2 Version Information

Each version stores:
- **storageKey**: UploadThing storage key
- **storageUrl**: Download URL
- **fileSize**: File size in bytes
- **checksum**: SHA-256 hash for integrity
- **generatedAt**: Creation timestamp
- **generatedBy**: User who triggered generation

### 6.3 Accessing Versions

```typescript
// Get all versions
const versions = await ContractGenerator.getDocumentVersions(contractId);

// Get latest PDF version
const latestPdf = await ContractGenerator.getLatestDocumentVersion(
  contractId, 
  'pdf'
);
```

---

## 7. PDF Generation

### 7.1 PDF Conversion Options

| Source | Method | Library |
|--------|--------|---------|
| HTML | `convertHtmlToPdf()` | html-pdf-node |
| DOCX | `convertDocxToPdf()` | libreoffice-convert |
| DocuSeal | Webhook | Native |

### 7.2 PDF Storage

Generated PDFs are stored via UploadThing with the following flow:

```typescript
// 1. Generate PDF from HTML/DOCX
const pdfBuffer = await generatePdfFromHtml(htmlContent);

// 2. Upload to UploadThing
const uploadResult = await uploadToUploadThing(pdfBuffer, {
  contractId: contract.id,
  documentType: 'pdf'
});

// 3. Create version record
await ContractGenerator.createDocumentVersion(
  contract.id,
  template.id,
  version,
  'pdf',
  uploadResult.key,
  uploadResult.url,
  pdfBuffer.length,
  calculateChecksum(pdfBuffer),
  userId
);
```

---

## 8. Access Control

### 8.1 Role Permissions

| Role | Create Templates | Upload DOCX | Manage Templates | View Contracts |
|------|-----------------|-------------|-----------------|----------------|
| ADMIN | ✅ | ✅ | ✅ (All) | ✅ (All) |
| MANAGER | ✅ | ✅ | ✅ (Branch) | ✅ (Branch) |
| DEVELOPER | ❌ | ✅ (Own Dev) | ❌ | ✅ (Own Dev) |
| AGENT | ❌ | ❌ | ❌ | ✅ (Assigned) |
| CLIENT | ❌ | ❌ | ❌ | ✅ (Own) |

### 8.2 Access Control Functions

Located at: [`lib/contract-access-control.ts`](lib/contract-access-control.ts)

```typescript
// Template scope filtering
const whereClause = await buildTemplateScopeWhere(user, filters);

// Permission checks
const canUpload = await canUploadDocxTemplate(user, templateId);
const canManage = await canManageTemplate(user, developmentId);
const canView = await canViewTemplate(user, templateId);
```

### 8.3 Template Visibility Rules

- **Global Templates**: Visible to all authenticated users
- **Branch Templates**: Visible to users in the same branch
- **Development Templates**: Visible to users with development access

---

## 9. UploadThing Integration

### 9.1 File Router Configuration

Located at: [`app/api/uploadthing/core.ts`](app/api/uploadthing/core.ts)

```typescript
docxTemplate: f({
  blob: { maxFileSize: "16MB", maxFileCount: 1 },
})
.input(z.object({ templateId: z.string(), developmentId: z.string().optional() }))
.middleware(async ({ req, input }) => {
  // Role-based access validation
})
.onUploadComplete(async ({ metadata, file }) => {
  // Update template with file info
  await prisma.contractTemplate.update({
    where: { id: metadata.templateId },
    data: {
      templateType: 'docx',
      templateFileUrl: file.url,
      templateFileKey: file.key,
    },
  });
})
```

### 9.2 Supported File Types

| Type | Max Size | Purpose |
|------|----------|---------|
| DOCX | 16MB | Contract templates |
| PDF | 16MB | Signed contracts |
| Images | 8MB | Development gallery |
| GeoJSON | 4MB | Property maps |

---

## 10. Usage Guide

### 10.1 Creating a DOCX Template

1. **Design Template**: Create a DOCX file with placeholders
2. **Add Variables**: Use `{{namespace.field}}` format
3. **Validate**: Use the template parser to detect variables
4. **Upload**: Upload via the admin interface
5. **Test**: Generate a test contract

### 10.2 Generating a Contract

```typescript
// 1. Select template
const template = await prisma.contractTemplate.findUnique({
  where: { id: templateId }
});

// 2. Prepare variables
const variables = {
  client: {
    fullName: 'John Doe',
    email: 'john@example.com',
  },
  stand: {
    standNumber: 'A123',
    sizeSqm: 500,
  },
  pricing: {
    totalPrice: 50000,
    deposit: 15000,
  },
};

// 3. Generate contract
const contract = await ContractGenerator.generateFromTemplate(
  templateId,
  clientId,
  dealId,
  variables,
  'Purchase Agreement',
  userId,
  'Harare'
);

// 4. Create document versions
if (template.templateType === 'docx') {
  // Generate and upload DOCX
  const docxBuffer = await ContractGenerator.generateDocxDocument(
    templateBuffer,
    context
  );
  
  // Upload and create version
  await uploadAndCreateVersion(contract.id, template.id, 'docx', docxBuffer);
}
```

### 10.3 Downloading a Contract

```typescript
// Get latest document version
const version = await ContractGenerator.getLatestDocumentVersion(
  contractId,
  'pdf'
);

// Redirect to download URL
return NextResponse.redirect(version.storageUrl);
```

---

## Appendix A: Error Codes

| Code | Meaning | Resolution |
|------|---------|------------|
| TEMPLATE_NOT_FOUND | Template ID invalid | Verify template exists |
| INVALID_TEMPLATE_TYPE | Wrong template format | Use correct template type |
| MISSING_VARIABLES | Required variables not provided | Check variable definitions |
| PERMISSION_DENIED | User lacks access | Check role permissions |
| DOCX_VALIDATION_FAILED | Invalid DOCX structure | Re-export DOCX file |
| UPLOAD_FAILED | UploadThing error | Retry upload |

---

## Appendix B: Database Indexes

```sql
-- Template indexes
CREATE INDEX idx_contract_templates_template_type ON contract_templates(template_type);
CREATE INDEX idx_contract_templates_status ON contract_templates(status);
CREATE INDEX idx_contract_templates_development ON contract_templates(development_id);
CREATE INDEX idx_contract_templates_is_global ON contract_templates(is_global);
CREATE INDEX idx_contract_templates_is_active ON contract_templates(is_active);

-- Contract indexes
CREATE INDEX idx_generated_contracts_client ON generated_contracts(client_id);
CREATE INDEX idx_generated_contracts_stand ON generated_contracts(stand_id);
CREATE INDEX idx_generated_contracts_status ON generated_contracts(status);
CREATE INDEX idx_generated_contracts_branch ON generated_contracts(branch);
CREATE INDEX idx_generated_contracts_created_at ON generated_contracts(created_at DESC);
CREATE INDEX idx_generated_contracts_docuseal ON generated_contracts(docuseal_submission_id);

-- Document version indexes
CREATE INDEX idx_contract_document_versions_contract ON contract_document_versions(contract_id);
CREATE INDEX idx_contract_document_versions_template ON contract_document_versions(template_id);
```

---

## Appendix C: Related Documentation

- [CONTRACTS_MODULE_AUDIT.md](CONTRACTS_MODULE_AUDIT.md) - Complete module audit
- [CONTRACT_ENGINE_DESIGN.md](CONTRACT_ENGINE_DESIGN.md) - Engine design documentation
- [DEVELOPMENT_SPECIFIC_CONTRACT_AUDIT.md](DEVELOPMENT_SPECIFIC_CONTRACT_AUDIT.md) - Development-specific contracts
- [DOCUSEAL_INTEGRATION_GUIDE.md](DOCUSEAL_INTEGRATION_GUIDE.md) - E-signature setup

---

**Document Version:** 1.0  
**Last Updated:** February 9, 2026  
**Maintained By:** Development Team
