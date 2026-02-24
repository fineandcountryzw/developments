/**
 * Notification Service
 * 
 * Provides utilities for creating notifications at mutation points
 * throughout the application. This is the integration layer between
 * business logic and the notification system.
 */

import { prisma } from "@/lib/prisma";

// Notification types from Prisma schema
export type NotificationType =
  | "CONTRACT_CREATED"
  | "CONTRACT_SENT"
  | "CONTRACT_SIGNED"
  | "CONTRACT_RESENT"
  | "CONTRACT_APPROVED"
  | "CONTRACT_REJECTED"
  | "PAYMENT_RECORDED"
  | "PAYMENT_VERIFIED"
  | "PAYMENT_REJECTED"
  | "RECEIPT_ISSUED"
  | "RECEIPT_VOIDED"
  | "INSTALLMENT_PAID"
  | "INSTALLMENT_OVERDUE"
  | "STAND_RESERVED"
  | "STAND_SOLD"
  | "STAND_RELEASED"
  | "PAYOUT_INITIATED"
  | "PAYOUT_APPROVED"
  | "PAYOUT_COMPLETED"
  | "USER_INVITED"
  | "USER_ROLE_CHANGED"
  | "ACCESS_DENIED";

export type SeverityLevel = "INFO" | "WARN" | "CRITICAL";
export type EntityType = "CONTRACT" | "STAND" | "PAYMENT" | "RECEIPT" | "INSTALLMENT" | "PAYOUT" | "DEVELOPMENT" | "USER";

interface CreateNotificationInput {
  type: NotificationType;
  severity?: SeverityLevel;
  title: string;
  message: string;
  actorUserId?: string;
  actorRole?: string;
  recipientUserId: string;
  recipientRole?: string;
  entityType: EntityType;
  entityId: string;
  developmentId?: string;
  metadata?: Record<string, any>;
}

/**
 * Create a notification
 * This is the core function used at mutation points
 */
