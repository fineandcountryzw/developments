# Fine & Country Zimbabwe ERP - Comprehensive Test Plan

**Version:** 1.0  
**Date:** January 26, 2026  
**Application Version:** v2.7.0-MOBILE  
**Status:** Production Testing Plan

---

## 📋 Executive Summary

This test plan provides comprehensive testing coverage for the Fine & Country Zimbabwe ERP system. The plan covers functional, integration, security, performance, and user acceptance testing across all 17 core modules, 6 user roles, and 2 branches.

---

## 🎯 Test Objectives

1. **Functional Verification:** Ensure all features work as specified
2. **Role-Based Access Control:** Verify proper permissions for each user role
3. **Data Integrity:** Validate data consistency across modules
4. **Security:** Test authentication, authorization, and data protection
5. **Performance:** Verify system performance under load
6. **Mobile Compatibility:** Test mobile-responsive features
7. **Integration:** Validate API endpoints and data flow
8. **User Experience:** Ensure intuitive and accessible UI/UX

---

## 🧪 Test Strategy

### Test Levels
1. **Unit Tests** - Component and function-level testing
2. **Integration Tests** - API and module integration testing
3. **System Tests** - End-to-end workflow testing
4. **User Acceptance Tests** - Business scenario validation
5. **Security Tests** - Authentication and authorization
6. **Performance Tests** - Load and stress testing
7. **Mobile Tests** - Responsive design and touch interactions

### Test Approach
- **Manual Testing:** User workflows, UI/UX validation
- **Automated Testing:** API endpoints, critical paths
- **Exploratory Testing:** Edge cases and error scenarios
- **Regression Testing:** Verify existing features after changes

---

## 👥 User Roles & Test Coverage

### 1. ADMIN Role
- Full system access
- User management
- System configuration
- Audit trail access
- All module access

### 2. MANAGER Role
- Branch management
- Approval workflows
- Team performance
- Reports and analytics
- Limited admin functions

### 3. AGENT Role
- Client management
- Pipeline management
- Commission tracking
- Property reservations
- Limited to own data

### 4. ACCOUNT Role
- Financial operations
- Payment processing
- Receipt generation
- Reconciliation
- Financial reports

### 5. CLIENT Role
- Portfolio view
- Payment history
- Reservation status
- Document access
- Read-only access

### 6. DEVELOPER Role
- Development-specific access
- Stand management
- Developer reports
- Limited client data

---

## 📊 Module Testing Matrix

### Module 1: Authentication & Authorization

#### Test Cases

**TC-AUTH-001: User Login**
- **Preconditions:** Valid user account exists
- **Steps:**
  1. Navigate to `/login`
  2. Enter valid email and password
  3. Click "Sign In"
- **Expected:** User redirected to role-appropriate dashboard
- **Priority:** Critical

**TC-AUTH-002: Invalid Credentials**
- **Preconditions:** User account exists
- **Steps:**
  1. Enter invalid password
  2. Click "Sign In"
- **Expected:** Error message displayed, no redirect
- **Priority:** High

**TC-AUTH-003: Google OAuth Login**
- **Preconditions:** Google OAuth configured
- **Steps:**
  1. Click "Sign in with Google"
  2. Complete Google authentication
- **Expected:** User created/authenticated, redirected to dashboard
- **Priority:** Medium

**TC-AUTH-004: Session Expiry**
- **Preconditions:** User logged in
- **Steps:**
  1. Wait 30 days (or manually expire session)
  2. Attempt to access protected route
- **Expected:** Redirected to login page
- **Priority:** High

**TC-AUTH-005: Role-Based Redirect**
- **Preconditions:** User with specific role logged in
- **Steps:**
  1. Access `/dashboards/admin` as Agent
- **Expected:** Redirected to `/dashboards/agent`
- **Priority:** Critical

**TC-AUTH-006: Password Reset Flow**
- **Preconditions:** User account exists
- **Steps:**
  1. Click "Forgot Password"
  2. Enter email
  3. Check email for reset link
  4. Set new password
- **Expected:** Password reset successfully
- **Priority:** High

**TC-AUTH-007: Inactive User Login**
- **Preconditions:** User account is inactive
- **Steps:**
  1. Attempt to login with inactive account
- **Expected:** Login denied with appropriate message
- **Priority:** High

---

### Module 2: Developments Management

#### Test Cases

**TC-DEV-001: Create Development**
- **Preconditions:** Admin user logged in
- **Steps:**
  1. Navigate to Developments
  2. Click "Create Development"
  3. Fill all required fields
  4. Upload images
  5. Save
- **Expected:** Development created successfully
- **Priority:** Critical

**TC-DEV-002: Development Wizard - Multi-Step**
- **Preconditions:** Admin user logged in
- **Steps:**
  1. Start development wizard
  2. Complete Step 1: Basic Info
  3. Complete Step 2: Location & Description
  4. Complete Step 3: Pricing
  5. Complete Step 4: Stands
  6. Complete Step 5: Images & Documents
  7. Submit
