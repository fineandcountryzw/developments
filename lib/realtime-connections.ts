/**
 * Real-time Connection Management
 * 
 * Manages Server-Sent Events (SSE) connections for real-time updates.
 * Separated from route handler to allow proper exports.
 * 
 * @module lib/realtime-connections
 */

import { logger } from '@/lib/logger';

// Store active SSE connections
export const connections = new Map<string, {
  controller: ReadableStreamDefaultController;
  userId: string;
  role: string;
  lastPing: number;
}>();

// Cleanup interval - remove stale connections
setInterval(() => {
  const now = Date.now();
  for (const [id, conn] of connections.entries()) {
    if (now - conn.lastPing > 120000) { // 2 minutes timeout
      try {
        conn.controller.close();
      } catch (e) {
        // Connection already closed
      }
      connections.delete(id);
      logger.debug('Removed stale SSE connection', { module: 'SSE', connectionId: id });
    }
  }
}, 30000); // Check every 30 seconds

/**
 * Broadcast update to all connected clients (or filtered by role/user)
 */
export function broadcastUpdate(data: {
  type: 'payment' | 'reservation' | 'activity' | 'stand' | 'client';
  action: 'created' | 'updated' | 'deleted';
  payload: any;
  filter?: {
    userId?: string;
    role?: string;
    branch?: string;
  };
}) {
  const encoder = new TextEncoder();
  const message = `data: ${JSON.stringify({
    ...data,
    timestamp: new Date().toISOString()
  })}\n\n`;

  let sent = 0;
  for (const [id, conn] of connections.entries()) {
    try {
      // Apply filters if provided
      if (data.filter) {
        if (data.filter.userId && conn.userId !== data.filter.userId) continue;
        if (data.filter.role && conn.role !== data.filter.role) continue;
      }

      conn.controller.enqueue(encoder.encode(message));
      conn.lastPing = Date.now();
      sent++;
    } catch (error) {
      // Connection closed, remove it
      connections.delete(id);
      logger.debug('Removed closed connection during broadcast', { module: 'SSE', connectionId: id });
    }
  }

  if (sent > 0) {
    logger.debug('Broadcast update sent', {
      module: 'SSE',
      type: data.type,
      action: data.action,
      recipients: sent
    });
  }

  return sent;
}

/**
 * Get connection count (for monitoring)
 */
export function getConnectionCount(): number {
  return connections.size;
}
