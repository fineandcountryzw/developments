# Developer Dashboard – Suggested Changes

Based on patterns used in **Manager**, **Agent**, and **Account** dashboards and the current Developer Dashboard + APIs, these changes align the Developer Portal with the rest of the app and fix bugs.

---

## 1. Bugs to Fix (High Priority)

### 1.1 Missing `Bell` import
- **Where:** `DeveloperDashboard.tsx` – Quick Actions use `<Bell />` for Notification Settings.
- **Issue:** `Bell` is not imported from `lucide-react`.
- **Fix:** Add `Bell` to the `lucide-react` imports.

### 1.2 Statement PDF URL
- **Where:** `handleDownloadStatement` calls `GET /api/developer/statement/pdf`.
- **Issue:** No route at `/api/developer/statement/pdf`. The real route is `GET /api/developer/statement?format=pdf`.
- **Fix:** Change fetch URL to `/api/developer/statement?format=pdf`.

### 1.3 Statement “PDF” is plain text
- **Where:** `app/api/developer/statement/route.ts` – `format=pdf` returns `generatePDFContent()` output.
- **Issue:** `generatePDFContent` returns a **string** (text). Response uses `Content-Type: application/pdf`, so viewers treat it as PDF and fail.
- **Fix:** Use **jsPDF** (like Client Statement, Receipt PDF, Manager Reports) to generate a real PDF and return it with `Content-Type: application/pdf`. Reuse patterns from `lib/receipt-pdf.ts` or `app/api/client/statement/download/route.ts`.

### 1.4 Developer-scoped developments
- **Where:** `GET /api/developer/developments` – raw SQL `WHERE d.status = 'Active'`.
- **Issue:** No filter by developer. All active developments are returned; developers should only see **their** developments (`developer_email = session.user.email`).
- **Fix:** Add `AND d.developer_email = $1` (or equivalent) and pass `userEmail`. Use parameterized queries.

### 1.5 Recent payments are synthetic
- **Where:** `app/api/developer/developments/route.ts` – `recentPayments` built from `developments.slice(0, 5).map(...)` with fake dates/types/amounts.
- **Issue:** Developers see fake “recent payments” instead of real payment data.
- **Fix:** Use real payment data. Options:
  - **A)** Add a separate `GET /api/developer/payments` call (you have `app/api/developer/payments/route.ts`) and use that for “Recent Payments” in the UI.
  - **B)** Join payments (e.g. from `Payment`, `Reservation`, or `developer_payments` if used) in the developments API and return real `recentPayments`. Prefer (A) if it keeps the API simple.

---

## 2. Align with Other Dashboards (Tabs, Charts, Layout)

### 2.1 Add `DashboardTabs` (like Manager / Agent / Account)
- **Current:** Single long page; no tabs.
- **Suggest:** Introduce tabs, e.g.:
  - **Overview** – KPIs, developments list, recent payments, quick actions (current default view).
  - **Developments** – Full developments list + filters (e.g. by status, location).
  - **Payments & Statements** – Recent payments, per-development statements, download statement PDF, export sales report.
  - **Backup & Data** – Full / developments / payments backup, “View Buyers”, notification settings (or stub).
- Use shared `DashboardTabs` + `TabItem[]` as in Manager/Agent/Account.

### 2.2 Add charts (Recharts)
- **Current:** No charts.
- **Suggest:** Add simple charts similar to Manager/Account:
  - **Revenue over time** – e.g. last 6 months (sold stands × price or actual payment data). Requires a **developer chart-data API** (e.g. `GET /api/developer/chart-data?period=6m`) that returns `{ month, revenue, standsSold }[]`.
  - **Sales mix** – e.g. Sold vs Reserved vs Available per development (Pie or Bar).
- Reuse `ResponsiveContainer`, `LineChart`, `BarChart`, `XAxis`, `YAxis`, `Tooltip`, `Legend` patterns from Manager/Agent.

### 2.3 Use `PageContainer` and `KPIGrid`
- **Current:** Custom `max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8` and ad-hoc KPI grid.
- **Suggest:** Use `PageContainer` for main content and `KPIGrid` for KPI cards (as in `ClientsModule`, `ForensicAuditTrailDashboard`, etc.). Reduces layout drift and keeps styling consistent.

### 2.4 Use `StatusBadge` for statuses
- **Current:** Inline `getStatusColor()` + `span` for payment status; manual badge styles for stand status.
- **Suggest:** Use shared `StatusBadge` from `@/components/dashboards/shared` for payment and stand statuses, with appropriate `type` values (extend `status-definitions` if needed for developer-specific statuses).

