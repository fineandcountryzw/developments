# Complete Deployment Guide - Forensic Development Management

## 🚀 Deployment Sequence

### Phase 1: Database Migration (CRITICAL)

```bash
# Set DATABASE_URL environment variable
export DATABASE_URL="postgresql://user:pass@ep-xxxx.neon.tech/dbname"

# Create and apply migration
npx prisma migrate dev --name add_development_forensics

# Verify migration applied
npx prisma db push
```

**What This Does**:
- ✅ Creates `development_edit` table with forensic fields
- ✅ Adds columns to `development` table (mainImage, gallery, geoJsonUrl, lastUpdatedById)
- ✅ Adds columns to `user` table (branch, developmentsEdited relation)
- ✅ Creates indexes on developmentId and createdAt for query performance

**Expected Output**:
```
✔ Your database has been successfully migrated to the latest schema.
✔ Prisma Migrate replayed migration(s) from the migrations folder.
```

### Phase 2: Environment Configuration

Add to `.env.local` or deployment platform:

```bash
# Neon Database
DATABASE_URL=postgresql://user:pass@ep-xxxx.neon.tech/yourdb

# UploadThing (get from https://uploadthing.com/dashboard)
UPLOADTHING_TOKEN=sk_live_xxxxxxxxxxxxx
UPLOADTHING_SECRET=sk_live_xxxxxxxxxxxxx

# Node Environment
NODE_ENV=production
```

### Phase 3: Build Verification

```bash
# Install dependencies (if needed)
npm install

# Build production bundle
npm run build

# Expected: Build succeeds with no TypeScript errors
# Output should show: ✓ built in X.XXs
```

### Phase 4: Deployment

#### Option A: Vercel Deployment
```bash
# If already connected to Vercel
git push origin main

# Vercel automatically:
# - Runs npm run build
# - Deploys to edge functions
# - Environment variables from project settings
```

#### Option B: Manual Deployment
```bash
# Build for production
npm run build

# Deploy dist/ folder to your hosting
# Or deploy Vercel functions to your infrastructure
```

---

## 📋 Verification Checklist

### Database Verification

```bash
# Check DevelopmentEdit table exists
npx prisma db execute --stdin <<EOF
SELECT table_name FROM information_schema.tables 
WHERE table_name = 'development_edit';
EOF

# Check Development table has new columns
npx prisma db execute --stdin <<EOF
SELECT column_name FROM information_schema.columns 
WHERE table_name = 'development' 
AND column_name IN ('main_image', 'gallery', 'geo_json_url', 'last_updated_by_id');
EOF
```

### API Endpoint Verification

```bash
# Test UploadThing router is accessible
curl -X POST http://localhost:3000/api/uploadthing/core \
  -H "x-development-id: test" \
  -H "Authorization: Bearer [token]"

# Test update endpoint is accessible
curl -X POST http://localhost:3000/api/developments/update \
  -H "Content-Type: application/json" \
  -d '{"developmentId":"test"}'
```

### Build Artifacts

```bash
# Verify build output
ls -lh dist/

# Check for:
# - dist/index.html (entry point)
# - dist/assets/ (bundled code)
# - No TypeScript errors in terminal output
```

### Functional Testing

1. **Admin Login**
   - ✅ Can authenticate as admin user
   - ✅ Session token obtained
   - ✅ Admin role verified

2. **Image Upload**
   - ✅ Can select and upload image
   - ✅ Progress bar shows upload progress
   - ✅ Success message with image URL
   - ✅ Development.mainImage updated in database
   - ✅ DevelopmentEdit record created
   - ✅ Activity log entry created

3. **Development Update**
   - ✅ Can open edit form
   - ✅ Can modify fields (name, basePrice, description)
   - ✅ Can submit update
   - ✅ Response shows changed fields
   - ✅ Development record updated
   - ✅ DevelopmentEdit records created for each change
   - ✅ Activity log entry created

4. **Audit Trail View**
   - ✅ System Diagnostics accessible
   - ✅ Activity table shows updates
   - ✅ Can filter by type="STAND_UPDATE"
   - ✅ Description shows admin email and changes
   - ✅ Timestamps accurate and in UTC

