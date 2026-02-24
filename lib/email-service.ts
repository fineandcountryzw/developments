/**
 * Email Service for User Invitations
 * Sends invitation emails with secure links
 */

// Standardized email configuration
const DEFAULT_FROM_EMAIL = 'noreply@fineandcountryerp.com';

/**
 * Validate Resend API configuration
 */
function validateResendConfig(): string {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey || apiKey.trim() === '') {
    throw new Error('RESEND_API_KEY environment variable is required');
  }
  
  // Validate API key format
  if (!apiKey.startsWith('re_') || apiKey.length < 20) {
    console.warn('[EMAIL] API key format appears invalid:', {
      prefix: apiKey.substring(0, 8),
      length: apiKey.length,
      expectedFormat: 're_... (at least 20 characters)'
    });
  }
  
  return apiKey;
}

/**
 * Parse Resend API error response
 */
interface ResendError {
  statusCode?: number;
  message?: string;
  name?: string;
}

function parseResendError(error: any): ResendError {
  // Handle fetch API errors
  if (error instanceof Error) {
    return { message: error.message };
  }
  
  // Handle Resend API JSON errors
  if (typeof error === 'object' && error !== null) {
    return error as ResendError;
  }
  
  return { message: 'Unknown error' };
}

/**
 * Check if error is due to invalid API key
 */
function isInvalidApiKeyError(error: ResendError): boolean {
  const message = error.message?.toLowerCase() || '';
  return (
    error.statusCode === 401 ||
    message.includes('invalid api key') ||
    message.includes('unauthorized') ||
    message.includes('api key') ||
    message.includes('authentication failed')
  );
}

/**
 * Validate Resend API key by testing it against Resend API
 * Can be called at startup or on-demand
 */
export async function validateResendApiKey(): Promise<{
  valid: boolean;
  error?: string;
  keyPrefix?: string;
}> {
  const apiKey = process.env.RESEND_API_KEY;
  
  if (!apiKey || apiKey.trim() === '') {
    return {
      valid: false,
      error: 'RESEND_API_KEY environment variable is not set'
    };
  }
  
  // Validate format
  if (!apiKey.startsWith('re_') || apiKey.length < 20) {
    return {
      valid: false,
      error: 'RESEND_API_KEY format appears invalid (should start with "re_" and be at least 20 characters)',
      keyPrefix: apiKey.substring(0, 8)
    };
  }
  
  // Test API key by calling Resend API
  try {
    const response = await fetch('https://api.resend.com/domains', {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
    });
    
    if (!response.ok) {
      const error = await response.json();
      return {
        valid: false,
        error: error.message || 'API key validation failed',
        keyPrefix: apiKey.substring(0, 8)
      };
    }
    
    return {
      valid: true,
      keyPrefix: apiKey.substring(0, 8)
    };
  } catch (error: any) {
    return {
      valid: false,
      error: error.message || 'Failed to validate API key',
      keyPrefix: apiKey.substring(0, 8)
    };
  }
}

/**
 * Retry wrapper for email sending with exponential backoff
 * Does NOT retry on invalid API key errors
 */
