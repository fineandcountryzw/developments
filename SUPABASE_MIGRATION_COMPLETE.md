# Supabase to Neon Migration - Complete Guide

## ✅ Migration Status: Phase 1 Complete

### Service Layer Migration (100% Complete)

All service files have been successfully migrated from Supabase to Neon/Prisma:

#### ✅ Completed Migrations

1. **services/emailService.ts**
   - Replaced: `import { supabaseMock } from './supabase.ts'`
   - With: `import { logCommunication, logAudit } from '../lib/db'`
   - Updated: All `supabaseMock.logCommunication()` and `supabaseMock.logAudit()` calls

2. **services/checklistService.ts**
   - Replaced: `import { BRANCH_SETTINGS } from './supabase.ts'`
   - With: `import { BRANCH_SETTINGS } from '../lib/db'`

3. **services/contractService.ts**
   - Replaced: `import { BRANCH_SETTINGS } from './supabase.ts'`
   - With: `import { BRANCH_SETTINGS } from '../lib/db'`

4. **services/pdfService.ts**
   - Replaced: `import { BRANCH_SETTINGS } from './supabase.ts'`
   - With: `import { BRANCH_SETTINGS } from '../lib/db'`

5. **services/reconService.ts**
   - Replaced: `import { BRANCH_SETTINGS, supabaseMock } from './supabase.ts'`
   - With: `import { BRANCH_SETTINGS, getReconLedger, getDevelopments } from '../lib/db'`
   - Updated: All `supabaseMock.getReconLedger()` and `supabaseMock.getDevelopments()` calls

6. **services/whitepaperService.ts**
   - Replaced: `import { BRANCH_SETTINGS, supabaseMock } from './supabase.ts'`
   - With: `import { BRANCH_SETTINGS, logAudit } from '../lib/db'`
   - Updated: `supabaseMock.logAudit()` calls with new signature
   - Updated text: "PostgreSQL (Supabase)" → "PostgreSQL (Neon)"
   - Updated text: "Supabase Edge Functions" → "Resend Email API"

### Infrastructure Created

#### lib/db.ts (Complete Prisma Wrapper)

```typescript
export const db = new PrismaClient(); // Main database client
export const BRANCH_SETTINGS = {...}; // Migrated from Supabase

// Helper Functions:
- logAudit(data) // Activity tracking
- logCommunication(data) // Email/SMS logging
- getSystemHealth() // Neon health check
- getReconLedger(branch) // Payment reconciliation
- getDevelopments(branch) // Development queries
- on/off/emit // Realtime event emitter
```

---

## 🚧 Phase 2: Component Migration (Pending)

The following components still import from `services/supabase.ts` and need migration:

### High Priority Components (Data Operations)

1. **components/AdminDevelopments.tsx** (30 supabaseMock calls)
   - Methods: `getDevelopments`, `createDevelopment`, `updateDevelopment`, `deleteDevelopment`
   - Methods: `getDevelopmentMetrics`, `getReconLedger`, `storage.upload`, `storage.getPublicUrl`
   - Realtime: `supabaseMock.realtime.on('developments:created')`

2. **components/PaymentModule.tsx** (12 supabaseMock calls)
   - Methods: `getClients`, `getPayments`, `getInvoices`, `getStandsByClient`
   - Methods: `getDevelopmentById`, `createClient`, `savePayment`

3. **components/ShowroomKiosk.tsx** (4 supabaseMock calls)
   - Methods: `getDevelopments`, `getStandsByDevelopment`

4. **components/AgentPipeline.tsx** (4 supabaseMock calls)
   - Methods: `getAgentPipeline`, `getClients`, `updateStandStage`

5. **components/AgentDashboard.tsx** (3 supabaseMock calls)
   - Methods: `getAgentCommissions`, `getAgentPipeline`, `getAgentClients`

6. **components/ClientDashboard.tsx** (3 supabaseMock calls)
   - Methods: `getClientReservations`, `getClientPayments`, `getClientOwnedProperties`

