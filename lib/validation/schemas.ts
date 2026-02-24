/**
 * Zod Validation Schemas for Fine & Country Zimbabwe ERP
 * 
 * Provides type-safe validation for all API inputs.
 * Used to prevent injection attacks and ensure data integrity.
 */

import { z } from 'zod';

/**
 * UserRole enum for validation
 */
export const UserRoleEnum = z.enum(['ADMIN', 'MANAGER', 'AGENT', 'ACCOUNT', 'CLIENT', 'DEVELOPER']);

/**
 * Development schema
 */
export const developmentSchema = z.object({
  id: z.string().cuid().optional(),
  name: z.string().min(1, 'Name is required').max(255, 'Name must be less than 255 characters'),
  location: z.string().min(1, 'Location is required').max(255, 'Location must be less than 255 characters'),
  locationName: z.string().max(255).nullable().optional(),
  description: z.string().max(2000).nullable().optional(),
  overview: z.string().max(5000).nullable().optional(),
  phase: z.enum(['SERVICING', 'PLANNING', 'CONSTRUCTION', 'COMPLETED']).default('SERVICING'),
  servicingProgress: z.number().min(0).max(100).default(0),
  status: z.string().default('Active'),
  basePrice: z.number().positive('Base price must be positive').max(999999999.99, 'Base price is too large'),
  pricePerSqm: z.number().positive().optional(),
  vatPercentage: z.number().min(0).max(100).default(15),
  endowmentFee: z.number().min(0).default(0),
  totalAreaSqm: z.number().positive().optional(),
  totalStands: z.number().int().positive().max(10000).optional(),
  availableStands: z.number().int().min(0).optional(),
  mainImage: z.string().url().nullable().optional(),
  gallery: z.array(z.string().url()).optional(),
  geoJsonUrl: z.string().url().nullable().optional(),
  geoJsonData: z.any().optional(),
  hasGeoJsonMap: z.boolean().optional(),
  latitude: z.number().min(-90).max(90).optional(),
  longitude: z.number().min(-180).max(180).optional(),
  branch: z.string().default('Harare'),
  featuredTag: z.enum(['none', 'promo', 'hot']).default('none').optional(),
  developerName: z.string().max(255).nullable().optional(),
  developerEmail: z.string().email().nullable().optional(),
  developerPhone: z.string().max(50).nullable().optional(),
  lawyerName: z.string().max(255).nullable().optional(),
  lawyerEmail: z.string().email().nullable().optional(),
  lawyerPhone: z.string().max(50).nullable().optional(),
  vatEnabled: z.boolean().default(true),
  endowmentEnabled: z.boolean().default(false),
  aosEnabled: z.boolean().default(false),
  aosFee: z.number().min(0).optional(),
  cessionsEnabled: z.boolean().default(false),
  cessionFee: z.number().min(0).optional(),
  adminFeeEnabled: z.boolean().default(false),
  adminFee: z.number().min(0).optional(),
  disableMapView: z.boolean().optional(),
});

/**
 * Stand schema
 */
export const standSchema = z.object({
  id: z.string().cuid().optional(),
  standNumber: z.string().min(1, 'Stand number is required').max(50, 'Stand number must be less than 50 characters'),
  developmentId: z.string().cuid('Invalid development ID'),
  branch: z.string().default('Harare'),
  price: z.number().positive('Price must be positive').max(999999999.99, 'Price is too large'),
  pricePerSqm: z.number().positive().optional(),
  sizeSqm: z.number().positive('Size must be positive').optional(),
  status: z.enum(['AVAILABLE', 'RESERVED', 'SOLD', 'PENDING']).default('AVAILABLE'),
  geoJsonData: z.any().optional(),
});

/**
 * Client schema
 */