- **Expected:** All steps completed, development saved
- **Priority:** Critical

**TC-DEV-003: Edit Development**
- **Preconditions:** Development exists
- **Steps:**
  1. Open development
  2. Edit name, price, or description
  3. Save changes
- **Expected:** Changes saved, audit trail created
- **Priority:** High

**TC-DEV-004: Delete Development**
- **Preconditions:** Development with no stands/reservations
- **Steps:**
  1. Open development
  2. Click delete
  3. Confirm deletion
- **Expected:** Development deleted, audit log created
- **Priority:** Medium

**TC-DEV-005: Branch Filtering**
- **Preconditions:** Developments exist in both branches
- **Steps:**
  1. Switch branch to Harare
  2. View developments
  3. Switch branch to Bulawayo
  4. View developments
- **Expected:** Only branch-specific developments shown
- **Priority:** Critical

**TC-DEV-006: GeoJSON Map Display**
- **Preconditions:** Development with GeoJSON data
- **Steps:**
  1. Open development
  2. View map
- **Expected:** Map displays correctly with stand locations
- **Priority:** Medium

**TC-DEV-007: Image Gallery**
- **Preconditions:** Development with images
- **Steps:**
  1. Open development
  2. View gallery
  3. Upload new image
- **Expected:** Images display correctly, new image uploaded
- **Priority:** Medium

**TC-DEV-008: Fee Calculation**
- **Preconditions:** Development with fees configured
- **Steps:**
  1. Create development with VAT, Endowment, AOS, Cession enabled
  2. View fee breakdown for a stand
- **Expected:** All fees calculated correctly
- **Priority:** Critical

---

### Module 3: Inventory & Stands

#### Test Cases

**TC-STAND-001: Create Stand**
- **Preconditions:** Development exists
- **Steps:**
  1. Open development
  2. Add new stand
  3. Enter stand number, price, size
  4. Save
- **Expected:** Stand created successfully
- **Priority:** Critical

**TC-STAND-002: Stand Status Management**
- **Preconditions:** Stand exists
- **Steps:**
  1. Change stand status from Available to Reserved
  2. Change to Sold
  3. Change to Withdrawn
- **Expected:** Status updates correctly, audit log created
- **Priority:** Critical

**TC-STAND-003: Mobile Stand Reservation**
- **Preconditions:** Stand available, mobile device
- **Steps:**
  1. Open inventory on mobile
  2. Tap available stand
  3. View drawer with stand details
  4. Accept terms
  5. Reserve stand
- **Expected:** Reservation created, drawer closes, timer starts
- **Priority:** Critical

**TC-STAND-004: Reservation Timer (48-72 hours)**
- **Preconditions:** Stand reserved
- **Steps:**
  1. View reserved stand
  2. Check timer display
  3. Wait for expiry
- **Expected:** Timer counts down correctly, expires after 48-72h
- **Priority:** High

**TC-STAND-005: Price per Square Meter Calculation**
- **Preconditions:** Stand with size and price
- **Steps:**
  1. View stand details
- **Expected:** Price per m² calculated and displayed correctly
- **Priority:** Medium

**TC-STAND-006: Stand Filtering**
- **Preconditions:** Multiple stands with different statuses
- **Steps:**
  1. Filter by status (Available, Reserved, Sold)
  2. Filter by price range
  3. Filter by size
- **Expected:** Filters work correctly
- **Priority:** Medium

**TC-STAND-007: Stand Bulk Operations**
- **Preconditions:** Development with multiple stands
- **Steps:**
  1. Select multiple stands
  2. Bulk update status
  3. Bulk update price
- **Expected:** Bulk operations complete successfully
- **Priority:** Low

---

### Module 4: Client Management

#### Test Cases

**TC-CLIENT-001: Create Client**
- **Preconditions:** Admin/Agent logged in
- **Steps:**
  1. Navigate to Clients
  2. Click "Add Client"
  3. Fill required fields (name, email, phone)
  4. Save
- **Expected:** Client created successfully
- **Priority:** Critical

**TC-CLIENT-002: Client Portfolio View**
- **Preconditions:** Client with reservations and payments
- **Steps:**
  1. Open client profile
  2. View portfolio tab
- **Expected:** All reservations, payments, and properties displayed
- **Priority:** High

**TC-CLIENT-003: Client Statement Generation**
- **Preconditions:** Client with payment history
- **Steps:**
  1. Open client profile
  2. Click "Generate Statement"
  3. Download PDF
- **Expected:** PDF generated with correct data, branded correctly
- **Priority:** High

**TC-CLIENT-004: KYC Document Upload**
- **Preconditions:** Client exists
- **Steps:**
  1. Open client profile
  2. Upload KYC document
  3. Verify document saved
- **Expected:** Document uploaded and accessible
- **Priority:** Medium

