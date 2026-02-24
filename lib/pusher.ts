/**
 * Pusher Configuration
 * 
 * Managed WebSocket service for real-time updates in Fine & Country Zimbabwe ERP
 * 
 * @module lib/pusher
 */

import Pusher from 'pusher';
import { logger } from '@/lib/logger';

/**
 * Pusher server instance for publishing events
 */
export const pusherServer = new Pusher({
  appId: process.env.PUSHER_APP_ID || '',
  key: process.env.PUSHER_KEY || '',
  secret: process.env.PUSHER_SECRET || '',
  cluster: process.env.PUSHER_CLUSTER || 'mt1',
  useTLS: true,
});

/**
 * Pusher client configuration
 */
export const pusherClientConfig = {
  key: process.env.NEXT_PUBLIC_PUSHER_KEY || '',
  cluster: process.env.NEXT_PUBLIC_PUSHER_CLUSTER || 'mt1',
  forceTLS: true,
};

/**
 * Channel naming constants
 */
export const PUSHER_CHANNELS = {
  // User-specific notifications (private)
  user: (userId: string) => `private-user-${userId}`,
  
  // Development-scoped events (private)
  development: (developmentId: string) => `private-dev-${developmentId}`,
  
  // Role-specific channels (private)
  admin: 'private-admin',
  accounts: 'private-accounts',
  agents: 'private-agents',
};

/**
 * Event types for real-time updates
 */
export const PUSHER_EVENTS = {
  // Notifications
  NOTIFICATION: 'notifications:new',
  
  // Stand updates
  STAND_UPDATED: 'stands:updated',
  
  // Payment updates
  PAYMENT_UPDATED: 'payments:updated',
  
  // Reservation updates
  RESERVATION_UPDATED: 'reservations:updated',
  
  // Contract updates
  CONTRACT_UPDATED: 'contracts:updated',
  
  // Installment updates
  INSTALLMENT_UPDATED: 'installments:updated',
  
  // Receipt updates
  RECEIPT_UPDATED: 'receipts:updated',
  
  // Payout updates
  PAYOUT_UPDATED: 'payouts:updated',
  
  // Report updates
  REPORT_UPDATED: 'reports:updated',
  
  // System events
  SYSTEM_EVENT: 'system:events',
};

/**
 * Publish an event to a specific channel
 */
export async function publishToChannel(
  channel: string,
  event: string,
  data: any
): Promise<boolean> {
  try {
    await pusherServer.trigger(channel, event, data);
    
    logger.info('Pusher event published', {
      module: 'PUSHER',
      channel,
      event,
      dataSize: JSON.stringify(data).length,
    });
    
    return true;
  } catch (error) {
    logger.error('Failed to publish Pusher event', error as Error, {
      module: 'PUSHER',
      channel,
      event,
    });
    return false;
  }
}

/**
 * Publish a notification to a user
 */
export async function publishNotification(
  userId: string,
  notification: any
): Promise<boolean> {
  return publishToChannel(
    PUSHER_CHANNELS.user(userId),
    PUSHER_EVENTS.NOTIFICATION,
    notification
  );
}

/**
 * Publish a development-scoped event
 */
export async function publishDevelopmentEvent(
  developmentId: string,
  event: string,
  data: any
): Promise<boolean> {
  return publishToChannel(
    PUSHER_CHANNELS.development(developmentId),
    event,
    data
  );
}

/**
 * Publish an admin/manager event
 */
export async function publishAdminEvent(
  event: string,
  data: any
): Promise<boolean> {
  return publishToChannel(
    PUSHER_CHANNELS.admin,
    event,
    data
  );
}

/**
 * Publish an accounts event
 */
export async function publishAccountsEvent(
  event: string,
  data: any
): Promise<boolean> {
  return publishToChannel(
    PUSHER_CHANNELS.accounts,
    event,
    data
  );
}