async function sendEmailWithRetry<T>(
  emailFn: () => Promise<T>,
  maxRetries = 3,
  baseDelay = 1000
): Promise<T> {
  let lastError: any;
  const correlationId = `email-${Date.now()}-${Math.random().toString(36).substring(7)}`;
  
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const result = await emailFn();
      if (attempt > 0) {
        console.log(`[EMAIL][RETRY] Success after ${attempt} retries:`, { correlationId });
      }
      return result;
    } catch (error: any) {
      lastError = error;
      const parsedError = parseResendError(error);
      
      // Don't retry on invalid API key
      if (isInvalidApiKeyError(parsedError)) {
        console.error('[EMAIL][ERROR] Invalid API key detected - not retrying:', {
          correlationId,
          error: parsedError.message,
          statusCode: parsedError.statusCode
        });
        throw new Error(`API key is invalid: ${parsedError.message || 'Unauthorized'}`);
      }
      
      // Don't retry on client errors (4xx except 429 rate limit)
      const statusCode = parsedError.statusCode;
      if (statusCode && statusCode >= 400 && statusCode < 500 && statusCode !== 429) {
        console.error('[EMAIL][ERROR] Client error - not retrying:', {
          correlationId,
          statusCode,
          error: parsedError.message
        });
        throw error;
      }
      
      // Retry on server errors (5xx) or network errors
      if (attempt < maxRetries) {
        const delay = baseDelay * Math.pow(2, attempt);
        console.warn(`[EMAIL][RETRY] Attempt ${attempt + 1}/${maxRetries} after ${delay}ms:`, {
          correlationId,
          error: parsedError.message,
          statusCode
        });
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }
  
  console.error('[EMAIL][ERROR] Max retries exceeded:', {
    correlationId,
    error: parseResendError(lastError).message
  });
  throw lastError;
}

interface InvitationEmailParams {
  email: string;
  fullName: string;
  role: string;
  branch: string;
  invitationLink: string;
  invitedByName: string;
}

export async function sendInvitationEmail(params: InvitationEmailParams): Promise<void> {
  const {
    email,
    fullName,
    role,
    branch,
    invitationLink,
    invitedByName
  } = params;

  const htmlContent = generateInvitationHTML({
    fullName,
    role,
    branch,
    invitationLink,
    invitedByName
  });

  const subject = `You're invited to Fine & Country Zimbabwe - ${role} Account`;

  console.log('[EMAIL] Sending invitation to:', { email, role, branch });

  const correlationId = `invite-${Date.now()}-${Math.random().toString(36).substring(7)}`;
  
  return sendEmailWithRetry(async () => {
    // Validate API key
    const apiKey = validateResendConfig();
    const keyPrefix = apiKey.substring(0, 8);
    
    console.log('[EMAIL] Sending invitation:', { email, correlationId, keyPrefix });
    
    // Using Resend API (which you have set up)
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        from: `Fine & Country Zimbabwe <${process.env.AUTH_EMAIL_FROM || DEFAULT_FROM_EMAIL}>`,
        to: email,
        subject,
        html: htmlContent
      })
    });

    if (!response.ok) {
      const error = await response.json();
      const parsedError = parseResendError(error);
      
      console.error('[EMAIL][ERROR] Resend API error:', {
        correlationId,
        statusCode: response.status,
        error: parsedError,
        keyPrefix
      });
      
      // Provide specific error message for invalid API key
      if (isInvalidApiKeyError(parsedError)) {
        throw new Error(`API key is invalid. Please check RESEND_API_KEY environment variable. Key prefix: ${keyPrefix}`);
      }
      
      throw new Error(`Email service error: ${parsedError.message || 'Unknown error'}`);
    }

    const result = await response.json();
    console.log('[EMAIL] Invitation sent successfully:', { 
      id: result.id, 
      email, 
      correlationId,
      keyPrefix 
    });
    
    return result;
  });
}

