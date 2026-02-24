import { EmailTemplate } from '@/components/emails/EmailTemplate';
import { Resend } from 'resend';
import { logger } from '@/lib/logger';

// Standardized email configuration
const DEFAULT_FROM_EMAIL = 'noreply@fineandcountryerp.com';

// Simple in-memory rate limiter (5 emails per minute per IP)
const rateLimitStore = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT_MAX = 5;
const RATE_LIMIT_WINDOW_MS = 60 * 1000; // 1 minute

function checkRateLimit(identifier: string): { allowed: boolean; remaining: number } {
  const now = Date.now();
  const record = rateLimitStore.get(identifier);
  
  // Clean up expired entries periodically (when > 1000 entries)
  if (rateLimitStore.size > 1000) {
    for (const [key, value] of rateLimitStore.entries()) {
      if (value.resetAt < now) rateLimitStore.delete(key);
    }
  }
  
  if (!record || record.resetAt < now) {
    rateLimitStore.set(identifier, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
    return { allowed: true, remaining: RATE_LIMIT_MAX - 1 };
  }
  
  if (record.count >= RATE_LIMIT_MAX) {
    return { allowed: false, remaining: 0 };
  }
  
  record.count++;
  return { allowed: true, remaining: RATE_LIMIT_MAX - record.count };
}

// Validate and initialize Resend (lazy initialization)
function getResendClient(): Resend {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey || apiKey.trim() === '') {
    throw new Error('RESEND_API_KEY environment variable is required');
  }
  
  // Validate API key format
  if (!apiKey.startsWith('re_') || apiKey.length < 20) {
    logger.warn('API key format appears invalid', {
      module: 'API',
      action: 'EMAIL_SEND',
      prefix: apiKey.substring(0, 8),
      length: apiKey.length
    });
  }
  
  return new Resend(apiKey);
}

export async function POST(request: Request) {
  try {
    // Rate limiting - use IP or fallback to generic identifier
    const ip = request.headers.get('x-forwarded-for') || 
               request.headers.get('x-real-ip') || 
               'anonymous';
    
    const { allowed, remaining } = checkRateLimit(ip);
    
    if (!allowed) {
      return Response.json(
        { error: 'Rate limit exceeded. Please try again later.' },
        { 
          status: 429,
          headers: {
            'X-RateLimit-Limit': RATE_LIMIT_MAX.toString(),
            'X-RateLimit-Remaining': '0',
            'Retry-After': '60'
          }
        }
      );
    }
    
    const body = await request.json();
    const { email, firstName } = body;

    if (!email || !firstName) {
      return Response.json(
        { error: 'Missing required fields: email, firstName' },
        { status: 400 }
      );
    }

    // Lazy initialization - only creates client when function is called
    const resend = getResendClient();
    const apiKey = process.env.RESEND_API_KEY!;
    const keyPrefix = apiKey.substring(0, 8);
    const correlationId = `send-${Date.now()}-${Math.random().toString(36).substring(7)}`;
    
    logger.info('Sending email via Resend SDK', {
      module: 'API',
      action: 'POST_EMAILS_SEND',
      email: email?.substring(0, 3) + '***',
      correlationId,
      keyPrefix
    });
    
    const { data, error } = await resend.emails.send({
      from: `Fine & Country Zimbabwe <${process.env.AUTH_EMAIL_FROM || DEFAULT_FROM_EMAIL}>`,
      to: [email],
      subject: 'Welcome to Fine & Country Zimbabwe',
      react: EmailTemplate({ firstName }),
    });

    if (error) {
      logger.error('Resend SDK error', error as Error, {
        module: 'API',
        action: 'POST_EMAILS_SEND',
        correlationId,
        keyPrefix
      });
      
      // Check if it's an invalid API key error
      const errorMessage = (error as any)?.message?.toLowerCase() || '';
      if (errorMessage.includes('invalid') || errorMessage.includes('unauthorized') || errorMessage.includes('api key')) {
        return Response.json({ 
          error: `API key is invalid. Please check RESEND_API_KEY environment variable. Key prefix: ${keyPrefix}`,
          details: error
        }, { status: 500 });
      }
      
      return Response.json({ error, correlationId }, { status: 500 });
    }
    
    logger.info('Email sent successfully via Resend SDK', {
      module: 'API',
      action: 'POST_EMAILS_SEND',
      id: data?.id,
      email: email?.substring(0, 3) + '***',
      correlationId,
      keyPrefix
    });

    return Response.json(data, {
      headers: {
        'X-RateLimit-Limit': RATE_LIMIT_MAX.toString(),
        'X-RateLimit-Remaining': remaining.toString()
      }
    });
  } catch (error: any) {
    logger.error('Email send error', error, { module: 'API', action: 'POST_EMAILS_SEND' });
    return Response.json(
      { error: 'Failed to send email' },
      { status: 500 }
    );
  }
}