**TC-CLIENT-005: Client Search & Filter**
- **Preconditions:** Multiple clients exist
- **Steps:**
  1. Search by name
  2. Search by email
  3. Filter by branch
  4. Filter by agent
- **Expected:** Search and filters work correctly
- **Priority:** Medium

**TC-CLIENT-006: Agent-Client Assignment**
- **Preconditions:** Agent and client exist
- **Steps:**
  1. Open client profile
  2. Assign to agent
  3. Verify assignment
- **Expected:** Client assigned, visible in agent's client list
- **Priority:** High

**TC-CLIENT-007: Client Branch Filtering**
- **Preconditions:** Clients in both branches
- **Steps:**
  1. Switch branch
  2. View clients
- **Expected:** Only branch-specific clients shown
- **Priority:** Critical

---

### Module 5: Payment Processing

#### Test Cases

**TC-PAY-001: Record Payment**
- **Preconditions:** Client exists
- **Steps:**
  1. Navigate to Payments
  2. Click "Record Payment"
  3. Select client, enter amount, method
  4. Save
- **Expected:** Payment recorded, receipt generated
- **Priority:** Critical

**TC-PAY-002: Payment Allocation**
- **Preconditions:** Client with installment plan
- **Steps:**
  1. Record payment
  2. Allocate to specific installment
  3. Verify allocation
- **Expected:** Payment allocated, installment updated
- **Priority:** Critical

**TC-PAY-003: Fee Breakdown Calculation**
- **Preconditions:** Payment with fees
- **Steps:**
  1. Record payment for stand
  2. View fee breakdown
- **Expected:** Stand Price, VAT, Endowment, AOS, Cession calculated correctly
- **Priority:** Critical

**TC-PAY-004: Payment Verification**
- **Preconditions:** Payment recorded
- **Steps:**
  1. Upload proof of payment
  2. Change verification status to "Verified"
- **Expected:** Status updated, audit log created
- **Priority:** High

**TC-PAY-005: Manual Receipt Generation**
- **Preconditions:** Payment recorded
- **Steps:**
  1. Open payment
  2. Generate manual receipt
  3. Download PDF
- **Expected:** Receipt generated with correct number and details
- **Priority:** High

**TC-PAY-006: Payment Settlement Status**
- **Preconditions:** Payment recorded
- **Steps:**
  1. Update settlement status
  2. Verify status change
- **Expected:** Settlement status updated correctly
- **Priority:** Medium

**TC-PAY-007: Payment Search & Filter**
- **Preconditions:** Multiple payments exist
- **Steps:**
  1. Search by client name
  2. Filter by status
  3. Filter by date range
  4. Filter by branch
- **Expected:** Search and filters work correctly
- **Priority:** Medium

**TC-PAY-008: Payment Reference Uniqueness**
- **Preconditions:** Payment exists
- **Steps:**
  1. Attempt to create payment with duplicate reference
- **Expected:** Error message, payment not created
- **Priority:** High

---

### Module 6: Installment Plans

#### Test Cases

**TC-INST-001: Create Installment Plan**
- **Preconditions:** Client and stand exist
- **Steps:**
  1. Navigate to Installments
  2. Create new plan
  3. Select period (12, 24, 48 months)
  4. Calculate monthly amount
  5. Save
- **Expected:** Plan created, installments generated
- **Priority:** Critical

**TC-INST-002: Installment Calculation**
- **Preconditions:** Stand price and deposit known
- **Steps:**
  1. Create installment plan
  2. Verify deposit amount
  3. Verify monthly amount
  4. Verify total installments
- **Expected:** All calculations correct
- **Priority:** Critical

**TC-INST-003: Payment Allocation to Installment**
- **Preconditions:** Installment plan with pending installments
- **Steps:**
  1. Record payment
  2. Allocate to specific installment
  3. Verify installment status updated
- **Expected:** Installment marked as paid, balance updated
- **Priority:** Critical

**TC-INST-004: Installment Due Date Tracking**
- **Preconditions:** Installment plan active
- **Steps:**
  1. View installments
  2. Check due dates
  3. Verify next due date calculation
- **Expected:** Due dates calculated correctly
- **Priority:** High

**TC-INST-005: Installment Status Updates**
- **Preconditions:** Installment plan exists
- **Steps:**
  1. Pay installment
  2. Verify status changes to "PAID"
  3. Verify remaining balance updated
- **Expected:** Status and balance updated correctly
- **Priority:** Critical

**TC-INST-006: Multiple Installment Plans**
- **Preconditions:** Client with multiple stands
- **Steps:**
  1. Create plan for stand 1
  2. Create plan for stand 2
  3. View all plans for client
- **Expected:** All plans displayed correctly
- **Priority:** Medium

---

### Module 7: Receipts Management

#### Test Cases

**TC-REC-001: Automatic Receipt Generation**
- **Preconditions:** Payment recorded
- **Steps:**
  1. Record payment
  2. Verify receipt generated automatically
