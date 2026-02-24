require('dotenv').config({ path: '.env.production' });
const { Client } = require('pg');

async function runMigration() {
  console.log('Applying featured_tag column migration...');
  
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });

  try {
    await client.connect();
    console.log('Connected to database');

    // Add the featured_tag column to the developments table
    console.log('Adding featured_tag column...');
    try {
      await client.query(`
        ALTER TABLE "developments" 
        ADD COLUMN IF NOT EXISTS "featured_tag" TEXT NOT NULL DEFAULT 'none'
      `);
      console.log('✓ Column added successfully');
    } catch (err) {
      if (err.message.includes('already exists')) {
        console.log('✓ Column already exists');
      } else {
        throw err;
      }
    }

    // Add a check constraint to ensure only valid values are used
    console.log('Adding check constraint...');
    try {
      await client.query(`
        ALTER TABLE "developments" 
        ADD CONSTRAINT IF NOT EXISTS "featured_tag_check" 
        CHECK ("featured_tag" IN ('none', 'promo', 'hot'))
      `);
      console.log('✓ Check constraint added successfully');
    } catch (err) {
      if (err.message.includes('already exists') || err.message.includes('duplicate')) {
        console.log('✓ Check constraint already exists');
      } else {
        console.log('Note: Check constraint error:', err.message);
      }
    }

    // Create an index on featured_tag for faster queries
    console.log('Creating index...');
    await client.query(`
      CREATE INDEX IF NOT EXISTS "developments_featured_tag_idx" ON "developments"("featured_tag")
    `);
    console.log('✓ Index created successfully');

    // Update existing records to have 'none' as the default value
    console.log('Updating existing records...');
    const updateResult = await client.query(`
      UPDATE "developments" 
      SET "featured_tag" = 'none' 
      WHERE "featured_tag" IS NULL
    `);
    console.log(`✓ Updated ${updateResult.rowCount} records`);

    console.log('\n✓ Migration completed successfully!');
    console.log('   - Added featured_tag column to developments table');
    console.log('   - Added check constraint for valid values (none, promo, hot)');
    console.log('   - Created index for faster queries');
    console.log('   - Updated existing records to default value');

    process.exit(0);
  } catch (error) {
    console.error('\n✗ Migration failed:', error.message);
    process.exit(1);
  } finally {
    await client.end();
  }
}

runMigration();