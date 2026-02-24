# Component Integration Guide: Using Phase 1 APIs

## Overview

This guide shows which components need updates to use the new Phase 1 APIs instead of mock data.

**Good News**: Most components are already using `supabaseMock` functions, which now call the real APIs!

---

## Current Status

### ✅ Already Using supabaseMock (No changes needed)
- `AdminDevelopments.tsx` - Calls `supabaseMock.createDevelopment()`
- `CommissionTracker.tsx` - Calls `supabaseMock.getAgentCommissions()`
- Any component calling `supabaseMock.*` functions

### 📋 Components Ready for Phase 1 Integration

These components should now have access to Phase 1 data:

```typescript
// Available functions (all now call real APIs):
const clients = await supabaseMock.getClients('Harare');
const newClient = await supabaseMock.createClient(data);
const payments = await supabaseMock.getPayments();
const stands = await supabaseMock.getStands('Harare');
const activities = await supabaseMock.getActivityLog({
  branch: 'Harare',
  module: 'CLIENTS',
  days: 7
});
```

---

## Components That Should Use Phase 1 APIs

### 1. **AdminConsole.tsx** (if exists)
Admin dashboard showing all data from both branches

**What to integrate:**
- Clients list from `getClients()`
- Payments from `getPayments()`
- Stands from `getStands()`
- Activity log from `getActivityLog()`

**Example:**
```typescript
import { supabaseMock } from '@/services/supabase';

export function AdminConsole() {
  const [clients, setClients] = useState<Client[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [stands, setStands] = useState<Stand[]>([]);
  const [activities, setActivities] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        // Fetch cross-branch data (no branch filter = all)
        const [c, p, s, a] = await Promise.all([
          supabaseMock.getClients(),
          supabaseMock.getPayments(),
          supabaseMock.getStands(),
          supabaseMock.getActivityLog({ days: 7, limit: 100 })
        ]);
        setClients(c);
        setPayments(p);
        setStands(s);
        setActivities(a);
      } catch (error) {
        console.error('Failed to load data:', error);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  if (loading) return <div>Loading...</div>;

  return (
    <div className="admin-console">
      <h1>Admin Dashboard</h1>
      <section>
        <h2>Clients ({clients.length})</h2>
        <table>
          <thead>
            <tr>
              <th>Name</th>
              <th>Email</th>
              <th>Branch</th>
            </tr>
          </thead>
          <tbody>
            {clients.map(c => (
              <tr key={c.id}>
                <td>{c.name}</td>
                <td>{c.email}</td>
                <td>{c.branch}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
      
      <section>
        <h2>Activity Log</h2>
        <ul>
          {activities.map(a => (
            <li key={a.id}>
              {a.branch} - {a.action} {a.module} ({new Date(a.createdAt).toLocaleString()})
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
```

### 2. **AgentDashboard.tsx**
Show branch-specific data for agents

**What to integrate:**
- Clients for current branch
- Owned stands/reservations
- Recent activity in branch

**Example:**
```typescript
export function AgentDashboard() {
  const [userBranch] = useState('Harare'); // Would come from auth
  const [clients, setClients] = useState<Client[]>([]);
  const [recentActivity, setRecentActivity] = useState([]);

  useEffect(() => {
    const load = async () => {
      // Show only this branch's data
      const [c, a] = await Promise.all([
        supabaseMock.getClients(userBranch),
        supabaseMock.getActivityLog({
          branch: userBranch,
          days: 3
        })
      ]);
      setClients(c);
      setRecentActivity(a);
    };
    load();
  }, [userBranch]);

  return (
    <div className="agent-dashboard">
      <h1>My Branch: {userBranch}</h1>
      <h2>My Clients ({clients.length})</h2>
      {/* Render clients */}
      
      <h2>Recent Activity</h2>
      {/* Render activity */}
    </div>
  );
}
```

### 3. **Inventory.tsx**
Show available stands by project and branch

**What to integrate:**
- Stands from `getStands()`
- Filter by branch and project
- Show availability status

