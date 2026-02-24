import { Pool } from "pg";

// Database URL
const DATABASE_URL = "postgresql://neondb_owner:npg_hsQdL7KHBX8c@ep-mute-river-a4uai6d1-pooler.us-east-1.aws.neon.tech/neondb?sslmode=require";

async function main() {
  console.log("Connecting to database...");
  
  const pool = new Pool({ connectionString: DATABASE_URL });

  // First, see what columns exist in the users table
  const columnsResult = await pool.query(`
    SELECT column_name, data_type 
    FROM information_schema.columns 
    WHERE table_name = 'users' 
    ORDER BY ordinal_position
  `);
  
  console.log("\nUsers table columns:");
  columnsResult.rows.forEach(row => {
    console.log(`  - ${row.column_name}: ${row.data_type}`);
  });

  const email = "gwanzuranicholas@gmail.com";
  const name = "Nicholas Gwanzura";
  const role = "ADMIN";

  // Check if user exists
  const existing = await pool.query(
    `SELECT id, email, role FROM users WHERE email = $1`,
    [email]
  );
  
  if (existing.rows.length > 0) {
    const user = existing.rows[0];
    console.log("\nUser already exists:", user.email, "- Role:", user.role);
    
    // Update role to ADMIN if not already
    if (user.role !== "ADMIN") {
      await pool.query(
        `UPDATE users SET role = $1 WHERE email = $2`,
        ["ADMIN", email]
      );
      console.log("User role updated to ADMIN");
    }
    
    await pool.end();
    return;
  }

  // Create new admin user using cuid-style ID
  const id = `cl${Date.now().toString(36)}${Math.random().toString(36).substring(2, 9)}`;
  
  const result = await pool.query(
    `INSERT INTO users (id, email, name, role, created_at, updated_at) 
     VALUES ($1, $2, $3, $4, NOW(), NOW()) 
     RETURNING id, email, name, role`,
    [id, email, name, role]
  );
  
  const newUser = result.rows[0];
  console.log("\nSuper admin created:", newUser.email, "- Role:", newUser.role);
  console.log("\nNote: This app uses magic link authentication.");
  console.log("The user can login via the login page - a magic link will be sent to their email.");
  
  await pool.end();
}

main()
  .catch((e) => {
    console.error("Error:", e);
    process.exit(1);
  });
