# Installment & Receipt System Implementation

## Overview

This document describes the complete installment payment and receipt generation system added to the Fine & Country Zimbabwe ERP.

## Features Added

### 1. Database Schema Updates

**Development Model** - Added installment configuration:
- `installmentPeriods` - Int array for allowed payment periods (default: [12, 24, 48] months)
- `depositPercentage` - Decimal for required deposit (default: 30%)

**New Models Created:**

#### InstallmentPlan
Tracks complete payment plans for clients:
- Links to Client, Development, Stand
- Stores total amount, deposit amount, period months
- Calculates monthly payment automatically
- Tracks paid amount, balance, and status
- Statuses: PENDING, ACTIVE, COMPLETED, DEFAULTED, CANCELLED

#### Installment
Individual monthly payment records:
- Links to InstallmentPlan
- Has installment number, amount, due date
- Tracks payment status (PENDING, PAID, OVERDUE, PARTIAL)
- Links to Payment and Receipt when paid

#### Receipt
Payment receipt records:
- Links to Client, Payment, InstallmentPlan, Installment
- Stores receipt number (auto-generated), amount, payment details
- Includes branch, issued by information
- Can store PDF URL

### 2. API Routes

#### Admin APIs

**`/api/admin/installments`**
- `GET` - List all installment plans with filters (branch, status, development, client)
- `POST` - Create new installment plan with auto-generated installment schedule

**`/api/admin/installments/[id]`**
- `GET` - Get single plan with full details
- `PATCH` - Process payments (PAY_DEPOSIT, PAY_INSTALLMENT, CANCEL)

**`/api/admin/receipts`**
- `GET` - List all receipts with filters
- `POST` - Create receipt manually

**`/api/admin/receipts/[id]`**
- `GET` - Get receipt details, supports `?format=pdf` for PDF download

#### Client APIs

**`/api/client/installments`**
- `GET` - List client's own installment plans

**`/api/client/receipts`**
- `GET` - List client's own receipts

#### Developer APIs

**`/api/developer/installments`**
- `GET` - List installment plans by development

**`/api/developer/receipts`**
- `GET` - List receipts by development

### 3. UI Components

#### InstallmentsModule (`components/InstallmentsModule.tsx`)
Full admin management interface:
- Dashboard with stats (total plans, active, collected, outstanding)
- Filterable table of all installment plans
- Create new plan modal with:
  - Development selection
  - Client search
  - Period selection (from development's allowed periods)
  - Auto-calculated deposit and monthly amounts
- View plan modal with:
  - Payment progress bar
  - Deposit status
  - Full installment schedule
  - Receipt history with download
- Process payment modal with:
  - Deposit or installment selection
  - Amount, method, reference fields

#### ReceiptsModule (`components/ReceiptsModule.tsx`)
Receipt viewing and download interface:
- Dashboard with receipt stats
- Searchable, filterable table
- Date range filtering
- View receipt details modal
- PDF download functionality

#### ClientInstallmentsView (`components/ClientInstallmentsView.tsx`)
Client-facing installment tracker:
- Summary cards (total owed, paid, balance)
- Expandable payment plan cards with:
  - Progress visualization
  - Next due date alerts
  - Full payment schedule
  - Receipt download

### 4. Navigation Updates

**Admin Sidebar** - Added:
- "Installment Plans" (CalendarDays icon)
- "Receipts" (Receipt icon)

**Client Dashboard** - Added:
- "Installments" tab in module navigation
- ClientInstallmentsView component integration

## PDF Receipt Generation

Receipts are generated using jsPDF with Fine & Country branding:
- Company header with logo placeholder
- Receipt number, date, and branch
- Client and property information
- Amount with words conversion
- Payment method and reference
- Signature lines for client and receiver

## Usage Flow

### Creating an Installment Plan (Admin)

1. Navigate to "Installment Plans" in admin sidebar
2. Click "New Plan" button
3. Select development (periods and deposit % come from development settings)
4. Search and select client
5. Choose payment period
6. Enter total amount
7. Review calculated deposit and monthly amounts
8. Click "Create Plan"

### Processing Payments (Admin)

1. Find plan in list or click to view details
2. Click "Record Payment" or credit card icon
3. Select payment type (Deposit or Installment)
4. Enter amount, method, and reference
5. Click "Process Payment"
6. Receipt is auto-generated

### Viewing Installments (Client)

1. Client logs in to portal
2. Navigates to "Installments" tab
3. Views all payment plans with progress
4. Expands plan to see schedule and receipts
5. Downloads receipts as needed

## Configuration

### Development Settings

When creating/editing developments, configure:
- `installmentPeriods`: Array of allowed month periods [12, 24, 48]
- `depositPercentage`: Required deposit percentage (0-100)

### API Environment

Ensure these environment variables are set:
- `DATABASE_URL` - Neon PostgreSQL connection
- `NEXTAUTH_SECRET` - For session authentication

## Database Sync

Run these commands after deployment:
```bash
npx prisma db push    # Sync schema to database
npx prisma generate   # Regenerate Prisma client
```

## Files Created/Modified

### New Files
- `app/api/admin/installments/route.ts`
- `app/api/admin/installments/[id]/route.ts`
- `app/api/admin/receipts/route.ts`
- `app/api/admin/receipts/[id]/route.ts`
- `app/api/client/installments/route.ts`
- `app/api/client/receipts/route.ts`
- `app/api/developer/installments/route.ts`
- `app/api/developer/receipts/route.ts`
- `components/InstallmentsModule.tsx`
- `components/ReceiptsModule.tsx`
- `components/ClientInstallmentsView.tsx`

### Modified Files
- `prisma/schema.prisma` - Added new models
- `prisma/prisma.config.ts` - Updated to use .env file
- `app/api/admin/developments/route.ts` - Added installment fields
- `App.tsx` - Added module imports and routing
- `components/Sidebar.tsx` - Added navigation items
- `components/ClientDashboard.tsx` - Added installments tab