- **Expected:** Receipt created with unique number
- **Priority:** Critical

**TC-REC-002: Receipt PDF Generation**
- **Preconditions:** Receipt exists
- **Steps:**
  1. Open receipt
  2. Download PDF
- **Expected:** PDF generated with correct formatting and data
- **Priority:** High

**TC-REC-003: Receipt Numbering System**
- **Preconditions:** Branch settings configured
- **Steps:**
  1. Generate receipt for Harare branch
  2. Generate receipt for Bulawayo branch
- **Expected:** Receipt numbers follow branch prefix pattern
- **Priority:** High

**TC-REC-004: Receipt Voiding**
- **Preconditions:** Receipt exists
- **Steps:**
  1. Open receipt
  2. Click "Void Receipt"
  3. Enter void reason
  4. Confirm
- **Expected:** Receipt voided, status updated, audit log created
- **Priority:** High

**TC-REC-005: Receipt Search**
- **Preconditions:** Multiple receipts exist
- **Steps:**
  1. Search by receipt number
  2. Search by client name
  3. Filter by date range
- **Expected:** Search works correctly
- **Priority:** Medium

---

### Module 8: Contracts & Legal

#### Test Cases

**TC-CONTRACT-001: Create Contract Template**
- **Preconditions:** Admin logged in
- **Steps:**
  1. Navigate to Contracts
  2. Create new template
  3. Add content with variables
  4. Save template
- **Expected:** Template created and saved
- **Priority:** High

**TC-CONTRACT-002: Generate Contract from Template**
- **Preconditions:** Template and client exist
- **Steps:**
  1. Select template
  2. Select client and stand
  3. Fill variables
  4. Generate contract
- **Expected:** Contract generated with correct data
- **Priority:** Critical

**TC-CONTRACT-003: E-Signature Workflow**
- **Preconditions:** Contract generated
- **Steps:**
  1. Send contract for signature
  2. Signer receives email
  3. Signer signs contract
  4. Verify signature recorded
- **Expected:** Signature workflow completes successfully
- **Priority:** Critical

**TC-CONTRACT-004: Contract PDF Rendering**
- **Preconditions:** Contract exists
- **Steps:**
  1. Open contract
  2. View PDF
  3. Download PDF
- **Expected:** PDF renders correctly with all content
- **Priority:** High

**TC-CONTRACT-005: Contract Versioning**
- **Preconditions:** Contract exists
- **Steps:**
  1. Edit contract
  2. Create new version
  3. View version history
- **Expected:** Versions tracked correctly
- **Priority:** Medium

**TC-CONTRACT-006: Contract Amendment**
- **Preconditions:** Signed contract exists
- **Steps:**
  1. Create amendment
  2. Add changes
  3. Save amendment
- **Expected:** Amendment created and tracked
- **Priority:** Medium

---

### Module 9: Sales Pipeline (Kanban)

#### Test Cases

**TC-PIPELINE-001: Create Deal**
- **Preconditions:** Client and stand exist
- **Steps:**
  1. Navigate to Pipeline
  2. Create new deal
  3. Fill deal details
  4. Assign to stage
  5. Save
- **Expected:** Deal created and displayed on board
- **Priority:** Critical

**TC-PIPELINE-002: Move Deal Between Stages**
- **Preconditions:** Deal exists
- **Steps:**
  1. Drag deal to new stage
  2. Verify move
- **Expected:** Deal moved, stage updated, audit log created
- **Priority:** Critical

**TC-PIPELINE-003: Deal Intelligence**
- **Preconditions:** Deal exists
- **Steps:**
  1. View deal details
  2. Check health score
  3. Check win probability
- **Expected:** Intelligence metrics calculated correctly
- **Priority:** Medium

**TC-PIPELINE-004: Deal Comments**
- **Preconditions:** Deal exists
- **Steps:**
  1. Add comment to deal
  2. View comment history
- **Expected:** Comments saved and displayed
- **Priority:** Medium

**TC-PIPELINE-005: Pipeline Rules**
- **Preconditions:** Rule configured
- **Steps:**
  1. Trigger rule condition
  2. Verify rule action executed
- **Expected:** Rule triggers and executes correctly
- **Priority:** Low

**TC-PIPELINE-006: Mobile Kanban View**
- **Preconditions:** Deals exist, mobile device
- **Steps:**
  1. Open pipeline on mobile
  2. View deals
  3. Swipe between stages
- **Expected:** Mobile view works correctly
- **Priority:** Medium

---

### Module 10: Agent Dashboard

#### Test Cases

**TC-AGENT-001: Agent Performance Metrics**
- **Preconditions:** Agent logged in, has deals/payments
- **Steps:**
  1. View dashboard
  2. Check performance metrics
- **Expected:** Metrics display correctly
- **Priority:** High

