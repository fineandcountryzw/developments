-- Add budget, lookingFor, and preferences fields to Client table
-- Also add index on agentId for better query performance

ALTER TABLE "clients" 
ADD COLUMN IF NOT EXISTS "budget" DECIMAL(12,2),
ADD COLUMN IF NOT EXISTS "looking_for" TEXT,
ADD COLUMN IF NOT EXISTS "preferences" JSONB;

-- Add index on agentId for better query performance when filtering by agent
CREATE INDEX IF NOT EXISTS "clients_agentId_idx" ON "clients"("agent_id");

-- Add comment for documentation
COMMENT ON COLUMN "clients"."budget" IS 'Client budget in USD';
COMMENT ON COLUMN "clients"."looking_for" IS 'What the client/prospect is looking for';
COMMENT ON COLUMN "clients"."preferences" IS 'Additional preferences stored as JSON';
