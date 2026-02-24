# 🎨 Demo Data Visual Guide

## 📊 Data Overview Diagram

```
Fine & Country Zimbabwe ERP - Demo Data Structure
═══════════════════════════════════════════════════

┌─────────────────────────────────────────────────┐
│                    USERS (6)                     │
├─────────────────────────────────────────────────┤
│                                                  │
│  👑 Admin (1)                                    │
│  └─ [email protected]                      │
│                                                  │
│  👔 Agents (2)                                   │
│  ├─ John Moyo ([email protected])         │
│  └─ Sarah Ncube ([email protected])       │
│                                                  │
│  👥 Clients (3)                                  │
│  ├─ Michael Chikwanha ([email protected]) │
│  ├─ Grace Mutasa ([email protected])       │
│  └─ David Sibanda ([email protected])      │
│                                                  │
└─────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────┐
│              DEVELOPMENTS (4)                    │
├─────────────────────────────────────────────────┤
│                                                  │
│  🏘️ Borrowdale Brooke Estate                    │
│     Harare | 45 stands | $85k base              │
│     ├─ Phase: READY_TO_BUILD (100%)             │
│     └─ Status: 5 sold, 8 reserved, 32 available │
│                                                  │
│  🌊 Victoria Falls View                          │
│     Victoria Falls | 60 stands | $125k base     │
│     ├─ Phase: SERVICING (65%)                   │
│     └─ Status: 3 sold, 3 reserved, 54 available │
│                                                  │
│  🏔️ Bulawayo Heights                             │
│     Bulawayo | 38 stands | $55k base            │
│     ├─ Phase: READY_TO_BUILD (90%)              │
│     └─ Status: 7 sold, 6 reserved, 25 available │
│                                                  │
│  🌳 Greendale Gardens                            │
│     Harare | 52 stands | $42k base              │
│     ├─ Phase: COMPLETED (100%)                  │
│     └─ Status: 20 sold, 14 reserved, 18 avail.  │
│                                                  │
└─────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────┐
│               RESERVATIONS (4)                   │
├─────────────────────────────────────────────────┤
│                                                  │
│  ⏱️ Reservation #1 - BB002                       │
│     Client: Michael Chikwanha                    │
│     Agent: John Moyo                             │
│     Status: PENDING                              │
│     Timer: ⏰ 48 hours remaining                 │
│     Type: Agent Lead                             │
│                                                  │
│  📄 Reservation #2 - VF002                       │
│     Client: Grace Mutasa                         │
│     Agent: None (Company Lead)                   │
│     Status: PAYMENT_PENDING                      │
│     Timer: ⏸️ STOPPED (proof uploaded)           │
│     POP: ✅ Uploaded, awaiting verification      │
│                                                  │
│  ✅ Reservation #3 - BH001                       │
│     Client: David Sibanda                        │
│     Agent: Sarah Ncube                           │
│     Status: CONFIRMED                            │
│     Timer: ⏸️ STOPPED (payment verified)         │
│     Progress: Ready for AOS                      │
│                                                  │
│  🚨 Reservation #4 - BB003                       │
│     Client: Michael Chikwanha                    │
│     Agent: John Moyo                             │
│     Status: PENDING                              │
│     Timer: ⚠️ 2 HOURS REMAINING!                 │
│     Alert: URGENT - About to expire              │
│                                                  │
└─────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────┐
│            ACTIVITY LOGS (8+)                    │
├─────────────────────────────────────────────────┤
│                                                  │
│  📝 Recent Activities:                           │
│  ├─ Admin logged in (2h ago)                    │
│  ├─ John Moyo logged in (5h ago)                │
│  ├─ Client reserved BB001 (1d ago)              │
│  ├─ Grace uploaded payment proof (12h ago)      │
│  ├─ Admin verified payment (10h ago)            │
│  ├─ Stand BB002 → RESERVED (1d ago)             │
│  ├─ New client registered (3d ago)              │
│  └─ Agent assigned to reservation (2d ago)      │
│                                                  │
└─────────────────────────────────────────────────┘
```

---

## 🗺️ Stand Distribution Map

