# Quick Fix: Create Admin User

## Problem
No users exist in your database yet, so you can't log in.

## Solution Options

### Option 1: Use Neon Console (RECOMMENDED - FASTEST)

1. **Go to Neon Console:** https://console.neon.tech
2. **Select your database:** `neondb`
3. **Open SQL Editor**
4. **Run this SQL:**

```sql
-- Create admin user WITHOUT password (will use demo password 'admin123')
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
```

5. **Verify it worked:**
```sql
SELECT email, role, "isActive" FROM "User";
```

6. **Now try logging in:**
   - Email: `admin@fineandcountry.co.zw`
   - Password: `admin123` (demo password)

---

### Option 2: Grant Database Permissions

Your current user doesn't have write access. In Neon Console:

```sql
-- Grant all privileges to your database user
GRANT ALL PRIVILEGES ON DATABASE neondb TO neondb_owner;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO neondb_owner;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO neondb_owner;

-- Then run the seed script
```

After granting permissions, run:
```bash
npm run db:seed
```

---

### Option 3: Use psql Command Line

```bash
psql 'postgresql://neondb_owner:npg_hsQdL7KHBX8c@ep-mute-river-a4uai6d1-pooler.us-east-1.aws.neon.tech/neondb?sslmode=require'

-- Then paste the INSERT statement from Option 1
```

---

## Test Credentials After Creating User

Once the admin user is created, use these credentials to log in:

```
Email: admin@fineandcountry.co.zw
Password: admin123
```

This will work because:
- User has NO password in database (password column is NULL)
- NextAuth falls back to demo passwords: ['admin123', 'demo123', 'password123']
- See: lib/authOptions.ts line 81-86

---

## Create More Users (Optional)

After fixing permissions, you can create more users:

```sql
-- Agent
INSERT INTO "User" (id, email, name, role, "isActive", "createdAt", "updatedAt")
VALUES (gen_random_uuid(), 'agent@fineandcountry.co.zw', 'John Agent', 'AGENT', true, NOW(), NOW());

-- Client  
INSERT INTO "User" (id, email, name, role, "isActive", "createdAt", "updatedAt")
VALUES (gen_random_uuid(), 'client@fineandcountry.co.zw', 'Jane Client', 'CLIENT', true, NOW(), NOW());
```

All these users can log in with demo passwords.
