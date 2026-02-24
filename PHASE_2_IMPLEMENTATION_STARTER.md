# Phase 2: Implementation Starter Guide

## Overview

Phase 2 adds 4 enhancement modules to the Phase 1 foundation. Each module follows the same proven pattern.

**Modules:**
1. Contracts & Templates - Document generation and management
2. Reconciliation Engine - Bank statement matching
3. Sales Pipeline - Conversion funnel tracking
4. Commission Calculations - Agent earnings tracking

**Timeline:** 3-4 weeks (1 week per module approximately)

---

## Phase 2 Implementation Pattern

Every Phase 2 module follows this exact same pattern:

### Step 1: Extend Prisma Schema

```prisma
// Add to prisma/schema.prisma

model NewModule {
  id        String    @id @default(cuid())
  branch    String    @default("Harare")  // ← CRITICAL
  // ... your fields ...
  createdAt DateTime  @default(now())
  updatedAt DateTime  @updatedAt

  @@unique([field, branch])               // if applicable
  @@index([branch])                       // ← CRITICAL
  @@index([createdAt])                    // for ordering
}
```

**Key Requirements:**
- ✅ Always add `branch` field
- ✅ Always index on `branch`
- ✅ Index on `createdAt` for time-series data
- ✅ Use unique constraints per branch (not globally)

### Step 2: Create API Endpoint

```typescript
// Create /app/api/admin/new-module/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import prisma from '@/lib/prisma';

export async function GET(request: NextRequest) {
  try {
    let user = await getCurrentUser();
    if (!user) {
      const isLocalhost = request.headers.get('host')?.includes('localhost');
      if (process.env.NODE_ENV === 'development' && isLocalhost) {
        user = { email: 'dev@localhost', branch: 'Harare' };
      } else {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      }
    }

    const branch = request.nextUrl.searchParams.get('branch') || user.branch;
    const data = await prisma.newModule.findMany({
      where: { branch },
      orderBy: { createdAt: 'desc' },
      take: 100
    });

    return NextResponse.json({ data, error: null, status: 200 }, { status: 200 });
  } catch (error: any) {
    console.error('Error:', error);
    return NextResponse.json({ error: error?.message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    let user = await getCurrentUser();
    if (!user) {
      const isLocalhost = request.headers.get('host')?.includes('localhost');
      if (process.env.NODE_ENV === 'development' && isLocalhost) {
        user = { email: 'dev@localhost', branch: 'Harare' };
      } else {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      }
    }

    const data = await request.json();

    // Validate required fields
    if (!data.name) {
      return NextResponse.json(
        { error: 'Missing required field: name' },
        { status: 400 }
      );
    }

    // Create record
    const record = await prisma.newModule.create({
      data: {
        branch: data.branch || user.branch,
        name: data.name,
        // ... other fields
      }
    });

    // Log activity
    await prisma.activityLog.create({
      data: {
        branch: data.branch || user.branch,
        userId: user.email,
        action: 'CREATE',
        module: 'NEW_MODULE',
        recordId: record.id,
        description: `Created ${data.name}`
      }
    });

    return NextResponse.json({ data: record, error: null, status: 201 }, { status: 201 });
  } catch (error: any) {
    console.error('Error:', error);
    return NextResponse.json({ error: error?.message }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    let user = await getCurrentUser();
    if (!user) {
      const isLocalhost = request.headers.get('host')?.includes('localhost');
      if (process.env.NODE_ENV === 'development' && isLocalhost) {
        user = { email: 'dev@localhost', branch: 'Harare' };
      } else {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      }
    }

    const data = await request.json();
    if (!data.id) {
      return NextResponse.json({ error: 'Missing id' }, { status: 400 });
    }

    const existing = await prisma.newModule.findUnique({
      where: { id: data.id }
    });
    if (!existing) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    const updated = await prisma.newModule.update({
      where: { id: data.id },
      data: {
        // ... fields to update
      }
    });

    // Log activity
    await prisma.activityLog.create({
      data: {
        branch: existing.branch,
        userId: user.email,
        action: 'UPDATE',
        module: 'NEW_MODULE',
        recordId: data.id,
        description: 'Updated',
        changes: JSON.stringify({ before: existing, after: updated })
      }
    });

    return NextResponse.json({ data: updated, error: null, status: 200 }, { status: 200 });
  } catch (error: any) {
    console.error('Error:', error);
    return NextResponse.json({ error: error?.message }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    let user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await request.json();
    if (!id) {
      return NextResponse.json({ error: 'Missing id' }, { status: 400 });
    }

    const existing = await prisma.newModule.findUnique({
      where: { id }
    });
    if (!existing) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    // Soft delete (if applicable)
    const deleted = await prisma.newModule.update({
      where: { id },
      data: { status: 'ARCHIVED' }  // or delete if no soft delete
    });

    // Log activity
    await prisma.activityLog.create({
      data: {
        branch: existing.branch,
        userId: user.email,
        action: 'DELETE',
        module: 'NEW_MODULE',
        recordId: id,
        description: 'Deleted'
      }
    });

    return NextResponse.json({ data: { id }, error: null, status: 200 }, { status: 200 });
  } catch (error: any) {
    console.error('Error:', error);
    return NextResponse.json({ error: error?.message }, { status: 500 });
  }
}
```

