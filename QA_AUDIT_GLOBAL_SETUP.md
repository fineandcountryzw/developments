╔════════════════════════════════════════════════════════════════════════════╗
║                  COMPREHENSIVE QA AUDIT - GLOBAL SETUP                      ║
║              Fine & Country Zimbabwe ERP - Production Testing                ║
║                          Generated: 2026-02-02                               ║
╚════════════════════════════════════════════════════════════════════════════╝

═══════════════════════════════════════════════════════════════════════════════
PART 1: IDENTIFIED ROLES & TEST INFRASTRUCTURE
═══════════════════════════════════════════════════════════════════════════════

SYSTEM ROLES (Enum: types/next-auth.d.ts line 6)
────────────────────────────────────────────────
Type: 'ADMIN' | 'MANAGER' | 'AGENT' | 'ACCOUNT' | 'CLIENT' | 'DEVELOPER'

ROLE DEFINITIONS & PERMISSIONS
───────────────────────────────

1. ADMIN
   • Access Level: Full system access
   • Dashboards: /dashboards/admin
   • Key Capabilities:
     - User management & RBAC configuration
     - Development/stand creation & management
     - All financial operations
     - Reports & analytics across all branches
     - System settings & audit trails
   • Branch Scope: Multi-branch (Harare primary)
   • Test Account:
     Email: admin@fineandcountryerp.com
     Password: AdminTest123!
     User ID: admin-test-001
     Branch: Harare

2. MANAGER
   • Access Level: Branch-level operations
   • Dashboards: /dashboards/manager
   • Key Capabilities:
     - Manage agents in their branch
     - View branch performance reports
     - Approve/manage deals & contracts
     - Team performance tracking
   • Branch Scope: Single branch only (Bulawayo)
   • Test Account:
     Email: manager@fineandcountryerp.com
     Password: ManagerTest123!
     User ID: manager-test-001
     Branch: Bulawayo

3. AGENT (Sales)
   • Access Level: Sales workflow & CRM
   • Dashboards: /dashboards/agent
   • Key Capabilities:
     - Manage own clients
     - Browse & reserve properties
     - Track deals & commissions
     - Generate contracts & manage signatures
     - Client onboarding
   • Branch Scope: Single branch
   • Test Accounts (3):
     #1: Email: agent@fineandcountryerp.com
         Password: AgentTest123!
         User ID: agent-test-001
         Branch: Harare
     #2: Email: peter.agent@fineandcountryerp.com
         Password: AgentTest123!
         User ID: agent-test-002
         Branch: Bulawayo
     #3: Email: sandra.agent@fineandcountryerp.com
         Password: AgentTest123!
         User ID: agent-test-003
         Branch: Harare

4. ACCOUNT (Support/Finances)
   • Access Level: Financial operations & support
   • Dashboards: /dashboards/account (or /account/...)
   • Key Capabilities:
     - Record & manage payments
     - Issue receipts
     - Manage installments & payment plans
     - Generate developer payouts
     - Financial reports & reconciliation
   • Branch Scope: Multi-branch access (primary: Harare)
   • Test Account:
     Email: account@fineandcountryerp.com
     Password: AccountTest123!
     User ID: account-test-001
     Branch: Harare

5. CLIENT (Property Buyer)
   • Access Level: Self-service property portal
   • Dashboards: /dashboards/client
   • Key Capabilities:
     - Browse developments & stands
     - Make reservations
     - View own contracts & documents
     - Track payments & installments
     - Download receipts & statements
   • Branch Scope: No branch restriction (multi-development access)
   • Test Accounts (3):
     #1: Email: client@fineandcountryerp.com
         Password: ClientTest123!
         User ID: client-test-001
         Branch: Harare
     #2: Email: michael.client@fineandcountryerp.com
         Password: ClientTest123!
         User ID: client-test-002
         Branch: Bulawayo
     #3: Email: victoria.client@fineandcountryerp.com
         Password: ClientTest123!
         User ID: client-test-003
         Branch: Harare