**TC-AGENT-002: Agent Client List**
- **Preconditions:** Agent with assigned clients
- **Steps:**
  1. View "My Clients"
  2. Verify only assigned clients shown
- **Expected:** Correct clients displayed
- **Priority:** Critical

**TC-AGENT-003: Agent Commission Tracking**
- **Preconditions:** Agent with commission-earning payments
- **Steps:**
  1. View commissions
  2. Check commission calculations
- **Expected:** Commissions calculated correctly (2.5%)
- **Priority:** Critical

**TC-AGENT-004: Agent Pipeline Analytics**
- **Preconditions:** Agent with deals
- **Steps:**
  1. View pipeline analytics
  2. Check conversion rates
- **Expected:** Analytics display correctly
- **Priority:** Medium

**TC-AGENT-005: Agent Lead Management**
- **Preconditions:** Agent logged in
- **Steps:**
  1. Add new lead
  2. Convert lead to client
- **Expected:** Lead management works correctly
- **Priority:** High

---

### Module 11: Commission Management

#### Test Cases

**TC-COMM-001: Commission Calculation**
- **Preconditions:** Payment recorded with agent
- **Steps:**
  1. Verify commission calculated
  2. Check commission amount (2.5% of payment)
- **Expected:** Commission calculated correctly
- **Priority:** Critical

**TC-COMM-002: Monthly Commission Tracking**
- **Preconditions:** Multiple payments in month
- **Steps:**
  1. View monthly commission summary
  2. Verify total commission
- **Expected:** Monthly totals correct
- **Priority:** High

**TC-COMM-003: Commission Payout**
- **Preconditions:** Commission calculated
- **Steps:**
  1. Mark commission as paid
  2. Verify payout status
- **Expected:** Payout status updated
- **Priority:** Medium

---

### Module 12: Payment Automation

#### Test Cases

**TC-AUTO-001: Payment Reminder Email**
- **Preconditions:** Overdue invoice exists
- **Steps:**
  1. Trigger payment reminder cron
  2. Verify email sent
  3. Check email tracking
- **Expected:** Email sent, tracked correctly
- **Priority:** Critical

**TC-AUTO-002: Overdue Escalation**
- **Preconditions:** Invoice overdue 30+ days
- **Steps:**
  1. Trigger escalation cron
  2. Verify escalation email sent
- **Expected:** Escalation email sent
- **Priority:** High

**TC-AUTO-003: Follow-up Email Sequence**
- **Preconditions:** Client with overdue invoice
- **Steps:**
  1. Trigger follow-up cron
  2. Verify follow-up sent
  3. Check follow-up count
- **Expected:** Follow-ups sent according to schedule
- **Priority:** High

**TC-AUTO-004: Email Open Tracking**
- **Preconditions:** Email sent
- **Steps:**
  1. Open email (trigger pixel)
  2. Check tracking dashboard
- **Expected:** Open tracked correctly
- **Priority:** Medium

**TC-AUTO-005: Email Click Tracking**
- **Preconditions:** Email sent with link
- **Steps:**
  1. Click link in email
  2. Check tracking dashboard
- **Expected:** Click tracked correctly
- **Priority:** Medium

**TC-AUTO-006: Bounce Management**
- **Preconditions:** Invalid email address
- **Steps:**
  1. Send email to invalid address
  2. Check bounce handling
- **Expected:** Bounce detected and handled
- **Priority:** Medium

**TC-AUTO-007: Unsubscribe Management**
- **Preconditions:** Email sent
- **Steps:**
  1. Click unsubscribe link
  2. Verify unsubscribe processed
  3. Attempt to send email again
- **Expected:** Unsubscribe works, future emails blocked
- **Priority:** High

---

### Module 13: Reconciliation

#### Test Cases

**TC-RECON-001: Bank Statement Import**
- **Preconditions:** Bank statement file available
- **Steps:**
  1. Import bank statement
  2. Verify transactions imported
- **Expected:** Transactions imported correctly
- **Priority:** High

**TC-RECON-002: Auto-Matching**
- **Preconditions:** Payments and bank transactions exist
- **Steps:**
  1. Run auto-matching
  2. Verify matches created
- **Expected:** Payments matched correctly
- **Priority:** Critical

**TC-RECON-003: Manual Reconciliation**
- **Preconditions:** Unmatched transactions exist
- **Steps:**
  1. Manually match transaction to payment
  2. Verify match
- **Expected:** Manual match works correctly
- **Priority:** High

**TC-RECON-004: Settlement Status**
- **Preconditions:** Matched transaction
- **Steps:**
  1. Update settlement status
  2. Verify status change
- **Expected:** Settlement status updated
- **Priority:** Medium

---

### Module 14: Audit Trail

#### Test Cases

**TC-AUDIT-001: Activity Logging**
- **Preconditions:** User performs action
- **Steps:**
  1. Perform action (create, update, delete)
  2. View audit trail
