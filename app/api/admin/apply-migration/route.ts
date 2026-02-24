import { NextRequest } from 'next/server';
import prisma from '@/lib/prisma';
import fs from 'fs';
import path from 'path';
import { logger } from '@/lib/logger';
import { apiError, apiSuccess } from '@/lib/api-response';
import { ErrorCodes } from '@/lib/error-codes';

/**
 * POST /api/admin/apply-migration
 * Apply Kanban migration (DEV ONLY)
 */
export async function POST(_request: NextRequest) {
  try {
    logger.info('Starting Kanban migration', { module: 'API', action: 'POST_ADMIN_APPLY_MIGRATION' });
    
    // Read migration file
    const migrationPath = path.join(process.cwd(), 'prisma/migrations/add_kanban_models/migration.sql');
    const migrationSQL = fs.readFileSync(migrationPath, 'utf-8');
    
    // Split by statements
    const statements = migrationSQL
      .split(';')
      .map((s: string) => {
        const lines = s.split('\n').filter((l: string) => !l.trim().startsWith('--'));
        return lines.join('\n').trim();
      })
      .filter((s: string) => s.length > 0);
    
    logger.info('Found SQL statements', { module: 'API', action: 'POST_ADMIN_APPLY_MIGRATION', count: statements.length });
    
    let executed = 0;
    let skipped = 0;
    
    // Execute each statement
    for (const stmt of statements) {
      try {
        await prisma.$executeRawUnsafe(stmt + ';');
        executed++;
        logger.debug(`Statement ${executed} executed`, { module: 'API', action: 'POST_ADMIN_APPLY_MIGRATION' });
      } catch (err: any) {
        const errMsg = err.message || String(err);
        if (errMsg.includes('already exists') || errMsg.includes('duplicate key') || errMsg.includes('relation')) {
          skipped++;
          logger.debug('Statement skipped (already exists)', { module: 'API', action: 'POST_ADMIN_APPLY_MIGRATION' });
        } else {
          logger.error('Migration statement error', err, { module: 'API', action: 'POST_ADMIN_APPLY_MIGRATION', errorPreview: errMsg.substring(0, 150) });
          throw err;
        }
      }
    }
    
    return apiSuccess({
      message: 'Migration applied',
      executed,
      skipped,
      total: statements.length
    });
  } catch (error: any) {
    logger.error('Migration error', error, { module: 'API', action: 'POST_ADMIN_APPLY_MIGRATION' });
    return apiError('Migration failed: ' + error.message, 500, ErrorCodes.CREATE_ERROR);
  }
}
