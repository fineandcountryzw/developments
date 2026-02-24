const { neon } = require('@neondatabase/serverless');

const sql = neon('postgresql://neondb_owner:npg_hsQdL7KHBX8c@ep-mute-river-a4uai6d1-pooler.us-east-1.aws.neon.tech/neondb?sslmode=require');

async function checkDev() {
  const result = await sql`SELECT id, name, image_urls FROM developments WHERE name ILIKE '%spitz%'`;
  
  if (result.length > 0 && result[0].image_urls) {
    console.log('Raw image_urls array:');
    result[0].image_urls.forEach((url, i) => {
      console.log(`[${i}] Length: ${url.length}`);
      console.log(`[${i}] Has newline: ${url.includes('\n')}`);
      console.log(`[${i}] Has carriage return: ${url.includes('\r')}`);
      console.log(`[${i}] Trimmed: "${url.trim()}"`);
      console.log('---');
    });
  }
}
checkDev().catch(console.error);
