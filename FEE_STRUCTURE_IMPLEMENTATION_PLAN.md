# COMPREHENSIVE FEE STRUCTURE & COMMISSION SYSTEM - Implementation Plan

## 🎯 Executive Summary

**Objective**: Transform developments wizard into a transparent fee management system with accurate commission calculations, VAT tracking, Agreement of Sale fees, and comprehensive reporting across all stakeholders.

**Scope**: 5 major modules, 23 new API endpoints, 8 database schema updates, 12 frontend components

**Impact**: Customers, Agents, Managers, Developers, Admin

---

## 📊 PART 1: DATABASE SCHEMA CHANGES

### 1.1 Development Model Enhancements
```prisma
model Development {
  // ... existing fields
  
  // Fee Configuration
  vatRate              Decimal   @default(15.5) @db.Decimal(5, 2) // 15.5%
  vatApplicable        Boolean   @default(true)
  agreementOfSaleFee   Decimal?  @db.Decimal(12, 2) // Fixed amount or null
  agreementOfSaleFeeType String? // 'FIXED' | 'PERCENTAGE'
  agreementOfSaleFeePercent Decimal? @db.Decimal(5, 2)
  endowmentFee         Decimal?  @db.Decimal(12, 2) // Fixed amount or null
  endowmentFeeType     String?   // 'FIXED' | 'PERCENTAGE'
  endowmentFeePercent  Decimal?  @db.Decimal(5, 2)
  cessionFee           Decimal?  @db.Decimal(12, 2)
  cessionFeeType       String?   // 'FIXED' | 'PERCENTAGE'
  cessionFeePercent    Decimal?  @db.Decimal(5, 2)
  additionalFees       Json?     // [{name, amount, type, mandatory}]
  
  // Payment Terms
  paymentTermsMonths   Int       @default(12)
  minimumDeposit       Decimal   @default(30) @db.Decimal(5, 2) // 30% minimum
  
  // Commission Settings
  commissionType       String    @default('PERCENTAGE') // 'PERCENTAGE' | 'FIXED'
  commissionRate       Decimal   @default(5) @db.Decimal(5, 2) // 5%
  commissionFixedAmount Decimal? @db.Decimal(12, 2) // $1000
  
  @@map("developments")
}
```

### 1.2 Stand Model Enhancements
```prisma
model Stand {
  // ... existing fields
  
  // Per-Stand Fee Overrides (optional)
  customVatRate        Decimal?  @db.Decimal(5, 2)
  customAgreementOfSaleFee Decimal? @db.Decimal(12, 2)
  customEndowmentFee   Decimal?  @db.Decimal(12, 2)
  customCessionFee     Decimal?  @db.Decimal(12, 2)
  feeExemptions        Json?     // ['agreementOfSale', 'endowment', 'cession']
  
  @@map("stands")
}
```

### 1.3 New Model: StandFeeBreakdown
```prisma
model StandFeeBreakdown {
  id                String    @id @default(cuid())
  standId           String    @map("stand_id")
  stand             Stand     @relation(fields: [standId], references: [id])
  
  // Base Pricing
  standPrice        Decimal   @db.Decimal(12, 2)
  
  // Fee Breakdown
  vatAmount         Decimal   @db.Decimal(12, 2)
  vatRate           Decimal   @db.Decimal(5, 2)
  agreementOfSaleAmount Decimal @default(0) @db.Decimal(12, 2)
  endowmentAmount   Decimal   @default(0) @db.Decimal(12, 2)
  cessionAmount     Decimal   @default(0) @db.Decimal(12, 2)
  additionalFees    Json      // [{name, amount}]
  
  // Totals
  subtotal          Decimal   @db.Decimal(12, 2) // Before VAT
  totalAmount       Decimal   @db.Decimal(12, 2) // All inclusive
  
  // Payment Terms
  depositAmount     Decimal   @db.Decimal(12, 2)
  depositPercent    Decimal   @db.Decimal(5, 2)
  balanceAmount     Decimal   @db.Decimal(12, 2)
  installmentMonths Int
  monthlyInstallment Decimal  @db.Decimal(12, 2)
  
  createdAt         DateTime  @default(now()) @map("created_at")
  updatedAt         DateTime  @updatedAt @map("updated_at")
  
  @@index([standId])
  @@map("stand_fee_breakdowns")
}
```

### 1.4 Reservation Model Enhancements
```prisma
model Reservation {
  // ... existing fields
  
  // Fee Tracking
  feeBreakdownId    String?   @map("fee_breakdown_id")
  feeBreakdown      StandFeeBreakdown? @relation(fields: [feeBreakdownId], references: [id])
  
  // Captured at reservation time
  totalAmount       Decimal   @db.Decimal(12, 2)
  vatAmount         Decimal   @db.Decimal(12, 2)
  vatRate           Decimal   @db.Decimal(5, 2)
  depositPaid       Decimal   @db.Decimal(12, 2)
  balanceDue        Decimal   @db.Decimal(12, 2)
  
  @@map("reservations")
}
```

