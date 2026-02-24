/**
 * Offline Contract Generation API
 * POST /api/admin/contracts/offline
 * 
 * Generates a contract for offline sales by selecting:
 * - A Word template
 * - A client
 * - A stand ID
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/adminAuth';
import prisma from '@/lib/prisma';
import { logger } from '@/lib/logger';

export async function POST(request: NextRequest) {
  try {
    const authResult = await requireAdmin();
    if (authResult.error) return authResult.error;
    const user = authResult.user;

    const body = await request.json();
    const { templateId, clientId, standId, contractDate, notes } = body;

    // Validate required fields
    if (!clientId) {
      return NextResponse.json(
        { error: 'clientId is required' },
        { status: 400 }
      );
    }

    if (!standId) {
      return NextResponse.json(
        { error: 'standId is required' },
        { status: 400 }
      );
    }

    // Fetch stand with development first for auto-selection
    const stand = await prisma.stand.findUnique({
      where: { id: standId },
      include: {
        development: true
      }
    });

    if (!stand) {
      return NextResponse.json(
        { error: 'Stand not found' },
        { status: 404 }
      );
    }

    if (!stand.development) {
      return NextResponse.json(
        { error: 'Stand is missing development information' },
        { status: 400 }
      );
    }

    // Auto-select template if not provided
    let resolvedTemplateId = templateId;
    if (!resolvedTemplateId) {
      // First try to find a development-specific active template
      const developmentSpecificTemplate = await prisma.contractTemplate.findFirst({
        where: {
          status: 'ACTIVE',
          developmentId: stand.development.id
        }
      });

      if (developmentSpecificTemplate) {
        resolvedTemplateId = developmentSpecificTemplate.id;
        logger.info('Auto-selected development-specific template', {
          templateId: resolvedTemplateId,
          developmentId: stand.development.id
        });
      } else {
        // Fallback to global template
        const globalTemplate = await prisma.contractTemplate.findFirst({
          where: {
            status: 'ACTIVE',
            isGlobal: true
          }
        });

        if (globalTemplate) {
          resolvedTemplateId = globalTemplate.id;
          logger.info('Auto-selected global template', {
            templateId: resolvedTemplateId
          });
        } else {
          return NextResponse.json(
            { error: 'No active contract templates available' },
            { status: 404 }
          );
        }
      }
    }

    // Fetch template
    const template = await prisma.contractTemplate.findUnique({
      where: { id: resolvedTemplateId }
    });

    if (!template) {
      return NextResponse.json(
        { error: 'Contract template not found' },
        { status: 404 }
      );
    }

    if (template.status !== 'ACTIVE') {
      return NextResponse.json(
        { error: 'Selected template is not active' },
        { status: 400 }
      );
    }

    // Validate template is appropriate for this development
    if (!template.isGlobal && template.developmentId !== stand.development.id) {
      return NextResponse.json(
        { error: 'Template is not valid for this development' },
        { status: 400 }
      );
    }

    // Fetch client
    const client = await prisma.client.findUnique({
      where: { id: clientId }
    });

    if (!client) {
      return NextResponse.json(
        { error: 'Client not found' },
        { status: 404 }
      );
    }

    // Generate contract content by replacing variables
    let contractContent = template.content;

    // Calculate sale price (use discounted price if available, otherwise base price)
    // Convert Decimal to number for calculations
    const salePrice = Number(stand.discountedPrice || stand.price);
    const discountPercent = Number(stand.discountPercent || 0);
    const discountAmount = Number(stand.discountAmount || 0);
    const basePrice = Number(stand.price);
    const sizeSqm = Number(stand.sizeSqm || 1);
    const pricePerSqm = stand.pricePerSqm ? Number(stand.pricePerSqm) : salePrice / sizeSqm;

    // Format price with currency
    const formatCurrency = (amount: number) => {
      return new Intl.NumberFormat('en-ZA', {
        style: 'currency',
        currency: 'ZAR',
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }).format(amount);
    };

    // Format number with thousands separator
    const formatNumber = (amount: number) => {
      return new Intl.NumberFormat('en-ZA').format(amount);
    };

    // Convert number to words (simplified version)
    const numberToWords = (num: number): string => {
      if (num === 0) return 'Zero';
      const ones = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine',
        'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
      const tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

      const convertLessThanThousand = (n: number): string => {
        if (n === 0) return '';
        if (n < 20) return ones[n] + ' ';
        if (n < 100) return tens[Math.floor(n / 10)] + ' ' + ones[n % 10] + ' ';
        return ones[Math.floor(n / 100)] + ' Hundred ' + convertLessThanThousand(n % 100);
      };

      let result = '';
      let remaining = Math.floor(num);

      if (remaining >= 1000000) {
        result += convertLessThanThousand(Math.floor(remaining / 1000000)) + 'Million ';
        remaining %= 1000000;
      }
      if (remaining >= 1000) {
        result += convertLessThanThousand(Math.floor(remaining / 1000)) + 'Thousand ';
        remaining %= 1000;
      }
      result += convertLessThanThousand(remaining);

      return result.trim() + ' Rand';
    };

    // Name splitting fallback
    const fullName = client.name || '';
    const nameParts = fullName.split(' ');
    const firstName = client.firstName || nameParts[0] || '';
    const lastName = client.lastName || nameParts.slice(1).join(' ') || '';

    const variables = {
      // Client information
      clientName: fullName,
      clientFullName: fullName, // Alias
      clientFirstName: firstName,
      clientLastName: lastName,
      clientEmail: client.email,
      clientPhone: client.phone || '',
      clientNationalId: client.nationalId || '',
      clientIdNumber: client.nationalId || '', // Alias

      // Stand information
      standNumber: stand.standNumber,
      standSize: stand.sizeSqm?.toString() || '',
      standSizeSqM: `${stand.sizeSqm || 0} m²`,

      // Development information
      developmentName: stand.development.name,
      developmentLocation: stand.development.location || '',

      // Price information
      standPrice: formatNumber(salePrice),
      standPriceCurrency: formatCurrency(salePrice),
      standPriceWords: numberToWords(salePrice),
      standBasePrice: formatNumber(basePrice),
      standBasePriceCurrency: formatCurrency(basePrice),
      discountPercent: discountPercent > 0 ? `${discountPercent}%` : '0%',
      discountAmount: discountAmount > 0 ? formatCurrency(discountAmount) : 'R0.00',

      // Price per square meter
      pricePerSqm: formatNumber(pricePerSqm),
      pricePerSqmCurrency: formatCurrency(pricePerSqm),

      // Contract information
      contractDate: contractDate || new Date().toISOString().split('T')[0],
      date: contractDate || new Date().toISOString().split('T')[0], // Alias
      today: new Date().toISOString().split('T')[0], // Alias
      contractDateFormatted: contractDate
        ? new Date(contractDate).toLocaleDateString('en-ZA', { year: 'numeric', month: 'long', day: 'numeric' })
        : new Date().toLocaleDateString('en-ZA', { year: 'numeric', month: 'long', day: 'numeric' }),
      notes: notes || '',

      // Additional spacing helpers
      spacer: '    ', // 4 spaces for indentation
      doubleSpacer: '        ', // 8 spaces for double indentation
      lineBreak: '\n',
      doubleLineBreak: '\n\n',
    };

    const namespacedVariables: Record<string, string> = {
      'client.fullName': fullName,
      'client.name': fullName, // Alias
      'client.firstName': firstName,
      'client.lastName': lastName,
      'client.email': client.email,
      'client.phone': client.phone || '',
      'client.nationalId': client.nationalId || '',
      'client.idNumber': client.nationalId || '', // Alias
      'stand.number': stand.standNumber,
      'stand.standNumber': stand.standNumber, // Alias
      'stand.price': formatCurrency(salePrice),
      'stand.size': String(stand.sizeSqm || ''), // Alias
      'stand.sizeSqm': String(stand.sizeSqm || ''),
      'stand.status': stand.status || '',
      'development.name': stand.development.name,
      'development.location': stand.development.location || '',
      'pricing.grandTotal': formatCurrency(salePrice),
      'pricing.depositAmount': formatCurrency(0),
      'contract.date': contractDate || new Date().toISOString().split('T')[0],
      'contract.timestamp': new Date().toISOString(),
    };

    const replacementMap = {
      ...Object.fromEntries(
        Object.entries(variables).map(([key, value]) => [key, String(value)])
      ),
      ...namespacedVariables,
    };

    // Replace both legacy and namespaced placeholders while preserving unknown tags
    contractContent = contractContent.replace(/\{\{([^{}]+)\}\}/g, (fullMatch, token) => {
      const trimmedToken = String(token).trim();
      return Object.prototype.hasOwnProperty.call(replacementMap, trimmedToken)
        ? replacementMap[trimmedToken as keyof typeof replacementMap]
        : fullMatch;
    });

    // Check if a contract already exists with the same client, stand, and template
    const existingContract = await prisma.generatedContract.findFirst({
      where: {
        clientId: client.id,
        standId: stand.id,
        templateId: template.id,
      },
      select: { id: true } // Only select ID to avoid "column does not exist" errors for new fields
    });

    if (existingContract) {
      return NextResponse.json(
        {
          error: 'A contract already exists for this client, stand, and template combination',
          existingContractId: existingContract.id,
          message: 'Please use a different template or view the existing contract'
        },
        { status: 409 }
      );
    }

    // Create generated contract record
    // NOTE: Avoiding 'isOffline', 'contractDate', 'contractData' as they may be missing in DB
    const generatedContract = await prisma.generatedContract.create({
      data: {
        clientId: client.id,
        templateId: template.id,
        standId: stand.id,
        templateName: template.name,
        content: contractContent,
        status: 'PENDING', // Use status to indicate state since isOffline might be missing
        branch: user.branch || 'Harare'
      },
      select: {
        id: true,
        clientId: true,
        templateId: true,
        standId: true,
        templateName: true,
        status: true,
        branch: true,
        createdAt: true,
        // Explicitly NOT selecting isOffline, contractDate, etc.
      }
    });

    // Update client's ownedStands to include this stand
    const currentOwnedStands = client.ownedStands || [];
    if (!currentOwnedStands.includes(stand.id)) {
      await prisma.client.update({
        where: { id: client.id },
        data: {
          ownedStands: [...currentOwnedStands, stand.id],
        },
      });
    }

    // Log activity
    await prisma.activityLog.create({
      data: {
        branch: user.branch || 'Harare',
        userId: user.id || user.email,
        action: 'CREATE',
        module: 'CONTRACTS',
        recordId: generatedContract.id,
        description: `Generated offline contract for ${client.name} - ${stand.standNumber}`,
        changes: JSON.stringify({
          templateId,
          clientId,
          standId,
          contractDate,
        }),
      },
    });

    logger.info('Offline contract generated successfully', {
      module: 'API',
      action: 'GENERATE_OFFLINE_CONTRACT',
      contractId: generatedContract.id,
      clientId,
      standId,
    });

    return NextResponse.json({
      success: true,
      message: 'Contract generated successfully',
      contract: generatedContract,
    }, { status: 201 });

  } catch (error: any) {
    logger.error('Generate offline contract error:', error, {
      module: 'API',
      action: 'GENERATE_OFFLINE_CONTRACT',
    });
    return NextResponse.json(
      { error: error?.message || 'Failed to generate contract' },
      { status: 500 }
    );
  }
}
