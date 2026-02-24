-- Create Task Manager tables
-- Personal task management with notes for agents and users

-- Create TaskStatus enum
DO $$ BEGIN
  CREATE TYPE "TaskStatus" AS ENUM ('PENDING', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Create TaskPriority enum
DO $$ BEGIN
  CREATE TYPE "TaskPriority" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'URGENT');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Create tasks table
CREATE TABLE IF NOT EXISTS "tasks" (
  "id" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "description" TEXT,
  "notes" TEXT,
  "status" "TaskStatus" NOT NULL DEFAULT 'PENDING',
  "priority" "TaskPriority" NOT NULL DEFAULT 'MEDIUM',
  "due_date" TIMESTAMP(3),
  "completed_at" TIMESTAMP(3),
  "user_id" TEXT NOT NULL,
  "agent_id" TEXT,
  "client_id" TEXT,
  "deal_id" TEXT,
  "branch" TEXT NOT NULL DEFAULT 'Harare',
  "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
  "metadata" JSONB,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "tasks_pkey" PRIMARY KEY ("id")
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS "tasks_user_id_idx" ON "tasks"("user_id");
CREATE INDEX IF NOT EXISTS "tasks_agent_id_idx" ON "tasks"("agent_id");
CREATE INDEX IF NOT EXISTS "tasks_status_idx" ON "tasks"("status");
CREATE INDEX IF NOT EXISTS "tasks_due_date_idx" ON "tasks"("due_date");
CREATE INDEX IF NOT EXISTS "tasks_branch_idx" ON "tasks"("branch");
CREATE INDEX IF NOT EXISTS "tasks_created_at_idx" ON "tasks"("created_at" DESC);

-- Add comments for documentation
COMMENT ON TABLE "tasks" IS 'Personal task management with notes for agents and users';
COMMENT ON COLUMN "tasks"."notes" IS 'Additional notes and details for the task';
COMMENT ON COLUMN "tasks"."metadata" IS 'Additional metadata stored as JSON';
COMMENT ON COLUMN "tasks"."tags" IS 'Tags for categorizing tasks';
