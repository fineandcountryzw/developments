# Next.js Troubleshooting & Quick Reference

## Quick Start Commands

```bash
# Development
npm run dev              # Start dev server (port 3000)
npm run build           # Build for production
npm start              # Run production build

# Database
npx prisma studio     # Open database GUI
npx prisma db push    # Sync schema to database
npx prisma generate   # Regenerate Prisma client

# Debugging
npm run lint           # Check for errors
npm run type-check     # Run TypeScript check
```

## Port Already in Use (Error)

```bash
# Kill process on port 3000
lsof -ti:3000 | xargs kill -9

# Or use different port
PORT=3001 npm run dev
```

## TypeScript Errors After Changes

```bash
# Clear Next.js cache
rm -rf .next node_modules/.cache

# Regenerate Prisma
npx prisma generate

# Rebuild
npm run build
```

## Database Connection Issues

### Error: "Can't reach database server"

1. **Check connection string:**
   ```bash
   echo $DATABASE_URL
   # Should be: postgresql://user:password@host/dbname?sslmode=require
   ```

2. **Test with psql:**
   ```bash
   psql "$DATABASE_URL"
   ```

3. **Verify Neon IP whitelist:**
   - Go to Neon Console
   - Project → Settings → IP Whitelist
   - Add your IP (or 0.0.0.0/0 for development)

### Error: "PRISMA_CLIENT_ENGINE_TYPE"

```bash
# Regenerate Prisma client
rm -rf node_modules/.prisma
npx prisma generate
```

## API Route Issues

### 404 on /api/admin/* routes

1. **Check file exists:**
   ```bash
   ls app/api/admin/
   # Should see: developments/, stands/, agents/, etc.
   ```

2. **Check file structure:**
   ```bash
   # Correct:
   app/api/admin/developments/route.ts
   
   # Wrong:
   app/api/admin/developments.ts
   ```

3. **Rebuild:**
   ```bash
   rm -rf .next && npm run build
   ```

### 500 Error in API Routes

1. **Check browser console** for full error
2. **Check terminal** for server logs
3. **Check environment variables:**
   ```bash
   echo $DATABASE_URL
   echo $VITE_NEON_AUTH_URL
   ```

## Component Issues

### "window is not defined" Error

**Already Fixed!** But if you see it:

```typescript
// ✅ CORRECT - Use dynamic import
import dynamic from 'next/dynamic';

const MyComponent = dynamic(
  () => import('./MyComponent'),
  { ssr: false }
);

// ❌ WRONG - Direct import
import MyComponent from './MyComponent';
```

### Styling Not Applying

1. **Check Tailwind CDN is loaded:**
   - Open DevTools (F12)
   - Network tab
   - Search for "tailwindcss.com"
   - Should show 200 status

2. **Check custom colors:**
   - Open DevTools → Console
   - Type `window.tailwind`
   - Should show config with custom colors

3. **Hard refresh browser:**
   - Mac: Cmd + Shift + R
   - Windows: Ctrl + Shift + R

4. **Clear cache:**
   ```bash
   rm -rf .next
   npm run dev
   ```

## Authentication Issues

### Magic Link Not Sending

1. **Check Neon Auth URL:**
   ```bash
   echo $VITE_NEON_AUTH_URL
   # Should be actual Neon Auth endpoint, not placeholder
   ```

2. **Check browser console** for error messages
3. **Check email spam folder**
4. **Verify email is correct:**
   - Should be: `{role}@fineandcountry.co.zw`

### Login Modal Not Opening

1. **Check button click:**
   - Open DevTools → Console
   - Click "Access portal" button
   - Should see console logs (if added)

2. **Check isLoginOpen state:**
   ```typescript
   // In page.tsx
   const [isLoginOpen, setIsLoginOpen] = useState(false);
   // handleOpenLogin should call setIsLoginOpen(true)
   ```

## Performance Issues

### Slow Page Load

1. **Check API routes:**
   ```bash
   # Time the API call
   time curl http://localhost:3000/api/admin/developments
   ```

2. **Check database:**
   ```bash
   # Use Prisma Studio to check data
   npx prisma studio
   ```

3. **Check bundle size:**
   ```bash
   npm run build
   # Look for output like "○ (Static) xyz  B"
   ```

### High Memory Usage

```bash
# Check process
top -p $(pgrep -f "next dev")

# Clear cache and rebuild
rm -rf .next node_modules/.cache
npm run dev
```

## Build Fails

### "Unexpected token" or "Module not found"

```bash
# Full clean rebuild
rm -rf node_modules .next package-lock.json
npm install
npm run build
```

### TypeScript Errors

```bash
# Check all errors
npm run type-check

# Or see full build output
npm run build 2>&1 | tee build.log
```

## Deployment Issues

### Vercel Deployment Fails

1. **Check environment variables:**
   - Go to Vercel Dashboard
   - Project Settings → Environment Variables
   - Add `DATABASE_URL`, `VITE_NEON_AUTH_URL`, etc.

2. **Check build command:**
   - Should be: `npm run build`
   - Not: `next build`

3. **Check start command:**
   - Should be: `npm start`
   - Not: `next start`

### Railway/Render Deployment

1. **Set build command:**
   ```
   npm install && npm run build
   ```

2. **Set start command:**
   ```
   npm start
   ```

3. **Set environment variables:**
   - DATABASE_URL
   - VITE_NEON_AUTH_URL
   - NEXT_PUBLIC_APP_URL (production URL)

## Useful Debug Commands

```bash
# Check all dependencies
npm ls

# Check for security issues
npm audit

# Check Next.js version
npm ls next

# Check Prisma version
npm ls prisma

# List all environment variables
env | grep -E "NEON|DATABASE|NEXT" | sort

# Test database directly
psql "$DATABASE_URL" -c "SELECT count(*) FROM developments;"

# Monitor dev server
npm run dev 2>&1 | tee dev.log
```

## File Locations Reference

```
Fine & Country ERP
├── app/
│   ├── layout.tsx              # ← Tailwind CDN config here
│   ├── page.tsx                # ← Login handlers here
│   ├── globals.css             # ← Global styles here
│   └── api/admin/              # ← API routes here
├── components/
│   ├── LandingPage.tsx         # ← Main landing page
│   ├── PlotSelectorMap.tsx     # ← Map component (dynamic import)
│   └── ...
├── lib/
│   ├── auth.ts                 # ← Neon Auth client
│   ├── prisma.ts               # ← Database client
│   └── db.ts                   # ← Database queries
├── .env.local                  # ← Environment variables (create if missing)
├── next.config.mjs             # ← Next.js config
└── tsconfig.json               # ← TypeScript config
```

## When Everything Breaks

```bash
# Nuclear option - full reset
rm -rf node_modules .next package-lock.json
npm cache clean --force
npm install
npx prisma generate
npm run build
```

If this doesn't work, check:
1. Node version: `node -v` (should be 18+)
2. npm version: `npm -v` (should be 9+)
3. Disk space: `df -h`
4. Internet connection (npm install needs internet)

## Support

- **Error in terminal?** → Copy full error, search in docs
- **API not working?** → Check Network tab in DevTools
- **Style not showing?** → Check Tailwind CDN in Network tab
- **Auth not working?** → Check browser console logs

---

**Pro Tip:** Most issues are solved by:
1. `rm -rf .next`
2. `npm run dev`
3. Hard refresh browser (Cmd+Shift+R)

