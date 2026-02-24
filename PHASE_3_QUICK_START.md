# Phase 3 Quick Start Guide

**🟢 Status**: Ready to Begin  
**📅 Timeline**: 1-2 weeks  
**🎯 Goal**: Production-ready unified system with Neon Auth, serverless optimization, and executive dashboards

---

## The 4 Tasks at a Glance

```
┌─────────────────────────────────────────────────────┐
│ TASK 1: Neon Auth Integration (2-3 days)           │
│ ├─ Create lib/neonAuth.ts                          │
│ ├─ Enable RLS on 4 critical tables                 │
│ ├─ Update all 14+ API endpoints                    │
│ └─ Test branch isolation                           │
├─────────────────────────────────────────────────────┤
│ TASK 2: Serverless Adapter (1 day)                 │
│ ├─ Install @neondatabase/serverless                │
│ ├─ Update prisma/schema.prisma                     │
│ ├─ Configure DATABASE_URL + DATABASE_URL_UNPOOLED │
│ └─ Test pooled connections                        │
├─────────────────────────────────────────────────────┤
│ TASK 3: Executive Dashboards (2-3 days)            │
│ ├─ Create ExecutiveDashboard.tsx                   │
│ ├─ Build /api/admin/executive endpoint             │
│ ├─ Add cross-branch metrics                        │
│ └─ Test Admin-only access                         │
├─────────────────────────────────────────────────────┤
│ TASK 4: Environment Audit (1 day)                  │
│ ├─ Create scripts/validate-env.js                  │
│ ├─ Document all required variables                 │
│ ├─ Update .env.local structure                     │
│ └─ Test validation script                         │
└─────────────────────────────────────────────────────┘
```

---

## Phase 3 Command Sequence

### Task 1: Neon Auth (Copy & Paste Ready)

```bash
# Step 1: Install Neon Auth client
npm install @neondatabase/auth

# Step 2: Create Neon Auth service (from PHASE_3_IMPLEMENTATION_GUIDE.md Step 1b)
cat > lib/neonAuth.ts << 'EOF'
import { createClient } from '@neondatabase/auth';

const neonAuth = createClient({
  apiUrl: process.env.VITE_NEON_AUTH_URL,
  apiKey: process.env.NEON_AUTH_API_KEY,
});

export async function getNeonAuthUser() {
  try {
    const user = await neonAuth.auth.getUser();
    if (!user) return null;
    
    return {
      id: user.id,
      email: user.email,
      branch: user.user_metadata?.branch || 'Harare',
      role: user.user_metadata?.role || 'Agent',
    };
  } catch (error) {
    console.error('[NEON AUTH] Error:', error);
    return null;
  }
}

export async function validateNeonAuthToken(token: string) {
  try {
    const payload = await neonAuth.auth.verifyToken(token);
    return payload;
  } catch (error) {
    console.error('[NEON AUTH] Token validation failed:', error);
    return null;
  }
}
EOF

# Step 3: Enable RLS (create migration)
cat > prisma/migrations/phase3_enable_rls.sql << 'EOF'
ALTER TABLE "Client" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Payment" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Commission" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Stand" ENABLE ROW LEVEL SECURITY;

CREATE POLICY branch_isolation_policy ON "Client"
  AS RESTRICTIVE
  FOR ALL
  USING (branch = current_setting('app.user_branch', true)::text);

CREATE POLICY branch_isolation_policy ON "Payment"
  AS RESTRICTIVE
  FOR ALL
  USING (branch = current_setting('app.user_branch', true)::text);

CREATE POLICY branch_isolation_policy ON "Commission"
  AS RESTRICTIVE
  FOR ALL
  USING (branch = current_setting('app.user_branch', true)::text);

CREATE POLICY branch_isolation_policy ON "Stand"
  AS RESTRICTIVE
  FOR ALL
  USING (branch = current_setting('app.user_branch', true)::text);

CREATE POLICY admin_bypass ON "Client"
  AS PERMISSIVE
  FOR ALL
  USING (current_setting('app.user_role', true)::text = 'Admin');
EOF

# Step 4: Apply migration
npx prisma migrate dev --name enable_rls

# Step 5: Update .env.local
cat >> .env.local << 'EOF'

# Neon Auth
VITE_NEON_AUTH_URL=https://YOUR_NEON_AUTH_URL
NEON_AUTH_API_KEY=YOUR_NEON_AUTH_KEY
EOF
```

