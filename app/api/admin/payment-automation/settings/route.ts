import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { requireAdmin } from '@/lib/adminAuth';
import { logger } from '@/lib/logger';
import { apiError, apiSuccess } from '@/lib/api-response';
import { ErrorCodes } from '@/lib/error-codes';

// Disable static generation for this API route
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  try {
    // Verify admin authorization using the standard requireAdmin
    const authResult = await requireAdmin();
    if (authResult.error) {
      return authResult.error;
    }

    const { searchParams } = new URL(request.url);
    const branch = searchParams.get('branch') || 'Harare';

    // Get or create settings for branch
    let settings = await prisma.paymentAutomationSettings.findUnique({
      where: { branch },
    });

    // If not found, create default settings
    if (!settings) {
      settings = await prisma.paymentAutomationSettings.create({
        data: {
          branch,
          enableReminders: true,
          enableEscalation: true,
          enableFollowups: true,
          reminderDaysAfterDue: 0,
          escalationDaysOverdue: 30,
          followupFrequencyDays: 15,
          maxFollowups: 3,
          notificationEmails: ['admin@finecountry.co.zw'],
        },
      });
    }

    // Return settings directly (not wrapped in data)
    return apiSuccess(settings);
  } catch (error: any) {
    logger.error('Error fetching payment automation settings', error, { module: 'API', action: 'GET_PAYMENT_AUTOMATION_SETTINGS' });
    return apiError('Failed to fetch settings', 500, ErrorCodes.FETCH_ERROR);
  }
}

export async function POST(request: NextRequest) {
  try {
    // Verify admin authorization using the standard requireAdmin
    const authResult = await requireAdmin();
    if (authResult.error) {
      return authResult.error;
    }

    const body = await request.json();
    const {
      branch = 'Harare',
      enableReminders,
      enableEscalation,
      enableFollowups,
      reminderDaysAfterDue,
      escalationDaysOverdue,
      followupFrequencyDays,
      maxFollowups,
      customEmailTemplate,
      notificationEmails,
    } = body;

    // Validate inputs
    if (!branch) {
      return apiError('Branch is required', 400, ErrorCodes.VALIDATION_ERROR);
    }

    // Update or create settings
    const settings = await prisma.paymentAutomationSettings.upsert(
      {
        where: { branch },
        update: {
          ...(enableReminders !== undefined && { enableReminders }),
          ...(enableEscalation !== undefined && { enableEscalation }),
          ...(enableFollowups !== undefined && { enableFollowups }),
          ...(reminderDaysAfterDue !== undefined && { reminderDaysAfterDue }),
          ...(escalationDaysOverdue !== undefined && { escalationDaysOverdue }),
          ...(followupFrequencyDays !== undefined && { followupFrequencyDays }),
          ...(maxFollowups !== undefined && { maxFollowups }),
          ...(customEmailTemplate !== undefined && { customEmailTemplate }),
          ...(notificationEmails && { notificationEmails }),
        },
        create: {
          branch,
          enableReminders: enableReminders ?? true,
          enableEscalation: enableEscalation ?? true,
          enableFollowups: enableFollowups ?? true,
          reminderDaysAfterDue: reminderDaysAfterDue ?? 0,
          escalationDaysOverdue: escalationDaysOverdue ?? 30,
          followupFrequencyDays: followupFrequencyDays ?? 15,
          maxFollowups: maxFollowups ?? 3,
          customEmailTemplate: customEmailTemplate ?? null,
          notificationEmails: notificationEmails ?? ['admin@finecountry.co.zw'],
        },
      }
    );

    return apiSuccess({
      settings,
      message: 'Settings updated successfully'
    });
  } catch (error: any) {
    logger.error('Error updating payment automation settings', error, { module: 'API', action: 'POST_PAYMENT_AUTOMATION_SETTINGS' });
    return apiError('Failed to update settings', 500, ErrorCodes.UPDATE_ERROR);
  }
}
