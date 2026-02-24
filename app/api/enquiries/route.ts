import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getAuthenticatedUser } from '@/lib/access-control';
import { logger } from '@/lib/logger';
import { apiError, apiSuccess } from '@/lib/api-response';
import { ErrorCodes } from '@/lib/error-codes';

/**
 * POST /api/enquiries
 * Create an enquiry/contact request
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { 
      category, 
      message, 
      developmentId, 
      developmentName,
      standId, 
      standNumber,
      clientId,
      agentId,
      clientName,
      clientEmail,
      clientPhone 
    } = body;

    // Get authenticated user if available (optional for public enquiries)
    const user = await getAuthenticatedUser().catch(() => null);

    // Create enquiry record in ActivityLog
    // Note: ActivityLog uses 'changes' field (Json) for metadata, not 'metadata'
    const enquiry = await prisma.activityLog.create({
      data: {
        branch: 'Harare', // Default branch, can be enhanced
        userId: user?.id || 'system',
        action: 'ENQUIRY',
        module: 'INSURANCE',
        recordId: developmentId || standId || 'general',
        description: `Insurance enquiry: ${category || 'General'}`,
        changes: {
          category: category || 'Insurance - Old Mutual',
          message: message || '',
          developmentId: developmentId || null,
          standId: standId || null,
          standNumber: standNumber || null,
          clientId: clientId || user?.id || null,
          agentId: agentId || null,
          clientName: clientName || user?.name || null,
          clientEmail: clientEmail || user?.email || null,
          clientPhone: clientPhone || null,
          source: 'development_documents',
          timestamp: new Date().toISOString(),
        },
      },
    });

    logger.info('Insurance enquiry created', {
      module: 'API',
      action: 'CREATE_ENQUIRY',
      enquiryId: enquiry.id,
      category,
      developmentId,
      standId,
    });

    // Notify agent if agentId is provided (async)
    if (agentId) {
      import('@/lib/notifications').then(({ notifyInsuranceEnquiry }) => {
        notifyInsuranceEnquiry({
          agentId,
          clientId: clientId || user?.id || 'unknown',
          clientName: clientName || user?.name || 'Client',
          developmentName: developmentName || 'Development',
          standNumber: standNumber || undefined,
        }).catch(err => {
          logger.warn('Failed to notify agent about insurance enquiry', {
            module: 'API',
            action: 'NOTIFY_INSURANCE_ENQUIRY',
            agentId,
            error: err instanceof Error ? err.message : String(err),
          });
        });
      });
    }

    return apiSuccess(enquiry);
  } catch (error: any) {
    logger.error('Error creating enquiry', error, { module: 'API', action: 'CREATE_ENQUIRY' });
    return apiError('Failed to create enquiry', 500, ErrorCodes.INTERNAL_ERROR);
  }
}

/**
 * GET /api/enquiries
 * Get enquiries (admin/agent only)
 */
export async function GET(request: NextRequest) {
  try {
    const user = await getAuthenticatedUser();
    if (!user) {
      return apiError('Unauthorized', 401, ErrorCodes.AUTH_REQUIRED);
    }

    // Only admins and agents can view enquiries
    if (user.role !== 'ADMIN' && user.role !== 'AGENT') {
      return apiError('Forbidden', 403, ErrorCodes.ACCESS_DENIED);
    }

    const { searchParams } = new URL(request.url);
    const category = searchParams.get('category');
    const developmentId = searchParams.get('developmentId');

    const where: any = {
      action: 'ENQUIRY',
      module: 'INSURANCE',
    };

    // Note: ActivityLog uses 'changes' field, not 'metadata'
    // Filtering by category would require JSON path queries
    // For now, filter by module and action only

    const enquiries = await prisma.activityLog.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: 100,
    });

    return apiSuccess(enquiries);
  } catch (error: any) {
    logger.error('Error fetching enquiries', error, { module: 'API', action: 'GET_ENQUIRIES' });
    return apiError('Failed to fetch enquiries', 500, ErrorCodes.INTERNAL_ERROR);
  }
}
