-- Phase 5E: Contract Generation System
-- Creating new tables for enhanced contract management

-- 1. TEMPLATE VARIABLES TABLE (NEW)
CREATE TABLE IF NOT EXISTS template_variables (
  id TEXT PRIMARY KEY,
  "template_id" TEXT NOT NULL,
  name TEXT NOT NULL,
  placeholder TEXT NOT NULL,
  "data_type" TEXT NOT NULL,
  required BOOLEAN DEFAULT FALSE,
  "default_value" TEXT,
  options TEXT[],
  "mapped_field" TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  FOREIGN KEY ("template_id") REFERENCES contract_templates(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_template_variables_template_id ON template_variables("template_id");

-- 2. TEMPLATE SECTIONS TABLE (NEW)
CREATE TABLE IF NOT EXISTS template_sections (
  id TEXT PRIMARY KEY,
  "template_id" TEXT NOT NULL,
  name TEXT NOT NULL,
  content TEXT NOT NULL,
  "order_index" INTEGER NOT NULL,
  conditional TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  FOREIGN KEY ("template_id") REFERENCES contract_templates(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_template_sections_template_id ON template_sections("template_id");
CREATE INDEX IF NOT EXISTS idx_template_sections_order_index ON template_sections("order_index");

-- 3. CONTRACT TEMPLATE VERSIONS TABLE (NEW)
CREATE TABLE IF NOT EXISTS contract_template_versions (
  id TEXT PRIMARY KEY,
  "template_id" TEXT NOT NULL,
  version INTEGER NOT NULL,
  content TEXT NOT NULL,
  variables TEXT[],
  "changed_by" TEXT,
  "change_notes" TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  FOREIGN KEY ("template_id") REFERENCES contract_templates(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_contract_template_versions_template_id ON contract_template_versions("template_id");
CREATE INDEX IF NOT EXISTS idx_contract_template_versions_version ON contract_template_versions(version);

-- 4. CONTRACTS TABLE (NEW - enhanced version)
CREATE TABLE IF NOT EXISTS contracts (
  id TEXT PRIMARY KEY,
  "template_id" TEXT NOT NULL,
  "deal_id" TEXT,
  "client_id" TEXT NOT NULL,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  status TEXT DEFAULT 'draft',
  "start_date" TIMESTAMP,
  "end_date" TIMESTAMP,
  "renewal_date" TIMESTAMP,
  "required_signatures" INTEGER DEFAULT 1,
  "signed_count" INTEGER DEFAULT 0,
  variables JSONB,
  branch TEXT DEFAULT 'Harare',
  "created_by" TEXT,
  "pdf_url" TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  FOREIGN KEY ("template_id") REFERENCES contract_templates(id),
  FOREIGN KEY ("deal_id") REFERENCES deals(id) ON DELETE SET NULL,
  FOREIGN KEY ("client_id") REFERENCES clients(id)
);

CREATE INDEX IF NOT EXISTS idx_contracts_client_id ON contracts("client_id");
CREATE INDEX IF NOT EXISTS idx_contracts_status ON contracts(status);
CREATE INDEX IF NOT EXISTS idx_contracts_deal_id ON contracts("deal_id");
CREATE INDEX IF NOT EXISTS idx_contracts_branch ON contracts(branch);
CREATE INDEX IF NOT EXISTS idx_contracts_signed_count ON contracts("signed_count");
CREATE INDEX IF NOT EXISTS idx_contracts_created_at ON contracts(created_at);

-- 5. CONTRACT SIGNATURES TABLE (NEW)
CREATE TABLE IF NOT EXISTS contract_signatures (
  id TEXT PRIMARY KEY,
  "contract_id" TEXT NOT NULL,
  "signer_name" TEXT NOT NULL,
  "signer_email" TEXT NOT NULL,
  "signer_role" TEXT NOT NULL,
  "signature_data" TEXT,
  "ip_address" TEXT,
  "user_agent" TEXT,
  status TEXT DEFAULT 'pending',
  "sent_at" TIMESTAMP,
  "signed_at" TIMESTAMP,
  "expires_at" TIMESTAMP,
  "reminder_sent_at" TIMESTAMP,
  "signed_by_user_id" TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  FOREIGN KEY ("contract_id") REFERENCES contracts(id) ON DELETE CASCADE,
  FOREIGN KEY ("signed_by_user_id") REFERENCES users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_contract_signatures_contract_id ON contract_signatures("contract_id");
CREATE INDEX IF NOT EXISTS idx_contract_signatures_status ON contract_signatures(status);
CREATE INDEX IF NOT EXISTS idx_contract_signatures_signer_email ON contract_signatures("signer_email");
CREATE INDEX IF NOT EXISTS idx_contract_signatures_signed_at ON contract_signatures("signed_at");

-- 6. CONTRACT VERSIONS TABLE (NEW)
CREATE TABLE IF NOT EXISTS contract_versions (
  id TEXT PRIMARY KEY,
  "contract_id" TEXT NOT NULL,
  "version_number" INTEGER NOT NULL,
  content TEXT NOT NULL,
  changes JSONB,
  "change_notes" TEXT,
  "changed_by" TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  FOREIGN KEY ("contract_id") REFERENCES contracts(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_contract_versions_contract_id ON contract_versions("contract_id");
CREATE INDEX IF NOT EXISTS idx_contract_versions_version_number ON contract_versions("version_number");

-- 7. CONTRACT AMENDMENTS TABLE (NEW)
CREATE TABLE IF NOT EXISTS contract_amendments (
  id TEXT PRIMARY KEY,
  "contract_id" TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  changes JSONB NOT NULL,
  status TEXT DEFAULT 'draft',
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  FOREIGN KEY ("contract_id") REFERENCES contracts(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_contract_amendments_contract_id ON contract_amendments("contract_id");
CREATE INDEX IF NOT EXISTS idx_contract_amendments_status ON contract_amendments(status);

-- 8. CONTRACT ACTIVITIES TABLE (NEW)
CREATE TABLE IF NOT EXISTS contract_activities (
  id TEXT PRIMARY KEY,
  "contract_id" TEXT NOT NULL,
  action TEXT NOT NULL,
  "actor_id" TEXT,
  "actor_email" TEXT,
  "actor_role" TEXT,
  details JSONB,
  "changes_before" JSONB,
  "changes_after" JSONB,
  "ip_address" TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  FOREIGN KEY ("contract_id") REFERENCES contracts(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_contract_activities_contract_id ON contract_activities("contract_id");
CREATE INDEX IF NOT EXISTS idx_contract_activities_action ON contract_activities(action);
CREATE INDEX IF NOT EXISTS idx_contract_activities_created_at ON contract_activities(created_at);

-- Verify migration success
SELECT 
  tablename 
FROM 
  pg_tables 
WHERE 
  schemaname = 'public' 
  AND tablename IN (
    'template_variables', 'template_sections', 'contract_template_versions',
    'contracts', 'contract_signatures', 'contract_versions', 
    'contract_amendments', 'contract_activities'
  )
ORDER BY tablename;