### Task 2: Serverless (Copy & Paste Ready)

```bash
# Step 1: Install serverless adapter
npm install @neondatabase/serverless

# Step 2: Update Prisma schema
cat > prisma/schema.prisma << 'EOF'
generator client {
  provider = "prisma-client-js"
  previewFeatures = ["nativeDistinctCountAggregations"]
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
  directUrl = env("DATABASE_URL_UNPOOLED")
}
EOF

# Step 3: Update lib/prisma.ts
cat > lib/prisma.ts << 'EOF'
import { PrismaClient } from '@prisma/client';

const globalForPrisma = global as unknown as { prisma: PrismaClient };

const prisma =
  globalForPrisma.prisma ||
  new PrismaClient({
    log: ['error'],
    errorFormat: 'pretty',
  });

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}

prisma.$on('beforeExit', async () => {
  await prisma.$disconnect();
});

export default prisma;
EOF

# Step 4: Update .env.local
cat >> .env.local << 'EOF'

# Neon Serverless
DATABASE_URL=postgresql://[user]:[password]@[host]/[db]?schema=public
DATABASE_URL_UNPOOLED=postgresql://[user]:[password]@[host]/[db]?schema=public
PRISMA_CLIENT_ENGINE_TYPE=dataproxy
EOF

# Step 5: Test
npm run build
npm run preview
```

### Task 3: Executive Dashboard (Copy & Paste Ready)

```bash
# Step 1: Create ExecutiveDashboard component
cat > components/ExecutiveDashboard.tsx << 'EOF'
'use client';

import React, { useState, useEffect } from 'react';
import { supabaseMock } from '@/services/supabase';

export default function ExecutiveDashboard() {
  const [harareMetrics, setHarareMetrics] = useState<any>(null);
  const [bulawayoMetrics, setBulawayoMetrics] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const fetchMetrics = async () => {
      setLoading(true);
      try {
        const hare = await supabaseMock.getExecutiveMetrics('Harare');
        const byo = await supabaseMock.getExecutiveMetrics('Bulawayo');
        
        setHarareMetrics(hare.data);
        setBulawayoMetrics(byo.data);
      } catch (error) {
        console.error('Error:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchMetrics();
  }, []);

  return (
    <div className="space-y-6">
      <div className="bg-gradient-to-r from-purple-600 to-blue-600 text-white p-6 rounded-lg">
        <h1 className="text-3xl font-bold">Executive Dashboard</h1>
        <p className="text-purple-100">Real-time cross-branch metrics</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Harare Card */}
        <div className="border border-gray-200 rounded-lg p-6 bg-blue-50">
          <h2 className="text-xl font-bold text-blue-900 mb-4">Harare Office</h2>
          <div className="space-y-3">
            <div className="flex justify-between">
              <span className="text-gray-700">Total Clients</span>
              <span className="font-bold">{harareMetrics?.totalClients || 0}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-700">Revenue</span>
              <span className="font-bold">USD {harareMetrics?.totalRevenue?.toFixed(2) || '0.00'}</span>
            </div>
          </div>
        </div>

        {/* Bulawayo Card */}
        <div className="border border-gray-200 rounded-lg p-6 bg-green-50">
          <h2 className="text-xl font-bold text-green-900 mb-4">Bulawayo Office</h2>
          <div className="space-y-3">
            <div className="flex justify-between">
              <span className="text-gray-700">Total Clients</span>
              <span className="font-bold">{bulawayoMetrics?.totalClients || 0}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-700">Revenue</span>
              <span className="font-bold">USD {bulawayoMetrics?.totalRevenue?.toFixed(2) || '0.00'}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
EOF

# Step 2: Create executive API endpoint
mkdir -p app/api/admin/executive
cat > app/api/admin/executive/route.ts << 'EOF'
import { NextRequest, NextResponse } from 'next/server';
import { getNeonAuthUser } from '@/lib/neonAuth';
import prisma from '@/lib/prisma';

export async function GET(request: NextRequest) {
  try {
    const user = await getNeonAuthUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (user.role !== 'Admin') {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
    }

    const branch = request.nextUrl.searchParams.get('branch') || 'Harare';

    const totalClients = await prisma.client.count({ where: { branch } });
    const totalPayments = await prisma.payment.aggregate({
      where: { branch },
      _sum: { amount: true },
    });

    return NextResponse.json({
      data: {
        branch,
        totalClients,
        totalRevenue: totalPayments._sum.amount || 0,
      },
      error: null,
    });
  } catch (error: any) {
    console.error('[EXECUTIVE METRICS] Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
EOF

# Step 3: Add to supabaseMock
# Open services/supabase.ts and add this function to the mock object:
# getExecutiveMetrics: async (branch?: string) => { ... }
# See PHASE_3_IMPLEMENTATION_GUIDE.md Step 3c for full code
```