### Step 3: Update supabaseMock

```typescript
// Add to services/supabase.ts

getNewModules: async (_branch?: Branch) => {
  try {
    const params = new URLSearchParams();
    if (_branch) params.append('branch', _branch);
    
    const response = await fetch(`/api/admin/new-module?${params.toString()}`);
    if (!response.ok) return [];
    
    const result = await response.json();
    return result.data || [];
  } catch (e: any) {
    console.error('Error:', e);
    return [];
  }
},

saveNewModule: async (data: Partial<NewModule>) => {
  try {
    const response = await fetch('/api/admin/new-module', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    
    if (!response.ok) {
      const error = await response.json();
      return { data: null, error: error.error };
    }
    
    const result = await response.json();
    return { data: result.data, error: null };
  } catch (e: any) {
    return { data: null, error: e.message };
  }
},

updateNewModule: async (id: string, data: Partial<NewModule>) => {
  try {
    const response = await fetch('/api/admin/new-module', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, ...data })
    });
    
    const result = await response.json();
    return { data: result.data, error: result.error };
  } catch (e: any) {
    return { data: null, error: e.message };
  }
}
```

### Step 4: Use in Components

```typescript
import { supabaseMock } from '@/services/supabase';

export function MyComponent() {
  const [items, setItems] = useState<NewModule[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        const data = await supabaseMock.getNewModules('Harare');
        setItems(data);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const handleCreate = async (newData: Partial<NewModule>) => {
    const { data, error } = await supabaseMock.saveNewModule(newData);
    if (!error) {
      setItems([data, ...items]);
    }
  };

  if (loading) return <div>Loading...</div>;

  return (
    <div>
      {items.map(item => (
        <div key={item.id}>{/* render item */}</div>
      ))}
    </div>
  );
}
```

---

## Phase 2 Module Details

### Module 1: Contracts & Templates (Week 1)

**Purpose:** Generate and manage sales contracts

**Schema:**
```prisma
model ContractTemplate {
  id        String    @id @default(cuid())
  name      String
  content   String    @db.Text
  variables String[]  // Placeholders like {CLIENT_NAME}
  branch    String    @default("Harare")
  createdAt DateTime  @default(now())
  updatedAt DateTime  @updatedAt
  @@index([branch])
}

model Contract {
  id         String    @id @default(cuid())
  clientId   String
  templateId String
  standId    String
  content    String    @db.Text
  status     String    @default("DRAFT")  // DRAFT | SIGNED | ARCHIVED
  signedAt   DateTime?
  branch     String
  createdAt  DateTime  @default(now())
  @@index([clientId])
  @@index([branch])
}
```

**APIs:**
- GET /api/admin/contract-templates - Fetch templates
- POST /api/admin/contract-templates - Create template
- GET /api/admin/contracts - Fetch contracts
- POST /api/admin/contracts/generate - Generate from template

**Activities:**
- Logged for template CRUD
- Logged for contract generation
- Logged for signing events

### Module 2: Reconciliation Engine (Week 2)

**Purpose:** Match bank statements to payments