### 1.5 Payment Model Enhancements
```prisma
model Payment {
  // ... existing fields
  
  // Fee Allocation
  principalAmount   Decimal   @db.Decimal(12, 2) // Amount towards stand
  vatAmount         Decimal   @default(0) @db.Decimal(12, 2)
  agreementOfSaleAmount Decimal @default(0) @db.Decimal(12, 2)
  endowmentAmount   Decimal   @default(0) @db.Decimal(12, 2)
  cessionAmount     Decimal   @default(0) @db.Decimal(12, 2)
  additionalFees    Json?     // [{name, amount}]
  
  @@map("payments")
}
```

### 1.6 Receipt Model Enhancements
```prisma
model Receipt {
  // ... existing fields
  
  // Detailed Breakdown
  feeBreakdown      Json      // Full breakdown for display
  vatBreakdown      Json      // {rate, amount, description}
  
  @@map("receipts")
}
```

### 1.7 New Model: CommissionCalculation
```prisma
model CommissionCalculation {
  id                String    @id @default(cuid())
  
  // Agent Info
  agentId           String    @map("agent_id")
  agent             User      @relation(fields: [agentId], references: [id])
  
  // Deal Info
  reservationId     String?   @map("reservation_id")
  reservation       Reservation? @relation(fields: [reservationId], references: [id])
  dealId            String?   @map("deal_id")
  deal              Deal?     @relation(fields: [dealId], references: [id])
  
  // Commission Calculation
  standPrice        Decimal   @db.Decimal(12, 2)
  commissionType    String    // 'PERCENTAGE' | 'FIXED'
  commissionRate    Decimal?  @db.Decimal(5, 2)
  commissionFixed   Decimal?  @db.Decimal(12, 2)
  commissionAmount  Decimal   @db.Decimal(12, 2)
  
  // Status
  status            String    @default('PENDING') // PENDING, APPROVED, PAID
  approvedBy        String?   @map("approved_by")
  approvedAt        DateTime? @map("approved_at")
  paidAt            DateTime? @map("paid_at")
  
  // Metadata
  branch            String
  developmentId     String    @map("development_id")
  development       Development @relation(fields: [developmentId], references: [id])
  
  createdAt         DateTime  @default(now()) @map("created_at")
  updatedAt         DateTime  @updatedAt @map("updated_at")
  
  @@index([agentId])
  @@index([status])
  @@index([developmentId])
  @@index([branch])
  @@map("commission_calculations")
}
```

### 1.8 New Model: VATReport
```prisma
model VATReport {
  id                String    @id @default(cuid())
  
  // Period
  periodStart       DateTime  @map("period_start")
  periodEnd         DateTime  @map("period_end")
  
  // Per Development
  developmentId     String    @map("development_id")
  development       Development @relation(fields: [developmentId], references: [id])
  
  // VAT Summary
  totalSales        Decimal   @db.Decimal(12, 2)
  vatCollected      Decimal   @db.Decimal(12, 2)
  vatRate           Decimal   @db.Decimal(5, 2)
  transactionCount  Int
  
  // Details
  transactions      Json      // [{paymentId, amount, vat}]
  
  // Status
  status            String    @default('DRAFT') // DRAFT, FINALIZED
  finalizedBy       String?   @map("finalized_by")
  finalizedAt       DateTime? @map("finalized_at")
  
  createdAt         DateTime  @default(now()) @map("created_at")
  
  @@index([developmentId])
  @@index([periodStart, periodEnd])
  @@map("vat_reports")
}
```

---

## 🔧 PART 2: API ENDPOINTS (23 NEW)

### 2.1 Development Fee Configuration (ADMIN)

#### `POST /api/admin/developments/[id]/fees`
Configure fee structure for development
```typescript
{
  vatRate: 15.5,
  vatApplicable: true,
  agreementOfSaleFee: 250,
  agreementOfSaleFeeType: 'FIXED',
  endowmentFee: 500,
  endowmentFeeType: 'FIXED',
  cessionFee: 2,
  cessionFeeType: 'PERCENTAGE',
  additionalFees: [
    { name: 'Legal Fees', amount: 300, type: 'FIXED', mandatory: true }
  ],
  paymentTermsMonths: 12,
  minimumDeposit: 30
}
```

#### `GET /api/admin/developments/[id]/fees`
Retrieve current fee configuration

#### `PUT /api/admin/developments/[id]/fees`
Update fee configuration

#### `POST /api/admin/developments/[id]/commission-settings`
Configure commission structure
```typescript
{
  commissionType: 'PERCENTAGE', // or 'FIXED'
  commissionRate: 5,
  commissionFixedAmount: 1000
}
```

