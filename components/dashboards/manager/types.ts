export interface TeamMember {
  id: string;
  name: string;
  email: string;
  role: string;
  branch: string;
  leadsGenerated: number;
  dealsClosedThisMonth: number;
  conversionRate: number;
  targetAchievement: number;
  status: 'active' | 'inactive';
  lastActivity: string;
}

export interface BranchMetrics {
  branch: string;
  totalLeads: number;
  totalDeals: number;
  revenue: number;
  agents: number;
  conversionRate: number;
}

