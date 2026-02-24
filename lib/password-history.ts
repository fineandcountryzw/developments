import bcrypt from 'bcryptjs';
import type { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';

export const DEFAULT_PASSWORD_HISTORY_COUNT = 5;

export function getPasswordHistoryCount(): number {
  const raw = process.env.PASSWORD_HISTORY_COUNT;
  const parsed = raw ? Number(raw) : NaN;
  if (!Number.isFinite(parsed) || parsed <= 0) return DEFAULT_PASSWORD_HISTORY_COUNT;
  return Math.floor(parsed);
}

export function validatePasswordComplexity(password: string): { ok: true } | { ok: false; message: string } {
  if (password.length < 8) return { ok: false, message: 'Password must be at least 8 characters long' };
  if (!/[A-Z]/.test(password)) return { ok: false, message: 'Password must contain at least one uppercase letter' };
  if (!/[a-z]/.test(password)) return { ok: false, message: 'Password must contain at least one lowercase letter' };
  if (!/[0-9]/.test(password)) return { ok: false, message: 'Password must contain at least one number' };
  return { ok: true };
}

export type PasswordUpdateResult =
  | { ok: true }
  | { ok: false; code: 'PASSWORD_REUSE' | 'PASSWORD_COMPLEXITY'; message: string };

type PrismaTx = Pick<
  typeof prisma,
  'user' | 'passwordHistory' | 'session' | '$transaction'
>;

async function isReusedPassword(params: {
  userPasswordHash: string | null;
  historyHashes: string[];
  newPassword: string;
}): Promise<boolean> {
  const { userPasswordHash, historyHashes, newPassword } = params;
  if (userPasswordHash && (await bcrypt.compare(newPassword, userPasswordHash))) return true;
  for (const hash of historyHashes) {
    if (await bcrypt.compare(newPassword, hash)) return true;
  }
  return false;
}

export async function updateUserPasswordWithHistory(params: {
  userId: string;
  newPassword: string;
  extraUserUpdate?: Prisma.UserUpdateInput;
  historyCount?: number;
  prismaClient?: PrismaTx;
  invalidateSessions?: boolean;
}): Promise<PasswordUpdateResult> {
  const {
    userId,
    newPassword,
    extraUserUpdate,
    historyCount = getPasswordHistoryCount(),
    prismaClient = prisma,
    invalidateSessions = true,
  } = params;

  const complexity = validatePasswordComplexity(newPassword);
  if (!complexity.ok) {
    return { ok: false, code: 'PASSWORD_COMPLEXITY', message: complexity.message };
  }

  const user = await prismaClient.user.findUnique({
    where: { id: userId },
    select: { id: true, password: true },
  });

  if (!user) {
    return { ok: false, code: 'PASSWORD_COMPLEXITY', message: 'User not found' };
  }

  const history = await prismaClient.passwordHistory.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
    take: Math.max(1, historyCount),
    select: { passwordHash: true },
  });

  const reused = await isReusedPassword({
    userPasswordHash: user.password ?? null,
    historyHashes: history.map((h) => h.passwordHash),
    newPassword,
  });
  if (reused) {
    return { ok: false, code: 'PASSWORD_REUSE', message: 'You cannot reuse a recently used password' };
  }

  const hashedPassword = await bcrypt.hash(newPassword, 12);
  const now = new Date();

  await prismaClient.$transaction(async (tx) => {
    if (user.password) {
      await tx.passwordHistory.create({
        data: {
          userId,
          passwordHash: user.password,
        },
      });
    }

    await tx.user.update({
      where: { id: userId },
      data: {
        ...(extraUserUpdate || {}),
        password: hashedPassword,
        passwordChangedAt: now,
      },
    });

    if (invalidateSessions) {
      await tx.session.deleteMany({ where: { userId } });
    }
  });

  return { ok: true };
}

