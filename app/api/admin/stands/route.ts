import { NextRequest, NextResponse } from "next/server";
import { requireRole } from "@/lib/access-control";
import prisma from "@/lib/prisma";
import { logger } from "@/lib/logger";
import { apiError, apiSuccess } from "@/lib/api-response";
import { ErrorCodes } from "@/lib/error-codes";
import { validateRequest } from "@/lib/validation/middleware";
import {
  bulkStandCreateSchema,
  standUpdateSchema,
} from "@/lib/validation/schemas";
import { z } from "zod";
import { Prisma } from "@prisma/client";

/**
 * Stands/Inventory API
 * - GET: Fetch stands with branch filtering
 * - POST: Create new stand
 * - PUT: Update stand (availability, reserved_by, etc.)
 * - DELETE: Archive stand (soft delete)
 * 
 * Access: ADMIN, MANAGER, ACCOUNT, DEVELOPER
 */

// Allowed roles for stands management
const ALLOWED_ROLES = ['ADMIN', 'MANAGER', 'ACCOUNT', 'DEVELOPER'];

export async function GET(request: NextRequest) {
  try {
    logger.info("GET /api/admin/stands called", {
      module: "API",
      action: "GET_STANDS",
    });

    const authResult = await requireRole(ALLOWED_ROLES);
    if (authResult.error) {
      return authResult.error;
    }
    const user = authResult.user;

    // Query parameters
    const branch = request.nextUrl.searchParams.get("branch") || user.branch;
    const status = request.nextUrl.searchParams.get("status");
    const project = request.nextUrl.searchParams.get("project");
    const clientId = request.nextUrl.searchParams.get("clientId");
    const developmentId = request.nextUrl.searchParams.get("developmentId");
    const nextAvailable = request.nextUrl.searchParams.get("nextAvailable"); // NEW: Get next available stand

    logger.debug("Query Parameters", {
      module: "API",
      action: "GET_STANDS",
      branch,
      status,
      project,
      clientId,
      developmentId,
      nextAvailable,
      userBranch: user.branch,
    });

    // NEW: Next Available Stand Logic (for reservation flow without GeoJSON)
    if (nextAvailable === "true" && developmentId) {
      logger.debug("Fetching next available stand for development", {
        module: "API",
        action: "GET_STANDS",
        developmentId,
      });

      const nextStand = await prisma.stand.findFirst({
        where: {
          developmentId,
          status: "AVAILABLE",
          branch: branch && branch !== "ALL" ? branch : undefined,
        },
        orderBy: { standNumber: "asc" }, // IMPORTANT: Sequential allocation
        include: {
          development: true,
        },
      });

      if (!nextStand) {
        return apiError("No available stands found", 404, ErrorCodes.NOT_FOUND);
      }

      logger.info("Next available stand found", {
        module: "API",
        action: "GET_STANDS",
        standId: nextStand.id,
        standNumber: nextStand.standNumber,
        development: nextStand.development?.name,
      });

      // Enrich with discount info
      const basePrice =
        typeof nextStand.price === "string"
          ? parseFloat(nextStand.price)
          : Number(nextStand.price);

      const discountPercent = nextStand.discountPercent
        ? typeof nextStand.discountPercent === "string"
          ? parseFloat(nextStand.discountPercent)
          : Number(nextStand.discountPercent)
        : null;

      const hasDiscount =
        discountPercent !== null &&
        discountPercent > 0 &&
        nextStand.discountActive !== false;

      const discountedPrice =
        hasDiscount && discountPercent
          ? basePrice * (1 - discountPercent / 100)
          : null;

      return apiSuccess({
        ...nextStand,
        basePrice,
        discountPercent: hasDiscount ? discountPercent : null,
        discountedPrice: discountedPrice
          ? Math.round(discountedPrice * 100) / 100
          : null,
        hasDiscount: !!hasDiscount,
      });
    }

    // Build where clause using Prisma's StandWhereInput
    const where: Prisma.StandWhereInput = {};
    // Branch filter (optional for cross-branch admin access)
    if (branch && branch !== "ALL") {
      where.branch = branch;
    }

    if (status) {
      // Support multiple statuses (comma-separated or array)
      const statuses = Array.isArray(status) ? status : status.split(",");
      const normalizedStatuses = statuses
        .map((s) => s.trim().toUpperCase())
        .filter((s) =>
          ["AVAILABLE", "RESERVED", "SOLD", "WITHDRAWN"].includes(s),
        );

      if (normalizedStatuses.length === 1) {
        where.status = normalizedStatuses[0];
      } else if (normalizedStatuses.length > 1) {
        where.status = { in: normalizedStatuses };
      }
    }

    // Note: 'project' field doesn't exist on Stand model, filtering by developmentId instead
    if (project) {
      where.developmentId = project;
    }

    if (developmentId) {
      where.developmentId = developmentId;
      logger.debug("Filtering stands by developmentId", {
        module: "API",
        action: "GET_STANDS",
        developmentId,
      });
    }

    // If clientId provided, filter by stands owned/reserved by this client
    if (clientId) {
      where.OR = [
        // Stands with active reservations for this client
        {
          reservations: {
            some: {
              clientId: clientId,
              status: { in: ["CONFIRMED", "PAYMENT_PENDING"] },
            },
          },
        },
        // Stands reserved by this client (legacy field)
        {
          reservedBy: clientId,
        },
      ];
      logger.debug("Filtering stands by clientId", {
        module: "API",
        action: "GET_STANDS",
        clientId,
      });
    }

    // Fetch stands with relationships
    const stands = await prisma.stand.findMany({
      where,
      include: {
        development: true,
        reservations: clientId
          ? {
            where: { clientId: clientId },
            include: { client: true, agent: true },
          }
          : false,
      },
      orderBy: { standNumber: "asc" },
    });

    logger.debug("Fetched stands", {
      module: "API",
      action: "GET_STANDS",
      count: stands.length,
      branch,
      status: status || "ALL",
      project: project || "ALL",
      developmentId,
    });

    // Enrich stands with discount information
    const enrichedStands = stands.map((stand: any) => {
      const basePrice =
        typeof stand.price === "string"
          ? parseFloat(stand.price)
          : Number(stand.price);

      const discountPercent = stand.discountPercent
        ? typeof stand.discountPercent === "string"
          ? parseFloat(stand.discountPercent)
          : Number(stand.discountPercent)
        : null;

      const hasDiscount =
        discountPercent !== null &&
        discountPercent > 0 &&
        stand.discountActive !== false;

      const discountedPrice =
        hasDiscount && discountPercent
          ? basePrice * (1 - discountPercent / 100)
          : null;

      return {
        ...stand,
        basePrice,
        discountPercent: hasDiscount ? discountPercent : null,
        discountedPrice: discountedPrice
          ? Math.round(discountedPrice * 100) / 100
          : null,
        hasDiscount: !!hasDiscount,
      };
    });

    return apiSuccess({
      stands: enrichedStands,
      metadata: {
        total: enrichedStands.length,
        branch,
      },
    });
  } catch (error: any) {
    logger.error("Stand fetch error", error, {
      module: "API",
      action: "GET_STANDS",
    });
    return apiError(
      error?.message || "Unknown error",
      500,
      ErrorCodes.FETCH_ERROR,
      { code: error?.code, meta: error?.meta },
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    logger.info("POST /api/admin/stands called", {
      module: "API",
      action: "POST_STANDS",
    });
    const authResult = await requireRole(ALLOWED_ROLES);
    if (authResult.error) {
      return authResult.error;
    }
    const user = authResult.user;

    // Validate request body
    const validation = await validateRequest(request, bulkStandCreateSchema, {
      module: "API",
      action: "POST_STANDS",
    });
    if (!validation.success) {
      return validation.error;
    }
    const data = validation.data;

    logger.debug("Bulk stand creation request", {
      module: "API",
      action: "POST_STANDS",
      developmentId: data.developmentId,
      count: data.standCount,
    });

    // Fetch development to get branch
    const development = await prisma.development.findUnique({
      where: { id: data.developmentId },
    });

    if (!development) {
      return apiError(
        "Development not found",
        404,
        ErrorCodes.DEVELOPMENT_NOT_FOUND,
      );
    }

    const branch = development.branch || user.branch || "Harare";
    const standCount = data.standCount;
    const prefix = data.standNumberPrefix || "";
    const startNumber = data.standNumberStart || 1;
    const defaultSize = data.defaultStandSize || 500;
    const pricePerSqm = data.pricePerSqm || 0;

    // Parse manual stand sizes from CSV string
    let sizes: number[] | undefined;
    if (data.manualStandSizes && typeof data.manualStandSizes === 'string' && data.manualStandSizes.trim()) {
      sizes = data.manualStandSizes
        .split(',')
        .map(s => parseFloat(s.trim()))
        .filter(s => !isNaN(s) && s > 0);
    }

    // Generate stand numbers
    const stands: any[] = [];
    for (let i = 0; i < standCount; i++) {
      const num = startNumber + i;
      const paddedNum = String(num).padStart(3, "0");
      // NORMALIZE: Ensure stand numbers are uppercase and trimmed
      const rawStandNumber = prefix ? `${prefix}${paddedNum}` : paddedNum;
      const standNumber = rawStandNumber.trim().toUpperCase();

      // Use manual sizes if provided, otherwise default
      let size = defaultSize;
      if (sizes && sizes.length > 0) {
        size = sizes[i % sizes.length];
      }

      const price = Math.round(size * pricePerSqm);

      stands.push({
        id: `stand-${data.developmentId}-${standNumber}-${Date.now()}-${i}`,
        standNumber,
        developmentId: data.developmentId,
        branch,
        price: price,
        pricePerSqm: pricePerSqm,
        sizeSqm: size,
        status: "AVAILABLE",
      });
    }

    logger.info("Creating stands", {
      module: "API",
      action: "POST_STANDS",
      count: stands.length,
      sample: stands[0]?.standNumber,
      branch,
    });

    // Bulk insert stands
    const createdStands = await prisma.stand.createMany({
      data: stands,
      skipDuplicates: true,
    });

    logger.info("Stands created", {
      module: "API",
      action: "POST_STANDS",
      count: createdStands.count,
      developmentId: data.developmentId,
      branch,
    });

    // Log activity
    try {
      await prisma.activityLog.create({
        data: {
          branch,
          userId: user.email,
          action: "CREATE_BULK",
          module: "STANDS",
          recordId: data.developmentId,
          description: `Bulk created ${createdStands.count} stands for development ${development.name}`,
          changes: JSON.stringify({
            standCount: createdStands.count,
            prefix,
            startNumber,
            defaultSize,
            pricePerSqm,
          }),
        },
      });
    } catch (logError) {
      logger.warn("Failed to log activity", {
        module: "API",
        action: "POST_STANDS",
        error: logError,
      });
    }

    return apiSuccess(
      {
        created: createdStands.count,
        developmentId: data.developmentId,
        branch,
      },
      201,
    );
  } catch (error: any) {
    logger.error("Stand creation error", error, {
      module: "API",
      action: "POST_STANDS",
    });
    return apiError(
      error?.message || "Unknown error",
      500,
      ErrorCodes.CREATE_ERROR,
    );
  }
}

export async function PUT(request: NextRequest) {
  try {
    logger.info("PUT /api/admin/stands called", {
      module: "API",
      action: "PUT_STANDS",
    });

    const authResult = await requireRole(ALLOWED_ROLES);
    if (authResult.error) {
      return authResult.error;
    }
    const user = authResult.user;

    // Validate request body
    const validation = await validateRequest(
      request,
      standUpdateSchema.extend({
        id: z.string().min(1, "Stand ID is required"),
      }),
      {
        module: "API",
        action: "PUT_STANDS",
      },
    );
    if (!validation.success) {
      return validation.error;
    }
    const data = validation.data;

    // Fetch existing stand
    const existingStand = await prisma.stand.findUnique({
      where: { id: data.id },
    });

    if (!existingStand) {
      return apiError("Stand not found", 404, ErrorCodes.STAND_NOT_FOUND);
    }

    // Update stand
    const updateData: any = {
      status: data.status !== undefined ? data.status : undefined,
      reservedBy: data.reservedBy !== undefined ? data.reservedBy : undefined
    };

    const updatedStand = await prisma.stand.update({
      where: { id: data.id },
      data: updateData,
      include: {
        development: true,
      },
    });

    // Log activity
    try {
      await prisma.activityLog.create({
        data: {
          branch: existingStand.branch,
          userId: user.email,
          action: "UPDATE",
          module: "STANDS",
          recordId: data.id,
          description: `Updated stand ${existingStand.standNumber}`,
          changes: JSON.stringify({
            before: existingStand,
            after: updatedStand,
          }),
        },
      });
    } catch (logError) {
      logger.warn("Failed to log activity", {
        module: "API",
        action: "PUT_STANDS",
        error: logError,
      });
    }

    logger.info("Stand updated", {
      module: "API",
      action: "PUT_STANDS",
      standId: updatedStand.id,
      standNumber: updatedStand.standNumber,
      status: updatedStand.status,
    });

    return apiSuccess(updatedStand);
  } catch (error: any) {
    logger.error("Stand update error", error, {
      module: "API",
      action: "PUT_STANDS",
    });
    return apiError(
      error?.message || "Unknown error",
      500,
      ErrorCodes.UPDATE_ERROR,
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    return apiError(
      "DELETE endpoint not yet implemented.",
      501,
      ErrorCodes.INTERNAL_ERROR,
    );
  } catch (error: any) {
    return apiError(
      error?.message || "Unknown error",
      500,
      ErrorCodes.INTERNAL_ERROR,
    );
  }
}
