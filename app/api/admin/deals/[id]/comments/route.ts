import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { requireAdmin, requireAgent, getAuthenticatedUser } from '@/lib/adminAuth';
import { logger } from '@/lib/logger';
import { apiError, apiSuccess } from '@/lib/api-response';
import { ErrorCodes } from '@/lib/error-codes';

/**
 * GET /api/admin/deals/[id]/comments
 * Get comments for a deal
 */
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    const authResult = await requireAdmin();
    if (authResult.error) return authResult.error;
    const user = authResult.user;

    const comments = await prisma.comment.findMany({
      where: { dealId: id },
      orderBy: { createdAt: 'desc' }
    });

    const userIds = Array.from(new Set(comments.map(comment => comment.userId)));
    const users = userIds.length > 0
      ? await prisma.user.findMany({
          where: { id: { in: userIds } },
          select: { id: true, name: true, email: true }
        })
      : [];
    const userMap = new Map(users.map(user => [user.id, user]));

    const commentIds = comments.map(comment => comment.id);
    const mentionRows = commentIds.length > 0
      ? await prisma.commentMentions.findMany({
          where: { A: { in: commentIds } }
        })
      : [];
    const mentionUserIds = Array.from(new Set(mentionRows.map(row => row.B)));
    const mentionUsers = mentionUserIds.length > 0
      ? await prisma.user.findMany({
          where: { id: { in: mentionUserIds } },
          select: { id: true, name: true }
        })
      : [];
    const mentionUserMap = new Map(mentionUsers.map(user => [user.id, user]));
    const mentionsByComment = new Map<string, Array<{ id: string; name: string | null }>>();
    for (const row of mentionRows) {
      const mentionUser = mentionUserMap.get(row.B);
      if (!mentionUser) continue;
      const list = mentionsByComment.get(row.A) || [];
      list.push(mentionUser);
      mentionsByComment.set(row.A, list);
    }

    const enrichedComments = comments.map(comment => ({
      ...comment,
      user: userMap.get(comment.userId) || null,
      mentions: mentionsByComment.get(comment.id) || []
    }));

    return apiSuccess(enrichedComments);
  } catch (error: any) {
    logger.error('Error fetching comments', error, { module: 'API', action: 'GET_DEAL_COMMENTS' });
    return apiError('Failed to fetch comments', 500, ErrorCodes.FETCH_ERROR);
  }
}

/**
 * POST /api/admin/deals/[id]/comments
 * Create a comment on a deal
 */
export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    const authResult = await requireAdmin();
    if (authResult.error) return authResult.error;
    const user = authResult.user;

    const body = await request.json();
    const { content, mentionedUserIds, attachments } = body;

    if (!content) {
      return apiError('Comment content is required', 400, ErrorCodes.VALIDATION_ERROR);
    }

    const comment = await prisma.comment.create({
      data: {
        dealId: id,
        userId: user.id,
        content,
        attachments: attachments || []
      }
    });

    if (Array.isArray(mentionedUserIds) && mentionedUserIds.length > 0) {
      await prisma.commentMentions.createMany({
        data: mentionedUserIds.map((mentionId: string) => ({
          A: comment.id,
          B: mentionId
        })),
        skipDuplicates: true
      });
    }

    const [commentUser, mentionUsers] = await Promise.all([
      prisma.user.findUnique({
        where: { id: user.id },
        select: { id: true, name: true, email: true }
      }),
      Array.isArray(mentionedUserIds) && mentionedUserIds.length > 0
        ? prisma.user.findMany({
            where: { id: { in: mentionedUserIds } },
            select: { id: true, name: true }
          })
        : Promise.resolve([])
    ]);

    return apiSuccess(
      {
        ...comment,
        user: commentUser || null,
        mentions: mentionUsers
      },
      201
    );
  } catch (error: any) {
    logger.error('Error creating comment', error, { module: 'API', action: 'POST_DEAL_COMMENTS' });
    return apiError('Failed to create comment', 500, ErrorCodes.CREATE_ERROR);
  }
}