6. DEVELOPER (Property Developer)
   • Access Level: Development management & reporting
   • Dashboards: /dashboards/developer
   • Key Capabilities:
     - View own developments & stands
     - Track sales & reservations
     - Manage contracts for own properties
     - Download financial reports & statements
     - Request payouts
   • Branch Scope: Own developments only
   • Test Accounts: Created via seed-contracts-test-data.ts
     deva@test.com (Developments A & B)
     devb@test.com (Development C)
     Password: (See seed script for temporary)

═══════════════════════════════════════════════════════════════════════════════
PART 2: TEST ENVIRONMENTS
═══════════════════════════════════════════════════════════════════════════════

ENVIRONMENT MATRIX
──────────────────

LOCAL DEVELOPMENT
├─ URL: http://localhost:3000
├─ Database: Neon PostgreSQL (dev database)
├─ Auth: NextAuth.js with Neon adapter
├─ Setup Endpoint: /setup/create-test-credentials (automatic test user creation)
├─ Status: ✅ Active for development testing
└─ Notes: Safe for data modification

STAGING/PREVIEW
├─ URL: https://www.fineandcountryerp.com (or Vercel preview)
├─ Database: Neon PostgreSQL (production db)
├─ Auth: NextAuth.js with session cookies
├─ Status: ✅ In use (current as of Feb 2, 2026)
└─ Notes: Use caution - avoid modifying real production data

PRODUCTION
├─ URL: https://www.fineandcountryerp.com
├─ Database: Neon PostgreSQL (production)
├─ Auth: NextAuth.js (credentials-based + future SSO)
├─ Status: ✅ Live
└─ Notes: ⚠️ TESTING MUST USE MOCK/TEST DATA ONLY

KEY INFRASTRUCTURE
──────────────────

Database Adapter: Prisma ORM
├─ Schema Location: prisma/schema.prisma
├─ Migrations: Automatic via Vercel
└─ Test Seed Scripts: scripts/seed-contracts-test-data.ts

Auth System: NextAuth.js
├─ Session: JWT-based
├─ Callback: getServerSession() for server-side RBAC
├─ Logout: /api/auth/signout
└─ Session Persistence: Browser cookies + database

API Client Wrapper: lib/api-client.ts (if exists) or direct fetch()
├─ Error Logging: Via logger utility
├─ RBAC Enforcement: Server-side (middleware & route handlers)
└─ Request/Response Format: JSON with standard error codes

Error Logger: lib/logger.ts or console.log via Sentry integration
├─ Sentry Enabled: Yes (see next.config.mjs)
├─ Log Levels: debug, info, warn, error
└─ Module Prefix: [MODULE_NAME] convention used

═══════════════════════════════════════════════════════════════════════════════
PART 3: ROLE × ENVIRONMENT TEST MATRIX
═══════════════════════════════════════════════════════════════════════════════

TESTED ROLE COMBINATIONS
────────────────────────

┌─────────────┬──────────────────┬──────────────────┬──────────────────┐
│ Role        │ Local Dev         │ Staging/Preview  │ Production       │
├─────────────┼──────────────────┼──────────────────┼──────────────────┤
│ ADMIN       │ ✅ Full access   │ ✅ Read-only     │ ⚠️ Restricted    │
│ MANAGER     │ ✅ Full access   │ ✅ Read-only     │ ⚠️ Restricted    │
│ AGENT       │ ✅ Full access   │ ✅ Read-only     │ ✅ Full access   │
│ ACCOUNT     │ ✅ Full access   │ ✅ Read-only     │ ⚠️ Restricted    │
│ CLIENT      │ ✅ Full access   │ ✅ Full access   │ ✅ Full access   │
│ DEVELOPER   │ ✅ Full access   │ ✅ Read-only     │ ⚠️ Restricted    │
└─────────────┴──────────────────┴──────────────────┴──────────────────┘

RBAC TEST SCOPE
───────────────
✅ = Test all CRUD operations
🔍 = Test read-only + error cases
⚠️  = Verify cross-role rejection only

═══════════════════════════════════════════════════════════════════════════════
PART 4: COMPREHENSIVE MODULE INVENTORY & ROUTES
═══════════════════════════════════════════════════════════════════════════════

