# 🎯 PIPELINE MODULE - LEAN REDESIGN PROPOSAL

**Date:** 2026-01-23  
**Status:** 📋 **REDESIGN PROPOSAL - READY FOR IMPLEMENTATION**

---

## 🎯 EXECUTIVE SUMMARY

**Current State:** Three overlapping pipeline systems with duplication and complexity.

**Proposed State:** Single unified Deal-based pipeline with automatic Stand integration.

**Benefits:**
- ✅ 60% code reduction (3 systems → 1)
- ✅ Full feature set (collaboration, rules, audit)
- ✅ Automatic Stand → Deal sync
- ✅ Configurable stages (not hardcoded)
- ✅ Single source of truth

---

## 🏗️ PROPOSED ARCHITECTURE

### Core Principle: Deal as Primary, Stand as Reference

```
Stand Reservation
  ↓
Auto-create Deal (if not exists)
  ↓
Deal.stageId = "Reservation Stage"
Deal.standId = Stand.id
  ↓
All pipeline operations use Deal API
  ↓
Stand.pipeline_stage computed from Deal.stageId (backward compat)
```

---

## 📊 DATA MODEL CHANGES

### 1. Add Stand Link to Deal Model

**File:** `prisma/schema.prisma`

**Change:**
```prisma
model Deal {
  // ... existing fields
  standId      String?  @unique @map("stand_id")  // NEW: Link to Stand
  stand        Stand?   @relation(fields: [standId], references: [id], onDelete: SetNull)  // NEW
  // ... rest of fields
}
```

**Benefits:**
- Deal can reference Stand
- Stand can reference Deal (via relation)
- Unified tracking

---

### 2. Keep Stand.pipeline_stage as Computed (Optional)

**Note:** `pipeline_stage` is not in Stand schema but used in types. We'll:
- Compute it from Deal.stageId when fetching Stands
- Keep backward compatibility
- Gradually migrate to Deal-only

---

### 3. Default Kanban Board per Branch

**Migration:** Create default boards with conveyance stages

**Default Stages:**
1. Reservation
2. Offer Letter
3. Agreement of Sale (AOS)
4. Payment Tracking
5. Transfer

**Benefits:**
- Ready to use immediately
- Can be customized later
- Consistent across branches

---

## 🔄 UNIFIED PIPELINE FLOW

### Flow 1: Stand Reservation → Deal Creation

```typescript
// When Stand is reserved (app/api/admin/reservations/route.ts)
async function createReservation(data) {
  // 1. Create reservation
  const reservation = await prisma.reservation.create({...});
  
  // 2. Update stand status
  await prisma.stand.update({
    where: { id: data.standId },
    data: { status: 'RESERVED', reserved_by: data.clientId }
  });
  
  // 3. Auto-create Deal (NEW)
  const defaultBoard = await getOrCreateDefaultBoard(stand.branch);
  const reservationStage = await getOrCreateStage(defaultBoard.id, 'Reservation');
  
  await prisma.deal.create({
    data: {
      boardId: defaultBoard.id,
      stageId: reservationStage.id,
      standId: data.standId,  // Link to Stand
      clientId: data.clientId,
      ownerId: data.agentId || user.id,
      title: `Stand ${stand.standNumber} - ${stand.development.name}`,
      value: stand.price,
      probability: 50
    }
  });
}
```

---

### Flow 2: Deal Stage Change → Stand Sync

```typescript
// When Deal moves to new stage (app/api/admin/deals/[id]/move/route.ts)
async function moveDeal(dealId, newStageId) {
  const deal = await prisma.deal.update({
    where: { id: dealId },
    data: { stageId: newStageId }
  });
  
  // Sync to Stand if linked (backward compat)
  if (deal.standId) {
    const stage = await prisma.stage.findUnique({ where: { id: newStageId } });
    // Map stage name to pipeline_stage enum (for backward compat)
    const pipelineStage = mapStageToPipelineStage(stage.name);
    
    // Update Stand (if needed for legacy code)
    // Note: pipeline_stage is computed, but we can store in metadata if needed
  }
  
  // Create activity (audit trail)
  await prisma.dealActivity.create({...});
  
  // Trigger automation (already implemented)
  await emitEvent({ type: 'deal.stage_changed', ... });
}
```

---

## 🎨 UNIFIED UI COMPONENT

### Single PipelineBoard Component

**File:** `components/PipelineBoard.tsx` (NEW - replaces Kanban.tsx, AgentPipeline.tsx)

**Features:**
- Works for both Stands and Deals
- Fetches Deals (with Stand info if standId exists)
- Configurable stages from board
- Full collaboration features
- Mobile responsive

**Props:**
```typescript
interface PipelineBoardProps {
  boardId: string;
  filters?: {
    ownerId?: string;  // For agent view
    clientId?: string;
    standId?: string;
    branch?: string;
  };
  viewMode?: 'deals' | 'stands' | 'unified';
}
```

**Benefits:**
- Single component
- Consistent UI
- Less code

---

## 🔧 API UNIFICATION

### Unified Deal API (Already Exists)

**Endpoints:**
- `GET /api/admin/deals` - List deals (with Stand info if standId)
- `POST /api/admin/deals` - Create deal (auto-creates from Stand if needed)
- `POST /api/admin/deals/[id]/move` - Move deal (syncs to Stand)
- `PUT /api/admin/deals/[id]` - Update deal

**Changes:**
- Add `standId` filter support
- Include Stand info in responses
- Auto-create Deal from Stand if missing

