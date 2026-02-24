/**
 * Real-time Updates Helper
 * 
 * Provides utilities for broadcasting real-time updates via Server-Sent Events.
 * 
 * @module lib/realtime
 */

import { broadcastUpdate } from '@/lib/realtime-connections';

/**
 * Broadcast a payment update to all connected clients
 */
export function broadcastPaymentUpdate(
  action: 'created' | 'updated' | 'deleted',
  payment: any,
  filter?: { userId?: string; role?: string; branch?: string }
) {
  return broadcastUpdate({
    type: 'payment',
    action,
    payload: {
      id: payment.id,
      clientId: payment.clientId,
      amount: payment.amount,
      status: payment.status,
      payment_type: payment.payment_type,
      standId: payment.standId,
      office_location: payment.office_location,
      verification_status: payment.verification_status,
      createdAt: payment.createdAt,
      updatedAt: payment.updatedAt
    },
    filter
  });
}

/**
 * Broadcast a reservation update to all connected clients
 */
export function broadcastReservationUpdate(
  action: 'created' | 'updated' | 'deleted',
  reservation: any,
  filter?: { userId?: string; role?: string; branch?: string }
) {
  return broadcastUpdate({
    type: 'reservation',
    action,
    payload: {
      id: reservation.id,
      standId: reservation.standId,
      clientId: reservation.clientId,
      agentId: reservation.agentId,
      status: reservation.status,
      expiresAt: reservation.expiresAt,
      createdAt: reservation.createdAt,
      updatedAt: reservation.updatedAt
    },
    filter
  });
}

/**
 * Broadcast an activity log update to all connected clients
 */
export function broadcastActivityUpdate(
  action: 'created',
  activity: any,
  filter?: { userId?: string; role?: string; branch?: string }
) {
  return broadcastUpdate({
    type: 'activity',
    action,
    payload: {
      id: activity.id,
      type: activity.type,
      description: activity.description,
      userId: activity.userId,
      module: activity.module,
      recordId: activity.recordId,
      createdAt: activity.createdAt
    },
    filter
  });
}

/**
 * Broadcast a stand status update to all connected clients
 */
export function broadcastStandUpdate(
  action: 'updated',
  stand: any,
  filter?: { userId?: string; role?: string; branch?: string }
) {
  return broadcastUpdate({
    type: 'stand',
    action,
    payload: {
      id: stand.id,
      standNumber: stand.standNumber,
      status: stand.status,
      developmentId: stand.developmentId,
      price: stand.price,
      reserved_by: stand.reserved_by,
      updatedAt: stand.updatedAt
    },
    filter
  });
}

/**
 * Broadcast a client update to all connected clients
 */
export function broadcastClientUpdate(
  action: 'created' | 'updated' | 'deleted',
  client: any,
  filter?: { userId?: string; role?: string; branch?: string }
) {
  return broadcastUpdate({
    type: 'client',
    action,
    payload: {
      id: client.id,
      name: client.name,
      email: client.email,
      branch: client.branch,
      is_portal_user: client.is_portal_user,
      createdAt: client.createdAt,
      updatedAt: client.updatedAt
    },
    filter
  });
}
