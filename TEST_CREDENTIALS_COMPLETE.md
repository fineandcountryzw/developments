# Test Credentials for Fine & Country Zimbabwe ERP

**Document Created:** January 18, 2026  
**Last Updated:** January 18, 2026  
**Environment:** Development (localhost:3000)

---

## ⚠️ IMPORTANT SECURITY NOTES

1. **These credentials are FOR TESTING ONLY** - Not for production use
2. **Passwords are shown in plain text below** - Store securely in `.env.local` or password manager
3. **All test accounts should be deleted before production deployment**
4. **Test users have realistic email addresses for testing email notifications**

---

## 🔐 TEST CREDENTIALS BY DASHBOARD

### 1️⃣ ADMIN DASHBOARD (Full System Access)

| Field | Value |
|-------|-------|
| **Email** | `admin@fineandcountryerp.com` |
| **Password** | `AdminTest123!` |
| **User ID** | `admin-test-001` |
| **Role** | `ADMIN` |
| **Branch** | Harare |
| **Access Level** | ✅ Full access to all dashboards, settings, user management |

**Dashboard Access:**
- ✅ Admin Dashboard
- ✅ Developer Module
- ✅ All user management
- ✅ System settings & configuration
- ✅ Audit trails & forensic logs

**Use Cases:**
- System configuration & setup
- User account management
- View all organization data
- System audits & compliance

---

### 2️⃣ AGENT DASHBOARD (Sales Agent Access)

| Field | Value |
|-------|-------|
| **Email** | `agent@fineandcountryerp.com` |
| **Password** | `AgentTest123!` |
| **User ID** | `agent-test-001` |
| **Role** | `AGENT` |
| **Branch** | Harare |
| **Access Level** | ✅ Agent Dashboard, My Clients, Properties, Commissions, Active Deals |

**Dashboard Access:**
- ✅ Agent Dashboard
- ✅ My Performance
- ✅ My Clients (Portfolio)
- ✅ Add New Client
- ✅ Active Deals
- ✅ Properties Inventory
- ✅ Commissions Tracker
- ✅ My Branch Overview

**Features Available:**
- View and manage own clients
- Create new clients
- Track property reservations
- View sales deals & pipeline
- Track commission earnings
- Browse available properties

**Use Cases:**
- Sales workflow testing
- Client management
- Property & deal tracking
- Commission verification

---

### 3️⃣ CLIENT DASHBOARD (Property Buyer Portal)

| Field | Value |
|-------|-------|
| **Email** | `client@fineandcountryerp.com` |
| **Password** | `ClientTest123!` |
| **User ID** | `client-test-001` |
| **Role** | `CLIENT` |
| **Branch** | Harare |
| **Access Level** | ✅ Client portal - Reservations, Payments, Portfolio |

**Dashboard Access:**
- ✅ Client Dashboard
- ✅ My Reservations
- ✅ Payment History
- ✅ Property Portfolio
- ✅ Invoice Downloads

**Features Available:**
- View reserved properties
- Track payment status
- Download invoices & receipts
- View installment schedules
- Contact support

**Use Cases:**
- Client portal functionality testing
- Payment tracking workflow
- Invoice generation
- Reservation management

---

### 4️⃣ MANAGER/BRANCH DASHBOARD (Branch Management)

| Field | Value |
|-------|-------|
| **Email** | `manager@fineandcountryerp.com` |
| **Password** | `ManagerTest123!` |
| **User ID** | `manager-test-001` |
| **Role** | `MANAGER` |
| **Branch** | Bulawayo |
| **Access Level** | ✅ Branch management, agent oversight, commission tracking |

**Dashboard Access:**
- ✅ Branch Dashboard
- ✅ Agent Management
- ✅ Development Oversight
- ✅ Commission Reports
- ✅ Sales Analytics
- ✅ Team Performance

**Features Available:**
- Monitor branch agents
- Approve commissions
- View branch-level analytics
- Manage branch properties
- Generate branch reports

**Use Cases:**
- Branch manager functionality
- Agent performance tracking
- Commission oversight
- Branch analytics

---

### 5️⃣ ACCOUNT/SUPPORT DASHBOARD (Operations)

| Field | Value |
|-------|-------|
| **Email** | `account@fineandcountryerp.com` |
| **Password** | `AccountTest123!` |
| **User ID** | `account-test-001` |
| **Role** | `ACCOUNT` |
| **Branch** | Harare |
| **Access Level** | ✅ User account management, billing, support |

**Dashboard Access:**
- ✅ Account Management Dashboard
- ✅ User Account Support
- ✅ Billing & Invoicing
- ✅ Support Tickets
- ✅ Account Operations

**Features Available:**
- User account operations
- Billing management
- Support request handling
- Account verification
- Access revocation

**Use Cases:**
- Account support testing
- Billing workflow
- User account operations
- Support ticket handling

---

## 👥 ADDITIONAL TEST USERS FOR MULTI-USER TESTING

### Agent Test User #2 (Bulawayo Branch)

| Field | Value |
|-------|-------|
| **Email** | `peter.agent@fineandcountryerp.com` |
| **Password** | `AgentTest123!` |
| **Role** | `AGENT` |
| **Branch** | Bulawayo |

---

### Agent Test User #3 (Harare Branch)

| Field | Value |
|-------|-------|
| **Email** | `sandra.agent@fineandcountryerp.com` |
| **Password** | `AgentTest123!` |
| **Role** | `AGENT` |
| **Branch** | Harare |

