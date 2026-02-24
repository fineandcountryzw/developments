# Development Wizard Onboarding Checklist

A comprehensive checklist for adding a new real estate development to the system using the Development Wizard.

---

## STEP 1: BASIC INFORMATION

### Development Identity
- [ ] **Development Name** - Enter the official name of the development
- [ ] **Location** - Select from predefined Zimbabwe locations (Harare, Bulawayo, or regional towns)
- [ ] **Branch** - Assign to either Harare or Bulawayo branch
- [ ] **Development ID** - Auto-generated or manually specified (e.g., DEV-2025-001)

### Stand & Pricing Details
- [ ] **Total Number of Stands** - Specify total units in the development
- [ ] **Price Per Stand** - Set the base price in USD
- [ ] **Price Per Square Meter** - Define the cost per sqm (USD/m²)

### Development Phase
- [ ] **Estate Progress Status** - Select one:
  - [ ] Under Construction / Servicing
  - [ ] Ready to Build
  - [ ] Completed

---

## STEP 2: ESTATE INFRASTRUCTURE PROGRESS

Track detailed infrastructure milestones (Infrastructure Progress Status options for each):
- Not Started
- Planned
- In Progress
- Completed

### Infrastructure Components
- [ ] **Roads** - Status of road construction/tarring
- [ ] **Water Supply** - Borehole/municipal water status
- [ ] **Sewage System** - Wastewater management status
- [ ] **Electricity** - Power grid/solar installation status

### Regulatory Compliance
- [ ] **Compliance Status** - Select one:
  - [ ] Pending
  - [ ] Submitted
  - [ ] Approved
  - [ ] Rejected

---

## STEP 3: STAND CONFIGURATION

### Stand Size Categories
- [ ] **Small Stands** - Define size in sqm (e.g., 400-500 sqm)
- [ ] **Medium Stands** - Define size in sqm (e.g., 500-700 sqm)
- [ ] **Large Stands** - Define size in sqm (e.g., 700+ sqm)

### Stand Types
Select all applicable types:
- [ ] Residential
- [ ] Commercial
- [ ] Institutional

### Amenities & Features
Select all applicable features from the development:
- [ ] Swimming Pool
- [ ] Clubhouse
- [ ] 24/7 Security
- [ ] Borehole Water
- [ ] Tarred Roads
- [ ] Street Lights
- [ ] Fibre Internet
- [ ] Playground
- [ ] Tennis Court
- [ ] Gym
- [ ] Shopping Centre
- [ ] School Nearby
- [ ] Hospital Nearby
- [ ] Solar Power
- [ ] Sewage System
- [ ] Perimeter Wall
- [ ] *Custom features* (add as needed)

---

## STEP 4: MEDIA & DOCUMENTS

### Images
- [ ] **Upload Development Images** - Add 3-5 promotional images
  - Front entrance photo
  - Master plan overview
  - Completed stands/infrastructure
  - Amenity areas
  - Site progress photos
- [ ] **Image Quality** - Ensure high-resolution images (minimum 1200x800px)

### Documents
- [ ] **Master Plan** - PDF/Image of development layout
- [ ] **Compliance Documents** - Regulatory approvals
- [ ] **Technical Specifications** - Engineering reports or plans
- [ ] **Marketing Materials** - Brochures, pamphlets (optional)
- [ ] **Promotional Videos** - Links to video content (optional)

---

## STEP 5: COMMISSION CONFIGURATION

### Commission Model Selection
- [ ] **Commission Type** - Choose one:
  - [ ] Fixed Amount (recommend $1,000)
  - [ ] Percentage (recommend 5%)

### Fixed Amount Model
- [ ] **Fixed Commission** - Set amount in USD (e.g., $1,000)

### Percentage Model
- [ ] **Commission Percentage** - Set percentage (e.g., 5%)

---

## STEP 6: STAND MAPPING & CREATION

Choose ONE approach:

### Option A: GeoJSON Upload
- [ ] **GeoJSON File** - Prepare file with stand polygons and properties
- [ ] **Stand Number Property** - Ensure each feature has `stand_number` property
- [ ] **Coordinate System** - Validate coordinates (WGS84 recommended)
- [ ] **Upload GeoJSON** - Load the file
- [ ] **Validate Mapping** - Verify stands display on interactive map
- [ ] **Stand Count Verification** - Confirm count matches total stands specified

