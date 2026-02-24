/**
 * Test Helpers
 * 
 * Utility functions for API testing
 */

import { NextRequest, NextResponse } from 'next/server';

/**
 * Create a mock NextRequest for testing
 */
export function createMockRequest(
  url: string,
  options?: {
    method?: string;
    body?: any;
    headers?: Record<string, string>;
  }
): NextRequest {
  const { method = 'GET', body, headers = {} } = options || {};

  const requestInit: RequestInit = {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...headers,
    },
  };

  if (body) {
    requestInit.body = typeof body === 'string' ? body : JSON.stringify(body);
  }

  return new NextRequest(url, requestInit);
}

/**
 * Extract JSON response from NextResponse or Response
 */
export async function extractJson(response: Response | NextResponse) {
  const text = await response.text();
  try {
    return JSON.parse(text);
  } catch {
    return { raw: text };
  }
}

/**
 * Create a mock NextResponse error for testing
 */
export function createErrorResponse(status: number, message: string) {
  return NextResponse.json(
    { error: message, success: false },
    { status }
  );
}

/**
 * Mock user for authentication
 */
export const mockUsers = {
  admin: {
    id: 'admin-1',
    email: 'admin@example.com',
    role: 'ADMIN',
    branch: 'Harare',
    isActive: true,
  },
  agent: {
    id: 'agent-1',
    email: 'agent@example.com',
    role: 'AGENT',
    branch: 'Harare',
    isActive: true,
  },
  client: {
    id: 'client-1',
    email: 'client@example.com',
    role: 'CLIENT',
    branch: 'Harare',
    isActive: true,
  },
};