```
BORROWDALE BROOKE ESTATE (45 stands)
════════════════════════════════════
[🟢][🟢][🟢][🟢][🟢][🟢][🟢][🟢]  Available (32)
[🟡][🟡][🟡][🟡][🟡][🟡][🟡][🟡]  Reserved (8)
[🔴][🔴][🔴][🔴][🔴]             Sold (5)

VICTORIA FALLS VIEW (60 stands)
════════════════════════════════════
[🟢][🟢][🟢][🟢][🟢][🟢][🟢][🟢][🟢][🟢]
[🟢][🟢][🟢][🟢][🟢][🟢][🟢][🟢][🟢][🟢]
[🟢][🟢][🟢][🟢][🟢][🟢][🟢][🟢][🟢][🟢]
[🟢][🟢][🟢][🟢][🟢][🟢][🟢][🟢][🟢][🟢]
[🟢][🟢][🟢][🟢][🟢][🟢][🟢][🟢][🟢][🟢]
[🟡][🟡][🟡][🔴][🔴][🔴][🟢][🟢][🟢][🟢]

Available (54) | Reserved (3) | Sold (3)

BULAWAYO HEIGHTS (38 stands)
════════════════════════════════════
[🟢][🟢][🟢][🟢][🟢][🟢][🟢][🟢]
[🟢][🟢][🟢][🟢][🟢][🟢][🟢][🟢]
[🟢][🟢][🟢][🟢][🟢][🟢][🟢][🟢]
[🟡][🟡][🟡][🟡][🟡][🟡]
[🔴][🔴][🔴][🔴][🔴][🔴][🔴]

Available (25) | Reserved (6) | Sold (7)

GREENDALE GARDENS (52 stands)
════════════════════════════════════
[🟢][🟢][🟢][🟢][🟢][🟢][🟢][🟢][🟢]
[🟢][🟢][🟢][🟢][🟢][🟢][🟢][🟢][🟢]
[🟡][🟡][🟡][🟡][🟡][🟡][🟡][🟡]
[🟡][🟡][🟡][🟡][🟡][🟡]
[🔴][🔴][🔴][🔴][🔴][🔴][🔴][🔴]
[🔴][🔴][🔴][🔴][🔴][🔴][🔴][🔴]
[🔴][🔴][🔴][🔴]

Available (18) | Reserved (14) | Sold (20)

Legend: 🟢 Available | 🟡 Reserved | 🔴 Sold
```

---

## 📈 Price Distribution

```
Development Pricing Overview
═══════════════════════════════════════════════

$140k ┤
      │                    ╭─────╮
      │                    │  VF │  Victoria Falls
$120k ┤                    │View │  $125k - $215k
      │                    ╰─────╯
      │
$100k ┤         ╭─────╮
      │         │ BB  │  Borrowdale Brooke
$80k  ┤         │Est. │  $85k - $130k
      │         ╰─────╯
      │
$60k  ┤   ╭─────╮
      │   │ BH  │  Bulawayo Heights
$40k  ┤   │     │  $55k - $85k
      │   ╰─────╯ ╭─────╮
      │           │ GG  │  Greendale Gardens
$20k  ┤           │Gdns │  $42k - $68k
      │           ╰─────╯
$0    └───────────────────────────────────────
```

---

## 🔄 Reservation Flow Visualization

```
72-HOUR RESERVATION TIMER FLOW
════════════════════════════════════════════════

Step 1: RESERVATION CREATED
┌─────────────────────────────┐
│ Client reserves stand       │
│ ⏱️ Timer: 72:00:00          │
│ Status: PENDING             │
│ Timer Active: ✅            │
└─────────────────────────────┘
            │
            ↓
Step 2: PAYMENT PROOF UPLOADED (Optional)
┌─────────────────────────────┐
│ Client uploads POP          │
│ ⏸️ Timer: PAUSED             │
│ Status: PAYMENT_PENDING     │
│ Timer Active: ❌            │
└─────────────────────────────┘
            │
            ↓
Step 3: ADMIN VERIFICATION
┌─────────────────────────────┐
│ Admin verifies payment      │
│ Status: CONFIRMED           │
│ Ready for AOS               │
└─────────────────────────────┘
            │
            ↓
Step 4: AGREEMENT OF SALE
┌─────────────────────────────┐
│ AOS issued to client        │
│ Status: SOLD                │
│ Process complete ✅         │
└─────────────────────────────┘

EXPIRY SCENARIO:
┌─────────────────────────────┐
│ No payment within 72h       │
│ ⏰ Timer: 00:00:00          │
│ Status: EXPIRED             │
│ Stand → AVAILABLE           │
└─────────────────────────────┘
```

