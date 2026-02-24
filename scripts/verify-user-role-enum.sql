-- Verify and Update UserRole Enum
-- Run this in your database to ensure all roles are available

-- 1. Check current enum values
SELECT enumlabel 
FROM pg_enum 
WHERE enumtypid = (
  SELECT oid 
  FROM pg_type 
  WHERE typname = 'UserRole'
)
ORDER BY enumlabel;

-- 2. Add missing roles if they don't exist
DO $$ 
BEGIN
  -- Add DEVELOPER if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum 
    WHERE enumlabel = 'DEVELOPER' 
    AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'UserRole')
  ) THEN
    ALTER TYPE "UserRole" ADD VALUE 'DEVELOPER';
    RAISE NOTICE 'Added DEVELOPER to UserRole enum';
  END IF;

  -- Add ACCOUNT if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum 
    WHERE enumlabel = 'ACCOUNT' 
    AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'UserRole')
  ) THEN
    ALTER TYPE "UserRole" ADD VALUE 'ACCOUNT';
    RAISE NOTICE 'Added ACCOUNT to UserRole enum';
  END IF;

  -- Add MANAGER if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum 
    WHERE enumlabel = 'MANAGER' 
    AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'UserRole')
  ) THEN
    ALTER TYPE "UserRole" ADD VALUE 'MANAGER';
    RAISE NOTICE 'Added MANAGER to UserRole enum';
  END IF;
END $$;

-- 3. Verify all roles exist
SELECT enumlabel as "Available Roles"
FROM pg_enum 
WHERE enumtypid = (
  SELECT oid 
  FROM pg_type 
  WHERE typname = 'UserRole'
)
ORDER BY enumlabel;

-- 4. Check users with DEVELOPER or ACCOUNT roles
SELECT 
  id,
  email,
  name,
  role,
  branch
FROM users
WHERE role IN ('DEVELOPER', 'ACCOUNT', 'ACCOUNTS', 'ACCOUNTANT')
ORDER BY role, email;
