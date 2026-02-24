/**
 * Case Transformation Utilities
 * 
 * Provides consistent snake_case ↔ camelCase conversion
 * for database ↔ API ↔ frontend data flow.
 * 
 * @module lib/utils/case-transform
 */

/**
 * Convert a snake_case string to camelCase
 */
export function snakeToCamel(str: string): string {
  return str.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
}

/**
 * Convert a camelCase string to snake_case
 */
export function camelToSnake(str: string): string {
  return str.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`);
}

/**
 * Recursively convert all keys in an object from snake_case to camelCase
 * Handles nested objects and arrays
 */
export function toCamelCase<T>(obj: T): T {
  if (obj === null || obj === undefined) {
    return obj;
  }

  if (Array.isArray(obj)) {
    return obj.map((item) => toCamelCase(item)) as T;
  }

  if (typeof obj === 'object' && !(obj instanceof Date)) {
    const result: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(obj as Record<string, unknown>)) {
      const camelKey = snakeToCamel(key);
      result[camelKey] = toCamelCase(value);
    }
    return result as T;
  }

  return obj;
}

/**
 * Recursively convert all keys in an object from camelCase to snake_case
 * Handles nested objects and arrays
 */
export function toSnakeCase<T>(obj: T): T {
  if (obj === null || obj === undefined) {
    return obj;
  }

  if (Array.isArray(obj)) {
    return obj.map((item) => toSnakeCase(item)) as T;
  }

  if (typeof obj === 'object' && !(obj instanceof Date)) {
    const result: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(obj as Record<string, unknown>)) {
      const snakeKey = camelToSnake(key);
      result[snakeKey] = toSnakeCase(value);
    }
    return result as T;
  }

  return obj;
}

/**
 * Normalize API input by accepting both snake_case and camelCase
 * and converting to camelCase (preferred convention)
 * 
 * This provides backward compatibility during migration.
 */
export function normalizeInput<T extends Record<string, unknown>>(input: T): T {
  const normalized: Record<string, unknown> = {};
  
  for (const [key, value] of Object.entries(input)) {
    // If key is snake_case, convert to camelCase
    const normalizedKey = key.includes('_') ? snakeToCamel(key) : key;
    
    // If both snake_case and camelCase versions exist, prefer camelCase
    if (!(normalizedKey in normalized) || !key.includes('_')) {
      normalized[normalizedKey] = value;
    }
  }
  
  return normalized as T;
}

/**
 * Common field mappings for specific entities
 * Use these when you need explicit control over field transformation
 */
export const fieldMaps = {
  /**
   * Stand field normalization
   */
  stand: <T extends Record<string, unknown>>(data: T) => ({
    ...data,
    id: data.id,
    standNumber: data.standNumber ?? data.stand_number,
    developmentId: data.developmentId ?? data.development_id,
    developmentName: data.developmentName ?? data.development_name,
    pricePerSqm: data.pricePerSqm ?? data.price_per_sqm,
    sizeSqm: data.sizeSqm ?? data.size_sqm ?? data.area_sqm,
    createdAt: data.createdAt ?? data.created_at,
    updatedAt: data.updatedAt ?? data.updated_at,
  }),

  /**
   * Payment field normalization
   */
  payment: <T extends Record<string, unknown>>(data: T) => ({
    ...data,
    id: data.id,
    clientId: data.clientId ?? data.client_id,
    clientName: data.clientName ?? data.client_name,
    standId: data.standId ?? data.stand_id,
    paymentType: data.paymentType ?? data.payment_type,
    paymentMethod: data.paymentMethod ?? data.payment_method,
    officeLocation: data.officeLocation ?? data.office_location,
    manualReceiptNo: data.manualReceiptNo ?? data.manual_receipt_no,
    surchargeAmount: data.surchargeAmount ?? data.surcharge_amount,
    verificationStatus: data.verificationStatus ?? data.verification_status,
    developmentId: data.developmentId ?? data.development_id,
    createdAt: data.createdAt ?? data.created_at,
    updatedAt: data.updatedAt ?? data.updated_at,
    confirmedAt: data.confirmedAt ?? data.confirmed_at,
  }),

  /**
   * Reservation field normalization
   */
  reservation: <T extends Record<string, unknown>>(data: T) => ({
    ...data,
    id: data.id,
    standId: data.standId ?? data.stand_id,
    clientId: data.clientId ?? data.client_id,
    agentId: data.agentId ?? data.agent_id,
    userId: data.userId ?? data.user_id,
    isCompanyLead: data.isCompanyLead ?? data.is_company_lead,
    termsAcceptedAt: data.termsAcceptedAt ?? data.terms_accepted_at,
    expiresAt: data.expiresAt ?? data.expires_at,
    timerActive: data.timerActive ?? data.timer_active,
    popUrl: data.popUrl ?? data.pop_url,
    createdAt: data.createdAt ?? data.created_at,
    updatedAt: data.updatedAt ?? data.updated_at,
  }),

  /**
   * Client field normalization
   */
  client: <T extends Record<string, unknown>>(data: T) => ({
    ...data,
    id: data.id,
    firstName: data.firstName ?? data.first_name,
    lastName: data.lastName ?? data.last_name,
    nationalId: data.nationalId ?? data.national_id,
    isPortalUser: data.isPortalUser ?? data.is_portal_user,
    ownedStands: data.ownedStands ?? data.owned_stands,
    agentId: data.agentId ?? data.agent_id,
    isProspect: data.isProspect ?? data.is_prospect,
    createdAt: data.createdAt ?? data.created_at,
    updatedAt: data.updatedAt ?? data.updated_at,
  }),

  /**
   * Development field normalization
   */
  development: <T extends Record<string, unknown>>(data: T) => ({
    ...data,
    id: data.id,
    basePrice: data.basePrice ?? data.base_price,
    pricePerSqm: data.pricePerSqm ?? data.price_per_sqm,
    vatPercentage: data.vatPercentage ?? data.vat_percentage,
    endowmentFee: data.endowmentFee ?? data.endowment_fee,
    totalAreaSqm: data.totalAreaSqm ?? data.total_area_sqm,
    totalStands: data.totalStands ?? data.total_stands,
    availableStands: data.availableStands ?? data.available_stands,
    mainImage: data.mainImage ?? data.main_image,
    geoJsonUrl: data.geoJsonUrl ?? data.geo_json_url,
    geoJsonData: data.geoJsonData ?? data.geo_json_data,
    imageUrls: data.imageUrls ?? data.image_urls,
    logoUrl: data.logoUrl ?? data.logo_url,
    documentUrls: data.documentUrls ?? data.document_urls,
    developerName: data.developerName ?? data.developer_name,
    developerEmail: data.developerEmail ?? data.developer_email,
    developerPhone: data.developerPhone ?? data.developer_phone,
    vatEnabled: data.vatEnabled ?? data.vat_enabled,
    endowmentEnabled: data.endowmentEnabled ?? data.endowment_enabled,
    aosEnabled: data.aosEnabled ?? data.aos_enabled,
    aosFee: data.aosFee ?? data.aos_fee,
    cessionsEnabled: data.cessionsEnabled ?? data.cessions_enabled,
    cessionFee: data.cessionFee ?? data.cession_fee,
    createdAt: data.createdAt ?? data.created_at,
    updatedAt: data.updatedAt ?? data.updated_at,
  }),
};

/**
 * Type guard to check if a value is a plain object
 */
function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value) && !(value instanceof Date);
}

/**
 * Deep merge two objects, with source taking precedence
 */
export function deepMerge<T extends Record<string, unknown>>(target: T, source: Partial<T>): T {
  const result = { ...target };
  
  for (const key of Object.keys(source)) {
    const sourceValue = source[key as keyof T];
    const targetValue = target[key as keyof T];
    
    if (isPlainObject(sourceValue) && isPlainObject(targetValue)) {
      result[key as keyof T] = deepMerge(targetValue as Record<string, unknown>, sourceValue as Record<string, unknown>) as T[keyof T];
    } else if (sourceValue !== undefined) {
      result[key as keyof T] = sourceValue as T[keyof T];
    }
  }
  
  return result;
}