#### `GET /api/admin/developments/[id]/commission-settings`
Get commission configuration

### 2.2 Stand Fee Calculation (PUBLIC/AGENT/CLIENT)

#### `GET /api/stands/[id]/fee-breakdown`
Calculate complete fee breakdown for a stand
```typescript
Response:
{
  standPrice: 10000,
  vatAmount: 1627.5,
  vatRate: 15.5,
  agreementOfSaleAmount: 250,
  endowmentAmount: 500,
  cessionAmount: 200,
  additionalFees: [
    { name: 'Legal Fees', amount: 300 }
  ],
  subtotal: 10500,
  totalAmount: 12127.5,
  depositAmount: 3638.25,  // 30%
  depositPercent: 30,
  balanceAmount: 8489.25,
  installmentMonths: 12,
  monthlyInstallment: 707.44
}
```

#### `POST /api/stands/[id]/fee-breakdown/calculate`
Dynamic calculation with custom deposit
```typescript
Request:
{
  depositPercent: 40,
  installmentMonths: 24
}
```

#### `GET /api/developments/[id]/fee-summary`
Public endpoint for landing page display

### 2.3 Reservation with Fees (CLIENT/AGENT)

#### `POST /api/reservations/with-fees`
Create reservation with complete fee breakdown
```typescript
{
  standId: "stand_123",
  clientId: "client_456",
  depositPercent: 30,
  paymentTerms: 12,
  agentId: "agent_789" // Optional
}
```
Returns: Reservation + FeeBreakdown + CommissionCalculation

#### `GET /api/reservations/[id]/fees`
Get fee breakdown for existing reservation

### 2.4 Payment Allocation (CLIENT/AGENT/ADMIN)

#### `POST /api/payments/with-allocation`
Record payment with fee allocation
```typescript
{
  reservationId: "res_123",
  amount: 1000,
  allocation: {
    principal: 825,
    vat: 134.13,
    agreementOfSale: 20.62,
    endowment: 20.25
  }
}
```

#### `GET /api/payments/[id]/allocation`
Get allocation breakdown for payment

### 2.5 Commission Management (AGENT/MANAGER/ADMIN)

#### `GET /api/agent/commissions/expected`
Agent view of expected commissions
```typescript
Response:
{
  pending: [
    {
      reservationId: "res_123",
      standNumber: "A-101",
      standPrice: 10000,
      commissionAmount: 500,
      status: "PENDING",
      expectedDate: "2026-02-01"
    }
  ],
  totalExpected: 2500
}
```

#### `GET /api/manager/commissions/team`
Manager view of team commissions
```typescript
Response:
{
  teamMembers: [
    {
      agentId: "agent_123",
      agentName: "John Doe",
      pendingCommissions: 5000,
      approvedCommissions: 15000,
      paidCommissions: 10000,
      count: 10
    }
  ],
  totalPending: 20000,
  totalApproved: 50000
}
```

#### `POST /api/manager/commissions/[id]/approve`
Approve commission for payment

#### `GET /api/admin/commissions/report`
Admin view of all commissions with filters
```typescript
Query: ?branch=Harare&status=PENDING&period=2026-01
```

### 2.6 VAT Reporting (ADMIN/DEVELOPER)

#### `GET /api/admin/vat/reports`
List VAT reports by period/development

#### `POST /api/admin/vat/reports/generate`
Generate VAT report for period
```typescript
{
  developmentId: "dev_123",
  periodStart: "2026-01-01",
  periodEnd: "2026-01-31"
}
```

#### `GET /api/admin/vat/reports/[id]`
Get detailed VAT report
```typescript
Response:
{
  period: "January 2026",
  development: "Sunset Heights",
  totalSales: 150000,
  vatCollected: 23250,
  vatRate: 15.5,
  transactionCount: 15,
  transactions: [
    {
      paymentId: "pay_123",
      date: "2026-01-15",
      amount: 10000,
      vatAmount: 1550,
      clientName: "John Doe"
    }
  ]
}
```

#### `GET /api/developer/vat/summary`
Developer view of VAT collected (money owed to government)

### 2.7 Receipt Generation with Fees (ALL ROLES)

#### `GET /api/receipts/[id]/detailed`
Get receipt with complete fee breakdown
```typescript
Response:
{
  receiptNumber: "REC-2026-001",
  clientName: "John Doe",
  standNumber: "A-101",
  paymentAmount: 3638.25,
  breakdown: {
    principal: 3000,
    vat: 488.25,
    agreementOfSale: 75,
    endowment: 50,
    cession: 25
  },
  vatBreakdown: {
    rate: 15.5,
    baseAmount: 3150,
    vatAmount: 488.25,
    description: "VAT @ 15.5%"
  },
  balanceRemaining: 8489.25
}
```

