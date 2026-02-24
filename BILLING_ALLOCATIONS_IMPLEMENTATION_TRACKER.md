# Billing Allocations - Implementation Tracker

Start Date: 2026-02-06
Status: In Progress

## Phase 1 - Contract Alignment (UI <-> API)
- [x] Map ledger UI to `data.ledger`
- [x] Map allocations UI to `data.allocations`
- [x] Map reconciliation UI to `data.reports` and build issues list
- [ ] Verify ledger totals and expanded allocation view

## Phase 2 - Service Consistency
- [x] Move allocation balance checks into transaction
- [x] Use transactional reads for reversal
- [x] Add plan context to payment-level reconciliation
- [ ] Review auto-allocation behavior for concurrent requests

## Phase 3 - API Validation
- [x] Normalize manual allocation amounts in API
- [x] Add response shape tests for ledger, allocations, reconciliation

## Phase 4 - Tests
- [x] Add API tests for allocations and reconciliation
- [x] Add service tests for create/reverse allocation

## Phase 5 - QA
- [ ] Run manual allocation and reversal scenarios
- [ ] Run reconciliation checks and verify issues render
