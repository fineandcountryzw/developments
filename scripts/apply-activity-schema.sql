-- Add ActivityType enum
CREATE TYPE "ActivityType" AS ENUM (
  'LOGIN',
  'RESERVATION',
  'PAYMENT_UPLOAD',
  'VERIFICATION',
  'STAND_UPDATE',
  'USER_CREATED',
  'AGENT_ASSIGNED'
);

-- Create activities table
CREATE TABLE "activities" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "type" "ActivityType" NOT NULL,
  "description" TEXT NOT NULL,
  "metadata" JSONB,
  "user_id" TEXT NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  
  CONSTRAINT "activities_user_id_fkey" FOREIGN KEY ("user_id") 
    REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- Create indexes
CREATE INDEX "activities_user_id_idx" ON "activities"("user_id");
CREATE INDEX "activities_type_idx" ON "activities"("type");
CREATE INDEX "activities_created_at_idx" ON "activities"("created_at" DESC);