DASHBOARD MODULES (Frontend Routes)
───────────────────────────────────

1. ADMIN DASHBOARD (/dashboards/admin)
   └─ Components: AdminDevelopments.tsx, AdminDevelopmentsDashboard.tsx
   └─ Key Pages:
      ├─ /dashboards/admin (main landing)
      ├─ Developments (CRUD)
      ├─ Clients management
      ├─ Agents management
      ├─ Users & RBAC
      ├─ Audit trails
      ├─ Reports & Analytics
      └─ System settings

2. MANAGER DASHBOARD (/dashboards/manager)
   └─ Key Pages:
      ├─ /dashboards/manager (main landing)
      ├─ Team management
      ├─ Branch performance
      ├─ Deals pipeline
      ├─ Contracts status
      └─ Revenue reports

3. AGENT DASHBOARD (/dashboards/agent)
   └─ Key Pages:
      ├─ /dashboards/agent (main landing)
      ├─ Clients (CRUD + CRM)
      ├─ Properties/Developments
      ├─ Deals (pipeline)
      ├─ Contracts
      ├─ Commissions tracker
      └─ Performance metrics

4. CLIENT DASHBOARD (/dashboards/client)
   └─ Key Pages:
      ├─ /dashboards/client (main landing)
      ├─ My Reservations
      ├─ My Contracts
      ├─ My Payments & Installments
      ├─ My Documents
      ├─ My Receipts
      └─ Account settings

5. ACCOUNT/SUPPORT DASHBOARD (/dashboards/account or /account)
   └─ Key Pages:
      ├─ Payments (record & manage)
      ├─ Receipts (issue & download)
      ├─ Installments (payment plans)
      ├─ Developer Payouts
      ├─ Financial Reports
      └─ Reconciliation

6. DEVELOPER DASHBOARD (/dashboards/developer)
   └─ Key Pages:
      ├─ My Developments
      ├─ Stands inventory
      ├─ Sales & Reservations
      ├─ Financial statements
      ├─ Contracts (by development)
      ├─ Payout requests
      └─ Reports & Analytics

═══════════════════════════════════════════════════════════════════════════════
API MODULES & ENDPOINTS (Backend Routes)
═════════════════════════════════════════

GROUP A: AUTHENTICATION & SESSION
┌─────────────────────────────────────────────────────────────────────────────┐
│ Module: Auth                                                                 │
│ Base Path: /api/auth/                                                        │
├─────────────────────────────────────────────────────────────────────────────┤
│ Routes:
│  POST   /api/auth/[...nextauth]              NextAuth handler
│  GET    /api/auth/me                         Current user session
│  POST   /api/auth/create-account-from-reservation  Auto account creation
│  POST   /api/auth/accept-invitation          Accept user invitations
│  POST   /api/auth/forgot-password            Password reset request
│  POST   /api/auth/reset-password             Password reset completion
│  POST   /api/auth/request-access             Request system access
└─────────────────────────────────────────────────────────────────────────────┘

GROUP B: DEVELOPMENTS & INVENTORY
┌─────────────────────────────────────────────────────────────────────────────┐
│ Module: Developments                                                         │
│ Base Path: /api/admin/developments                                           │
├─────────────────────────────────────────────────────────────────────────────┤
│ Routes:
│  GET    /api/admin/developments              List all developments (ADMIN)
│  POST   /api/admin/developments              Create development (ADMIN)
│  PUT    /api/admin/developments              Update development (ADMIN)
│  DELETE /api/admin/developments/:id          Delete development (ADMIN)
│  GET    /api/admin/developments/:id/discounts Get discounts
│  GET    /api/admin/developments/:id/fees     Get fee structure
│  GET    /api/admin/developments/:id/templates Get contract templates
│  GET    /api/stands                          List stands (filtered by user)
│  POST   /api/stands                          Create stand (ADMIN)
│  GET    /api/stands/by-development           Stands grouped by dev
│  GET    /api/stands/geojson                  Stands map data
│  POST   /api/stands/:id/fee-breakdown        Calculate fees for stand
└─────────────────────────────────────────────────────────────────────────────┘

