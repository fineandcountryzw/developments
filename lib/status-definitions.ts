/**
 * Status Definitions
 * Centralized status definitions for consistent badges across all dashboards
 * 
 * @module lib/status-definitions
 */

import { COLORS as colors } from './design-system';

export type StatusType = 
  | 'pending' | 'confirmed' | 'completed' | 'cancelled'
  | 'active' | 'inactive' | 'available' | 'reserved' | 'sold'
  | 'paid' | 'overdue' | 'processing' | 'failed'
  | 'new' | 'contacted' | 'qualified' | 'negotiation' | 'won' | 'lost'
  | 'pipeline' | 'offer' | 'inspection' | 'closing' | 'closed'
  | 'cleared' | 'defaulted'
  | 'calculated' | 'approved'
  | 'statement' | 'contract' | 'receipt';

export interface StatusConfig {
  label: string;
  bg: string;
  text: string;
  border?: string;
  icon?: string;
}

/**
 * Status badge configurations
 * Ensures consistent colors and labels across all dashboards
 */
export const statusDefinitions: Record<StatusType, StatusConfig> = {
  // General statuses
  pending: {
    label: 'Pending',
    bg: 'bg-yellow-50',
    text: 'text-yellow-700',
    border: 'border-yellow-200',
  },
  confirmed: {
    label: 'Confirmed',
    bg: 'bg-green-50',
    text: 'text-green-700',
    border: 'border-green-200',
  },
  completed: {
    label: 'Completed',
    bg: 'bg-blue-50',
    text: 'text-blue-700',
    border: 'border-blue-200',
  },
  cancelled: {
    label: 'Cancelled',
    bg: 'bg-red-50',
    text: 'text-red-700',
    border: 'border-red-200',
  },
  active: {
    label: 'Active',
    bg: 'bg-green-50',
    text: 'text-green-700',
    border: 'border-green-200',
  },
  inactive: {
    label: 'Inactive',
    bg: 'bg-gray-50',
    text: 'text-gray-700',
    border: 'border-gray-200',
  },
  
  // Stand/Property statuses
  available: {
    label: 'Available',
    bg: 'bg-blue-50',
    text: 'text-blue-700',
    border: 'border-blue-200',
  },
  reserved: {
    label: 'Reserved',
    bg: 'bg-amber-50',
    text: 'text-amber-700',
    border: 'border-amber-200',
  },
  sold: {
    label: 'Sold',
    bg: 'bg-red-50',
    text: 'text-red-700',
    border: 'border-red-200',
  },
  
  // Payment statuses
  paid: {
    label: 'Paid',
    bg: 'bg-emerald-50',
    text: 'text-emerald-700',
    border: 'border-emerald-200',
  },
  overdue: {
    label: 'Overdue',
    bg: 'bg-red-50',
    text: 'text-red-700',
    border: 'border-red-200',
  },
  processing: {
    label: 'Processing',
    bg: 'bg-amber-50',
    text: 'text-amber-700',
    border: 'border-amber-200',
  },
  failed: {
    label: 'Failed',
    bg: 'bg-red-50',
    text: 'text-red-700',
    border: 'border-red-200',
  },
  cleared: {
    label: 'Cleared',
    bg: 'bg-green-50',
    text: 'text-green-700',
    border: 'border-green-200',
  },
  
  // Prospect/Deal statuses
  new: {
    label: 'New',
    bg: 'bg-blue-50',
    text: 'text-blue-700',
    border: 'border-blue-200',
  },
  contacted: {
    label: 'Contacted',
    bg: 'bg-yellow-50',
    text: 'text-yellow-700',
    border: 'border-yellow-200',
  },
  qualified: {
    label: 'Qualified',
    bg: 'bg-green-50',
    text: 'text-green-700',
    border: 'border-green-200',
  },
  negotiation: {
    label: 'Negotiation',
    bg: 'bg-orange-50',
    text: 'text-orange-700',
    border: 'border-orange-200',
  },
  won: {
    label: 'Won',
    bg: 'bg-emerald-50',
    text: 'text-emerald-700',
    border: 'border-emerald-200',
  },
  lost: {
    label: 'Lost',
    bg: 'bg-red-50',
    text: 'text-red-700',
    border: 'border-red-200',
  },
  
  // Deal pipeline statuses
  pipeline: {
    label: 'Pipeline',
    bg: 'bg-blue-50',
    text: 'text-blue-700',
    border: 'border-blue-200',
  },
  offer: {
    label: 'Offer',
    bg: 'bg-purple-50',
    text: 'text-purple-700',
    border: 'border-purple-200',
  },
  inspection: {
    label: 'Inspection',
    bg: 'bg-amber-50',
    text: 'text-amber-700',
    border: 'border-amber-200',
  },
  closing: {
    label: 'Closing',
    bg: 'bg-teal-50',
    text: 'text-teal-700',
    border: 'border-teal-200',
  },
  closed: {
    label: 'Closed',
    bg: 'bg-green-50',
    text: 'text-green-700',
    border: 'border-green-200',
  },
  
  // Commission statuses
  calculated: {
    label: 'Calculated',
    bg: 'bg-yellow-50',
    text: 'text-yellow-700',
    border: 'border-yellow-200',
  },
  approved: {
    label: 'Approved',
    bg: 'bg-blue-50',
    text: 'text-blue-700',
    border: 'border-blue-200',
  },
  
  // Installment statuses
  defaulted: {
    label: 'Defaulted',
    bg: 'bg-red-50',
    text: 'text-red-700',
    border: 'border-red-200',
  },

  // Document types (Client Dashboard)
  statement: {
    label: 'Statement',
    bg: 'bg-indigo-50',
    text: 'text-indigo-700',
    border: 'border-indigo-200',
  },
  contract: {
    label: 'Contract',
    bg: 'bg-slate-50',
    text: 'text-slate-700',
    border: 'border-slate-200',
  },
  receipt: {
    label: 'Receipt',
    bg: 'bg-emerald-50',
    text: 'text-emerald-700',
    border: 'border-emerald-200',
  },
};

/**
 * Get status configuration
 * Returns default gray status if not found
 */
export function getStatusConfig(status: string): StatusConfig {
  const normalizedStatus = status.toLowerCase() as StatusType;
  return statusDefinitions[normalizedStatus] || {
    label: status,
    bg: 'bg-gray-50',
    text: 'text-gray-700',
    border: 'border-gray-200',
  };
}
