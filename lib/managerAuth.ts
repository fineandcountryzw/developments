import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

/**
 * Require Manager role
 */
async function requireManager() {
  const { getServerSession } = await import('next-auth');
  const { authOptions } = await import('@/lib/authOptions');
  const session = await getServerSession(authOptions);

  if (!session?.user) {
    return {
      error: NextResponse.json(
        { success: false, error: 'Unauthorized - Please log in' },
        { status: 401 }
      )
    };
  }

  const user = session.user as any;
  const role = user.role?.toUpperCase();

  if (role !== 'MANAGER' && role !== 'ADMIN') {
    return {
      error: NextResponse.json(
        { success: false, error: 'Unauthorized - Manager access required' },
        { status: 403 }
      )
    };
  }

  return { user, error: null };
}

export { requireManager };
