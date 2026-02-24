# ⚡ FORENSIC FIX – QUICK REFERENCE CARD

## 🎯 What Was Broken & Fixed

| Issue | Was | Now |
|-------|-----|-----|
| Save Development | ❌ Returns null | ✅ Persists to memory + logs |
| Upload Image | ❌ No DB record | ✅ Saves media record + logs |
| Error Messages | ❌ Generic | ✅ Detailed codes (23502, 42P01, etc) |
| Debugging | ❌ Black box | ✅ Full [FORENSIC] console logs |

---

## 🔧 Browser Console Commands

**Open DevTools**: F12 → Console tab

```javascript
// View all forensic operations
window.forensicLog.show()

// View only database mutations
window.forensicLog.filter('DB MUTATION')

// View only upload operations
window.forensicLog.filter('UPLOAD')

// View only errors
window.forensicLog.errors()

// Export all logs as JSON (to copy/save)
copy(window.forensicLog.export())
```

---

## ✅ Testing Flow

### 1. Save Development
```
Click Save → Check Console:
  [FORENSIC][SAVE FORM]      ← Form submitted
  [FORENSIC][DB MUTATION]    ← DB operation
  [FORENSIC][DB RESPONSE]    ← Success (rows_affected: 1)
```

### 2. Upload Image
```
Drag/Select File → Check Console:
  [FORENSIC][UPLOAD START]          ← Upload begins
  [FORENSIC][UPLOAD SUCCESS]        ← File stored
  [FORENSIC][PUBLIC URL RETRIEVED]  ← URL ready
  [FORENSIC][MEDIA RECORD SAVED]    ← DB saved
  [FORENSIC][DB RESPONSE]           ← Dev updated
```

### 3. If Error
```
[FORENSIC][DB ERROR] OR [FORENSIC][UPLOAD FATAL]
Look at "code" and "message" fields
```

---

## 🚨 Common Errors & Fixes

| Error | Cause | Fix |
|-------|-------|-----|
| `23502` | Missing required field | Fill all mandatory fields in form |
| `42P01` | Table missing | Initialize database (contact admin) |
| `BUCKET_NOT_FOUND` | No storage bucket | Create 'logos' + 'media' buckets |
| `PAYLOAD_TOO_LARGE` | File > 15MB | Use file < 15MB |
| `Format Restricted` | Wrong file type | Use .jpg, .png, or .webp only |

---

## 📋 Testing Checklist

- [ ] **Save Development**: Create entry → click Save → check console for `rows_affected: 1`
- [ ] **Upload Logo**: Select file → drag to dropzone → check for `PUBLIC URL RETRIEVED`
- [ ] **Upload Render**: Upload 3+ images → each should log independently
- [ ] **Error Test**: Upload 20MB+ file → should see `PAYLOAD_TOO_LARGE`
- [ ] **Persistence**: Save dev → refresh page → data gone (expected in mock)

---

## 📊 Data Flow (Visualized)

```
┌─────────────────┐
│   USER ACTION   │  (Save / Upload)
└────────┬────────┘
         │
         ↓
┌─────────────────────────────┐
│ [FORENSIC][SAVE FORM]       │  ← Console log 1
│ Form data captured          │
└────────┬────────────────────┘
         │
         ↓
┌─────────────────────────────┐
│ [FORENSIC][DB MUTATION]     │  ← Console log 2
│ INSERT/UPDATE to DB         │
└────────┬────────────────────┘
         │
         ↓
   ┌─────────────────────────────┐
   │ DATABASE OPERATION          │
   │ • Validates fields (23502?) │
   │ • Checks unique (23505?)    │
   │ • Inserts row               │
   └────────┬────────────────────┘
            │
         ┌──┴──┐
         │     │
       ✅OK  ❌ERROR
         │     │
         ↓     ↓
      [RESPONSE] [ERROR]
      rows_affected: 1  code: 23502
         │              │
         ↓              ↓
      SUCCESS        SHOW ERROR
```

---

## 🔐 Data Persistence Notes

**Current (Mock)**
- ✅ Data persists during session
- ✅ Full error tracking
- ⚠️ Lost on page refresh

**When Using Real Supabase**
- ✅ Data persists permanently
- ✅ RLS policies enforce security
- ✅ Forensic logs can be saved to DB

---

## 📞 Support Reference

**If stuck**, provide:**
1. Screenshot of error message
2. Output of `window.forensicLog.errors()`
3. Development ID you were saving
4. File size (if uploading)

---

## 🎬 Action Items

- [ ] Test all 3 flows (Save, Upload Logo, Upload Renders)
- [ ] Review console logs
- [ ] Check FORENSIC_DEBUG_GUIDE.md for details
- [ ] When ready, connect real Supabase

---

**Version**: 1.0  
**Updated**: December 27, 2025  
**Status**: ✅ Production Ready (Mock)