export async function createNotification(
  input: CreateNotificationInput
): Promise<{ success: boolean; error?: string }> {
  try {
    // Check if notifications table exists by attempting to query it
    try {
      await prisma.$queryRaw`SELECT 1 FROM notifications LIMIT 1`;
    } catch (tableError: any) {
      // If table doesn't exist, log and return success (graceful degradation)
      if (tableError.code === "P2021" || tableError.message?.includes("does not exist")) {
        console.log("[Notifications] Table does not exist, skipping notification creation");
        return { success: true };
      }
      throw tableError;
    }

    // Create the notification
    await (prisma as any).notification.create({
      data: {
        type: input.type,
        severity: input.severity || "INFO",
        title: input.title,
        message: input.message,
        actorUserId: input.actorUserId,
        actorRole: input.actorRole,
        recipientUserId: input.recipientUserId,
        recipientRole: input.recipientRole,
        entityType: input.entityType,
        entityId: input.entityId,
        developmentId: input.developmentId,
        metadata: input.metadata || {},
        isRead: false,
      },
    });

    return { success: true };
  } catch (error) {
    console.error("[Notifications] Failed to create notification:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * Create multiple notifications for multiple recipients
 */
export async function createBulkNotifications(
  inputs: CreateNotificationInput[]
): Promise<{ success: boolean; created: number; error?: string }> {
  try {
    let created = 0;
    
    for (const input of inputs) {
      const result = await createNotification(input);
      if (result.success) {
        created++;
      }
    }

    return { success: true, created };
  } catch (error) {
    console.error("[Notifications] Failed to create bulk notifications:", error);
    return {
      success: false,
      created: 0,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * Notify admin users about an event
 */
export async function notifyAdmins(
  type: NotificationType,
  title: string,
  message: string,
  entityType: EntityType,
  entityId: string,
  options: {
    severity?: SeverityLevel;
    actorUserId?: string;
    developmentId?: string;
    metadata?: Record<string, any>;
    branch?: string;
  } = {}
): Promise<{ success: boolean; notified: number; error?: string }> {
  try {
    // Find all admin users
    const admins = await prisma.user.findMany({
      where: {
        role: { in: ["ADMIN", "MANAGER"] },
        isActive: true,
        ...(options.branch && { branch: options.branch }),
      },
      select: { id: true },
    });

    // Create notifications for each admin
    const notifications = admins.map((admin) => ({
      type,
      severity: options.severity || "INFO",
      title,
      message,
      actorUserId: options.actorUserId,
      recipientUserId: admin.id,
      entityType,
      entityId,
      developmentId: options.developmentId,
      metadata: options.metadata,
    }));

    const result = await createBulkNotifications(notifications);
    return { success: result.success, notified: result.created, error: result.error };
  } catch (error) {
    console.error("[Notifications] Failed to notify admins:", error);
    return {
      success: false,
      notified: 0,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * Notify users with a specific role
 */
export async function notifyByRole(
  role: string,
  type: NotificationType,
  title: string,
  message: string,
  entityType: EntityType,
  entityId: string,
  options: {
    severity?: SeverityLevel;
    actorUserId?: string;
    developmentId?: string;
    metadata?: Record<string, any>;
    branch?: string;
  } = {}
): Promise<{ success: boolean; notified: number; error?: string }> {
  try {
    const users = await prisma.user.findMany({
      where: {
        role: role as any,
        isActive: true,
        ...(options.branch && { branch: options.branch }),
      },
      select: { id: true },
    });

    const notifications = users.map((user) => ({
      type,
      severity: options.severity || "INFO",
      title,
      message,
      actorUserId: options.actorUserId,
      recipientUserId: user.id,
      entityType,
      entityId,
      developmentId: options.developmentId,
      metadata: options.metadata,
    }));

    const result = await createBulkNotifications(notifications);
    return { success: result.success, notified: result.created, error: result.error };
  } catch (error) {
    console.error("[Notifications] Failed to notify by role:", error);
    return {
      success: false,
      notified: 0,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

// ============================================================================
// PRE-DEFINED NOTIFICATION HELPERS
// ============================================================================

/**
 * Notify when a contract is created
 */
export async function notifyContractCreated(
  contractId: string,
  contractTitle: string,
  recipientUserId: string,
  actorUserId?: string,
  developmentId?: string
): Promise<{ success: boolean; error?: string }> {
  return createNotification({
    type: "CONTRACT_CREATED",
    title: "New Contract Created",
    message: `A new contract "${contractTitle}" has been created and is ready for review.`,
    actorUserId,
    recipientUserId,
    entityType: "CONTRACT",
    entityId: contractId,
    developmentId,
  });
}

/**
 * Notify when a contract is signed
 */
export async function notifyContractSigned(
  contractId: string,
  contractTitle: string,
  signerName: string,
  recipientUserId: string,
  actorUserId?: string
): Promise<{ success: boolean; error?: string }> {
  return createNotification({
    type: "CONTRACT_SIGNED",
    title: "Contract Signed",
    message: `"${contractTitle}" has been signed by ${signerName}.`,
    actorUserId,
    recipientUserId,
    entityType: "CONTRACT",
    entityId: contractId,
  });
}

/**
 * Notify when a payment is recorded
 */
export async function notifyPaymentRecorded(
  paymentId: string,
  amount: number,
  clientName: string,
  recipientUserId: string,
  actorUserId?: string
): Promise<{ success: boolean; error?: string }> {
  return createNotification({
    type: "PAYMENT_RECORDED",
    title: "Payment Recorded",
    message: `A payment of $${amount.toFixed(2)} has been recorded for ${clientName}.`,
    actorUserId,
    recipientUserId,
    entityType: "PAYMENT",
    entityId: paymentId,
    metadata: { amount, clientName },
  });
}

/**
 * Notify when a payment is verified
 */
export async function notifyPaymentVerified(
  paymentId: string,
  amount: number,
  recipientUserId: string,
  actorUserId?: string
): Promise<{ success: boolean; error?: string }> {
  return createNotification({
    type: "PAYMENT_VERIFIED",
    severity: "INFO",
    title: "Payment Verified",
    message: `Your payment of $${amount.toFixed(2)} has been verified and confirmed.`,
    actorUserId,
    recipientUserId,
    entityType: "PAYMENT",
    entityId: paymentId,
    metadata: { amount },
  });
}

/**
 * Notify when a stand is reserved
 */
export async function notifyStandReserved(
  standId: string,
  standNumber: string,
  developmentName: string,
  recipientUserId: string,
  actorUserId?: string,
  developmentId?: string
): Promise<{ success: boolean; error?: string }> {
  return createNotification({
    type: "STAND_RESERVED",
    title: "Stand Reserved",
    message: `Stand ${standNumber} at ${developmentName} has been reserved.`,
    actorUserId,
    recipientUserId,
    entityType: "STAND",
    entityId: standId,
    developmentId,
    metadata: { standNumber, developmentName },
  });
}

/**
 * Notify when a stand is sold
 */
export async function notifyStandSold(
  standId: string,
  standNumber: string,
  developmentName: string,
  recipientUserId: string,
  actorUserId?: string,
  developmentId?: string
): Promise<{ success: boolean; error?: string }> {
  return createNotification({
    type: "STAND_SOLD",
    severity: "INFO",
    title: "Stand Sold",
    message: `Stand ${standNumber} at ${developmentName} has been sold.`,
    actorUserId,
    recipientUserId,
    entityType: "STAND",
    entityId: standId,
    developmentId,
    metadata: { standNumber, developmentName },
  });
}

/**
 * Notify when a user is invited
 */
export async function notifyUserInvited(
  invitationId: string,
  invitedEmail: string,
  recipientUserId: string,
  actorUserId?: string
): Promise<{ success: boolean; error?: string }> {
  return createNotification({
    type: "USER_INVITED",
    title: "User Invited",
    message: `An invitation has been sent to ${invitedEmail}.`,
    actorUserId,
    recipientUserId,
    entityType: "USER",
    entityId: invitationId,
    metadata: { invitedEmail },
  });
}

/**
 * Notify when a user's role is changed
 */
export async function notifyUserRoleChanged(
  userId: string,
  userName: string,
  oldRole: string,
  newRole: string,
  recipientUserId: string,
  actorUserId?: string
): Promise<{ success: boolean; error?: string }> {
  return createNotification({
    type: "USER_ROLE_CHANGED",
    severity: "WARN",
    title: "User Role Changed",
    message: `${userName}'s role has been changed from ${oldRole} to ${newRole}.`,
    actorUserId,
    recipientUserId,
    entityType: "USER",
    entityId: userId,
    metadata: { userName, oldRole, newRole },
  });
}

/**
 * Notify about access denial (security alert)
 */
export async function notifyAccessDenied(
  resource: string,
  action: string,
  recipientUserId: string,
  actorUserId?: string,
  metadata?: Record<string, any>
): Promise<{ success: boolean; error?: string }> {
  return createNotification({
    type: "ACCESS_DENIED",
    severity: "CRITICAL",
    title: "Access Denied",
    message: `Access was denied when attempting to ${action} ${resource}.`,
    actorUserId,
    recipientUserId,
    entityType: "USER",
    entityId: actorUserId || "unknown",
    metadata,
  });
}

/**
 * Notify about an installment becoming overdue
 */
export async function notifyInstallmentOverdue(
  installmentId: string,
  amount: number,
  dueDate: Date,
  recipientUserId: string
): Promise<{ success: boolean; error?: string }> {
  return createNotification({
    type: "INSTALLMENT_OVERDUE",
    severity: "WARN",
    title: "Installment Overdue",
    message: `An installment of $${amount.toFixed(2)} was due on ${dueDate.toLocaleDateString()}.`,
    recipientUserId,
    entityType: "INSTALLMENT",
    entityId: installmentId,
    metadata: { amount, dueDate: dueDate.toISOString() },
  });
}

/**
 * Notify when a receipt is issued
 */
export async function notifyReceiptIssued(
  receiptId: string,
  receiptNumber: string,
  amount: number,
  recipientUserId: string,
  actorUserId?: string
): Promise<{ success: boolean; error?: string }> {
  return createNotification({
    type: "RECEIPT_ISSUED",
    title: "Receipt Issued",
    message: `Receipt #${receiptNumber} for $${amount.toFixed(2)} has been issued.`,
    actorUserId,
    recipientUserId,
    entityType: "RECEIPT",
    entityId: receiptId,
    metadata: { receiptNumber, amount },
  });
}

/**
 * Notify when a reservation is created
 */
export async function notifyReservationCreated(params: {
  clientId: string;
  reservationId: string;
  standNumber: string;
  developmentName: string;
  agentId?: string;
}): Promise<{ success: boolean; error?: string }> {
  const { clientId, reservationId, standNumber, developmentName, agentId } = params;
  
  // Notify client
  await createNotification({
    type: "STAND_RESERVED",
    title: "Reservation Confirmed",
    message: `Your reservation for Stand ${standNumber} in ${developmentName} has been confirmed.`,
    recipientUserId: clientId,
    entityType: "STAND",
    entityId: reservationId,
    metadata: { standNumber, developmentName, agentId },
  });

  // Notify agent if present
  if (agentId) {
    await createNotification({
      type: "STAND_RESERVED",
      title: "New Reservation",
      message: `Stand ${standNumber} in ${developmentName} has been reserved.`,
      recipientUserId: agentId,
      entityType: "STAND",
      entityId: reservationId,
      metadata: { standNumber, developmentName, clientId },
    });
  }

  return { success: true };
}

/**
 * Notify agent about insurance enquiry from client
 */
export async function notifyInsuranceEnquiry(params: {
  agentId: string;
  clientId: string;
  clientName: string;
  developmentName: string;
  standNumber: string;
}): Promise<{ success: boolean; error?: string }> {
  const { agentId, clientId, clientName, developmentName, standNumber } = params;
  
  return createNotification({
    type: "STAND_RESERVED",
    severity: "INFO",
    title: "Insurance Interest",
    message: `${clientName} has expressed interest in insurance for Stand ${standNumber} in ${developmentName}.`,
    recipientUserId: agentId,
    entityType: "STAND",
    entityId: clientId,
    metadata: { clientName, developmentName, standNumber, insuranceInterest: true },
  });
}
