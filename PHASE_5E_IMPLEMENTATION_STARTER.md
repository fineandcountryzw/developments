# Phase 5E: Contract Generation - Implementation Starter 🚀

**Status**: READY TO START  
**Timeline**: 3-4 weeks  
**Priority**: HIGH  
**Dependencies**: Phase 5D complete (Kanban)

---

## 📋 Quick Start (30 minutes)

### Step 1: Read the Plan
```bash
# Read the full plan document
PHASE_5E_CONTRACT_GENERATION_PLAN.md  (527 lines)
```

### Step 2: Understand the Architecture
- **Templates**: WYSIWYG contract templates with variables
- **Generation**: Auto-fill contracts from deal data
- **E-Signatures**: Docusign/HelloSign integration
- **Compliance**: Audit trail and version tracking
- **Database**: 8+ new Prisma models

### Step 3: Set Up Development Environment
```bash
# 1. Update Prisma schema
# Copy ContractTemplate, GeneratedContract, Signature, etc. models

# 2. Generate Prisma client
npx prisma generate

# 3. Run migrations
npx prisma migrate dev --name add_contracts

# 4. Seed initial templates (optional)
npm run seed:contracts
```

---

## 🏗️ Implementation Phases

### Phase 5E-1: Database & API (Week 1)

#### Task 1.1: Update Prisma Schema
**File**: `prisma/schema.prisma`

Add these models:

```prisma
// Contract Templates
model ContractTemplate {
  id                String @id @default(cuid())
  name              String
  type              String  // 'purchase', 'installment', 'management', etc.
  description       String?
  content           String  // HTML template content
  requiredSignatures Int    @default(1)
  
  // Relationships
  variables         ContractVariable[]
  sections          TemplateSection[]
  generatedContracts GeneratedContract[]
  
  // Metadata
  status            String  @default("active")  // 'draft' | 'active' | 'archived'
  version           Int     @default(1)
  createdAt         DateTime @default(now())
  updatedAt         DateTime @updatedAt
  
  @@index([type])
  @@index([status])
}

model ContractVariable {
  id                String @id @default(cuid())
  templateId        String
  template          ContractTemplate @relation(fields: [templateId], references: [id], onDelete: Cascade)
  
  name              String  // e.g., "clientName"
  placeholder       String  // e.g., "{{clientName}}"
  dataType          String  // 'text' | 'number' | 'date' | 'email' | 'currency'
  defaultValue      String?
  required          Boolean @default(true)
  
  @@unique([templateId, placeholder])
  @@index([templateId])
}

model TemplateSection {
  id                String @id @default(cuid())
  templateId        String
  template          ContractTemplate @relation(fields: [templateId], references: [id], onDelete: Cascade)
  
  name              String
  content           String
  order             Int
  conditional       String? // e.g., "propertyType == 'residential'"
  
  @@index([templateId])
}

// Generated Contracts
model GeneratedContract {
  id                String @id @default(cuid())
  templateId        String
  template          ContractTemplate @relation(fields: [templateId], references: [id])
  
  // Reference data
  dealId            String?
  deal              Deal? @relation(fields: [dealId], references: [id])
  clientId          String?
  client            Client? @relation(fields: [clientId], references: [id])
  
  // Contract data
  content           String  // Rendered HTML
  variables         Json    // Variable values: {"clientName": "John", ...}
  
  // Status & tracking
  status            String  @default("draft")  // 'draft' | 'sent' | 'signed' | 'archived'
  expiresAt         DateTime?
  
  // Signatures
  signatures        Signature[]
  
  // Metadata
  createdBy         String?
  createdAt         DateTime @default(now())
  updatedAt         DateTime @updatedAt
  
  @@index([dealId])
  @@index([clientId])
  @@index([status])
  @@index([templateId])
}

// E-Signatures
model Signature {
  id                String @id @default(cuid())
  contractId        String
  contract          GeneratedContract @relation(fields: [contractId], references: [id], onDelete: Cascade)
  
  signerEmail       String
  signerName        String
  
  // Signature data
  signatureUrl      String?  // URL to signature image
  ipAddress         String?  // Signing location
  userAgent         String?  // Device info
  
  // Status
  status            String  @default("pending")  // 'pending' | 'signed' | 'declined'
  signedAt          DateTime?
  declinedAt        DateTime?
  declineReason     String?
  
  // E-signature provider
  esignProvider     String? // 'docusign' | 'hellosign' | 'adobe'
  esignEnvelopeId   String?
  
  @@unique([contractId, signerEmail])
  @@index([contractId])
  @@index([status])
}

// Contract audit trail
model ContractAuditLog {
  id                String @id @default(cuid())
  contractId        String
  
  action            String  // 'created' | 'sent' | 'signed' | 'updated' | 'archived'
  details           Json?   // Additional details
  
  performedBy       String? // User email
  performedAt       DateTime @default(now())
  
  @@index([contractId])
}
```

