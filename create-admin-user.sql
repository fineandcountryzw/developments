-- Create a test admin user directly via SQL
-- Run this in your Neon SQL editor: https://console.neon.tech

-- First, check if user exists
SELECT * FROM "User" WHERE email = 'admin@fineandcountry.co.zw';

-- If no users exist, insert admin user
-- Password hash for 'admin123' using bcrypt with 10 rounds
INSERT INTO "User" (
  id,
  email,
  name,
  role,
  password,
  "isActive",
  "createdAt",
  "updatedAt"
) VALUES (
  gen_random_uuid(),
  'admin@fineandcountry.co.zw',
  'System Administrator',
  'ADMIN',
  '$2a$10$YourHashHere',  -- Replace with actual bcrypt hash
  true,
  NOW(),
  NOW()
) ON CONFLICT (email) DO NOTHING;

-- For testing WITHOUT bcrypt hash (uses demo password fallback):
INSERT INTO "User" (
  id,
  email,
  name,
  role,
  "isActive",
  "createdAt",
  "updatedAt"
) VALUES (
  gen_random_uuid(),
  'admin@fineandcountry.co.zw',
  'System Administrator',
  'ADMIN',
  true,
  NOW(),
  NOW()
) ON CONFLICT (email) DO NOTHING;

-- Verify user was created
SELECT id, email, name, role, "isActive", password IS NOT NULL as "hasPassword"
FROM "User" 
WHERE email = 'admin@fineandcountry.co.zw';
