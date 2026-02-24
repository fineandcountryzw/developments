# Billing Allocations and Reconciliation - Forensic Audit

Date: 2026-02-06
Scope: Billing allocations, ledger, reconciliation UI, API, and service

## Verified Findings

1) UI/API contract mismatches
- Ledger API returns `data.ledger`, UI expects `data.entries`.
- Allocations API returns `data.allocations` with fields `type`, `status`, `allocatedAt`, and nested `payment.clientName`; UI expects flat fields `allocationType`, `allocationStatus`, `createdAt`, `clientName`.
- Reconcile API returns `data.reports` + `data.summary`; UI expects a single `ReconciliationSummary` with `issues`.
Impact: allocations and reconciliation render as empty or zero counts even when data exists.

2) Allocation balance checks happen outside the write transaction
- `createAllocation()` reads total allocated amount before the transaction.
Impact: concurrent allocations can over-allocate or return stale remaining amounts.

3) Allocation reversal uses a stale snapshot
- `reverseAllocation()` reads allocation + installment outside the transaction.
Impact: reversal can compute paid/remaining values from stale data.

4) Reconciliation reports lack plan context
- Payment-level reconcile output sets `installmentPlanId` to null.
Impact: UI cannot offer auto-allocation because it lacks plan context.

5) Manual allocation amount parsing is not normalized
- The POST body can provide a string amount, but the API does not coerce it to a number.
Impact: validation can pass invalid values to the service.

## Fixes Implemented or In Progress

- Align Billing UI mapping to the API response shapes for ledger, allocations, and reconciliation.
- Add transaction-level balance checks and recomputation in the allocation service.
- Include plan context in payment-level reconciliation reports when determinable.
- Normalize manual allocation amounts in the API before calling the service.

## Remaining Work

- Add regression coverage for reconciliation actions (auto-allocate, flag discrepancies).
- Validate concurrency behavior under load and confirm ledger totals after reversals.