function generateInvitationHTML(params: {
  fullName: string;
  role: string;
  branch: string;
  invitationLink: string;
  invitedByName: string;
}): string {
  const { fullName, role, branch, invitationLink, invitedByName } = params;

  const roleColors: Record<string, string> = {
    'ADMIN': '#85754E',
    'MANAGER': '#2563EB',
    'AGENT': '#059669',
    'ACCOUNT': '#7C3AED',
    'CLIENT': '#0891B2'
  };

  const roleColor = roleColors[role] || '#85754E';

  return `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <style>
          body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
            line-height: 1.6;
            color: #333;
            background-color: #f9f8f6;
            margin: 0;
            padding: 0;
          }
          .container {
            max-width: 600px;
            margin: 40px auto;
            background: white;
            border-radius: 12px;
            box-shadow: 0 10px 40px rgba(0,0,0,0.1);
            overflow: hidden;
          }
          .header {
            background: linear-gradient(135deg, ${roleColor} 0%, ${roleColor}dd 100%);
            color: white;
            padding: 40px 30px;
            text-align: center;
          }
          .header h1 {
            margin: 0;
            font-size: 28px;
            font-weight: 700;
          }
          .content {
            padding: 40px 30px;
          }
          .greeting {
            font-size: 18px;
            font-weight: 600;
            color: #1a1a1a;
            margin-bottom: 20px;
          }
          .details {
            background: #f5f5f5;
            border-left: 4px solid ${roleColor};
            padding: 20px;
            margin: 30px 0;
            border-radius: 4px;
          }
          .details p {
            margin: 10px 0;
            font-size: 14px;
          }
          .label {
            font-weight: 600;
            color: ${roleColor};
            text-transform: uppercase;
            font-size: 12px;
            letter-spacing: 1px;
          }
          .cta-button {
            display: inline-block;
            background: ${roleColor};
            color: white;
            padding: 16px 40px;
            border-radius: 8px;
            text-decoration: none;
            font-weight: 600;
            font-size: 16px;
            margin: 30px 0;
            transition: opacity 0.2s;
          }
          .cta-button:hover {
            opacity: 0.9;
          }
          .footer {
            background: #f9f8f6;
            padding: 30px;
            text-align: center;
            border-top: 1px solid #eee;
            font-size: 12px;
            color: #666;
          }
          .divider {
            height: 1px;
            background: #eee;
            margin: 30px 0;
          }
          .warning {
            background: #fff3cd;
            border: 1px solid #ffc107;
            color: #856404;
            padding: 15px;
            border-radius: 6px;
            font-size: 13px;
            margin: 20px 0;
          }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Welcome to Fine & Country</h1>
            <p>Zimbabwe's Premier Real Estate Platform</p>
          </div>

          <div class="content">
            <p class="greeting">Hello ${fullName},</p>
            
            <p>
              <strong>${invitedByName}</strong> has invited you to join Fine & Country Zimbabwe as a <strong>${role}</strong> in the <strong>${branch}</strong> branch.
            </p>

            <div class="details">
              <p><span class="label">Account Role</span><br>${role}</p>
              <p><span class="label">Branch Assignment</span><br>${branch}</p>
              <p><span class="label">Access Level</span><br>Full feature access based on role permissions</p>
            </div>

            <p>Click the button below to accept your invitation and set up your account:</p>

            <div style="text-align: center;">
              <a href="${invitationLink}" class="cta-button">Accept Invitation</a>
            </div>

            <div class="warning">
              <strong>⏱️ Important:</strong> This invitation link expires in 30 days. If you don't accept within this timeframe, you'll need to request a new invitation.
            </div>

            <p>
              Or copy and paste this link in your browser:<br>
              <code style="word-break: break-all; background: #f5f5f5; padding: 10px; display: block; margin: 10px 0; border-radius: 4px; font-size: 12px;">
                ${invitationLink}
              </code>
            </p>

            <div class="divider"></div>

            <p style="font-size: 14px; color: #666;">
              If you have any questions about your account or need assistance, please contact our support team or reply to this email.
            </p>
          </div>

          <div class="footer">
            <p>Fine & Country Zimbabwe</p>
            <p>Enterprise Real Estate Platform</p>
            <p style="margin-top: 15px; color: #999;">
              This is an automated invitation email. Please do not reply directly to this message.
            </p>
          </div>
        </div>
      </body>
    </html>
  `;
}

// Email validation utility
export function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

