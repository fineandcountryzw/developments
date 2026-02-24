# Phase 1 Testing & Integration Guide

## ✅ Step 1: Database Migration

### Instructions (Do this in Neon Studio):

1. Go to **neon.tech** dashboard
2. Select your project
3. Click **SQL Editor**
4. Copy and execute the SQL below:

```sql
-- Create Client table
CREATE TABLE "Client" (
  "id" text NOT NULL,
  "name" text NOT NULL,
  "email" text NOT NULL,
  "phone" text,
  "branch" text NOT NULL DEFAULT 'Harare',
  "kyc" jsonb DEFAULT '[]'::jsonb,
  "ownedStands" text[] DEFAULT '{}',
  "createdAt" timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" timestamp(3) NOT NULL,
  CONSTRAINT "Client_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "Client_email_branch_key" UNIQUE("email","branch")
);
CREATE INDEX "Client_branch_idx" ON "Client"("branch");

-- Create Payment table
CREATE TABLE "Payment" (
  "id" text NOT NULL,
  "clientId" text NOT NULL,
  "clientName" text NOT NULL,
  "amount" decimal(12,2) NOT NULL,
  "status" text NOT NULL DEFAULT 'PENDING',
  "method" text NOT NULL DEFAULT 'PAYNOW',
  "office_location" text NOT NULL,
  "reference" text NOT NULL,
  "confirmedAt" timestamp(3),
  "createdAt" timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" timestamp(3) NOT NULL,
  CONSTRAINT "Payment_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "Payment_reference_key" UNIQUE("reference")
);
CREATE INDEX "Payment_office_location_idx" ON "Payment"("office_location");
CREATE INDEX "Payment_status_idx" ON "Payment"("status");
CREATE INDEX "Payment_clientId_idx" ON "Payment"("clientId");

-- Create ActivityLog table
CREATE TABLE "ActivityLog" (
  "id" text NOT NULL,
  "branch" text NOT NULL,
  "userId" text,
  "action" text NOT NULL,
  "module" text NOT NULL,
  "recordId" text NOT NULL,
  "description" text NOT NULL,
  "changes" text,
  "createdAt" timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ActivityLog_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ActivityLog_branch_action_module_recordId_createdAt_key" 
    UNIQUE("branch","action","module","recordId","createdAt")
);
CREATE INDEX "ActivityLog_branch_idx" ON "ActivityLog"("branch");
CREATE INDEX "ActivityLog_createdAt_idx" ON "ActivityLog"("createdAt");
CREATE INDEX "ActivityLog_module_idx" ON "ActivityLog"("module");

-- Update Stand table
ALTER TABLE "Stand" ADD COLUMN "branch" text DEFAULT 'Harare';
ALTER TABLE "Stand" ADD COLUMN "reserved_by" text;
CREATE INDEX "Stand_branch_idx" ON "Stand"("branch");
CREATE INDEX "Stand_reserved_by_idx" ON "Stand"("reserved_by");
```

### Verify

After executing:
1. In Neon console, go to **Tables**
2. Confirm you see: `Client`, `Payment`, `ActivityLog` tables
3. Check `Stand` table has new columns: `branch`, `reserved_by`

---

## ✅ Step 2: Test APIs Manually

### Start Dev Server

```bash
# In terminal 1:
cd /Users/b.b.monly/Downloads/fine-\&-country-zimbabwe-erp
npm run dev

# Server starts at http://localhost:3000
```

### Test 1: Create Client (Harare)

```bash
curl -X POST http://localhost:3000/api/admin/clients \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Alice Moyo",
    "email": "alice@fineandcountry.co.zw",
    "phone": "+263 70 123 4567",
    "branch": "Harare"
  }'
```

**Expected Response:**
```json
{
  "data": {
    "id": "...",
    "name": "Alice Moyo",
    "email": "alice@fineandcountry.co.zw",
    "phone": "+263 70 123 4567",
    "branch": "Harare"
  },
  "error": null,
  "status": 201
}
```

### Test 2: Fetch All Clients

```bash
curl http://localhost:3000/api/admin/clients
```

**Expected:** Returns array with Alice

### Test 3: Create Payment

