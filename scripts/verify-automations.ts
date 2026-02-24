/**
 * Verify Automations
 * 
 * Lists all automations to verify migration
 */

import { config } from 'dotenv';
import { resolve } from 'path';
import { existsSync } from 'fs';

// Load environment variables
const envLocalPath = resolve(process.cwd(), '.env.local');
const envPath = resolve(process.cwd(), '.env');

if (existsSync(envLocalPath)) {
  config({ path: envLocalPath });
}
if (existsSync(envPath)) {
  config({ path: envPath });
}

if (!process.env.DATABASE_URL) {
  console.error('❌ DATABASE_URL not found');
  process.exit(1);
}

process.env.DATABASE_URL = process.env.DATABASE_URL.replace(/^["']|["']$/g, '');

async function verifyAutomations() {
  const { default: prisma } = await import('../lib/prisma');
  
  try {
    console.log('🔍 VERIFYING AUTOMATIONS\n');
    console.log('='.repeat(60));
    
    const automations = await prisma.automation.findMany({
      orderBy: { createdAt: 'asc' }
    });
    
    console.log(`\n✅ Found ${automations.length} automations:\n`);
    
    automations.forEach((automation, index) => {
      console.log(`${index + 1}. ${automation.name}`);
      console.log(`   Type: ${automation.triggerType}`);
      if (automation.triggerType === 'event') {
        console.log(`   Event: ${automation.eventType}`);
      } else if (automation.triggerType === 'schedule') {
        console.log(`   Schedule: ${automation.schedule}`);
      }
      console.log(`   Entity: ${automation.entityType}`);
      console.log(`   Status: ${automation.enabled ? '✅ Enabled' : '❌ Disabled'}`);
      console.log(`   Runs: ${automation.runCount} (${automation.successCount} success, ${automation.failureCount} failed)`);
      console.log('');
    });
    
    console.log('='.repeat(60));
    console.log('\n✅ Verification complete!\n');
    
  } catch (error: any) {
    console.error('❌ Verification error:', error.message);
    if (error.stack) {
      console.error('Stack:', error.stack);
    }
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

verifyAutomations()
  .then(() => process.exit(0))
  .catch(() => process.exit(1));
