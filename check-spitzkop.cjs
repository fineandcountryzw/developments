const { neon } = require('@neondatabase/serverless');

const sql = neon('postgresql://neondb_owner:npg_hsQdL7KHBX8c@ep-mute-river-a4uai6d1-pooler.us-east-1.aws.neon.tech/neondb?sslmode=require');

async function checkDev() {
  const result = await sql`SELECT id, name, image_urls, logo_url, overview, description FROM developments WHERE name ILIKE '%spitz%'`;
  console.log('Spitzkop Gardens Development:');
  result.forEach(r => {
    console.log('ID:', r.id);
    console.log('Name:', r.name);
    console.log('Logo URL:', r.logo_url);
    console.log('Image URLs:', JSON.stringify(r.image_urls, null, 2));
    console.log('Overview length:', r.overview?.length || 0);
    console.log('Description length:', r.description?.length || 0);
  });
}
checkDev().catch(console.error);