GROUP C: RESERVATIONS & CONTRACTS
┌─────────────────────────────────────────────────────────────────────────────┐
│ Module: Reservations                                                         │
│ Base Path: /api/admin/reservations (or /api/client/reservations)             │
├─────────────────────────────────────────────────────────────────────────────┤
│ Routes:
│  POST   /api/admin/reservations              Create reservation (ADMIN/AGENT)
│  GET    /api/admin/reservations              List reservations
│  PUT    /api/admin/reservations/:id          Update reservation status
│  GET    /api/admin/active-reservations       Active holds (48-72hr)
│  POST   /api/client/reservations             Client self-reserve
│  GET    /api/client/reservations             Client's reservations
│  POST   /api/agent/properties/:id/reserve    Agent reserves for client
│  GET    /api/reservations/with-fees          Reservations + computed fees
│  POST   /api/cron/expire-reservations        Auto-expire holds (cron job)
│  POST   /api/client/claim-reservations       Claim from prospect to client
└─────────────────────────────────────────────────────────────────────────────┘

GROUP D: CONTRACTS & SIGNATURES
┌─────────────────────────────────────────────────────────────────────────────┐
│ Module: Contracts                                                            │
│ Base Path: /api/admin/contracts (or /api/client/contracts)                   │
├─────────────────────────────────────────────────────────────────────────────┤
│ Routes:
│  GET    /api/admin/contracts                 List contracts (ADMIN scoped)
│  POST   /api/admin/contracts                 Create contract
│  GET    /api/admin/contracts/:id             Contract detail
│  PUT    /api/admin/contracts/:id             Update contract
│  DELETE /api/admin/contracts/:id             Delete contract (draft only)
│  POST   /api/admin/contracts/generate        Generate from template
│  POST   /api/admin/contracts/:id/send-for-signature  Send DocuSeal link
│  POST   /api/admin/contracts/:id/sign        Internal signing endpoint
│  POST   /api/admin/contracts/:id/render      Render HTML preview
│  POST   /api/admin/contracts/:id/download    Download PDF
│  GET    /api/admin/contracts/:id/signatures  Get signature status
│  POST   /api/webhooks/docuseal               DocuSeal webhook handler
│  GET    /api/admin/contracts/templates       List contract templates
│  POST   /api/admin/contracts/templates/upload Upload custom template
│  GET    /api/admin/contracts/analytics/pending Pending signatures report
│  GET    /api/admin/contracts/analytics/summary Contracts summary
│  GET    /api/client/contracts                Client's contracts only
├─────────────────────────────────────────────────────────────────────────────┤
│ RBAC Notes:
│  • ADMIN: Full CRUD on all contracts
│  • AGENT: Create/view for own clients only
│  • ACCOUNT: View-only for admin support
│  • CLIENT: View own contracts only
│  • DEVELOPER: View contracts for own developments
└─────────────────────────────────────────────────────────────────────────────┘

GROUP E: PAYMENTS & RECEIPTS
┌─────────────────────────────────────────────────────────────────────────────┐
│ Module: Payments                                                             │
│ Base Path: /api/admin/payments (or /api/account/payments)                    │
├─────────────────────────────────────────────────────────────────────────────┤
│ Routes:
│  GET    /api/admin/payments                  List payments
│  POST   /api/admin/payments                  Record new payment
│  GET    /api/admin/payments/:id              Payment detail
│  PUT    /api/admin/payments/:id              Update payment (limited)
│  GET    /api/account/payments                Payments (ACCOUNT scoped)
│  POST   /api/account/payments                Record payment (ACCOUNT)
│  GET    /api/client/payments                 Client's payments only
│  POST   /api/client/payments/upload          Client upload proof
│  GET    /api/payments/with-allocation        Payments with installment allocation
│  GET    /api/admin/stands-payments           Payments per stand
│  GET    /api/cron/generate-invoices          Auto-generate invoices (cron)
│  POST   /api/cron/send-payment-reminders     Email payment reminders (cron)
└─────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────┐
│ Module: Receipts                                                             │
│ Base Path: /api/admin/receipts (or /api/client/receipts)                     │
├─────────────────────────────────────────────────────────────────────────────┤
│ Routes:
│  GET    /api/admin/receipts                  List receipts
│  POST   /api/admin/receipts                  Issue receipt (after payment)
│  GET    /api/admin/receipts/:id              Receipt detail
│  POST   /api/admin/receipts/:id/download     Download PDF receipt
│  GET    /api/client/receipts                 Client's receipts only
│  POST   /api/client/receipts/:id/download    Client download receipt
└─────────────────────────────────────────────────────────────────────────────┘

