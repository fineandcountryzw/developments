import { Resend } from "resend";

// Standardized email configuration
const DEFAULT_FROM_EMAIL = 'noreply@fineandcountryerp.com';

// Validate and initialize Resend (lazy initialization)
function getResendClient(): Resend {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey || apiKey.trim() === '') {
    throw new Error('RESEND_API_KEY environment variable is required');
  }
  
  // Validate API key format
  if (!apiKey.startsWith('re_') || apiKey.length < 20) {
    console.warn('[RESEND] API key format appears invalid:', {
      prefix: apiKey.substring(0, 8),
      length: apiKey.length,
      expectedFormat: 're_... (at least 20 characters)'
    });
  }
  
  return new Resend(apiKey);
}

export async function sendInvitationEmail(email: string, link: string) {
  const correlationId = `resend-invite-${Date.now()}-${Math.random().toString(36).substring(7)}`;
  const apiKey = process.env.RESEND_API_KEY!;
  const keyPrefix = apiKey?.substring(0, 8) || 'unknown';
  
  try {
    // Lazy initialization - only creates client when function is called
    const resend = getResendClient();
    
    console.log('[RESEND] Sending invitation:', { email, correlationId, keyPrefix });
    
    const message = await resend.emails.send({
      from: `Fine & Country Zimbabwe <${process.env.AUTH_EMAIL_FROM || DEFAULT_FROM_EMAIL}>`,
      to: email,
      subject: "You're invited to join Fine & Country ERP",
      html: `<p>Please click this link to join: <a href="${link}">${link}</a></p>`,
    });
    
    console.log('[RESEND] Email sent successfully:', { 
      id: message.data?.id, 
      email, 
      correlationId,
      keyPrefix 
    });
    
    return message;
  } catch (err: any) {
    const errorMessage = err?.message?.toLowerCase() || '';
    const isInvalidKey = errorMessage.includes('invalid') || 
                         errorMessage.includes('unauthorized') || 
                         errorMessage.includes('api key');
    
    console.error('[RESEND][ERROR] Failed to send invitation:', {
      email,
      correlationId,
      keyPrefix,
      error: err?.message,
      isInvalidKey
    });
    
    if (isInvalidKey) {
      throw new Error(`API key is invalid. Please check RESEND_API_KEY environment variable. Key prefix: ${keyPrefix}`);
    }
    
    throw err;
  }
}
