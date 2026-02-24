import { neon } from '@neondatabase/serverless';

const sql = neon(process.env.DATABASE_URL!);

async function listTables() {
  try {
    console.log('Checking database tables...\n');
    
    const tables = await sql`
      SELECT tablename 
      FROM pg_tables 
      WHERE schemaname = 'public'
      ORDER BY tablename
    `;
    
    if (tables.length === 0) {
      console.log('❌ No tables found in database!');
      console.log('\nYou need to run: npx prisma db push');
    } else {
      console.log(`✅ Found ${tables.length} table(s):\n`);
      tables.forEach((table, i) => {
        console.log(`${i + 1}. ${table.tablename}`);
      });
    }
    
  } catch (error) {
    console.error('❌ Error:', error);
  }
}

listTables();