export const clientSchema = z.object({
  id: z.string().cuid().optional(),
  name: z.string().min(1, 'Name is required').max(255, 'Name must be less than 255 characters'),
  firstName: z.string().max(100).nullable().optional(),
  lastName: z.string().max(100).nullable().optional(),
  email: z.string().email('Invalid email address'),
  phone: z.string().regex(/^[+]?[\d\s\-()]+$/, 'Invalid phone number').max(50, 'Phone number must be less than 50 characters').nullable().optional(),
  nationalId: z.string().min(1).max(50, 'National ID must be less than 50 characters').nullable().optional(),
  branch: z.string().default('Harare'),
  isPortalUser: z.boolean().default(false),
  address: z.string().max(500).nullable().optional(),
  city: z.string().max(100).nullable().optional(),
  country: z.string().max(100).default('Zimbabwe'),
  kyc: z.array(z.any()).optional(),
  ownedStands: z.array(z.string()).optional(),
});

/**
 * User schema
 */
export const userSchema = z.object({
  id: z.string().cuid().optional(),
  name: z.string().max(255).nullable().optional(),
  email: z.string().email('Invalid email address'),
  role: UserRoleEnum.default('CLIENT'),
  branch: z.string().default('Harare'),
  isActive: z.boolean().default(true),
  password: z.string().min(8, 'Password must be at least 8 characters').nullable().optional(),
});

/**
 * Payment schema
 */
export const paymentSchema = z.object({
  id: z.string().cuid().optional(),
  reservationId: z.string().cuid('Invalid reservation ID').optional(),
  standId: z.string().cuid('Invalid stand ID').optional(),
  clientId: z.string().nullable().optional(),
  clientName: z.string().max(255).nullable().optional(),
  amount: z.number().positive('Amount must be positive').max(999999999.99, 'Amount is too large'),
  surchargeAmount: z.number().min(0).optional(),
  paymentMethod: z.enum(['CASH', 'TRANSFER', 'CARD', 'MOBILE_MONEY', 'PAYNOW']),
  paymentType: z.string().max(50),
  paymentDate: z.string().datetime().nullable().optional(),
  reference: z.string().max(100),
  notes: z.string().max(1000).nullable().optional(),
  description: z.string().max(500).nullable().optional(),
  status: z.enum(['PENDING', 'confirmed', 'CANCELLED', 'REFUNDED']).optional(),
  receiptUrl: z.string().url().nullable().optional(),
  officeLocation: z.string().max(100),
  receivedByName: z.string().max(255).nullable().optional(),
  manualReceiptNo: z.string().max(50),
  verificationStatus: z.string().max(50).nullable().optional(),
  confirmedAt: z.string().datetime().nullable().optional(),
});

/**
 * Reservation schema
 */
export const reservationSchema = z.object({
  id: z.string().cuid().optional(),
  standId: z.string().cuid('Invalid stand ID'),
  clientId: z.string().cuid('Invalid client ID').optional(),
  agentId: z.string().cuid('Invalid agent ID').optional(),
  userId: z.string().cuid('Invalid user ID').optional(),
  depositAmount: z.number().positive('Deposit amount must be positive').optional(),
  expiresAt: z.string().datetime().nullable().optional(),
  status: z.enum(['PENDING', 'CONFIRMED', 'EXPIRED', 'CANCELLED']).default('PENDING'),
  notes: z.string().max(2000).nullable().optional(),
  // Additional fields used by the route
  clientName: z.string().max(255).nullable().optional(),
  clientEmail: z.string().email().nullable().optional(),
  clientPhone: z.string().max(50).nullable().optional(),
  developmentName: z.string().max(255).nullable().optional(),
  developmentLocation: z.string().max(255).nullable().optional(),
  insuranceInterest: z.boolean().optional(),
  insuranceInterestSource: z.string().max(100).nullable().optional(),
});

/**
 * Contract schema
 */
export const contractSchema = z.object({
  id: z.string().cuid().optional(),
  reservationId: z.string().cuid('Invalid reservation ID'),
  templateId: z.string().cuid('Invalid template ID').optional(),
  type: z.enum(['AGREEMENT_OF_SALE', 'PAYMENT_PLAN', 'CESSION_AGREEMENT']),
  status: z.enum(['DRAFT', 'PENDING_SIGNATURE', 'SIGNED', 'CANCELLED']).default('DRAFT'),
  generatedUrl: z.string().url().nullable().optional(),
  docusealSubmissionId: z.string().nullable().optional(),
  signedAt: z.string().datetime().nullable().optional(),
});

/**
 * Installment schema
 */