---

## 3. UX Improvements

### 3.1 “View All” for developments and recent payments
- **Current:** “View All” / “View All” buttons with no `href` or `onClick`.
- **Fix:** Either:
  - Navigate to a “Developments” or “Payments” tab (if you add tabs), or
  - Link to a dedicated route (e.g. `/dashboards/developer/developments`) that lists all developments or payments.

### 3.2 “View Buyers” – replace `alert()` with a proper UI
- **Current:** `handleViewBuyers` fetches `/api/developer/buyers` and shows `alert(message)`.
- **Suggest:** Open a **modal or slide-over** that lists buyers (name, email, optional count of stands). Use a simple table or list. Improves readability and UX.

### 3.3 “Contact Support”
- **Current:** Button with no `href` or handler.
- **Fix:** Add `mailto:` to your support email (or use a configurable support link). Same pattern as “Need Help?” elsewhere.

### 3.4 “Notification Settings”
- **Current:** `alert('Coming soon!...')`.
- **Suggest:** Keep as stub but use a **small inline notice** or **modal** saying “Coming soon” instead of `alert`. Optionally wire to `GET/PUT /api/developer/settings` when you implement notifications.

### 3.5 Sales report export – CSV vs PDF
- **Current:** Only “Export Sales Report” → CSV. API supports `format=csv|json`.
- **Suggest:** Add a **format selector** (e.g. CSV / PDF) in the UI. If PDF is desired, add PDF generation to `GET /api/developer/report/sales` (e.g. via jsPDF) and pass `format=pdf`, similar to Manager revenue report.

---

## 4. API Additions / Changes

| API | Change |
|-----|--------|
| `GET /api/developer/developments` | Filter by `developer_email = session.user.email`. Replace synthetic `recentPayments` with real data or remove and use `/api/developer/payments` in the UI. |
| `GET /api/developer/statement?format=pdf` | Generate a **real PDF** with jsPDF; remove plain-text “PDF”. |
| `GET /api/developer/chart-data` (new) | Return `{ month, revenue, standsSold }[]` for the logged-in developer’s developments (e.g. last 6 months). Used for Overview charts. |
| `GET /api/developer/report/sales` | Optional: add `format=pdf` and return a PDF report (e.g. jsPDF) for consistency with Manager exports. |

---

## 5. Quick Wins (Low Effort)

1. **Add `Bell` import** – one line.
2. **Fix statement URL** – use `?format=pdf` instead of `/statement/pdf`.
3. **Scope developments by `developer_email`** – one `WHERE` change in the developments API.
4. **Use `StatusBadge`** for payment and stand status – swap custom spans for `<StatusBadge type="..." />`.
5. **Add `mailto:` for Contact Support** – one `href` change.

---

## 6. Implementation Order

1. **Bugs:** Bell import → statement URL → developer filter → real recent payments → real statement PDF.
2. **Layout:** `PageContainer` + `KPIGrid` (no tab change yet).
3. **Tabs:** Add `DashboardTabs`, move current content into “Overview”, add “Developments” / “Payments & Statements” / “Backup & Data” tabs.
4. **Charts:** Add `GET /api/developer/chart-data`, then Overview charts.
5. **UX:** View All → tabs or routes; View Buyers → modal; Contact Support → `mailto:`; Notification Settings → stub modal.

---

## 7. Files to Touch

| File | Changes |
|------|---------|
| `components/dashboards/DeveloperDashboard.tsx` | Bell import; statement URL; tabs; `PageContainer`/`KPIGrid`; `StatusBadge`; View All / View Buyers / Contact Support / Notification Settings UX. |
| `app/api/developer/developments/route.ts` | Filter by `developer_email`; real `recentPayments` or remove. |
| `app/api/developer/statement/route.ts` | Real PDF via jsPDF for `format=pdf`. |
| `app/api/developer/chart-data/route.ts` (new) | Chart data for developer-scoped revenue/stands. |
| `app/api/developer/report/sales/route.ts` | Optional: `format=pdf` support. |
| `lib/status-definitions.ts` | Optional: developer-specific status types for `StatusBadge`. |

---

## 8. Summary

- **Fix:** Bell import, statement URL, statement PDF, developer filter, real recent payments.
- **Align:** Tabs, charts, `PageContainer`/`KPIGrid`, `StatusBadge`.
- **Improve:** View All, View Buyers modal, Contact Support `mailto:`, Notification Settings stub, optional sales PDF export.

These changes bring the Developer Dashboard in line with Manager, Agent, and Account dashboards and resolve the current bugs and UX gaps.
