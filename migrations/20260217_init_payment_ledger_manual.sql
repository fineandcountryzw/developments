
-- Manual Migration for Payment Ledger Refactoring (2026)

-- 1. Create Enums
CREATE TYPE "InvoiceStatus" AS ENUM ('DRAFT', 'ISSUED', 'PARTIALLY_PAID', 'PAID', 'VOID', 'OUTSTANDING');
CREATE TYPE "Currency" AS ENUM ('USD', 'ZWL', 'ZAR');
CREATE TYPE "PaymentMethod" AS ENUM ('CASH', 'BANK', 'ECOCASH', 'ZIPIT', 'TRANSFER', 'OTHER');
CREATE TYPE "PaymentSource" AS ENUM ('MANUAL', 'IMPORT', 'API', 'MIGRATED');
CREATE TYPE "TransactionStatus" AS ENUM ('PENDING', 'COMPLETED', 'FAILED', 'VOID');
CREATE TYPE "SaleType" AS ENUM ('RESERVATION', 'AOS', 'CESSION', 'CASH');
CREATE TYPE "SaleStatus" AS ENUM ('DRAFT', 'ACTIVE', 'CANCELLED', 'COMPLETED');

-- 2. Update Invoice Status
-- Alter column to use Enum. CAST existing content.
-- Handle existing "OUTSTANDING" string if compatible or map it.
-- Since we added OUTSTANDING to enum, we can cast directly.
ALTER TABLE "invoices" ALTER COLUMN "status" TYPE "InvoiceStatus" USING "status"::"InvoiceStatus";
ALTER TABLE "invoices" ALTER COLUMN "status" SET DEFAULT 'OUTSTANDING';

-- 3. Create Sale Table
CREATE TABLE "sales" (
    "id" TEXT NOT NULL,
    "client_id" TEXT NOT NULL,
    "development_id" TEXT NOT NULL,
    "stand_id" TEXT,
    "saleType" "SaleType" NOT NULL,
    "currency" "Currency" NOT NULL DEFAULT 'USD',
    "principal_amount" DECIMAL(12,2) NOT NULL,
    "vat_amount" DECIMAL(12,2),
    "admin_fees" DECIMAL(12,2),
    "total_amount" DECIMAL(12,2) NOT NULL,
    "status" "SaleStatus" NOT NULL DEFAULT 'DRAFT',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "sales_pkey" PRIMARY KEY ("id")
);

-- 4. Create PaymentTransaction Table
CREATE TABLE "payment_transactions" (
    "id" TEXT NOT NULL,
    "posted_at" TIMESTAMP(3) NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "currency" "Currency" NOT NULL DEFAULT 'USD',
    "method" "PaymentMethod" NOT NULL,
    "reference" TEXT,
    "external_id" TEXT,
    "idempotency_key" TEXT NOT NULL,
    "memo" TEXT,
    "client_id" TEXT NOT NULL,
    "sale_id" TEXT,
    "invoice_id" TEXT,
    "development_id" TEXT,
    "stand_id" TEXT,
    "source" "PaymentSource" NOT NULL DEFAULT 'MANUAL',
    "status" "TransactionStatus" NOT NULL DEFAULT 'COMPLETED',
    "created_by_user_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "payment_transactions_pkey" PRIMARY KEY ("id")
);

-- 5. Create LedgerAllocation Table
CREATE TABLE "ledger_allocations" (
    "id" TEXT NOT NULL,
    "payment_transaction_id" TEXT NOT NULL,
    "invoice_id" TEXT NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ledger_allocations_pkey" PRIMARY KEY ("id")
);

-- 6. Add Foreign Keys and Indexes

-- Sales
CREATE INDEX "sales_client_id_idx" ON "sales"("client_id");
CREATE INDEX "sales_development_id_idx" ON "sales"("development_id");
CREATE INDEX "sales_stand_id_idx" ON "sales"("stand_id");
ALTER TABLE "sales" ADD CONSTRAINT "sales_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "clients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "sales" ADD CONSTRAINT "sales_development_id_fkey" FOREIGN KEY ("development_id") REFERENCES "developments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "sales" ADD CONSTRAINT "sales_stand_id_fkey" FOREIGN KEY ("stand_id") REFERENCES "stands"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- PaymentTransactions
CREATE UNIQUE INDEX "payment_transactions_idempotency_key_key" ON "payment_transactions"("idempotency_key");
CREATE INDEX "payment_transactions_client_id_posted_at_idx" ON "payment_transactions"("client_id", "posted_at");
CREATE INDEX "payment_transactions_sale_id_posted_at_idx" ON "payment_transactions"("sale_id", "posted_at");
CREATE INDEX "payment_transactions_invoice_id_posted_at_idx" ON "payment_transactions"("invoice_id", "posted_at");
CREATE INDEX "payment_transactions_development_id_idx" ON "payment_transactions"("development_id");
CREATE INDEX "payment_transactions_stand_id_idx" ON "payment_transactions"("stand_id");

ALTER TABLE "payment_transactions" ADD CONSTRAINT "payment_transactions_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "clients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "payment_transactions" ADD CONSTRAINT "payment_transactions_sale_id_fkey" FOREIGN KEY ("sale_id") REFERENCES "sales"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "payment_transactions" ADD CONSTRAINT "payment_transactions_invoice_id_fkey" FOREIGN KEY ("invoice_id") REFERENCES "invoices"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "payment_transactions" ADD CONSTRAINT "payment_transactions_development_id_fkey" FOREIGN KEY ("development_id") REFERENCES "developments"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "payment_transactions" ADD CONSTRAINT "payment_transactions_stand_id_fkey" FOREIGN KEY ("stand_id") REFERENCES "stands"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- LedgerAllocations
CREATE INDEX "ledger_allocations_payment_transaction_id_idx" ON "ledger_allocations"("payment_transaction_id");
CREATE INDEX "ledger_allocations_invoice_id_idx" ON "ledger_allocations"("invoice_id");

ALTER TABLE "ledger_allocations" ADD CONSTRAINT "ledger_allocations_payment_transaction_id_fkey" FOREIGN KEY ("payment_transaction_id") REFERENCES "payment_transactions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ledger_allocations" ADD CONSTRAINT "ledger_allocations_invoice_id_fkey" FOREIGN KEY ("invoice_id") REFERENCES "invoices"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Update Invoices
ALTER TABLE "invoices" ADD COLUMN "sale_id" TEXT;
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_sale_id_fkey" FOREIGN KEY ("sale_id") REFERENCES "sales"("id") ON DELETE SET NULL ON UPDATE CASCADE;
