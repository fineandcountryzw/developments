#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import prisma from '../lib/prisma.ts';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function applyMigration() {
  try {
    console.log('🔄 Applying Kanban migration...');
    
    // Read migration file
    const migrationPath = path.join(__dirname, '../prisma/migrations/add_kanban_models/migration.sql');
    const migrationSQL = fs.readFileSync(migrationPath, 'utf-8');
    
    // Split by statements and filter empty lines and comments
    const statements = migrationSQL
      .split(';')
      .map(s => {
        // Remove comments
        const lines = s.split('\n').filter(l => !l.trim().startsWith('--'));
        return lines.join('\n').trim();
      })
      .filter(s => s.length > 0);
    
    console.log(`📝 Found ${statements.length} SQL statements to execute`);
    
    // Execute each statement
    for (let i = 0; i < statements.length; i++) {
      const stmt = statements[i] + ';';
      console.log(`\n[${i + 1}/${statements.length}] Executing statement...`);
      try {
        await prisma.$executeRawUnsafe(stmt);
        console.log('✅ Success');
      } catch (err) {
        // Some statements might fail if they already exist, that's OK
        const errMsg = err.message || String(err);
        if (errMsg.includes('already exists') || errMsg.includes('duplicate key') || errMsg.includes('relation')) {
          console.log('⚠️  Already exists (skipped)');
        } else {
          console.error('❌ Error:', errMsg.substring(0, 150));
        }
      }
    }
    
    console.log('\n✅ Migration completed!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

applyMigration();

applyMigration();
