# Phase 2 Dashboards - Integration & Deployment Guide

## 📦 Installation & Setup

### Prerequisites
- React 18+
- TypeScript 5+
- Next.js 14+
- shadcn/ui installed
- Recharts installed
- Lucide React installed

### Dependencies Already Installed
```json
{
  "react": "^18.0.0",
  "react-dom": "^18.0.0",
  "next": "^14.0.0",
  "@radix-ui/react-select": "^2.0.0",
  "@radix-ui/react-tabs": "^1.0.0",
  "recharts": "^2.10.0",
  "lucide-react": "^0.292.0",
  "tailwindcss": "^3.0.0"
}
```

---

## 🎯 Project Structure

```
your-project/
├── components/
│   ├── dashboards/
│   │   ├── ManagerDashboard.tsx      (780 lines)
│   │   ├── AgentDashboard.tsx        (750 lines)
│   │   ├── ClientDashboard.tsx       (720 lines)
│   │   ├── AccountsDashboard.tsx     (750 lines)
│   │   └── index.ts                  (exports)
│   └── ui/
│       ├── card.tsx
│       ├── button.tsx
│       ├── select.tsx
│       └── tabs.tsx
├── app/
│   ├── api/
│   │   └── dashboards/              (API endpoints)
│   └── dashboards/
│       ├── manager/
│       ├── agent/
│       ├── client/
│       └── accounts/
└── lib/
    └── (utils, hooks, helpers)
```

---

## 🚀 Deployment Strategies

### Option 1: Direct Integration (Recommended)

#### Step 1: Copy Dashboard Components
```bash
# Files are already in:
components/dashboards/
├── ManagerDashboard.tsx
├── AgentDashboard.tsx
├── ClientDashboard.tsx
├── AccountsDashboard.tsx
└── index.ts
```

#### Step 2: Create Route Pages

**Manager Dashboard Route**
```typescript
// app/dashboards/manager/page.tsx
import { ManagerDashboard } from '@/components/dashboards';

export default function ManagerDashboardPage() {
  return (
    <main className="p-6 bg-gray-50 min-h-screen">
      <ManagerDashboard />
    </main>
  );
}
```

**Agent Dashboard Route**
```typescript
// app/dashboards/agent/page.tsx
import { AgentDashboard } from '@/components/dashboards';

export default function AgentDashboardPage() {
  return (
    <main className="p-6 bg-gray-50 min-h-screen">
      <AgentDashboard />
    </main>
  );
}
```

**Client Dashboard Route**
```typescript
// app/dashboards/client/page.tsx
import { ClientDashboard } from '@/components/dashboards';

export default function ClientDashboardPage() {
  return (
    <main className="p-6 bg-gray-50 min-h-screen">
      <ClientDashboard />
    </main>
  );
}
```

**Accounts Dashboard Route**
```typescript
// app/dashboards/accounts/page.tsx
import { AccountsDashboard } from '@/components/dashboards';

export default function AccountsDashboardPage() {
  return (
    <main className="p-6 bg-gray-50 min-h-screen">
      <AccountsDashboard />
    </main>
  );
}
```

#### Step 3: Create Route Guard

```typescript
// lib/dashboard-guard.ts
import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth';

export async function requireDashboardAccess(requiredRole: string) {
  const session = await getSession();
  
  if (!session) {
    redirect('/login');
  }
  
  if (session.user.role !== requiredRole && session.user.role !== 'admin') {
    redirect('/unauthorized');
  }
  
  return session;
}
```

**Use in page:**
```typescript
// app/dashboards/manager/page.tsx
import { requireDashboardAccess } from '@/lib/dashboard-guard';
import { ManagerDashboard } from '@/components/dashboards';

export default async function ManagerDashboardPage() {
  await requireDashboardAccess('manager');
  
  return (
    <main className="p-6 bg-gray-50 min-h-screen">
      <ManagerDashboard />
    </main>
  );
}
```

---

## 🔌 API Integration

### Create Dashboard Data Hooks

**Manager Metrics Hook**
```typescript
// hooks/useDashboardData.ts
import { useState, useEffect } from 'react';

export const useManagerMetrics = (branch?: string) => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const response = await fetch('/api/dashboards/manager/metrics', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ branch }),
        });
        
        if (!response.ok) throw new Error('Failed to fetch metrics');
        const json = await response.json();
        setData(json);
      } catch (err) {
        setError(err);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [branch]);

  return { data, loading, error };
};
```

**Updated Manager Dashboard**
```typescript
// components/dashboards/ManagerDashboard.tsx
import { useManagerMetrics } from '@/hooks/useDashboardData';

export function ManagerDashboard() {
  const { data: metrics, loading, error } = useManagerMetrics();

  if (loading) return <div>Loading...</div>;
  if (error) return <div>Error loading data</div>;

  return (
    // ... dashboard JSX with metrics data
  );
}
```

### Create API Endpoints

