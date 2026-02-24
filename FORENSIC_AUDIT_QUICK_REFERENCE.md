# Forensic Audit System - Quick Reference

## System Overview

Complete forensic audit trail for all development changes with role-based access control.

```
User Action → API → Forensic Logging → System Diagnostics
                          ↓
                    DevelopmentEdit
                   (field-level)
                    Activity
                   (summary)
```

---

## API Endpoints

### 1. Upload Development Media
**Endpoint**: UploadThing Router (`/api/uploadthing/core.ts`)

| Router | Purpose | Max Size | Max Files | Output |
|--------|---------|----------|-----------|--------|
| `developmentMainImage` | Hero image | 8MB | 1 | mainImage URL |
| `developmentGallery` | Photo gallery | 8MB | 10 | gallery[] URL |
| `developmentMap` | GeoJSON geometry | 4MB | 1 | geoJsonUrl |

**Headers Required**:
```
x-development-id: "dev_abc123"
Authorization: Bearer [admin-session-token]
```

**On Upload Complete** (Automatic):
- ✅ Update Development.mainImage/gallery/geoJsonUrl
- ✅ Set Development.lastUpdatedById = admin ID
- ✅ Create DevelopmentEdit record (what field, old value, new value)
- ✅ Create Activity log entry (summary)
- ✅ Both searchable in System Diagnostics

---

### 2. Update Development Details
**Endpoint**: `POST /api/developments/update.ts`

**Request**:
```json
{
  "developmentId": "dev_abc123",
  "basePrice": 175000,
  "description": "Updated description",
  "status": "AVAILABLE"
}
```

**Response**:
```json
{
  "success": true,
  "development": { ...updated record... },
  "changes": [
    {
      "fieldName": "basePrice",
      "oldValue": 150000,
      "newValue": 175000
    }
  ],
  "changeSummary": "2 field(s) updated",
  "updatedAt": "2025-01-15T10:30:00Z"
}
```

**Forensic Logging** (Automatic):
- ✅ DevelopmentEdit entry for each changed field
- ✅ Activity summary with admin name and timestamp
- ✅ Both records include admin user ID and email
- ✅ Visible in System Diagnostics → Activity table

---

## Database Schema

### DevelopmentEdit (Forensic Audit Table)
```prisma
model DevelopmentEdit {
  id              String   @id @default(cuid())
  developmentId   String   @map("development_id")
  development     Development @relation(fields: [developmentId], references: [id], onDelete: Cascade)
  
  fieldName       String   @map("field_name")
  oldValue        String?  @map("old_value")
  newValue        String?  @map("new_value")
  
  editedById      String   @map("edited_by_id")
  editedBy        User     @relation("DevelopmentEdit", fields: [editedById], references: [id])
  
  createdAt       DateTime @default(now()) @map("created_at")
  
  @@index([developmentId])
  @@index([createdAt])
}
```

**Fields**:
- `fieldName`: What was changed (e.g., "basePrice", "mainImage", "description")
- `oldValue`: Before value (as string, use JSON.parse for objects)
- `newValue`: After value (as string, use JSON.parse for objects)
- `editedBy`: Admin user who made the change
- `createdAt`: When change was made (UTC)

---

## Usage Patterns

### Pattern 1: Upload Image and Auto-Log

```typescript
// Frontend
const formData = new FormData();
formData.append('file', imageFile);

const response = await fetch('/api/uploadthing/images', {
  method: 'POST',
  headers: {
    'x-development-id': developmentId
  },
  body: formData
});

const { uploadedUrl } = await response.json();

// Automatically:
// DevelopmentEdit created:
// - fieldName: "mainImage"
// - oldValue: "https://cdn.example.com/old.jpg"
// - newValue: "https://uploadthing.example.com/new.jpg"
// - editedBy: admin@fineandcountry.co.zw
// - createdAt: 2025-01-15T10:30:00Z
```

### Pattern 2: Update and Diff

```typescript
// Frontend
const response = await fetch('/api/developments/update', {
  method: 'POST',
  body: JSON.stringify({
    developmentId: 'dev_123',
    basePrice: 175000,
    description: 'New updated description'
  })
});

const { changes } = await response.json();

// Changes returned:
// [
//   { fieldName: "basePrice", oldValue: 150000, newValue: 175000 },
//   { fieldName: "description", oldValue: "Old...", newValue: "New..." }
// ]

// Both DevelopmentEdit and Activity records created automatically
```

### Pattern 3: View Audit Trail

```typescript
// Backend (Admin Dashboard)
const edits = await prisma.developmentEdit.findMany({
  where: { developmentId: 'dev_123' },
  orderBy: { createdAt: 'desc' },
  include: { editedBy: true }
});

// Response:
// [
//   {
//     fieldName: "basePrice",
//     oldValue: "150000",
//     newValue: "175000",
//     editedBy: { email: "admin1@..." },
//     createdAt: "2025-01-15T10:30:00Z"
//   },
//   {
//     fieldName: "mainImage",
//     oldValue: "https://old-cdn.com/img.jpg",
//     newValue: "https://uploadthing.com/img.jpg",
//     editedBy: { email: "admin2@..." },
//     createdAt: "2025-01-15T10:15:00Z"
//   }
// ]
```

---

## System Diagnostics Integration

### View Development Changes

1. **Go to**: Admin → System Diagnostics → Activity Table
2. **Filter**: `type = "STAND_UPDATE"`
3. **View**: Description shows what changed and who changed it