**Example:**
```typescript
export function Inventory({ projectId }: { projectId: string }) {
  const [userBranch] = useState('Harare');
  const [stands, setStands] = useState<Stand[]>([]);

  useEffect(() => {
    const load = async () => {
      const data = await supabaseMock.getStands(userBranch);
      // Filter by project
      const filtered = data.filter(s => s.project === projectId);
      setStands(filtered);
    };
    load();
  }, [projectId, userBranch]);

  return (
    <div>
      <h2>Available Stands - {projectId}</h2>
      {stands.map(stand => (
        <div key={stand.id} className={`stand stand-${stand.status}`}>
          <h3>Stand {stand.number}</h3>
          <p>Status: {stand.status}</p>
          <p>Area: {stand.area} sqm</p>
          <p>Price: ${stand.price}</p>
        </div>
      ))}
    </div>
  );
}
```

### 4. **ClientPortfolio.tsx** (or similar)
Show client's owned stands and reservations

**What to integrate:**
- Client details
- Client's stands from `getStandsByClient()`
- Client's payments from `getPayments(clientId)`

**Example:**
```typescript
export function ClientPortfolio({ clientId }: { clientId: string }) {
  const [client, setClient] = useState<Client | null>(null);
  const [stands, setStands] = useState<Stand[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);

  useEffect(() => {
    const load = async () => {
      // This would be implemented in supabaseMock if not already
      const s = await supabaseMock.getStandsByClient(clientId);
      const p = await supabaseMock.getPayments(clientId);
      setStands(s);
      setPayments(p);
    };
    load();
  }, [clientId]);

  return (
    <div className="portfolio">
      <h1>My Portfolio</h1>
      <section>
        <h2>Owned Stands ({stands.length})</h2>
        {stands.map(s => (
          <div key={s.id}>
            <h3>{s.number} - {s.project}</h3>
            <p>Status: {s.status}</p>
            <p>Price: ${s.price}</p>
          </div>
        ))}
      </section>
      
      <section>
        <h2>Payments ({payments.length})</h2>
        {payments.map(p => (
          <div key={p.id}>
            <p>{p.clientName} - ${p.amount} ({p.status})</p>
            <p>Ref: {p.reference}</p>
          </div>
        ))}
      </section>
    </div>
  );
}
```

### 5. **SystemDiagnostics.tsx** (or Health/Forensic component)
Show unified activity log for forensic audit

**What to integrate:**
- Cross-branch activity log
- Filter by module
- Show before/after changes

**Example:**
```typescript
export function SystemDiagnostics() {
  const [activities, setActivities] = useState([]);
  const [filterModule, setFilterModule] = useState('ALL');

  useEffect(() => {
    const load = async () => {
      const data = await supabaseMock.getActivityLog({
        module: filterModule === 'ALL' ? undefined : filterModule,
        days: 30,
        limit: 200
      });
      setActivities(data);
    };
    load();
  }, [filterModule]);

  return (
    <div className="diagnostics">
      <h1>System Diagnostics - Forensic Trail</h1>
      
      <div>
        <label>Filter by Module:</label>
        <select value={filterModule} onChange={e => setFilterModule(e.target.value)}>
          <option value="ALL">All</option>
          <option value="CLIENTS">Clients</option>
          <option value="PAYMENTS">Payments</option>
          <option value="STANDS">Stands</option>
          <option value="DEVELOPMENTS">Developments</option>
        </select>
      </div>

      <h2>Activities ({activities.length})</h2>
      {activities.map(a => (
        <div key={a.id} className="activity-log">
          <div className="metadata">
            <span className="branch">{a.branch}</span>
            <span className="action">{a.action}</span>
            <span className="module">{a.module}</span>
            <span className="time">{new Date(a.createdAt).toLocaleString()}</span>
          </div>
          <div className="description">{a.description}</div>
          {a.changes && (
            <details>
              <summary>View Changes</summary>
              <pre>{JSON.stringify(JSON.parse(a.changes), null, 2)}</pre>
            </details>
          )}
        </div>
      ))}
    </div>
  );
}
```

