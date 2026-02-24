/**
 * Event Types for Notifications + Audit Email System
 * 
 * @module lib/events/types
 */

import { UserRole } from '@prisma/client';

// Enums defined in schema but not yet generated - define locally until migration
export enum NotificationType {
  CONTRACT_CREATED = 'CONTRACT_CREATED',
  CONTRACT_SENT = 'CONTRACT_SENT',
  CONTRACT_SIGNED = 'CONTRACT_SIGNED',
  CONTRACT_RESENT = 'CONTRACT_RESENT',
  CONTRACT_APPROVED = 'CONTRACT_APPROVED',
  CONTRACT_REJECTED = 'CONTRACT_REJECTED',
  PAYMENT_RECORDED = 'PAYMENT_RECORDED',
  PAYMENT_VERIFIED = 'PAYMENT_VERIFIED',
  PAYMENT_REJECTED = 'PAYMENT_REJECTED',
  RECEIPT_ISSUED = 'RECEIPT_ISSUED',
  RECEIPT_VOIDED = 'RECEIPT_VOIDED',
  INSTALLMENT_PAID = 'INSTALLMENT_PAID',
  INSTALLMENT_OVERDUE = 'INSTALLMENT_OVERDUE',
  STAND_RESERVED = 'STAND_RESERVED',
  STAND_SOLD = 'STAND_SOLD',
  STAND_RELEASED = 'STAND_RELEASED',
  PAYOUT_INITIATED = 'PAYOUT_INITIATED',
  PAYOUT_APPROVED = 'PAYOUT_APPROVED',
  PAYOUT_COMPLETED = 'PAYOUT_COMPLETED',
  USER_INVITED = 'USER_INVITED',
  USER_ROLE_CHANGED = 'USER_ROLE_CHANGED',
  ACCESS_DENIED = 'ACCESS_DENIED',
}

export enum SeverityLevel {
  INFO = 'INFO',
  WARN = 'WARN',
  CRITICAL = 'CRITICAL',
}

export enum EntityType {
  CONTRACT = 'CONTRACT',
  STAND = 'STAND',
  PAYMENT = 'PAYMENT',
  RECEIPT = 'RECEIPT',
  INSTALLMENT = 'INSTALLMENT',
  PAYOUT = 'PAYOUT',
  DEVELOPMENT = 'DEVELOPMENT',
  USER = 'USER',
}

// ============================================================================
// Core Event Types
// ============================================================================

/**
 * Base event payload that all events extend
 */
export interface BaseEventPayload {
  /** Unique identifier for idempotency */
  idempotencyKey?: string;
  /** User who triggered the event */
  actorId?: string;
  actorRole?: UserRole;
  actorEmail?: string;
  /** Request metadata */
  ipAddress?: string;
  userAgent?: string;
  /** Timestamp */
  timestamp?: Date;
}

/**
 * Entity reference for events
 */
export interface EntityRef {
  type: EntityType;
  id: string;
  developmentId?: string;
}

// ============================================================================
// Contract Events
// ============================================================================

export interface ContractCreatedEvent extends BaseEventPayload {
  type: NotificationType.CONTRACT_CREATED;
  contractId: string;
  templateId: string;
  standId: string;
  clientId: string;
  developmentId: string;
}

export interface ContractSentEvent extends BaseEventPayload {
  type: NotificationType.CONTRACT_SENT;
  contractId: string;
  submissionId?: string;
  clientId: string;
  developerId?: string;
  developmentId: string;
}

export interface ContractSignedEvent extends BaseEventPayload {
  type: NotificationType.CONTRACT_SIGNED;
  contractId: string;
  submissionId?: string;
  signedBy: 'client' | 'developer' | 'both';
  clientId: string;
  developerId?: string;
  developmentId: string;
}

export interface ContractResentEvent extends BaseEventPayload {
  type: NotificationType.CONTRACT_RESENT;
  contractId: string;
  clientId: string;
  developmentId: string;
  reason?: string;
}

// ============================================================================
// Payment Events
// ============================================================================

export interface PaymentRecordedEvent extends BaseEventPayload {
  type: NotificationType.PAYMENT_RECORDED;
  paymentId: string;
  clientId: string;
  standId?: string;
  developmentId: string;
  amount: number;
  method: string;
}

export interface PaymentVerifiedEvent extends BaseEventPayload {
  type: NotificationType.PAYMENT_VERIFIED;
  paymentId: string;
  clientId: string;
  standId?: string;
  developmentId: string;
  amount: number;
  verifiedBy: string;
}