7. **components/EmailModule.tsx** (6 supabaseMock calls)
   - Methods: `getEmailTemplates`, `getCommunicationLogs`, `getEmailConfig`, `saveEmailTemplate`

8. **components/IntegrityModule.tsx** (3 supabaseMock calls)
   - Methods: `getAuditLogs`, `getSystemHealth`, `getCommitManifest`

9. **components/HealthDashboard.tsx** (2 supabaseMock calls)
   - Methods: `getSystemHealth`, `getAdminDiagnostics`

10. **components/SettingsModule.tsx** (4 supabaseMock calls)
    - Methods: `storage.upload`, `storage.getPublicUrl`, `saveSettings`

### Medium Priority Components

- **components/AgentClients.tsx** - `getAgentClients`
- **components/ClientGallery.tsx** - `getClients`, `getReconLedger`
- **components/ClientPortfolio.tsx** - `getClients`, `getClientDashboardData`

---

## 📋 Migration Strategy for Components

### Step 1: Add Prisma Queries to lib/db.ts

For each supabaseMock method, create equivalent Prisma query:

```typescript
// Example: getDevelopments migration
export async function getDevelopments(branch?: Branch) {
  return await db.development.findMany({
    where: branch ? { branch } : {},
    include: { stands: true }
  });
}

// Example: createDevelopment migration
export async function createDevelopment(data: any) {
  try {
    const development = await db.development.create({ data });
    emit('developments:created', development); // Realtime event
    return { data: development, error: null, status: 201 };
  } catch (error) {
    return { data: null, error, status: 500 };
  }
}
```

### Step 2: Replace Component Imports

```typescript
// Before
import { supabaseMock } from '../services/supabase.ts';

// After
import { getDevelopments, createDevelopment, updateDevelopment } from '../lib/db';
```

### Step 3: Update Storage Calls

Replace Supabase Storage with UploadThing:

```typescript
// Before
await supabaseMock.storage.from('logos').upload(path, file);
const { publicUrl } = supabaseMock.storage.from('logos').getPublicUrl(path);

// After
const [res] = await uploadFiles('logoUploader', { files: [file] });
const publicUrl = res.url;
```

### Step 4: Update Realtime Subscriptions

```typescript
// Before
const off = supabaseMock.realtime.on('developments:created', handler);

// After
import { on } from '../lib/db';
const off = on('developments:created', handler);
```

---

## 🎯 Next Actions

### Immediate Tasks

1. **Add Prisma Query Wrappers** to lib/db.ts:
   - `getClients()`, `createClient()`, `getClientReservations()`
   - `getStandsByDevelopment()`, `getStandsByClient()`, `updateStandStage()`
   - `getPayments()`, `savePayment()`, `getInvoices()`
   - `getAgentPipeline()`, `getAgentCommissions()`, `getAgentClients()`
   - `getAuditLogs()`, `getCommitManifest()`, `getAdminDiagnostics()`
   - `createDevelopment()`, `updateDevelopment()`, `deleteDevelopment()`
   - `getDevelopmentMetrics()`

2. **Migrate High Priority Components**:
   - Start with PaymentModule.tsx (critical business logic)
   - Then AdminDevelopments.tsx (most complex)
   - Then ShowroomKiosk.tsx (customer-facing)

3. **Replace Storage Layer**:
   - Install UploadThing: `npm install uploadthing @uploadthing/react`
   - Create upload endpoints in app/api/uploadthing/
   - Update AdminDevelopments.tsx media upload
   - Update SettingsModule.tsx logo upload

4. **Update System Diagnostics**:
   - Replace Supabase health check with `getSystemHealth()` from lib/db
   - Add Neon latency monitoring
   - Add Resend email delivery check

---

## 🏗️ Architecture Changes

### Old Stack (Supabase)
```
Components → services/supabase.ts → supabaseMock → Mock Data
                                   → Supabase Client → Supabase Cloud
```

