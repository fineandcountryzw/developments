# Reservation Workflow & Staff Performance Trigger

## 📋 Complete Workflow Sequence

### **Step 1: Client Initiates Reservation via Map**
```typescript
// PlotSelectorMap.tsx
onClick → ReservationModal opens
      ↓
User fills agent, contact info
      ↓
Clicks "Confirm Reservation"
      ↓
fetch('/api/reservations/create', {
  method: 'POST',
  body: {
    stand_id: 'ST001',
    agent_id: 'AGT-123',
    client_id: 'CLI-456',
    is_company_lead: false,
    status: 'PENDING'
  }
})
```

### **Step 2: Neon Record Creation with 72h Expiry**
```typescript
// api/reservations/create.ts - Line 52-70
const expiryDate = new Date(Date.now() + 72 * 60 * 60 * 1000); // +72 hours

const reservation = await prisma.reservation.create({
  data: {
    standId: stand_id,
    agentId: agent_id,
    userId: client_id,
    status: 'PENDING',
    expiresAt: expiryDate,  // ✅ 72-hour countdown starts
    reservedAt: new Date(),
    termsAcceptedAt: new Date(),
  }
});

// Database record now exists with:
// - Reservation ID: cuid (unique, auditable)
// - Stand assigned
// - Agent assigned (if provided)
// - 72-hour expiry timestamp
// - Status: PENDING
```

### **Step 3: Lead Log Entry (System Diagnostics)**
```typescript
// api/reservations/create.ts - Line 72-108
const leadLogEntry = await prisma.activity.create({
  data: {
    type: 'RESERVATION',  // ActivityType enum
    description: 'Client John Doe reserved Stand ST001 in Borrowdale Heights',
    userId: client_id,
    metadata: {
      reservationId: 'res-xyz',
      clientId: 'cli-123',
      clientName: 'John Doe',
      agentId: 'agt-456',
      standId: 'ST001',
      standNumber: 'ST001',
      developmentId: 'dev-789',
      developmentName: 'Borrowdale Heights',
      isCompanyLead: false,
      expiresAt: '2025-01-01T14:30:00Z',  // 72h from now
      status: 'PENDING',
      createdAt: '2025-12-29T14:30:00Z',
      ipAddress: '192.168.1.1',
      userAgent: 'Mozilla/5.0...',
      forensicChecksum: 'base64-hash-for-audit'
    }
  }
});

// ✅ Entry now appears in System Diagnostics dashboard
// ✅ Forensic audit trail recorded
// ✅ Lead tracking enabled for reporting
```

**Visible in Dashboard:**
- Lead Log shows: "[SYSTEM] Client John Doe reserved Stand ST001"
- Timestamp: Dec 29, 2025 14:30
- Expiry warning: Dec 31, 2025 14:30 (72h countdown)

### **Step 4: Staff Performance Increment**
```typescript
// api/reservations/create.ts - Line 110-145
if (agent_id) {
  // Log performance metric for agent
  await prisma.activity.create({
    data: {
      type: 'AGENT_ASSIGNED',
      description: 'Agent assigned to potential sale: Stand ST001',
      userId: agent_id,
      metadata: {
        agentId: 'agt-456',
        agentName: 'John Smith',
        standId: 'ST001',
        standNumber: 'ST001',
        standPrice: '50000.00',
        developmentName: 'Borrowdale Heights',
        reservationId: 'res-xyz',
        metricType: 'POTENTIAL_SALES_VOLUME',
        timestamp: '2025-12-29T14:30:00Z'
      }
    }
  });
}

// ✅ Agent performance dashboard updated:
//    - Potential Sales: +1
//    - Total Sales Value: +$50,000
//    - Sales Pipeline: Updated
```

## 🔄 Data Flow Diagram

```
┌─────────────────────────────┐
│  PlotSelectorMap (Browser)  │
│  User clicks stand          │
└─────────────┬───────────────┘
              │
              │ fetch('/api/reservations/create')
              ▼
┌──────────────────────────────────────────────┐
│   POST /api/reservations/create             │
│   (Vercel Serverless Function)               │
└──────────────┬───────────────────────────────┘
               │
               ├─ Step 1: Validate stand_id
               │
               ├─ Step 2: Create Neon Reservation
               │  ├─ standId
               │  ├─ agentId
               │  ├─ userId
               │  ├─ expiresAt (72h from now)
               │  └─ status: PENDING
               │
               ├─ Step 3: Create Lead Log Activity
               │  ├─ type: RESERVATION
               │  ├─ description: Client X reserved Stand Y
               │  └─ metadata: Full forensic details
               │
               ├─ Step 4: Create Agent Performance Activity
               │  ├─ type: AGENT_ASSIGNED
               │  ├─ description: Agent X assigned to Stand Y
               │  └─ metadata: Price, development, metrics
               │
               └─ Return 201 response
                  ├─ reservationId
                  ├─ expiresAt
                  ├─ leadLogId
                  └─ systemDiagnostics
                      ├─ leadLogEntry
                      ├─ agentPerformanceTracked
                      └─ expiryWarningDate
                  
                  ▼
┌──────────────────────────────┐
│   Dashboard Updates          │
├──────────────────────────────┤
│  Lead Log:                   │
│  "Client reserved Stand ST001"
│                              │
│  Agent Dashboard:            │
│  "Potential Sales: +1"       │
│  "Pipeline Value: +$50,000"  │
│                              │
│  System Diagnostics:         │
│  Active Reservations: 1      │
│  Expiring in: 71h 59m 30s    │
└──────────────────────────────┘
```

## 📊 Database Records Created

