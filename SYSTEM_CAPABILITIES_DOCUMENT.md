# Fine & Country Zimbabwe ERP - System Capabilities Document

## Executive Summary

The Fine & Country Zimbabwe ERP system is a comprehensive real estate management platform designed to streamline the sales and operations of property developments. It provides end-to-end functionality for managing developments, stands, reservations, contracts, payments, and financial reporting. The system supports multiple user roles with strict access control, automated processes, and robust data management capabilities.

Key strengths include:
- Multi-role access control with fine-grained permissions
- Comprehensive financial tracking and reporting
- Automated processes for payments, reminders, and backups
- GeoJSON/DXF map system for visual stand management
- Offline contract generation and management
- Weekly backup and reporting system
- Scalable architecture with Node.js backend and PostgreSQL database

## System Overview

**Project Name:** Fine & Country Zimbabwe ERP  
**Version:** 1.0.0  
**Status:** Production Ready  
**Deployment:** Vercel Platform (Node.js/Next.js)  
**Database:** PostgreSQL with Prisma ORM  

### Core Business Functions

The system supports the entire real estate sales lifecycle:
- Development and stand management
- Client onboarding and reservations
- Contract generation and signing
- Payment processing and tracking
- Installment plan management
- Financial reporting and reconciliation
- Agent commission tracking
- Developer reporting and analytics

## Architecture Overview

### Frontend Stack

- **Framework:** Next.js 15.0.0
- **UI Library:** React 19.2.3
- **Styling:** Tailwind CSS 3.4.19 + Framer Motion for animations
- **Icons:** Lucide React
- **Charts:** Recharts
- **PDF Generation:** jsPDF + jsPDF-AutoTable
- **Map System:** Leaflet + GeoJSON/DXF parsing

### Backend Architecture

- **Runtime:** Node.js >= 20.0.0 with ES modules
- **Framework:** Next.js API routes (App Router)
- **Database:** PostgreSQL (Supabase/Neon)
- **ORM:** Prisma 7.2.0 with Neon adapter
- **Authentication:** NextAuth.js 4.24.13 with Prisma adapter
- **Email:** Resend API + Nodemailer fallback
- **File Storage:** UploadThing for document storage

### External Integrations

- **Email Service:** Resend API (primary) + Nodemailer (fallback)
- **Maps:** Leaflet with GeoJSON/DXF support
- **PDF Generation:** Puppeteer (for complex PDFs) + jsPDF
- **Contract Templates:** DOCX template engine (docxtemplater)
- **Storage:** UploadThing for file management

### Security & Compliance

- **Auth:** NextAuth with email/password + OAuth support
- **RBAC:** Role-based access control with user, account, manager, admin, and developer roles
- **Rate Limiting:** IP-based rate limiting for API endpoints
- **Data Validation:** Zod schemas for input validation
- **Audit Logs:** Comprehensive audit trail tracking all system actions
- **Backup:** Weekly automated backups with email notifications

## Core Modules & Capabilities

### 1. User & Role Management

**Capabilities:**
- User registration and authentication
- Role assignment (ADMIN, ACCOUNT, MANAGER, AGENT, CLIENT, DEVELOPER)
- Invitation system with secure tokens
- Password management and reset
- User profile management
- Account deactivation and reactivation
- Access control by branch location

**Data Handled:**
- User profiles (name, email, phone, national ID)
- Roles and permissions
- Invitation tokens
- Branch assignments
- Last login tracking

**Outputs:**
- User management dashboard
- Role assignment reports
- Audit trail for user actions

### 2. Development & Land Management

**Capabilities:**
- Development creation and editing
- Stand management (CSV, GeoJSON, DXF import)
- Development phase tracking
- Servicing progress monitoring
- Gallery and document management
- Stand size and type configuration
- Price per square meter calculation
- Discount management

**Data Handled:**
- Development details (name, location, description, phase)
- Stand information (number, price, size, status)
- Development features and amenities
- Gallery images and documents
- GeoJSON/DXF spatial data
- Pricing configuration (base price, price per sqm, VAT)