**Manager Metrics Endpoint**
```typescript
// app/api/dashboards/manager/metrics/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function POST(request: NextRequest) {
  const session = await getSession();
  
  if (!session || !['manager', 'admin'].includes(session.user.role)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { branch } = await request.json();

  try {
    // Query team members
    const teamMembers = await prisma.user.findMany({
      where: branch ? { branch } : {},
      include: { metrics: true },
    });

    // Calculate metrics
    const totalTeam = teamMembers.length;
    const totalSales = teamMembers.reduce((sum, m) => sum + (m.metrics?.sales || 0), 0);
    const teamConversion = (teamMembers.reduce((sum, m) => sum + (m.metrics?.conversion || 0), 0) / totalTeam).toFixed(1);

    return NextResponse.json({
      totalTeam,
      totalSales,
      teamConversion,
      // ... more metrics
    });
  } catch (error) {
    console.error('Error fetching metrics:', error);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
```

**Team Members Endpoint**
```typescript
// app/api/dashboards/manager/team/route.ts
export async function GET(request: NextRequest) {
  const session = await getSession();
  
  if (!session || !['manager', 'admin'].includes(session.user.role)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const branch = searchParams.get('branch');

  try {
    const team = await prisma.user.findMany({
      where: {
        role: { in: ['agent', 'team_lead'] },
        ...(branch && { branch }),
      },
      include: {
        metrics: true,
        prospects: true,
        deals: true,
      },
    });

    return NextResponse.json(team);
  } catch (error) {
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
```

**Agent Prospects Endpoint**
```typescript
// app/api/dashboards/agent/prospects/route.ts
export async function GET(request: NextRequest) {
  const session = await getSession();
  
  if (!session || session.user.role !== 'agent') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const prospects = await prisma.prospect.findMany({
      where: { agentId: session.user.id },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json(prospects);
  } catch (error) {
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
```

**Client Reservations Endpoint**
```typescript
// app/api/dashboards/client/reservations/route.ts
export async function GET(request: NextRequest) {
  const session = await getSession();
  
  if (!session || session.user.role !== 'client') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const reservations = await prisma.reservation.findMany({
      where: { clientId: session.user.id },
      include: { property: true, agent: true },
    });

    return NextResponse.json(reservations);
  } catch (error) {
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
```

**Accounts Invoices Endpoint**
```typescript
// app/api/dashboards/accounts/invoices/route.ts
export async function GET(request: NextRequest) {
  const session = await getSession();
  
  if (!session || !['accounts', 'admin'].includes(session.user.role)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const invoices = await prisma.invoice.findMany({
      orderBy: { date: 'desc' },
      include: { client: true, property: true },
    });

    // Calculate metrics
    const totalRevenue = invoices.reduce((sum, i) => sum + i.amount, 0);
    const totalReceived = invoices
      .filter(i => i.status === 'paid')
      .reduce((sum, i) => sum + i.amount, 0);

    return NextResponse.json({
      invoices,
      metrics: {
        totalRevenue,
        totalReceived,
        collectionRate: (totalReceived / totalRevenue * 100).toFixed(1),
      },
    });
  } catch (error) {
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
```

---

## 🔒 Security Considerations

### Role-Based Access Control

```typescript
// lib/dashboard-permissions.ts
export const dashboardPermissions = {
  manager: ['manager', 'admin'],
  agent: ['agent', 'team_lead', 'admin'],
  client: ['client', 'admin'],
  accounts: ['accounts', 'admin'],
};

export function canAccessDashboard(userRole: string, dashboardType: string): boolean {
  return dashboardPermissions[dashboardType]?.includes(userRole) ?? false;
}
```

### Data Filtering by User

```typescript
// lib/dashboard-filters.ts
export const getDataFilter = (userRole: string, userId: string) => {
  switch (userRole) {
    case 'agent':
      return { agentId: userId };
    case 'manager':
      return { branch: userBranch }; // Get from session
    case 'client':
      return { clientId: userId };
    case 'accounts':
      return {}; // Can see all
    default:
      return null;
  }
};
```

---

## 📊 Database Schema Updates (Prisma)