export const installmentSchema = z.object({
  id: z.string().cuid().optional(),
  reservationId: z.string().cuid('Invalid reservation ID'),
  installmentNumber: z.number().int().positive('Installment number must be positive'),
  amount: z.number().positive('Amount must be positive').max(999999999.99, 'Amount is too large'),
  dueDate: z.string().datetime(),
  paidDate: z.string().datetime().nullable().optional(),
  status: z.enum(['PENDING', 'PAID', 'OVERDUE', 'WAIVED']).default('PENDING'),
});

/**
 * Activity log schema
 */
export const activityLogSchema = z.object({
  id: z.string().cuid().optional(),
  userId: z.string().cuid('Invalid user ID'),
  action: z.string().min(1, 'Action is required').max(100),
  module: z.string().min(1, 'Module is required').max(50),
  recordId: z.string().max(100).nullable().optional(),
  description: z.string().max(1000).nullable().optional(),
  branch: z.string().default('Harare'),
});

/**
 * Pagination schema
 */
export const paginationSchema = z.object({
  page: z.number().int().positive().default(1),
  limit: z.number().int().positive().max(100).default(20),
  sort: z.string().nullable().optional(),
  order: z.enum(['asc', 'desc']).default('desc'),
});

/**
 * Filter schema
 */
export const filterSchema = z.object({
  branch: z.string().nullable().optional(),
  status: z.string().nullable().optional(),
  search: z.string().max(100).nullable().optional(),
  dateFrom: z.string().datetime().nullable().optional(),
  dateTo: z.string().datetime().nullable().optional(),
});

/**
 * Create Account From Reservation schema
 * Used by /api/auth/create-account-from-reservation POST endpoint
 */
export const createAccountFromReservationSchema = z.object({
  email: z.string().email('Invalid email address'),
  name: z.string().min(1, 'Name is required').max(255, 'Name must be less than 255 characters'),
  phone: z.string().regex(/^[+]?[\d\s\-()]+$/, 'Invalid phone number').max(50).nullable().optional(),
  idNumber: z.string().max(50, 'ID number must be less than 50 characters').nullable().optional(),
  idDocumentUrl: z.string().url('Invalid document URL').nullable().optional(),
  reservationData: z.object({
    standId: z.string().cuid('Invalid stand ID').optional(),
    standNumber: z.string().max(50).nullable().optional(),
    agentId: z.string().cuid('Invalid agent ID').optional(),
    isCompanyLead: z.boolean().optional(),
    digitalRef: z.string().max(100).nullable().optional(),
    attributionType: z.string().max(50).nullable().optional(),
  }).optional(),
});

/**
 * Set Password schema
 * Used by /api/auth/create-account-from-reservation PUT endpoint
 */
export const setPasswordSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string()
    .min(8, 'Password must be at least 8 characters')
    .max(128, 'Password must be less than 128 characters')
    .regex(
      /^(?=.*[A-Z])(?=.*[a-z])(?=.*\d).+$/,
      'Password must include at least one uppercase letter, one lowercase letter, and one number'
    ),
});

/**
 * Reset Password schema
 * Used by /api/auth/reset-password endpoint
 */
export const resetPasswordSchema = z.object({
  token: z.string().min(1, 'Token is required'),
  password: z.string()
    .min(8, 'Password must be at least 8 characters')
    .max(128, 'Password must be less than 128 characters')
    .regex(
      /^(?=.*[A-Z])(?=.*[a-z])(?=.*\d).+$/,
      'Password must include at least one uppercase letter, one lowercase letter, and one number'
    ),
});

/**
 * Forgot Password schema
 * Used by /api/auth/forgot-password endpoint
 */
export const forgotPasswordSchema = z.object({
  email: z.string().email('Invalid email address').transform(e => e.toLowerCase().trim()),
});

/**
 * Request Access schema
 * Used by /api/auth/request-access endpoint
 */
export const requestAccessSchema = z.object({
  name: z.string().min(1, 'Name is required').max(255),
  email: z.string().email('Invalid email address').transform(e => e.toLowerCase().trim()),
  phone: z.string().max(50).nullable().optional(),
  accountType: UserRoleEnum.default('CLIENT'),
  company: z.string().max(255).nullable().optional(),
  message: z.string().max(2000).nullable().optional(),
});

