import { NextResponse } from 'next/server';
import { validateResendApiKey } from '@/lib/email-service';

export async function GET() {
  try {
    const validation = await validateResendApiKey();
    
    if (!validation.valid) {
      return NextResponse.json({ 
        success: false,
        error: validation.error,
        keyPrefix: validation.keyPrefix,
        message: 'API key validation failed'
      }, { status: 500 });
    }

    // Additional test: Try to fetch domains to confirm key works
    const apiKey = process.env.RESEND_API_KEY!;
    const response = await fetch('https://api.resend.com/domains', {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const error = await response.json();
      return NextResponse.json({ 
        success: false,
        error: 'API key validation passed format check but domains API call failed',
        details: error,
        keyPrefix: validation.keyPrefix,
      }, { status: 500 });
    }

    const data = await response.json();
    
    return NextResponse.json({ 
      success: true,
      valid: true,
      keyPrefix: validation.keyPrefix,
      domains: data.data || [],
      verifiedDomains: (data.data || []).filter((d: any) => d.status === 'verified'),
      message: 'API key is valid and working!'
    });
    
  } catch (error: any) {
    return NextResponse.json({ 
      success: false,
      error: 'Failed to test API key',
      message: error.message 
    }, { status: 500 });
  }
}
