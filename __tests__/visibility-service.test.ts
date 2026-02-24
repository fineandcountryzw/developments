/**
 * Visibility Service Tests
 * 
 * These tests verify that the central visibility service correctly scopes
 * developments and stands based on user role.
 */

import { 
  getVisibleDevelopmentIds, 
  getVisibleStandIds,
  canUserAccessDevelopment,
  canUserAccessStand,
  VisibilityUser 
} from '../lib/services/visibility-service';

// Mock Prisma
jest.mock('../lib/prisma', () => ({
  __esModule: true,
  default: {
    development: {
      findMany: jest.fn(),
    },
    stand: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
    },
    client: {
      findFirst: jest.fn(),
    },
    reservation: {
      findMany: jest.fn(),
    },
  },
}));

import prisma from '../lib/prisma';

const mockPrisma = prisma as jest.Mocked<typeof prisma>;

describe('Visibility Service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('getVisibleDevelopmentIds', () => {
    it('ADMIN sees all developments', async () => {
      const adminUser: VisibilityUser = {
        id: 'admin-1',
        email: 'admin@example.com',
        role: 'ADMIN',
        branch: 'Harare'
      };

      (mockPrisma.development.findMany as jest.Mock).mockResolvedValue([
        { id: 'dev-1' },
        { id: 'dev-2' },
        { id: 'dev-3' },
      ]);

      const result = await getVisibleDevelopmentIds(adminUser);

      expect(result.developmentIds).toHaveLength(3);
      expect(result.scope).toBe('all');
      expect(mockPrisma.development.findMany).toHaveBeenCalledWith({
        where: {},
        select: { id: true }
      });
    });

    it('MANAGER sees only branch-scoped developments', async () => {
      const managerUser: VisibilityUser = {
        id: 'manager-1',
        email: 'manager@example.com',
        role: 'MANAGER',
        branch: 'Harare'
      };

      (mockPrisma.development.findMany as jest.Mock).mockResolvedValue([
        { id: 'dev-1' },
        { id: 'dev-2' },
      ]);

      const result = await getVisibleDevelopmentIds(managerUser);

      expect(result.scope).toBe('branch');
      expect(mockPrisma.development.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ branch: 'Harare' })
        })
      );
    });

    it('DEVELOPER sees only owned developments', async () => {
      const developerUser: VisibilityUser = {
        id: 'dev-user-1',
        email: 'developer@example.com',
        role: 'DEVELOPER',
        branch: null
      };

      (mockPrisma.development.findMany as jest.Mock).mockResolvedValue([
        { id: 'dev-1' },
      ]);

      const result = await getVisibleDevelopmentIds(developerUser);

      expect(result.scope).toBe('owned');
      expect(mockPrisma.development.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ developerEmail: 'developer@example.com' })
        })
      );
    });

    it('ACCOUNT sees all developments (optionally branch-scoped)', async () => {
      const accountUser: VisibilityUser = {
        id: 'account-1',
        email: 'accounts@example.com',
        role: 'ACCOUNT',
        branch: 'Harare'
      };

      (mockPrisma.development.findMany as jest.Mock).mockResolvedValue([
        { id: 'dev-1' },
        { id: 'dev-2' },
        { id: 'dev-3' },
      ]);

      const result = await getVisibleDevelopmentIds(accountUser);

      expect(result.developmentIds).toHaveLength(3);
      expect(['all', 'branch']).toContain(result.scope);
    });

    it('CLIENT sees only associated developments', async () => {
      const clientUser: VisibilityUser = {
        id: 'client-1',
        email: 'client@example.com',
        role: 'CLIENT',
        branch: null
      };

      (mockPrisma.client.findFirst as jest.Mock).mockResolvedValue({
        id: 'client-db-1'
      });

      (mockPrisma.reservation.findMany as jest.Mock).mockResolvedValue([
        { stand: { developmentId: 'dev-1' } },
        { stand: { developmentId: 'dev-1' } }, // duplicate
        { stand: { developmentId: 'dev-2' } },
      ]);

      const result = await getVisibleDevelopmentIds(clientUser);

      expect(result.scope).toBe('associated');
      // Should deduplicate
      expect(result.developmentIds).toEqual(expect.arrayContaining(['dev-1', 'dev-2']));
    });

    it('Unknown role gets no developments', async () => {
      const unknownUser: VisibilityUser = {
        id: 'unknown-1',
        email: 'unknown@example.com',
        role: 'UNKNOWN_ROLE',
        branch: null
      };

      const result = await getVisibleDevelopmentIds(unknownUser);

      expect(result.developmentIds).toHaveLength(0);
      expect(result.scope).toBe('none');
    });

    it('Includes debug info when requested', async () => {
      const adminUser: VisibilityUser = {
        id: 'admin-1',
        email: 'admin@example.com',
        role: 'ADMIN',
        branch: 'Harare'
      };

      (mockPrisma.development.findMany as jest.Mock).mockResolvedValue([
        { id: 'dev-1' },
      ]);

      const result = await getVisibleDevelopmentIds(adminUser, { includeDebug: true });

      expect(result.debug).toBeDefined();
      expect(result.debug?.userId).toBe('admin-1');
      expect(result.debug?.role).toBe('ADMIN');
      expect(result.debug?.count).toBe(1);
    });
  });

  describe('getVisibleStandIds', () => {
    it('Returns stands from visible developments', async () => {
      const adminUser: VisibilityUser = {
        id: 'admin-1',
        email: 'admin@example.com',
        role: 'ADMIN',
        branch: null
      };

      (mockPrisma.development.findMany as jest.Mock).mockResolvedValue([
        { id: 'dev-1' },
        { id: 'dev-2' },
      ]);

      (mockPrisma.stand.findMany as jest.Mock).mockResolvedValue([
        { id: 'stand-1', developmentId: 'dev-1' },
        { id: 'stand-2', developmentId: 'dev-1' },
        { id: 'stand-3', developmentId: 'dev-2' },
      ]);

      const result = await getVisibleStandIds(adminUser);

      expect(result.standIds).toHaveLength(3);
      expect(result.developmentIds).toContain('dev-1');
      expect(result.developmentIds).toContain('dev-2');
    });

    it('Intersects requested developmentIds with visible ones', async () => {
      const managerUser: VisibilityUser = {
        id: 'manager-1',
        email: 'manager@example.com',
        role: 'MANAGER',
        branch: 'Harare'
      };

      (mockPrisma.development.findMany as jest.Mock).mockResolvedValue([
        { id: 'dev-1' }, // Manager can see dev-1 only
      ]);

      (mockPrisma.stand.findMany as jest.Mock).mockResolvedValue([
        { id: 'stand-1', developmentId: 'dev-1' },
      ]);

      // Request stands from dev-1 and dev-2 (but manager can only see dev-1)
      const result = await getVisibleStandIds(managerUser, {
        developmentIds: ['dev-1', 'dev-2', 'dev-3']
      });

      // Should only return stands from dev-1
      expect(mockPrisma.stand.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            developmentId: { in: ['dev-1'] } // Intersection
          })
        })
      );
    });
  });

  describe('canUserAccessDevelopment', () => {
    it('Returns true if development is in visible list', async () => {
      const developerUser: VisibilityUser = {
        id: 'dev-user-1',
        email: 'developer@example.com',
        role: 'DEVELOPER',
        branch: null
      };

      (mockPrisma.development.findMany as jest.Mock).mockResolvedValue([
        { id: 'dev-1' },
        { id: 'dev-2' },
      ]);

      const canAccess = await canUserAccessDevelopment(developerUser, 'dev-1');
      expect(canAccess).toBe(true);
    });

    it('Returns false if development is not in visible list', async () => {
      const developerUser: VisibilityUser = {
        id: 'dev-user-1',
        email: 'developer@example.com',
        role: 'DEVELOPER',
        branch: null
      };

      (mockPrisma.development.findMany as jest.Mock).mockResolvedValue([
        { id: 'dev-1' },
      ]);

      const canAccess = await canUserAccessDevelopment(developerUser, 'dev-999');
      expect(canAccess).toBe(false);
    });
  });

  describe('canUserAccessStand', () => {
    it('Returns true if stand belongs to visible development', async () => {
      const adminUser: VisibilityUser = {
        id: 'admin-1',
        email: 'admin@example.com',
        role: 'ADMIN',
        branch: null
      };

      (mockPrisma.stand.findUnique as jest.Mock).mockResolvedValue({
        developmentId: 'dev-1'
      });

      (mockPrisma.development.findMany as jest.Mock).mockResolvedValue([
        { id: 'dev-1' },
      ]);

      const canAccess = await canUserAccessStand(adminUser, 'stand-1');
      expect(canAccess).toBe(true);
    });

    it('Returns false if stand does not exist', async () => {
      const adminUser: VisibilityUser = {
        id: 'admin-1',
        email: 'admin@example.com',
        role: 'ADMIN',
        branch: null
      };

      (mockPrisma.stand.findUnique as jest.Mock).mockResolvedValue(null);

      const canAccess = await canUserAccessStand(adminUser, 'non-existent-stand');
      expect(canAccess).toBe(false);
    });
  });
});