### Example Activity Entry
```
Type: STAND_UPDATE
Description: Development [dev_123] updated by admin@fineandcountry.co.zw: 
             basePrice: "150000" → "175000"; description: "Old..." → "New..."
Metadata:
  - changeCount: 2
  - editedBy: admin@fineandcountry.co.zw
  - changes: [
      { fieldName: "basePrice", oldValue: 150000, newValue: 175000 },
      { fieldName: "description", oldValue: "Old...", newValue: "New..." }
    ]
  - timestamp: 2025-01-15T10:30:00Z
```

### Query Raw Audit Trail

```typescript
// In System Diagnostics or custom dashboard
const auditTrail = await prisma.developmentEdit.findMany({
  where: {
    development: { name: { contains: "Westley" } }
  },
  orderBy: { createdAt: 'desc' },
  include: {
    development: { select: { name: true } },
    editedBy: { select: { email: true } }
  }
});

// Shows all changes to "Westley" development
```

---

## Permission Model

### Upload Media
- ✅ Requires: `session.user.role === 'ADMIN'`
- ✅ Validates: DevelopmentId exists
- ✅ Captures: User ID from session
- ✅ Result: Forensic entry with admin metadata

### Update Development
- ✅ Requires: `session.user.role === 'ADMIN'`
- ✅ Validates: DevelopmentId exists
- ✅ Captures: User ID from session
- ✅ Result: DevelopmentEdit + Activity entries with admin metadata

### View Audit Trail
- ✅ Requires: Admin role for System Diagnostics
- ✅ Shows: All DevelopmentEdit records (granular)
- ✅ Shows: All Activity records (summary)
- ✅ Data: Includes admin who made change, timestamp, field names, values

---

## Error Handling

### Upload Errors
| Error | HTTP | Cause | Fix |
|-------|------|-------|-----|
| Unauthorized | 401 | Not authenticated | Login as admin |
| Admin only | 403 | Not admin role | Verify admin account |
| Invalid development | 400 | Dev ID missing/invalid | Pass x-development-id header |
| File too large | 400 | > size limit | Reduce file size (max 8MB) |

### Update Errors
| Error | HTTP | Cause | Fix |
|-------|------|-------|-----|
| Unauthorized | 401 | Not authenticated | Login as admin |
| Admin only | 403 | Not admin role | Verify admin account |
| Development not found | 404 | Invalid ID | Check developmentId exists |
| Bad request | 400 | Missing required field | Include developmentId |

---

## Best Practices

### ✅ DO
- Always pass `x-development-id` header in uploads
- Handle response.changes to show user what was updated
- Use System Diagnostics to audit all changes
- View DevelopmentEdit table for field-level forensics
- Implement optimistic UI updates while API processes

### ❌ DON'T
- Don't bypass permission checks
- Don't store plaintext sensitive data in Activity.description
- Don't assume changes succeeded without checking response.success
- Don't poll for completion - use proper async/await
- Don't update Development directly - use /api/developments/update

---

## Deployment Checklist

Before going to production:

1. **Database Migration**
   ```bash
   npx prisma migrate deploy
   ```

2. **Environment Variables**
   ```
   DATABASE_URL=postgresql://...neon.tech/...
   UPLOADTHING_TOKEN=sk_live_xxxxx
   ```

3. **Verification**
   - [ ] Can admin upload image
   - [ ] DevelopmentEdit record created
   - [ ] Activity log entry created
   - [ ] System Diagnostics shows entry
   - [ ] Can admin update development
   - [ ] Forensic audit trail displays changes

4. **Monitoring**
   - Watch server logs for upload errors
   - Monitor DevelopmentEdit table growth
   - Verify Activity records have complete metadata
   - Check System Diagnostics filters work

---

## Example Audit Workflow

```
1. Admin opens Development: "Westley Phase 1"
   ├─ Current basePrice: $150,000
   ├─ Current mainImage: https://cdn.old/image.jpg
   └─ Current geoJsonUrl: null

2. Admin uploads new image
   ├─ UploadThing saves to CDN: https://uploadthing/xyz.jpg
   ├─ DevelopmentEdit created:
   │  └─ mainImage: old→new URL
   ├─ Activity logged:
   │  └─ "Development [Westley Phase 1] updated by admin@..."
   └─ Development.mainImage = new URL

3. Admin updates basePrice to $175,000
   ├─ /api/developments/update called
   ├─ Change detected: 150000 → 175000
   ├─ DevelopmentEdit created:
   │  └─ basePrice: 150000→175000
   ├─ Activity logged:
   │  └─ "Development [Westley Phase 1] updated by admin@..."
   └─ Development.basePrice = 175000

4. Admin checks audit trail in System Diagnostics
   ├─ Activity table shows both updates
   ├─ DevelopmentEdit shows field-level changes
   ├─ Each entry has timestamp and admin email
   └─ Complete forensic record maintained
```

---

## File References

- **Schema**: `/prisma/schema.prisma` (DevelopmentEdit model)
- **UploadThing Router**: `/api/uploadthing/core.ts` (3 file routers)
- **Update API**: `/api/developments/update.ts` (diffing + logging)
- **System Diagnostics**: `/components/HealthDashboard.tsx` (or similar)

---

## Support

For issues, check:
1. `/api/uploadthing/core.ts` - Console logs for upload errors
2. `/api/developments/update.ts` - Console logs for update errors
3. Neon database - DevelopmentEdit table for forensic records
4. System Diagnostics - Activity table for audit summary
