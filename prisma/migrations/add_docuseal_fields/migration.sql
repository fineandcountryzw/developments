-- DocuSeal E-Signature Integration Fields
-- This migration adds fields to support DocuSeal e-signature workflow

-- Add DocuSeal fields to GeneratedContract (primary contract model)
ALTER TABLE "generated_contracts" ADD COLUMN IF NOT EXISTS "docuseal_submission_id" TEXT;
ALTER TABLE "generated_contracts" ADD COLUMN IF NOT EXISTS "docuseal_status" TEXT;
ALTER TABLE "generated_contracts" ADD COLUMN IF NOT EXISTS "docuseal_signer_client_id" INTEGER;
ALTER TABLE "generated_contracts" ADD COLUMN IF NOT EXISTS "docuseal_signer_client_status" TEXT;
ALTER TABLE "generated_contracts" ADD COLUMN IF NOT EXISTS "docuseal_signer_dev_id" INTEGER;
ALTER TABLE "generated_contracts" ADD COLUMN IF NOT EXISTS "docuseal_signer_dev_status" TEXT;
ALTER TABLE "generated_contracts" ADD COLUMN IF NOT EXISTS "signed_pdf_url" TEXT;
ALTER TABLE "generated_contracts" ADD COLUMN IF NOT EXISTS "sent_for_signature_at" TIMESTAMPTZ;
ALTER TABLE "generated_contracts" ADD COLUMN IF NOT EXISTS "fully_signed_at" TIMESTAMPTZ;
ALTER TABLE "generated_contracts" ADD COLUMN IF NOT EXISTS "developer_email" TEXT;
ALTER TABLE "generated_contracts" ADD COLUMN IF NOT EXISTS "developer_name" TEXT;

-- Add DocuSeal fields to Contract (modern contract model)
ALTER TABLE "contracts" ADD COLUMN IF NOT EXISTS "docuseal_submission_id" INTEGER;
ALTER TABLE "contracts" ADD COLUMN IF NOT EXISTS "docuseal_status" TEXT;
ALTER TABLE "contracts" ADD COLUMN IF NOT EXISTS "docuseal_signer_client_id" INTEGER;
ALTER TABLE "contracts" ADD COLUMN IF NOT EXISTS "docuseal_signer_client_status" TEXT;
ALTER TABLE "contracts" ADD COLUMN IF NOT EXISTS "docuseal_signer_dev_id" INTEGER;
ALTER TABLE "contracts" ADD COLUMN IF NOT EXISTS "docuseal_signer_dev_status" TEXT;
ALTER TABLE "contracts" ADD COLUMN IF NOT EXISTS "signed_pdf_url" TEXT;
ALTER TABLE "contracts" ADD COLUMN IF NOT EXISTS "sent_for_signature_at" TIMESTAMPTZ;
ALTER TABLE "contracts" ADD COLUMN IF NOT EXISTS "fully_signed_at" TIMESTAMPTZ;
ALTER TABLE "contracts" ADD COLUMN IF NOT EXISTS "developer_email" TEXT;
ALTER TABLE "contracts" ADD COLUMN IF NOT EXISTS "developer_name" TEXT;

-- Create indexes for efficient lookups
CREATE INDEX IF NOT EXISTS "idx_generated_contracts_docuseal_submission_id" ON "generated_contracts" ("docuseal_submission_id");
CREATE INDEX IF NOT EXISTS "idx_generated_contracts_docuseal_status" ON "generated_contracts" ("docuseal_status");
CREATE INDEX IF NOT EXISTS "idx_contracts_docuseal_submission_id" ON "contracts" ("docuseal_submission_id");
CREATE INDEX IF NOT EXISTS "idx_contracts_docuseal_status" ON "contracts" ("docuseal_status");

-- Comment documenting the status values
COMMENT ON COLUMN "generated_contracts"."docuseal_status" IS 'DocuSeal status: DRAFT, SENT, VIEWED, PARTIALLY_SIGNED, SIGNED, EXPIRED, DECLINED';
COMMENT ON COLUMN "contracts"."docuseal_status" IS 'DocuSeal status: DRAFT, SENT, VIEWED, PARTIALLY_SIGNED, SIGNED, EXPIRED, DECLINED';