#### Task 1.2: Create API Endpoints
**Location**: `app/api/admin/contracts/`

```bash
# Create these endpoints:
/api/admin/contracts/templates              # GET, POST (CRUD)
/api/admin/contracts/templates/[id]         # GET, PUT, DELETE
/api/admin/contracts                        # GET, POST (list, create)
/api/admin/contracts/[id]                   # GET, PUT (view, update)
/api/admin/contracts/[id]/render            # POST (render to PDF)
/api/admin/contracts/[id]/send              # POST (send to signers)
/api/admin/contracts/[id]/sign              # POST (sign endpoint)
```

**Example**: `app/api/admin/contracts/route.ts`

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { getNeonAuthUser } from '@/lib/neonAuth';
import prisma from '@/lib/prisma';

/**
 * POST /api/admin/contracts
 * Create a new contract from template
 */
export async function POST(request: NextRequest) {
  try {
    // Auth check
    const user = await getNeonAuthUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { templateId, dealId, clientId, variables } = await request.json();

    // Validate template exists
    const template = await prisma.contractTemplate.findUnique({
      where: { id: templateId },
      include: { variables: true }
    });

    if (!template) {
      return NextResponse.json(
        { error: 'Template not found' },
        { status: 404 }
      );
    }

    // Create contract
    const contract = await prisma.generatedContract.create({
      data: {
        templateId,
        dealId,
        clientId,
        variables: variables || {},
        content: renderTemplate(template, variables), // See below
        createdBy: user.email
      }
    });

    // Log action
    await prisma.contractAuditLog.create({
      data: {
        contractId: contract.id,
        action: 'created',
        performedBy: user.email
      }
    });

    return NextResponse.json(contract);
  } catch (error) {
    console.error('[CONTRACTS][ERROR]', error);
    return NextResponse.json(
      { error: 'Failed to create contract' },
      { status: 500 }
    );
  }
}

/**
 * Helper: Render template with variables
 */
function renderTemplate(template: any, variables: any): string {
  let content = template.content;
  
  // Replace all {{variable}} with values
  Object.entries(variables || {}).forEach(([key, value]) => {
    const regex = new RegExp(`{{${key}}}`, 'g');
    content = content.replace(regex, String(value || ''));
  });
  
  return content;
}
```

---

### Phase 5E-2: Frontend Components (Week 2)

#### Task 2.1: Template Editor Component
**File**: `components/ContractTemplateEditor.tsx`

```typescript
import React, { useState } from 'react';
import { Editor } from '@tinymce/tinymce-react'; // Or similar WYSIWYG

interface ContractTemplateEditorProps {
  templateId?: string;
  onSave: (template: any) => void;
}

