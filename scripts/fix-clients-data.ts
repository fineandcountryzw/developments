/**
 * Fix Clients Data Quality Issues
 * Applies fixes identified in the audit
 */

// Load environment variables
import { config } from 'dotenv';
import { resolve } from 'path';
import { existsSync } from 'fs';

// Load .env.local first, then .env
const envLocalPath = resolve(process.cwd(), '.env.local');
const envPath = resolve(process.cwd(), '.env');

try {
  if (existsSync(envLocalPath)) {
    config({ path: envLocalPath });
  }
  if (existsSync(envPath)) {
    config({ path: envPath });
  }
} catch (e) {
  console.warn('Error loading .env files:', e);
}

// Verify DATABASE_URL is loaded and clean it
if (!process.env.DATABASE_URL) {
  console.error('❌ DATABASE_URL not found in environment variables');
  console.log('Please ensure .env.local or .env file exists with DATABASE_URL');
  process.exit(1);
}

// Clean DATABASE_URL (remove quotes if present)
process.env.DATABASE_URL = process.env.DATABASE_URL.replace(/^["']|["']$/g, '');

async function fixClientsData() {
  // Import prisma here after env is loaded
  const { default: prisma } = await import('../lib/prisma');
  
  console.log('🔧 FIXING CLIENT DATA QUALITY ISSUES\n');
  console.log('='.repeat(60));

  try {
    // Get all clients
    const clients = await prisma.client.findMany({
      orderBy: { createdAt: 'desc' }
    });

    console.log(`\n📋 Found ${clients.length} clients to check\n`);

    let fixesApplied = 0;
    const fixes: string[] = [];

    for (const client of clients) {
      let needsUpdate = false;
      const updates: any = {};

      // Fix 1: Remove trailing commas from email
      if (client.email && client.email.endsWith(',')) {
        const fixedEmail = client.email.replace(/,$/, '');
        updates.email = fixedEmail;
        needsUpdate = true;
        fixes.push(`Client ${client.id} (${client.name}): Fixed email "${client.email}" → "${fixedEmail}"`);
      }

      // Fix 2: Trim whitespace from email
      if (client.email && client.email !== client.email.trim()) {
        updates.email = client.email.trim();
        needsUpdate = true;
        if (!fixes.some(f => f.includes(client.id))) {
          fixes.push(`Client ${client.id} (${client.name}): Trimmed email whitespace`);
        }
      }

      // Fix 3: Validate email format (basic check)
      if (client.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(client.email)) {
        console.warn(`⚠️  Client ${client.id} (${client.name}) has invalid email format: ${client.email}`);
        // Don't auto-fix invalid emails, just warn
      }

      // Fix 4: Trim phone number whitespace
      if (client.phone && client.phone !== client.phone.trim()) {
        updates.phone = client.phone.trim();
        needsUpdate = true;
        fixes.push(`Client ${client.id} (${client.name}): Trimmed phone whitespace`);
      }

      // Fix 5: Trim name whitespace
      if (client.name && client.name !== client.name.trim()) {
        updates.name = client.name.trim();
        needsUpdate = true;
        fixes.push(`Client ${client.id} (${client.name}): Trimmed name whitespace`);
      }

      // Apply updates if any
      if (needsUpdate) {
        await prisma.client.update({
          where: { id: client.id },
          data: updates
        });
        fixesApplied++;
        console.log(`✅ Fixed client: ${client.name} (${client.id})`);
      }
    }

    console.log(`\n\n📊 FIX SUMMARY:\n`);
    console.log('='.repeat(60));
    console.log(`Total clients checked: ${clients.length}`);
    console.log(`Clients fixed: ${fixesApplied}`);
    console.log(`Total fixes applied: ${fixes.length}`);

    if (fixes.length > 0) {
      console.log(`\n\n🔧 FIXES APPLIED:\n`);
      fixes.forEach((fix, index) => {
        console.log(`${index + 1}. ${fix}`);
      });
    } else {
      console.log(`\n✅ No fixes needed - all data is clean!`);
    }

    // Verify fixes
    console.log(`\n\n🔍 VERIFICATION:\n`);
    console.log('='.repeat(60));

    const updatedClients = await prisma.client.findMany({
      orderBy: { createdAt: 'desc' }
    });

    let issuesRemaining = 0;
    updatedClients.forEach(client => {
      // Check for remaining issues
      if (client.email && client.email.endsWith(',')) {
        console.warn(`⚠️  Client ${client.id} still has trailing comma in email: ${client.email}`);
        issuesRemaining++;
      }
      if (client.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(client.email)) {
        console.warn(`⚠️  Client ${client.id} has invalid email format: ${client.email}`);
        issuesRemaining++;
      }
    });

    if (issuesRemaining === 0) {
      console.log('✅ All data quality issues have been resolved!');
    } else {
      console.log(`⚠️  ${issuesRemaining} issues remain (may require manual intervention)`);
    }

    console.log(`\n\n✅ Fix Complete!\n`);

  } catch (error: any) {
    console.error('❌ Fix Error:', error);
    if (error?.message) {
      console.error('Error message:', error.message);
    }
    if (error?.stack) {
      console.error('Error stack:', error.stack);
    }
    throw error;
  } finally {
    try {
      await prisma.$disconnect();
    } catch (e) {
      // Ignore disconnect errors
    }
  }
}

// Run fix
fixClientsData()
  .then(() => {
    console.log('Fix completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Fix failed:', error);
    process.exit(1);
  });
