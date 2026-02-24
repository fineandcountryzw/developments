# 🎯 Demo Data Quick Reference

## 🚀 Two Ways to Add Demo Data

### Option 1: Browser Demo Mode (Recommended for Quick Testing)
**No database required!**

1. Start your app: `npm run dev`
2. Look for the purple "Enable Demo Data" button in the bottom-right corner
3. Click it to activate demo mode
4. Page will reload with demo data

✅ **Pros**: Instant, no setup, perfect for UI testing  
❌ **Cons**: Data stored in browser only, resets on clear cache

---

### Option 2: Database Seeding (For Full Testing)
**Persists data in your PostgreSQL database**

```bash
# Step 1: Ensure DATABASE_URL is set in .env
DATABASE_URL="postgresql://user:pass@host/db?sslmode=require"

# Step 2: Push schema to database
npm run db:push

# Step 3: Seed demo data
npm run db:seed

# Optional: Reset database and reseed
npm run db:reset
```

✅ **Pros**: Real database, persists across sessions, full API testing  
❌ **Cons**: Requires database setup

---

## 📊 What You Get

### Users (6 total)
| Role | Name | Email | Phone |
|------|------|-------|-------|
| **Admin** | Admin User | [email protected] | +263 242 123 456 |
| **Agent** | John Moyo | [email protected] | +263 77 123 4567 |
| **Agent** | Sarah Ncube | [email protected] | +263 77 234 5678 |
| **Client** | Michael Chikwanha | [email protected] | +263 77 345 6789 |
| **Client** | Grace Mutasa | [email protected] | +263 77 456 7890 |
| **Client** | David Sibanda | [email protected] | +263 77 567 8901 |

### Developments (4 projects)
1. **Borrowdale Brooke Estate** - Harare premium (45 stands, $85k base)
2. **Victoria Falls View** - Exclusive tourist area (60 stands, $125k base)
3. **Bulawayo Heights** - Modern suburb (38 stands, $55k base)
4. **Greendale Gardens** - Affordable housing (52 stands, $42k base)

### Stands (195 total)
- **Available**: ~140 stands ready for reservation
- **Reserved**: ~20 stands with active timers
- **Sold**: ~35 stands completed

### Reservations (4 active)
- 1x PENDING (48h remaining)
- 1x PAYMENT_PENDING (timer stopped, proof uploaded)
- 1x CONFIRMED (payment verified)
- 1x PENDING (2h remaining - about to expire!)

---

## 🎨 Using Demo Data in Code

### Import demo data utilities

```typescript
import { 
  isDemoMode,
  initDemoData,
  clearDemoData,
  getAllDemoData,
  getDemoDevelopmentById,
  getDemoStandsByDevelopment
} from './lib/demo-data';
```

### Check if demo mode is active

```typescript
if (isDemoMode()) {
  // Use demo data
  const data = getAllDemoData();
  setDevelopments(data.developments);
} else {
  // Fetch from API/database
  const response = await fetch('/api/developments');
  setDevelopments(await response.json());
}
```

### Example: Load developments

```typescript
useEffect(() => {
  async function loadDevelopments() {
    if (isDemoMode()) {
      const demoData = getAllDemoData();
      setDevelopments(demoData.developments);
      setStands(demoData.stands);
      return;
    }
    
    // Real API call
    const devs = await fetchDevelopments();
    setDevelopments(devs);
  }
  
  loadDevelopments();
}, []);
```

---

## 🧪 Testing Scenarios Enabled

### 1. 72-Hour Reservation Timer
- Stand `BB002` expires in 48 hours
- Stand `VF002` has timer stopped (payment pending)
- One stand expires in 2 hours (urgent notification)

### 2. Payment Workflows
- Client uploads proof of payment
- Admin verifies payment
- Timer stops automatically
- Status changes: PENDING → PAYMENT_PENDING → CONFIRMED

### 3. Agent Dashboard
- View assigned clients
- Track pipeline stages
- See commission calculations

### 4. Client Portal
- Browse available properties
- View owned stands
- Check reservation status
- Upload payment proofs

### 5. Admin Functions
- Manage all users
- Verify payments
- Review audit logs
- Configure system settings

---

## 🔧 Customization

### Add More Data

Edit these files:
- **Database seed**: `scripts/seed-demo-data.ts`
- **Browser demo**: `lib/demo-data.ts`

Example: Add a new development

```typescript
// In lib/demo-data.ts
export const demoDevelopments: Development[] = [
  // ... existing developments
  {
    id: 'dev-5',
    name: 'Your New Development',
    location_name: 'Chitungwiza, Harare',
    description: 'Modern affordable housing',
    phase: 'SERVICING',
    base_price: 38000,
    // ... more fields
  },
];
```

### Modify Existing Data

```typescript
// Change prices
demoDevelopments[0].base_price = 95000;

// Add more stands
for (let i = 1; i <= 100; i++) {
  demoStands.push({
    id: `stand-custom-${i}`,
    number: `C${String(i).padStart(3, '0')}`,
    // ... more fields
  });
}
```

---

## 🗑️ Cleanup

### Clear browser demo data

```typescript
import { clearDemoData } from './lib/demo-data';
clearDemoData();
// Or click "Disable Demo Mode" in the banner
```

### Reset database

```bash
npm run db:reset
```

---

## 🐛 Troubleshooting

### Demo button not showing?
- Check: Is `import.meta.env.PROD` false? (Dev mode only)
- Or: Enable demo mode once to see the banner always

### Data not loading?
```typescript
// Debug in console
console.log('Demo mode?', isDemoMode());
console.log('Demo data:', getAllDemoData());
```

### Database seed fails?
```bash
# Check DATABASE_URL
echo $DATABASE_URL

# Regenerate Prisma Client
npx prisma generate

# Try again
npm run db:seed
```

---

## 📝 Quick Commands

| Command | What it does |
|---------|-------------|
| `npm run db:push` | Create database tables |
| `npm run db:seed` | Add demo data to DB |
| `npm run db:reset` | Wipe DB and reseed |
| Click "Enable Demo Data" | Browser demo mode |
| Click "Disable Demo Mode" | Clear browser demo |

---

## 🎯 Next Steps

1. ✅ Enable demo data (browser or database)
2. ✅ Start app: `npm run dev`
3. ✅ Login with demo credentials
4. ✅ Explore different user roles
5. ✅ Test reservation flows
6. ✅ Upload payment proofs
7. ✅ Review audit logs

---

**Need more help?** Check [DEMO_DATA_SETUP.md](./DEMO_DATA_SETUP.md) for detailed documentation.
