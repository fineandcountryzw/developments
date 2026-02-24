import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/adminAuth';
import prisma from '@/lib/prisma';
import { logger } from '@/lib/logger';
import { apiError, apiSuccess } from '@/lib/api-response';
import { ErrorCodes } from '@/lib/error-codes';
import { DEFAULT_LOGO } from '@/lib/constants';
import { validateRequest } from '@/lib/validation/middleware';
import { settingsSchema } from '@/lib/validation/schemas';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

/**
 * Helper: Ensure CompanySettings table exists
 */
async function ensureTableExists() {
  if (!prisma) return;
  try {
    await prisma.$executeRaw`
      CREATE TABLE IF NOT EXISTS "company_settings" (
        "id" TEXT NOT NULL PRIMARY KEY,
        "branch" TEXT NOT NULL UNIQUE,
        "logo_url" TEXT,
        "company_name" TEXT DEFAULT 'Fine & Country Zimbabwe',
        "phone" TEXT,
        "email" TEXT,
        "address" TEXT,
        "principal_agent_name" TEXT,
        "principal_agent_email" TEXT,
        "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
    `;
    // Ensure new columns exist for older installs (CREATE TABLE won't add missing columns).
    await prisma.$executeRaw`ALTER TABLE "company_settings" ADD COLUMN IF NOT EXISTS "principal_agent_name" TEXT;`;
    await prisma.$executeRaw`ALTER TABLE "company_settings" ADD COLUMN IF NOT EXISTS "principal_agent_email" TEXT;`;
    logger.debug('CompanySettings table ensured', { module: 'API', action: 'SETTINGS' });
  } catch (error) {
    logger.debug('Table already exists or error', { module: 'API', action: 'SETTINGS', error });
  }
}

/**
 * GET /api/admin/settings?branch=Harare
 * Retrieve company settings (logo, contact info, etc.)
 * Supports query parameter: ?branch=Harare or ?branch=Bulawayo
 */
export async function GET(request: NextRequest) {
  try {
    // Get branch from query parameters
    const url = new URL(request.url);
    const branchParam = url.searchParams.get('branch') || 'Harare';
    
    logger.debug('GET request for branch', { module: 'API', action: 'GET_SETTINGS', branch: branchParam });

    // If prisma is not available, return defaults
    if (!prisma) {
      logger.warn('Prisma not available, returning defaults', { module: 'API', action: 'GET_SETTINGS' });
      return apiSuccess({
        branch: branchParam,
        logo_url: DEFAULT_LOGO,
        company_name: 'Fine & Country Zimbabwe',
        phone: '',
        email: '',
        address: '',
        principalAgentName: '',
        principalAgentEmail: '',
        fallback: true
      });
    }

    try {
      // Ensure table exists first
      await ensureTableExists();
    } catch (tableError: any) {
      logger.warn('Warning creating/checking table', { module: 'API', action: 'GET_SETTINGS', error: tableError.message });
    }

    try {
      // Get settings from database
      const settings = await prisma.companySettings.findFirst({
        where: { branch: branchParam }
      });

      if (settings) {
        logger.debug('Found settings for branch', { module: 'API', action: 'GET_SETTINGS', branch: branchParam });
        return apiSuccess(settings);
      }
    } catch (dbError: any) {
      logger.error('Database query error', dbError, { module: 'API', action: 'GET_SETTINGS' });
    }

    // Return default settings structure with requested branch
    // IMPORTANT: Same shared logo for ALL branches (UploadThing URL when uploaded, fallback otherwise)
    logger.debug('Returning default settings for branch', { module: 'API', action: 'GET_SETTINGS', branch: branchParam });
    const defaultSettings = {
      branch: branchParam,
      logo_url: DEFAULT_LOGO, // Shared logo for ALL branches (replaced by UploadThing URL when uploaded)
      company_name: 'Fine & Country Zimbabwe',
      phone: '',
      email: '',
      address: '',
      principalAgentName: '',
      principalAgentEmail: ''
    };
    return apiSuccess(defaultSettings);
  } catch (error: any) {
    logger.error('Unexpected GET error', error, { module: 'API', action: 'GET_SETTINGS' });
    const statusCode = error.message?.includes('connection') ? 503 : 500;
    return apiError(
      'Failed to retrieve settings',
      statusCode,
      ErrorCodes.INTERNAL_ERROR,
      { details: error.message }
    );
  }
}

/**
 * POST /api/admin/settings
 * Save company settings (logo URL, contact info, etc.)
 * 
 * Role-Based Access:
 * - Admin: Can update all settings including logo
 * - Non-Admin: 403 Forbidden
 */
