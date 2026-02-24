-- Add email tracking fields to invitations table
-- Fine & Country Zimbabwe ERP
-- Migration: Add invitation email delivery tracking

-- Add email tracking columns to invitations table
ALTER TABLE "invitations" ADD COLUMN "email_sent_at" TIMESTAMP(3);
ALTER TABLE "invitations" ADD COLUMN "email_failed_at" TIMESTAMP(3);
ALTER TABLE "invitations" ADD COLUMN "email_failure_reason" TEXT;
ALTER TABLE "invitations" ADD COLUMN "email_attempts" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "invitations" ADD COLUMN "last_email_attempt" TIMESTAMP(3);

-- Add index for efficient queries on email delivery status
CREATE INDEX "invitations_email_sent_at_idx" ON "invitations"("email_sent_at");
CREATE INDEX "invitations_email_failed_at_idx" ON "invitations"("email_failed_at");