// Resend invitation email utility
export async function resendInvitationEmail(email: string, invitationLink: string): Promise<void> {
  console.log('[EMAIL] Resending invitation to:', email);
  
  const correlationId = `resend-${Date.now()}-${Math.random().toString(36).substring(7)}`;
  
  return sendEmailWithRetry(async () => {
    // Validate API key
    const apiKey = validateResendConfig();
    const keyPrefix = apiKey.substring(0, 8);
    
    console.log('[EMAIL] Resending invitation:', { email, correlationId, keyPrefix });
    
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        from: `Fine & Country Zimbabwe <${process.env.AUTH_EMAIL_FROM || DEFAULT_FROM_EMAIL}>`,
        to: email,
        subject: 'Your Fine & Country Zimbabwe Invitation',
        html: generateInvitationHTML({
          fullName: email,
          role: 'USER',
          branch: 'Harare',
          invitationLink,
          invitedByName: 'Fine & Country Support'
        })
      })
    });

    if (!response.ok) {
      const error = await response.json();
      const parsedError = parseResendError(error);
      
      console.error('[EMAIL][ERROR] Resend API error:', {
        correlationId,
        statusCode: response.status,
        error: parsedError,
        keyPrefix
      });
      
      // Provide specific error message for invalid API key
      if (isInvalidApiKeyError(parsedError)) {
        throw new Error(`API key is invalid. Please check RESEND_API_KEY environment variable. Key prefix: ${keyPrefix}`);
      }
      
      throw new Error(`Failed to resend invitation email: ${parsedError.message || 'Unknown error'}`);
    }

    const result = await response.json();
    console.log('[EMAIL] Invitation resent successfully:', { 
      id: result.id,
      email, 
      correlationId,
      keyPrefix 
    });
    
    return result;
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Generic Email Service
// ─────────────────────────────────────────────────────────────────────────────

interface SendEmailParams {
  to: string | string[];
  subject: string;
  html: string;
  from?: string;
  replyTo?: string;
  attachments?: Array<{
    filename: string;
    content: Buffer;
    contentType: string;
  }>;
}

/**
 * Generic email sending function using Resend API
 * Supports HTML content and attachments (PDF, CSV, etc.)
 */
export async function sendEmail(params: SendEmailParams): Promise<{ id: string; success: boolean }> {
  const { to, subject, html, from, replyTo, attachments } = params;
  
  console.log('[EMAIL] Sending email to:', { to, subject, hasAttachments: !!attachments?.length });

  const correlationId = `email-${Date.now()}-${Math.random().toString(36).substring(7)}`;
  
  return sendEmailWithRetry(async () => {
    // Validate API key
    const apiKey = validateResendConfig();
    const keyPrefix = apiKey.substring(0, 8);
    
    console.log('[EMAIL] Sending email:', { 
      to, 
      subject, 
      hasAttachments: !!attachments?.length,
      correlationId,
      keyPrefix
    });
    
    // Standardize email format: use provided 'from' or default with company name
    const fromEmail = from || process.env.AUTH_EMAIL_FROM || DEFAULT_FROM_EMAIL;
    const emailPayload: any = {
      from: fromEmail.includes('<') ? fromEmail : `Fine & Country Zimbabwe <${fromEmail}>`,
      to,
      subject,
      html
    };

    if (replyTo) {
      emailPayload.reply_to = replyTo;
    }

     // Add attachments if present
     if (attachments && attachments.length > 0) {
       emailPayload.attachments = attachments.map(att => ({
         filename: att.filename,
         content: Buffer.isBuffer(att.content) ? att.content.toString('base64') : att.content,
         type: att.contentType
       }));
     }

    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify(emailPayload)
    });

    if (!response.ok) {
      const error = await response.json();
      const parsedError = parseResendError(error);
      
      console.error('[EMAIL][ERROR] Resend API error:', {
        correlationId,
        statusCode: response.status,
        error: parsedError,
        keyPrefix
      });
      
      // Provide specific error message for invalid API key
      if (isInvalidApiKeyError(parsedError)) {
        throw new Error(`API key is invalid. Please check RESEND_API_KEY environment variable. Key prefix: ${keyPrefix}`);
      }
      
      throw new Error(`Email service error: ${parsedError.message || 'Unknown error'}`);
    }

    const result = await response.json();
    console.log('[EMAIL] Email sent successfully:', { 
      id: result.id, 
      to,
      correlationId,
      keyPrefix
    });

    return { id: result.id, success: true };
  });
}