export async function POST(request: NextRequest) {
  try {
    // If prisma is not available, return error
    if (!prisma) {
      logger.error('Prisma not available for POST', { module: 'API', action: 'POST_SETTINGS' });
      return apiError('Database connection not available', 503, ErrorCodes.DB_UNAVAILABLE);
    }

    // Use requireAdmin for consistent auth
    const authResult = await requireAdmin();
    if ('error' in authResult) {
      logger.warn('Admin auth failed', { module: 'API', action: 'POST_SETTINGS' });
      return authResult.error;
    }
    
    const { user } = authResult;
    logger.debug('Admin verified', { module: 'API', action: 'POST_SETTINGS', email: user.email, role: user.role });

    // Validate request body
    const validation = await validateRequest(request, settingsSchema, {
      module: 'API',
      action: 'POST_SETTINGS'
    });
    if (!validation.success) {
      return validation.error;
    }
    const {
      branch,
      logo_url,
      company_name,
      phone,
      email,
      address,
      principal_agent_name,
      principal_agent_email
    } = validation.data as any;

    logger.debug('Save request', { 
      module: 'API', 
      action: 'POST_SETTINGS',
      branch,
      hasLogoUrl: !!logo_url,
      logoUrlLength: logo_url?.length,
      userEmail: user.email
    });

    logger.debug('Permission check passed. Proceeding with save', { module: 'API', action: 'POST_SETTINGS', branch, userEmail: user.email });

    try {
      // Ensure table exists first
      await ensureTableExists();
    } catch (tableError: any) {
      logger.warn('Warning creating/checking table', { module: 'API', action: 'POST_SETTINGS', error: tableError.message });
    }

    try {
      // Try to find existing settings for this branch
      let settings = await prisma.companySettings.findFirst({
        where: { branch }
      });

      if (settings) {
        // Update existing
        logger.debug('Updating existing settings', { module: 'API', action: 'POST_SETTINGS', branch, currentLogoUrl: settings.logo_url, newLogoUrl: logo_url });
        
        settings = await prisma.companySettings.update({
          where: { id: settings.id },
          data: {
            logo_url: logo_url !== undefined ? logo_url : settings.logo_url,
            company_name: company_name || settings.company_name,
            phone: phone !== undefined ? phone : settings.phone,
            email: email !== undefined ? email : settings.email,
            address: address !== undefined ? address : settings.address,
            principalAgentName: principal_agent_name !== undefined ? (principal_agent_name || null) : settings.principalAgentName,
            principalAgentEmail: principal_agent_email !== undefined ? (principal_agent_email || null) : settings.principalAgentEmail,
            updatedAt: new Date()
          }
        });
        
        logger.info('Updated settings', { module: 'API', action: 'POST_SETTINGS', branch, newLogoUrl: settings.logo_url });
      } else {
        // Create new
        logger.debug('Creating new settings', { module: 'API', action: 'POST_SETTINGS', branch, logoUrl: logo_url });
        
        settings = await prisma.companySettings.create({
          data: {
            id: `settings-${branch}-${Date.now()}`,
            branch,
            logo_url: logo_url || null,
            company_name: company_name || 'Fine & Country Zimbabwe',
            phone: phone || null,
            email: email || null,
            address: address || null,
            principalAgentName: principal_agent_name || null,
            principalAgentEmail: principal_agent_email || null
          }
        });
        
        logger.info('Created new settings', { module: 'API', action: 'POST_SETTINGS', branch, logoUrl: settings.logo_url });
      }

      logger.info('Settings saved successfully', { module: 'API', action: 'POST_SETTINGS', branch, logoUrl: settings.logo_url });
      
      // Log for forensic tracking
      logger.debug('Logo update', {
        module: 'API',
        action: 'POST_SETTINGS',
        branch,
        oldLogoUrl: logo_url !== settings.logo_url ? 'changed' : 'same',
        newLogoUrl: settings.logo_url,
        updatedBy: user.email
      });
      
      return apiSuccess(settings);
    } catch (dbError: any) {
      logger.error('Database operation error', dbError, { module: 'API', action: 'POST_SETTINGS' });
      if (dbError.message?.includes('ECONNREFUSED') || dbError.code === 'ENOTFOUND') {
        return apiError('Database connection failed', 503, ErrorCodes.DB_UNAVAILABLE);
      }
      throw dbError;
    }
  } catch (error: any) {
    logger.error('Unexpected POST error', error, { module: 'API', action: 'POST_SETTINGS' });
    const statusCode = error.message?.includes('connection') ? 503 : 500;
    return apiError(
      'Failed to save settings',
      statusCode,
      ErrorCodes.INTERNAL_ERROR,
      { details: error.message }
    );
  }
}
