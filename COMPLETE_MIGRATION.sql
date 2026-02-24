-- Fine & Country Zimbabwe ERP - Complete Database Migration
-- Database: Neon PostgreSQL
-- Use IF NOT EXISTS to skip already created objects

-- 1. CREATE ENUMS
DO $$ BEGIN
    CREATE TYPE "UserRole" AS ENUM ('ADMIN', 'AGENT', 'CLIENT');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE "DevelopmentPhase" AS ENUM ('SERVICING', 'READY_TO_BUILD', 'COMPLETED');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE "StandStatus" AS ENUM ('AVAILABLE', 'RESERVED', 'SOLD', 'WITHDRAWN');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE "ReservationStatus" AS ENUM ('PENDING', 'CONFIRMED', 'EXPIRED', 'PAYMENT_PENDING', 'CANCELLED');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE "ActivityType" AS ENUM ('LOGIN', 'RESERVATION', 'PAYMENT_UPLOAD', 'VERIFICATION', 'STAND_UPDATE', 'USER_CREATED', 'AGENT_ASSIGNED');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

-- 2. CREATE CORE TABLES
CREATE TABLE IF NOT EXISTS "users" (
    "id" TEXT NOT NULL,
    "name" TEXT,
    "email" TEXT NOT NULL,
    "email_verified" TIMESTAMP(3),
    "image" TEXT,
    "role" "UserRole" NOT NULL DEFAULT 'CLIENT',
    "branch" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "users_email_key" ON "users"("email");

CREATE TABLE IF NOT EXISTS "accounts" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "provider_account_id" TEXT NOT NULL,
    "refresh_token" TEXT,
    "access_token" TEXT,
    "expires_at" INTEGER,
    "token_type" TEXT,
    "scope" TEXT,
    "id_token" TEXT,
    "session_state" TEXT,
    CONSTRAINT "accounts_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "accounts_provider_provider_account_id_key" ON "accounts"("provider", "provider_account_id");

CREATE TABLE IF NOT EXISTS "sessions" (
    "id" TEXT NOT NULL,
    "session_token" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "expires" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "sessions_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "sessions_session_token_key" ON "sessions"("session_token");

CREATE TABLE IF NOT EXISTS "verification_tokens" (
    "identifier" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "expires" TIMESTAMP(3) NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS "verification_tokens_token_key" ON "verification_tokens"("token");
CREATE UNIQUE INDEX IF NOT EXISTS "verification_tokens_identifier_token_key" ON "verification_tokens"("identifier", "token");

-- 3. CREATE DEVELOPMENT & PROPERTY TABLES
CREATE TABLE IF NOT EXISTS "developments" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "location" TEXT NOT NULL,
    "description" TEXT,
    "phase" "DevelopmentPhase" NOT NULL DEFAULT 'SERVICING',
    "servicing_progress" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'Active',
    "base_price" DECIMAL(12,2) NOT NULL,
    "price_per_sqm" DECIMAL(10,2),
    "vat_percentage" DECIMAL(5,2) NOT NULL DEFAULT 15,
    "endowment_fee" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "total_area_sqm" DECIMAL(10,2),
    "total_stands" INTEGER,
    "available_stands" INTEGER,
    "main_image" TEXT,
    "gallery" TEXT[],
    "geo_json_url" TEXT,
    "image_urls" TEXT[],
    "logo_url" TEXT,
    "document_urls" TEXT[],
    "last_updated_by_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "developments_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "stands" (
    "id" TEXT NOT NULL,
    "stand_number" TEXT NOT NULL,
    "development_id" TEXT NOT NULL,
    "price" DECIMAL(12,2) NOT NULL,
    "price_per_sqm" DECIMAL(10,2),
    "size_sqm" DECIMAL(10,2),
    "status" "StandStatus" NOT NULL DEFAULT 'AVAILABLE',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "stands_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "stands_development_id_stand_number_key" ON "stands"("development_id", "stand_number");

-- 4. CREATE AGENT & RESERVATION TABLES
CREATE TABLE IF NOT EXISTS "agents" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT,
    "phone" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "agents_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "agents_email_key" ON "agents"("email");

CREATE TABLE IF NOT EXISTS "reservations" (
    "id" TEXT NOT NULL,
    "stand_id" TEXT NOT NULL,
    "user_id" TEXT,
    "agent_id" TEXT,
    "is_company_lead" BOOLEAN NOT NULL DEFAULT false,
    "assigned_lead_type" TEXT,
    "terms_accepted_at" TIMESTAMP(3) NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "status" "ReservationStatus" NOT NULL DEFAULT 'PENDING',
    "timer_active" BOOLEAN NOT NULL DEFAULT true,
    "pop_url" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "reservations_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "reservations_stand_id_idx" ON "reservations"("stand_id");
CREATE INDEX IF NOT EXISTS "reservations_user_id_idx" ON "reservations"("user_id");
CREATE INDEX IF NOT EXISTS "reservations_agent_id_idx" ON "reservations"("agent_id");
CREATE INDEX IF NOT EXISTS "reservations_expires_at_idx" ON "reservations"("expires_at");

-- 5. CREATE ACTIVITY & AUDIT TABLES
CREATE TABLE IF NOT EXISTS "activities" (
    "id" TEXT NOT NULL,
    "type" "ActivityType" NOT NULL,
    "description" TEXT NOT NULL,
    "metadata" JSONB,
    "user_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "activities_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "activities_user_id_idx" ON "activities"("user_id");
CREATE INDEX IF NOT EXISTS "activities_type_idx" ON "activities"("type");
CREATE INDEX IF NOT EXISTS "activities_created_at_idx" ON "activities"("created_at" DESC);

CREATE TABLE IF NOT EXISTS "development_edits" (
    "id" TEXT NOT NULL,
    "development_id" TEXT NOT NULL,
    "field_name" TEXT NOT NULL,
    "old_value" TEXT,
    "new_value" TEXT,
    "edited_by" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "development_edits_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "development_edits_development_id_idx" ON "development_edits"("development_id");
CREATE INDEX IF NOT EXISTS "development_edits_created_at_idx" ON "development_edits"("created_at" DESC);

-- 6. ADD FOREIGN KEY CONSTRAINTS (only if table exists)
ALTER TABLE "accounts" ADD CONSTRAINT "accounts_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "developments" ADD CONSTRAINT "developments_last_updated_by_id_fkey" FOREIGN KEY ("last_updated_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "stands" ADD CONSTRAINT "stands_development_id_fkey" FOREIGN KEY ("development_id") REFERENCES "developments"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "reservations" ADD CONSTRAINT "reservations_stand_id_fkey" FOREIGN KEY ("stand_id") REFERENCES "stands"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "reservations" ADD CONSTRAINT "reservations_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "reservations" ADD CONSTRAINT "reservations_agent_id_fkey" FOREIGN KEY ("agent_id") REFERENCES "agents"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "activities" ADD CONSTRAINT "activities_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "development_edits" ADD CONSTRAINT "development_edits_development_id_fkey" FOREIGN KEY ("development_id") REFERENCES "developments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- 7. CREATE KANBAN/PIPELINE TABLES
CREATE TABLE IF NOT EXISTS "kanban_boards" (
    "id" TEXT NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "description" TEXT,
    "branchId" TEXT,
    "isArchived" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "kanban_boards_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "stages" (
    "id" TEXT NOT NULL,
    "boardId" TEXT NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "color" VARCHAR(7) NOT NULL DEFAULT '#3b82f6',
    "wipLimit" INTEGER,
    "orderIndex" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "stages_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "deals" (
    "id" TEXT NOT NULL,
    "boardId" TEXT NOT NULL,
    "stageId" TEXT,
    "title" VARCHAR(255) NOT NULL,
    "description" TEXT,
    "value" DECIMAL(15,2),
    "currency" VARCHAR(3) NOT NULL DEFAULT 'USD',
    "probability" INTEGER NOT NULL DEFAULT 50,
    "healthScore" INTEGER,
    "riskLevel" VARCHAR(20),
    "expectedCloseDate" DATE,
    "clientId" TEXT,
    "ownerId" TEXT,
    "isArchived" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "deals_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "deal_activities" (
    "id" TEXT NOT NULL,
    "dealId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" VARCHAR(50) NOT NULL,
    "changes" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "deal_activities_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "comments" (
    "id" TEXT NOT NULL,
    "dealId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "attachments" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "comments_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "pipeline_rules" (
    "id" TEXT NOT NULL,
    "boardId" TEXT NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "trigger" VARCHAR(50) NOT NULL,
    "condition" JSONB NOT NULL,
    "action" JSONB NOT NULL,
    "isEnabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "pipeline_rules_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "custom_fields" (
    "id" TEXT NOT NULL,
    "boardId" TEXT NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "type" VARCHAR(50) NOT NULL,
    "options" JSONB,
    "orderIndex" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "custom_fields_pkey" PRIMARY KEY ("id")
);

-- Kanban indexes
CREATE INDEX IF NOT EXISTS "idx_stages_board_id" ON "stages"("boardId");
CREATE INDEX IF NOT EXISTS "idx_deals_board_id" ON "deals"("boardId");
CREATE INDEX IF NOT EXISTS "idx_deals_stage_id" ON "deals"("stageId");
CREATE INDEX IF NOT EXISTS "idx_deals_owner_id" ON "deals"("ownerId");
CREATE INDEX IF NOT EXISTS "idx_deal_activities_deal_id" ON "deal_activities"("dealId");
CREATE INDEX IF NOT EXISTS "idx_deal_activities_user_id" ON "deal_activities"("userId");
CREATE INDEX IF NOT EXISTS "idx_comments_deal_id" ON "comments"("dealId");
CREATE INDEX IF NOT EXISTS "idx_comments_user_id" ON "comments"("userId");
CREATE INDEX IF NOT EXISTS "idx_pipeline_rules_board_id" ON "pipeline_rules"("boardId");
CREATE INDEX IF NOT EXISTS "idx_custom_fields_board_id" ON "custom_fields"("boardId");

-- Kanban foreign keys
ALTER TABLE "stages" ADD CONSTRAINT "stages_boardId_fkey" FOREIGN KEY ("boardId") REFERENCES "kanban_boards"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "deals" ADD CONSTRAINT "deals_boardId_fkey" FOREIGN KEY ("boardId") REFERENCES "kanban_boards"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "deals" ADD CONSTRAINT "deals_stageId_fkey" FOREIGN KEY ("stageId") REFERENCES "stages"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "deals" ADD CONSTRAINT "deals_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "deal_activities" ADD CONSTRAINT "deal_activities_dealId_fkey" FOREIGN KEY ("dealId") REFERENCES "deals"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "deal_activities" ADD CONSTRAINT "deal_activities_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "comments" ADD CONSTRAINT "comments_dealId_fkey" FOREIGN KEY ("dealId") REFERENCES "deals"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "comments" ADD CONSTRAINT "comments_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "pipeline_rules" ADD CONSTRAINT "pipeline_rules_boardId_fkey" FOREIGN KEY ("boardId") REFERENCES "kanban_boards"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "custom_fields" ADD CONSTRAINT "custom_fields_boardId_fkey" FOREIGN KEY ("boardId") REFERENCES "kanban_boards"("id") ON DELETE CASCADE ON UPDATE CASCADE;
