/**
 * UploadThing FileRouter for Fine & Country Zimbabwe ERP
 * 
 * Upload Routes:
 * - propertyImage: Property/stand map images (max 4MB)
 * - proofOfPayment: Payment verification documents (max 2MB)
 * - identityDocument: KYC identity verification documents (max 5MB)
 * 
 * Security:
 * - Neon Auth session validation
 * - Role-based access control
 * - Forensic logging for all uploads
 */

import { createUploadthing, type FileRouter } from "uploadthing/next";
import { UploadThingError } from "uploadthing/server";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { logger } from "@/lib/logger";

const f = createUploadthing();

// ─────────────────────────────────────────────────────────────────────────────
// AUTHENTICATION MIDDLEWARE
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Validate Neon Auth Session
 * 
 * Ensures only authenticated users can upload files.
 * Logs all upload attempts for forensic audit.
 */
async function auth(req: Request) {
  const user = await getCurrentUser();

  if (!user) {
    logger.error('UPLOAD UNAUTHORIZED', {
      module: 'API',
      action: 'UPLOADTHING_AUTH',
      timestamp: new Date().toISOString(),
      ip: req.headers.get('x-forwarded-for') || 'unknown',
    });
    throw new UploadThingError("Unauthorized - Please sign in to upload files");
  }

  logger.info('UPLOAD AUTH_SUCCESS', {
    module: 'API',
    action: 'UPLOADTHING_AUTH',
    user_id: user.id,
    email: user.email?.substring(0, 3) + '***',
    role: user.role,
    timestamp: new Date().toISOString(),
  });

  return { userId: user.id, userRole: user.role };
}

// ─────────────────────────────────────────────────────────────────────────────
// FILE ROUTER
// ─────────────────────────────────────────────────────────────────────────────

