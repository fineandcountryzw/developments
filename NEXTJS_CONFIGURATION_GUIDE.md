# Next.js 15.5.9 Configuration Guide - Fine & Country Zimbabwe ERP

## 1. Environment Variables Setup

Create `.env.local` file in the root directory with:

```env
# ─────────────────────────────────────────────────────────────────
# NEON DATABASE CONFIGURATION
# ─────────────────────────────────────────────────────────────────
DATABASE_URL=postgresql://user:password@project.neon.tech/dbname
DIRECT_URL=postgresql://user:password@project.neon.tech/dbname?sslmode=require

# ─────────────────────────────────────────────────────────────────
# NEON AUTH CONFIGURATION
# ─────────────────────────────────────────────────────────────────
VITE_NEON_AUTH_URL=https://your-project.neon.tech/auth
NEON_AUTH_URL=https://your-project.neon.tech/auth

# ─────────────────────────────────────────────────────────────────
# APPLICATION CONFIGURATION
# ─────────────────────────────────────────────────────────────────
NEXT_PUBLIC_APP_URL=http://localhost:3000
NODE_ENV=development

# ─────────────────────────────────────────────────────────────────
# OPTIONAL: EMAIL/EXTERNAL SERVICES
# ─────────────────────────────────────────────────────────────────
# SENDGRID_API_KEY=your_key_here
# STRIPE_SECRET_KEY=your_key_here
# STRIPE_PUBLISHABLE_KEY=your_key_here
```

## 2. Next.js Configuration (`next.config.mjs`)

Already configured with:
- ✅ Webpack config for pg-native compatibility
- ✅ CORS headers for API routes
- ✅ Environment variables setup
- ✅ React strict mode

## 3. Prisma Configuration

### Initialize Prisma migrations:

```bash
npx prisma generate
npx prisma db push
```

### Create a migration:

```bash
npx prisma migrate dev --name "add_column_name"
```

### Sync schema without migration (dev only):

```bash
npx prisma db push
```

## 4. Database Connection

The app uses **Neon PostgreSQL** with **PrismaPg** for serverless connections.

### Files:
- `prisma/schema.prisma` - ORM schema
- `lib/prisma.ts` - PrismaClient initialization (lazy-loaded, safe for server/client)

### Test connection:

```bash
npx prisma studio  # Opens database GUI
```

## 5. API Routes Configuration

API routes are located at: `/app/api/admin/**`

### Creating a new API route:

```typescript
// app/api/admin/your-endpoint/route.ts
import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  try {
    // Your logic here
    return NextResponse.json({ data: 'success' });
  } catch (error) {
    console.error('[API Error]', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    // Your logic here
    return NextResponse.json({ data: 'created' });
  } catch (error) {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  }
}
```

## 6. Authentication Setup

### Neon Auth Configuration:

Files:
- `lib/auth.ts` - Main auth client with Neon Auth integration
- `app/page.tsx` - Login flow with magic link

### Login flow:

1. User clicks "Access portal"
2. Modal opens with role selection
3. User selects role (Admin/Agent/Client)
4. Email is auto-generated: `{role}@fineandcountry.co.zw`
5. Clicking "Enter Workspace" calls Neon Auth magic link
6. Email sent to configured Neon Auth email service
7. User clicks link in email → redirects to `/dashboard?role={ROLE}`

## 7. Styling Configuration

### Tailwind CSS:

Currently using **Tailwind CDN** (via `<script src="https://cdn.tailwindcss.com">`)

**Custom colors configured in `app/layout.tsx`:**
- `fcGold` - #85754E (primary accent)
- `fcSlate` - #1e293b (dark background)
- `fcDark` - #1a1a1a
- `fcCream` - #fffbf0 (light background)
- `fcDivider` - #e0e0e0 (borders)
- `fcText` - #333333 (text)

**Files:**
- `app/globals.css` - Global styles
- `tailwind.config.ts` - Config (not used with CDN, but available for build)
- `app/layout.tsx` - Contains Tailwind CDN + custom color config

### Fonts:

- **Inter** - Via `next/font/google` (header/body)
- **Montserrat** - Via CSS (footer, headings)