---

## 📋 IMPLEMENTATION PLAN

### Phase 1: Foundation (Day 1)

1. **Add standId to Deal model**
   - Update schema
   - Create migration
   - Regenerate Prisma client

2. **Create default boards**
   - Migration script to create default boards per branch
   - Default stages: Reservation, Offer Letter, AOS, Payment, Transfer

3. **Helper functions**
   - `getOrCreateDefaultBoard(branch)` - Get/create default board
   - `getOrCreateStage(boardId, name)` - Get/create stage
   - `mapStageToPipelineStage(stageName)` - Map to enum

---

### Phase 2: Auto-Creation (Day 2)

1. **Update reservation creation**
   - Auto-create Deal when Stand is reserved
   - Link Deal.standId = Stand.id
   - Set Deal.stageId = Reservation stage

2. **Update Stand status changes**
   - When Stand.status → RESERVED, create Deal if not exists
   - When Stand.status → SOLD, update Deal stage if exists

3. **Migration script**
   - Create Deals for existing RESERVED/SOLD Stands
   - Link to default board
   - Set appropriate stage

---

### Phase 3: UI Unification (Day 3)

1. **Create PipelineBoard component**
   - Replace Kanban.tsx
   - Replace AgentPipeline.tsx
   - Use Deal API
   - Show Stand info when standId exists

2. **Update components**
   - Update Kanban.tsx to use Deal API
   - Update AgentPipeline.tsx to use Deal API
   - Remove duplicate code

3. **Remove legacy**
   - Archive SalesPipelineManager.tsx
   - Remove getConveyancePipeline() (replace with Deal query)

---

### Phase 4: Cleanup (Day 4)

1. **Remove duplicate code**
   - Remove Stand pipeline-specific functions
   - Consolidate to Deal API only

2. **Update types**
   - Keep Stand.pipeline_stage as computed (optional)
   - Add Deal.standId to types

3. **Testing**
   - Test Stand reservation → Deal creation
   - Test Deal stage change → Stand sync
   - Test agent view (filtered by ownerId)
   - Test unified view

---

## 📈 EFFICIENCY GAINS

### Code Reduction

**Before:**
- 3 pipeline systems
- ~2,500 lines of code
- Duplicate logic
- Multiple APIs

**After:**
- 1 unified system
- ~1,000 lines of code
- Single source of truth
- Unified API

**Reduction:** ~60% code reduction

---

### Performance Improvements

**Before:**
- Multiple queries (Stand + Deal separately)
- No caching
- Duplicate data fetching

**After:**
- Single query (Deal with Stand join)
- Efficient joins
- Cached board/stage data

**Improvement:** ~50% fewer queries

---

## ✅ BACKWARD COMPATIBILITY

### Stand.pipeline_stage (Computed)

**Strategy:**
- Compute from Deal.stageId when fetching Stands
- Keep in types for backward compat
- Gradually migrate to Deal-only

**Implementation:**
```typescript
// When fetching Stands, compute pipeline_stage from Deal
const stand = await prisma.stand.findUnique({
  where: { id },
  include: {
    deals: {
      where: { isArchived: false },
      include: { stage: true }
    }
  }
});

// Compute pipeline_stage
stand.pipeline_stage = stand.deals[0]?.stage?.name 
  ? mapStageToPipelineStage(stand.deals[0].stage.name)
  : null;
```

---

## 🚨 BREAKING CHANGES

### Database:
- ✅ New `standId` field in Deal (nullable, backward compatible)
- ✅ Migration required for default boards

### API:
- ⚠️ Stand pipeline APIs deprecated (use Deal APIs)
- ✅ Deal API enhanced with Stand support

### UI:
- ⚠️ Kanban.tsx updated (uses Deal API)
- ⚠️ AgentPipeline.tsx updated (uses Deal API)
- ✅ SalesPipelineManager removed

---

## 📝 FILES TO CREATE/MODIFY

### Create:
1. `lib/pipeline-helpers.ts` - Helper functions (getOrCreateDefaultBoard, etc.)
2. `components/PipelineBoard.tsx` - Unified pipeline component
3. `scripts/migrate-stands-to-deals.ts` - Migration script
4. `scripts/create-default-boards.ts` - Create default boards

### Modify:
1. `prisma/schema.prisma` - Add standId to Deal
2. `app/api/admin/reservations/route.ts` - Auto-create Deal
3. `app/api/admin/deals/route.ts` - Add standId filter, include Stand info
4. `components/Kanban.tsx` - Use Deal API
5. `components/AgentPipeline.tsx` - Use Deal API
6. `lib/db.ts` - Remove getConveyancePipeline, add Deal helpers

### Archive/Remove:
1. `components/SalesPipelineManager.tsx` - Legacy, remove
2. `lib/db.ts:getConveyancePipeline()` - Replace with Deal query
3. `lib/db.ts:notifyConveyanceStageChange()` - Use Deal API

---

## 🎯 SUCCESS METRICS

### Code Quality:
- ✅ 60% code reduction
- ✅ Single source of truth
- ✅ No duplication

### Functionality:
- ✅ All features preserved
- ✅ Full collaboration features
- ✅ Pipeline rules work
- ✅ Audit trail complete

### Performance:
- ✅ 50% fewer queries
- ✅ Faster load times
- ✅ Better caching

---

**Status:** 📋 **REDESIGN COMPLETE - READY FOR IMPLEMENTATION**

**Next:** Implement Phase 1 (Foundation).