- **Expected:** Action logged with details
- **Priority:** Critical

**TC-AUDIT-002: Audit Trail Filtering**
- **Preconditions:** Multiple audit logs exist
- **Steps:**
  1. Filter by user
  2. Filter by module
  3. Filter by date range
  4. Filter by branch
- **Expected:** Filters work correctly
- **Priority:** High

**TC-AUDIT-003: Audit Trail Search**
- **Preconditions:** Audit logs exist
- **Steps:**
  1. Search by description
  2. Search by record ID
- **Expected:** Search works correctly
- **Priority:** Medium

**TC-AUDIT-004: Branch Filtering**
- **Preconditions:** Logs from both branches
- **Steps:**
  1. Switch branch
  2. View audit trail
- **Expected:** Only branch-specific logs shown
- **Priority:** Critical

---

### Module 15: User Management

#### Test Cases

**TC-USER-001: Create User**
- **Preconditions:** Admin logged in
- **Steps:**
  1. Navigate to Users
  2. Create new user
  3. Assign role and branch
  4. Save
- **Expected:** User created successfully
- **Priority:** Critical

**TC-USER-002: Send Invitation**
- **Preconditions:** Admin logged in
- **Steps:**
  1. Create user invitation
  2. Send invitation email
  3. Verify email sent
- **Expected:** Invitation sent, token generated
- **Priority:** High

**TC-USER-003: Accept Invitation**
- **Preconditions:** Invitation sent
- **Steps:**
  1. Click invitation link
  2. Set password
  3. Complete registration
- **Expected:** User account activated
- **Priority:** Critical

**TC-USER-004: Revoke Access**
- **Preconditions:** User exists
- **Steps:**
  1. Revoke user access
  2. Attempt to login with revoked account
- **Expected:** Login denied
- **Priority:** High

**TC-USER-005: Role Assignment**
- **Preconditions:** User exists
- **Steps:**
  1. Change user role
  2. Verify role change
  3. Test access with new role
- **Expected:** Role changed, access updated
- **Priority:** Critical

**TC-USER-006: Branch Assignment**
- **Preconditions:** User exists
- **Steps:**
  1. Change user branch
  2. Verify branch change
  3. Test data visibility
- **Expected:** Branch changed, data filtered correctly
- **Priority:** Critical

---

### Module 16: Settings & Configuration

#### Test Cases

**TC-SETTINGS-001: Update Branch Settings**
- **Preconditions:** Admin logged in
- **Steps:**
  1. Navigate to Settings
  2. Update branch information
  3. Save
- **Expected:** Settings saved, visible across app
- **Priority:** High

**TC-SETTINGS-002: Logo Upload**
- **Preconditions:** Admin logged in
- **Steps:**
  1. Upload logo via UploadThing
  2. Verify logo displays in app
- **Expected:** Logo uploaded and displayed
- **Priority:** Medium

**TC-SETTINGS-003: Receipt Prefix Configuration**
- **Preconditions:** Admin logged in
- **Steps:**
  1. Set receipt prefix for branch
  2. Generate receipt
  3. Verify prefix used
- **Expected:** Receipt uses configured prefix
- **Priority:** Medium

**TC-SETTINGS-004: Company Information**
- **Preconditions:** Admin logged in
- **Steps:**
  1. Update company name, address, phone
  2. Verify in receipts/statements
- **Expected:** Company info used in documents
- **Priority:** Medium

---

### Module 17: Analytics & Reporting

#### Test Cases

**TC-ANALYTICS-001: Performance Dashboard**
- **Preconditions:** Data exists
- **Steps:**
  1. View performance dashboard
  2. Check metrics
- **Expected:** Metrics display correctly
- **Priority:** Medium

**TC-ANALYTICS-002: Revenue Analytics**
- **Preconditions:** Payments exist
- **Steps:**
  1. View revenue analytics
  2. Check charts and trends
- **Expected:** Analytics display correctly
- **Priority:** Medium

**TC-ANALYTICS-003: Client Segmentation**
- **Preconditions:** Multiple clients exist
- **Steps:**
  1. View segmentation
  2. Check segments
- **Expected:** Clients segmented correctly
- **Priority:** Low

**TC-ANALYTICS-004: Custom Report Generation**
- **Preconditions:** Report builder available
- **Steps:**
  1. Create custom report
  2. Select data fields
  3. Generate report
  4. Export PDF/Excel
- **Expected:** Report generated correctly
- **Priority:** Low

---

## 🔒 Security Testing

### Test Cases

**TC-SEC-001: SQL Injection Prevention**
- **Preconditions:** Application running
- **Steps:**
  1. Attempt SQL injection in input fields
- **Expected:** Input sanitized, no SQL executed
- **Priority:** Critical

**TC-SEC-002: XSS Prevention**
- **Preconditions:** Application running
- **Steps:**
  1. Attempt XSS in input fields
- **Expected:** Scripts escaped, not executed
- **Priority:** Critical