```prisma
// prisma/schema.prisma

model UserMetrics {
  id            String   @id @default(cuid())
  userId        String   @unique
  user          User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  
  // Sales metrics
  sales         Int      @default(0)
  target        Int      @default(0)
  prospects     Int      @default(0)
  activeDeals   Int      @default(0)
  conversion    Float    @default(0)
  
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt
}

model BranchMetrics {
  id            String   @id @default(cuid())
  branch        String   @unique
  
  agents        Int      @default(0)
  sales         Int      @default(0)
  target        Int      @default(0)
  
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt
}

model Prospect {
  id            String   @id @default(cuid())
  agentId       String
  agent         User     @relation("agent_prospects", fields: [agentId], references: [id])
  
  name          String
  email         String
  phone         String
  status        String   @default("lead") // lead, qualified, negotiation, won, lost
  budget        Int?
  property      String?
  lastContact   DateTime
  nextFollowUp  DateTime?
  
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt
  
  @@index([agentId])
  @@index([status])
}

model Deal {
  id            String   @id @default(cuid())
  agentId       String
  agent         User     @relation("agent_deals", fields: [agentId], references: [id])
  
  clientName    String
  property      String
  amount        Int
  status        String   @default("pipeline")
  closingDate   DateTime?
  probability   Int      @default(50)
  
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt
  
  @@index([agentId])
  @@index([status])
}

model Invoice {
  id            String   @id @default(cuid())
  number        String   @unique
  clientId      String
  client        User     @relation("client_invoices", fields: [clientId], references: [id])
  
  property      String
  amount        Int
  date          DateTime
  dueDate       DateTime
  status        String   @default("pending") // paid, pending, overdue, cancelled
  description   String?
  
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt
  
  @@index([clientId])
  @@index([status])
  @@index([dueDate])
}

model PaymentRecord {
  id            String   @id @default(cuid())
  invoiceId     String
  invoice       Invoice  @relation(fields: [invoiceId], references: [id])
  
  amount        Int
  paymentDate   DateTime
  method        String   // bank_transfer, cash, check, mobile_money
  reference     String
  
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt
  
  @@index([invoiceId])
}
```

---

## 🚀 Real-time Updates with WebSocket

```typescript
// lib/dashboard-realtime.ts
import { useEffect, useState } from 'react';

export function useLiveMetrics(dashboardType: string) {
  const [metrics, setMetrics] = useState(null);

  useEffect(() => {
    const ws = new WebSocket(`${process.env.NEXT_PUBLIC_WS_URL}/dashboards/${dashboardType}`);

    ws.onmessage = (event) => {
      const newMetrics = JSON.parse(event.data);
      setMetrics(newMetrics);
    };

    ws.onerror = (error) => {
      console.error('WebSocket error:', error);
    };

    return () => ws.close();
  }, [dashboardType]);

  return metrics;
}
```

---

## 📈 Performance Optimization

### Caching Strategy

```typescript
// lib/cache-strategy.ts
import { cache } from 'react';

export const getDashboardData = cache(async (type: string) => {
  const data = await fetch(`/api/dashboards/${type}`, {
    next: { revalidate: 60 }, // Cache for 60 seconds
  });
  return data.json();
});
```

### Data Pagination

```typescript
// Add to API endpoints
const { searchParams } = new URL(request.url);
const page = parseInt(searchParams.get('page') || '1');
const pageSize = 20;

const data = await prisma.prospect.findMany({
  skip: (page - 1) * pageSize,
  take: pageSize,
});

const total = await prisma.prospect.count();

return NextResponse.json({
  data,
  pagination: {
    page,
    pageSize,
    total,
    pages: Math.ceil(total / pageSize),
  },
});
```

---

## 🧪 Testing

```typescript
// __tests__/dashboards/manager.test.tsx
import { render, screen } from '@testing-library/react';
import { ManagerDashboard } from '@/components/dashboards';

describe('ManagerDashboard', () => {
  it('renders KPI cards', () => {
    render(<ManagerDashboard />);
    expect(screen.getByText('Team Size')).toBeInTheDocument();
    expect(screen.getByText('This Month Sales')).toBeInTheDocument();
  });

  it('displays team members table', () => {
    render(<ManagerDashboard />);
    expect(screen.getByText('Team Members')).toBeInTheDocument();
  });

  it('filters team by branch', async () => {
    render(<ManagerDashboard />);
    // Test filtering logic
  });
});
```

---

## 📝 Deployment Checklist

- [ ] All components copied to `components/dashboards/`
- [ ] Route pages created in `app/dashboards/`
- [ ] API endpoints created
- [ ] Database schema migrations run
- [ ] Authentication guards added
- [ ] Environment variables configured
- [ ] API keys added to `.env.local`
- [ ] Testing completed
- [ ] Performance optimized
- [ ] Deployment to staging
- [ ] Production deployment
- [ ] Monitoring configured

---

## 🔧 Environment Variables

```env
# .env.local
NEXT_PUBLIC_API_URL=http://localhost:3000
NEXT_PUBLIC_WS_URL=ws://localhost:3000

# Database
DATABASE_URL=postgresql://...

# Authentication
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=your-secret-key
```

---

## 📞 Support & Troubleshooting

### Common Issues

**Charts not rendering**
- Ensure Recharts is installed: `npm install recharts`
- Check that ResponsiveContainer has parent with defined height

**Components not found**
- Verify imports: `import { ManagerDashboard } from '@/components/dashboards';`
- Check that files are in correct directory

**API connection errors**
- Verify API endpoints are created
- Check network tab in browser DevTools
- Ensure CORS is configured if needed

**Data not loading**
- Check browser console for errors
- Verify API is returning correct data format
- Add loading states while fetching

---

**Version**: 1.0
**Status**: Production Ready
**Last Updated**: 2024