export interface PaymentRejectedEvent extends BaseEventPayload {
  type: NotificationType.PAYMENT_REJECTED;
  paymentId: string;
  clientId: string;
  standId?: string;
  developmentId: string;
  amount: number;
  reason: string;
}

// ============================================================================
// Receipt Events
// ============================================================================

export interface ReceiptIssuedEvent extends BaseEventPayload {
  type: NotificationType.RECEIPT_ISSUED;
  receiptId: string;
  paymentId: string;
  clientId: string;
  developmentId: string;
  amount: number;
  receiptNumber: string;
}

export interface ReceiptVoidedEvent extends BaseEventPayload {
  type: NotificationType.RECEIPT_VOIDED;
  receiptId: string;
  paymentId: string;
  clientId: string;
  developmentId: string;
  amount: number;
  reason: string;
  voidedBy: string;
}

// ============================================================================
// Stand/Inventory Events
// ============================================================================

export interface StandReservedEvent extends BaseEventPayload {
  type: NotificationType.STAND_RESERVED;
  standId: string;
  standNumber: string;
  developmentId: string;
  clientId: string;
  agentId?: string;
  reservationId: string;
}

export interface StandSoldEvent extends BaseEventPayload {
  type: NotificationType.STAND_SOLD;
  standId: string;
  standNumber: string;
  developmentId: string;
  clientId: string;
  salePrice: number;
}

export interface StandReleasedEvent extends BaseEventPayload {
  type: NotificationType.STAND_RELEASED;
  standId: string;
  standNumber: string;
  developmentId: string;
  previousClientId?: string;
  reason: string;
}

// ============================================================================
// Installment Events
// ============================================================================

export interface InstallmentPaidEvent extends BaseEventPayload {
  type: NotificationType.INSTALLMENT_PAID;
  installmentId: string;
  planId: string;
  clientId: string;
  developmentId: string;
  amount: number;
  installmentNo: number;
}

export interface InstallmentOverdueEvent extends BaseEventPayload {
  type: NotificationType.INSTALLMENT_OVERDUE;
  installmentId: string;
  planId: string;
  clientId: string;
  developmentId: string;
  amount: number;
  daysOverdue: number;
}

// ============================================================================
// Payout Events
// ============================================================================

export interface PayoutInitiatedEvent extends BaseEventPayload {
  type: NotificationType.PAYOUT_INITIATED;
  payoutId: string;
  agentId: string;
  developmentId?: string;
  amount: number;
  month: string;
}

export interface PayoutApprovedEvent extends BaseEventPayload {
  type: NotificationType.PAYOUT_APPROVED;
  payoutId: string;
  agentId: string;
  developmentId?: string;
  amount: number;
  approvedBy: string;
}

export interface PayoutCompletedEvent extends BaseEventPayload {
  type: NotificationType.PAYOUT_COMPLETED;
  payoutId: string;
  agentId: string;
  developmentId?: string;
  amount: number;
  completedAt: Date;
}

// ============================================================================
// User Events
// ============================================================================

export interface UserInvitedEvent extends BaseEventPayload {
  type: NotificationType.USER_INVITED;
  invitationId: string;
  email: string;
  role: UserRole;
  branch: string;
  invitedBy: string;
}

export interface UserRoleChangedEvent extends BaseEventPayload {
  type: NotificationType.USER_ROLE_CHANGED;
  userId: string;
  email: string;
  previousRole: UserRole;
  newRole: UserRole;
  changedBy: string;
}

// ============================================================================
// Access Events
// ============================================================================

export interface AccessDeniedEvent extends BaseEventPayload {
  type: NotificationType.ACCESS_DENIED;
  resource: string;
  action: string;
  attemptedBy: string;
  attemptedRole: UserRole;
  reason: string;
}

// ============================================================================
// Union Type for All Events
// ============================================================================

export type NotificationEvent =
  | ContractCreatedEvent
  | ContractSentEvent
  | ContractSignedEvent
  | ContractResentEvent
  | PaymentRecordedEvent
  | PaymentVerifiedEvent
  | PaymentRejectedEvent
  | ReceiptIssuedEvent
  | ReceiptVoidedEvent
  | StandReservedEvent
  | StandSoldEvent
  | StandReleasedEvent
  | InstallmentPaidEvent
  | InstallmentOverdueEvent
  | PayoutInitiatedEvent
  | PayoutApprovedEvent
  | PayoutCompletedEvent
  | UserInvitedEvent
  | UserRoleChangedEvent
  | AccessDeniedEvent;

