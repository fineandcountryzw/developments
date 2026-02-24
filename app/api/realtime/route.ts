/**
 * Real-time Updates API (Server-Sent Events)
 * 
 * Provides real-time updates for:
 * - Payment status changes
 * - Reservation updates
 * - Activity logs
 * - Stand status changes
 * 
 * @module app/api/realtime/route.ts
 */

import { NextRequest } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/authOptions';
import { logger } from '@/lib/logger';
import { connections } from '@/lib/realtime-connections';

/**
 * GET /api/realtime
 * Server-Sent Events endpoint for real-time updates
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user) {
      return new Response('Unauthorized', { status: 401 });
    }

    const connectionId = `${session.user.id}-${Date.now()}-${Math.random().toString(36).substring(7)}`;
    
    logger.info('SSE connection established', {
      module: 'SSE',
      connectionId,
      userId: session.user.id,
      role: session.user.role
    });

    const encoder = new TextEncoder();
    let pingInterval: NodeJS.Timeout | null = null;

    const stream = new ReadableStream({
      start(controller) {
        // Store connection
        connections.set(connectionId, {
          controller,
          userId: session.user.id,
          role: session.user.role || 'CLIENT',
          lastPing: Date.now()
        });

        // Send initial connection message
        try {
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify({
              type: 'connected',
              connectionId,
              timestamp: new Date().toISOString()
            })}\n\n`)
          );
        } catch (err) {
          logger.error('Failed to send initial SSE message', err as Error, { module: 'SSE' });
        }

        // Send ping every 30 seconds to keep connection alive
        pingInterval = setInterval(() => {
          try {
            const conn = connections.get(connectionId);
            if (conn) {
              conn.lastPing = Date.now();
              controller.enqueue(
                encoder.encode(`data: ${JSON.stringify({
                  type: 'ping',
                  timestamp: new Date().toISOString()
                })}\n\n`)
              );
            } else {
              if (pingInterval) clearInterval(pingInterval);
            }
          } catch (error) {
            if (pingInterval) clearInterval(pingInterval);
            connections.delete(connectionId);
            logger.error('SSE ping error', error as Error, { module: 'SSE', connectionId });
          }
        }, 30000);
      },
      cancel() {
        // Cleanup on close
        if (pingInterval) clearInterval(pingInterval);
        connections.delete(connectionId);
        logger.debug('SSE connection closed', { module: 'SSE', connectionId });
      }
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache, no-transform',
        'Connection': 'keep-alive',
        'X-Accel-Buffering': 'no', // Disable nginx buffering
      },
    });
  } catch (error) {
    logger.error('SSE connection error', error as Error, { module: 'SSE' });
    return new Response('Internal Server Error', { status: 500 });
  }
}

// Note: broadcastUpdate and getConnectionCount are exported from @/lib/realtime-connections
