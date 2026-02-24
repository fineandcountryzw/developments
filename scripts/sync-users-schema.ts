import { Pool } from "pg";

const DATABASE_URL = "postgresql://neondb_owner:npg_hsQdL7KHBX8c@ep-mute-river-a4uai6d1-pooler.us-east-1.aws.neon.tech/neondb?sslmode=require";

async function main() {
  const pool = new Pool({ connectionString: DATABASE_URL });
  
  console.log("Syncing users table columns with Prisma schema...\n");
  
  // Add missing columns expected by Prisma schema
  const alterStatements = [
    "ALTER TABLE users ADD COLUMN IF NOT EXISTS last_login TIMESTAMP",
    "ALTER TABLE users ADD COLUMN IF NOT EXISTS access_revoked_at TIMESTAMP",
    "ALTER TABLE users ADD COLUMN IF NOT EXISTS access_revoked_by TEXT",
    "ALTER TABLE users ADD COLUMN IF NOT EXISTS revoke_reason TEXT",
  ];
  
  for (const sql of alterStatements) {
    try {
      await pool.query(sql);
      console.log("✓", sql.split("ADD COLUMN IF NOT EXISTS ")[1]);
    } catch (err: any) {
      console.log("✗", err.message);
    }
  }
  
  // Verify final column list
  const result = await pool.query(`
    SELECT column_name, data_type 
    FROM information_schema.columns 
    WHERE table_name = 'users' 
    ORDER BY ordinal_position
  `);
  
  console.log("\n=== FINAL USERS TABLE COLUMNS ===");
  result.rows.forEach(row => {
    console.log(`  ${row.column_name}: ${row.data_type}`);
  });
  
  await pool.end();
}

main().catch(console.error);