### 2.8 Developer Dashboard (DEVELOPER)

#### `GET /api/developer/financials/summary`
Complete financial summary for developer
```typescript
Response:
{
  totalSales: 500000,
  vatCollected: 77500,  // Not developer's money
  commissionsOwed: 25000,
  netRevenue: 397500,   // After VAT & commissions
  developments: [
    {
      developmentId: "dev_123",
      name: "Sunset Heights",
      sales: 150000,
      vat: 23250,
      commissions: 7500,
      netRevenue: 119250
    }
  ]
}
```

#### `GET /api/developer/deductions/breakdown`
What's being deducted and why
```typescript
Response:
{
  period: "January 2026",
  vat: {
    amount: 23250,
    reason: "Government tax - to be remitted",
    rate: 15.5
  },
  commissions: {
    amount: 7500,
    breakdown: [
      { agent: "John Doe", amount: 2500, deals: 5 }
    ]
  },
  totalDeductions: 30750
}
```

---

## 🎨 PART 3: FRONTEND COMPONENTS (12 NEW)

### 3.1 Admin Components

#### `AdminDevelopmentFeeWizard.tsx`
Step-by-step configuration:
- Step 1: VAT settings
- Step 2: Agreement of Sale fee
- Step 3: Endowment fees
- Step 4: Cession fees
- Step 5: Additional fees (dynamic add/remove)
- Step 6: Payment terms
- Step 7: Commission settings
- Preview & Save

#### `AdminCommissionSettings.tsx`
Configure commission structure per development

#### `AdminVATReportGenerator.tsx`
Generate and view VAT reports

### 3.2 Public/Landing Page Components

#### `DevelopmentFeeDisplay.tsx`
Public display of all fees for development
```typescript
<FeeCard development={development}>
  <FeeItem label="Stand Price" value={10000} />
  <FeeItem label="Agreement of Sale Fee" value={250} info="One-time legal fee" />
  <FeeItem label="VAT (15.5%)" value={1587.5} highlighted />
  <FeeItem label="Endowment Fee" value={500} />
  <FeeItem label="Cession Fee" value={200} />
  <FeeDivider />
  <FeeTotal label="Total Cost" value={12537.5} />
  <PaymentTerms>
    Deposit: $3761.25 (30%) | Balance: $8776.25 over 12 months
  </PaymentTerms>
</FeeCard>
```

#### `StandFeeCalculator.tsx`
Interactive calculator for customers
```typescript
<Calculator stand={stand}>
  <DepositSlider min={30} max={100} />
  <MonthsSelector options={[6, 12, 24, 36]} />
  <LiveBreakdown>
    Deposit: $X | Monthly: $Y | Total: $Z
  </LiveBreakdown>
</Calculator>
```

### 3.3 Agent Components

#### `AgentCommissionDashboard.tsx`
View expected commissions
```typescript
<CommissionTable>
  <Column>Stand</Column>
  <Column>Client</Column>
  <Column>Sale Price</Column>
  <Column>Your Commission</Column>
  <Column>Status</Column>
  <Column>Expected Payment</Column>
</CommissionTable>
<Summary>
  Pending: $5000 | Approved: $10000 | Paid: $50000
</Summary>
```

#### `AgentReservationFormWithFees.tsx`
Enhanced reservation form showing all fees

### 3.4 Client Components

#### `ClientReservationSummary.tsx`
Complete breakdown on reservation
```typescript
<ReservationCard>
  <StandInfo />
  <FeeBreakdown>
    Stand Price: $10,000
    Agreement of Sale: $250
    VAT (15.5%): $1,587.50
    Endowment: $500
    Cession: $200
    ─────────────────
    Total: $12,537.50
  </FeeBreakdown>
  <PaymentSchedule>
    Deposit Today: $3,761.25
    Monthly x 12: $731.35
  </PaymentSchedule>
</ReservationCard>
```

#### `ClientPaymentHistory.tsx`
Show allocation of each payment

### 3.5 Manager Components

#### `ManagerCommissionApproval.tsx`
Review and approve commissions
```typescript
<ApprovalQueue>
  {pending.map(commission => (
    <CommissionCard>
      <Agent>{commission.agent}</Agent>
      <Deal>{commission.standNumber}</Deal>
      <Amount>{commission.amount}</Amount>
      <Actions>
        <ApproveButton />
        <RejectButton />
      </Actions>
    </CommissionCard>
  ))}
</ApprovalQueue>
```

#### `ManagerTeamCommissions.tsx`
Team commission overview

### 3.6 Developer Components