---

## 🔍 Post-Deployment Testing

### Test 1: Upload Functionality

```bash
# As admin user, upload a test image

curl -X POST http://your-domain.com/api/uploadthing/developmentMainImage \
  -H "x-development-id: dev_test_123" \
  -H "Authorization: Bearer [admin-token]" \
  -F "file=@test-image.jpg"

# Expected response:
# {
#   "uploadedUrl": "https://uploadthing.../xyz.jpg",
#   "developmentId": "dev_test_123"
# }

# Verify in database:
# SELECT * FROM development_edit 
# WHERE development_id = 'dev_test_123' 
# AND field_name = 'mainImage';
# Should show one record with old and new values
```

### Test 2: Update with Diffing

```bash
curl -X POST http://your-domain.com/api/developments/update \
  -H "Authorization: Bearer [admin-token]" \
  -H "Content-Type: application/json" \
  -d '{
    "developmentId": "dev_test_123",
    "basePrice": 200000,
    "description": "Updated description"
  }'

# Expected response:
# {
#   "success": true,
#   "changes": [
#     { "fieldName": "basePrice", "oldValue": 150000, "newValue": 200000 },
#     { "fieldName": "description", "oldValue": "...", "newValue": "..." }
#   ],
#   "changeSummary": "2 field(s) updated"
# }

# Verify in database:
# SELECT * FROM development_edit 
# WHERE development_id = 'dev_test_123' 
# ORDER BY created_at DESC 
# LIMIT 10;
# Should show one record per changed field
```

### Test 3: Forensic Audit Trail

```bash
# Query via Prisma (in admin dashboard or API)

const edits = await prisma.developmentEdit.findMany({
  where: { developmentId: 'dev_test_123' },
  orderBy: { createdAt: 'desc' },
  include: { editedBy: { select: { email: true } } }
});

// Should return all changes with admin emails and timestamps
// [
//   {
//     fieldName: "description",
//     oldValue: "...",
//     newValue: "...",
//     editedBy: { email: "admin@fineandcountry.co.zw" },
//     createdAt: "2025-01-15T10:30:00Z"
//   },
//   {
//     fieldName: "basePrice",
//     oldValue: "150000",
//     newValue: "200000",
//     editedBy: { email: "admin@fineandcountry.co.zw" },
//     createdAt: "2025-01-15T10:25:00Z"
//   }
// ]
```

### Test 4: System Diagnostics Integration

1. Go to: Admin Dashboard → System Diagnostics
2. Filter Activity table: `type = "STAND_UPDATE"`
3. Verify entries show:
   - ✅ Description with development ID
   - ✅ Admin email who made the change
   - ✅ List of what changed (fieldName: oldValue → newValue)
   - ✅ Timestamp in ISO format
   - ✅ Metadata JSON with complete change data

---

## 🐛 Troubleshooting

### Issue: Migration Fails

```bash
# Error: "Datasource requires an environment variable"
# Fix: Set DATABASE_URL before running migrate

export DATABASE_URL="your_neon_url"
npx prisma migrate dev --name add_development_forensics
```

### Issue: Build Fails with TypeScript Errors

```bash
# Error: "Type 'X' is not assignable to type 'Y'"
# Fix: Check imports and type definitions

# Verify auth import is correct:
# import { auth } from "@/lib/auth"

# Verify Prisma client types:
# npm run prisma:generate
npx prisma generate

# Then rebuild:
npm run build
```

### Issue: Upload Returns 403 Forbidden

```bash
# Check 1: Admin role in session
// In /api/uploadthing/core.ts
if (session.user.role !== 'ADMIN') {
  throw new UploadThingError('Admin access required');
}

# Check 2: Valid session token
// Verify auth() returns valid session
const session = await auth();
console.log('Session:', session);

# Check 3: Development ID header
// Verify x-development-id header is passed
headers: {
  'x-development-id': developmentId
}
```

### Issue: Forensic Records Not Created

