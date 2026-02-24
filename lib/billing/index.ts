/**
 * Billing Module
 * Fine & Country Zimbabwe ERP
 * 
 * Unified billing management for payments, installments, and allocations.
 * 
 * Features:
 * - Payment allocation to installments (manual and auto)
 * - Unified billing ledger view
 * - Reconciliation and discrepancy detection
 * - Full audit trail for all allocations
 * 
 * API Endpoints:
 * - GET  /api/admin/billing/ledger - Unified payment/allocation ledger
 * - GET  /api/admin/billing/allocations - List allocations
 * - POST /api/admin/billing/allocations - Create allocation (manual/auto)
 * - GET  /api/admin/billing/allocations/[id] - Get allocation details
 * - DELETE /api/admin/billing/allocations/[id] - Reverse allocation
 * - GET  /api/admin/billing/reconcile - Run reconciliation check
 * - POST /api/admin/billing/reconcile - Trigger reconciliation actions
 */

export { BillingAllocationService } from './allocation-service';
export type {
  AllocationType,
  AllocationRequest,
  AllocationResult,
  AutoAllocationResult,
  LedgerEntry,
  ReconciliationReport
} from './allocation-service';
