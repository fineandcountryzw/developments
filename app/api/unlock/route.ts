import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';

/**
 * API Route: POST /api/unlock
 * 
 * Validates password and sets secure session cookie for maintenance mode bypass.
 * 
 * Security:
 * - Password stored in environment variable only
 * - No password exposed to client
 * - HttpOnly secure cookie
 * - Rate limiting via try-catch (optional enhancement)
 */

const UNLOCK_COOKIE_NAME = 'erp_unlocked';
const COOKIE_MAX_AGE = 60 * 60 * 24 * 7; // 7 days

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { password } = body;

    // Get password from environment
    const correctPassword = process.env.ERP_ACCESS_PASSWORD?.trim();

    // Validate environment is configured
    if (!correctPassword) {
      console.error('[UNLOCK] ERP_ACCESS_PASSWORD not configured');
      return NextResponse.json(
        { success: false, message: 'Server configuration error' },
        { status: 500 }
      );
    }

    // Validate input
    if (!password || typeof password !== 'string') {
      return NextResponse.json(
        { success: false, message: 'Password is required' },
        { status: 400 }
      );
    }

    // Verify password (constant-time comparison would be ideal for production)
    if (password !== correctPassword) {
      // Log failed attempt (for monitoring)
      const ip = request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown';
      console.warn('[UNLOCK] Failed unlock attempt from:', ip);
      
      return NextResponse.json(
        { success: false, message: 'Invalid password' },
        { status: 401 }
      );
    }

    // Success - set secure cookie
    const response = NextResponse.json(
      { success: true, message: 'Access granted' },
      { status: 200 }
    );

    // Set HttpOnly secure cookie
    response.cookies.set({
      name: UNLOCK_COOKIE_NAME,
      value: 'true',
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: COOKIE_MAX_AGE,
      path: '/',
    });

    // Log successful unlock
    console.log('[UNLOCK] Access granted');

    return response;
  } catch (error) {
    console.error('[UNLOCK] Error processing unlock request:', error);
    return NextResponse.json(
      { success: false, message: 'Server error' },
      { status: 500 }
    );
  }
}