export const ContractTemplateEditor: React.FC<ContractTemplateEditorProps> = ({
  templateId,
  onSave
}) => {
  const [name, setName] = useState('');
  const [content, setContent] = useState('');
  const [variables, setVariables] = useState<any[]>([]);

  const handleAddVariable = (name: string) => {
    setVariables([...variables, { name, placeholder: `{{${name}}}` }]);
  };

  const handleSave = async () => {
    await onSave({
      name,
      content,
      variables
    });
  };

  return (
    <div className="space-y-6">
      {/* Template Name */}
      <input
        type="text"
        placeholder="Template Name"
        value={name}
        onChange={(e) => setName(e.target.value)}
        className="w-full px-4 py-2 border rounded-lg"
      />

      {/* Variables Panel */}
      <div className="bg-gray-50 p-4 rounded-lg">
        <h3 className="font-bold mb-3">Variables</h3>
        <div className="space-y-2">
          {variables.map((v, i) => (
            <div key={i} className="flex items-center justify-between">
              <code className="text-sm">{v.placeholder}</code>
              <button
                onClick={() => setVariables(variables.filter((_, idx) => idx !== i))}
                className="text-red-500 text-sm"
              >
                Remove
              </button>
            </div>
          ))}
        </div>
        <input
          type="text"
          placeholder="Add new variable..."
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              handleAddVariable((e.target as HTMLInputElement).value);
              (e.target as HTMLInputElement).value = '';
            }
          }}
          className="w-full mt-2 px-3 py-2 border rounded-lg text-sm"
        />
      </div>

      {/* WYSIWYG Editor */}
      <div>
        <h3 className="font-bold mb-2">Template Content</h3>
        <Editor
          initialValue={content}
          onEditorChange={(value) => setContent(value)}
          init={{
            height: 500,
            plugins: ['link', 'lists', 'table'],
            toolbar: 'bold italic underline | alignleft aligncenter alignright | link table'
          }}
        />
      </div>

      {/* Save Button */}
      <button
        onClick={handleSave}
        className="w-full bg-fcGold text-white py-3 rounded-lg font-bold"
      >
        Save Template
      </button>
    </div>
  );
};
```

#### Task 2.2: Contract Generation Component
**File**: `components/ContractGenerator.tsx`

```typescript
interface ContractGeneratorProps {
  dealId: string;
  clientId: string;
}

export const ContractGenerator: React.FC<ContractGeneratorProps> = ({
  dealId,
  clientId
}) => {
  const [templates, setTemplates] = useState<any[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState('');
  const [variables, setVariables] = useState<any>({});
  const [loading, setLoading] = useState(false);

  // Load templates
  useEffect(() => {
    fetchTemplates();
  }, []);

  const fetchTemplates = async () => {
    const res = await fetch('/api/admin/contracts/templates');
    const data = await res.json();
    setTemplates(data);
  };

  const handleGenerate = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/contracts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          templateId: selectedTemplate,
          dealId,
          clientId,
          variables
        })
      });

      const contract = await res.json();
      // Show success, redirect to contract viewer
      window.location.href = `/contracts/${contract.id}`;
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Template Selection */}
      <select
        value={selectedTemplate}
        onChange={(e) => setSelectedTemplate(e.target.value)}
        className="w-full px-4 py-2 border rounded-lg"
      >
        <option>Select Template...</option>
        {templates.map((t) => (
          <option key={t.id} value={t.id}>
            {t.name}
          </option>
        ))}
      </select>

      {/* Variable Inputs */}
      {selectedTemplate && (
        <div className="space-y-3">
          {templates.find((t) => t.id === selectedTemplate)?.variables.map((v: any) => (
            <input
              key={v.id}
              placeholder={v.name}
              value={variables[v.name] || ''}
              onChange={(e) =>
                setVariables({ ...variables, [v.name]: e.target.value })
              }
              className="w-full px-4 py-2 border rounded-lg"
            />
          ))}
        </div>
      )}

      {/* Generate Button */}
      <button
        onClick={handleGenerate}
        disabled={loading || !selectedTemplate}
        className="w-full bg-fcGold text-white py-3 rounded-lg font-bold disabled:opacity-50"
      >
        {loading ? 'Generating...' : 'Generate Contract'}
      </button>
    </div>
  );
};
```

#### Task 2.3: Contract Viewer Component
**File**: `components/ContractViewer.tsx`

```typescript
interface ContractViewerProps {
  contractId: string;
}

