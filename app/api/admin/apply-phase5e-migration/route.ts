import { NextRequest } from 'next/server';
import { neon } from '@neondatabase/serverless';
import * as fs from 'fs';
import * as path from 'path';
import { logger } from '@/lib/logger';
import { apiError, apiSuccess } from '@/lib/api-response';
import { ErrorCodes } from '@/lib/error-codes';

export async function GET(_req: NextRequest) {
  try {
    const sql = neon(process.env.DATABASE_URL!);

    // Read the Phase 5E migration file
    const migrationPath = path.join(
      process.cwd(),
      'prisma/migrations/add_phase5e_contracts/migration.sql'
    );
    
    const migrationContent = fs.readFileSync(migrationPath, 'utf-8');
    
    // Split by semicolon and filter out comments and empty statements
    let statements = migrationContent
      .split(';')
      .map(s => s.trim())
      .filter(s => {
        // Filter out pure comments and empty lines
        const lines = s.split('\n').filter(l => l.trim() && !l.trim().startsWith('--'));
        return lines.length > 0;
      })
      .map(s => {
        // Remove comment lines from statements
        return s.split('\n')
          .filter(l => !l.trim().startsWith('--'))
          .join('\n')
          .trim();
      })
      .filter(s => s.length > 0);

    logger.info('Found SQL statements to execute', { module: 'API', action: 'GET_ADMIN_APPLY_PHASE5E_MIGRATION', count: statements.length });
    
    let executedCount = 0;
    let skippedCount = 0;
    let errorCount = 0;
    const results: any[] = [];

    // Execute each statement
    for (const statement of statements) {
      try {
        // Log the actual statement being executed for debugging
        if (statement.includes('CREATE TABLE')) {
          logger.debug('Executing CREATE TABLE statement', { module: 'API', action: 'GET_ADMIN_APPLY_PHASE5E_MIGRATION', preview: statement.substring(0, 80) });
        }
        
        // Use sql.query() for SQL statements without template literals
        const result = await sql.query(statement);
        executedCount++;
        results.push({
          statement: statement.substring(0, 60) + '...',
          status: 'executed',
          rows: Array.isArray(result) ? result.length : (result as any)?.rowCount || 0
        });
      } catch (err: any) {
        const errorMsg = err.message || '';
        
        // Skip if table/index already exists
        if (
          errorMsg.includes('already exists') ||
          errorMsg.includes('duplicate') ||
          err.code === '42P07' // PostgreSQL "already exists" code
        ) {
          skippedCount++;
          results.push({
            statement: statement.substring(0, 60) + '...',
            status: 'skipped',
            reason: 'Already exists'
          });
        } else {
          errorCount++;
          logger.error('SQL Error', err, { module: 'API', action: 'GET_ADMIN_APPLY_PHASE5E_MIGRATION', errorMsg, statementPreview: statement.substring(0, 100) });
          results.push({
            statement: statement.substring(0, 60) + '...',
            status: 'error',
            error: errorMsg.substring(0, 100)
          });
        }
      }
    }

    return apiSuccess({
      message: 'Phase 5E migration applied',
      executed: executedCount,
      skipped: skippedCount,
      errors: errorCount,
      total: statements.length,
      results
    });
  } catch (error: any) {
    logger.error('Migration error', error, { module: 'API', action: 'GET_ADMIN_APPLY_PHASE5E_MIGRATION' });
    return apiError('Migration failed', 500, ErrorCodes.CREATE_ERROR, {
      message: error.message,
      details: error.constraint || error.code
    });
  }
}