import { updateUserPasswordWithHistory } from '@/lib/password-history';

jest.mock('@/lib/prisma', () => {
  const tx = {
    passwordHistory: { create: jest.fn() },
    user: { update: jest.fn() },
    session: { deleteMany: jest.fn() },
  };

  const prismaMock = {
    user: { findUnique: jest.fn() },
    passwordHistory: { findMany: jest.fn() },
    session: { deleteMany: jest.fn() },
    $transaction: jest.fn(async (fn: any) => fn(tx)),
    __tx: tx,
  };

  return {
    __esModule: true,
    prisma: prismaMock,
    default: prismaMock,
  };
});

jest.mock('bcryptjs', () => ({
  __esModule: true,
  default: {
    compare: jest.fn(),
    hash: jest.fn(),
  },
  compare: jest.fn(),
  hash: jest.fn(),
}));

describe('lib/password-history', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('rejects weak passwords (complexity)', async () => {
    const result = await updateUserPasswordWithHistory({
      userId: 'user-1',
      newPassword: 'weak',
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe('PASSWORD_COMPLEXITY');
    }
  });

  it('rejects reuse of current password', async () => {
    const prisma = (await import('@/lib/prisma')).default as any;
    const bcrypt = (await import('bcryptjs')) as any;

    prisma.user.findUnique.mockResolvedValue({ id: 'user-1', password: 'hash-current' });
    prisma.passwordHistory.findMany.mockResolvedValue([]);
    bcrypt.default.compare.mockResolvedValue(true);

    const result = await updateUserPasswordWithHistory({
      userId: 'user-1',
      newPassword: 'NewPass123',
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe('PASSWORD_REUSE');
    }
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('rejects reuse of a recent password from history', async () => {
    const prisma = (await import('@/lib/prisma')).default as any;
    const bcrypt = (await import('bcryptjs')) as any;

    prisma.user.findUnique.mockResolvedValue({ id: 'user-1', password: 'hash-current' });
    prisma.passwordHistory.findMany.mockResolvedValue([{ passwordHash: 'hash-old-1' }]);

    bcrypt.default.compare
      .mockResolvedValueOnce(false) // current hash compare
      .mockResolvedValueOnce(true); // history hash compare

    const result = await updateUserPasswordWithHistory({
      userId: 'user-1',
      newPassword: 'NewPass123',
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe('PASSWORD_REUSE');
    }
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('updates password, records history, and invalidates sessions', async () => {
    const prisma = (await import('@/lib/prisma')).default as any;
    const bcrypt = (await import('bcryptjs')) as any;

    prisma.user.findUnique.mockResolvedValue({ id: 'user-1', password: 'hash-current' });
    prisma.passwordHistory.findMany.mockResolvedValue([{ passwordHash: 'hash-old-1' }]);

    bcrypt.default.compare.mockResolvedValue(false);
    bcrypt.default.hash.mockResolvedValue('hash-new');

    const result = await updateUserPasswordWithHistory({
      userId: 'user-1',
      newPassword: 'NewPass123',
      extraUserUpdate: { resetToken: null },
    });

    expect(result.ok).toBe(true);
    expect(prisma.$transaction).toHaveBeenCalled();

    const tx = prisma.__tx;
    expect(tx.passwordHistory.create).toHaveBeenCalledWith({
      data: { userId: 'user-1', passwordHash: 'hash-current' },
    });
    expect(tx.user.update).toHaveBeenCalled();
    expect(tx.session.deleteMany).toHaveBeenCalledWith({ where: { userId: 'user-1' } });
  });
});
