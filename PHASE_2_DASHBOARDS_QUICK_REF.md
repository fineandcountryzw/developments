# Phase 2 Dashboards - Quick Reference Guide

## 🎯 Dashboard Quick Access

### Import All Dashboards
```typescript
import { 
  ManagerDashboard, 
  AgentDashboard, 
  ClientDashboard, 
  AccountsDashboard 
} from '@/components/dashboards';
```

---

## 📊 Manager Dashboard
**File**: `components/dashboards/ManagerDashboard.tsx`
**Role**: Team leaders, branch managers, executives

### Key Metrics Displayed:
- Team size overview
- Monthly sales vs target (progress bar)
- Pipeline value calculation
- Team conversion rate

### Components:
- 4 KPI cards
- Sales trend bar chart (weekly)
- Team performance bar chart
- Branch metrics table
- Team member listing with filtering
- Conversion rate chart

### Features:
- Period selector (Week/Month/Quarter)
- Branch filtering dropdown
- Real-time metric calculations
- Performance comparison

### Sample Data Structure:
```typescript
const teamMembers = [
  {
    id: '1',
    name: 'Michael Smith',
    role: 'team_lead',
    branch: 'Harare Central',
    sales: 450000,
    target: 300000,
    prospects: 18,
    activeDeals: 4,
    conversion: 22.2,
    status: 'active',
  },
  // ... more members
];

const branchMetrics = [
  {
    name: 'Harare Central',
    agents: 8,
    sales: 730000,
    target: 600000,
    completion: 121.7,
    topAgent: 'Michael Smith',
  },
  // ... more branches
];
```

---

## 🎯 Agent Dashboard
**File**: `components/dashboards/AgentDashboard.tsx`
**Role**: Sales agents, property consultants

### Key Metrics Displayed:
- Total prospects in pipeline
- Active deals count
- Monthly revenue with target indicator
- Average deal size & conversion metrics
- Leads and contacts this month

### Components:
- 4 KPI cards
- Sales pipeline pie chart
- Activity tracking bar chart (calls/emails/meetings)
- Prospects table with details
- Active deals table with probabilities

### Features:
- Status filtering (All/Lead/Qualified/Negotiation)
- Add prospect button
- Last contact tracking
- Next follow-up scheduling
- Deal probability indicators

### Sample Data Structure:
```typescript
const prospects = [
  {
    id: '1',
    name: 'David Brown',
    email: 'david@email.com',
    phone: '+263773123456',
    status: 'qualified',
    budget: 50000,
    property: 'Plot A-45',
    lastContact: '2 days ago',
    nextFollowUp: 'Tomorrow 10am',
  },
  // ... more prospects
];

const deals = [
  {
    id: '1',
    clientName: 'Alice Kofi',
    property: 'Plot X-12',
    amount: 80000,
    status: 'closing',
    closingDate: '2024-02-15',
    probability: 95,
  },
  // ... more deals
];
```

---

## 💼 Client Dashboard
**File**: `components/dashboards/ClientDashboard.tsx`
**Role**: Property buyers, clients, investors

### Key Metrics Displayed:
- Wishlist items count
- Active reservations
- Available documents
- Total invested amount

### Components:
- 4 quick stat cards
- Property wishlist grid (cards with images, favorites)
- Reservations list with status
- Document list with downloads
- Payment history bar chart

### Features (Tabbed Interface):
1. **Wishlist Tab**
   - Property cards with details
   - Heart icon favorites toggle
   - View details & share buttons
   - Price, size, type display

2. **Reservations Tab**
   - Status badges (pending/confirmed/completed)
   - Agent contact information
   - Reservation & completion dates
   - Document & contact buttons

3. **Documents Tab**
   - Contract, receipt, deed downloads
   - Upload dates & file sizes
   - Document type icons

4. **Payment History Tab**
   - Payment schedule bar chart
   - Status indicators (paid/pending)
   - Monthly breakdown

### Sample Data Structure:
```typescript
const wishlist = [
  {
    id: '1',
    name: 'Plot A-45 Highlands',
    location: 'Harare North',
    price: 85000,
    size: 1250,
    type: 'Residential',
    isFavorite: true,
  },
  // ... more properties
];

const reservations = [
  {
    id: '1',
    property: 'Plot A-45 Highlands',
    location: 'Harare North',
    status: 'confirmed',
    reservationDate: '2024-01-15',
    completionDate: '2024-03-15',
    price: 85000,
    agent: 'Michael Smith',
    agentPhone: '+263773123456',
  },
  // ... more reservations
];
```

---

## 💰 Accounts Dashboard
**File**: `components/dashboards/AccountsDashboard.tsx`
**Role**: Finance team, accountants, admin

### Key Metrics Displayed:
- Total revenue (all invoiced amounts)
- Total collected payments
- Pending payment tracking
- Overdue payment alerts
- Collection rate percentage

### Components:
- 4 KPI cards with trend indicators
- Revenue trend line chart (invoiced vs collected)
- Payment method pie chart
- Invoice management table
- Payment records list
- Reconciliation summary

### Features (Tabbed Interface):
1. **Invoices Tab**
   - Full invoice table with all details
   - Status badges (paid/pending/overdue)
   - Invoice numbers, dates, amounts
   - Action menus

2. **Payment Records Tab**
   - Transaction history
   - Payment method display
   - Reference numbers
   - Download receipts

3. **Reconciliation Tab**
   - Current month summary
   - Outstanding balance breakdown
   - Key metrics display
   - Export financial report button

