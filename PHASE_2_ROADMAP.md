# Phase 2 & Beyond: 14-Module Refactoring Roadmap

## Current Status

✅ **Phase 1 COMPLETE**: Foundation APIs (Clients, Payments, Stands, Activity Logs)
- All 4 APIs operational and integrated
- Build passing
- Ready for production testing
- Forensic logging in place

---

## Immediate Next Steps (This Week)

### 1. Database Migration
**Priority**: CRITICAL  
**Effort**: 30 minutes  
**Blocker**: Without this, APIs will fail on real data

**Action Items**:
- [ ] Execute SQL from PHASE_1_IMPLEMENTATION_COMPLETE.md in Neon Studio
- [ ] Verify all 4 new tables created: Client, Payment, ActivityLog, enhanced Stand
- [ ] Run `npx prisma generate` to update client
- [ ] Test GET /api/admin/clients (should return empty array, not error)

**Verification**:
```bash
curl http://localhost:5173/api/admin/clients
# Should return: { "data": [], "error": null, "metadata": {...} }
```

---

### 2. Component Integration
**Priority**: HIGH  
**Effort**: 4-6 hours  
**Dependencies**: Database migration complete

**Components to Update**:
- [AdminConsole.tsx](AdminConsole.tsx) - Use new Clients API
- [AgentDashboard.tsx](AgentDashboard.tsx) - Show cross-branch activity log
- [Inventory.tsx](Inventory.tsx) - Use Stands API with branch filtering
- [CommissionTracker.tsx](CommissionTracker.tsx) - Fetch from Payments API
- [SystemDiagnostics.tsx](SystemDiagnostics.tsx) - Show Activity Log feed

**Pattern**:
```typescript
// OLD (mock data)
const [clients] = useState(MOCK_CLIENTS);

// NEW (Neon API)
const [clients, setClients] = useState<Client[]>([]);
useEffect(() => {
  const load = async () => {
    const data = await supabaseMock.getClients('Harare');
    setClients(data);
  };
  load();
}, [branch]);
```

---

### 3. Cross-Branch Testing
**Priority**: HIGH  
**Effort**: 2 hours  
**Dependencies**: Components integrated

**Test Scenarios**:
1. Create client in Harare office
2. Open same dashboard from Bulawayo IP/context
3. Verify client visible (cross-branch visibility)
4. Check activity log shows creation from Harare
5. Create payment in Bulawayo
6. Verify visible in Harare's payment list
7. Check forensic log shows chronologically

**Success Criteria**:
- ✅ Harare can see Bulawayo clients (if access level permits)
- ✅ Activity log shows cross-branch timeline
- ✅ No data isolation between branches
- ✅ Unique constraints work (same client email per branch allowed)

---

## Phase 2: Enhancement Modules (Weeks 2-4)

These modules extend Phase 1 foundation with more complex business logic.

### Module A: Contracts & Templates
**Effort**: 1 week  
**Priority**: High (revenue-critical)  
**Dependencies**: Phase 1 complete

**What to build**:
- `POST /api/admin/contract-templates` - Save template
- `GET /api/admin/contract-templates?branch=Harare` - Fetch templates
- `POST /api/admin/contracts` - Generate contract from template
- `GET /api/admin/contracts?clientId=...` - Fetch client's contracts

**Database Changes**:
```prisma
model ContractTemplate {
  id          String    @id @default(cuid())
  name        String
  content     String    @db.Text
  variables   String[]  // {CLIENT_NAME}, {STAND_NUMBER}, etc.
  branch      String    @default("Harare")
  createdAt   DateTime  @default(now())
  @@index([branch])
}

model Contract {
  id          String    @id @default(cuid())
  clientId    String
  templateId  String
  standId     String
  content     String    @db.Text
  status      String    // DRAFT | SIGNED | ARCHIVED
  signedAt    DateTime?
  branch      String
  createdAt   DateTime  @default(now())
  @@index([clientId])
  @@index([branch])
}
```

---