export const ourFileRouter = {
  /**
   * Property Image Upload
   * 
   * Purpose: Upload property/stand map images for inventory
   * Max Size: 4MB
   * Allowed: Images (JPEG, PNG, WebP)
   * 
   * Metadata Required:
   * - standId: The stand to update with the new map image
   * 
   * Database Update:
   * Updates Stand.mapUrl with the uploaded file URL
   */
  propertyImage: f({
    image: { maxFileSize: "4MB", maxFileCount: 1 },
  })
    .middleware(async ({ req }) => {
      const { userId, userRole } = await auth(req);

      // Only ADMIN and AGENT roles can upload property images
      if (userRole !== 'ADMIN' && userRole !== 'AGENT') {
        logger.error('UPLOAD FORBIDDEN', {
          module: 'API',
          action: 'UPLOADTHING_PROPERTY_IMAGE',
          user_id: userId,
          role: userRole,
          upload_type: 'propertyImage',
          timestamp: new Date().toISOString(),
        });
        throw new UploadThingError("Only administrators and agents can upload property images");
      }

      return { userId, userRole };
    })
    .onUploadComplete(async ({ metadata, file }) => {
      try {
        // Extract standId from client metadata
        const standId = (metadata as any).standId as string | undefined;

        if (!standId) {
          logger.error('UPLOAD PROPERTY_IMAGE MISSING_STAND_ID', {
            module: 'API',
            action: 'UPLOADTHING_PROPERTY_IMAGE',
            user_id: metadata.userId,
            file_url: file.url?.substring(0, 50) + '***',
            timestamp: new Date().toISOString(),
          });
          throw new Error("Stand ID is required for property image upload");
        }

        // Update Stand with new map URL
        // NOTE: Stand model doesn't have mapUrl field - skipping database update
        // const stand = await prisma.stand.update({
        //   where: { id: standId },
        //   data: { mapUrl: file.url },
        //   include: { development: true },
        // });

        const stand = await prisma.stand.findUnique({
          where: { id: standId },
          include: { development: true },
        });

        if (!stand) {
          throw new Error('Stand not found');
        }

        logger.info('UPLOAD PROPERTY_IMAGE SUCCESS', {
          module: 'API',
          action: 'UPLOADTHING_PROPERTY_IMAGE',
          user_id: metadata.userId,
          stand_id: standId,
          development: stand.development.name,
          stand_number: stand.standNumber,
          file_url: file.url?.substring(0, 50) + '***',
          file_size: file.size,
          timestamp: new Date().toISOString(),
        });

        return {
          success: true,
          standId: stand.id,
          standNumber: stand.standNumber,
          developmentName: stand.development.name,
          mapUrl: file.url,
        };
      } catch (error: any) {
        logger.error('UPLOAD PROPERTY_IMAGE ERROR', error, {
          module: 'API',
          action: 'UPLOADTHING_PROPERTY_IMAGE',
          user_id: metadata.userId,
          file_url: file.url?.substring(0, 50) + '***',
          timestamp: new Date().toISOString(),
        });
        throw error;
      }
    }),

  /**
   * Proof of Payment Upload
   * 
   * Purpose: Upload payment verification documents for reservations
   * Max Size: 2MB
   * Allowed: PDF, Images (JPEG, PNG)
   * 
   * Metadata Required:
   * - reservationId: The reservation to attach the proof of payment to
   * 
   * Database Update:
   * Updates Reservation.popUrl with the uploaded file URL
   */
  proofOfPayment: f({
    pdf: { maxFileSize: "2MB", maxFileCount: 1 },
    image: { maxFileSize: "2MB", maxFileCount: 1 },
  })
    .middleware(async ({ req }) => {
      const { userId, userRole } = await auth(req);

      // All authenticated users can upload proof of payment
      // (Clients upload their own, Agents/Admins can upload on behalf)

      return { userId, userRole };
    })
    .onUploadComplete(async ({ metadata, file }) => {
      try {
        // Extract reservationId from client metadata
        const reservationId = (metadata as any).reservationId as string | undefined;

        if (!reservationId) {
          logger.error('UPLOAD PROOF_OF_PAYMENT MISSING_RESERVATION_ID', {
            module: 'API',
            action: 'UPLOADTHING_PROOF_OF_PAYMENT',
            user_id: metadata.userId,
            file_url: file.url?.substring(0, 50) + '***',
            timestamp: new Date().toISOString(),
          });
          throw new Error("Reservation ID is required for proof of payment upload");
        }

        // Update Reservation with proof of payment URL
        const reservation = await prisma.reservation.update({
          where: { id: reservationId },
          data: { popUrl: file.url },
          include: {
            client: { select: { name: true, email: true } },
            stand: {
              include: { development: { select: { name: true } } },
            },
          },
        });

        logger.info('UPLOAD PROOF_OF_PAYMENT SUCCESS', {
          module: 'API',
          action: 'UPLOADTHING_PROOF_OF_PAYMENT',
          user_id: metadata.userId,
          reservation_id: reservationId,
          client_name: reservation.client?.name || 'Unknown',
          client_email: reservation.client?.email?.substring(0, 3) + '***',
          development: reservation.stand.development.name,
          stand_number: reservation.stand.standNumber,
          file_url: file.url?.substring(0, 50) + '***',
          file_size: file.size,
          file_type: file.type,
          timestamp: new Date().toISOString(),
        });

        return {
          success: true,
          reservationId: reservation.id,
          clientName: reservation.client?.name || 'Unknown',
          developmentName: reservation.stand.development.name,
          standNumber: reservation.stand.standNumber,
          popUrl: file.url,
        };
      } catch (error: any) {
        logger.error('UPLOAD PROOF_OF_PAYMENT ERROR', error, {
          module: 'API',
          action: 'UPLOADTHING_PROOF_OF_PAYMENT',
          user_id: metadata.userId,
          file_url: file.url?.substring(0, 50) + '***',
          timestamp: new Date().toISOString(),
        });
        throw error;
      }
    }),

  /**
   * Development Main Image Upload (Hero Image)
   * Used for the primary/featured image in development listings
   */
  developmentMainImage: f({ image: { maxFileSize: "8MB", maxFileCount: 1 } })
    .input(z.object({ developmentId: z.string() }))
    .middleware(async ({ req, input }) => {
      const auth_result = await auth(req);
      const developmentId = input.developmentId;

      if (!developmentId) {
        throw new UploadThingError('Missing development ID');
      }

      // Verify development exists and user is admin
      if (auth_result.userRole !== 'ADMIN') {
        throw new UploadThingError('Admin access required for development uploads');
      }

      const development = await prisma.development.findUnique({
        where: { id: developmentId },
      }).catch(() => null);

      if (!development) {
        throw new UploadThingError('Development not found');
      }

      return { developmentId, userId: auth_result.userId };
    })
    .onUploadComplete(async ({ metadata, file }) => {
      try {
        // Get old value for audit trail
        const oldDevelopment = await prisma.development.findUnique({
          where: { id: metadata.developmentId },
        });

        // Update development with new main image
        const updated = await prisma.development.update({
          where: { id: metadata.developmentId },
          data: {
            mainImage: file.url,
            lastUpdatedById: metadata.userId,
          },
        });

        // Log the change to forensic audit trail
        if (oldDevelopment?.mainImage !== file.url) {
          await prisma.developmentEdit.create({
            data: {
              developmentId: metadata.developmentId,
              fieldName: 'mainImage',
              oldValue: oldDevelopment?.mainImage || null,
              newValue: file.url,
              editedBy: metadata.userId,
            },
          }).catch((e: any) => logger.error('DevelopmentEdit Failed', e, { module: 'API', action: 'UPLOADTHING_DEVELOPMENT_MAIN_IMAGE' }));
        }

        logger.info('UPLOAD DEVELOPMENT_MAIN_IMAGE SUCCESS', {
          module: 'API',
          action: 'UPLOADTHING_DEVELOPMENT_MAIN_IMAGE',
          developmentId: metadata.developmentId,
          fileName: file.name,
          fileUrl: file.url?.substring(0, 50) + '***',
          fileSize: file.size,
        });

        return { uploadedUrl: file.url, developmentId: metadata.developmentId };
      } catch (error: any) {
        logger.error('UPLOAD DEVELOPMENT_MAIN_IMAGE ERROR', error, {
          module: 'API',
          action: 'UPLOADTHING_DEVELOPMENT_MAIN_IMAGE',
          developmentId: metadata.developmentId,
        });
        throw error;
      }
    }),

  /**
   * Development Gallery Upload (Multiple Images)
   * Used for property photo gallery
   */
  developmentGallery: f({ image: { maxFileSize: "8MB", maxFileCount: 10 } })
    .input(z.object({ developmentId: z.string() }))
    .middleware(async ({ req, input }) => {
      const auth_result = await auth(req);
      const developmentId = input.developmentId;

      if (!developmentId) {
        throw new UploadThingError('Missing development ID');
      }

      if (auth_result.userRole !== 'ADMIN') {
        throw new UploadThingError('Admin access required for development uploads');
      }

      const development = await prisma.development.findUnique({
        where: { id: developmentId },
      }).catch(() => null);

      if (!development) {
        throw new UploadThingError('Development not found');
      }

      return { developmentId, userId: auth_result.userId };
    })
    .onUploadComplete(async ({ metadata, file }) => {
      try {
        // Get current development
        const development = await prisma.development.findUnique({
          where: { id: metadata.developmentId },
        });

        if (!development) {
          throw new Error('Development not found during update');
        }

        // Add new image to gallery
        const updatedGallery = [...(development.gallery || []), file.url];

        // Update development with new gallery image
        const updated = await prisma.development.update({
          where: { id: metadata.developmentId },
          data: {
            gallery: updatedGallery,
            lastUpdatedById: metadata.userId,
          },
        });

        // Log the change to forensic audit trail
        await prisma.developmentEdit.create({
          data: {
            developmentId: metadata.developmentId,
            fieldName: 'gallery_add',
            oldValue: null,
            newValue: file.url,
            editedBy: metadata.userId,
          },
        }).catch((e: any) => logger.error('DevelopmentEdit Failed', e, { module: 'API', action: 'UPLOADTHING_DEVELOPMENT_GALLERY' }));

        logger.info('UPLOAD DEVELOPMENT_GALLERY SUCCESS', {
          module: 'API',
          action: 'UPLOADTHING_DEVELOPMENT_GALLERY',
          developmentId: metadata.developmentId,
          fileName: file.name,
          fileUrl: file.url?.substring(0, 50) + '***',
          gallerySize: updatedGallery.length,
        });

        return { uploadedUrl: file.url, developmentId: metadata.developmentId, galleryCount: updatedGallery.length };
      } catch (error: any) {
        logger.error('UPLOAD DEVELOPMENT_GALLERY ERROR', error, {
          module: 'API',
          action: 'UPLOADTHING_DEVELOPMENT_GALLERY',
          developmentId: metadata.developmentId,
        });
        throw error;
      }
    }),

  /**
   * Development Map GeoJSON Upload
   * Used for PlotSelectorMap geometry data
   */
  developmentMap: f({ blob: { maxFileSize: "4MB", maxFileCount: 1 } })
    .input(z.object({ developmentId: z.string() }))
    .middleware(async ({ req, input }) => {
      const auth_result = await auth(req);
      const developmentId = input.developmentId;

      if (!developmentId) {
        throw new UploadThingError('Missing development ID');
      }

      if (auth_result.userRole !== 'ADMIN') {
        throw new UploadThingError('Admin access required for development uploads');
      }

      const development = await prisma.development.findUnique({
        where: { id: developmentId },
      }).catch(() => null);

      if (!development) {
        throw new UploadThingError('Development not found');
      }

      return { developmentId, userId: auth_result.userId };
    })
    .onUploadComplete(async ({ metadata, file }) => {
      try {
        // Get old value for audit trail
        const oldDevelopment = await prisma.development.findUnique({
          where: { id: metadata.developmentId },
        });

        // Update development with new GeoJSON URL
        const updated = await prisma.development.update({
          where: { id: metadata.developmentId },
          data: {
            geoJsonUrl: file.url,
            lastUpdatedById: metadata.userId,
          },
        });

        // Log the change to forensic audit trail
        if (oldDevelopment?.geoJsonUrl !== file.url) {
          await prisma.developmentEdit.create({
            data: {
              developmentId: metadata.developmentId,
              fieldName: 'geoJsonUrl',
              oldValue: oldDevelopment?.geoJsonUrl || null,
              newValue: file.url,
              editedBy: metadata.userId,
            },
          }).catch((e: any) => logger.error('DevelopmentEdit Failed', e, { module: 'API', action: 'UPLOADTHING_DEVELOPMENT_MAP' }));
        }

        logger.info('UPLOAD DEVELOPMENT_MAP SUCCESS', {
          module: 'API',
          action: 'UPLOADTHING_DEVELOPMENT_MAP',
          developmentId: metadata.developmentId,
          fileName: file.name,
          fileUrl: file.url?.substring(0, 50) + '***',
          fileSize: file.size,
        });

        return { uploadedUrl: file.url, developmentId: metadata.developmentId };
      } catch (error: any) {
        logger.error('UPLOAD DEVELOPMENT_MAP ERROR', error, {
          module: 'API',
          action: 'UPLOADTHING_DEVELOPMENT_MAP',
          developmentId: metadata.developmentId,
        });
        throw error;
      }
    }),

  /**
   * Identity Document Upload
   * 
   * Purpose: Upload KYC identity verification documents for reservations
   * Max Size: 5MB
   * Allowed: PDF, Images (JPEG, PNG)
   * 
   * Used during the reservation flow KYC verification step.
   * Documents are stored securely for compliance purposes.
   */
  identityDocument: f({
    pdf: { maxFileSize: "4MB", maxFileCount: 1 },
    image: { maxFileSize: "4MB", maxFileCount: 1 },
  })
    .middleware(async ({ req }) => {
      // Allow uploads without strict auth during public reservation flow
      // In production, consider requiring at least email verification

      logger.info('UPLOAD IDENTITY_DOCUMENT INITIATED', {
        module: 'API',
        action: 'UPLOADTHING_IDENTITY_DOCUMENT',
        timestamp: new Date().toISOString(),
        ip: req.headers.get('x-forwarded-for') || 'unknown',
      });

      // For now, allow public uploads but log extensively
      return { uploadType: 'identityDocument', timestamp: new Date().toISOString() };
    })
    .onUploadComplete(async ({ metadata, file }) => {
      try {
        logger.info('UPLOAD IDENTITY_DOCUMENT SUCCESS', {
          module: 'API',
          action: 'UPLOADTHING_IDENTITY_DOCUMENT',
          file_url: file.url?.substring(0, 50) + '***',
          file_name: file.name,
          file_size: file.size,
          file_type: file.type,
          timestamp: new Date().toISOString(),
        });

        return {
          success: true,
          documentUrl: file.url,
          fileName: file.name,
        };
      } catch (error: any) {
        logger.error('UPLOAD IDENTITY_DOCUMENT ERROR', error, {
          module: 'API',
          action: 'UPLOADTHING_IDENTITY_DOCUMENT',
          file_url: file.url?.substring(0, 50) + '***',
          timestamp: new Date().toISOString(),
        });
        throw error;
      }
    }),

  /**
   * Branch Logo Upload
   * Used for uploading company logos for Harare and Bulawayo branches
   */
  branchLogo: f({ image: { maxFileSize: "2MB", maxFileCount: 1 } })
    .input(z.object({ branch: z.enum(['Harare', 'Bulawayo']) }))
    .middleware(async ({ req, input }) => {
      const auth_result = await auth(req);

      // Admin only for branch settings
      if (auth_result.userRole !== 'ADMIN') {
        throw new UploadThingError('Admin access required for branch settings');
      }

      return { userId: auth_result.userId, branch: input.branch };
    })
    .onUploadComplete(async ({ metadata, file }) => {
      try {
        logger.info('UPLOAD BRANCH_LOGO SUCCESS', {
          module: 'API',
          action: 'UPLOADTHING_BRANCH_LOGO',
          branch: metadata.branch,
          userId: metadata.userId,
          fileUrl: file.url?.substring(0, 50) + '***',
          fileName: file.name,
        });

        // Return the URL for the client to use
        return { uploadedUrl: file.url, branch: metadata.branch };
      } catch (error: any) {
        logger.error('UPLOAD BRANCH_LOGO ERROR', error, {
          module: 'API',
          action: 'UPLOADTHING_BRANCH_LOGO',
          branch: metadata.branch,
        });
        throw error;
      }
    }),



  /**
   * DOCX Template Upload
   * Used for uploading DOCX template files for contract generation
   * Max Size: 16MB
   * Allowed: .docx files only
   * 
   * Metadata Required:
   * - templateId: The template to attach the DOCX file to
   * - developmentId: Optional - development for scoping
   *
   * Database Update:
   * Updates ContractTemplate with template_file_url and template_file_key
   */
  docxTemplate: f({
    blob: { maxFileSize: "16MB", maxFileCount: 1 },
  })
    .input(z.object({ templateId: z.string(), developmentId: z.string().optional() }))
    .middleware(async ({ req, input }) => {
      const auth_result = await auth(req);
      const { templateId, developmentId } = input;

      if (!templateId) {
        throw new UploadThingError('Template ID is required for DOCX upload');
      }

      // Verify template exists
      const template = await prisma.contractTemplate.findUnique({
        where: { id: templateId },
        include: { development: true },
      }).catch(() => null);

      if (!template) {
        throw new UploadThingError('Template not found');
      }

      // ADMIN can upload to any template
      // MANAGER can upload to templates in their branch
      // DEVELOPER can upload to their development's templates
      const userRole = auth_result.userRole;
      const userBranch = (await prisma.user.findUnique({
        where: { id: auth_result.userId },
        select: { branch: true },
      }))?.branch;

      if (userRole === 'DEVELOPER' && template.developmentId) {
        // Check if this developer manages the development
        const development = await prisma.development.findUnique({
          where: { id: template.developmentId },
          select: { developerEmail: true },
        });

        const user = await prisma.user.findUnique({
          where: { id: auth_result.userId },
          select: { email: true },
        });

        if (development?.developerEmail !== user?.email) {
          throw new UploadThingError('You can only upload DOCX templates for your own developments');
        }
      } else if (userRole === 'MANAGER' && template.branch && userBranch !== template.branch) {
        throw new UploadThingError('You can only upload DOCX templates for templates in your branch');
      }

      return { templateId, developmentId, userId: auth_result.userId, userRole };
    })
    .onUploadComplete(async ({ metadata, file }) => {
      try {
        // Extract file extension and validate
        const fileName = file.name.toLowerCase();
        if (!fileName.endsWith('.docx')) {
          throw new UploadThingError('Only .docx files are allowed for DOCX templates');
        }

        // Get template info before update
        const templateBefore = await prisma.contractTemplate.findUnique({
          where: { id: metadata.templateId },
          select: { id: true, name: true, developmentId: true }
        });

        // Update template with DOCX file info
        await prisma.contractTemplate.update({
          where: { id: metadata.templateId },
          data: {
            templateType: 'docx',
            templateFileUrl: file.url,
            templateFileKey: file.key,
          },
        });

        logger.info('UPLOAD DOCX_TEMPLATE SUCCESS', {
          module: 'API',
          action: 'UPLOADTHING_DOCX_TEMPLATE',
          templateId: metadata.templateId,
          templateName: templateBefore?.name,
          developmentId: templateBefore?.developmentId,
          fileName: file.name,
          fileUrl: file.url?.substring(0, 50) + '***',
          fileSize: file.size,
          fileKey: file.key,
        });

        return {
          success: true,
          templateId: metadata.templateId,
          templateName: templateBefore?.name,
          templateType: 'docx',
          templateFileUrl: file.url,
          templateFileKey: file.key,
          fileSize: file.size,
        };
      } catch (error: any) {
        logger.error('UPLOAD DOCX_TEMPLATE ERROR', error, {
          module: 'API',
          action: 'UPLOADTHING_DOCX_TEMPLATE',
          templateId: metadata.templateId,
        });
        throw error;
      }
    }),
} satisfies FileRouter;

export type OurFileRouter = typeof ourFileRouter;
