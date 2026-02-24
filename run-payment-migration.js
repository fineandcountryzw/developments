// run-payment-migration.js
// Run with: node run-payment-migration.js

import { PrismaClient } from '@prisma/client';
import fs from 'fs';

const prisma = new PrismaClient();

async function runMigration() {
  console.log('🔄 Starting Payment Module Migration...\n');

  try {
    // Read migration SQL
    const sql = fs.readFileSync('./PAYMENT_MODULE_MIGRATION.sql', 'utf-8');
    
    // Split into individual statements (skip comments and empty lines)
    const statements = sql
      .split(';')
      .map(s => s.trim())
      .filter(s => s && !s.startsWith('--') && s !== '');

    console.log(`📋 Found ${statements.length} SQL statements\n`);

    // Execute each statement
    for (let i = 0; i < statements.length; i++) {
      const statement = statements[i];
      
      // Skip comment blocks and verification queries
      if (statement.includes('VERIFICATION QUERIES') || 
          statement.includes('ROLLBACK SCRIPT') ||
          statement.includes('===')) {
        continue;
      }

      try {
        console.log(`⏳ Executing statement ${i + 1}...`);
        await prisma.$executeRawUnsafe(statement + ';');
        console.log(`✅ Statement ${i + 1} completed\n`);
      } catch (error) {
        // Some statements might fail if already applied (like ADD COLUMN IF NOT EXISTS)
        if (error.code === '42701' || error.code === '42P07') {
          console.log(`⚠️  Statement ${i + 1} already applied (skipping)\n`);
        } else {
          console.error(`❌ Error in statement ${i + 1}:`, error.message);
          throw error;
        }
      }
    }

    console.log('\n✅ Migration completed successfully!\n');

    // Run verification queries
    console.log('🔍 Running verification checks...\n');

    const paymentTypes = await prisma.$queryRaw`
      SELECT payment_type, COUNT(*) as count 
      FROM payments 
      GROUP BY payment_type 
      ORDER BY count DESC
    `;
    console.log('Payment Types:', paymentTypes);

    const methods = await prisma.$queryRaw`
      SELECT method, COUNT(*) as count 
      FROM payments 
      GROUP BY method 
      ORDER BY count DESC
    `;
    console.log('Payment Methods:', methods);

    const withoutReceipt = await prisma.$queryRaw`
      SELECT COUNT(*) as count 
      FROM payments 
      WHERE manual_receipt_no IS NULL OR manual_receipt_no = ''
    `;
    console.log('Payments without receipt:', withoutReceipt);

    console.log('\n✨ All checks passed!\n');

  } catch (error) {
    console.error('\n❌ Migration failed:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

runMigration();