**TC-SEC-003: CSRF Protection**
- **Preconditions:** Application running
- **Steps:**
  1. Attempt CSRF attack
- **Expected:** Request rejected
- **Priority:** Critical

**TC-SEC-004: Unauthorized API Access**
- **Preconditions:** API endpoints exist
- **Steps:**
  1. Access admin API without authentication
  2. Access admin API as non-admin user
- **Expected:** Requests rejected with 401/403
- **Priority:** Critical

**TC-SEC-005: Data Isolation (Branch)**
- **Preconditions:** Data in both branches
- **Steps:**
  1. Login as Harare user
  2. Attempt to access Bulawayo data
- **Expected:** Only Harare data accessible
- **Priority:** Critical

**TC-SEC-006: Role-Based Access Control**
- **Preconditions:** Multiple roles exist
- **Steps:**
  1. Login as Agent
  2. Attempt to access Admin features
- **Expected:** Access denied, redirected
- **Priority:** Critical

**TC-SEC-007: Session Security**
- **Preconditions:** User logged in
- **Steps:**
  1. Copy session token
  2. Use token from different device/IP
- **Expected:** Session invalidated or restricted
- **Priority:** High

**TC-SEC-008: Password Security**
- **Preconditions:** User account exists
- **Steps:**
  1. Check password hashing (bcrypt)
  2. Verify password not stored in plain text
- **Expected:** Passwords hashed securely
- **Priority:** Critical

---

## 📱 Mobile Testing

### Test Cases

**TC-MOBILE-001: Responsive Design**
- **Preconditions:** Mobile device
- **Steps:**
  1. Access app on mobile
  2. Navigate through modules
  3. Verify layout adapts
- **Expected:** Layout responsive, no horizontal scroll
- **Priority:** High

**TC-MOBILE-002: Touch Targets**
- **Preconditions:** Mobile device
- **Steps:**
  1. Test all interactive elements
  2. Verify minimum 44x44px touch targets
- **Expected:** All elements easily tappable
- **Priority:** High

**TC-MOBILE-003: Mobile Navigation**
- **Preconditions:** Mobile device
- **Steps:**
  1. Test bottom navigation
  2. Test drawer navigation
  3. Test swipe gestures
- **Expected:** Navigation works smoothly
- **Priority:** Critical

**TC-MOBILE-004: Mobile Stand Reservation**
- **Preconditions:** Mobile device, available stand
- **Steps:**
  1. Open inventory
  2. Tap stand
  3. Test drawer interaction
  4. Complete reservation
- **Expected:** Reservation flow works on mobile
- **Priority:** Critical

**TC-MOBILE-005: Mobile Forms**
- **Preconditions:** Mobile device
- **Steps:**
  1. Fill forms on mobile
  2. Test input fields
  3. Test date pickers
  4. Test file uploads
- **Expected:** Forms work correctly on mobile
- **Priority:** High

**TC-MOBILE-006: Mobile Tables**
- **Preconditions:** Mobile device, data tables
- **Steps:**
  1. View tables on mobile
  2. Test scrolling
  3. Test column visibility
- **Expected:** Tables usable on mobile
- **Priority:** Medium

---

## ⚡ Performance Testing

### Test Cases

**TC-PERF-001: Page Load Time**
- **Preconditions:** Application deployed
- **Steps:**
  1. Measure page load times
  2. Verify < 3 seconds for initial load
- **Expected:** Pages load within acceptable time
- **Priority:** High

**TC-PERF-002: API Response Time**
- **Preconditions:** API endpoints available
- **Steps:**
  1. Measure API response times
  2. Verify < 1 second for most endpoints
- **Expected:** APIs respond quickly
- **Priority:** High

**TC-PERF-003: Database Query Performance**
- **Preconditions:** Database with data
- **Steps:**
  1. Execute complex queries
  2. Measure query times
  3. Check for N+1 queries
- **Expected:** Queries optimized, no N+1 issues
- **Priority:** Medium

**TC-PERF-004: Concurrent Users**
- **Preconditions:** Load testing tools
- **Steps:**
  1. Simulate 50 concurrent users
  2. Monitor system performance
- **Expected:** System handles load gracefully
- **Priority:** Medium

**TC-PERF-005: Large Dataset Handling**
- **Preconditions:** Large amount of data
- **Steps:**
  1. Test with 10,000+ records
  2. Verify pagination works
  3. Check virtualization
- **Expected:** System handles large datasets
- **Priority:** Medium

---

## 🧩 Integration Testing

### Test Cases

**TC-INT-001: Payment to Installment Integration**
- **Preconditions:** Payment and installment exist
- **Steps:**
  1. Allocate payment to installment
  2. Verify installment updated
  3. Verify balance recalculated
- **Expected:** Integration works correctly
- **Priority:** Critical

