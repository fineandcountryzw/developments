/**
 * Dashboard Permissions
 * Role-based access control for dashboard data
 * 
 * @module lib/dashboard-permissions
 */

export type UserRole = 'ADMIN' | 'MANAGER' | 'AGENT' | 'CLIENT' | 'ACCOUNT' | 'DEVELOPER';

/**
 * Dashboard access permissions by role
 */
export const dashboardPermissions: Record<string, UserRole[]> = {
  admin: ['ADMIN'],
  manager: ['ADMIN', 'MANAGER'],
  agent: ['ADMIN', 'MANAGER', 'AGENT'],
  client: ['ADMIN', 'CLIENT'],
  account: ['ADMIN', 'ACCOUNT'],
  developer: ['ADMIN', 'DEVELOPER'],
};

/**
 * Check if user can access a specific dashboard
 */
export function canAccessDashboard(userRole: string, dashboardType: string): boolean {
  const normalizedRole = userRole?.toUpperCase() as UserRole;
  const normalizedDashboard = dashboardType.toLowerCase();
  
  const allowedRoles = dashboardPermissions[normalizedDashboard];
  if (!allowedRoles) return false;
  
  return allowedRoles.includes(normalizedRole);
}

/**
 * Get data filter based on user role
 * Ensures users only see data relevant to their role
 */
export function getDataFilter(userRole: string, userId: string, userBranch?: string) {
  const role = userRole?.toUpperCase();
  
  switch (role) {
    case 'ADMIN':
      // Admin can see everything - no filter
      return {};
      
    case 'MANAGER':
      // Manager sees data for their branch
      return userBranch ? { branch: userBranch } : {};
      
    case 'AGENT':
      // Agent sees only their own data
      return { agentId: userId };
      
    case 'CLIENT':
      // Client sees only their own data
      return { clientId: userId };
      
    case 'ACCOUNT':
      // Account can see all financial data
      return {};
      
    case 'DEVELOPER':
      // Developer sees only their developments
      return { developerId: userId };
      
    default:
      // Unknown role - no access
      return null;
  }
}

/**
 * Get accessible dashboards for a user role
 */
export function getAccessibleDashboards(userRole: string): string[] {
  const normalizedRole = userRole?.toUpperCase() as UserRole;
  const dashboards: string[] = [];
  
  Object.entries(dashboardPermissions).forEach(([dashboard, roles]) => {
    if (roles.includes(normalizedRole)) {
      dashboards.push(dashboard);
    }
  });
  
  return dashboards;
}

/**
 * Role-specific data access rules
 */
export const roleDataAccess = {
  ADMIN: {
    canViewAll: true,
    canEditAll: true,
    canDelete: true,
    canExport: true,
    filters: {},
  },
  MANAGER: {
    canViewAll: false,
    canEditAll: false,
    canDelete: false,
    canExport: true,
    filters: { branch: true }, // Filtered by branch
  },
  AGENT: {
    canViewAll: false,
    canEditAll: false,
    canDelete: false,
    canExport: false,
    filters: { agentId: true }, // Only own data
  },
  CLIENT: {
    canViewAll: false,
    canEditAll: false,
    canDelete: false,
    canExport: false,
    filters: { clientId: true }, // Only own data
  },
  ACCOUNT: {
    canViewAll: true, // Financial data
    canEditAll: false,
    canDelete: false,
    canExport: true,
    filters: {},
  },
  DEVELOPER: {
    canViewAll: false,
    canEditAll: false,
    canDelete: false,
    canExport: true,
    filters: { developerId: true }, // Only own developments
  },
};
