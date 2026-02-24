import { logger } from './logger';
import { getDbPool } from './db-pool';

export interface HealthCheckResult {
  healthy: boolean;
  errors: string[];
}

export async function checkDatabaseHealth(): Promise<HealthCheckResult> {
  const errors: string[] = [];
  const pool = getDbPool();

  try {
    // Check if featured_tag column exists in developments table
    const columnCheck = await pool.query(`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_name = 'developments'
      AND column_name = 'featured_tag'
    `);

    if (columnCheck.rows.length === 0) {
      errors.push('featured_tag column missing from developments table');
      logger.error('Database health check failed: featured_tag column missing', { module: 'DB_HEALTH_CHECK' });
    } else {
      logger.info('Database health check passed: featured_tag column exists', { module: 'DB_HEALTH_CHECK' });
    }

    // Check if featured_tag_check constraint exists
    const constraintCheck = await pool.query(`
      SELECT constraint_name
      FROM information_schema.table_constraints
      WHERE table_name = 'developments'
      AND constraint_name = 'featured_tag_check'
    `);

    if (constraintCheck.rows.length === 0) {
      errors.push('featured_tag_check constraint missing from developments table');
      logger.warn('Database health check warning: featured_tag_check constraint missing', { module: 'DB_HEALTH_CHECK' });
    }

    // Test a simple query
    await pool.query('SELECT 1');

    return {
      healthy: errors.length === 0,
      errors,
    };
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.error('Database health check failed', { module: 'DB_HEALTH_CHECK', error: errorMessage });
    return {
      healthy: false,
      errors: [errorMessage],
    };
  }
}
