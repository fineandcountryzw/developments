# Forensic Debugging Guide – Development Persistence & Image Uploads

## Browser Console Forensic Logging

All database and storage operations are now instrumented with detailed console logging prefixed with `[FORENSIC]`.

### Log Format

```
[FORENSIC][OPERATION_TYPE] Operation description
{
  field1: value1,
  field2: value2,
  timestamp: ISO_8601
}
```

### Operation Types

- `[FORENSIC][SAVE FORM]` – User submitted the development form
- `[FORENSIC][DB MUTATION]` – INSERT/UPDATE database operation initiated
- `[FORENSIC][DB QUERY]` – SELECT/GET database query
- `[FORENSIC][DB RESPONSE]` – Database confirmed the operation (rows_affected)
- `[FORENSIC][DB ERROR]` – Database rejected the operation (error code + message)
- `[FORENSIC][UPLOAD START]` – File upload initiated
- `[FORENSIC][UPLOAD SUCCESS]` – File reached S3/Supabase Storage
- `[FORENSIC][STORAGE ERROR]` – Storage bucket error (e.g., "Bucket not found")
- `[FORENSIC][PUBLIC URL RETRIEVED]` – getPublicUrl() returned a signed URL
- `[FORENSIC][MEDIA RECORD SAVED]` – development_media table INSERT succeeded
- `[FORENSIC][UPLOAD FATAL]` – Unrecoverable upload error

---

## Step-by-Step Testing Flow

### Test 1: Save Development (No Images)

1. **Open Admin Developments Tab**
2. **Create a new development** or edit existing one
3. **Fill in all mandatory fields**:
   - Name of Development
   - Branch (Harare/Bulawayo)
   - Total Stands
   - Starting Price

4. **Click "Save"** and watch the browser console (F12 → Console tab)

**Expected Log Sequence**:
```
[FORENSIC][SAVE FORM] Development master entry submitted
  → development_id, name, branch, base_price
  
[FORENSIC][DB MUTATION] UPDATE development
  → id, fields_updated: [array of fields]
  
[FORENSIC][DB RESPONSE] Development synchronized
  → rows_affected: 1
  
[FORENSIC][REFRESH DATA] Fetching updated developments list

[FORENSIC][DB QUERY] GET /developments
  → results: X (count of developments)
```

**If you see an error**:
```
[FORENSIC][DB ERROR]
{
  code: "23502" (or other PostgreSQL code),
  message: "A required field is missing",
  development_id: "dev-xxx"
}
```

---

### Test 2: Upload Logo Image

1. **Open Admin Developments → Select a Development → Media Tab**
2. **Click "Upload Logo" or drag a .jpg/.png file**

**Expected Log Sequence**:
```
[FORENSIC][UPLOAD START]
  → development_id, file_name, file_size, bucket, path
  
[FORENSIC][UPLOAD SUCCESS]
  → bucket, path, data
  
[FORENSIC][PUBLIC URL RETRIEVED]
  → url: "https://...", category: "LOGO"
  
[FORENSIC][MEDIA RECORD SAVED]
  → media_id, rows_affected: 1
  
[FORENSIC][DB MUTATION] UPDATE development with media
  → development_id, category, url
  
[FORENSIC][DB RESPONSE] Development updated with media
  → rows_affected: 1
```

**If upload fails**:
```
[FORENSIC][STORAGE ERROR]
{
  code: "BUCKET_NOT_FOUND" | "PAYLOAD_TOO_LARGE",
  message: "Bucket 'logos' does not exist",
  bucket: "logos",
  path: "logos/HRE_Project_Logo_2025.jpg"
}
```

---

### Test 3: Upload Render Images (Multiple)

1. **Same as Test 2, but upload multiple .jpg files in Media Tab**
2. **Watch console for each file**

**Expected**: Each file uploads separately, creating multiple [FORENSIC][MEDIA RECORD SAVED] logs

---

## Error Codes Reference

| Code | Meaning | Fix |
|------|---------|-----|
| `23502` | NOT NULL constraint – required field missing | Add the missing field in form validation |
| `23505` | UNIQUE constraint – duplicate ID | Check if development.id already exists in DB |
| `42P01` | Table does not exist | Database schema not initialized |
| `BUCKET_NOT_FOUND` | S3/Supabase bucket missing | Create 'logos' and 'media' buckets in Supabase console |
| `PAYLOAD_TOO_LARGE` | File > 15MB | Reduce file size (max 15MB per settings) |

---

## Copy-Paste: Console Filtering

To focus on forensic logs only in the browser console:

```javascript
// Filter to show only forensic logs
const forensicLogs = JSON.parse(localStorage.getItem('forensicLogs') || '[]');
console.table(forensicLogs);

// Or in Chrome DevTools filter box:
// Type: [FORENSIC]
```

---

## Pushing Changes with Forensic Logs

Once debugging is complete and issues are resolved:

```bash
cd /Users/b.b.monly/Downloads/fine-\&-country-zimbabwe-erp

git add services/supabase.ts components/MediaManager.tsx components/AdminDevelopments.tsx

git commit -m "Forensic fix: Add comprehensive logging and data persistence for developments and media uploads"

git push origin main
```

---

## Real Supabase Connection (Future)

Once you connect to a real Supabase project:

1. Replace `supabaseMock` calls with actual `supabase` client
2. Remove the in-memory MOCK_DEVELOPMENTS array
3. All console logs will persist, helping with production debugging
4. Add a `logForensicEvent()` function to write logs to a `forensic_logs` table

Example:
```typescript
const logForensicEvent = async (event: string, data: any) => {
  await supabase
    .from('forensic_logs')
    .insert([{ event, data, created_at: new Date().toISOString() }]);
};
```

---

**Last Updated**: December 27, 2025
**Version**: 1.0 Forensic Debug Guide