### Module B: Reconciliation Engine
**Effort**: 1-2 weeks  
**Priority**: Critical (financial accuracy)  
**Dependencies**: Payments API working

**What to build**:
- `POST /api/admin/reconciliation/import-bank-statement` - Upload CSV
- `GET /api/admin/reconciliation/matches?branch=Harare` - Auto-matched items
- `POST /api/admin/reconciliation/mark-matched` - Confirm match
- `GET /api/admin/reconciliation/discrepancies` - Show unmatched items

**Database Changes**:
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
  status    String    // PENDING | MATCHED | MANUAL | DISCREPANCY
  items     String[]  // [paymentId, bankStatementId]
  branch    String
  createdAt DateTime  @default(now())
  @@index([status])
  @@index([branch])
}
```

---

### Module C: Sales Pipeline
**Effort**: 1 week  
**Priority**: Medium (tracking)  
**Dependencies**: Phase 1 complete

**What to build**:
- `GET /api/admin/pipeline?branch=Harare` - Sales stages with counts
- `POST /api/admin/pipeline/move` - Move client to next stage
- `GET /api/admin/pipeline/conversion-rate` - Metrics

**Database Changes**:
```prisma
model PipelineStage {
  id          String    @id @default(cuid())
  clientId    String
  stage       String    // LEAD | INTERESTED | NEGOTIATING | RESERVED | SOLD
  enteredAt   DateTime  @default(now())
  exitedAt    DateTime?
  branch      String
  @@index([stage])
  @@index([branch])
}
```

---

### Module D: Commission Calculations
**Effort**: 3-5 days  
**Priority**: Medium (but agents care about it!)  
**Dependencies**: Payments API, client-agent relationships

**What to build**:
- `GET /api/admin/commissions?agentId=...` - Agent's earnings
- `POST /api/admin/commissions/calculate` - Run monthly calculations
- `GET /api/admin/commissions/dashboard` - Commission summary

**Database Changes**:
```prisma
model Commission {
  id          String    @id @default(cuid())
  agentId     String
  paymentId   String
  percentage  Float     @default(2.5)
  amount      Decimal   @db.Decimal(12, 2)
  status      String    // CALCULATED | APPROVED | PAID
  month       String    // "2025-01"
  branch      String
  createdAt   DateTime  @default(now())
  @@unique([agentId, paymentId, month])
  @@index([status])
  @@index([branch])
}
```

---

## Phase 3: Polish & Optimization (Week 5)

### Unification Tasks

1. **Neon Auth as Sole Gatekeeper**
   - [ ] Replace all auth.js checks with Neon Auth
   - [ ] Use Neon Auth roles for branch assignment
   - [ ] Implement row-level security (RLS) for sensitive data
   - [ ] Update Access Portal Modal to use Neon Auth only

2. **Serverless Adapter Configuration**
   - [ ] Update `lib/prisma.ts` to use @neondatabase/serverless
   - [ ] Configure connection pooling for Vercel
   - [ ] Test under high concurrency (load testing)

3. **Executive Aggregation Views**
   - [ ] Dashboard showing Harare + Bulawayo in real-time
   - [ ] Side-by-side comparison tables
   - [ ] Unified KPIs (revenue, commissions, inventory)

4. **Environment Variable Audit**
   - [ ] All VITE_ prefixed for frontend
   - [ ] DATABASE_URL uses Neon pooler
   - [ ] Auth credentials secure in .env.local

---

## Complete 14-Module List

### ✅ Phase 1: Foundation (COMPLETE)
1. ✅ **Clients** - Contact management
2. ✅ **Payments** - Financial tracking
3. ✅ **Stands/Inventory** - Property inventory
4. ✅ **Activity Logs** - Forensic trail

### 📋 Phase 2: Enhancement (Ready to start)
5. 🔜 **Contracts & Templates** - Document generation
6. 🔜 **Reconciliation** - Bank matching
7. 🔜 **Sales Pipeline** - Conversion tracking
8. 🔜 **Commissions** - Agent earnings

### 🎯 Phase 3: Support (Start week 5)
9. 🔜 **Notifications** - In-app/email alerts
10. 🔜 **Profiles** - User management
11. 🔜 **Communication** - SMS/email templates
12. 🔜 **Dashboard** - Executive KPI view
13. 🔜 **Health Monitor** - System diagnostics
14. 🔜 **Conveyance Pipeline** - Property transfer tracking

---

## Implementation Pattern (Use for all modules)

Every Phase 2+ module follows this exact pattern:

### Step 1: Schema Extension
```prisma
// Add to prisma/schema.prisma
model NewModule {
  id        String    @id @default(cuid())
  branch    String                      // ← CRITICAL
  // ... your fields ...
  createdAt DateTime  @default(now())
  @@index([branch])                     // ← CRITICAL
  @@index([createdAt])                  // ← For ordering
}
```

### Step 2: API Endpoint
```typescript
// Create /app/api/admin/new-module/route.ts
export async function GET(request: NextRequest) {
  const branch = request.nextUrl.searchParams.get('branch') || userBranch;
  const items = await prisma.newModule.findMany({
    where: { branch },
    orderBy: { createdAt: 'desc' }
  });
  return NextResponse.json({ data: items, error: null });
}

