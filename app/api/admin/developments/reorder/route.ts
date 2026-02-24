import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/access-control';
import { getDbPool } from '@/lib/db-pool';
import { logger } from '@/lib/logger';

// Force dynamic
export const dynamic = 'force-dynamic';

/**
 * PATCH /api/admin/developments/reorder
 * 
 * Body: {
 *   featured: [{ id: 'dev1', rank: 1 }, ...],
 *   list: [{ id: 'dev1', rank: 1 }, { id: 'dev2', rank: 2 }, ...]
 * }
 * 
 * Updates rankings in transaction.
 */
export async function PATCH(request: NextRequest) {
    try {
        // Admin check
        const auth = await requireAdmin(request);
        if (auth.error) return auth.error;

        const body = await request.json();
        const { featured, list } = body;

        if (!Array.isArray(featured) && !Array.isArray(list)) {
            return NextResponse.json({ success: false, error: 'Invalid payload' }, { status: 400 });
        }

        const pool = getDbPool();
        const client = await pool.connect();

        try {
            await client.query('BEGIN');

            // 1. Reset all ranks first (optional, but cleaner if full list provided)
            // Actually simpler: just update the ones provided.
            // If an item is NOT in 'featured' array but had a rank, should we clear it?
            // YES: "featured row = developments where featuredRank is not null"
            // If we only send the new list, we must clear others or set them explicitly.
            // Strategy:
            // - Featured: The UI sends the FULL featured list. Any ID not in this list gets featured_rank = NULL.
            // - List: The UI sends the FULL list order. 

            // Update Featured Ranks
            if (Array.isArray(featured)) {
                // First, clear all featured ranks
                await client.query('UPDATE developments SET featured_rank = NULL');

                // Then set new ranks
                if (featured.length > 0) {
                    // Construct CASE statement for bulk update
                    // update developments set featured_rank = case id when ... end where id in (...)
                    const cases = featured.map((item: any, idx: number) =>
                        `WHEN id = '${item.id}' THEN ${idx + 1}`
                    ).join(' ');

                    const ids = featured.map((item: any) => `'${item.id}'`).join(',');

                    if (ids.length > 0) {
                        await client.query(`
              UPDATE developments 
              SET featured_rank = CASE ${cases} END
              WHERE id IN (${ids})
            `);
                    }
                }
            }

            // Update Display Ranks (Main List)
            if (Array.isArray(list)) {
                // For display list, we don't necessarily want to clear those NOT in list 
                // (maybe pagination?), but usually admin reordering implies full control.
                // Let's assume full reorder for 'display_rank'.

                // Reset all display ranks? Or just update provided?
                // Safest for "ordering" features is usually to update based on what's sent.
                // We'll trust the client sends `rank` (1-based index).

                const cases = list.map((item: any) =>
                    `WHEN id = '${item.id}' THEN ${item.rank}` // user-provided rank
                ).join(' ');

                const ids = list.map((item: any) => `'${item.id}'`).join(',');

                if (ids.length > 0) {
                    await client.query(`
              UPDATE developments 
              SET display_rank = CASE ${cases} END
              WHERE id IN (${ids})
            `);
                }
            }

            await client.query('COMMIT');

            logger.info('Developments reordered', {
                module: 'API',
                admin: auth.user.email,
                featuredCount: featured?.length,
                listCount: list?.length
            });

            return NextResponse.json({ success: true });

        } catch (err) {
            await client.query('ROLLBACK');
            throw err;
        } finally {
            client.release();
        }

    } catch (error: any) {
        logger.error('Reorder failed', error, { module: 'API' });
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}