---

### Client Test User #2 (Bulawayo)

| Field | Value |
|-------|-------|
| **Email** | `michael.client@fineandcountryerp.com` |
| **Password** | `ClientTest123!` |
| **Role** | `CLIENT` |
| **Branch** | Bulawayo |

---

### Client Test User #3 (Harare)

| Field | Value |
|-------|-------|
| **Email** | `victoria.client@fineandcountryerp.com` |
| **Password** | `ClientTest123!` |
| **Role** | `CLIENT` |
| **Branch** | Harare |

---

## 🚀 LOGIN INSTRUCTIONS

### Step 1: Navigate to Login Page
```
http://localhost:3000/login
```

### Step 2: Select Authentication Method
- Choose **Credentials** option (email/password login)
- Google OAuth also available for testing

### Step 3: Enter Test Credentials
```
Email:    [From table above]
Password: [From table above]
```

### Step 4: Verify Dashboard Access
- ✅ Dashboard loads correctly for the user's role
- ✅ Menu items display based on role
- ✅ All features are accessible

---

## 📋 TESTING WORKFLOW SCENARIOS

### Scenario 1: Complete Sales Workflow (Agent → Client → Manager)

1. **Login as Agent** (`agent@fineandcountryerp.com`)
   - Create new client
   - Reserve property
   - Track deal through pipeline
   - View commission

2. **Login as Client** (`client@fineandcountryerp.com`)
   - View reservation
   - Check payment status
   - Download invoice

3. **Login as Manager** (`manager@fineandcountryerp.com`)
   - Verify agent activity
   - Approve commission
   - View branch metrics

### Scenario 2: Multi-Branch Testing

1. **Login as Agent (Harare)** → `agent@fineandcountryerp.com`
2. **Login as Agent (Bulawayo)** → `peter.agent@fineandcountryerp.com`
3. **Login as Manager (Bulawayo)** → `manager@fineandcountryerp.com`
   - Compare branch data
   - Verify branch filtering

### Scenario 3: Admin Operations

1. **Login as Admin** → `admin@fineandcountryerp.com`
   - Access user management
   - View audit trails
   - Configure system settings
   - Manage all users

### Scenario 4: Client Support

1. **Login as Account** → `account@fineandcountryerp.com`
   - Manage user accounts
   - Process billing
   - Handle support requests

---

## 🔄 PASSWORD POLICY FOR TESTING

**Test Password Format:**
- Length: 12 characters minimum
- Pattern: `[Type]Test123!`
- Examples:
  - `AdminTest123!` (for admin accounts)
  - `AgentTest123!` (for agent accounts)
  - `ClientTest123!` (for client accounts)
  - `ManagerTest123!` (for manager accounts)
  - `AccountTest123!` (for account users)

**To Change Test Password:**
1. Login to your account
2. Go to Account Settings
3. Change Password
4. Use format: `New[Type]Pass456!`

---

## ✅ VERIFICATION CHECKLIST

Before testing each dashboard, verify:

- [ ] User can login with credentials
- [ ] Dashboard displays correct role-based content
- [ ] Sidebar menu shows appropriate items
- [ ] All buttons and links are functional
- [ ] No console errors appear
- [ ] API calls are successful (check Network tab)
- [ ] Session persists on page refresh
- [ ] Logout works correctly

---

## 🗑️ CLEANUP & DELETION

**To delete all test credentials from database:**

```sql
DELETE FROM users WHERE email LIKE '%@fineandcountryerp.com' OR email LIKE '%test%';
```

**Or selectively delete:**

```sql
DELETE FROM users WHERE id = 'admin-test-001';
DELETE FROM users WHERE id = 'agent-test-001';
DELETE FROM users WHERE id = 'client-test-001';
-- ... etc
```

---

## 🔗 QUICK REFERENCE TABLE

| Dashboard | Email | Password | Role | Branch |
|-----------|-------|----------|------|--------|
| **Admin** | admin@fineandcountryerp.com | AdminTest123! | ADMIN | Harare |
| **Agent #1** | agent@fineandcountryerp.com | AgentTest123! | AGENT | Harare |
| **Agent #2** | peter.agent@fineandcountryerp.com | AgentTest123! | AGENT | Bulawayo |
| **Agent #3** | sandra.agent@fineandcountryerp.com | AgentTest123! | AGENT | Harare |
| **Client #1** | client@fineandcountryerp.com | ClientTest123! | CLIENT | Harare |
| **Client #2** | michael.client@fineandcountryerp.com | ClientTest123! | CLIENT | Bulawayo |
| **Client #3** | victoria.client@fineandcountryerp.com | ClientTest123! | CLIENT | Harare |
| **Manager** | manager@fineandcountryerp.com | ManagerTest123! | MANAGER | Bulawayo |
| **Account** | account@fineandcountryerp.com | AccountTest123! | ACCOUNT | Harare |

---

## 📝 NOTES

- Test credentials use consistent, memorable passwords for testing
- All test users are marked as **active** (`is_active = true`)
- Email addresses follow pattern for easy identification
- User IDs use consistent naming: `[role]-test-###`
- Test data can be safely wiped without affecting production
- Created via `CREATE_TEST_CREDENTIALS.sql`

---

**Last Generated:** January 18, 2026  
**Framework:** Next.js 15.5.9  
**Database:** Neon PostgreSQL  
**Auth:** NextAuth.js 4.24.13