### Option B: Manual Stand Creation
- [ ] **Enable Manual Creation** - Toggle from GeoJSON to manual mode
- [ ] **Numbering Format** - Select:
  - [ ] Sequential (1, 2, 3...)
  - [ ] Custom (with prefix)
  
#### If Sequential
- [ ] **Stand Prefix** - Enter prefix (e.g., 'SL' for SL001)
- [ ] **Start Number** - Set starting number (default 1)

#### If Custom
- [ ] **Define Custom Pattern** - Specify numbering scheme

### Common Settings for Both
- [ ] **Number of Stands to Create** - Confirm matches total stands
- [ ] **Default Stand Size** - Set size in sqm for automated creation
- [ ] **Default Stand Price** - Set base price in USD
- [ ] **Preview Generated Stands** - Review before final creation

---

## STEP 7: DEVELOPMENT OVERVIEW

### Description & Marketing
- [ ] **Development Overview** - Write 200-500 character summary
  - Include: location, stand count, target market
  - Highlight: unique features, infrastructure status
  - Example: "Premium 450-stand residential estate in Harare North with full services including tarred roads, 24/7 security, fiber internet and clubhouse facilities."

---

## ADDITIONAL CONFIGURATION: FEES & CHARGES

### Value-Added Tax (VAT)
- [ ] **VAT Enabled** - Toggle to apply 15.5% VAT
- [ ] **Pricing Impact** - Confirm final stand prices with VAT included

### Endowment Fee
- [ ] **Endowment Fee Enabled** - Toggle to enable
- [ ] **Fee Amount** - Confirm percentage or fixed amount

### Agreement of Sale (AOS)
- [ ] **AOS Fee Enabled** - Toggle to enable
- [ ] **AOS Fee Amount** - Set fixed fee (recommend $500)

### Cession Fees
- [ ] **Cession Fees Enabled** - Toggle to enable
- [ ] **Cession Fee Amount** - Set fixed fee (recommend $250)

---

## DEVELOPER INFORMATION (For Reports)

- [ ] **Developer Name** - Full name of development company/individual
- [ ] **Developer Email** - Contact email for inquiries
- [ ] **Developer Phone** - Contact phone number

---

## FINAL REVIEW BEFORE SUBMISSION

- [ ] All required fields completed
- [ ] Development name is unique and descriptive
- [ ] Pricing is competitive and realistic
- [ ] Stand configuration matches total stands
- [ ] All stands created/mapped successfully
- [ ] Images uploaded and visible
- [ ] Commission model configured
- [ ] Fee configuration reviewed and approved
- [ ] Overview text is professional and marketing-ready
- [ ] Infrastructure progress is accurately reflected
- [ ] Features/amenities list is complete
- [ ] Developer contact information is correct

---

## POST-CREATION VERIFICATION

- [ ] Development appears in admin dashboard
- [ ] Stand inventory matches specified total
- [ ] Interactive map displays all stands
- [ ] Pricing calculations are correct
- [ ] Images display in development profile
- [ ] Commission calculations apply correctly
- [ ] Development is visible to agents/clients
- [ ] Payment/installment calculations include correct fees

---

## COMMON ISSUES & SOLUTIONS

| Issue | Solution |
|-------|----------|
| GeoJSON upload fails | Validate JSON format, ensure WGS84 coordinates |
| Stand count mismatch | Verify total stands vs. created stands in manual creation |
| Images not displaying | Check image format (JPG/PNG), size, and upload status |
| Pricing appears incorrect | Verify VAT, endowment, and fee settings are configured correctly |
| Commission not calculating | Confirm commission type is set and percentage/amount is valid |
| Map not loading | Ensure stands have valid coordinates, clear browser cache |

---

## WIZARD WORKFLOW SUMMARY

```
Step 1: Basic Info
  ↓
Step 2: Infrastructure Progress
  ↓
Step 3: Stand Configuration
  ↓
Step 4: Media & Documents
  ↓
Step 5: Commission
  ↓
Step 6: Stand Mapping (GeoJSON OR Manual)
  ↓
Step 7: Overview
  ↓
REVIEW & SUBMIT
  ↓
DEVELOPMENT LIVE
```

---

## REVISION HISTORY

| Date | Version | Changes |
|------|---------|---------|
| 2026-01-16 | 1.0 | Initial onboarding checklist created |