## 8. Build & Deployment

### Build the project:

```bash
npm run build
```

### Run production build:

```bash
npm start
```

### Development server:

```bash
npm run dev
```

Runs on http://localhost:3000

## 9. Key Directories

```
fine-&-country-zimbabwe-erp/
├── app/                          # Next.js app directory (React Server Components)
│   ├── layout.tsx               # Root layout with fonts & Tailwind config
│   ├── page.tsx                 # Home page / Landing page
│   ├── globals.css              # Global styles
│   └── api/
│       └── admin/               # Admin API routes
│           ├── developments/
│           ├── stands/
│           ├── reservations/
│           └── agents/
├── components/                   # React components (mostly 'use client')
│   ├── LandingPage.tsx          # Main landing page component
│   ├── PlotSelectorMap.tsx      # Leaflet map (dynamic import)
│   ├── ReservationModal.tsx     # Reservation flow
│   └── ...
├── lib/                          # Utilities & libraries
│   ├── auth.ts                  # Neon Auth client
│   ├── prisma.ts                # PrismaClient initialization
│   └── db.ts                    # Database queries
├── services/                     # Business logic
│   ├── supabase.ts              # Mock service (Development)
│   ├── whitepaperService.ts     # PDF generation
│   └── ...
├── types.ts                      # TypeScript interfaces
├── prisma/
│   ├── schema.prisma            # Database schema
│   └── migrations/              # Database migrations
├── next.config.mjs              # Next.js configuration
├── tailwind.config.ts           # Tailwind configuration (for build)
└── tsconfig.json                # TypeScript configuration
```

## 10. Important Notes

### SSR & Dynamic Imports:

Some components like `PlotSelectorMap` use browser APIs (Leaflet). They are imported with:

```typescript
const PlotSelectorMap = dynamic(
  () => import('./PlotSelectorMap.tsx').then(mod => mod.PlotSelectorMap),
  { ssr: false, loading: () => <div>Loading...</div> }
);
```

This prevents server-side rendering errors.

### Client vs Server Components:

- Use `'use client'` for interactive components (buttons, forms, modals)
- Server components by default for better performance
- API routes are always server-side

## 11. Common Commands

```bash
# Development
npm run dev              # Start dev server
npm run build           # Build for production
npm start              # Run production server
npm run lint           # Run TypeScript & eslint checks

# Database
npx prisma generate    # Generate Prisma client
npx prisma db push     # Sync schema to database
npx prisma studio     # Open Prisma Studio GUI
npx prisma migrate dev # Create migration

# Testing
npm test               # Run tests (if configured)
```

## 12. Deployment Checklist

- [ ] Set all `.env` variables in hosting provider
- [ ] Run `npm run build` locally to test build
- [ ] Verify Neon Auth URL is correct for production domain
- [ ] Set `NEXT_PUBLIC_APP_URL` to production URL
- [ ] Run `npx prisma db push` on production database
- [ ] Test login flow with magic links
- [ ] Verify API routes are accessible
- [ ] Check error logs in production

## 13. Troubleshooting

### Build Errors:

```bash
# Clear Next.js cache and rebuild
rm -rf .next node_modules
npm install
npm run build
```

### Database Connection Issues:

```bash
# Test connection
npx prisma studio

# Check if PrismaPg is installed
npm ls @prisma/adapter-pg
```

### Tailwind Not Working:

1. Clear browser cache: `Cmd+Shift+R` (Mac) or `Ctrl+Shift+R` (Windows)
2. Verify Tailwind CDN is loading in browser DevTools
3. Check custom colors in `app/layout.tsx` are defined

### Magic Link Not Sending:

1. Verify `VITE_NEON_AUTH_URL` is correct
2. Check Neon Auth email configuration
3. Verify sender email is configured in Neon Auth
4. Check email spam folder

---

**Next Steps:**
1. ✅ Environment variables → Update `.env.local`
2. ✅ Database → Run `npx prisma db push`
3. ✅ Test build → Run `npm run build`
4. ✅ Test local → Run `npm run dev`
5. ✅ Test auth → Click "Access portal" and verify email