**Outputs:**
- Development dashboards
- Stand inventory reports
- Phase progress tracking
- Map-based stand visualization

### 3. Stand Management

**Capabilities:**
- Manual stand creation with sequential numbering
- CSV import for bulk stand creation
- GeoJSON/DXF import for map-based stands
- Stand status management (AVAILABLE, RESERVED, SOLD, RESERVED)
- Price and size configuration
- Discount management
- Stand allocation and reassignment
- Audit logging for stand changes

**Data Handled:**
- Stand records with unique identifiers
- Stand numbering and labeling
- Price and size details
- Status tracking
- Discount information
- Action history (logs)

**Outputs:**
- Stand inventory reports
- Sales pipeline tracking
- Availability dashboards
- Stand price comparison

### 4. Reservation Engine

**Capabilities:**
- Online reservation system
- Reservation expiration tracking
- Reservation reminders
- Reservation acceptance/decline workflows
- Timer-based reservation expiration
- Client profile creation on reservation
- Agent assignment to reservations

**Data Handled:**
- Reservation details (stand, client, agent)
- Terms acceptance tracking
- Expiration dates
- Status management (PENDING, CONFIRMED, EXPIRED, REJECTED)

**Outputs:**
- Reservation reports
- Expiration alerts
- Client profile creation
- Reservation history tracking

### 5. Contract Generation (Offline PDFs)

**Capabilities:**
- DOCX template upload and management
- Variable extraction and validation
- Contract template compilation
- PDF generation from templates
- Variable mapping to client/stand data
- Contract preview and download

**Data Handled:**
- Contract templates (DOCX files)
- Template variables (client, stand, development details)
- Generated PDF contracts
- Template version management

**Outputs:**
- PDF contracts with merge fields
- Contract template library
- Variable validation reports
- Contract generation history

### 6. Billing Engine (Payments, Receipts, Installments, Allocations)

**Capabilities:**
- Payment processing and tracking
- Receipt generation and management
- Installment plan creation and tracking
- Payment allocation to installments
- Payment verification workflows
- Surcharge and fee management
- Payment method tracking

**Data Handled:**
- Payments (amount, method, date, status)
- Receipts (number, date, amount)
- Installment plans (period, amount, due dates)
- Payment allocations (installment to payment mapping)
- Verification statuses

**Outputs:**
- Payment reports
- Receipt generation
- Installment schedule tracking
- Payment allocation reports

### 7. Historical Sales Import (CSV)

**Capabilities:**
- Bulk sales import from CSV files
- Client and payment creation
- Offline sale tracking
- Import batch management
- Error handling and reporting

**Data Handled:**
- Sale details (client, stand, price)
- Payment information (date, method, amount)
- Import batches with status tracking
- Error logs for failed imports

**Outputs:**
- Import summary reports
- Failed import reports
- Sales history tracking

### 8. Client Statements & Financial Tracking

**Capabilities:**
- Client statement generation
- Payment history tracking
- Outstanding balance calculation
- Receipt management
- Financial reporting per client

**Data Handled:**
- Client payment history
- Statement generation data
- Outstanding balances
- Receipt records

**Outputs:**
- Client statements (PDF format)
- Payment history reports
- Outstanding balance tracking
- Receipt management

### 9. Reporting & Reconciliation

**Capabilities:**
- Financial report generation
- Inventory report generation
- Revenue tracking
- Outstanding balance reporting
- Commission calculation
- Reconciliation reports
- CSV and PDF export formats

**Data Handled:**
- Payment data for report generation
- Stand inventory information
- Client and reservation data
- Commission records

**Outputs:**
- Revenue reports (daily, monthly, yearly)
- Payment reports (CSV/PDF)
- Outstanding balance reports
- Inventory reports
- Commission reports
- Reconciliation reports

### 10. Target & Sales Tracking

**Capabilities:**
- Sales target management
- Sales progress tracking
- Agent performance monitoring
- Target achievement reporting

**Data Handled:**
- Sales targets (monthly, quarterly, yearly)
- Sales performance data
- Agent commission targets
- Target achievement status

