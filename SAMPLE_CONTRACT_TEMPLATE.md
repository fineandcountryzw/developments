# Sample Contract Template Guide

This document shows how to create a properly formatted DOCX contract template that uses the ERP system's variable placeholders.

---

## Client Name Variables

The following client variables are available and **must be included** in your contract template:

| Variable | Description | Example |
|----------|-------------|---------|
| `{{client.fullName}}` | **Client's full name** | "John Smith" |
| `{{client.firstName}}` | Client's first name | "John" |
| `{{client.lastName}}` | Client's last name | "Smith" |
| `{{client.email}}` | Client's email address | "john@example.com" |
| `{{client.phone}}` | Client's phone number | "+263 77 123 4567" |
| `{{client.nationalId}}` | Client's national ID | "63-1234567A89" |

---

## Sample Contract Template Content

Below is a sample contract template with **client name** and all other required placeholders. Create a Word document with this content:

```
AGREEMENT FOR SALE OF STAND

This Agreement is made on {{contract.date}}

BETWEEN:

ABC DEVELOPERS (PVT) LTD (the "Seller")
Registration Number: 1234/2024
Address: 123 Main Street, Harare, Zimbabwe

AND

{{client.fullName}} (the "Buyer")
{{#if client.nationalId}}National ID: {{client.nationalId}}{{/if}}
{{#if client.address}}Address: {{client.address}}{{/if}}
Email: {{client.email}}
Phone: {{client.phone}}

1. PROPERTY DETAILS

The Seller agrees to sell and the Buyer agrees to purchase the following property:

Stand Number: {{stand.number}}
Development: {{development.name}}
Location: {{development.location}}
Size: {{stand.sizeSqm}} square meters

2. PURCHASE PRICE

The total purchase price for the property is: {{pricing.grandTotal}}

3. PAYMENT TERMS

3.1 Deposit: {{terms.depositPercentage}}% ({{pricing.depositAmount}})
3.2 VAT: {{terms.vatEnabled}} ({{terms.vatPercentage}}%)

{{#if terms.endowmentEnabled}}
3.3 Endowment Fee: {{terms.endowmentFee}}
{{/if}}

{{#if terms.aosEnabled}}
3.4 AOS Fee: {{terms.aosFee}}
{{/if}}

4. SIGNATURES

SIGNED by the parties hereto:

_____________________________          _____________________________
{{client.fullName}}                    {{development.developerName}}
Buyer                                   Seller / Developer
Date: _____________                    Date: _____________

_____________________________          _____________________________
Witness                                 Witness
Name: ______________                   Name: ______________

---

DEVELOPER DETAILS:
Name: {{development.developerName}}
Email: {{development.developerEmail}}
Phone: {{development.developerPhone}}

LEGAL REPRESENTATIVE:
Name: {{development.lawyerName}}
Email: {{development.lawyerEmail}}
Phone: {{development.lawyerPhone}}
```

---

## Required Variables Summary

### Client Section (Must Include)
- ✅ `{{client.fullName}}` - **REQUIRED** - The buyer's full legal name

### Stand Section
- `{{stand.number}}` - Stand/Plot number
- `{{stand.price}}` - Base price
- `{{stand.sizeSqm}}` - Size in square meters

### Development Section
- `{{development.name}}` - Estate/Development name
- `{{development.location}}` - Physical location
- `{{development.developerName}}` - Developer company name
- `{{development.developerEmail}}` - Developer contact email
- `{{development.developerPhone}}` - Developer contact phone
- `{{development.lawyerName}}` - Conveyancing lawyer name
- `{{development.lawyerEmail}}` - Lawyer email
- `{{development.lawyerPhone}}` - Lawyer phone

### Terms Section
- `{{terms.depositPercentage}}` - Deposit percentage (e.g., "30")
- `{{terms.vatEnabled}}` - "Yes" or "No"
- `{{terms.vatPercentage}}` - VAT percentage (e.g., "15")
- `{{terms.endowmentEnabled}}` - "Yes" or "No"
- `{{terms.endowmentFee}}` - Endowment fee amount
- `{{terms.aosEnabled}}` - "Yes" or "No"
- `{{terms.aosFee}}` - AOS fee amount

### Pricing Section
- `{{pricing.grandTotal}}` - Total price including VAT and fees
- `{{pricing.depositAmount}}` - Deposit amount
- `{{pricing.vatAmount}}` - VAT amount
- `{{pricing.balanceAfterDeposit}}` - Balance after deposit

### Contract Section
- `{{contract.date}}` - Current date (formatted)
- `{{contract.id}}` - Contract reference number
- `{{contract.timestamp}}` - Full timestamp

---

## How to Use This Template

### Step 1: Create the DOCX File
1. Open Microsoft Word
2. Create a new document
3. Apply professional formatting:
   - Font: Times New Roman, 12pt
   - Margins: 1 inch all sides
   - Line spacing: 1.5

### Step 2: Insert Placeholders
Copy the placeholders from above and insert them exactly as shown:
- Use `{{variableName}}` for simple replacement
- Use `{{#if field}}...{{/if}}` for conditional sections (optional)

### Step 3: Upload to ERP
1. Go to Admin > Contract Templates
2. Upload the DOCX file
3. The system will auto-detect all variables

### Step 4: Generate Contract
When generating a contract:
1. Select the stand (which has a reserved client)
2. Select the DOCX template
3. The system will replace all `{{client.fullName}}` etc. with actual data

---

## Important Notes

1. **Client Name is Required**: The system will fail if `{{client.fullName}}` is used but no client is associated with the stand reservation.

2. **Variable Case Sensitive**: All variables are case-sensitive. Use exactly `{{client.fullName}}`, not `{{Client.FullName}}` or `{{client.FullName}}`.

3. **Whitespace**: Do not add extra spaces inside the braces. Use `{{client.fullName}}`, not `{{ client.fullName }}`.

4. **Testing**: Always preview a contract before generating the final version to ensure all placeholders are replaced correctly.

---

## Troubleshooting

### Client Name Not Appearing?
- Verify the stand has a reservation with a confirmed client
- Check that the client has a name in the system
- Use preview mode to see resolved data

### Variables Not Replacing?
- Ensure variable names match exactly (check for typos)
- Verify the template was uploaded as DOCX (not HTML)
- Check the template is marked as "docx" type in the system

### PDF Output Poor Quality?
- Use LibreOffice to convert DOCX → PDF (better than HTML → PDF)
- Ensure the DOCX template has proper formatting before conversion
