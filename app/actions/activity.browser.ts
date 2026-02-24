/**
 * Browser-safe stub for app/actions/activity
 * 
 * This file provides client-side stubs for server actions.
 * Actual implementation should be called via Server Actions or API routes.
 */

console.warn('[ACTIVITY] Browser stub loaded. Server actions should be called from server components or API routes.');

export async function logActivity(_input: any) {
  throw new Error('logActivity can only be called from server components');
}

export async function getActivities(_input: any) {
  throw new Error('getActivities can only be called from server components');
}

export async function logLogin() {
  throw new Error('logLogin can only be called from server components');
}

export async function logReservation(_standId: string, _developmentName: string) {
  throw new Error('logReservation can only be called from server components');
}

export async function logPaymentUpload(_reservationId: string, _popUrl: string) {
  throw new Error('logPaymentUpload can only be called from server components');
}

export async function logVerification(_reservationId: string, _standId: string, _amount: number) {
  throw new Error('logVerification can only be called from server components');
}

export async function logStandUpdate(_standId: string, _oldStatus: string, _newStatus: string) {
  throw new Error('logStandUpdate can only be called from server components');
}

export async function logUserCreated(_newUserId: string, _email: string, _role: string) {
  throw new Error('logUserCreated can only be called from server components');
}

export async function logAgentAssigned(_clientId: string, _agentId: string, _agentName: string) {
  throw new Error('logAgentAssigned can only be called from server components');
}