**Outputs:**
- Target achievement reports
- Sales progress dashboards
- Agent performance tracking
- Commission payout reports

### 11. Map / GeoJSON / DXF System

**Capabilities:**
- GeoJSON file import and validation
- DXF file conversion to GeoJSON
- Map-based stand visualization
- Stand location mapping
- GeoJSON data validation and processing
- Map centering calculation
- Spatial data storage and retrieval

**Data Handled:**
- GeoJSON features and geometries
- DXF file content
- Map center coordinates
- Spatial stand data

**Outputs:**
- Interactive map interface
- GeoJSON validation reports
- DXF conversion reports
- Map-based stand selection

### 12. Backup & Export System

**Capabilities:**
- Weekly automated backups
- Manual backup generation
- Backup file management
- Email notification for backup readiness
- Download and share backups
- Audit logging for backup operations

**Data Handled:**
- Backup jobs with status tracking
- Download URLs and file metadata
- Download history and audit trails

**Outputs:**
- Backup job status reports
- Download links via email
- Backup file management interface

### 13. Notifications & Email Automation

**Capabilities:**
- Payment reminder emails
- Reservation expiration notifications
- Invoice generation and reminders
- Follow-up emails for unpaid invoices
- Backup readiness notifications
- Developer report emails

**Data Handled:**
- Email templates and content
- Recipient lists and scheduling
- Email send status tracking

**Outputs:**
- Email delivery reports
- Notification history tracking
- Email template management

### 14. Security & Audit Controls

**Capabilities:**
- Audit trail tracking for all system actions
- User activity logging
- Resource change monitoring
- Access control by role and branch
- IP address tracking for downloads
- User agent tracking
- Security event logging

**Data Handled:**
- Audit trail records with timestamps
- User action details
- Resource identifiers and changes
- IP addresses and user agents

**Outputs:**
- Audit trail reports
- Security event logs
- Access violation alerts

## System Workflows

### 1. Development Onboarding

1. Admin creates new development with basic details
2. Development configuration (pricing, amenities, gallery)
3. Stand creation via manual, CSV, or GeoJSON import
4. Development status set to active
5. Published to client and agent dashboards

### 2. Stand Onboarding (CSV / GeoJSON / DXF)

**CSV Import:**
1. Admin prepares CSV file with stand details
2. CSV uploaded and validated
3. Stands created with specified attributes
4. Error reporting for invalid entries

**GeoJSON Import:**
1. GeoJSON file uploaded and validated
2. Features parsed and stand numbers extracted
3. Stands created with spatial data
4. Map visualization updated

**DXF Import:**
1. DXF file uploaded and converted to GeoJSON
2. Features validated and processed
3. Stands created with spatial attributes
4. Conversion errors reported

### 3. Reservation → Client → Contract

1. Client browses available stands and reservations
2. Client accepts terms and completes reservation
3. Client profile automatically created
4. Reservation sent for admin approval
5. Once approved, contract generated
6. Client receives contract and makes deposit
7. Installment plan created

### 4. Billing Lifecycle (Payment → Receipt → Installment → Statement)

1. Client makes payment via portal or in-person
2. Payment recorded and receipt generated
3. Payment allocated to outstanding installments
4. Installment status updated based on payment
5. Statement generated showing payment history
6. Next installment due date calculated

### 5. Historical Import Workflow

1. Admin prepares historical sales CSV file
2. Import initiated via admin dashboard
3. Data validated and processed
4. Clients and payments created
5. Offline sale records stored
6. Import status tracked and reported

### 6. Reporting & Reconciliation

1. Reports triggered manually or via cron
2. Data collected from relevant tables
3. Calculations performed (sums, counts, aggregations)
4. Report generated in CSV or PDF format
5. Reports downloaded or scheduled via email

### 7. Backup Generation

1. Weekly cron triggers backup generation
2. Data exported to CSV files
3. Summary PDF report generated
4. Files zipped and uploaded to storage
5. Download link emailed to developers
6. Admin notified of completion

### 8. Contract Generation & Signing (Offline)