```bash
# Check 1: logForesicEdit function is called
// In /api/developments/update.ts
await logForesicEdit(
  developmentId,
  fieldName,
  oldValue,
  newValue,
  editedBy
);

# Check 2: System user exists
SELECT * FROM "user" 
WHERE email = 'system@fineandcountry.co.zw';

# Check 3: Server logs for errors
// Check terminal for:
// [DevelopmentEdit] Forensic entry created
// [ActivityLog] Development update logged

# Check 4: Database connection
// Verify DATABASE_URL is correct and accessible
npx prisma db execute --stdin <<EOF
SELECT 1;
EOF
```

---

## 📊 Performance Optimization

### Database Indexes

The schema creates indexes for fast forensic queries:

```prisma
@@index([developmentId])  // Query by development
@@index([createdAt])      // Query by date range
```

### Query Performance

```typescript
// GOOD - Uses indexes
const edits = await prisma.developmentEdit.findMany({
  where: { developmentId: 'dev_123' },
  orderBy: { createdAt: 'desc' },
  take: 100  // Limit results
});

// AVOID - Full table scan
const edits = await prisma.developmentEdit.findMany({
  where: { fieldName: 'basePrice' },  // No index on fieldName
});
```

### Connection Pooling

Vercel Serverless + Neon automatically handles:
- ✅ Connection pooling
- ✅ Connection reuse across invocations
- ✅ Automatic cleanup after request

---

## 📚 Files Deployed

| File | Purpose | Size | Type |
|------|---------|------|------|
| `/api/uploadthing/core.ts` | File upload routers | ~350 lines | TypeScript |
| `/api/developments/update.ts` | Development update API | ~280 lines | TypeScript |
| `/prisma/schema.prisma` | Database schema | Updated | Prisma |
| Documentation files | Guides and references | 3 files | Markdown |

---

## ✅ Deployment Signoff

After completing all steps:

- [ ] Database migration applied
- [ ] Environment variables configured
- [ ] Build succeeds (npm run build)
- [ ] Upload test passes
- [ ] Update test passes
- [ ] Audit trail visible in System Diagnostics
- [ ] Production deployment complete
- [ ] Monitoring configured

---

## 📞 Support

For deployment issues:

1. **Check Console Logs**
   - Server: `/api/uploadthing/core.ts` console.log output
   - Server: `/api/developments/update.ts` console.log output
   - Client: Browser DevTools → Console

2. **Check Database**
   ```bash
   # List tables
   npx prisma db execute --stdin <<EOF
   SELECT * FROM information_schema.tables;
   EOF
   
   # View DevelopmentEdit records
   npx prisma db execute --stdin <<EOF
   SELECT * FROM development_edit LIMIT 10;
   EOF
   ```

3. **Check Build**
   ```bash
   npm run build
   # Look for TypeScript errors or warnings
   ```

4. **Verify Connectivity**
   ```bash
   # Test Neon connection
   psql "$DATABASE_URL"
   
   # Test UploadThing (if needed)
   curl -X GET https://uploadthing.com/api/ping
   ```

---

## 🎉 Success Criteria

Deployment is complete when:

✅ All steps in "Deployment Sequence" completed  
✅ All items in "Verification Checklist" checked  
✅ All tests in "Post-Deployment Testing" pass  
✅ No errors in "Troubleshooting" section apply  
✅ Admin can upload images with forensic logging  
✅ Admin can update developments with audit trail  
✅ System Diagnostics shows all changes  
✅ Build passes without errors or warnings  

---

## Next Steps

After successful deployment:

1. **Create Frontend Components**
   - [ ] DevelopmentEditModal
   - [ ] MediaUploadWidget
   - [ ] AuditTrailViewer

2. **Integration Testing**
   - [ ] End-to-end upload workflow
   - [ ] End-to-end update workflow
   - [ ] Audit trail visibility

3. **User Training**
   - [ ] Admin training on new features
   - [ ] Documentation for users
   - [ ] Support escalation paths

4. **Monitoring**
   - [ ] Set up error tracking
   - [ ] Monitor DevelopmentEdit table growth
   - [ ] Alert on database errors

---

**Deployment Guide Version**: 1.0  
**Last Updated**: 2025-01-15  
**Status**: Production Ready