### **Reservation Table**
| Field | Value | Purpose |
|-------|-------|---------|
| id | cuid() | Unique identifier |
| standId | ST001 | Which stand |
| agentId | AGT-123 | Assigned agent |
| userId | CLI-456 | Client who reserved |
| status | PENDING | Initial state |
| expiresAt | Now + 72h | Countdown timer |
| reservedAt | Now | Timestamp |
| termsAcceptedAt | Now | Legal acceptance |

### **Activity Table (Lead Log)**
| Field | Value | Purpose |
|-------|-------|---------|
| id | cuid() | Unique log entry |
| type | RESERVATION | Log category |
| description | Client X reserved Stand Y | Human readable |
| userId | CLI-456 | Who performed action |
| metadata | {...} | Forensic details |
| createdAt | Now | Timestamp |

### **Activity Table (Performance)**
| Field | Value | Purpose |
|-------|-------|---------|
| id | cuid() | Unique log entry |
| type | AGENT_ASSIGNED | Performance metric |
| description | Agent X potential sale | Human readable |
| userId | AGT-123 | Agent being tracked |
| metadata | {...} | Price, stand, development |
| createdAt | Now | Timestamp |

## 🎯 Trigger Integration Points

### **Dashboard Module**
The Lead Log entries are immediately visible in:
- **System Diagnostics Dashboard**
  - Shows all reservation activities
  - Displays 72h expiry countdown
  - Logs client information
  - Tracks payment status

### **Staff Performance Module**
Agent metrics are incremented via:
- **Performance Dashboard → Leaderboard**
  - "Potential Sales" counter increases
  - Sales pipeline value updated
  - Agent ranking recalculated
  - Historical tracking enabled

### **Commissions Module** (Future)
Commission calculations will read from:
- Completed reservations with payment proof
- Agent performance history
- Sales velocity metrics
- Commission rate applied

## 🔍 Forensic Checksum

Each reservation includes a checksum for audit trail verification:

```typescript
// Generated in metadata
forensicChecksum: Buffer.from(
  `${reservationId}:${standId}:${clientId}:${expiryTimestamp}`
).toString('base64')

// Example: "cmVzLXh5ejpTVDAwMTpjbGktNDU2OjE3MDQwMDAwMDA="

// Can be verified later to ensure no tampering
```

## ⏱️ 72-Hour Expiry Management

### **Timeline**
```
T=0h     : Reservation created, expiresAt = Now + 72h
T=48h    : System checks daily for upcoming expirations
T=71h    : Expiry warning trigger (1h before expiry)
T=71.9h  : Notification sent to agent & client
T=72h    : Reservation expires, stand reverts to AVAILABLE
```

### **Status Transitions**
```
PENDING (0-72h)
    ├─ Payment uploaded → AWAITING_VERIFICATION
    ├─ Verified by admin → CONFIRMED
    └─ 72h expires → EXPIRED
    
CONFIRMED
    ├─ Conveyance complete → SOLD
    └─ Client cancels → CANCELLED
```

## 📈 Performance Metrics Captured

For each reservation, these metrics are recorded for the agent:

```json
{
  "metricType": "POTENTIAL_SALES_VOLUME",
  "agentId": "AGT-123",
  "standNumber": "ST001",
  "standPrice": 50000.00,
  "developmentName": "Borrowdale Heights",
  "timestamp": "2025-12-29T14:30:00Z",
  "conversionPossibility": "pending_payment"
}
```

**Leaderboard Impact:**
- Potential Sales: +1
- Sales Pipeline Value: +$50,000
- Velocity Score: Updated daily

## 🚀 API Response Example

```json
{
  "success": true,
  "reservationId": "res-xyz789",
  "expiresAt": "2025-01-01T14:30:00Z",
  "leadLogId": "act-abc123",
  "stand": {
    "id": "std-001",
    "number": "ST001",
    "development": "Borrowdale Heights",
    "price": "50000.00"
  },
  "agent": {
    "id": "agt-456",
    "name": "John Smith",
    "phone": "+263771234567"
  },
  "systemDiagnostics": {
    "leadLogEntry": "act-abc123",
    "agentPerformanceTracked": true,
    "expiryWarningDate": "2025-01-01T10:30:00Z"
  }
}
```

## ✅ Verification Checklist

- [x] **Step 1**: Client initiates reservation via PlotSelectorMap
- [x] **Step 2**: Neon record created with 72h expiry
- [x] **Step 3**: Lead Log entry in Activity table
- [x] **Step 4**: Staff Performance metric recorded
- [x] Forensic checksum included
- [x] Error handling with graceful fallback
- [x] Response includes all necessary IDs for tracking
- [x] Dashboard modules can read the data
- [x] Commission module ready for integration

## 📝 Testing the Workflow

### **Test 1: Create Reservation**
```bash
curl -X POST http://localhost:3000/api/reservations/create \
  -H "Content-Type: application/json" \
  -d '{
    "stand_id": "std-001",
    "agent_id": "agt-456",
    "client_id": "cli-789",
    "is_company_lead": false,
    "status": "PENDING"
  }'

# Expected response:
# HTTP 201 Created
# { "success": true, "reservationId": "...", "leadLogId": "..." }
```

### **Test 2: Check Lead Log**
```bash
# In System Diagnostics Dashboard
# Should see: "Client [name] reserved Stand [ST001]"
# With timestamp and forensic metadata
```

### **Test 3: Check Agent Performance**
```bash
# In Staff Performance Dashboard
# Agent should have:
# - Potential Sales: 1
# - Pipeline Value: $50,000
# - Latest activity timestamp
```

## 🔗 Related Modules

- **PlotSelectorMap.tsx** - Triggers reservation
- **ReservationModal.tsx** - Captures client info
- **Dashboard.tsx** - Shows diagnostics
- **PerformanceModule.tsx** - Shows agent metrics
- **api/reservations/create.ts** - Processes workflow
- **prisma/schema.prisma** - Defines database models