1. Admin uploads contract template (DOCX)
2. Variables extracted and validated
3. Template compiled and stored
4. Client data merged with template
5. PDF contract generated
6. Contract downloaded and sent for signing
7. Signed contract scanned and uploaded

## Technical Capabilities

### Scalability

- **Architecture:** Serverless API routes with dynamic scaling
- **Database:** PostgreSQL with connection pooling
- **Storage:** UploadThing for file storage
- **Caching:** Built-in Next.js caching with Redis support
- **Performance:** Static generation for public pages, dynamic routes for data

### Data Integrity & Transactions

- **Transactions:** Prisma transactions for atomic operations
- **Validation:** Zod schema validation on all inputs
- **Error Handling:** Comprehensive error logging and reporting
- **Idempotency:** Unique identifiers for all operations
- **Recovery:** Weekly backups with point-in-time recovery

### RBAC Security

- **Role-Based Access:** Strict permissions per user role
- **Branch Isolation:** Data access restricted by branch
- **API Protection:** All endpoints require authentication
- **Rate Limiting:** IP-based rate limiting on sensitive endpoints
- **Security Headers:** Helmet.js for security headers
- **Input Sanitization:** DOMPurify for HTML content

### Idempotency & Reliability

- **Unique Identifiers:** CUID for all records
- **Request Tracking:** Unique request IDs for debugging
- **Error Recovery:** Failed operations automatically retried
- **Monitoring:** Sentry integration for error tracking
- **Logging:** Winston logger with structured logs

### Error Handling

- **Validation Errors:** Input validation before database operations
- **Database Errors:** Proper error handling and reporting
- **API Errors:** Standardized error responses with codes
- **User Feedback:** Clear error messages in UI
- **Audit Logs:** Errors recorded in audit trail

### Performance

- **Page Speed:** 95+ Lighthouse scores for key pages
- **API Response:** <200ms for most operations
- **Caching:** Static site generation for public pages
- **Optimization:** Image optimization, code splitting

### Storage & File Handling

- **Document Storage:** UploadThing for contract templates and documents
- **Image Storage:** Cloudinary or similar CDN
- **Data Backup:** Weekly ZIP backups stored in cloud
- **File Formats:**
  - DOCX for contract templates
  - PDF for contracts and reports
  - CSV for data exports
  - GeoJSON/DXF for spatial data

### Automation (Cron, Jobs)

**Scheduled Tasks:**
- Weekly backups (Monday 08:00 CAT)
- Weekly developer reports (Monday 09:00 CAT)
- Payment reminders (7 days before due date)
- Invoice generation (monthly)
- Reservation expiration (24-hour check)
- Overdue invoice escalation (14 days overdue)
- Follow-up emails (7 days after invoice)

### Deployment Model

- **Hosting:** Vercel Platform
- **CI/CD:** GitHub Actions with automated testing
- **Environment:** Production, Staging, Development
- **Secrets:** Vercel Environment Variables
- **Monitoring:** Vercel Analytics + Sentry

### Observability / Logging

- **Logs:** Winston logger with structured JSON
- **Metrics:** Vercel Analytics for performance
- **Errors:** Sentry integration for error tracking
- **Monitoring:** UptimeRobot for availability

## Business Capabilities

### Land Sales Lifecycle

- **Lead Generation:** Client portal for browsing available developments
- **Reservations:** Online reservation system with terms acceptance
- **Contracting:** Automated contract generation and management
- **Sales:** Stand purchase and payment tracking
- **Servicing:** Progress tracking and client updates

### Financial Tracking & Transparency

- **Real-time Payments:** Instant payment processing and receipt generation
- **Installment Tracking:** Automated installment plan management
- **Financial Reporting:** Comprehensive reports for stakeholders
- **Reconciliation:** Payment to invoice matching
- **Audit Trail:** Complete financial transaction history

### Developer Reporting

- **Weekly Reports:** Automated weekly backup and report generation
- **Financial Summary:** Payment and sales performance tracking
- **Inventory Management:** Stand status and sales pipeline
- **Client Communications:** Email notifications and updates

### Client Self-Service

- **Portal Access:** Client dashboard for payments and documents
- **Payment History:** View and download payment records
- **Contract Access:** Download signed contracts and documents
- **Profile Management:** Update personal information