```bash
curl -X POST http://localhost:3000/api/admin/payments \
  -H "Content-Type: application/json" \
  -d '{
    "clientId": "client-123",
    "clientName": "Alice Moyo",
    "amount": "150000.00",
    "method": "PAYNOW",
    "office_location": "Harare",
    "reference": "PAY-2025-001"
  }'
```

### Test 4: Check Activity Log (Cross-Branch View)

```bash
curl "http://localhost:3000/api/admin/activity-logs"
```

**Expected:** Shows both Client and Payment activities in chronological order

### Test 5: Cross-Branch Visibility

```bash
# Create client in Bulawayo
curl -X POST http://localhost:3000/api/admin/clients \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Bob Ndlovu",
    "email": "bob@fineandcountry.co.zw",
    "phone": "+263 71 999 8888",
    "branch": "Bulawayo"
  }'

# Fetch both branches
curl "http://localhost:3000/api/admin/clients?branch=Harare"
curl "http://localhost:3000/api/admin/clients?branch=Bulawayo"
```

### Test 6: Unique Constraint

```bash
# Try to create duplicate email in same branch (should fail)
curl -X POST http://localhost:3000/api/admin/clients \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Alice Smith",
    "email": "alice@fineandcountry.co.zw",
    "branch": "Harare"
  }'

# Expected: 409 Conflict - UNIQUE_CONSTRAINT_FAILED
```

---

## ✅ Step 3: Component Integration

### Components to Update

Find these files and update them:

#### 1. **AdminConsole.tsx** (or main admin component)

**Before:**
```typescript
const [clients, setClients] = useState(MOCK_CLIENTS);
```

**After:**
```typescript
const [clients, setClients] = useState<Client[]>([]);

useEffect(() => {
  const load = async () => {
    try {
      const data = await supabaseMock.getClients('Harare');
      setClients(data);
    } catch (error) {
      console.error('Failed to load clients:', error);
    }
  };
  load();
}, []);
```

#### 2. **Inventory.tsx** (or stands component)

**Before:**
```typescript
const stands = MOCK_STANDS.filter(s => s.development_id === devId);
```

**After:**
```typescript
const [stands, setStands] = useState<Stand[]>([]);

useEffect(() => {
  const load = async () => {
    const data = await supabaseMock.getStands('Harare');
    setStands(data.filter(s => s.project === projectName));
  };
  load();
}, [projectName]);
```

#### 3. **CommissionTracker.tsx** (or payments component)

**Before:**
```typescript
const payments = MOCK_PAYMENTS;
```

**After:**
```typescript
const [payments, setPayments] = useState<Payment[]>([]);

useEffect(() => {
  const load = async () => {
    const data = await supabaseMock.getPayments();
    setPayments(data);
  };
  load();
}, []);
```

#### 4. **SystemDiagnostics.tsx** (or forensic component)

**Before:**
```typescript
const logs = MOCK_AUDIT_LOGS;
```

**After:**
```typescript
const [logs, setLogs] = useState([]);

useEffect(() => {
  const load = async () => {
    // Fetch cross-branch activity log
    const data = await supabaseMock.getActivityLog({
      days: 30,
      limit: 100
    });
    setLogs(data);
  };
  load();
}, []);
```

### Find Components Using Mock Data

```bash
cd /Users/b.b.monly/Downloads/fine-\&-country-zimbabwe-erp

# Find all files using MOCK_CLIENTS
grep -r "MOCK_CLIENTS" components/

# Find all files using MOCK_PAYMENTS
grep -r "MOCK_PAYMENTS" components/

# Find all files using MOCK_STANDS
grep -r "MOCK_STANDS" components/

# Find all files using MOCK_AUDIT_LOGS
grep -r "MOCK_AUDIT_LOGS" components/
```

---

## ✅ Step 4: Cross-Branch Verification

### Scenario: Create in Harare, Verify in Bulawayo

```bash
# Step 1: Create client in Harare
curl -X POST http://localhost:3000/api/admin/clients \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Test Client Harare",
    "email": "test-harare@example.com",
    "branch": "Harare"
  }'
# Note the returned ID

# Step 2: Query from Bulawayo office
curl "http://localhost:3000/api/admin/clients?branch=Bulawayo"
# This shows only Bulawayo clients

# Step 3: Get all clients (cross-branch view - requires admin)
curl "http://localhost:3000/api/admin/clients"
# This shows clients from both branches

# Step 4: Check activity log for cross-branch visibility
curl "http://localhost:3000/api/admin/activity-logs"
# Should show the CREATE action for Harare branch
```

