# Payment Ledger Migration Guide

## Overview

This document outlines the migration from legacy payment tables to the canonical PaymentTransaction ledger.

## Legacy Tables (Read-Only)

The following tables are now **DEPRECATED** - do not write to them:

1. **Payment** - Old payment records
2. **PaymentAllocation** - Legacy allocations
3. **InstallmentPlan** - Old installment plans  
4. **Installment** - Individual installments

## Canonical Tables (Write Here)

1. **PaymentTransaction** - The single source of truth for all payments
2. **LedgerAllocation** - For splitting payments across invoices

## Migration Status

| Table | Status | Records | Action |
|-------|--------|---------|--------|
| Payment | DEPRECATED | TBD | Migrate to PaymentTransaction |
| PaymentTransaction | ACTIVE | TBD | - |
| PaymentAllocation | DEPRECATED | TBD | Migrate to LedgerAllocation |
| LedgerAllocation | ACTIVE | TBD | - |

## Migration Script

### Step 1: Count Legacy Records

```sql
-- Count legacy payment records
SELECT COUNT(*) as total_payments FROM payments;
SELECT COUNT(*) as total_allocations FROM payment_allocations;
```

### Step 2: Generate Idempotency Keys

Each legacy record needs an idempotency key for migration:

```sql
-- Generate idempotency keys for payments
ALTER TABLE payments ADD COLUMN IF NOT EXISTS migration_idempotency_key VARCHAR(255);

UPDATE payments 
SET migration_idempotency_key = CONCAT('migrated-payment-', id)
WHERE migration_idempotency_key IS NULL;
```

### Step 3: Migrate Payments to PaymentTransaction

```sql
INSERT INTO payment_transactions (
    id,
    posted_at,
    amount,
    currency,
    method,
    reference,
    external_id,
    idempotency_key,
    memo,
    client_id,
    sale_id,
    invoice_id,
    development_id,
    stand_id,
    source,
    status,
    created_by_user_id,
    created_at,
    updated_at
)
SELECT 
    -- id
    CONCAT('migrated-', id),
    -- posted_at (use created_at for legacy)
    created_at,
    -- amount
    amount,
    -- currency (default to USD)
    'USD'::currency,
    -- method (convert from legacy method string)
    CASE 
        WHEN LOWER(method) = 'cash' THEN 'CASH'::paymentmethod
        WHEN LOWER(method) = 'bank' THEN 'BANK'::paymentmethod
        WHEN LOWER(method) = 'ecocash' THEN 'ECOCASH'::paymentmethod
        ELSE 'OTHER'::paymentmethod
    END,
    -- reference
    COALESCE(reference, manual_receipt_no),
    -- external_id (null for legacy)
    NULL,
    -- idempotency_key
    CONCAT('migrated-payment-', id),
    -- memo
    description,
    -- client_id
    client_id,
    -- sale_id (null for legacy - will need manual mapping if needed)
    NULL,
    -- invoice_id (null for legacy)
    NULL,
    -- development_id
    development_id,
    -- stand_id
    stand_id,
    -- source (mark as migrated)
    'MIGRATED'::paymentsource,
    -- status (convert from legacy status)
    CASE 
        WHEN status = 'CONFIRMED' THEN 'COMPLETED'::transactionstatus
        WHEN status = 'VOIDED' THEN 'VOID'::transactionstatus
        WHEN status = 'PENDING' THEN 'PENDING'::transactionstatus
        ELSE 'PENDING'::transactionstatus
    END,
    -- created_by_user_id (null for legacy)
    NULL,
    -- created_at
    created_at,
    -- updated_at
    updated_at
FROM payments
ON CONFLICT (idempotency_key) DO NOTHING;
```

### Step 4: Verify Migration

```sql
-- Check counts match
SELECT 
    (SELECT COUNT(*) FROM payment_transactions WHERE source = 'MIGRATED') as migrated_count,
    (SELECT COUNT(*) FROM payments) as legacy_count;

-- Sample verify
SELECT * FROM payment_transactions 
WHERE source = 'MIGRATED' 
LIMIT 10;
```

### Step 5: Post-Migration (After Verification)

Once migration is verified, add a database constraint to prevent writes to legacy tables:

```sql
-- Create a trigger to prevent new writes to payments table
CREATE OR REPLACE FUNCTION prevent_payments_write()
RETURNS TRIGGER AS $$
BEGIN
    RAISE EXCEPTION 'ERROR: Writing to deprecated payments table is not allowed. Use payment_transactions instead.';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER payments_write_blocker
BEFORE INSERT OR UPDATE OR DELETE ON payments
FOR EACH ROW EXECUTE FUNCTION prevent_payments_write();
```

## API Changes

### Old Routes (Still work for reading legacy data)

- GET/POST `/api/payments/unified` - Reads from both tables

### New Routes (Canonical)

- GET/POST `/api/payments` - Uses PaymentTransaction only
- GET `/api/clients/[id]/statement` - Uses PaymentTransaction only
- POST `/api/invoices/[id]/pay` - Uses PaymentTransaction only

## Feature Flag

To control the migration, you can use environment variable:

```
# Set to "true" to only allow writes to PaymentTransaction
PAYMENTS_LEDGER_ONLY=true
```

When enabled, attempts to write to legacy tables will be rejected.

## Rollback Plan

If issues are found:

1. Remove the trigger:
```sql
DROP TRIGGER IF EXISTS payments_write_blocker ON payments;
```

2. The legacy data is preserved - can continue using it.

## Testing Checklist

- [ ] Create payment via API - appears in PaymentTransaction
- [ ] List payments via API - returns from PaymentTransaction
- [ ] Client statement - shows payments from PaymentTransaction
- [ ] Invoice payment - updates invoice status correctly
- [ ] CSV import - idempotency prevents duplicates
- [ ] Stand status updates - correctly set to SOLD when paid