GROUP F: INSTALLMENTS & PAYMENT PLANS
┌─────────────────────────────────────────────────────────────────────────────┐
│ Module: Installments                                                         │
│ Base Path: /api/admin/installments                                           │
├─────────────────────────────────────────────────────────────────────────────┤
│ Routes:
│  GET    /api/admin/installments              List installment schedules
│  POST   /api/admin/installments              Create installment plan
│  GET    /api/admin/installments/:id          Installment detail + arrears
│  PUT    /api/admin/installments/:id          Update installment terms
│  GET    /api/account/installments            Installments (ACCOUNT view)
│  GET    /api/client/installments             Client's installments
│  POST   /api/cron/escalate-overdue-invoices  Auto-escalate arrears (cron)
└─────────────────────────────────────────────────────────────────────────────┘

GROUP G: PAYOUTS & DEVELOPER REPORTING
┌─────────────────────────────────────────────────────────────────────────────┐
│ Module: Developer Payouts                                                    │
│ Base Path: /api/admin/payouts (or /api/account/payouts)                      │
├─────────────────────────────────────────────────────────────────────────────┤
│ Routes:
│  GET    /api/admin/payouts                   List developer payouts
│  POST   /api/admin/payouts                   Initiate payout (ACCOUNT)
│  GET    /api/admin/payouts/:id               Payout detail
│  PUT    /api/admin/payouts/:id               Update payout status
│  GET    /api/developer/payouts               Developer's own payouts
│  POST   /api/developer/payouts/:id/request   Request new payout
│  GET    /api/cron/weekly-developer-backups   Backup payout data (cron)
│  POST   /api/cron/weekly-developer-report    Email reports to developers (cron)
└─────────────────────────────────────────────────────────────────────────────┘

GROUP H: REPORTS & ANALYTICS
┌─────────────────────────────────────────────────────────────────────────────┐
│ Module: Reporting                                                            │
│ Base Path: /api/admin/reports, /api/account/reports, /api/developer/reports │
├─────────────────────────────────────────────────────────────────────────────┤
│ Routes:
│  GET    /api/admin/reports                   Admin reports (all KPIs)
│  GET    /api/account/reports                 Account/Finance reports
│  GET    /api/account/stats                   Account dashboard stats
│  GET    /api/developer/chart-data            Developer sales charts
│  GET    /api/developer/report/sales          Developer sales summary
│  GET    /api/developer/statement             Developer P&L statement
│  GET    /api/manager/reports                 Manager branch reports
│  GET    /api/manager/stats                   Manager stats dashboard
│  GET    /api/manager/chart-data              Manager performance charts
│  GET    /api/agent/performance               Agent personal performance
│  POST   /api/admin/reports/trigger-weekly    Manual trigger weekly (cron)
│  POST   /api/admin/developer-reports/generate Generate payout reports
└─────────────────────────────────────────────────────────────────────────────┘