**TC-INT-002: Reservation to Payment Flow**
- **Preconditions:** Reservation exists
- **Steps:**
  1. Convert reservation to payment
  2. Verify stand status updated
  3. Verify client updated
- **Expected:** Flow completes correctly
- **Priority:** Critical

**TC-INT-003: Contract to Deal Integration**
- **Preconditions:** Deal exists
- **Steps:**
  1. Generate contract from deal
  2. Verify contract linked to deal
- **Expected:** Integration works correctly
- **Priority:** Medium

**TC-INT-004: Email to Payment Automation**
- **Preconditions:** Overdue invoice exists
- **Steps:**
  1. Trigger payment reminder
  2. Verify email sent
  3. Verify tracking recorded
- **Expected:** Automation works correctly
- **Priority:** High

---

## 🐛 Error Handling Testing

### Test Cases

**TC-ERR-001: Invalid Input Handling**
- **Preconditions:** Forms available
- **Steps:**
  1. Enter invalid data
  2. Submit form
- **Expected:** Error messages displayed, form not submitted
- **Priority:** High

**TC-ERR-002: Network Error Handling**
- **Preconditions:** Application running
- **Steps:**
  1. Simulate network failure
  2. Attempt API call
- **Expected:** Error handled gracefully, user notified
- **Priority:** High

**TC-ERR-003: Server Error Handling**
- **Preconditions:** Application running
- **Steps:**
  1. Simulate server error (500)
  2. Verify error page displayed
- **Expected:** Error page shown, user can recover
- **Priority:** Medium

**TC-ERR-004: Validation Error Messages**
- **Preconditions:** Forms available
- **Steps:**
  1. Test all validation rules
  2. Verify error messages clear
- **Expected:** Clear, actionable error messages
- **Priority:** Medium

---

## 📋 Test Data Requirements

### Test Users
- Admin user (Harare)
- Admin user (Bulawayo)
- Manager user (Harare)
- Agent user (Harare)
- Agent user (Bulawayo)
- Account user (Harare)
- Client user (Harare)
- Client user (Bulawayo)
- Developer user

### Test Data Sets
- **Developments:** 5+ developments per branch
- **Stands:** 20+ stands per development
- **Clients:** 10+ clients per branch
- **Payments:** 50+ payments across various types
- **Installments:** 10+ installment plans
- **Contracts:** 5+ contract templates, 10+ contracts
- **Deals:** 20+ deals in pipeline
- **Reservations:** 10+ active reservations

---

## 📅 Test Execution Plan

### Phase 1: Unit & Integration Testing (Week 1-2)
- API endpoint testing
- Component unit testing
- Integration testing

### Phase 2: Functional Testing (Week 3-4)
- Module-by-module testing
- Role-based testing
- Workflow testing

### Phase 3: System Testing (Week 5-6)
- End-to-end scenarios
- Security testing
- Performance testing

### Phase 4: User Acceptance Testing (Week 7-8)
- Business scenario validation
- Mobile testing
- Final regression testing

---

## ✅ Test Completion Criteria

### Must Pass (Critical)
- All authentication tests
- All payment processing tests
- All role-based access tests
- All data integrity tests
- All security tests

### Should Pass (High Priority)
- All core module functionality
- All API endpoints
- All mobile features
- All automation workflows

### Nice to Have (Medium/Low Priority)
- Advanced analytics
- Custom reporting
- Performance optimizations

---

## 📊 Test Metrics & Reporting

### Metrics to Track
- **Test Coverage:** Target 80%+ code coverage
- **Pass Rate:** Target 95%+ test pass rate
- **Defect Density:** Track defects per module
- **Test Execution Rate:** Track tests executed vs planned

### Reporting
- Daily test execution reports
- Weekly defect summary
- Test completion dashboard
- Final test report with recommendations

---

## 🔄 Regression Testing

### Regression Test Suite
- Critical user paths
- Core workflows
- Security features
- Payment processing
- Data integrity

### Regression Frequency
- After each release
- After critical bug fixes
- Before production deployment

---

## 📝 Test Environment

### Test Environment Setup
- **Database:** Test database with sample data
- **API:** Test API endpoints
- **Authentication:** Test user accounts
- **Email:** Test email service (Resend test mode)
- **File Upload:** Test UploadThing environment

### Test Tools
- **API Testing:** Postman/Insomnia
- **Browser Testing:** Chrome, Firefox, Safari, Edge
- **Mobile Testing:** iOS Safari, Android Chrome
- **Performance:** Lighthouse, WebPageTest
- **Security:** OWASP ZAP, Burp Suite

---

## 🎯 Success Criteria

### Application is Ready for Production When:
1. ✅ All critical tests pass
2. ✅ 95%+ test pass rate
3. ✅ No critical or high-severity bugs
4. ✅ Security tests pass
5. ✅ Performance benchmarks met
6. ✅ Mobile testing complete
7. ✅ User acceptance testing approved
8. ✅ Documentation complete

---

**End of Test Plan**
