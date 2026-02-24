# Manual Stand Creation - Quick Reference

## 🚀 Quick Start

### Create Development with Manual Stands:

1. **Admin Dashboard** → Developments → **New Development**
2. Fill Steps 1-5 (Basic Info, Infrastructure, Stand Config, Media, Commission)
3. **Step 6 - Stand Creation**:
   - Toggle: **Manual Numbering**
   - Number of Stands: `50`
   - Prefix: `SL` (optional)
   - Starting Number: `1`
   - Default Size: `500` sqm
   - Default Price: `$45000`
4. Preview shows: `SL001, SL002, SL003... +47 more`
5. Complete Steps 7-8, Submit
6. **Result**: 50 stands created automatically (SL001-SL050)

---

## 📡 API Quick Reference

### Bulk Create Stands
```bash
POST /api/admin/stands
{
  "developmentId": "dev-xxx",
  "standCount": 50,
  "standNumberPrefix": "SL",
  "standNumberStart": 1,
  "defaultStandSize": 500,
  "defaultStandPrice": 45000
}
```

### Get Next Available Stand
```bash
GET /api/admin/stands?developmentId=dev-xxx&nextAvailable=true&branch=Harare

# Returns lowest available stand number (sequential)
```

---

## 🎯 Key Features

| Feature | Description |
|---------|-------------|
| **Sequential Numbering** | Stands numbered 001, 002, 003... |
| **Custom Prefix** | Optional prefix (e.g., SL001, BB001) |
| **Bulk Creation** | Create hundreds of stands in seconds |
| **Next Available API** | Auto-allocate lowest available number |
| **Inventory Sorted** | Always displays by stand_number ASC |
| **No GeoJSON Required** | Perfect for developments without mapping |

---

## 🔄 Reservation Flow

**Without GeoJSON:**
1. Client clicks "Reserve Stand" (no specific plot selection)
2. System fetches next available: `GET /api/admin/stands?nextAvailable=true`
3. Returns stand `SL001` (lowest available)
4. Client confirms → Stand `SL001` → `RESERVED`
5. Next client gets `SL002` automatically

**Sequential Allocation** = Fair, predictable, easy to manage

---

## 📊 Stand Number Format

**Pattern**: `[PREFIX][NUMBER]`

Examples:
- No prefix: `001, 002, 003`
- With prefix: `SL001, SL002, SL003`
- Custom prefix: `BB001, BB002, BB003`

**Rules:**
- Numbers padded to 3 digits (001-999)
- Max 9999 stands per development
- Prefix: Up to 5 characters (uppercase)

---

## ✅ Validation

**Stand Creation:**
- ✅ Development must exist
- ✅ Stand count: 1-10000
- ✅ No duplicate stand numbers per development
- ✅ Price/size must be numeric

**Next Available:**
- ✅ Must have `developmentId`
- ✅ Returns 404 if no available stands
- ✅ Orders by `standNumber ASC`

---

## 🛠️ Troubleshooting

**No stands showing in Inventory?**
1. Check if stands were created: `SELECT COUNT(*) FROM stands WHERE development_id = 'dev-xxx';`
2. Check API response: `GET /api/admin/stands?branch=Harare`
3. Verify branch filter matches

**Next available not working?**
1. Check if any stands are AVAILABLE: `SELECT * FROM stands WHERE status = 'AVAILABLE' AND development_id = 'dev-xxx';`
2. Test API: `GET /api/admin/stands?developmentId=dev-xxx&nextAvailable=true`
3. Check console logs for errors

**Duplicate stand numbers?**
- Database constraint prevents duplicates
- Error: "Unique constraint failed: stands_development_id_stand_number_key"
- Solution: Change prefix or starting number

---

## 📁 Files to Know

| File | Purpose |
|------|---------|
| `DevelopmentWizard.tsx` | Manual stand creation UI (Step 6) |
| `AdminDevelopments.tsx` | Handles wizard submission + API calls |
| `app/api/admin/stands/route.ts` | POST (create) + GET (next available) |
| `Inventory.tsx` | Displays stands sorted by number |

---

## 🧪 Testing Commands

```sql
-- Check created stands
SELECT stand_number, status, price, size_sqm 
FROM stands 
WHERE development_id = 'dev-xxx' 
ORDER BY stand_number;

-- Get next available
SELECT stand_number FROM stands 
WHERE development_id = 'dev-xxx' AND status = 'AVAILABLE' 
ORDER BY stand_number ASC 
LIMIT 1;

-- Reset all to available
UPDATE stands 
SET status = 'AVAILABLE' 
WHERE development_id = 'dev-xxx';
```

---

## 🎨 UI States

**Manual Numbering Toggle:**
```
[ GeoJSON Mapping ]  [ Manual Numbering ✓ ]
```

**Form Fields:**
```
Number of Stands: [____50____]
Format:           [Sequential ✓] [Custom]
Prefix:           [___SL___] (optional)
Starting Number:  [____1____]
Default Size:     [___500___] sqm
Default Price:    [__45000__] USD
```

**Preview:**
```
📋 Stand Number Preview:
[SL001] [SL002] [SL003] [SL004] [SL005] ... +45 more
```

---

## 🚦 Status Flow

```
AVAILABLE → (Client reserves) → RESERVED → (Payment verified) → SOLD
    ↑                                           ↓
    └─────────── (72hrs expire) ────────────────┘
```

---

## 💡 Best Practices

1. **Use Sequential for Most Cases** - Simplest and most predictable
2. **Add Meaningful Prefixes** - e.g., "SL" for St Lucia, "BB" for Borrowdale
3. **Set Reasonable Defaults** - Avoid needing to edit individual stands later
4. **Test Next Available** - Before launching reservations
5. **Monitor Inventory** - Regularly check available vs reserved counts

---

## 📞 Support

**Questions?** Check:
- [MANUAL_STAND_CREATION_COMPLETE.md](MANUAL_STAND_CREATION_COMPLETE.md) - Full documentation
- [INVENTORY_EMPTY_AUDIT.md](INVENTORY_EMPTY_AUDIT.md) - Why inventory was empty
- API logs: `[INVENTORY][API]` and `[STAND_CREATION]`

---

**Last Updated**: January 14, 2026  
**Status**: Production Ready ✅