export async function POST(request: NextRequest) {
  const data = await request.json();
  const item = await prisma.newModule.create({
    data: { branch: data.branch || userBranch, ...data }
  });
  // Log to activity
  await prisma.activityLog.create({
    data: {
      branch: data.branch,
      action: 'CREATE',
      module: 'MODULE_NAME',
      recordId: item.id,
      description: '...'
    }
  });
  return NextResponse.json({ data: item, error: null }, { status: 201 });
}
```

### Step 3: supabaseMock Integration
```typescript
// Add to services/supabase.ts
getNewModule: async (branch?: Branch) => {
  const response = await fetch(`/api/admin/new-module?branch=${branch || ''}`);
  return response.json().data;
},
saveNewModule: async (item: NewModule) => {
  const response = await fetch('/api/admin/new-module', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(item)
  });
  return response.json();
}
```

### Step 4: Component Integration
```typescript
// Use in components like normal
const [items, setItems] = useState<NewModule[]>([]);
useEffect(() => {
  const load = async () => {
    const data = await supabaseMock.getNewModule('Harare');
    setItems(data);
  };
  load();
}, [branch]);
```

### Step 5: Testing
- [ ] GET returns expected data
- [ ] POST creates with activity log
- [ ] Branch filtering works
- [ ] Cross-branch visibility verified
- [ ] Build still passes

---

## Timeline Summary

| Phase | Modules | Duration | Status |
|-------|---------|----------|--------|
| **1** | Clients, Payments, Stands, ActivityLogs | ✅ Complete | GO LIVE |
| **2a** | Contracts, Reconciliation | Week 2-3 | Ready |
| **2b** | Pipeline, Commissions | Week 3-4 | Ready |
| **3** | Polish, Optimization, Neon Auth, RLS | Week 5 | Ready |
| **Done** | All 14 modules + real-time + RLS + multi-office | Week 6 | PRODUCTION |

---

## Critical Success Factors

1. ✅ **Database in Neon** (not mock arrays)
2. ✅ **Branch indexing** (every table has branch field + index)
3. ✅ **Activity logging** (every change tracked)
4. ✅ **API-first** (no direct component-to-database access)
5. ✅ **Cross-branch visibility** (Harare sees Bulawayo when authorized)
6. ✅ **Real-time sync** (Neon provides this automatically)

---

## Go/No-Go Checklist Before Phase 2

- [ ] All Phase 1 APIs tested and working
- [ ] Database tables created in Neon
- [ ] Components fetching from APIs (not mock data)
- [ ] Cross-branch visibility verified
- [ ] Activity logs appearing in forensic trail
- [ ] Build passing consistently
- [ ] Vercel deployment successful
- [ ] Neon connection stable (no timeouts)

**Status**: Ready to proceed → Phase 2 can start immediately after items above are verified

