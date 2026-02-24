# 🔍 FORENSIC ANALYSIS: Database Null Reference Errors

**Date:** January 18, 2026  
**Severity:** HIGH - Frontend trying to use database directly  
**Root Cause:** Architecture mismatch between browser and server code

---

## 📊 ERROR DIAGNOSIS

### Error 1: getDevelopmentMetrics fails at line 481
```
TypeError: Cannot read properties of null (reading 'stand')
at getDevelopmentMetrics (lib/db.ts:481:29)
```

**Why:**
```typescript
// Line 15 in lib/db.ts
export const db = null; // ← Database is intentionally null in browser

// Line 481 tries to use it
const stands = await db.stand.groupBy(...)  // ← db is null!
```

### Error 2: getStandsByDevelopment fails at line 506
```
TypeError: Cannot read properties of null (reading 'stand')
at getStandsByDevelopment (lib/db.ts:506:21)
```

**Same problem:** `db.stand.findMany()` but `db === null`

### Error 3: MobileInventory calling these functions directly
```typescript
// MobileInventory.tsx:546
const [data, summ] = await Promise.all([
  getStandsByDevelopment(selectedDev.id),  // ← Calling browser-side db function
  getInventorySummary(selectedDev.id)      // ← Calling browser-side db function
]);
```

**Problem:** Component calling database functions that only work on server (API routes)

---

## 🏗️ ARCHITECTURE ISSUE

Your code has TWO execution environments but ONE function set:

```
CURRENT (BROKEN):
┌─────────────────────────────────────┐
│ Browser (Components)                │
│  └─ lib/db.ts (db = null)          │  ← Can't access database
│     └─ getStandsByDevelopment()     │
│        └─ db.stand.findMany()       │  ← Crashes!
└─────────────────────────────────────┘

API Routes (has db)
  └─ Prisma client
     └─ Can use db.stand, db.stand, etc.
```

**Solution:** Components should NOT call lib/db.ts functions directly.  
They should call API routes instead!

---

## 🔧 FIX REQUIRED

### Problem Files:

1. **components/MobileInventory.tsx (Line 546)**
   - Calling `getStandsByDevelopment()` from lib/db.ts
   - Needs to call `/api/stands` endpoint instead

2. **lib/db.ts (Lines 481, 506)**
   - Functions try to use `db` which is `null` in browser
   - These functions should only be called from API routes
   - Need safety checks or complete refactor

3. **app/providers.tsx (Line 70)**
   - Shows warning: "Database not available - running in browser mode"
   - This is intentional - database should NOT be in browser!

---

## ✅ RECOMMENDED FIXES

### Option A: Create API route for MobileInventory data (RECOMMENDED)
```typescript
// app/api/stands/by-development/route.ts
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const developmentId = searchParams.get('id');
  
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  
  const stands = await prisma.stand.findMany({
    where: { development_id: developmentId },
    orderBy: { number: 'asc' }
  });
  
  return NextResponse.json(stands);
}

// app/api/developments/[id]/metrics/route.ts
export async function GET(request: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  
  const stands = await prisma.stand.groupBy({
    by: ['status'],
    where: { development_id: params.id },
    _count: true,
    _sum: { price_usd: true }
  });
  
  return NextResponse.json({
    total: stands.reduce((sum, s) => sum + s._count, 0),
    available: stands.find(s => s.status === 'AVAILABLE')?._count || 0,
    reserved: stands.find(s => s.status === 'RESERVED')?._count || 0,
    sold: stands.find(s => s.status === 'SOLD')?._count || 0,
    totalValue: stands.reduce((sum, s) => sum + (s._sum.price_usd || 0), 0)
  });
}
```

Then in MobileInventory.tsx:
```typescript
const loadStands = async () => {
  if (!selectedDev) return;
  
  const [standsRes, metricsRes] = await Promise.all([
    fetch(`/api/stands/by-development?id=${selectedDev.id}`),
    fetch(`/api/developments/${selectedDev.id}/metrics`)
  ]);
  
  const data = await standsRes.json();
  const metrics = await metricsRes.json();
  
  setStands(data);
  setSummary(metrics);
};
```

### Option B: Add null safety to lib/db.ts functions
```typescript
export async function getDevelopmentMetrics(developmentId: string): Promise<any> {
  if (!isDbAvailable()) {
    // Return mock data or error
    return { total: 0, available: 0, reserved: 0, sold: 0, totalValue: 0 };
  }
  
  try {
    const stands = await db.stand.groupBy({
      by: ['status'],
      where: { development_id: developmentId },
      _count: true,
      _sum: { price_usd: true },
    });
    // ... rest of function
  }
}
```

---

## 📋 SUMMARY

| Issue | Location | Type | Fix |
|-------|----------|------|-----|
| `db` is null | lib/db.ts:15 | Architecture | Use API routes from browser |
| getDevelopmentMetrics crashes | lib/db.ts:481 | Browser calling server code | Move to API route |
| getStandsByDevelopment crashes | lib/db.ts:506 | Browser calling server code | Move to API route |
| MobileInventory calls db functions | components/MobileInventory.tsx:546 | Design error | Call `/api/*` endpoints |
| Warning in Providers | app/providers.tsx:70 | Expected behavior | Not an error |

---

## 🎯 IMMEDIATE ACTION

**DO NOT** call functions from lib/db.ts in browser components.

**DO** create API routes for server-side database operations, then fetch from them.

This is the correct Next.js pattern:
```
Browser Component
  └─> fetch('/api/route')
       └─> API Route Handler (server-side)
            └─> Prisma database call
                 └─> Returns JSON to browser
```