describe('Integration: Manager Visibility Rules', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('Manager sees developments for their branch only', async () => {
    const harareManager: VisibilityUser = {
      id: 'manager-harare',
      email: 'manager.harare@example.com',
      role: 'MANAGER',
      branch: 'Harare'
    };

    (mockPrisma.development.findMany as jest.Mock).mockResolvedValue([
      { id: 'harare-dev-1' },
      { id: 'harare-dev-2' },
    ]);

    const result = await getVisibleDevelopmentIds(harareManager);

    expect(result.developmentIds).toEqual(['harare-dev-1', 'harare-dev-2']);
    expect(result.scope).toBe('branch');
    expect(mockPrisma.development.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { branch: 'Harare' }
      })
    );
  });

  it('Manager respects branch override from options', async () => {
    const manager: VisibilityUser = {
      id: 'manager-1',
      email: 'manager@example.com',
      role: 'MANAGER',
      branch: 'Harare'
    };

    (mockPrisma.development.findMany as jest.Mock).mockResolvedValue([
      { id: 'bulawayo-dev-1' },
    ]);

    // Override branch in options
    const result = await getVisibleDevelopmentIds(manager, { branch: 'Bulawayo' });

    expect(mockPrisma.development.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { branch: 'Bulawayo' }
      })
    );
  });
});

describe('Integration: Developer Visibility Rules', () => {
  it('Developer sees only developments where they are the developerEmail', async () => {
    const developer: VisibilityUser = {
      id: 'developer-1',
      email: 'landowner@example.com',
      role: 'DEVELOPER',
      branch: null
    };

    (mockPrisma.development.findMany as jest.Mock).mockResolvedValue([
      { id: 'my-dev-1' },
      { id: 'my-dev-2' },
    ]);

    const result = await getVisibleDevelopmentIds(developer);

    expect(result.scope).toBe('owned');
    expect(mockPrisma.development.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { developerEmail: 'landowner@example.com' }
      })
    );
  });
});