/**
 * Company Settings schema
 * Used by /api/admin/settings endpoint
 */
// Helper: coerce empty strings to null so .url()/.email() validators skip them
const emptyToNull = (v: unknown) => (v === '' ? null : v);

export const settingsSchema = z.object({
  branch: z.string().min(1, 'Branch is required').max(100),
  logo_url: z.preprocess(emptyToNull, z.string().url().nullable().optional()),
  company_name: z.string().max(255).nullable().optional(),
  phone: z.string().max(50).nullable().optional(),
  email: z.preprocess(emptyToNull, z.string().email().nullable().optional()),
  address: z.string().max(500).nullable().optional(),
  principal_agent_name: z.string().max(255).nullable().optional(),
  principal_agent_email: z.preprocess(emptyToNull, z.string().email().nullable().optional()),
});

/**
 * User Invite schema
 * Used by /api/admin/users/invite endpoint
 * Supports both single email and multiple emails
 */
export const userInviteSchema = z.object({
  email: z.string().email().nullable().optional(),
  emails: z.array(z.string().email()).optional(),
  role: UserRoleEnum.default('AGENT'),
  branch: z.string().default('Harare'),
  fullName: z.string().max(255).nullable().optional(),
  name: z.string().max(255).nullable().optional(),
});

/**
 * User bulk action schema
 */
export const userBulkActionSchema = z.object({
  action: z.enum(['update-branch', 'bulk-enable', 'bulk-disable', 'bulk-delete']),
  userIds: z.array(z.string().cuid()),
  data: z.object({
    branch: z.string().nullable().optional(),
    reason: z.string().nullable().optional(),
  }).optional(),
});

/**
 * User create schema
 */
export const userCreateSchema = z.object({
  email: z.string().email('Invalid email address'),
  name: z.string().max(255).nullable().optional(),
  role: UserRoleEnum.default('CLIENT'),
  branch: z.string().default('Harare'),
  isActive: z.boolean().default(true),
  password: z.string().min(8).nullable().optional(),
});

/**
 * User POST schema - union of bulk action or direct creation
 */
export const userPostSchema = z.union([userBulkActionSchema, userCreateSchema]);

/**
 * Stand update schema
 */
export const standUpdateSchema = z.object({
  id: z.string().cuid(),
  standNumber: z.string().min(1).max(50).nullable().optional(),
  price: z.number().positive().optional(),
  sizeSqm: z.number().positive().optional(),
  status: z.enum(['AVAILABLE', 'RESERVED', 'SOLD', 'PENDING']).optional(),
  geoJsonData: z.any().optional(),
  reservedBy: z.string().nullable().optional(),
});

/**
 * Bulk stand create schema
 */
export const bulkStandCreateSchema = z.object({
  developmentId: z.string().cuid('Invalid development ID'),
  standCount: z.number().int().positive().max(1000, 'Cannot create more than 1000 stands at once'),
  standNumberPrefix: z.string().max(20).nullable().optional(),
  standNumberStart: z.number().int().positive().optional(),
  defaultStandSize: z.number().positive().optional(),
  pricePerSqm: z.number().positive().optional(),
  manualStandSizes: z.string().optional(),
});

/**
 * Export all schemas
 */
export const schemas = {
  development: developmentSchema,
  stand: standSchema,
  client: clientSchema,
  user: userSchema,
  payment: paymentSchema,
  reservation: reservationSchema,
  contract: contractSchema,
  installment: installmentSchema,
  activityLog: activityLogSchema,
  pagination: paginationSchema,
  filter: filterSchema,
  createAccountFromReservation: createAccountFromReservationSchema,
  setPassword: setPasswordSchema,
  resetPassword: resetPasswordSchema,
  forgotPassword: forgotPasswordSchema,
  requestAccess: requestAccessSchema,
  settings: settingsSchema,
  userInvite: userInviteSchema,
  userPost: userPostSchema,
  standUpdate: standUpdateSchema,
  bulkStandCreate: bulkStandCreateSchema,
};
