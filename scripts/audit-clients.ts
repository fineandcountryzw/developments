/**
 * Client Database Audit Script
 * Queries and reports on all clients in the database
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

async function auditClients() {
  // Import prisma here after env is loaded
  const { default: prisma } = await import('../lib/prisma');
  console.log('🔍 CLIENT DATABASE AUDIT\n');
  console.log('='.repeat(60));

  try {
    // Get total count
    const totalCount = await prisma.client.count();
    console.log(`\n📊 Total Clients: ${totalCount}\n`);

    if (totalCount === 0) {
      console.log('⚠️  No clients found in database!');
      return;
    }

    // Get all clients with relations
    const clients = await prisma.client.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        reservations: {
          select: {
            id: true,
            status: true,
            createdAt: true
          }
        },
        payments: {
          select: {
            id: true,
            amount: true,
            status: true,
            payment_type: true,
            createdAt: true
          }
        },
        contracts: {
          select: {
            id: true,
            status: true,
            createdAt: true
          }
        },
        generatedContracts: {
          select: {
            id: true,
            status: true,
            createdAt: true
          }
        },
        installmentPlans: {
          select: {
            id: true,
            status: true,
            totalAmount: true,
            remainingBalance: true
          }
        }
      }
    });

    console.log(`\n📋 CLIENT DETAILS:\n`);
    console.log('='.repeat(60));

    clients.forEach((client, index) => {
      console.log(`\n${index + 1}. Client ID: ${client.id}`);
      console.log(`   Name: ${client.name}`);
      if (client.firstName || client.lastName) {
        console.log(`   Full Name: ${client.firstName || ''} ${client.lastName || ''}`.trim());
      }
      console.log(`   Email: ${client.email}`);
      console.log(`   Phone: ${client.phone || 'N/A'}`);
      console.log(`   National ID: ${client.national_id || 'N/A'}`);
      console.log(`   Branch: ${client.branch}`);
      console.log(`   Portal User: ${client.is_portal_user ? 'Yes' : 'No'}`);
      console.log(`   Created: ${client.createdAt.toISOString()}`);
      console.log(`   Updated: ${client.updatedAt.toISOString()}`);

      // Relations summary
      console.log(`\n   📊 Relations:`);
      console.log(`      Reservations: ${client.reservations.length}`);
      console.log(`      Payments: ${client.payments.length}`);
      console.log(`      Generated Contracts: ${client.contracts.length}`);
      console.log(`      Contracts (Phase 5E): ${client.generatedContracts.length}`);
      console.log(`      Installment Plans: ${client.installmentPlans.length}`);

      // Payment summary
      if (client.payments.length > 0) {
        const totalPaid = client.payments
          .filter(p => p.status === 'CONFIRMED')
          .reduce((sum, p) => sum + Number(p.amount), 0);
        console.log(`      Total Paid: $${totalPaid.toLocaleString()}`);
      }

      // Owned stands
      if (client.ownedStands.length > 0) {
        console.log(`      Owned Stands: ${client.ownedStands.length} (${client.ownedStands.join(', ')})`);
      }

      // KYC status
      if (client.kyc && Array.isArray(client.kyc) && client.kyc.length > 0) {
        const verified = client.kyc.filter((doc: any) => doc.status === 'VERIFIED').length;
        console.log(`      KYC Documents: ${client.kyc.length} (${verified} verified)`);
      }

      console.log('\n' + '-'.repeat(60));
    });

    // Summary statistics
    console.log(`\n📈 SUMMARY STATISTICS:\n`);
    console.log('='.repeat(60));

    const stats = {
      total: clients.length,
      withReservations: clients.filter(c => c.reservations.length > 0).length,
      withPayments: clients.filter(c => c.payments.length > 0).length,
      withContracts: clients.filter(c => c.contracts.length > 0 || c.generatedContracts.length > 0).length,
      withInstallments: clients.filter(c => c.installmentPlans.length > 0).length,
      portalUsers: clients.filter(c => c.is_portal_user).length,
      byBranch: {} as Record<string, number>
    };

    clients.forEach(client => {
      stats.byBranch[client.branch] = (stats.byBranch[client.branch] || 0) + 1;
    });

    console.log(`Total Clients: ${stats.total}`);
    console.log(`With Reservations: ${stats.withReservations}`);
    console.log(`With Payments: ${stats.withPayments}`);
    console.log(`With Contracts: ${stats.withContracts}`);
    console.log(`With Installment Plans: ${stats.withInstallments}`);
    console.log(`Portal Users: ${stats.portalUsers}`);
    console.log(`\nBy Branch:`);
    Object.entries(stats.byBranch).forEach(([branch, count]) => {
      console.log(`  ${branch}: ${count}`);
    });

    // Check for seed data clients
    console.log(`\n\n🔍 SEED DATA VERIFICATION:\n`);
    console.log('='.repeat(60));

    const seedClientIds = ['client-demo-1', 'client-demo-2', 'client-demo-3'];
    const foundSeedClients = clients.filter(c => seedClientIds.includes(c.id));

    console.log(`Expected Seed Clients: ${seedClientIds.length}`);
    console.log(`Found Seed Clients: ${foundSeedClients.length}`);

    seedClientIds.forEach(seedId => {
      const found = clients.find(c => c.id === seedId);
      if (found) {
        console.log(`✅ ${seedId}: ${found.name} (${found.email})`);
      } else {
        console.log(`❌ ${seedId}: NOT FOUND`);
      }
    });

    // Check for duplicate emails in same branch
    console.log(`\n\n🔍 UNIQUE CONSTRAINT CHECK:\n`);
    console.log('='.repeat(60));

    const emailBranchMap = new Map<string, number>();
    clients.forEach(client => {
      const key = `${client.email}|${client.branch}`;
      emailBranchMap.set(key, (emailBranchMap.get(key) || 0) + 1);
    });

    const duplicates = Array.from(emailBranchMap.entries())
      .filter(([_, count]) => count > 1);

    if (duplicates.length === 0) {
      console.log('✅ No duplicate email+branch combinations found');
    } else {
      console.log('⚠️  Duplicate email+branch combinations found:');
      duplicates.forEach(([key, count]) => {
        const [email, branch] = key.split('|');
        console.log(`   ${email} in ${branch}: ${count} clients`);
      });
    }

    // Missing required fields check
    console.log(`\n\n🔍 DATA QUALITY CHECK:\n`);
    console.log('='.repeat(60));

    const issues: string[] = [];
    clients.forEach(client => {
      if (!client.email) issues.push(`${client.id}: Missing email`);
      if (!client.name) issues.push(`${client.id}: Missing name`);
      if (!client.branch) issues.push(`${client.id}: Missing branch`);
    });

    if (issues.length === 0) {
      console.log('✅ All clients have required fields');
    } else {
      console.log('⚠️  Data quality issues found:');
      issues.forEach(issue => console.log(`   ${issue}`));
    }

    console.log(`\n\n✅ Audit Complete!\n`);

  } catch (error: any) {
    console.error('❌ Audit Error:', error);
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

// Run audit
auditClients()
  .then(() => {
    console.log('Audit completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Audit failed:', error);
    process.exit(1);
  });
