# Next.js Quick Reference Card

## 🚀 Start Here

```bash
# Start development server
cd "/Users/b.b.monly/Downloads/fine-&-country-zimbabwe-erp"
npm run dev

# Open in browser
http://localhost:3000
```

---

## 📁 Project Structure

```
app/
├── page.tsx              ← Home page + auth handlers
├── layout.tsx            ← Root layout + Tailwind config
├── globals.css           ← Global styles
└── api/
    └── admin/
        ├── developments/route.ts
        ├── stands/route.ts
        ├── agents/route.ts
        └── reservations/route.ts

components/
├── LandingPage.tsx       ← Main UI
├── PlotSelectorMap.tsx   ← Map (dynamic import)
├── ReservationModal.tsx
└── ...

lib/
├── auth.ts               ← Neon Auth client
├── prisma.ts             ← Database client
└── db.ts                 ← DB queries

.env.local               ← Environment variables
```

---

## 🔧 Important Commands

```bash
# Development
npm run dev              # Start dev server
npm run build           # Build for production
npm start              # Run production

# Database
npx prisma studio     # Open database GUI
npx prisma db push    # Sync schema to DB
npx prisma generate   # Regenerate Prisma client

# Quality
npm run lint           # Run linter
npm run type-check     # Check TypeScript types
```

---

## 🌐 API Routes

| Route | Method | Purpose |
|-------|--------|---------|
| `/api/admin/developments` | GET | Get all developments |
| `/api/admin/developments` | POST | Create development |
| `/api/admin/stands` | GET | Get stands by development |
| `/api/admin/agents` | GET | Get all agents |
| `/api/admin/reservations` | POST | Create reservation |

**Test with curl:**
```bash
curl http://localhost:3000/api/admin/developments
```

---

## 🎨 Styling

### Custom Colors (Available globally)
```tsx
<div className="bg-fcGold">Gold button</div>
<div className="bg-fcSlate">Dark background</div>
<div className="text-fcSlate">Dark text</div>
<div className="border-fcGold">Gold border</div>
```

### Colors
- `fcGold` - #85754E (primary accent)
- `fcSlate` - #1e293b (dark)
- `fcCream` - #fffbf0 (light)
- `fcDark` - #1a1a1a
- `fcDivider` - #e0e0e0
- `fcText` - #333333

---

## 🔐 Authentication Flow

```
User clicks "Access portal"
    ↓
Modal opens with role selector
    ↓
User selects Admin/Agent/Client
    ↓
Click "Enter Workspace"
    ↓
Code calls: authClient.signInWithMagicLink({
  email: "admin@fineandcountry.co.zw",
  callbackURL: "/dashboard?role=Admin"
})
    ↓
Email sent to user
    ↓
User clicks link in email
    ↓
Redirects to /dashboard with auth token
```

---

## 🗄️ Database

### Models Available
- `User` - User accounts
- `Development` - Real estate developments
- `Stand` - Individual plots
- `Reservation` - Customer reservations
- `Agent` - Sales agents
- `AuditLog` - System audit trail

### Query Examples

```typescript
// In API routes or Server Components
import { prisma } from '@/lib/prisma';

// Get all
const devs = await prisma.development.findMany();

// Get one
const dev = await prisma.development.findUnique({
  where: { id: "cuid-id" }
});

// Create
const newDev = await prisma.development.create({
  data: { name: "...", latitude: 0, longitude: 0 }
});

// Update
await prisma.development.update({
  where: { id: "cuid-id" },
  data: { name: "Updated name" }
});

// Delete
await prisma.development.delete({
  where: { id: "cuid-id" }
});
```

---

## 🚨 Common Issues & Fixes

| Issue | Solution |
|-------|----------|
| Port 3000 in use | `lsof -ti:3000 \| xargs kill -9` |
| Tailwind not working | Hard refresh: Cmd+Shift+R (Mac) |
| "window is not defined" | Already fixed! Using dynamic imports |
| API returns 404 | Check file at `app/api/admin/x/route.ts` |
| Database connection fails | Check `DATABASE_URL` in `.env.local` |
| Build fails | `rm -rf .next && npm run build` |

---

## 📝 Create New Files

### New API Route
```typescript
// app/api/admin/my-feature/route.ts
import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  try {
    return NextResponse.json({ data: 'success' });
  } catch (error) {
    return NextResponse.json({ error: 'failed' }, { status: 500 });
  }
}
```

### New Component
```typescript
// components/MyComponent.tsx
'use client';  // Only if using state/hooks

export default function MyComponent() {
  return <div>My Component</div>;
}
```

### New Page
```typescript
// app/my-page/page.tsx
export default function MyPage() {
  return <div>My Page</div>;
}
```

---

## ⚙️ Environment Variables

Located in `.env.local`:

```env
# Required - Database
DATABASE_URL=postgresql://...
DATABASE_URL_UNPOOLED=postgresql://...

# Required - Auth
VITE_NEON_AUTH_URL=https://...

# Optional
NEXT_PUBLIC_APP_URL=http://localhost:3000
NODE_ENV=development
```

---

## 📊 Monitoring

### Check Database
```bash
npx prisma studio
# Opens http://localhost:5555
```

### Check API
```bash
curl -s http://localhost:3000/api/admin/developments | jq
```

### Check Build
```bash
npm run build
# Check output for errors
```

### Check Types
```bash
npm run type-check
```

---

## 🚀 Deployment Checklist

- [ ] Update `.env.local` with production values
- [ ] Run `npm run build` (0 errors)
- [ ] Test login flow
- [ ] Set environment variables in hosting
- [ ] Run `npx prisma db push` on production DB
- [ ] Test API routes in production
- [ ] Configure custom domain
- [ ] Set up monitoring/logging
- [ ] Enable HTTPS
- [ ] Configure backups

---

## 📚 Documentation

- **Full Guide:** See `NEXTJS_CONFIGURATION_GUIDE.md`
- **Checklist:** See `NEXTJS_SETUP_CHECKLIST.md`
- **Troubleshooting:** See `NEXTJS_TROUBLESHOOTING.md`
- **Summary:** See `NEXTJS_READY_SUMMARY.md`

---

## 🎯 Current Status

✅ Next.js installed & running
✅ Database connected
✅ API routes working
✅ Styling configured
✅ Auth integrated
✅ Components migrated

**Ready for:** Testing → Development → Deployment

---

## 💡 Tips

1. Use `npm run dev` in one terminal
2. Use another terminal for running scripts
3. Keep DevTools open (F12) to check console
4. Use `npx prisma studio` for database management
5. Read error messages - they usually explain the issue!

---

## 🔗 Useful Links

- Next.js: https://nextjs.org/docs
- Tailwind: https://tailwindcss.com/docs
- Prisma: https://www.prisma.io/docs
- Neon: https://neon.tech/docs

---

**Version:** Next.js 15.5.9  
**Date:** Dec 29, 2025  
**Status:** ✅ Ready