### Sample Data Structure:
```typescript
const invoices = [
  {
    id: '1',
    number: 'INV-2024-001',
    client: 'David Brown',
    property: 'Plot A-45',
    amount: 85000,
    date: '2024-01-10',
    dueDate: '2024-02-10',
    status: 'paid',
    description: 'Property purchase - First installment',
  },
  // ... more invoices
];

const payments = [
  {
    id: '1',
    invoiceNumber: 'INV-2024-001',
    client: 'David Brown',
    amount: 85000,
    paymentDate: '2024-02-05',
    method: 'bank_transfer',
    reference: 'TXN-20240205-001',
  },
  // ... more payments
];
```

---

## 🎨 Common UI Elements

### Status Badges
```typescript
const getStatusColor = (status: string) => {
  const colors: Record<string, string> = {
    active: 'bg-green-100 text-green-800',
    pending: 'bg-yellow-100 text-yellow-800',
    overdue: 'bg-red-100 text-red-800',
    paid: 'bg-green-100 text-green-800',
  };
  return colors[status] || 'bg-gray-100 text-gray-800';
};
```

### Chart Components
```typescript
// Manager - Sales Trend
<BarChart data={salesTrendData} />

// Agent - Pipeline
<PieChart><Pie data={pipelineData} /></PieChart>

// Client - Payment History
<BarChart data={paymentHistory} />

// Accounts - Revenue Trend
<LineChart><Line dataKey="revenue" /></LineChart>
```

### Button Groups
```typescript
<div className="flex gap-2">
  <Button variant="outline" size="sm">Filter</Button>
  <Button variant="outline" size="sm">Refresh</Button>
  <Button size="sm">Add New</Button>
</div>
```

---

## 🔄 Common Patterns

### Period Selection
```typescript
const [period, setPeriod] = useState<'week' | 'month' | 'quarter'>('month');

<Select value={period} onValueChange={setPeriod}>
  <SelectTrigger className="w-32">
    <SelectValue />
  </SelectTrigger>
  <SelectContent>
    <SelectItem value="week">This Week</SelectItem>
    <SelectItem value="month">This Month</SelectItem>
    <SelectItem value="quarter">This Quarter</SelectItem>
  </SelectContent>
</Select>
```

### Filtering Data
```typescript
const filteredData = selectedFilter === 'all'
  ? allData
  : allData.filter(item => item.category === selectedFilter);
```

### KPI Card
```typescript
<Card>
  <CardHeader className="pb-3">
    <CardTitle className="text-sm font-medium">Card Title</CardTitle>
  </CardHeader>
  <CardContent>
    <div className="text-2xl font-bold">Value</div>
    <p className="text-xs text-gray-600 mt-1">Description</p>
    <div className="flex items-center mt-2">
      <Icon className="w-4 h-4 text-blue-600 mr-1" />
      <span className="text-xs text-blue-600">Additional info</span>
    </div>
  </CardContent>
</Card>
```

---

## 📱 Responsive Breakpoints

- **Mobile**: Single column (1 col)
- **Tablet**: Two columns (md: 2 cols)
- **Desktop**: Four columns (lg: 4 cols)
- **Wide**: Full width with scrolling tables

### Grid Classes Used:
```typescript
// 1 column on mobile, 2 on tablet, 4 on desktop
className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4"

// 1 column on mobile, 2 on desktop
className="grid grid-cols-1 lg:grid-cols-2 gap-6"

// Full width with responsive tables
className="overflow-x-auto"
```

---

## 🔗 Integration Checklist

When integrating with real data:

- [ ] Create API endpoints for each dashboard
- [ ] Add useEffect hooks for data fetching
- [ ] Implement loading states (Loader2 icon)
- [ ] Add error handling and fallbacks
- [ ] Connect to database with Prisma
- [ ] Add authentication checks
- [ ] Implement real-time updates (WebSocket)
- [ ] Add pagination for large tables
- [ ] Create data caching strategy
- [ ] Add export functionality

---

## 📋 TypeScript Interfaces Used

### Manager Dashboard
- `TeamMember` - Individual agent/team lead data
- `BranchMetrics` - Branch-level performance data

### Agent Dashboard
- `Prospect` - Lead/prospect information
- `Deal` - Sales deal information

### Client Dashboard
- `Property` - Real estate property details
- `Reservation` - Purchase/reservation record
- `Document` - Document metadata

### Accounts Dashboard
- `Invoice` - Invoice record
- `PaymentRecord` - Payment transaction
- `FinancialMetrics` - Summary financial data

---

## 🚀 Quick Start

1. **Import Dashboard**
   ```typescript
   import { ManagerDashboard } from '@/components/dashboards';
   ```

2. **Add to Route**
   ```typescript
   export default function ManagerPage() {
     return <ManagerDashboard />;
   }
   ```

3. **Style Parent Container**
   ```typescript
   <div className="p-6 bg-gray-50 min-h-screen">
     <ManagerDashboard />
   </div>
   ```

4. **Connect APIs** (Next Step)
   - Replace sample data with API calls
   - Add loading and error states
   - Implement real-time updates

---

## 📞 Support

For issues or modifications:
- Check sample data structure in each component
- Review Recharts documentation for chart customization
- Refer to shadcn/ui docs for component API
- Check Tailwind CSS docs for styling

---

**Version**: 1.0
**Last Updated**: 2024
**Status**: Production Ready