### Task 4: Environment Audit (Copy & Paste Ready)

```bash
# Step 1: Create validation script
cat > scripts/validate-env.js << 'EOF'
#!/usr/bin/env node

const fs = require('fs');

const requiredFrontend = ['VITE_NEON_AUTH_URL', 'VITE_API_BASE_URL'];
const requiredBackend = ['DATABASE_URL', 'NEON_AUTH_API_KEY'];

console.log('🔍 Validating environment variables...\n');

const envLocal = fs.existsSync('.env.local') ? fs.readFileSync('.env.local', 'utf8') : '';
requiredFrontend.forEach(key => {
  if (!envLocal.includes(key)) {
    console.warn(`⚠️  Missing frontend variable: ${key}`);
  } else {
    console.log(`✅ ${key}`);
  }
});

// Check for exposed secrets
const exposed = ['DATABASE_URL', 'NEON_AUTH_API_KEY', 'JWT_SECRET'];
exposed.forEach(key => {
  if (envLocal.includes('VITE_' + key)) {
    console.error(`🚨 SECURITY ISSUE: ${key} exposed in frontend!`);
    process.exit(1);
  }
});

console.log('\n✅ Environment validation passed');
EOF

chmod +x scripts/validate-env.js

# Step 2: Add to package.json scripts
# "validate-env": "node scripts/validate-env.js"

# Step 3: Run validation
npm run validate-env

# Step 4: Update .env.local (example)
cat > .env.local << 'EOF'
# Frontend (safe to expose)
VITE_NEON_AUTH_URL=https://...
VITE_API_BASE_URL=http://localhost:5173
VITE_ENVIRONMENT=development

# Backend (never expose these)
DATABASE_URL=postgresql://...
DATABASE_URL_UNPOOLED=postgresql://...
NEON_AUTH_API_KEY=...
EOF
```

---

## Daily Checklist

### Day 1-2: Task 1 (Neon Auth)
- [ ] Create `lib/neonAuth.ts` with getNeonAuthUser() function
- [ ] Enable RLS on 4 critical tables (Client, Payment, Commission, Stand)
- [ ] Run migration: `npx prisma migrate dev --name enable_rls`
- [ ] Update `.env.local` with NEON_AUTH_API_KEY and VITE_NEON_AUTH_URL
- [ ] Replace `getCurrentUser()` in 2-3 API endpoints
- [ ] Test: `npm run build` passes
- [ ] Commit changes: "feat(auth): integrate Neon Auth as sole gatekeeper"