#### `DeveloperFinancialDashboard.tsx`
High-level financial overview
```typescript
<FinancialCards>
  <Card>
    <Title>Total Sales</Title>
    <Amount>$500,000</Amount>
  </Card>
  <Card alert>
    <Title>VAT Collected</Title>
    <Amount>$77,500</Amount>
    <Note>To be remitted to ZIMRA</Note>
  </Card>
  <Card>
    <Title>Commissions Owed</Title>
    <Amount>$25,000</Amount>
  </Card>
  <Card success>
    <Title>Net Revenue</Title>
    <Amount>$397,500</Amount>
  </Card>
</FinancialCards>
```

#### `DeveloperVATReport.tsx`
VAT tracking per development

#### `DeveloperDeductionsBreakdown.tsx`
What's being deducted and why

---

## 🧮 PART 4: BUSINESS LOGIC & CALCULATIONS

### 4.1 Fee Calculation Engine

```typescript
// lib/feeCalculator.ts

export class FeeCalculator {
  
  calculateStandFees(
    standPrice: number,
    development: Development,
    stand?: Stand
  ): StandFeeBreakdown {
    
    // Use stand-level overrides or development defaults
    const vatRate = stand?.customVatRate || development.vatRate;
    const agreementOfSaleFee = this.calculateAgreementOfSale(standPrice, development, stand);
    const endowmentFee = this.calculateEndowment(standPrice, development, stand);
    const cessionFee = this.calculateCession(standPrice, development, stand);
    const additionalFees = this.calculateAdditional(development);
    
    // Subtotal before VAT (all fees added to base price)
    const subtotal = standPrice + agreementOfSaleFee + endowmentFee + cessionFee + additionalFees.total;
    
    // VAT calculation on subtotal
    const vatAmount = (subtotal * vatRate) / 100;
    
    // Total amount including VAT
    const totalAmount = subtotal + vatAmount;
    
    return {
      standPrice,
      vatAmount,
      vatRate,
      agreementOfSaleAmount: agreementOfSaleFee,
      endowmentAmount: endowmentFee,
      cessionAmount: cessionFee,
      additionalFees: additionalFees.breakdown,
      subtotal,
      totalAmount
    };
  }
  
  calculateAgreementOfSale(
    standPrice: number,
    development: Development,
    stand?: Stand
  ): number {
    // Check for stand-level override first
    if (stand?.customAgreementOfSaleFee !== null && stand?.customAgreementOfSaleFee !== undefined) {
      return Number(stand.customAgreementOfSaleFee);
    }
    
    // Check if stand is exempt from this fee
    if (stand?.feeExemptions?.includes('agreementOfSale')) {
      return 0;
    }
    
    // Use development-level configuration
    if (!development.agreementOfSaleFee) return 0;
    
    if (development.agreementOfSaleFeeType === 'PERCENTAGE') {
      return (standPrice * Number(development.agreementOfSaleFeePercent || 0)) / 100;
    } else {
      return Number(development.agreementOfSaleFee);
    }
  }
  
  calculatePaymentTerms(
    totalAmount: number,
    depositPercent: number,
    months: number
  ): PaymentTerms {
    
    const depositAmount = (totalAmount * depositPercent) / 100;
    const balanceAmount = totalAmount - depositAmount;
    const monthlyInstallment = balanceAmount / months;
    
    return {
      depositAmount,
      depositPercent,
      balanceAmount,
      installmentMonths: months,
      monthlyInstallment
    };
  }
  
  calculateCommission(
    standPrice: number,
    development: Development
  ): number {
    
    if (development.commissionType === 'PERCENTAGE') {
      return (standPrice * Number(development.commissionRate)) / 100;
    } else {
      return Number(development.commissionFixedAmount || 0);
    }
  }
  
  allocatePayment(
    paymentAmount: number,
    reservation: Reservation
  ): PaymentAllocation {
    
    // Proportional allocation based on fee breakdown
    const breakdown = reservation.feeBreakdown;
    const totalDue = breakdown.totalAmount;
    
    const principalRatio = breakdown.standPrice / totalDue;
    const vatRatio = breakdown.vatAmount / totalDue;
    const agreementOfSaleRatio = breakdown.agreementOfSaleAmount / totalDue;
    const endowmentRatio = breakdown.endowmentAmount / totalDue;
    const cessionRatio = breakdown.cessionAmount / totalDue;
    
    return {
      principal: paymentAmount * principalRatio,
      vat: paymentAmount * vatRatio,
      agreementOfSale: paymentAmount * agreementOfSaleRatio,
      endowment: paymentAmount * endowmentRatio,
      cession: paymentAmount * cessionRatio
    };
  }
}
```

### 4.2 VAT Reporting Engine

