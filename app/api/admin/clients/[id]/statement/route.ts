import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/adminAuth';
import prisma from '@/lib/prisma';
import { logger } from '@/lib/logger';
import { apiError, apiSuccess } from '@/lib/api-response';
import { ErrorCodes } from '@/lib/error-codes';

/**
 * GET /api/admin/clients/[id]/statement
 * Fetches client details, payments, and stands for statement generation
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authResult = await requireAdmin();
    if (authResult.error) return authResult.error;

    const { id } = await params;

    if (!id) {
      return apiError('Client ID is required', 400, ErrorCodes.VALIDATION_ERROR);
    }

    // Fetch client with payments and reservations
    const client = await prisma.client.findUnique({
      where: { id },
      include: {
        payments: {
          orderBy: { createdAt: 'desc' }
        },
        reservations: {
          include: {
            stand: {
              include: {
                development: true
              }
            }
          }
        }
      }
    });

    if (!client) {
      return apiError('Client not found', 404, ErrorCodes.NOT_FOUND);
    }

    // Calculate financial summary using correct field names
    const totalPaid = client.payments.reduce((sum, p) => sum + Number(p.amount || 0), 0);
    const verifiedPayments = client.payments.filter(p => p.verificationStatus === 'Verified');
    const totalVerified = verifiedPayments.reduce((sum, p) => sum + Number(p.amount || 0), 0);
    const pendingPayments = client.payments.filter(p => p.verificationStatus !== 'Verified');
    const totalPending = pendingPayments.reduce((sum, p) => sum + Number(p.amount || 0), 0);

    // Get stands from reservations
    const stands = client.reservations
      .filter(r => r.stand)
      .map(r => ({
        id: r.stand!.id,
        number: r.stand!.standNumber,
        status: r.stand!.status,
        price_usd: Number(r.stand!.price) || 0,
        area_sqm: Number(r.stand!.sizeSqm) || 0,
        developmentId: r.stand!.developmentId,
        developmentName: r.stand!.development?.name || 'Unknown'
      }));

    const totalContractValue = stands.reduce((sum, s) => sum + s.price_usd, 0);
    const outstandingBalance = Math.max(0, totalContractValue - totalVerified);

    // Format payments for response
    const formattedPayments = client.payments.map(p => ({
      id: p.id,
      clientId: p.clientId,
      standId: p.standId,
      amount_usd: Number(p.amount) || 0,
      surcharge_amount: Number(p.surchargeAmount) || 0,
      payment_method: p.method,
      payment_type: p.paymentType,
      office_location: p.officeLocation,
      reference: p.reference,
      manual_receipt_no: p.manualReceiptNo,
      description: p.description,
      created_at: p.createdAt,
      verification_status: p.verificationStatus,
      paynow_status: null,
      paynow_reference: null
    }));

    const response = {
      client: {
        id: client.id,
        name: client.name,
        email: client.email,
        phone: client.phone,
        national_id: client.nationalId,
        branch: client.branch,
        is_portal_user: client.isPortalUser,
        kyc_status: null,
        created_at: client.createdAt
      },
      payments: formattedPayments,
      stands,
      summary: {
        totalPaid,
        totalVerified,
        totalPending,
        totalContractValue,
        outstandingBalance,
        paymentCount: client.payments.length,
        verifiedCount: verifiedPayments.length,
        pendingCount: pendingPayments.length,
        standCount: stands.length
      }
    };

    return NextResponse.json({
      data: response,
      error: null,
      status: 200
    });

  } catch (error: any) {
    logger.error('Client statement error', error, { module: 'API', action: 'GET_ADMIN_CLIENT_STATEMENT' });
    return apiError(error?.message || 'Failed to fetch client statement', 500, ErrorCodes.FETCH_ERROR);
  }
}