---

## 👥 User Role Access Matrix

```
Feature Access by Role
═══════════════════════════════════════════════

Feature              │ Admin │ Agent │ Client
────────────────────┼───────┼───────┼────────
View Developments   │   ✅  │   ✅  │   ✅
Browse Stands       │   ✅  │   ✅  │   ✅
Reserve Stand       │   ✅  │   ✅  │   ✅
Upload Payment      │   ✅  │   ✅  │   ✅
Verify Payment      │   ✅  │   ❌  │   ❌
Manage Users        │   ✅  │   ❌  │   ❌
View All Clients    │   ✅  │   ✅  │   ❌
Assign Agents       │   ✅  │   ❌  │   ❌
Issue AOS           │   ✅  │   ❌  │   ❌
View Audit Logs     │   ✅  │   ❌  │   ❌
System Settings     │   ✅  │   ❌  │   ❌
View Own Portfolio  │   ✅  │   ✅  │   ✅
View Commission     │   ✅  │   ✅  │   ❌
Branch Management   │   ✅  │   ❌  │   ❌
```

---

## 📱 Demo Mode UI States

```
DEMO MODE: ENABLED
════════════════════════════════════════════════
┌──────────────────────────────────────────────┐
│ 🎯 Demo Mode Active                         │
│ Using mock data: 4 developments, 195 stands │
│ [Disable Demo Mode] [×]                     │
└──────────────────────────────────────────────┘

DEMO MODE: DISABLED
════════════════════════════════════════════════
                                ┌──────────────┐
                                │ 📊 Enable    │
                                │ Demo Data    │
                                └──────────────┘
                                  (Bottom-right)
```

---

## 🎯 Testing Checklist

```
✅ Demo Data Testing Checklist
════════════════════════════════════════════════

Browser Demo Mode:
□ Click "Enable Demo Data" button
□ Verify purple banner appears
□ Check localStorage for 'demo_mode'
□ Browse developments (should see 4)
□ View stands (should see 195 total)
□ Disable and verify data clears

Database Seeding:
□ Run: npm run db:push
□ Run: npm run db:seed
□ Check database for users
□ Verify developments created
□ Confirm stands exist
□ Review reservations

User Flows:
□ Login as admin ([email protected])
□ Login as agent ([email protected])
□ Login as client ([email protected])
□ View dashboard for each role
□ Test reservation flow
□ Upload payment proof
□ Verify payment as admin

Timer System:
□ View reservation with 48h remaining
□ View urgent reservation (< 2h)
□ Test timer pause on POP upload
□ Test timer resume

Data Integrity:
□ All stands link to developments
□ All reservations link to users
□ Activity logs reference correct IDs
□ No orphaned records
```

---

## 🚀 Quick Start Visual Guide

```
STEP-BY-STEP SETUP
════════════════════════════════════════════════

METHOD 1: Browser Demo (Instant)
┌────────────────────────────────┐
│ 1. npm run dev                 │
│         ↓                      │
│ 2. Click "Enable Demo Data"   │
│         ↓                      │
│ 3. Page reloads with data     │
│         ↓                      │
│ 4. Start testing! ✅          │
└────────────────────────────────┘

METHOD 2: Database Seed
┌────────────────────────────────┐
│ 1. npm run db:push             │
│         ↓                      │
│ 2. npm run db:seed             │
│         ↓                      │
│ 3. Data in database ✅         │
│         ↓                      │
│ 4. npm run dev                 │
└────────────────────────────────┘
```

---

**This visual guide helps you understand the demo data structure at a glance!**