**Schema:**
```prisma
model BankStatement {
  id        String    @id @default(cuid())
  branch    String
  date      DateTime
  reference String
  amount    Decimal   @db.Decimal(12, 2)
  matched   Boolean   @default(false)
  matchedTo String?   // Payment ID
  createdAt DateTime  @default(now())
  @@index([matched])
  @@index([branch])
}

model ReconRecord {
  id        String    @id @default(cuid())
  status    String    // PENDING | MATCHED | DISCREPANCY | MANUAL
  items     String[]  // [paymentId, statementId, ...]
  branch    String
  createdAt DateTime  @default(now())
  @@index([status])
  @@index([branch])
}
```

**APIs:**
- POST /api/admin/reconciliation/import - Upload bank CSV
- GET /api/admin/reconciliation/matches - Auto-matched items
- POST /api/admin/reconciliation/confirm - Confirm match
- GET /api/admin/reconciliation/discrepancies - Unmatched items

**Activities:**
- Logged for imports
- Logged for match confirmations
- Logged for discrepancies flagged

### Module 3: Sales Pipeline (Week 3)

**Purpose:** Track conversion from lead to sale

**Schema:**
```prisma
model PipelineStage {
  id        String    @id @default(cuid())
  clientId  String
  stage     String    // LEAD | INTERESTED | NEGOTIATING | RESERVED | SOLD
  enteredAt DateTime  @default(now())
  exitedAt  DateTime?
  branch    String
  @@index([stage])
  @@index([branch])
}

model PipelineMetrics {
  id        String    @id @default(cuid())
  month     String    // "2025-01"
  branch    String
  leads     Int       @default(0)
  converted Int       @default(0)
  rate      Float     // conversion percentage
  revenue   Decimal   @db.Decimal(15, 2)
  createdAt DateTime  @default(now())
  @@unique([month, branch])
  @@index([branch])
}
```

**APIs:**
- GET /api/admin/pipeline - View current pipeline
- POST /api/admin/pipeline/stage - Move client to stage
- GET /api/admin/pipeline/metrics - Conversion metrics

**Activities:**
- Logged for stage changes
- Logged for metrics calculations

### Module 4: Commission Calculations (Week 4)

**Purpose:** Track and calculate agent earnings

**Schema:**
```prisma
model Commission {
  id        String    @id @default(cuid())
  agentId   String
  paymentId String
  percentage Float    @default(2.5)
  amount    Decimal   @db.Decimal(12, 2)
  status    String    // CALCULATED | APPROVED | PAID
  month     String    // "2025-01"
  branch    String
  createdAt DateTime  @default(now())
  @@unique([agentId, paymentId, month])
  @@index([status])
  @@index([branch])
}

model CommissionPayout {
  id        String    @id @default(cuid())
  agentId   String
  month     String
  total     Decimal   @db.Decimal(12, 2)
  status    String    // CALCULATED | APPROVED | PAID
  paidAt    DateTime?
  branch    String
  createdAt DateTime  @default(now())
  @@unique([agentId, month])
  @@index([status])
  @@index([branch])
}
```

**APIs:**
- GET /api/admin/commissions - Fetch commissions
- POST /api/admin/commissions/calculate - Run calculations
- GET /api/admin/payouts - Fetch payout records
- PUT /api/admin/payouts/approve - Approve for payment

**Activities:**
- Logged for calculations
- Logged for approvals
- Logged for payments

---

## Phase 2 Implementation Timeline

```
Week 1: Contracts & Templates
  - Design schema
  - Create API endpoints
  - Integrate into components
  - Test cross-branch functionality

Week 2: Reconciliation Engine
  - Design schema
  - Create API for bank import
  - Implement matching algorithm
  - Create reconciliation UI

Week 3: Sales Pipeline
  - Design schema
  - Create pipeline stage API
  - Create metrics dashboard
  - Test conversion tracking

Week 4: Commission Calculations
  - Design schema
  - Create calculation engine
  - Create approval workflow
  - Test payment tracking
```

---

## Getting Started with Phase 2

### Prerequisites

Before starting Phase 2, verify Phase 1:
- [ ] Database tables created in Neon
- [ ] Phase 1 APIs tested and working
- [ ] Components integrated with Phase 1 APIs
- [ ] Cross-branch visibility verified
- [ ] Build passing: `npm run build`

