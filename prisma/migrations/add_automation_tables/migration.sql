-- CreateTable
CREATE TABLE IF NOT EXISTS "automations" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "trigger_type" TEXT NOT NULL,
    "event_type" TEXT,
    "schedule" TEXT,
    "webhook_url" TEXT,
    "entity_type" TEXT NOT NULL,
    "condition" JSONB,
    "actions" JSONB NOT NULL,
    "branch" TEXT NOT NULL DEFAULT 'Harare',
    "retry_policy" JSONB,
    "last_run_at" TIMESTAMP(3),
    "run_count" INTEGER NOT NULL DEFAULT 0,
    "success_count" INTEGER NOT NULL DEFAULT 0,
    "failure_count" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "automations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "automation_runs" (
    "id" TEXT NOT NULL,
    "automation_id" TEXT NOT NULL,
    "event_type" TEXT NOT NULL,
    "entity_type" TEXT NOT NULL,
    "entity_id" TEXT NOT NULL,
    "correlation_id" TEXT,
    "status" TEXT NOT NULL,
    "action_type" TEXT NOT NULL,
    "action_target" TEXT NOT NULL,
    "idempotency_key" TEXT NOT NULL,
    "retry_count" INTEGER NOT NULL DEFAULT 0,
    "max_retries" INTEGER NOT NULL DEFAULT 3,
    "result" JSONB,
    "error_message" TEXT,
    "error_stack" TEXT,
    "scheduled_at" TIMESTAMP(3),
    "started_at" TIMESTAMP(3),
    "completed_at" TIMESTAMP(3),
    "duration_ms" INTEGER,
    "branch" TEXT NOT NULL DEFAULT 'Harare',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "automation_runs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "automation_event_logs" (
    "id" TEXT NOT NULL,
    "event_type" TEXT NOT NULL,
    "entity_type" TEXT NOT NULL,
    "entity_id" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "branch" TEXT NOT NULL DEFAULT 'Harare',
    "triggered_automations" TEXT[],
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "automation_event_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "automations_enabled_idx" ON "automations"("enabled");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "automations_trigger_type_event_type_idx" ON "automations"("trigger_type", "event_type");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "automations_branch_idx" ON "automations"("branch");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "automation_runs_automation_id_idx" ON "automation_runs"("automation_id");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "automation_runs_entity_id_idx" ON "automation_runs"("entity_id");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "automation_runs_correlation_id_idx" ON "automation_runs"("correlation_id");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "automation_runs_status_idx" ON "automation_runs"("status");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "automation_runs_created_at_idx" ON "automation_runs"("created_at" DESC);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "automation_event_logs_event_type_idx" ON "automation_event_logs"("event_type");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "automation_event_logs_entity_id_idx" ON "automation_event_logs"("entity_id");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "automation_event_logs_timestamp_idx" ON "automation_event_logs"("timestamp" DESC);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "automation_runs_idempotency_key_key" ON "automation_runs"("idempotency_key");

-- AddForeignKey
ALTER TABLE "automation_runs" ADD CONSTRAINT "automation_runs_automation_id_fkey" FOREIGN KEY ("automation_id") REFERENCES "automations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