GROUP I: CLIENTS & AGENTS MANAGEMENT
┌─────────────────────────────────────────────────────────────────────────────┐
│ Module: Clients                                                              │
│ Base Path: /api/admin/clients (or /api/agent/clients)                        │
├─────────────────────────────────────────────────────────────────────────────┤
│ Routes:
│  GET    /api/admin/clients                   List all clients (ADMIN)
│  POST   /api/admin/clients                   Create client (ADMIN)
│  GET    /api/admin/clients/:id               Client detail
│  PUT    /api/admin/clients/:id               Update client
│  GET    /api/admin/clients/:id/statement     Client statement PDF
│  POST   /api/admin/clients/:id/statement/download Download statement
│  GET    /api/agent/clients                   Agent's clients
│  POST   /api/agent/clients                   Agent create client
│  GET    /api/agent/clients/:id               Agent view own client
│  PUT    /api/agent/clients/:id               Agent update own client
│  GET    /api/account/clients                 Account view all clients (read)
└─────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────┐
│ Module: Agents & User Management                                             │
│ Base Path: /api/admin/agents (or /api/admin/users)                           │
├─────────────────────────────────────────────────────────────────────────────┤
│ Routes:
│  GET    /api/admin/agents                    List agents
│  POST   /api/admin/agents                    Create agent
│  GET    /api/admin/agents/:id                Agent detail
│  PUT    /api/admin/agents/:id                Update agent
│  GET    /api/admin/users                     List all users
│  POST   /api/admin/users                     Create user
│  GET    /api/admin/users/:id                 User detail
│  PUT    /api/admin/users/:id                 Update user (RBAC)
│  DELETE /api/admin/users/:id                 Delete/deactivate user
│  POST   /api/admin/users/:id/revoke          Revoke session
│  POST   /api/admin/users/invite              Send invite email
│  GET    /api/admin/users/invite/:token       Get invite details
│  POST   /api/admin/users/invite/:id/resend   Resend invite
└─────────────────────────────────────────────────────────────────────────────┘

GROUP J: COMMISSIONS & DEALS
┌─────────────────────────────────────────────────────────────────────────────┐
│ Module: Deals & Commissions                                                  │
│ Base Path: /api/admin/deals, /api/agent/deals                                │
├─────────────────────────────────────────────────────────────────────────────┤
│ Routes:
│  GET    /api/admin/deals                     List all deals (ADMIN)
│  POST   /api/admin/deals                     Create deal
│  GET    /api/admin/deals/:id                 Deal detail + intelligence
│  PUT    /api/admin/deals/:id                 Update deal
│  POST   /api/admin/deals/:id/move             Move in pipeline (Kanban)
│  POST   /api/admin/deals/:id/comments        Add comment/note
│  GET    /api/admin/deals/:id/intelligence    AI deal insights
│  GET    /api/agent/deals                     Agent's own deals
│  GET    /api/agent/deals/:id                 Agent view deal
│  POST   /api/agent/leads                     Agent log/create lead
│  GET    /api/agent/leads                     Agent's leads
│  GET    /api/admin/commissions               Commissions summary
│  POST   /api/admin/commissions               Calculate/record commission
│  GET    /api/agent/commissions               Agent's commissions
│  GET    /api/agent/commissions/analytics     Agent commission analytics
│  GET    /api/agent/commissions/expected      Projected commissions
│  POST   /api/admin/kanban                    Kanban stages
│  POST   /api/admin/kanban/:id                Update Kanban stage
│  GET    /api/admin/kanban/stages             List pipeline stages
└─────────────────────────────────────────────────────────────────────────────┘

GROUP K: NOTIFICATIONS & AUDIT
┌─────────────────────────────────────────────────────────────────────────────┐
│ Module: Notifications                                                        │
│ Base Path: /api/notifications                                                │
├─────────────────────────────────────────────────────────────────────────────┤
│ Routes:
│  GET    /api/notifications                   List user notifications
│  POST   /api/notifications/read              Mark as read
│  POST   /api/notifications/read-all          Mark all as read
│  GET    /api/notifications/unread-count      Unread badge count
│  GET    /api/admin/activity-logs             Activity audit log
│  GET    /api/admin/audit-trail               Detailed audit trail
│  GET    /api/admin/access-control-metrics    RBAC audit metrics
└─────────────────────────────────────────────────────────────────────────────┘