```typescript
// lib/vatReporter.ts

export class VATReporter {
  
  async generateReport(
    developmentId: string,
    periodStart: Date,
    periodEnd: Date
  ): Promise<VATReport> {
    
    // Get all payments in period for development
    const payments = await prisma.payment.findMany({
      where: {
        reservation: {
          stand: { developmentId }
        },
        createdAt: {
          gte: periodStart,
          lte: periodEnd
        },
        status: 'CONFIRMED'
      },
      include: {
        reservation: {
          include: {
            stand: true,
            client: true
          }
        }
      }
    });
    
    // Aggregate VAT
    const vatCollected = payments.reduce(
      (sum, p) => sum + Number(p.vatAmount), 
      0
    );
    
    const totalSales = payments.reduce(
      (sum, p) => sum + Number(p.principalAmount), 
      0
    );
    
    return {
      developmentId,
      periodStart,
      periodEnd,
      totalSales,
      vatCollected,
      vatRate: 15.5,
      transactionCount: payments.length,
      transactions: payments.map(p => ({
        paymentId: p.id,
        date: p.createdAt,
        amount: p.principalAmount,
        vatAmount: p.vatAmount,
        clientName: p.clientName
      }))
    };
  }
}
```

### 4.3 Commission Calculator

```typescript
// lib/commissionCalculator.ts

export class CommissionCalculator {
  
  async createCommissionRecord(
    reservationId: string,
    agentId: string
  ): Promise<CommissionCalculation> {
    
    const reservation = await prisma.reservation.findUnique({
      where: { id: reservationId },
      include: {
        stand: {
          include: { development: true }
        },
        feeBreakdown: true
      }
    });
    
    const development = reservation.stand.development;
    const standPrice = Number(reservation.feeBreakdown.standPrice);
    
    let commissionAmount: number;
    
    if (development.commissionType === 'PERCENTAGE') {
      commissionAmount = (standPrice * Number(development.commissionRate)) / 100;
    } else {
      commissionAmount = Number(development.commissionFixedAmount);
    }
    
    return await prisma.commissionCalculation.create({
      data: {
        agentId,
        reservationId,
        standPrice,
        commissionType: development.commissionType,
        commissionRate: development.commissionRate,
        commissionFixed: development.commissionFixedAmount,
        commissionAmount,
        status: 'PENDING',
        branch: reservation.stand.branch,
        developmentId: development.id
      }
    });
  }
  
  async getAgentExpectedCommissions(agentId: string) {
    
    const pending = await prisma.commissionCalculation.findMany({
      where: {
        agentId,
        status: { in: ['PENDING', 'APPROVED'] }
      },
      include: {
        reservation: {
          include: { stand: true }
        }
      }
    });
    
    const totalExpected = pending.reduce(
      (sum, c) => sum + Number(c.commissionAmount),
      0
    );
    
    return { pending, totalExpected };
  }
}
```

---

## 📋 PART 5: IMPLEMENTATION PHASES

### Phase 1: Database & Backend (Week 1)
**Status**: 🔴 Not Started

#### Tasks:
1. ✅ Create migration for all schema changes (including Agreement of Sale fee fields)
2. ✅ Implement FeeCalculator service with Agreement of Sale calculations
3. ✅ Implement VATReporter service
4. ✅ Implement CommissionCalculator service
5. ✅ Create all Admin fee configuration endpoints
6. ✅ Create stand fee breakdown endpoints
7. ✅ Test calculations with unit tests (including Agreement of Sale scenarios)

**Deliverables**:
- Migration file with Agreement of Sale fee support
- 3 service classes
- 8 API endpoints
- 50+ unit tests

---

### Phase 2: Public-Facing Features (Week 2)
**Status**: 🔴 Not Started

#### Tasks:
1. ✅ Create `DevelopmentFeeDisplay` component with Agreement of Sale fee display
2. ✅ Create `StandFeeCalculator` component (includes Agreement of Sale in calculations)
3. ✅ Update landing page to show complete fee structure
4. ✅ Create public fee summary API
5. ✅ Add fee information to stand listings (including Agreement of Sale)
6. ✅ Test customer journey with all fees visible

**Deliverables**:
- 2 public components
- Updated landing page showing all fees
- 2 public API endpoints
- Customer-facing documentation

---

### Phase 3: Reservation & Payment Flow (Week 3)
**Status**: 🔴 Not Started

#### Tasks:
1. ✅ Update reservation creation with complete fee breakdown (including Agreement of Sale)
2. ✅ Create `ClientReservationSummary` component showing all fees
3. ✅ Implement payment allocation logic for all fee types
4. ✅ Update receipt generation with full breakdown
5. ✅ Create commission record on reservation
6. ✅ Test end-to-end reservation flow with all fees

**Deliverables**:
- Enhanced reservation API
- Updated payment API with Agreement of Sale allocation
- 2 client components
- Receipt template updates

---

### Phase 4: Agent & Manager Features (Week 4)
**Status**: 🔴 Not Started