export const ContractViewer: React.FC<ContractViewerProps> = ({ contractId }) => {
  const [contract, setContract] = useState<any>(null);
  const [signers, setSigners] = useState<any[]>([]);

  useEffect(() => {
    fetchContract();
  }, [contractId]);

  const fetchContract = async () => {
    const res = await fetch(`/api/admin/contracts/${contractId}`);
    const data = await res.json();
    setContract(data);
    setSigners(data.signatures || []);
  };

  const handleSendForSignature = async () => {
    await fetch(`/api/admin/contracts/${contractId}/send`, {
      method: 'POST',
      body: JSON.stringify({ signers })
    });
    alert('Contract sent for signatures');
  };

  const handleDownloadPDF = async () => {
    const res = await fetch(`/api/admin/contracts/${contractId}/render`, {
      method: 'POST'
    });
    const blob = await res.blob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `contract-${contractId}.pdf`;
    a.click();
  };

  if (!contract) return <div>Loading...</div>;

  return (
    <div className="space-y-6">
      {/* Contract Content */}
      <div
        className="bg-white border rounded-lg p-8 min-h-96"
        dangerouslySetInnerHTML={{ __html: contract.content }}
      />

      {/* Signature Status */}
      <div className="bg-gray-50 p-4 rounded-lg">
        <h3 className="font-bold mb-3">Signatures ({signers.length})</h3>
        {signers.map((s) => (
          <div key={s.id} className="flex items-center justify-between py-2">
            <span>{s.signerEmail}</span>
            <span className={`text-sm font-bold ${
              s.status === 'signed' ? 'text-green-600' : 'text-amber-600'
            }`}>
              {s.status.toUpperCase()}
            </span>
          </div>
        ))}
      </div>

      {/* Actions */}
      <div className="flex gap-3">
        <button
          onClick={handleDownloadPDF}
          className="flex-1 bg-gray-600 text-white py-2 rounded-lg font-bold"
        >
          Download PDF
        </button>
        <button
          onClick={handleSendForSignature}
          className="flex-1 bg-fcGold text-white py-2 rounded-lg font-bold"
        >
          Send for Signature
        </button>
      </div>
    </div>
  );
};
```

---

### Phase 5E-3: E-Signature Integration (Week 3)

#### Task 3.1: Choose Provider
Options:
- **DocuSign** (Most popular, enterprise)
- **HelloSign** (Easy to use)
- **Adobe Sign** (Premium)

**Recommendation**: Start with HelloSign - simplest API

#### Task 3.2: Implement E-Signature Service
**File**: `lib/esign.ts`

```typescript
// For HelloSign
import { SignatureRequest } from 'hellosign-sdk';

export async function sendForSignature(
  contractId: string,
  signers: Array<{ email: string; name: string }>
) {
  const contract = await prisma.generatedContract.findUnique({
    where: { id: contractId }
  });

  if (!contract) throw new Error('Contract not found');

  // Create signature request
  const sr = new SignatureRequest({
    test_mode: process.env.NODE_ENV === 'development',
    files: [
      // PDF buffer of contract
    ],
    signers: signers.map((s) => ({
      email_address: s.email,
      name: s.name
    })),
    cc_email_addresses: ['admin@fineandcountry.co.zw'],
    subject: 'Please sign this contract',
    message: 'This contract needs your signature'
  });

  // Send request
  const response = await HelloSign.signatureRequestSend(sr);

  // Store envelope ID
  for (const signer of signers) {
    await prisma.signature.create({
      data: {
        contractId,
        signerEmail: signer.email,
        signerName: signer.name,
        esignProvider: 'hellosign',
        esignEnvelopeId: response.signature_request.id,
        status: 'pending'
      }
    });
  }

  return response;
}

