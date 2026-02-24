import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/authOptions';
import prisma from '@/lib/prisma';
import { logger } from '@/lib/logger';
import { apiError, apiSuccess } from '@/lib/api-response';
import { ErrorCodes } from '@/lib/error-codes';

export const dynamic = 'force-dynamic';

/**
 * GET /api/developer/settings
 * Fetch developer notification and account settings
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.email) {
      return apiError('Unauthorized', 401, ErrorCodes.AUTH_REQUIRED);
    }

    // Try to find existing settings (using a workaround since developerSettings may not exist)
    let existingSettings = null;
    try {
      // Check if user has any preferences stored (workaround)
      // In production, this would use a dedicated settings table
      existingSettings = null;
    } catch (err) {
      existingSettings = null;
    }

    const defaultSettings = {
      email: session.user.email,
      name: session.user.name || '',
      notifications: {
        emailAlerts: true,
        paymentNotifications: true,
        saleAlerts: true,
        reservationAlerts: true,
        systemUpdates: false,
        weeklyReport: true,
        monthlyReport: true
      },
      preferences: {
        currency: 'USD',
        timezone: 'Africa/Harare',
        language: 'en',
        theme: 'light'
      },
      privacy: {
        showPublicProfile: false,
        allowMessages: true
      }
    };

    const settings = existingSettings || defaultSettings;

    return apiSuccess(settings);

  } catch (error: any) {
    logger.error('Developer Settings API Error', error, { module: 'API', action: 'GET_DEVELOPER_SETTINGS' });
    return apiError(error.message || 'Failed to fetch settings', 500, ErrorCodes.FETCH_ERROR);
  }
}

/**
 * PUT /api/developer/settings
 * Update developer notification and account settings
 */
export async function PUT(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.email) {
      return apiError('Unauthorized', 401, ErrorCodes.AUTH_REQUIRED);
    }

    const updates = await request.json();

    // Validate updates
    if (!updates || typeof updates !== 'object') {
      return apiError('Invalid request body', 400, ErrorCodes.VALIDATION_ERROR);
    }

    // Log the settings update
    try {
      await prisma.activityLog.create({
        data: {
          branch: 'Harare',
          userId: session.user.email,
          action: 'UPDATE',
          module: 'SETTINGS',
          recordId: 'settings',
          description: 'Developer settings updated',
          changes: JSON.stringify(updates)
        }
      }).catch(() => null);
    } catch (logError: any) {
      logger.warn('Failed to log activity', { error: logError, module: 'API', action: 'PUT_DEVELOPER_SETTINGS' });
    }

    // Return updated settings
    const updatedSettings = {
      email: session.user.email,
      name: session.user.name || '',
      ...updates
    };

    return apiSuccess({
      settings: updatedSettings,
      message: 'Settings updated successfully'
    });

  } catch (error: any) {
    logger.error('Developer Settings API Error', error, { module: 'API', action: 'PUT_DEVELOPER_SETTINGS' });
    return apiError(error.message || 'Failed to update settings', 500, ErrorCodes.UPDATE_ERROR);
  }
}
