-- Add Principal Agent fields to CompanySettings (per-branch)
ALTER TABLE "company_settings" ADD COLUMN IF NOT EXISTS "principal_agent_name" TEXT;
ALTER TABLE "company_settings" ADD COLUMN IF NOT EXISTS "principal_agent_email" TEXT;

-- Normalized signer tracking for GeneratedContract (supports 4+ signatories)
CREATE TABLE IF NOT EXISTS "generated_contract_signers" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "contract_id" TEXT NOT NULL,
  "role" TEXT NOT NULL,
  "name" TEXT,
  "email" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'not_invited',
  "docuseal_signer_id" INTEGER,
  "invited_at" TIMESTAMPTZ,
  "opened_at" TIMESTAMPTZ,
  "signed_at" TIMESTAMPTZ,
  "declined_at" TIMESTAMPTZ,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "generated_contract_signers_contract_fk"
    FOREIGN KEY ("contract_id") REFERENCES "generated_contracts" ("id")
    ON DELETE CASCADE
);

-- Ensure 1 signer per role per contract
CREATE UNIQUE INDEX IF NOT EXISTS "idx_generated_contract_signers_contract_role"
  ON "generated_contract_signers" ("contract_id", "role");

-- Lookup helpers
CREATE INDEX IF NOT EXISTS "idx_generated_contract_signers_contract_id"
  ON "generated_contract_signers" ("contract_id");
CREATE INDEX IF NOT EXISTS "idx_generated_contract_signers_email"
  ON "generated_contract_signers" ("email");
CREATE INDEX IF NOT EXISTS "idx_generated_contract_signers_status"
  ON "generated_contract_signers" ("status");
CREATE INDEX IF NOT EXISTS "idx_generated_contract_signers_docuseal_signer_id"
  ON "generated_contract_signers" ("docuseal_signer_id");

COMMENT ON TABLE "generated_contract_signers" IS 'Normalized signer roles/statuses for DocuSeal + contract visibility (client, developer, lawyer, principal_agent).';
COMMENT ON COLUMN "generated_contract_signers"."status" IS 'not_invited|pending|opened|signed|declined|expired';