### New Stack (Neon/Prisma)
```
Components → lib/db.ts → Prisma Client → Neon PostgreSQL
          → Server Actions → Prisma Client → Neon PostgreSQL
```

### Benefits

1. **Type Safety**: Full TypeScript types via Prisma schema
2. **Performance**: Direct Neon connection via serverless driver
3. **Simplicity**: One database client instead of mock + real
4. **Cost**: Neon free tier vs Supabase pricing
5. **Control**: Direct SQL access for complex queries

---

## 📚 Reference

### Prisma Client Usage

```typescript
// Find many with filter
const developments = await db.development.findMany({
  where: { branch: 'harare', status: 'ACTIVE' },
  include: { stands: true, media: true },
  orderBy: { created_at: 'desc' }
});

// Find one
const dev = await db.development.findUnique({
  where: { id: 'dev-123' },
  include: { stands: true }
});

// Create
const newDev = await db.development.create({
  data: {
    name: 'New Estate',
    branch: 'harare',
    stands: {
      create: [
        { number: '1', size_sqm: 500, price_usd: 50000 }
      ]
    }
  }
});

// Update
const updated = await db.development.update({
  where: { id: 'dev-123' },
  data: { status: 'SOLD_OUT' }
});

// Delete
await db.development.delete({
  where: { id: 'dev-123' }
});

// Complex query with aggregation
const metrics = await db.stand.groupBy({
  by: ['status'],
  where: { development_id: 'dev-123' },
  _count: true,
  _sum: { price_usd: true }
});
```

### Activity Logging

```typescript
// Log any user action
await logAudit({
  userId: 'user-123',
  action: 'CREATE_DEVELOPMENT',
  entity: 'developments',
  entityId: 'dev-456',
  metadata: {
    development_name: 'Sunset Hills',
    branch: 'harare'
  }
});

// Log communication
await logCommunication({
  userId: 'system',
  type: 'EMAIL',
  recipient: '[email protected]',
  subject: 'Payment Received',
  body: 'Your payment of $1000 has been verified.',
  status: 'sent'
});
```

### Realtime Events

```typescript
// Subscribe to events
import { on, off, emit } from '../lib/db';

// In component
useEffect(() => {
  const unsubscribe = on('developments:created', (dev) => {
    console.log('New development:', dev);
    setDevelopments(prev => [...prev, dev]);
  });
  
  return unsubscribe; // Cleanup
}, []);

// In server action or API route
const newDev = await db.development.create({ data });
emit('developments:created', newDev); // Broadcast event
```

---

## 🔍 Testing Checklist

After each component migration:

- [ ] Import statements updated
- [ ] All supabaseMock calls replaced
- [ ] TypeScript compiles without errors
- [ ] Component renders without console errors
- [ ] Data loads correctly
- [ ] CRUD operations work (Create, Read, Update, Delete)
- [ ] Realtime updates trigger correctly
- [ ] Activity logging captures all actions
- [ ] Error handling works properly

---

## 🚀 Production Deployment

Before going live:

1. **Database**:
   - Run all Prisma migrations: `npx prisma migrate deploy`
   - Verify indexes: `npx prisma db push`
   - Seed initial data if needed

2. **Environment Variables**:
   ```bash
   DATABASE_URL=postgresql://...neon.tech/neondb
   RESEND_API_KEY=re_...
   UPLOADTHING_SECRET=sk_...
   ```

3. **Deprecate Supabase**:
   - Rename services/supabase.ts → services/supabase.legacy.ts
   - Add comment: "DEPRECATED: Use lib/db.ts instead"
   - Remove from version control (add to .gitignore)

4. **Monitor**:
   - Watch Neon dashboard for query performance
   - Check Resend logs for email delivery
   - Monitor UploadThing for file uploads
   - Review Activity table for audit trail completeness

---

Generated: 2024-12-24
Status: Phase 1 Complete (Service Layer) | Phase 2 In Progress (Component Layer)
