# Stand Creation - User Guide

## Overview

The Development Wizard (Step 6) supports two methods for creating stands:

1. **GeoJSON Mapping** - Upload a GeoJSON file with stand boundaries
2. **Manual Numbering** - Automatically generate stands with sequential numbers

## How to Use Manual Stand Creation

### Step 1: Open Development Wizard

Navigate to **Admin Dashboard → Developments → Create New Development**

### Step 2: Fill Basic Information (Steps 1-5)

Complete the required fields:
- Development name
- Location
- Total stands
- Base pricing
- etc.

### Step 3: Choose Stand Creation Method (Step 6)

Click the **"Manual Numbering"** button (toggle)

### Step 4: Configure Manual Settings

#### Number of Stands
- Enter the total number of stands to create
- Example: `50` (will create 50 stands)

#### Numbering Format
- **Sequential** (recommended): 001, 002, 003...
- **Custom** (coming soon): A1, A2, B1, B2...

#### Stand Number Prefix (Optional)
- Add a prefix to all stand numbers
- Example: `SL` → creates SL001, SL002, SL003...
- Leave empty for: 001, 002, 003...

#### Starting Number
- First stand number
- Default: `1`
- Example: Start from `10` → creates 010, 011, 012...

#### Default Stand Size
- Size in square meters (sqm)
- Example: `500` → all stands will be 500 sqm
- Can be edited individually later

#### Default Stand Price
- Base price in USD
- Example: `45000` → all stands priced at $45,000
- Can be edited individually later

### Step 5: Preview

The wizard shows a preview of the first 5 stand numbers:
```
SL001  SL002  SL003  SL004  SL005  ... +45 more
```

### Step 6: Review & Submit (Step 8)

Check the **Stand Creation** section in the review step:

✅ **Manual Stand Numbering**
- Stands to Create: 50
- Format: Sequential
- Prefix: SL
- Starting Number: 1
- Default Size: 500 sqm
- Default Price: $45,000

Click **Create Development** to save.

---

## Example Configurations

### Example 1: Simple Sequential
```
Stands: 100
Format: Sequential
Prefix: (empty)
Start: 1
Size: 500 sqm
Price: $50,000

Result: 001, 002, 003, ... 100
```

### Example 2: With Prefix
```
Stands: 50
Format: Sequential
Prefix: SL
Start: 1
Size: 450 sqm
Price: $45,000

Result: SL001, SL002, SL003, ... SL050
```

### Example 3: Custom Start Number
```
Stands: 30
Format: Sequential
Prefix: PH2-
Start: 51
Size: 600 sqm
Price: $60,000

Result: PH2-051, PH2-052, PH2-053, ... PH2-080
```

---

## After Creation

Once the development is created:

1. **View Stands**: Navigate to **Inventory** module
2. **Filter**: Select your development from the dropdown
3. **Edit Individual Stands**: Click any stand to edit size, price, or status
4. **Reserve/Sell**: Change stand status from AVAILABLE to RESERVED or SOLD

---

## Switching Between Methods

### From GeoJSON to Manual
1. Click **Manual Numbering** button
2. ✅ GeoJSON data automatically cleared
3. Fill in manual configuration
4. Submit

### From Manual to GeoJSON
1. Click **GeoJSON Mapping** button
2. ✅ Manual configuration automatically cleared
3. Upload GeoJSON file
4. Submit

**Note**: The system automatically clears conflicting data when you switch modes to prevent errors.

---

## Troubleshooting

### Issue: No stands created after submission

**Check**:
1. Did you enter a stand count > 0?
2. Did you click the **Manual Numbering** button?
3. Check browser console for `[STAND_CREATION]` logs

**Solution**: 
- Ensure **Manual Numbering** button is highlighted
- Enter a valid stand count (1-10,000)
- Check console logs for errors

### Issue: Wrong stand numbers generated

**Check**:
1. Prefix field
2. Starting number
3. Total count

**Solution**: 
- Edit development and update stand configuration
- Or manually edit stands in Inventory module

### Issue: Warning about conflicting methods

**Meaning**: Both GeoJSON and Manual data exist

**Solution**: 
- Switch to your desired method (button will clear the other)
- Review Step 8 to verify correct method is active

---

## Best Practices

1. **Use Prefixes**: Makes stands easier to identify
   - Example: `SL` for St Lucia, `GS` for Greenstone

2. **Standard Sizing**: Use common sizes (300, 500, 800 sqm)

3. **Consistent Pricing**: Set reasonable default price per sqm

4. **Start from 1**: Unless you have a specific reason, start numbering from 1

5. **Review Before Submit**: Always check Step 8 (Review) before creating

---

## API Information (For Developers)

### Endpoint
```
POST /api/admin/stands
```

### Request Body
```json
{
  "developmentId": "dev-xxx",
  "standCount": 50,
  "numberingFormat": "sequential",
  "standNumberPrefix": "SL",
  "standNumberStart": 1,
  "defaultStandSize": 500,
  "defaultStandPrice": 45000
}
```

### Response
```json
{
  "data": {
    "created": 50,
    "developmentId": "dev-xxx",
    "branch": "Harare"
  },
  "error": null,
  "status": 201
}
```

---

## Support

For issues or questions:
1. Check browser console logs
2. Verify all fields are filled correctly
3. Contact system administrator if problem persists