### Module 1: Contracts Implementation Steps

1. **Add Schema**
   ```bash
   # Edit prisma/schema.prisma
   # Add ContractTemplate and Contract models
   # Add unique indexes on branch
   ```

2. **Create API**
   ```bash
   # Create /app/api/admin/contract-templates/route.ts
   # Implement GET, POST, PUT, DELETE
   # Add activity logging
   ```

3. **Update supabaseMock**
   ```bash
   # Add to services/supabase.ts:
   # getContractTemplates()
   # saveContractTemplate()
   # getContracts()
   # generateContract()
   ```

4. **Integrate Components**
   ```bash
   # Find components that need contract management
   # Use supabaseMock functions
   # Test with real data
   ```

5. **Verify & Test**
   ```bash
   npm run build              # No TypeScript errors
   npm run dev                # Test APIs
   curl http://localhost:3000/api/admin/contract-templates
   ```

---

## Success Criteria for Phase 2 Modules

Each module is complete when:

✅ Schema adds all required fields  
✅ API endpoints created (CRUD + activity logging)  
✅ supabaseMock functions updated  
✅ Components integrated  
✅ Cross-branch data sync verified  
✅ Activity log shows all operations  
✅ Build passes with no errors  
✅ APIs tested with curl  
✅ Unit tests pass (if applicable)  

---

## Quick Reference: What to Copy/Paste

### New Module Skeleton

```typescript
// /app/api/admin/MODULE/route.ts - Copy this template
import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import prisma from '@/lib/prisma';

export async function GET(request: NextRequest) {
  // ... (see template above)
}

export async function POST(request: NextRequest) {
  // ... (see template above)
}

export async function PUT(request: NextRequest) {
  // ... (see template above)
}

export async function DELETE(request: NextRequest) {
  // ... (see template above)
}
```

### Prisma Model Skeleton

```prisma
model MODULE {
  id        String    @id @default(cuid())
  branch    String    @default("Harare")
  // Add your fields here
  createdAt DateTime  @default(now())
  updatedAt DateTime  @updatedAt

  @@unique([uniqueField, branch])
  @@index([branch])
  @@index([createdAt])
}
```

### supabaseMock Function Skeleton

```typescript
getMODULES: async (_branch?: Branch) => {
  const params = new URLSearchParams();
  if (_branch) params.append('branch', _branch);
  const response = await fetch(`/api/admin/modules?${params.toString()}`);
  return response.ok ? response.json().data : [];
},

saveMODULE: async (data: Partial<MODULE>) => {
  const response = await fetch('/api/admin/modules', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  });
  return response.ok 
    ? { data: (await response.json()).data, error: null }
    : { data: null, error: 'Failed to save' };
}
```

---

## Phase 2 Deployment Checklist

Before deploying Phase 2 modules:

- [ ] All Phase 1 modules working in production
- [ ] Phase 2 schema reviewed for correctness
- [ ] APIs tested locally
- [ ] Components integrated and tested
- [ ] Build passes: `npm run build`
- [ ] Database migrations applied to Neon
- [ ] Activity logging verified for all operations
- [ ] Cross-branch data sync tested
- [ ] Performance acceptable (load testing)
- [ ] Vercel environment variables updated
- [ ] Go/no-go signoff from QA

---

## Phase 3: Unification & Optimization

After Phase 2 is complete, Phase 3 will:

1. **Neon Auth Integration** - Replace Auth.js with Neon Auth as sole gatekeeper
2. **Row-Level Security** - Implement RLS for data isolation
3. **Serverless Adapter** - Configure @neondatabase/serverless for Vercel
4. **Executive Views** - Cross-branch aggregation dashboards
5. **Performance Tuning** - Caching, query optimization, load testing

---

## Summary

**Phase 1 Complete ✅** - 4 Foundation APIs operational  
**Phase 2 Ready to Start** - 4 Enhancement Modules planned  
**Timeline:** 3-4 weeks for all Phase 2 modules  
**Total Project:** 6-7 weeks for all 14 modules  

All modules follow the same proven pattern, making implementation consistent and efficient.