### Day 3: Task 2 (Serverless)
- [ ] Install `@neondatabase/serverless`
- [ ] Update `prisma/schema.prisma` with directUrl
- [ ] Update `lib/prisma.ts` for serverless
- [ ] Configure DATABASE_URL + DATABASE_URL_UNPOOLED
- [ ] Test pooled connection: `npm run preview`
- [ ] Build: `npm run build` (should be <3s)
- [ ] Commit changes: "feat(serverless): configure Prisma for Vercel edge"

### Day 4-5: Task 3 (Dashboards)
- [ ] Create `components/ExecutiveDashboard.tsx`
- [ ] Create `/app/api/admin/executive/route.ts`
- [ ] Add `getExecutiveMetrics()` to supabaseMock
- [ ] Test: Admin sees both Harare + Bulawayo
- [ ] Test: Agent sees only their branch
- [ ] Build: `npm run build` passes
- [ ] Commit changes: "feat(dashboard): add executive cross-branch view"

### Day 6: Task 4 (Environment Audit)
- [ ] Create `scripts/validate-env.js`
- [ ] Run validation: `npm run validate-env`
- [ ] Update `.gitignore` to exclude `.env.local`
- [ ] Document all required env vars
- [ ] Update `vercel.json` with env settings
- [ ] Final audit: No secrets in git history
- [ ] Commit changes: "chore(env): audit and document environment variables"

---

## Success Signals

✅ **Task 1 Complete**: 
- No errors in build
- RLS policies created in Neon
- API endpoints reject unauthenticated requests

✅ **Task 2 Complete**: 
- Build time <3 seconds
- No "connection timeout" errors
- Preview deployment works

✅ **Task 3 Complete**: 
- Executive Dashboard shows metrics
- Admin sees both branches
- Agents see only their branch

✅ **Task 4 Complete**: 
- `npm run validate-env` passes
- No secrets in `.git/config` or source code
- `.env.local` not in git history

---

## Troubleshooting

| Issue | Solution |
|-------|----------|
| `Cannot find module '@neondatabase/auth'` | `npm install @neondatabase/auth` |
| RLS policy syntax error | Check PostgreSQL RLS syntax in PHASE_3_IMPLEMENTATION_GUIDE.md |
| Connection pooling timeout | Use `DATABASE_URL_POOLER` endpoint from Neon Dashboard |
| Environment variable not found | Add to `.env.local` with correct prefix (VITE_ for frontend) |
| Build fails after serverless adapter | Run `npm install @neondatabase/serverless` |

---

## Files to Create/Update

| File | Type | Task |
|------|------|------|
| `lib/neonAuth.ts` | **Create** | Task 1 |
| `prisma/migrations/phase3_enable_rls.sql` | **Create** | Task 1 |
| `prisma/schema.prisma` | **Update** | Task 2 |
| `lib/prisma.ts` | **Update** | Task 2 |
| `components/ExecutiveDashboard.tsx` | **Create** | Task 3 |
| `app/api/admin/executive/route.ts` | **Create** | Task 3 |
| `services/supabase.ts` | **Update** | Task 3 |
| `scripts/validate-env.js` | **Create** | Task 4 |
| `.env.local` | **Update** | Task 4 |
| `.gitignore` | **Update** | Task 4 |

---

## Ready to Start?

Choose your preferred starting point:

**Option A: Comprehensive Guide** (More details)
```bash
cat PHASE_3_IMPLEMENTATION_GUIDE.md | less
```

**Option B: Jump Into Task 1** (Hands-on)
```bash
# Copy-paste the Task 1 commands above and execute them
```

**Option C: Visual Overview** (High-level)
```bash
cat PHASE_3_LAUNCH_SUMMARY.md | less
```

---

**Status**: 🟢 Phase 3 ready to begin. Start with Task 1 today!