GROUP L: UTILITY & INFRASTRUCTURE
┌─────────────────────────────────────────────────────────────────────────────┐
│ Module: Email, Files, Webhooks                                               │
│ Base Path: /api/emails, /api/uploadthing, /api/webhooks                      │
├─────────────────────────────────────────────────────────────────────────────┤
│ Routes:
│  POST   /api/emails/send                     Send email (internal use)
│  GET    /api/email/unsubscribe               Email unsubscribe link
│  POST   /api/email-tracking/click            Track email clicks
│  GET    /api/email-tracking/pixel/:id        Email open tracking
│  POST   /api/uploadthing                     File upload handler
│  POST   /api/webhooks/docuseal               DocuSeal signature webhook
│  GET    /api/realtime                        WebSocket realtime updates
│  POST   /api/automation/worker               Background job processor
│  POST   /api/admin/automations               Create automation rule
│  GET    /api/admin/automations               List automations
│  PUT    /api/admin/automations/:id           Update automation
│  GET    /api/admin/automations/runs          View automation run history
│  POST   /api/admin/automations/:id/retry     Retry failed automation run
└─────────────────────────────────────────────────────────────────────────────┘

═══════════════════════════════════════════════════════════════════════════════
PART 5: MODULES TO TEST (SEQUENTIAL ORDER)
═══════════════════════════════════════════════════════════════════════════════

Testing will proceed in this order. Each module must complete RBAC + UI + API 
validation before moving to the next.

┌─ PHASE 1: FOUNDATION (AUTH & PERMISSIONS)
│
├─ MODULE 1: Authentication & Session (AUTH)
│  └─ Test: Login, session persistence, logout, role-based routing
│
├─ MODULE 2: RBAC & Permissions (RBAC)
│  └─ Test: Cross-role access rejection, permission enforcement
│
└─ MODULE 3: Navigation & Routing (ROUTING)
   └─ Test: Dashboard URL access per role, correct sidebar rendering

┌─ PHASE 2: INVENTORY & RESERVATIONS
│
├─ MODULE 4: Developments & Inventory (INVENTORY)
│  └─ Test: Create/list/update developments, stands count, GeoJSON
│
├─ MODULE 5: Stands & Availability (STANDS)
│  └─ Test: Available/reserved/sold counts, stand detail, fee calculation
│
└─ MODULE 6: Reservations Flow (RESERVATIONS)
   └─ Test: Browse → map → select → compute fees → reserve flow

┌─ PHASE 3: DOCUMENTS & CONTRACTS
│
├─ MODULE 7: Contract Templates & Generation (CONTRACTS)
│  └─ Test: Template selection, contract generation, preview
│
└─ MODULE 8: DocuSeal Signing & Webhooks (SIGNATURES)
   └─ Test: Send for signature, webhook completion, status update

┌─ PHASE 4: FINANCIAL OPERATIONS
│
├─ MODULE 9: Payments & Recording (PAYMENTS)
│  └─ Test: Record payment, payment detail, history, idempotency
│
├─ MODULE 10: Receipts & Issuance (RECEIPTS)
│  └─ Test: Issue receipt, PDF generation, numbering, data scoping
│
├─ MODULE 11: Installments & Payment Plans (INSTALLMENTS)
│  └─ Test: Installment schedule, paid vs outstanding, allocation
│
└─ MODULE 12: Developer Payouts (PAYOUTS)
   └─ Test: Initiate payout, developer visibility, duplicate handling

┌─ PHASE 5: REPORTING & ANALYTICS
│
├─ MODULE 13: Account/Finance Reports (REPORTS)
│  └─ Test: KPI cards, charts, date filters, export
│
├─ MODULE 14: Agent & Manager Performance (PERFORMANCE)
│  └─ Test: Commission tracking, pipeline analytics, targets
│
└─ MODULE 15: Admin Audit & Logging (AUDIT)
   └─ Test: Activity logs, access control metrics, data scoping

┌─ PHASE 6: CRM & DEAL MANAGEMENT
│
├─ MODULE 16: Clients Management (CLIENTS)
│  └─ Test: Create/list/update clients, agent scoping
│
├─ MODULE 17: Deals & Pipeline (DEALS)
│  └─ Test: Create deal, pipeline movement, AI insights
│
└─ MODULE 18: Commissions & Analytics (COMMISSIONS)
   └─ Test: Commission calculation, agent tracking, expected payouts