### Verify Chronological Order

```bash
# Create multiple records in sequence
# Then query activity log
curl "http://localhost:3000/api/admin/activity-logs?days=7" | jq '.data[] | {branch, action, createdAt}' | head -20
```

Expected: Records sorted by createdAt descending (newest first)

---

## ✅ Step 5: Phase 2 Modules Ready

Once you've verified Steps 1-4, you're ready to start Phase 2.

### Phase 2 Module Structure

Each module will follow this pattern:

```
1. Extend Prisma schema
   model ContractTemplate {
     id String @id @default(cuid())
     branch String
     // ... fields
     @@index([branch])
   }

2. Create API endpoint
   /app/api/admin/contract-templates/route.ts
   - GET: Fetch templates
   - POST: Create template
   - PUT: Update template
   - DELETE: Archive template

3. Update supabaseMock
   getContractTemplates: async (branch) => {
     const response = await fetch(`/api/admin/contract-templates?branch=${branch}`)
     return response.json().data
   }

4. Integrate into components
   const [templates, setTemplates] = useState([])
   useEffect(() => {
     const load = async () => {
       const data = await supabaseMock.getContractTemplates('Harare')
       setTemplates(data)
     }
     load()
   }, [])
```

### Next Phase 2 Module: Contracts & Templates

**Database Schema:**
```prisma
model ContractTemplate {
  id        String    @id @default(cuid())
  name      String
  content   String    @db.Text
  variables String[]
  branch    String    @default("Harare")
  createdAt DateTime  @default(now())
  @@index([branch])
}

model Contract {
  id         String    @id @default(cuid())
  clientId   String
  templateId String
  standId    String
  content    String    @db.Text
  status     String    @default("DRAFT")
  signedAt   DateTime?
  branch     String
  createdAt  DateTime  @default(now())
  @@index([clientId])
  @@index([branch])
}
```

---

## Testing Checklist

### Unit Tests
- [ ] POST /api/admin/clients returns 201 with data
- [ ] GET /api/admin/clients returns array
- [ ] PUT /api/admin/clients updates data
- [ ] DELETE /api/admin/clients soft deletes
- [ ] POST /api/admin/payments returns 201
- [ ] GET /api/admin/payments returns array
- [ ] PUT /api/admin/payments updates status
- [ ] GET /api/admin/activity-logs returns both branches

### Integration Tests
- [ ] Create client → activity log created
- [ ] Create payment → activity log created
- [ ] Create stand → activity log created
- [ ] Update → activity log shows before/after

### Cross-Branch Tests
- [ ] Create in Harare → visible when querying with branch=Harare
- [ ] Create in Bulawayo → visible when querying with branch=Bulawayo
- [ ] GET without branch filter → shows both
- [ ] Activity log → shows both branches chronologically

### Error Tests
- [ ] Duplicate email same branch → 409
- [ ] Missing fields → 400
- [ ] Unauthorized → 401
- [ ] Not found → 404

---

## Troubleshooting

### API Returns Empty Array
- [ ] Check DATABASE_URL is set
- [ ] Verify tables were created in Neon
- [ ] Check dev server is running: `ps aux | grep vite`
- [ ] Look at server logs for errors

### Build Fails
- [ ] Run: `npm install`
- [ ] Run: `npm run build`
- [ ] Check for TypeScript errors: `npx tsc --noEmit`

### Dev Server Won't Start
- [ ] Kill existing processes: `pkill -9 vite`
- [ ] Clear cache: `rm -rf node_modules/.vite`
- [ ] Restart: `npm run dev`

---

## Next: Proceed to Phase 2

Once all tests pass, you're ready for:
1. Contracts & Templates API (1 week)
2. Reconciliation Engine (1-2 weeks)
3. Sales Pipeline (1 week)
4. Commission Calculations (3-5 days)

Total Phase 2: 3-4 weeks to complete all 4 modules
Total Project: 6 weeks to complete all 14 modules