// Webhook handler
export async function handleSignatureWebhook(event: any) {
  const { signature_request } = event.signature_request;
  
  for (const sig of signature_request.signatures) {
    await prisma.signature.updateMany({
      where: {
        esignEnvelopeId: signature_request.id,
        signerEmail: sig.signer.email
      },
      data: {
        status: sig.status_code === 'signed' ? 'signed' : 'pending',
        signedAt: sig.status_code === 'signed' ? new Date() : null,
        signatureUrl: sig.signature_page_url
      }
    });
  }
}
```

---

### Phase 5E-4: Integration & Testing (Week 4)

#### Task 4.1: Add Contract UI to Admin Dashboard
**File**: `App.tsx`

```typescript
import { ContractManagement } from './components/ContractManagement';

// In admin menu
{activeTab === 'contracts' && <ContractManagement />}
```

#### Task 4.2: Add to Sidebar
**File**: `components/Sidebar.tsx`

```typescript
// Add to Admin menu
{ id: 'contracts', label: 'Contracts', icon: FileSignature }
```

#### Task 4.3: Create Contract Management Dashboard
**File**: `components/ContractManagement.tsx`

```typescript
export const ContractManagement: React.FC = () => {
  const [tab, setTab] = useState<'templates' | 'contracts'>('contracts');

  return (
    <div className="space-y-6">
      {/* Tabs */}
      <div className="flex gap-3 border-b">
        <button
          onClick={() => setTab('contracts')}
          className={`px-4 py-2 font-bold ${
            tab === 'contracts' ? 'border-b-2 border-fcGold text-fcGold' : ''
          }`}
        >
          Contracts
        </button>
        <button
          onClick={() => setTab('templates')}
          className={`px-4 py-2 font-bold ${
            tab === 'templates' ? 'border-b-2 border-fcGold text-fcGold' : ''
          }`}
        >
          Templates
        </button>
      </div>

      {/* Content */}
      {tab === 'contracts' && <ContractsList />}
      {tab === 'templates' && <TemplateManager />}
    </div>
  );
};
```

---

## 📊 Testing Checklist

- [ ] Template CRUD operations
- [ ] Contract generation from template
- [ ] Variable substitution
- [ ] PDF rendering
- [ ] E-signature flow
- [ ] Signature webhook handling
- [ ] Audit logging
- [ ] Cross-branch access control

---

## 🔗 Integration Points

### With Phase 5D (Kanban)
```typescript
// In Deal modal, add:
<ContractGenerator dealId={deal.id} clientId={deal.clientId} />
```

### With Email System
```typescript
// Auto-send contract after email campaign
// Use Phase 4 email service
```

### With Payments
```typescript
// Require signed contract before payment processing
```

---

## 📚 Key Files to Create

```
app/api/admin/contracts/
├── route.ts                    (List, Create)
├── [id]/
│   ├── route.ts                (Get, Update)
│   ├── render/route.ts         (PDF generation)
│   ├── send/route.ts           (Send for signature)
│   └── sign/route.ts           (Signing endpoint)
└── templates/
    ├── route.ts                (Template CRUD)
    └── [id]/route.ts

components/
├── ContractTemplateEditor.tsx
├── ContractGenerator.tsx
├── ContractViewer.tsx
└── ContractManagement.tsx

lib/
└── esign.ts                    (E-signature service)
```

---

## ⚙️ Environment Variables Needed

```env
# HelloSign / E-signature
HELLOSIGN_API_KEY=your_api_key
HELLOSIGN_CLIENT_ID=your_client_id

# PDF Generation (use Puppeteer or similar)
PDF_GENERATOR_API=...
```

---

## 🎯 Success Metrics

- [ ] 10+ contract templates created
- [ ] 100+ contracts generated
- [ ] 50+ signed contracts
- [ ] <5 minutes average contract creation time
- [ ] 100% audit trail coverage

---

## 📞 Questions & Support

- **Plan Details**: `PHASE_5E_CONTRACT_GENERATION_PLAN.md`
- **Implementation Status**: `PHASE_5E_IMPLEMENTATION_STATUS_COMPLETE.md`
- **Completion Checklist**: `PHASE_5E_COMPLETION_CHECKLIST.md`

---

**Ready to start?** Begin with **Task 1.1: Prisma Schema Update**

🚀 Let's build contracts!