┌─ PHASE 7: NOTIFICATIONS & INTEGRATIONS
│
├─ MODULE 19: In-App Notifications (NOTIFICATIONS)
│  └─ Test: Notification creation, unread count, mark as read
│
└─ MODULE 20: Email & Webhooks (WEBHOOKS)
   └─ Test: Email delivery, DocuSeal integration, payload validation

═══════════════════════════════════════════════════════════════════════════════
PART 6: TEST DATA SETUP & SAFETY NOTES
═══════════════════════════════════════════════════════════════════════════════

AUTOMATIC TEST DATA CREATION
─────────────────────────────

For Local Development:
  1. Navigate: http://localhost:3000/setup/create-test-credentials
  2. Click "Create Credentials" button
  3. Result: 9 test users created instantly
  4. See TEST_CREDENTIALS_REFERENCE_CARD.txt for copy-paste credentials

For Contract/Deal Testing:
  Run: npm run seed:contracts (if available) or
       npx ts-node scripts/seed-contracts-test-data.ts
  Creates: 3 developers, 2 agents, 3 clients, 12+ contracts with various statuses

SAFETY RULES FOR TESTING
────────────────────────

⚠️  CRITICAL RULES:

1. LOCAL TESTING ONLY (http://localhost:3000)
   • Use local database for any write operations
   • Do NOT modify Vercel staging/production data unless explicitly approved
   • Test payment recording with MOCK amounts only

2. DATA ISOLATION
   • Use test user IDs (test-*, dev*, agent*, client*)
   • Do NOT use real customer emails
   • Do NOT create payments for real stands
   • Do NOT issue real receipts

3. CONCURRENCY & IDEMPOTENCY
   • Test payment duplicate handling (same reference)
   • Test concurrent stand reservations (should lock)
   • Test race conditions on installment allocation

4. RBAC VERIFICATION
   • Every test must verify both ALLOWED and DENIED actions
   • Attempt cross-role access and confirm 401/403 responses
   • Check that data scoping is enforced server-side (not just UI hiding)

5. EDGE CASES
   • Test with NULL/empty/invalid fields
   • Test with special characters in names
   • Test with very large numbers (prices, fees)
   • Test with dates in past/future

═══════════════════════════════════════════════════════════════════════════════
PART 7: QA AUDIT CHECKPOINT
═══════════════════════════════════════════════════════════════════════════════

GLOBAL SETUP STATUS: ✅ COMPLETE

✅ Roles identified & test credentials prepared
✅ Test infrastructure documented (local, staging, production)
✅ Dashboard module structure mapped
✅ API endpoint inventory completed (100+ routes)
✅ Module testing sequence established (20 modules across 7 phases)
✅ Safety rules and data isolation guidelines defined
✅ RBAC test matrix created

NEXT STEP: AWAIT CONFIRMATION BEFORE PROCEEDING

→ Ready to begin MODULE 1: Authentication & Session (AUTH)
→ Or request specific module to test first

═══════════════════════════════════════════════════════════════════════════════
DOCUMENTATION LINKS FOR REFERENCE
═══════════════════════════════════════════════════════════════════════════════

Test Credentials:
  • TEST_CREDENTIALS_REFERENCE_CARD.txt (this directory)
  • TEST_CREDENTIALS_SETUP_SUMMARY.md
  • TEST_CREDENTIALS_COMPLETE.md
  • TEST_CREDENTIALS_QUICK_START.md

Test Scripts:
  • scripts/seed-contracts-test-data.ts (contract seeding)
  • scripts/insert-test-credentials.js (manual credential insertion)
  • app/api/setup/create-test-credentials/route.ts (API endpoint)
  • app/setup/create-test-credentials/page.tsx (UI page)

Auth & Types:
  • types/next-auth.d.ts (role definitions)
  • lib/security.ts (security context)

═══════════════════════════════════════════════════════════════════════════════
END OF GLOBAL SETUP REPORT
═══════════════════════════════════════════════════════════════════════════════
