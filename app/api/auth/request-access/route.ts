import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { logger } from '@/lib/logger';
import { apiError, apiSuccess } from '@/lib/api-response';
import { ErrorCodes } from '@/lib/error-codes';
import { sendEmail } from '@/lib/email-service';
import { validateRequest } from '@/lib/validation/middleware';
import { requestAccessSchema } from '@/lib/validation/schemas';

export async function POST(request: NextRequest) {
  try {
    // Validate request body
    const validation = await validateRequest(request, requestAccessSchema, {
      module: 'API',
      action: 'POST_REQUEST_ACCESS'
    });
    
    if (!validation.success) {
      return validation.error;
    }

    const { name, email, phone, accountType, company, message } = validation.data;

    // Check if user already exists
    const existingUser = await prisma.user.findUnique({
      where: { email },
    });

    if (existingUser) {
      return apiError("An account with this email already exists. Please try logging in.", 409, ErrorCodes.CONFLICT);
    }

    // Create user with pending status (inactive until approved)
    const newUser = await prisma.user.create({
      data: {
        email,
        name,
        role: accountType,
        branch: company || null,
        // User is inactive until admin approves
        // Note: We'll need to track pending requests
      },
    });

    // Log the access request for admin review
    logger.info("New access request", {
      module: 'API',
      action: 'POST_REQUEST_ACCESS',
      id: newUser.id,
      name,
      email: email?.substring(0, 3) + '***',
      phone,
      accountType,
      company,
      timestamp: new Date().toISOString(),
    });

    // Send email notification to admins about new access request
    try {
      // Get admin emails to notify
      const adminUsers = await prisma.user.findMany({
        where: {
          role: 'ADMIN',
          isActive: true,
        },
        select: { email: true, name: true }
      });

      const adminEmails = adminUsers.map(u => u.email);
      
      if (adminEmails.length > 0) {
        const baseUrl = process.env.NEXTAUTH_URL || 'https://www.fineandcountryerp.com';
        
        await sendEmail({
          to: adminEmails,
          subject: `New Access Request: ${name} (${accountType})`,
          html: generateAdminNotificationHTML({
            requesterName: name,
            requesterEmail: email,
            requesterPhone: phone || '',
            accountType,
            company: company || 'Not specified',
            message: message || 'No message provided',
            dashboardUrl: `${baseUrl}/dashboards/admin`,
            requestId: newUser.id,
          }),
        });

        logger.info('Admin notification sent for access request', {
          module: 'API',
          action: 'SEND_ADMIN_NOTIFICATION',
          adminCount: adminEmails.length,
          requesterId: newUser.id
        });
      }
    } catch (emailError: any) {
      // Log but don't fail request submission if email fails
      logger.error('Failed to send admin notification email', emailError, {
        module: 'API',
        action: 'SEND_ADMIN_NOTIFICATION'
      });
    }

    return apiSuccess({
      message: "Access request submitted successfully. You will be notified once approved.",
      userId: newUser.id,
    });
  } catch (error: any) {
    logger.error("ACCESS_REQUEST Error", error, { module: 'API', action: 'POST_REQUEST_ACCESS' });
    return apiError(error.message || "Failed to process request", 500, ErrorCodes.INTERNAL_ERROR);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Email HTML Generator
// ─────────────────────────────────────────────────────────────────────────────

function generateAdminNotificationHTML(params: {
  requesterName: string;
  requesterEmail: string;
  requesterPhone: string;
  accountType: string;
  company: string;
  message: string;
  dashboardUrl: string;
  requestId: string;
}): string {
  const { requesterName, requesterEmail, requesterPhone, accountType, company, message, dashboardUrl, requestId } = params;
  
  const roleColors: Record<string, string> = {
    'AGENT': '#059669',
    'CLIENT': '#0891B2',
  };
  const roleColor = roleColors[accountType] || '#85754E';
  
  return `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; background-color: #f9f8f6; margin: 0; padding: 0; }
          .container { max-width: 600px; margin: 40px auto; background: white; border-radius: 12px; box-shadow: 0 10px 40px rgba(0,0,0,0.1); overflow: hidden; }
          .header { background: linear-gradient(135deg, #dc2626 0%, #b91c1c 100%); color: white; padding: 30px; text-align: center; }
          .header h1 { margin: 0; font-size: 24px; font-weight: 700; }
          .content { padding: 30px; }
          .info-grid { display: grid; gap: 15px; margin: 20px 0; }
          .info-item { background: #f5f5f5; padding: 15px; border-radius: 6px; }
          .info-label { font-size: 12px; color: #666; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 5px; }
          .info-value { font-size: 16px; font-weight: 600; color: #1a1a1a; }
          .role-badge { display: inline-block; background: ${roleColor}; color: white; padding: 4px 12px; border-radius: 20px; font-size: 12px; font-weight: 600; }
          .message-box { background: #fef3c7; border-left: 4px solid #f59e0b; padding: 15px; margin: 20px 0; border-radius: 4px; }
          .cta-button { display: inline-block; background: #85754E; color: white; padding: 14px 30px; border-radius: 8px; text-decoration: none; font-weight: 600; }
          .footer { background: #f9f8f6; padding: 20px 30px; text-align: center; font-size: 12px; color: #666; border-top: 1px solid #eee; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>🔔 New Access Request</h1>
            <p style="margin: 10px 0 0 0; opacity: 0.9;">A user has requested access to the platform</p>
          </div>
          <div class="content">
            <p>A new access request has been submitted and requires your review:</p>
            
            <div class="info-grid">
              <div class="info-item">
                <div class="info-label">Requester Name</div>
                <div class="info-value">${requesterName}</div>
              </div>
              <div class="info-item">
                <div class="info-label">Email Address</div>
                <div class="info-value">${requesterEmail}</div>
              </div>
              <div class="info-item">
                <div class="info-label">Phone Number</div>
                <div class="info-value">${requesterPhone}</div>
              </div>
              <div class="info-item">
                <div class="info-label">Requested Account Type</div>
                <div class="info-value"><span class="role-badge">${accountType}</span></div>
              </div>
              <div class="info-item">
                <div class="info-label">Company/Organization</div>
                <div class="info-value">${company}</div>
              </div>
            </div>
            
            ${message !== 'No message provided' ? `
            <div class="message-box">
              <div class="info-label" style="margin-bottom: 8px;">Message from Requester</div>
              <p style="margin: 0;">${message}</p>
            </div>
            ` : ''}
            
            <p style="margin-top: 25px;">Please review this request and approve or reject it from the admin dashboard.</p>
            
            <div style="text-align: center; margin: 30px 0;">
              <a href="${dashboardUrl}" class="cta-button">Review in Dashboard</a>
            </div>
            
            <p style="font-size: 13px; color: #666;">
              Request ID: ${requestId.substring(0, 8).toUpperCase()}<br>
              Submitted: ${new Date().toLocaleString('en-ZW')}
            </p>
          </div>
          <div class="footer">
            <p>Fine & Country Zimbabwe - Admin Notification</p>
            <p>This is an automated notification. Do not reply to this email.</p>
          </div>
        </div>
      </body>
    </html>
  `;
}
