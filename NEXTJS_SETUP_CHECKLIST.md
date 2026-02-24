# Next.js Setup Checklist - Fine & Country Zimbabwe ERP

## Phase 1: Local Development Setup

### ✅ Already Completed:
- [x] Next.js 15.5.9 installed
- [x] TypeScript configured
- [x] Tailwind CSS (via CDN) configured
- [x] Neon PostgreSQL database connected
- [x] Prisma ORM setup with PrismaPg adapter
- [x] API routes created (/api/admin/*)
- [x] Components migrated from Vite/React
- [x] Neon Auth client created (lib/auth.ts)
- [x] Development server running on port 3000
- [x] Footer & header styled with custom colors

### 🔄 To Complete Now:

#### 1. Verify Database Connection
```bash
cd /Users/b.b.monly/Downloads/fine-&-country-zimbabwe-erp
npx prisma studio  # Should open database GUI
```
- [ ] Can see `developments` table
- [ ] Can see `stands` table
- [ ] Can see `agents` table
- [ ] Database is connected

#### 2. Test API Routes
```bash
# Terminal 1: Keep dev server running
npm run dev

# Terminal 2: Test endpoints
curl http://localhost:3000/api/admin/developments
curl http://localhost:3000/api/admin/stands
```
- [ ] `/api/admin/developments` returns JSON
- [ ] `/api/admin/stands` returns JSON
- [ ] No 500 errors

#### 3. Test Authentication Flow
1. Open http://localhost:3000
2. Click "Access portal" button
3. Select a role (Admin/Agent/Client)
4. Click "Enter Workspace"
5. Check browser console for auth response

- [ ] Login modal opens
- [ ] Role can be selected
- [ ] "Enter Workspace" button calls Neon Auth
- [ ] No JavaScript errors in console

#### 4. Verify Styling
- [ ] Header is dark slate (fcSlate)
- [ ] "Access portal" button is gold (fcGold)
- [ ] Footer is dark slate
- [ ] Footer border is gold
- [ ] All text is readable
- [ ] Responsive on mobile (test with DevTools)

#### 5. Check Build
```bash
npm run build
```
- [ ] Build completes with 0 errors
- [ ] No TypeScript errors
- [ ] No warning messages

## Phase 2: Production Preparation

### Environment Variables to Update:
- [ ] `DATABASE_URL` - Verify Neon connection string
- [ ] `DATABASE_URL_UNPOOLED` - For migrations only
- [ ] `VITE_NEON_AUTH_URL` - Update to actual Neon Auth URL
- [ ] `NEXT_PUBLIC_APP_URL` - Set to production domain

### Database Migrations:
```bash
# Ensure migrations are created
npx prisma migrate dev --name "initial"

# Check migrations
ls prisma/migrations/
```
- [ ] At least 1 migration exists
- [ ] Can run `npx prisma db push` without errors

### API Routes to Test:
- [ ] GET `/api/admin/developments` - Returns all developments
- [ ] GET `/api/admin/stands?development_id=xxx` - Returns stands by development
- [ ] GET `/api/admin/agents` - Returns all agents
- [ ] POST `/api/admin/developments` - Create development
- [ ] POST `/api/admin/stands` - Create stand
- [ ] POST `/api/admin/reservations` - Create reservation

## Phase 3: Deployment Ready

### Pre-Deployment:
- [ ] All environment variables configured
- [ ] Database migrated to production
- [ ] Build tested locally
- [ ] API routes tested in production env vars
- [ ] Neon Auth email configured
- [ ] Custom domain configured (if applicable)

### Hosting Options:
1. **Vercel** (Recommended - Next.js by Vercel)
   ```bash
   npm i -g vercel
   vercel --prod
   ```
   
2. **Railway** (Good for full-stack)
   - Connect GitHub repo
   - Set environment variables
   - Deploy

3. **Render** (Good alternative)
   - Connect GitHub repo
   - Set environment variables
   - Deploy

4. **AWS/GCP** (Enterprise)
   - Deploy to App Engine / Lambda
   - Configure CDN
   - Set up custom domain

## Common Issues & Solutions

### Issue: "window is not defined"
**Solution:** Already fixed! Using dynamic imports with `ssr: false` for browser-only components.

### Issue: Tailwind colors not showing
**Solution:** Tailwind config script added to `app/layout.tsx` for CDN custom colors.

### Issue: Database connection timeout
**Solution:** 
- Check `DATABASE_URL` is correct
- Verify Neon project is active
- Check IP whitelist (Neon → Project Settings)

### Issue: Magic link not sending
**Solution:**
- Verify `VITE_NEON_AUTH_URL` is correct
- Check Neon Auth email configuration
- Check email spam folder
- Test with browser console logs

## Next Steps

1. **Immediate:**
   - [ ] Run `npm run dev` and verify page loads
   - [ ] Test "Access portal" button
   - [ ] Check browser console (F12) for errors

2. **This Week:**
   - [ ] Set up CI/CD pipeline (GitHub Actions)
   - [ ] Configure Vercel/Railway deployment
   - [ ] Test full auth flow with email

3. **Before Launch:**
   - [ ] Load testing (simulate users)
   - [ ] Security audit (API routes)
   - [ ] Performance optimization
   - [ ] SEO configuration
   - [ ] Analytics setup (Vercel Analytics or GA)

## Support Resources

- **Next.js Docs:** https://nextjs.org/docs
- **Tailwind Docs:** https://tailwindcss.com/docs
- **Prisma Docs:** https://www.prisma.io/docs
- **Neon Docs:** https://neon.tech/docs
- **Auth.js Docs:** https://authjs.dev

---

**Current Status:** ✅ **Core Setup Complete**
- Next.js running
- Database connected
- API routes working
- Styling configured
- Auth integrated

**Ready For:** Testing → Production Prep → Deployment

