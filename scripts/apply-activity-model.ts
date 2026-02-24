/**
 * Direct SQL Application Script
 * Run with: DATABASE_URL="..." npx tsx scripts/apply-activity-model.ts
 */

import { Pool } from '@neondatabase/serverless';

const connectionString = 'postgresql://neondb_owner:npg_hsQdL7KHBX8c@ep-mute-river-a4uai6d1-pooler.us-east-1.aws.neon.tech/neondb?sslmode=require';

async function applyActivityModel() {
  console.log('📦 Applying Activity model to Neon database...\n');

  const pool = new Pool({ connectionString });

  try {
    // 1. Create ActivityType enum
    console.log('1️⃣  Creating ActivityType enum...');
    await pool.query(`
      DO $$ BEGIN
        CREATE TYPE "ActivityType" AS ENUM (
          'LOGIN',
          'RESERVATION',
          'PAYMENT_UPLOAD',
          'VERIFICATION',
          'STAND_UPDATE',
          'USER_CREATED',
          'AGENT_ASSIGNED'
        );
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$;
    `);
    console.log('✅ ActivityType enum created\n');

    // 2. Create activities table
    console.log('2️⃣  Creating activities table...');
    await pool.query(`
      CREATE TABLE IF NOT EXISTS "activities" (
        "id" TEXT NOT NULL PRIMARY KEY DEFAULT gen_random_uuid()::text,
        "type" "ActivityType" NOT NULL,
        "description" TEXT NOT NULL,
        "metadata" JSONB,
        "user_id" TEXT NOT NULL,
        "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        
        CONSTRAINT "activities_user_id_fkey" FOREIGN KEY ("user_id") 
          REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE
      );
    `);
    console.log('✅ activities table created\n');

    // 3. Create indexes
    console.log('3️⃣  Creating indexes...');
    await pool.query(`CREATE INDEX IF NOT EXISTS "activities_user_id_idx" ON "activities"("user_id");`);
    await pool.query(`CREATE INDEX IF NOT EXISTS "activities_type_idx" ON "activities"("type");`);
    await pool.query(`CREATE INDEX IF NOT EXISTS "activities_created_at_idx" ON "activities"("created_at" DESC);`);
    console.log('✅ All indexes created\n');

    // 4. Verify table exists
    console.log('4️⃣  Verifying table structure...');
    const result = await pool.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'activities'
      ORDER BY ordinal_position;
    `);
    console.log('✅ Table verified with columns:', result.rows.map(r => r.column_name).join(', '));
    
    console.log('\n🎉 Activity model successfully applied to Neon database!');
    console.log('Run npx prisma generate to update your Prisma Client.');

  } catch (error) {
    console.error('❌ Error applying Activity model:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

applyActivityModel();
