-- AlterTable: Add onDelete behavior for User relations
-- This migration adds proper cascade/set null behavior when users are deleted

-- Drop existing foreign key constraints
ALTER TABLE "reservations" DROP CONSTRAINT IF EXISTS "reservations_user_id_fkey";
ALTER TABLE "developments" DROP CONSTRAINT IF EXISTS "developments_last_updated_by_id_fkey";

-- Recreate with proper onDelete behavior
-- Reservations: Set userId to NULL when user is deleted (preserve reservation history)
ALTER TABLE "reservations"
  ADD CONSTRAINT "reservations_user_id_fkey"
  FOREIGN KEY ("user_id")
  REFERENCES "users"("id")
  ON DELETE SET NULL
  ON UPDATE CASCADE;

-- Developments: Set lastUpdatedById to NULL when user is deleted (preserve development history)
ALTER TABLE "developments"
  ADD CONSTRAINT "developments_last_updated_by_id_fkey"
  FOREIGN KEY ("last_updated_by_id")
  REFERENCES "users"("id")
  ON DELETE SET NULL
  ON UPDATE CASCADE;