#### Tasks:
1. ✅ Create `AgentCommissionDashboard`
2. ✅ Create agent expected commissions API
3. ✅ Create `ManagerCommissionApproval`
4. ✅ Create `ManagerTeamCommissions`
5. ✅ Implement approval workflow
6. ✅ Add commission notifications

**Deliverables**:
- 4 dashboard components
- 6 commission management APIs
- Approval workflow
- Email notifications

---

### Phase 5: Developer & Admin Reporting (Week 5)
**Status**: 🔴 Not Started

#### Tasks:
1. ✅ Create `DeveloperFinancialDashboard`
2. ✅ Create `DeveloperVATReport`
3. ✅ Create `DeveloperDeductionsBreakdown`
4. ✅ Implement VAT report generation
5. ✅ Create admin commission reports
6. ✅ Add export functionality (PDF/Excel)

**Deliverables**:
- 3 developer components
- VAT reporting system
- Commission reports
- Export functionality

---

### Phase 6: Testing & Validation (Week 6)
**Status**: 🔴 Not Started

#### Tasks:
1. ✅ Integration testing all flows
2. ✅ Validate all calculations (VAT, Agreement of Sale, commissions)
3. ✅ Test edge cases (zero fees, 100% deposit, fee exemptions)
4. ✅ Performance testing with large datasets
5. ✅ UAT with real users
6. ✅ Fix bugs and polish UI

**Deliverables**:
- Test coverage report (>80%)
- Performance benchmarks
- UAT feedback incorporated
- Production-ready code

---

## 🎯 PART 6: CRUD STATUS MATRIX

### 6.1 Development Fee Configuration

| Entity | Create | Read | Update | Delete | Notes |
|--------|--------|------|--------|--------|-------|
| **Development Fees** | ✅ Admin | ✅ All | ✅ Admin | ❌ No | Includes Agreement of Sale fee |
| **Commission Settings** | ✅ Admin | ✅ Admin/Dev | ✅ Admin | ❌ No | Version control |
| **VAT Reports** | ✅ Auto | ✅ Admin/Dev | ❌ No | ❌ No | Immutable once finalized |
| **Stand Fee Override** | ✅ Admin | ✅ All | ✅ Admin | ✅ Admin | Includes Agreement of Sale override |

### 6.2 Fee Breakdown & Calculations

| Entity | Create | Read | Update | Delete | Notes |
|--------|--------|------|--------|--------|-------|
| **Stand Fee Breakdown** | ✅ Auto | ✅ Public | ✅ Auto | ❌ No | Includes Agreement of Sale |
| **Payment Allocation** | ✅ Auto | ✅ All | ❌ No | ❌ No | Allocates Agreement of Sale fee |
| **Receipt Breakdown** | ✅ Auto | ✅ Client/Agent | ❌ No | ❌ No | Shows Agreement of Sale |

### 6.3 Commission Management

| Entity | Create | Read | Update | Delete | Notes |
|--------|--------|------|--------|--------|-------|
| **Commission Calculation** | ✅ Auto | ✅ Agent/Mgr | ✅ Manager | ❌ No | Created on reservation |
| **Commission Approval** | ❌ No | ✅ Manager | ✅ Manager | ❌ No | Status change only |
| **Commission Payment** | ✅ Admin | ✅ Agent/Mgr | ✅ Admin | ❌ No | Final step |

### 6.4 Reporting

| Entity | Create | Read | Update | Delete | Notes |
|--------|--------|------|--------|--------|-------|
| **VAT Report** | ✅ Admin | ✅ Admin/Dev | ✅ Admin | ❌ No | Draft until finalized |
| **Commission Report** | ✅ Auto | ✅ Manager | ❌ No | ❌ No | Real-time aggregation |
| **Financial Summary** | ✅ Auto | ✅ Developer | ❌ No | ❌ No | Live dashboard |

---

## 🔒 PART 7: SECURITY & VALIDATION

### 7.1 Role-Based Access Control

```typescript
// Fee Configuration
- Admin: Full CRUD on all fee settings (including Agreement of Sale)
- Developer: Read-only access to own developments
- Manager: Read-only for team reporting
- Agent: Read-only for commission calculations
- Client: Read-only for own reservations

// Commission Management
- Admin: Approve/reject/pay all commissions
- Manager: Approve/reject for branch
- Agent: Read-only expected commissions
- Client: No access

// VAT Reporting
- Admin: Full access
- Developer: Read-only for own developments
- Others: No access
```

### 7.2 Validation Rules

```typescript
// Fee Configuration
- VAT rate: 0-100% (default 15.5%)
- Agreement of Sale fee: >= 0
- Deposit: 10-100% (default 30%)
- Payment terms: 1-120 months
- Commission rate: 0-20%
- Fixed commission: >= 0

// Calculations
- All amounts: Positive numbers, 2 decimal places
- Percentages: 2 decimal places max
- Totals must balance (sum of parts = total)

// Business Rules
- Cannot delete fees after payments made
- Cannot change VAT after reservations
- Commission locked after approval
- VAT report immutable after finalization
- Agreement of Sale fee locked after first payment
```