// ============================================================================
// Event Configuration
// ============================================================================

/**
 * Configuration for each event type
 */
export interface EventConfig {
  /** Default severity level */
  severity: SeverityLevel;
  /** Whether to send audit email */
  auditEmail: boolean;
  /** Whether to create in-app notification */
  inApp: boolean;
  /** Recipient roles (in addition to specific users) */
  recipientRoles: UserRole[];
  /** Whether to notify the client associated with the entity */
  notifyClient: boolean;
  /** Whether to notify the developer associated with the development */
  notifyDeveloper: boolean;
}

/**
 * Event configuration map
 */
export const EVENT_CONFIG: Record<NotificationType, EventConfig> = {
  [NotificationType.CONTRACT_CREATED]: {
    severity: SeverityLevel.INFO,
    auditEmail: true,
    inApp: true,
    recipientRoles: [UserRole.ADMIN, UserRole.MANAGER, UserRole.AGENT],
    notifyClient: true,
    notifyDeveloper: false,
  },
  [NotificationType.CONTRACT_SENT]: {
    severity: SeverityLevel.INFO,
    auditEmail: true,
    inApp: true,
    recipientRoles: [UserRole.ADMIN, UserRole.MANAGER, UserRole.AGENT],
    notifyClient: true,
    notifyDeveloper: true,
  },
  [NotificationType.CONTRACT_SIGNED]: {
    severity: SeverityLevel.INFO,
    auditEmail: true,
    inApp: true,
    recipientRoles: [UserRole.ADMIN, UserRole.MANAGER, UserRole.AGENT, UserRole.ACCOUNT],
    notifyClient: true,
    notifyDeveloper: true,
  },
  [NotificationType.CONTRACT_RESENT]: {
    severity: SeverityLevel.WARN,
    auditEmail: true,
    inApp: true,
    recipientRoles: [UserRole.ADMIN, UserRole.MANAGER],
    notifyClient: true,
    notifyDeveloper: false,
  },
  [NotificationType.CONTRACT_APPROVED]: {
    severity: SeverityLevel.INFO,
    auditEmail: true,
    inApp: true,
    recipientRoles: [UserRole.ADMIN, UserRole.MANAGER],
    notifyClient: false,
    notifyDeveloper: false,
  },
  [NotificationType.CONTRACT_REJECTED]: {
    severity: SeverityLevel.WARN,
    auditEmail: true,
    inApp: true,
    recipientRoles: [UserRole.ADMIN, UserRole.MANAGER],
    notifyClient: true,
    notifyDeveloper: false,
  },
  [NotificationType.PAYMENT_RECORDED]: {
    severity: SeverityLevel.INFO,
    auditEmail: true,
    inApp: true,
    recipientRoles: [UserRole.ADMIN, UserRole.MANAGER, UserRole.ACCOUNT],
    notifyClient: true,
    notifyDeveloper: false,
  },
  [NotificationType.PAYMENT_VERIFIED]: {
    severity: SeverityLevel.INFO,
    auditEmail: true,
    inApp: true,
    recipientRoles: [UserRole.ADMIN, UserRole.MANAGER, UserRole.ACCOUNT],
    notifyClient: true,
    notifyDeveloper: false,
  },
  [NotificationType.PAYMENT_REJECTED]: {
    severity: SeverityLevel.WARN,
    auditEmail: true,
    inApp: true,
    recipientRoles: [UserRole.ADMIN, UserRole.MANAGER, UserRole.ACCOUNT],
    notifyClient: true,
    notifyDeveloper: false,
  },
  [NotificationType.RECEIPT_ISSUED]: {
    severity: SeverityLevel.INFO,
    auditEmail: true,
    inApp: true,
    recipientRoles: [UserRole.ADMIN, UserRole.MANAGER, UserRole.ACCOUNT],
    notifyClient: true,
    notifyDeveloper: false,
  },
  [NotificationType.RECEIPT_VOIDED]: {
    severity: SeverityLevel.CRITICAL,
    auditEmail: true,
    inApp: true,
    recipientRoles: [UserRole.ADMIN, UserRole.MANAGER, UserRole.ACCOUNT],
    notifyClient: true,
    notifyDeveloper: false,
  },
  [NotificationType.INSTALLMENT_PAID]: {
    severity: SeverityLevel.INFO,
    auditEmail: true,
    inApp: true,
    recipientRoles: [UserRole.ADMIN, UserRole.MANAGER, UserRole.ACCOUNT],
    notifyClient: true,
    notifyDeveloper: false,
  },
  [NotificationType.INSTALLMENT_OVERDUE]: {
    severity: SeverityLevel.WARN,
    auditEmail: false,
    inApp: true,
    recipientRoles: [UserRole.ADMIN, UserRole.MANAGER, UserRole.AGENT],
    notifyClient: true,
    notifyDeveloper: false,
  },
  [NotificationType.STAND_RESERVED]: {
    severity: SeverityLevel.INFO,
    auditEmail: true,
    inApp: true,
    recipientRoles: [UserRole.ADMIN, UserRole.MANAGER, UserRole.AGENT],
    notifyClient: true,
    notifyDeveloper: true,
  },
  [NotificationType.STAND_SOLD]: {
    severity: SeverityLevel.INFO,
    auditEmail: true,
    inApp: true,
    recipientRoles: [UserRole.ADMIN, UserRole.MANAGER, UserRole.AGENT, UserRole.ACCOUNT],
    notifyClient: true,
    notifyDeveloper: true,
  },
  [NotificationType.STAND_RELEASED]: {
    severity: SeverityLevel.WARN,
    auditEmail: true,
    inApp: true,
    recipientRoles: [UserRole.ADMIN, UserRole.MANAGER],
    notifyClient: false,
    notifyDeveloper: true,
  },
  [NotificationType.PAYOUT_INITIATED]: {
    severity: SeverityLevel.INFO,
    auditEmail: true,
    inApp: true,
    recipientRoles: [UserRole.ADMIN, UserRole.MANAGER, UserRole.ACCOUNT],
    notifyClient: false,
    notifyDeveloper: false,
  },
  [NotificationType.PAYOUT_APPROVED]: {
    severity: SeverityLevel.INFO,
    auditEmail: true,
    inApp: true,
    recipientRoles: [UserRole.ADMIN, UserRole.MANAGER, UserRole.ACCOUNT],
    notifyClient: false,
    notifyDeveloper: false,
  },
  [NotificationType.PAYOUT_COMPLETED]: {
    severity: SeverityLevel.INFO,
    auditEmail: true,
    inApp: true,
    recipientRoles: [UserRole.ADMIN, UserRole.MANAGER, UserRole.ACCOUNT],
    notifyClient: false,
    notifyDeveloper: false,
  },
  [NotificationType.USER_INVITED]: {
    severity: SeverityLevel.INFO,
    auditEmail: true,
    inApp: false,
    recipientRoles: [UserRole.ADMIN],
    notifyClient: false,
    notifyDeveloper: false,
  },
  [NotificationType.USER_ROLE_CHANGED]: {
    severity: SeverityLevel.WARN,
    auditEmail: true,
    inApp: false,
    recipientRoles: [UserRole.ADMIN],
    notifyClient: false,
    notifyDeveloper: false,
  },
  [NotificationType.ACCESS_DENIED]: {
    severity: SeverityLevel.CRITICAL,
    auditEmail: true,
    inApp: false,
    recipientRoles: [UserRole.ADMIN],
    notifyClient: false,
    notifyDeveloper: false,
  },
};

// ============================================================================
// Audit Email Configuration
// ============================================================================

/**
 * Audit email settings
 */
export const AUDIT_EMAIL_CONFIG = {
  /** Default recipient from env */
  get to(): string {
    return process.env.AUDIT_EMAIL_TO || 'developments.zw@fineandcountryerp.com';
  },
  /** Whether audit emails are enabled */
  get enabled(): boolean {
    return process.env.AUDIT_EMAIL_ENABLED !== 'false';
  },
  /** From address */
  get from(): string {
    return process.env.AUDIT_EMAIL_FROM || process.env.AUTH_EMAIL_FROM || 'noreply@fineandcountryerp.com';
  },
};

// ============================================================================
// Notification Cleanup Configuration
// ============================================================================

/**
 * Cleanup settings for old notifications
 */
export const NOTIFICATION_CLEANUP_CONFIG = {
  /** Auto-delete read notifications after 90 days */
  readRetentionDays: 90,
  /** Auto-delete all notifications after 1 year */
  maxRetentionDays: 365,
  /** Run cleanup daily at 3 AM */
  cleanupCron: '0 3 * * *',
};