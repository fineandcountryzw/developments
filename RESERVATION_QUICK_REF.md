# Reservation Workflow - Quick Reference Card

## 🎯 The 4-Step Workflow

### **Step 1: Initiate** (Client Action)
```
PlotSelectorMap → Click Stand → ReservationModal
                 ↓
            Enter agent, phone, email
                 ↓
            Click "Confirm Reservation"
```

### **Step 2: Record** (API Action)
```
POST /api/reservations/create
↓
Create Neon Reservation:
  - standId: "ST001"
  - agentId: "AGT-123" 
  - userId: "CLI-456"
  - expiresAt: NOW + 72h ✅
  - status: "PENDING"
```

### **Step 3: Log** (Audit Trail)
```
Create Activity (RESERVATION):
  - Description: "Client John reserved Stand ST001"
  - Type: RESERVATION
  - Metadata: Full forensic details
  ✅ Visible in System Diagnostics Dashboard
```

### **Step 4: Track** (Performance)
```
Create Activity (AGENT_ASSIGNED):
  - Agent: "John Smith" 
  - Potential Sale: "$50,000"
  - Type: AGENT_ASSIGNED
  ✅ Agent dashboard updated
  ✅ Leaderboard incremented
```

## 📊 Database Impact

| Table | Action | Purpose |
|-------|--------|---------|
| Reservation | INSERT | Create 72h timer |
| Activity | INSERT | Lead log entry |
| Activity | INSERT | Performance metric |

## 🔗 Module Integration

| Module | Trigger | Visibility |
|--------|---------|------------|
| **System Diagnostics** | Activity created | Lead log shown |
| **Staff Performance** | Agent assigned | Metrics updated |
| **Dashboard** | Reservation expires | Countdown visible |
| **Commissions** | Payment verified | Ready for calculation |

## ⏱️ 72-Hour Timer

```
Created: Dec 29, 14:30
Expires: Jan 1, 14:30  ← 72 hours later
Warning: Jan 1, 10:30  ← 1 hour before expiry
```

**What happens at expiry:**
- Reservation status → EXPIRED
- Stand reverts to AVAILABLE
- Client notified if not verified
- Agent loses potential sale if unpaid

## 📱 API Response Structure

```json
{
  "success": true,
  "reservationId": "res-xyz",          // ID for updates
  "leadLogId": "act-abc",               // ID for reference
  "expiresAt": "2025-01-01T14:30Z",     // 72h deadline
  "systemDiagnostics": {
    "agentPerformanceTracked": true,    // ✅ Staff module triggered
    "expiryWarningDate": "2025-01-01T10:30Z"
  }
}
```

## 🔍 Forensic Fields

```
Checksum: Base64-encoded verification hash
IPAddress: Client IP captured
UserAgent: Browser/device info
Timestamp: Exact creation time (ISO 8601)
Metadata: Complete audit trail
```

## ✅ Success Indicators

**In System Diagnostics:**
- ✅ Lead log entry appears
- ✅ Timestamp matches reservation time
- ✅ 72h countdown visible

**In Staff Performance:**
- ✅ Agent name shows in activity
- ✅ Potential Sales count increases
- ✅ Pipeline value updated
- ✅ Leaderboard recalculates

**In Neon Database:**
- ✅ Reservation record with 72h expiryAt
- ✅ Two Activity records created
- ✅ Stand linked to agent

## 🚨 Error Scenarios

| Error | Handling |
|-------|----------|
| Missing stand_id | Return 400 Bad Request |
| Database error | Return 500, log error |
| Performance log fails | Continue (don't fail reservation) |
| Activity creation fails | Still create reservation, log warning |

## 📈 Metrics Tracked

```
Per Reservation:
├─ Potential Sales: +1
├─ Sales Pipeline Value: +[standPrice]
├─ Agent Activity: Timestamped
├─ Lead Status: PENDING → CONFIRMED → SOLD
└─ Velocity: Days from PENDING to CONFIRMED

Per Agent:
├─ Total Potential Sales: Sum of all
├─ Active Reservations: Count (expiresAt > now)
├─ Conversion Rate: Completed/Total
└─ Average Close Time: Average PENDING→CONFIRMED
```

## 🔄 Status Flow

```
PENDING (0-72h, no payment)
    ↓ Payment uploaded
AWAITING_VERIFICATION
    ↓ Admin verifies
CONFIRMED
    ↓ Conveyance complete
SOLD ✅ (Commission triggers)

OR at 72h expiry:
EXPIRED (moved back to AVAILABLE)
```

## 🎓 Example Scenario

**Timeline:**
```
Dec 29, 14:30 → Client clicks Stand ST001 in Borrowdale Heights
Dec 29, 14:30 → Assigned to Agent John Smith
Dec 29, 14:30 → Reservation created (expiresAt: Jan 1, 14:30)
Dec 29, 14:30 → Lead log: "Client John Doe reserved Stand ST001"
Dec 29, 14:30 → Performance: Agent gets +1 Potential Sale, +$50,000
```

**Dashboard Views:**
```
System Diagnostics:
  [SYSTEM] Client John Doe reserved Stand ST001 - 71h 59m remaining

Staff Performance:
  Agent: John Smith
  Potential Sales: 47 → 48
  Pipeline: $2.35M → $2.4M
  Status: Active (1 hot lead)
```

## 📝 Code Location Reference

| File | Lines | Purpose |
|------|-------|---------|
| `api/reservations/create.ts` | 50-70 | Neon creation + 72h |
| `api/reservations/create.ts` | 72-108 | Lead log entry |
| `api/reservations/create.ts` | 110-145 | Performance metric |
| `components/PlotSelectorMap.tsx` | Varies | Triggers workflow |
| `components/ReservationModal.tsx` | Varies | Collects client data |

## 🧪 Quick Test

**Curl command:**
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
```

**Expected response:**
```json
{
  "success": true,
  "reservationId": "res-xxx",
  "leadLogId": "act-yyy",
  "expiresAt": "2025-01-01T14:30:00Z",
  "systemDiagnostics": {
    "agentPerformanceTracked": true
  }
}
```

---

**All 4 steps completed ✅ System is trigger-ready!**