### 7.3 Audit Trail

```typescript
// Log all changes to:
- Fee configuration changes (including Agreement of Sale)
- Commission approvals
- VAT report generation
- Payment allocations

// Activity types:
- FEE_CONFIG_UPDATED
- COMMISSION_APPROVED
- VAT_REPORT_GENERATED
- PAYMENT_ALLOCATED
```

---

## 📊 PART 8: SUCCESS METRICS

### 8.1 Technical Metrics
- ✅ All calculations accurate to 2 decimal places
- ✅ Fee breakdown API responds < 200ms
- ✅ Commission calculation correct 100% of time
- ✅ Zero manual VAT calculation needed
- ✅ Receipt generation includes all fees (VAT, Agreement of Sale, Endowment, Cession)

### 8.2 Business Metrics
- ✅ Customer transparency: All fees visible before reservation (including Agreement of Sale)
- ✅ Agent clarity: Expected commissions visible
- ✅ Manager efficiency: Approval workflow < 2 minutes
- ✅ Developer accuracy: VAT and fee tracking error-free
- ✅ Admin control: Fee configuration in < 5 minutes

### 8.3 User Satisfaction
- ✅ Customers understand total cost (including Agreement of Sale fee)
- ✅ Agents know earnings upfront
- ✅ Managers trust commission calculations
- ✅ Developers have accurate financial reporting
- ✅ Admin has full visibility

---

## 🚀 DEPLOYMENT PLAN

### Pre-Deployment
1. ✅ All tests passing (including Agreement of Sale fee scenarios)
2. ✅ UAT sign-off from all stakeholders
3. ✅ Data migration plan ready
4. ✅ Rollback plan documented
5. ✅ Training materials prepared

### Deployment Steps
1. ✅ Run database migration (add Agreement of Sale fee fields)
2. ✅ Configure fees for existing developments
3. ✅ Generate historical commission records
4. ✅ Deploy backend APIs
5. ✅ Deploy frontend components
6. ✅ Verify calculations on production
7. ✅ Enable public features

### Post-Deployment
1. ✅ Monitor error logs
2. ✅ Validate first 10 reservations manually
3. ✅ Check commission calculations
4. ✅ Generate test VAT report
5. ✅ User training sessions
6. ✅ Collect feedback

---

## 📝 PART 9: DOCUMENTATION REQUIREMENTS

### 9.1 User Documentation
- Customer Guide: Understanding fees (including Agreement of Sale) and payment terms
- Agent Guide: Commission structure and expectations
- Manager Guide: Approval workflows
- Developer Guide: Financial reporting
- Admin Guide: Fee configuration (including Agreement of Sale setup)

### 9.2 Technical Documentation
- API documentation (all 23 endpoints)
- Database schema documentation (including Agreement of Sale fields)
- Calculation formulas and examples
- Integration guide for frontend
- Testing strategy and test cases

### 9.3 Business Documentation
- Fee policy document (including Agreement of Sale policy)
- Commission policy
- VAT compliance guide
- Reporting schedule
- Change management process

---

## ✅ SUMMARY

**Total Scope**:
- 8 database model changes
- 2 new database models
- 23 new API endpoints
- 12 new frontend components
- 3 calculation engines
- 6 implementation phases
- 6-week timeline

**Fee Types Supported**:
1. ✅ **VAT** (15.5% mandatory on all sales)
2. ✅ **Agreement of Sale Fee** (fixed or percentage, configurable per development)
3. ✅ **Endowment Fees** (fixed or percentage, optional)
4. ✅ **Cession Fees** (fixed or percentage, optional)
5. ✅ **Additional Fees** (custom fees with dynamic add/remove)

**Key Benefits**:
1. **Customer Transparency**: All costs visible upfront (including Agreement of Sale)
2. **Agent Clarity**: Expected commissions calculated automatically
3. **Manager Control**: Approval workflow with full visibility
4. **Developer Accuracy**: VAT tracking separate from revenue, Agreement of Sale tracked
5. **Admin Power**: Complete fee configuration control

**Risk Mitigation**:
- Extensive testing (unit + integration + UAT)
- Phased rollout (backend → public → internal → reporting)
- Rollback plan at each phase
- Manual validation checkpoints
- User training before go-live

---

**Status**: 🟡 **READY FOR APPROVAL**

**Next Steps**:
1. Review and approve implementation plan
2. Allocate development resources
3. Begin Phase 1 (Database & Backend)
4. Set up weekly progress reviews

**Agreement of Sale Fee Added**: ✅ Fully integrated into all calculations, displays, receipts, and reporting

---
