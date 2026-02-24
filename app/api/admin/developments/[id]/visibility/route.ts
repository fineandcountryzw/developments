import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/access-control';
import { getDbPool } from '@/lib/db-pool';
import { logger } from '@/lib/logger';

export const dynamic = 'force-dynamic';

/**
 * PATCH /api/admin/developments/[id]/visibility
 * 
 * Body: { isPublic: boolean }
 */
export async function PATCH(
    request: NextRequest,
    props: { params: Promise<{ id: string }> }
) {
    try {
        const auth = await requireAdmin(request);
        if (auth.error) return auth.error;

        const params = await props.params;
        const { id } = params;
        const { isPublic } = await request.json();

        if (typeof isPublic !== 'boolean') {
            return NextResponse.json({ success: false, error: 'Invalid payload' }, { status: 400 });
        }

        const pool = getDbPool();

        // Update
        const result = await pool.query(
            `UPDATE developments 
       SET is_public = $1, updated_at = NOW() 
       WHERE id = $2 
       RETURNING id, is_public`,
            [isPublic, id]
        );

        if (result.rowCount === 0) {
            return NextResponse.json({ success: false, error: 'Development not found' }, { status: 404 });
        }

        logger.info('Development visibility updated', {
            module: 'API',
            id,
            isPublic,
            admin: auth.user.email
        });

        return NextResponse.json({ success: true, data: result.rows[0] });

    } catch (error: any) {
        logger.error('Visibility update failed', error, { module: 'API' });
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}