### 6. **ClientDashboard.tsx**
Client-facing portal showing their data

**What to integrate:**
- Client's own data
- Their stands/reservations
- Their payments
- Their recent activity

**Example:**
```typescript
export function ClientDashboard() {
  const userId = getUserId(); // From auth
  const [clientData, setClientData] = useState<Client | null>(null);
  const [myStands, setMyStands] = useState<Stand[]>([]);
  const [myPayments, setMyPayments] = useState<Payment[]>([]);

  useEffect(() => {
    const load = async () => {
      // Fetch client's data
      const clients = await supabaseMock.getClients();
      const me = clients.find(c => c.id === userId);
      
      if (me) {
        setClientData(me);
        const stands = await supabaseMock.getStandsByClient(me.id);
        const payments = await supabaseMock.getPayments(me.id);
        setMyStands(stands);
        setMyPayments(payments);
      }
    };
    load();
  }, [userId]);

  if (!clientData) return <div>Loading...</div>;

  return (
    <div className="client-dashboard">
      <h1>Welcome, {clientData.name}</h1>
      
      <section className="portfolio">
        <h2>My Reservations & Purchases</h2>
        {myStands.map(s => (
          <div key={s.id} className={`stand ${s.status}`}>
            <h3>{s.project} - Stand {s.number}</h3>
            <p>Status: {s.status}</p>
            <p>Price: ${s.price}</p>
          </div>
        ))}
      </section>

      <section className="payments">
        <h2>My Payment History</h2>
        {myPayments.map(p => (
          <div key={p.id}>
            <p>${p.amount} - {p.status}</p>
            <p>Reference: {p.reference}</p>
            <p>Date: {new Date(p.createdAt).toLocaleDateString()}</p>
          </div>
        ))}
      </section>
    </div>
  );
}
```

---

## Migration Checklist

For each component:

- [ ] Import supabaseMock from '@/services/supabase'
- [ ] Replace mock data initialization with `useState`
- [ ] Add `useEffect` to load data from supabaseMock
- [ ] Pass branch parameter if needed
- [ ] Add error handling and loading states
- [ ] Test with real data from Neon
- [ ] Verify cross-branch data loads correctly
- [ ] Check build still passes: `npm run build`
- [ ] Test in browser

---

## Testing Components

After updating each component:

```bash
# Build to check for TypeScript errors
npm run build

# Start dev server
npm run dev

# Open http://localhost:3000 and test the component
```

### What to Look For:
- ✅ Data loads from Neon (not empty)
- ✅ Branch filtering works correctly
- ✅ Activity logs appear
- ✅ Cross-branch visibility works
- ✅ No TypeScript errors in console
- ✅ No network errors in browser console

---

## Common Issues & Solutions

### Issue: Component Shows Empty Data
**Solution:**
1. Check DATABASE_URL is set in `.env`
2. Verify tables were created in Neon
3. Look at browser console for network errors
4. Check server logs: `npm run dev`

### Issue: TypeScript Errors
**Solution:**
1. Import Client, Payment, Stand types from '@/types'
2. Add proper type annotations: `useState<Client[]>([])`
3. Run `npx tsc --noEmit` to check all errors

### Issue: Auth/401 Errors
**Solution:**
1. Check NODE_ENV is 'development' for localhost bypass
2. Dev server auto-auth should work on localhost
3. If in production, check Neon Auth token

---

## Summary

**Phase 1 API Integration Path:**

```
Components using MOCK_* data
         ↓
Not found! Already using supabaseMock (Good!)
         ↓
supabaseMock functions
         ↓
API endpoints (/api/admin/*)
         ↓
Neon PostgreSQL
```

**Your Next Steps:**

1. ✅ Database migration (create tables in Neon)
2. ✅ Test APIs manually (curl examples)
3. ✅ Update components to use supabaseMock (ready to use!)
4. ⏳ Verify cross-branch functionality
5. ⏳ Start Phase 2 modules

Components can start using Phase 1 data immediately!

