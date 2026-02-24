const { neon } = require('@neondatabase/serverless');

const sql = neon('postgresql://neondb_owner:npg_hsQdL7KHBX8c@ep-mute-river-a4uai6d1-pooler.us-east-1.aws.neon.tech/neondb?sslmode=require');

async function deleteTestDevs() {
  // First, find what we're about to delete
  const found = await sql`SELECT id, name FROM developments WHERE LOWER(name) IN ('a', 'b', 'c') ORDER BY name`;
  
  console.log('Found test developments to delete:');
  console.table(found);
  
  if (found.length === 0) {
    console.log('No test developments found.');
    return;
  }
  
  // Delete associated stands first (foreign key constraint)
  const ids = found.map(d => d.id);
  console.log('\nDeleting associated stands...');
  const standsDeleted = await sql`DELETE FROM stands WHERE development_id = ANY(${ids}) RETURNING id`;
  console.log(`Deleted ${standsDeleted.length} stands`);
  
  // Delete the developments
  console.log('\nDeleting developments...');
  const deleted = await sql`DELETE FROM developments WHERE LOWER(name) IN ('a', 'b', 'c') RETURNING id, name`;
  
  console.log('Deleted developments:');
  console.table(deleted);
  console.log(`\n✅ Successfully deleted ${deleted.length} test developments`);
}

deleteTestDevs().catch(console.error);
