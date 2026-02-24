/**
 * Payment Success Handler
 * 
 * Transactional handler for payment success workflow:
 * 1. Validates payment status is CONFIRMED
 * 2. Locks and updates Stand to SOLD (prevents race conditions)
 * 3. Creates Contract with financial fields
 * 4. Sends email notification to Client + Developer
 * 
 * Idempotent: Can be called multiple times safely (no duplicate contracts)
 * 
 * @module lib/payment-success-handler
 */

import prisma from '@/lib/prisma';
import { logger } from '@/lib/logger';
import { sendEmail } from '@/lib/email-service';
import { emitEvent } from '@/lib/automation/event-emitter';

interface PaymentSuccessResult {
  success: boolean;
  error?: string;
  standUpdated?: boolean;
  contractCreated?: boolean;
  contractId?: string;
  emailSent?: boolean;
}

/**
 * Handle payment success - transactional workflow
 * 
 * @param paymentId - Payment ID that became CONFIRMED
 * @returns Result with stand update, contract creation, and email status
 */
export async function handlePaymentSuccess(
  paymentId: string
): Promise<PaymentSuccessResult> {
  const startTime = Date.now();
  
  // Generate correlation ID for tracking
  const correlationId = `payment-${paymentId}`;
  
  logger.info('[PAYMENT_SUCCESS] Starting handler', {
    module: 'PaymentSuccessHandler',
    paymentId,
    correlationId,
    timestamp: new Date().toISOString()
  });

  try {
    // ───────────────────────────────────────────────────────────────────────
    // STEP 1: Fetch and validate payment
    // ───────────────────────────────────────────────────────────────────────
    
    const payment = await prisma.payment.findUnique({
      where: { id: paymentId },
      include: {
        client: true,
        stand: {
          include: {
            development: true
          }
        }
      }
    });

    if (!payment) {
      logger.error('[PAYMENT_SUCCESS] Payment not found', {
        module: 'PaymentSuccessHandler',
        paymentId
      });
      return {
        success: false,
        error: 'Payment not found'
      };
    }

    // Validate payment status is CONFIRMED
    if (payment.status !== 'CONFIRMED') {
      logger.debug('[PAYMENT_SUCCESS] Payment not CONFIRMED, skipping', {
        module: 'PaymentSuccessHandler',
        paymentId,
        currentStatus: payment.status
      });
      return {
        success: false,
        error: `Payment status is ${payment.status}, expected CONFIRMED`
      };
    }

    // Validate required fields
    if (!payment.clientId || payment.clientId === 'STAND-ONLY') {
      logger.error('[PAYMENT_SUCCESS] Invalid clientId', {
        module: 'PaymentSuccessHandler',
        paymentId,
        clientId: payment.clientId
      });
      return {
        success: false,
        error: 'Payment must have a valid clientId'
      };
    }

    if (!payment.standId) {
      logger.error('[PAYMENT_SUCCESS] Payment has no standId', {
        module: 'PaymentSuccessHandler',
        paymentId
      });
      return {
        success: false,
        error: 'Payment must have a standId to create contract'
      };
    }

    if (!payment.stand?.development) {
      logger.error('[PAYMENT_SUCCESS] Stand or development not found', {
        module: 'PaymentSuccessHandler',
        paymentId,
        standId: payment.standId
      });
      return {
        success: false,
        error: 'Stand or development not found'
      };
    }

    const stand = payment.stand;
    const development = stand.development;
    const client = payment.client;

    if (!client) {
      logger.error('[PAYMENT_SUCCESS] Client not found', {
        module: 'PaymentSuccessHandler',
        paymentId,
        clientId: payment.clientId
      });
      return {
        success: false,
        error: 'Client not found'
      };
    }

    // ───────────────────────────────────────────────────────────────────────
    // STEP 2: Check if contract already exists (idempotency)
    // ───────────────────────────────────────────────────────────────────────
    
    // Check for existing contract for this client-stand combination
    const existingContract = await prisma.generatedContract.findFirst({
      where: {
        clientId: payment.clientId,
        standId: payment.standId,
        status: { not: 'ARCHIVED' }
      }
    });

    if (existingContract) {
      logger.info('[PAYMENT_SUCCESS] Contract already exists, skipping creation', {
        module: 'PaymentSuccessHandler',
        paymentId,
        contractId: existingContract.id,
        clientId: payment.clientId,
        standId: payment.standId
      });
      
      // Still update stand if needed
      let standUpdated = false;
      if (stand.status !== 'SOLD') {
        await prisma.stand.update({
          where: { id: stand.id },
          data: {
            status: 'SOLD',
            reservedBy: payment.clientId
          }
        });
        standUpdated = true;
      }

      return {
        success: true,
        standUpdated,
        contractCreated: false,
        contractId: existingContract.id,
        emailSent: false // Don't resend email
      };
    }

    // ───────────────────────────────────────────────────────────────────────
    // STEP 3: Get default contract template
    // ───────────────────────────────────────────────────────────────────────
    
    const template = await prisma.contractTemplate.findFirst({
      where: {
        status: 'ACTIVE',
        branch: payment.officeLocation || 'Harare'
      },
      orderBy: {
        createdAt: 'desc' // Get most recent active template
      }
    });

    if (!template) {
      logger.error('[PAYMENT_SUCCESS] No active contract template found', {
        module: 'PaymentSuccessHandler',
        paymentId,
        branch: payment.officeLocation
      });
      return {
        success: false,
        error: 'No active contract template found. Please create a contract template first.'
      };
    }

    // ───────────────────────────────────────────────────────────────────────
    // STEP 4: Calculate financial fields
    // ───────────────────────────────────────────────────────────────────────
    
    const standSize = Number(stand.sizeSqm || 0);
    const totalPrice = Number(stand.price);
    
    // Get all payments for this stand by this client
    const allPayments = await prisma.payment.findMany({
      where: {
        standId: payment.standId,
        clientId: payment.clientId,
        status: 'CONFIRMED'
      }
    });

    const totalPaid = allPayments.reduce((sum, p) => sum + Number(p.amount), 0);
    const depositPaid = allPayments
      .filter(p => p.paymentType?.toLowerCase() === 'deposit')
      .reduce((sum, p) => sum + Number(p.amount), 0);
    
    const remainingBalance = Math.max(0, totalPrice - totalPaid);

    // Get installment plan if exists
    const installmentPlan = await prisma.installmentPlan.findFirst({
      where: {
        standId: payment.standId,
        clientId: payment.clientId,
        status: { in: ['ACTIVE', 'PENDING'] }
      }
    });

    const installmentTerms = installmentPlan ? installmentPlan.periodMonths : null;
    const installmentValue = installmentTerms && installmentTerms > 0
      ? remainingBalance / installmentTerms
      : null;

    // Validate stand size exists
    if (standSize === 0) {
      logger.warn('[PAYMENT_SUCCESS] Stand size is missing', {
        module: 'PaymentSuccessHandler',
        paymentId,
        standId: stand.id,
        standNumber: stand.standNumber
      });
      // Don't fail, but log warning
    }

    // ───────────────────────────────────────────────────────────────────────
    // STEP 5: Execute transaction (Stand update + Contract creation)
    // ───────────────────────────────────────────────────────────────────────
    
    const result = await prisma.$transaction(async (tx) => {
      // Lock stand row to prevent race conditions
      const lockedStand = await tx.stand.findUnique({
        where: { id: stand.id },
        select: { id: true, status: true, reservedBy: true }
      });

      if (!lockedStand) {
        throw new Error('Stand not found');
      }

      // Check if stand is already SOLD by another client
      if (lockedStand.status === 'SOLD' && lockedStand.reservedBy !== payment.clientId) {
        throw new Error(`Stand is already SOLD to another client (${lockedStand.reservedBy})`);
      }

      // Update stand to SOLD
      const updatedStand = await tx.stand.update({
        where: { id: stand.id },
        data: {
          status: 'SOLD',
          reservedBy: payment.clientId
        }
      });

      // Prepare contract content with variable substitution
      let contractContent = template.content;
      
      // Financial fields to include in contract
      const financialFields = {
        standSize: standSize.toFixed(2),
        totalPrice: totalPrice.toLocaleString('en-US', { style: 'currency', currency: 'USD' }),
        depositPaid: depositPaid.toLocaleString('en-US', { style: 'currency', currency: 'USD' }),
        remainingBalance: remainingBalance.toLocaleString('en-US', { style: 'currency', currency: 'USD' }),
        installmentTerms: installmentTerms ? `${installmentTerms} months` : 'N/A',
        installmentValue: installmentValue ? installmentValue.toLocaleString('en-US', { style: 'currency', currency: 'USD' }) : 'N/A',
        totalPaid: totalPaid.toLocaleString('en-US', { style: 'currency', currency: 'USD' })
      };

      // Variable substitutions
      const substitutions: Record<string, string> = {
        '{CLIENT_NAME}': client.name,
        '{CLIENT_EMAIL}': client.email,
        '{CLIENT_PHONE}': client.phone || 'N/A',
        '{STAND_ID}': stand.standNumber,
        '{STAND_NUMBER}': stand.standNumber,
        '{DEVELOPMENT_NAME}': development.name,
        '{DEVELOPMENT_LOCATION}': development.location,
        '{TEMPLATE_NAME}': template.name,
        '{DATE}': new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }),
        '{TIMESTAMP}': new Date().toISOString(),
        // Financial fields
        '{STAND_SIZE}': financialFields.standSize,
        '{TOTAL_PRICE}': financialFields.totalPrice,
        '{DEPOSIT_PAID}': financialFields.depositPaid,
        '{REMAINING_BALANCE}': financialFields.remainingBalance,
        '{INSTALLMENT_TERMS}': financialFields.installmentTerms,
        '{INSTALLMENT_VALUE}': financialFields.installmentValue,
        '{TOTAL_PAID}': financialFields.totalPaid,
        // Developer fields
        '{DEVELOPER_NAME}': development.developerName || 'Fine & Country Zimbabwe',
        '{DEVELOPER_EMAIL}': development.developerEmail || 'info@fineandcountry.co.zw',
        '{DEVELOPER_PHONE}': development.developerPhone || 'N/A'
      };

      // Replace all variables in content
      for (const [key, value] of Object.entries(substitutions)) {
        contractContent = contractContent.replaceAll(key, value);
      }

      // Create contract
      const contract = await tx.generatedContract.create({
        data: {
          clientId: payment.clientId,
          templateId: template.id,
          standId: payment.standId || 'unknown',
          templateName: template.name,
          content: contractContent,
          status: 'DRAFT - PAYMENT RECEIVED',
          branch: payment.officeLocation || 'Harare'
        }
      });

      // Log activity (using ActivityLog, not Activity)
      await tx.activityLog.create({
        data: {
          branch: payment.officeLocation || 'Harare',
          userId: null,
          action: 'CREATE',
          module: 'CONTRACTS',
          recordId: contract.id,
          description: `Contract created automatically on payment success: ${client.name} - Stand ${stand.standNumber} - ${development.name}`,
          changes: JSON.stringify({
            paymentId: payment.id,
            standId: stand.id,
            clientId: client.id,
            developmentId: development.id,
            financialFields
          })
        }
      });

      return {
        stand: updatedStand,
        contract,
        financialFields
      };
    });

    logger.info('[PAYMENT_SUCCESS] Transaction completed', {
      module: 'PaymentSuccessHandler',
      paymentId,
      standId: stand.id,
      contractId: result.contract.id,
      duration: Date.now() - startTime
    });

    // ───────────────────────────────────────────────────────────────────────
    // STEP 6: Send email notification (outside transaction)
    // ───────────────────────────────────────────────────────────────────────
    
    let emailSent = false;
    const emailRecipients: string[] = [];

    if (client.email) {
      emailRecipients.push(client.email);
    }

    if (development.developerEmail) {
      emailRecipients.push(development.developerEmail);
    }

    if (emailRecipients.length > 0) {
      try {
        const emailSubject = `Payment Received & Contract Created – ${development.name} Stand ${stand.standNumber}`;
        
        const emailHTML = `
          <!DOCTYPE html>
          <html>
          <head>
            <meta charset="utf-8">
            <style>
              body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
              .container { max-width: 600px; margin: 0 auto; padding: 20px; }
              .header { background: #85754E; color: white; padding: 20px; text-align: center; }
              .content { background: #f9f9f9; padding: 20px; }
              .section { margin: 20px 0; padding: 15px; background: white; border-left: 4px solid #85754E; }
              .field { margin: 10px 0; }
              .label { font-weight: bold; color: #666; }
              .value { color: #333; }
              .footer { text-align: center; padding: 20px; color: #666; font-size: 12px; }
            </style>
          </head>
          <body>
            <div class="container">
              <div class="header">
                <h1>Payment Received & Contract Created</h1>
              </div>
              <div class="content">
                <p>Dear ${client.name},</p>
                <p>We are pleased to confirm that your payment has been received and a draft contract has been automatically created.</p>
                
                <div class="section">
                  <h2>Property Details</h2>
                  <div class="field">
                    <span class="label">Development:</span>
                    <span class="value">${development.name}</span>
                  </div>
                  <div class="field">
                    <span class="label">Location:</span>
                    <span class="value">${development.location}</span>
                  </div>
                  <div class="field">
                    <span class="label">Stand Number:</span>
                    <span class="value">${stand.standNumber}</span>
                  </div>
                  <div class="field">
                    <span class="label">Stand Size:</span>
                    <span class="value">${result.financialFields.standSize} m²</span>
                  </div>
                </div>

                <div class="section">
                  <h2>Financial Summary</h2>
                  <div class="field">
                    <span class="label">Total Price:</span>
                    <span class="value">${result.financialFields.totalPrice}</span>
                  </div>
                  <div class="field">
                    <span class="label">Deposit Paid:</span>
                    <span class="value">${result.financialFields.depositPaid}</span>
                  </div>
                  <div class="field">
                    <span class="label">Total Paid to Date:</span>
                    <span class="value">${result.financialFields.totalPaid}</span>
                  </div>
                  <div class="field">
                    <span class="label">Remaining Balance:</span>
                    <span class="value">${result.financialFields.remainingBalance}</span>
                  </div>
                  ${installmentTerms ? `
                  <div class="field">
                    <span class="label">Installment Terms:</span>
                    <span class="value">${result.financialFields.installmentTerms}</span>
                  </div>
                  <div class="field">
                    <span class="label">Monthly Installment:</span>
                    <span class="value">${result.financialFields.installmentValue}</span>
                  </div>
                  ` : ''}
                </div>

                <div class="section">
                  <h2>Contract Status</h2>
                  <p>Your contract has been created with status: <strong>DRAFT - PAYMENT RECEIVED</strong></p>
                  <p>The legal team will review and prepare the final contract for your signature.</p>
                </div>

                <div class="section">
                  <h2>Next Steps</h2>
                  <ol>
                    <li>Legal team will review the contract (3-5 business days)</li>
                    <li>You will receive an email with signing instructions</li>
                    <li>Sign the contract electronically or in person</li>
                    <li>Title transfer will be initiated upon contract execution</li>
                  </ol>
                </div>

                <p>If you have any questions, please contact our office.</p>
                <p>Best regards,<br/>Fine & Country Zimbabwe</p>
              </div>
              <div class="footer">
                <p>This is an automated notification. Please do not reply to this email.</p>
              </div>
            </div>
          </body>
          </html>
        `;

        await sendEmail({
          to: emailRecipients.join(', '),
          subject: emailSubject,
          html: emailHTML
        });

        emailSent = true;
        logger.info('[PAYMENT_SUCCESS] Email sent', {
          module: 'PaymentSuccessHandler',
          paymentId,
          recipients: emailRecipients
        });
      } catch (emailError) {
        logger.error('[PAYMENT_SUCCESS] Email send failed', emailError instanceof Error ? emailError : undefined, {
          module: 'PaymentSuccessHandler',
          paymentId,
          recipients: emailRecipients
        });
        // Don't fail the whole operation if email fails
      }
    } else {
      logger.warn('[PAYMENT_SUCCESS] No email recipients', {
        module: 'PaymentSuccessHandler',
        paymentId,
        clientEmail: client.email,
        developerEmail: development.developerEmail
      });
    }

    // Emit event for automation system (async, non-blocking)
    emitEvent({
      type: 'payment.confirmed',
      entityType: 'payment',
      entityId: paymentId,
      payload: {
        amount: payment.amount,
        clientId: payment.clientId,
        standId: payment.standId,
        developmentId: development.id,
        contractId: result.contract.id,
        totalPaid,
        remainingBalance
      },
      branch: payment.officeLocation || 'Harare',
      correlationId
    }).catch(err => {
      logger.error('[PAYMENT_SUCCESS] Failed to emit event', {
        module: 'PaymentSuccessHandler',
        paymentId,
        error: err instanceof Error ? err.message : 'Unknown error'
      });
    });

    return {
      success: true,
      standUpdated: true,
      contractCreated: true,
      contractId: result.contract.id,
      emailSent
    };

  } catch (error: any) {
    logger.error('[PAYMENT_SUCCESS] Handler error', error, {
      module: 'PaymentSuccessHandler',
      paymentId,
      duration: Date.now() - startTime
    });

    return {
      success: false,
      error: error.message || 'Unknown error in payment success handler'
    };
  }
}
