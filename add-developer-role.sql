-- Add DEVELOPER to the UserRole enum if it doesn't exist
ALTER TYPE "UserRole" ADD VALUE IF NOT EXISTS 'DEVELOPER';