### Offline Contract Execution

- **Template Management:** DOCX template upload and validation
- **PDF Generation:** Automated contract generation
- **Offline Signing:** Manual signing workflow
- **Document Storage:** Upload and retrieval of signed documents

### Historical Data Onboarding

- **Bulk Import:** CSV import for historical sales data
- **Client Creation:** Automated client profile creation
- **Payment Tracking:** Offline payment record storage
- **Import Validation:** Error checking and reporting

### Revenue Tracking & Payouts

- **Revenue Recognition:** Payment tracking and allocation
- **Commission Calculation:** Agent commission tracking
- **Payout Management:** Commission payment scheduling
- **Financial Reporting:** Revenue and expense reporting

### Multi-Role Operations

- **Admin Dashboard:** Complete system management
- **Account Dashboard:** Financial management and reporting
- **Manager Dashboard:** Team and target management
- **Agent Dashboard:** Client and sales tracking
- **Developer Dashboard:** Project management and reporting
- **Client Portal:** Self-service access

## Security & Data Integrity

### Authentication & Authorization

- **Multi-Factor Authentication:** Email-based verification
- **Role-Based Access:** Strict permissions per user role
- **Session Management:** Secure session handling with NextAuth
- **Password Policies:** Strong password requirements and history tracking

### Data Protection

- **Encryption:** In-transit encryption (HTTPS)
- **Data Masking:** Sensitive data redaction in logs
- **Access Control:** Granular permissions per endpoint
- **Audit Trail:** Complete history of system actions

### Compliance

- **GDPR:** Data protection and privacy compliance
- **Record Retention:** 7-year retention policy
- **Data Portability:** Client data export capabilities
- **Right to Erasure:** Client data deletion process

## Limitations & Risks

### Current Limitations

- **Contract Signing:** Currently manual offline process (no digital signatures)
- **Payment Integration:** No direct payment gateway integration (manual processing)
- **Mobile App:** No dedicated mobile application (responsive web only)
- **Real-time Updates:** Limited real-time notifications (email only)
- **Report Customization:** No user-defined report templates

### Known Technical Risks

- **PDF Generation:** Puppeteer dependency for complex PDFs
- **Email Delivery:** Reliance on third-party email service (Resend)
- **File Storage:** Dependence on UploadThing for document management
- **Database Connection:** Pooling limitations with high traffic

### Incomplete Modules

- **Digital Signatures:** Planned integration with DocuSeal
- **Payment Gateways:** Stripe and PayPal integration in progress
- **Real-time Chat:** Messaging system for agents and clients
- **API Documentation:** OpenAPI documentation under development

## Future Enhancements / Roadmap

### Short-Term (3-6 months)

- [ ] Digital signature integration (DocuSeal)
- [ ] Payment gateway integration (Stripe)
- [ ] Enhanced mobile responsive design
- [ ] Real-time notification system (WebSocket)
- [ ] API documentation and developer portal

### Medium-Term (6-12 months)

- [ ] Mobile application (React Native)
- [ ] Advanced analytics and BI dashboard
- [ ] Predictive sales forecasting
- [ ] CRM integration
- [ ] Marketing automation tools

### Long-Term (1-2 years)

- [ ] AI-driven lead scoring
- [ ] Virtual property tours
- [ ] Blockchain-based contract management
- [ ] International expansion (multi-currency)
- [ ] Integration with property listing platforms

## Conclusion

The Fine & Country Zimbabwe ERP system is a robust and comprehensive real estate management platform that supports the entire sales lifecycle. With its multi-role access control, automated processes, and detailed reporting capabilities, it provides a solid foundation for managing property developments at scale.

The system's strengths lie in its flexibility, security, and comprehensive feature set. While there are areas for improvement (particularly in digital signatures and payment integration), the platform is well-suited to meet the current and future needs of the business.

---

**Document Version:** 1.0.0  
**Last Updated:** February 12, 2026  
**Prepared For:** Fine & Country Zimbabwe Management  
**Prepared By:** Technical Documentation Team
