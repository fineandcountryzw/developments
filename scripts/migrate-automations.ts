/**
 * Migration Script: Convert Old Automation Systems to New Unified System
 * 
 * Converts:
 * - PaymentAutomationSettings → Automation records
 * - PipelineRule → Automation records
 * 
 * Usage: npx tsx scripts/migrate-automations.ts
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

// Clean DATABASE_URL
process.env.DATABASE_URL = process.env.DATABASE_URL.replace(/^["']|["']$/g, '');

async function migrateAutomations() {
  const { default: prisma } = await import('../lib/prisma');
  
  console.log('🔄 MIGRATING AUTOMATIONS TO NEW SYSTEM\n');
  console.log('='.repeat(60));
  
  try {
    // ───────────────────────────────────────────────────────────────────────
    // 1. Migrate Payment Automation Settings
    // ───────────────────────────────────────────────────────────────────────
    
    console.log('\n📧 Migrating Payment Automation Settings...\n');
    
    const paymentSettings = await prisma.paymentAutomationSettings.findMany();
    
    for (const settings of paymentSettings) {
      // Create Payment Reminder Automation
      if (settings.enableReminders) {
        await prisma.automation.upsert({
          where: {
            id: `auto-payment-reminder-${settings.branch}`
          },
          create: {
            id: `auto-payment-reminder-${settings.branch}`,
            name: `Payment Reminders - ${settings.branch}`,
            description: 'Send payment reminders on 5th and 20th of month',
            enabled: true,
            triggerType: 'schedule',
            schedule: '0 9 5,20 * *', // 5th and 20th at 09:00 UTC
            entityType: 'invoice',
            condition: {
              field: 'status',
              operator: 'in',
              value: ['OUTSTANDING', 'PAYMENT_PENDING']
            },
            actions: [{
              type: 'email',
              target: 'client.email',
              template: 'payment-reminder'
            }],
            branch: settings.branch,
            retryPolicy: {
              maxRetries: 3,
              backoff: 'exponential',
              initialDelay: 1000,
              maxDelay: 60000
            }
          },
          update: {
            enabled: settings.enableReminders
          }
        });
        
        console.log(`  ✅ Created Payment Reminder automation for ${settings.branch}`);
      }
      
      // Create Escalation Automation
      if (settings.enableEscalation) {
        await prisma.automation.upsert({
          where: {
            id: `auto-escalation-${settings.branch}`
          },
          create: {
            id: `auto-escalation-${settings.branch}`,
            name: `Invoice Escalation - ${settings.branch}`,
            description: 'Escalate overdue invoices (30+ days)',
            enabled: true,
            triggerType: 'schedule',
            schedule: '0 8 1 * *', // 1st of month at 08:00 UTC
            entityType: 'invoice',
            condition: {
              field: 'daysOverdue',
              operator: 'greater',
              value: settings.escalationDaysOverdue || 30
            },
            actions: [{
              type: 'email',
              target: 'client.email',
              template: 'overdue-escalation'
            }],
            branch: settings.branch,
            retryPolicy: {
              maxRetries: 3,
              backoff: 'exponential',
              initialDelay: 1000,
              maxDelay: 60000
            }
          },
          update: {
            enabled: settings.enableEscalation
          }
        });
        
        console.log(`  ✅ Created Escalation automation for ${settings.branch}`);
      }
      
      // Create Follow-up Automation
      if (settings.enableFollowups) {
        await prisma.automation.upsert({
          where: {
            id: `auto-followup-${settings.branch}`
          },
          create: {
            id: `auto-followup-${settings.branch}`,
            name: `Follow-up Emails - ${settings.branch}`,
            description: 'Send follow-up emails for overdue invoices',
            enabled: true,
            triggerType: 'schedule',
            schedule: '0 10 10,25 * *', // 10th and 25th at 10:00 UTC
            entityType: 'invoice',
            condition: {
              field: 'status',
              operator: 'equals',
              value: 'OVERDUE'
            },
            actions: [{
              type: 'email',
              target: 'client.email',
              template: 'followup-email'
            }],
            branch: settings.branch,
            retryPolicy: {
              maxRetries: 3,
              backoff: 'exponential',
              initialDelay: 1000,
              maxDelay: 60000
            }
          },
          update: {
            enabled: settings.enableFollowups
          }
        });
        
        console.log(`  ✅ Created Follow-up automation for ${settings.branch}`);
      }
    }
    
    // ───────────────────────────────────────────────────────────────────────
    // 2. Pipeline Rules Migration (Skipped - pipeline module removed)
    // ───────────────────────────────────────────────────────────────────────
    
    console.log('\n📊 Pipeline Rules migration skipped (module removed)\n');
    const pipelineRules: any[] = [];
    
    // ───────────────────────────────────────────────────────────────────────
    // 3. Create Payment Success → Contract Automation
    // ───────────────────────────────────────────────────────────────────────
    
    console.log('\n💰 Creating Payment Success Automation...\n');
    
    await prisma.automation.upsert({
      where: {
        id: 'auto-payment-success-contract'
      },
      create: {
        id: 'auto-payment-success-contract',
        name: 'Payment Success → Contract Creation',
        description: 'When payment is confirmed, mark stand SOLD, create contract, send email',
        enabled: true,
        triggerType: 'event',
        eventType: 'payment.confirmed',
        entityType: 'payment',
        condition: {
          field: 'status',
          operator: 'equals',
          value: 'CONFIRMED'
        },
        actions: [
          {
            type: 'update',
            target: 'stand',
            data: { status: 'SOLD' }
          },
          {
            type: 'create',
            target: 'contract',
            data: { 
              status: 'DRAFT - PAYMENT RECEIVED',
              templateId: 'default'
            }
          },
          {
            type: 'email',
            target: 'client.email',
            template: 'contract-created'
          }
        ],
        branch: 'Harare',
        retryPolicy: {
          maxRetries: 3,
          backoff: 'exponential',
          initialDelay: 1000,
          maxDelay: 60000
        }
      },
      update: {
        enabled: true
      }
    });
    
    console.log('  ✅ Created Payment Success automation');
    
    // ───────────────────────────────────────────────────────────────────────
    // Summary
    // ───────────────────────────────────────────────────────────────────────
    
    const totalAutomations = await prisma.automation.count();
    
    console.log('\n\n📊 MIGRATION SUMMARY:\n');
    console.log('='.repeat(60));
    console.log(`Total automations created: ${totalAutomations}`);
    console.log(`Payment settings migrated: ${paymentSettings.length}`);
    console.log(`Pipeline rules migrated: 0 (module removed)`);
    console.log('\n✅ Migration complete!\n');
    
  } catch (error: any) {
    console.error('\n❌ Migration error:', error);
    if (error?.message) {
      console.error('Error message:', error.message);
    }
    if (error?.stack) {
      console.error('Error stack:', error.stack);
    }
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Run migration
migrateAutomations()
  .then(() => {
    console.log('Migration completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Migration failed:', error);
    process.exit(1);
  });
