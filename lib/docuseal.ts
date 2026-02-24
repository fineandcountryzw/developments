/**
 * DocuSeal API Client
 * 
 * Integrates with DocuSeal for e-signature workflows
 * Supports creating submissions, checking status, and downloading signed PDFs
 * 
 * @see https://www.docuseal.co/docs/api
 */

import { logger } from '@/lib/logger';

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export interface DocuSealSigner {
  email: string;
  name: string;
  role: 'client' | 'developer' | 'lawyer' | 'principal_agent';
  phone?: string;
}

export interface CreateSubmissionParams {
  templateId?: number;
  documentBase64?: string;
  documentUrl?: string;
  signers: DocuSealSigner[];
  metadata?: {
    contractId: string;
    standId?: string;
    developmentId?: string;
    branch?: string;
  };
  expiresInDays?: number;
  message?: string;
  sendEmail?: boolean;
}

export interface SubmissionResponse {
  id: number;
  source: string;
  submitters: Array<{
    id: number;
    email: string;
    name: string;
    role: string;
    status: 'pending' | 'opened' | 'completed' | 'declined';
    embed_src?: string;
    slug?: string;
  }>;
  template: {
    id: number;
    name: string;
  };
  status: 'pending' | 'completed' | 'expired';
  created_at: string;
  updated_at: string;
  completed_at?: string;
  archived_at?: string;
  audit_log_url?: string;
  documents?: Array<{
    name: string;
    url: string;
  }>;
}

export interface SubmissionStatus {
  id: number;
  status: 'pending' | 'completed' | 'expired';
  submitters: Array<{
    id: number;
    email: string;
    name: string;
    status: 'pending' | 'opened' | 'completed' | 'declined';
    completed_at?: string;
  }>;
  documents?: Array<{
    name: string;
    url: string;
  }>;
  completedAt?: string;
}

export interface WebhookEvent {
  event_type: 'submission.created' | 'submission.completed' | 'submission.expired' | 
              'submitter.opened' | 'submitter.completed' | 'submitter.declined';
  timestamp: string;
  data: {
    id: number;
    submission_id?: number;
    email?: string;
    status?: string;
    metadata?: Record<string, string>;
    documents?: Array<{ name: string; url: string }>;
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Configuration
// ─────────────────────────────────────────────────────────────────────────────

const DOCUSEAL_BASE_URL = process.env.DOCUSEAL_BASE_URL || 'https://api.docuseal.co';

function getApiKey(): string {
  const apiKey = process.env.DOCUSEAL_API_KEY;
  if (!apiKey) {
    throw new Error('DOCUSEAL_API_KEY environment variable is not set');
  }
  return apiKey;
}

function getWebhookSecret(): string {
  const secret = process.env.DOCUSEAL_WEBHOOK_SECRET;
  if (!secret) {
    throw new Error('DOCUSEAL_WEBHOOK_SECRET environment variable is not set');
  }
  return secret;
}

export function isDocuSealEnabled(): boolean {
  return process.env.ENABLE_DOCUSEAL === 'true' && !!process.env.DOCUSEAL_API_KEY;
}

// ─────────────────────────────────────────────────────────────────────────────
// API Client
// ─────────────────────────────────────────────────────────────────────────────

async function docusealFetch<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const apiKey = getApiKey();
  const url = `${DOCUSEAL_BASE_URL}${endpoint}`;

  const response = await fetch(url, {
    ...options,
    headers: {
      'X-Auth-Token': apiKey,
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });

  if (!response.ok) {
    const errorBody = await response.text();
    logger.error('DocuSeal API error', new Error(errorBody), {
      module: 'DocuSeal',
      action: 'API_REQUEST',
      endpoint,
      status: response.status,
    });
    throw new Error(`DocuSeal API error: ${response.status} - ${errorBody}`);
  }

  return response.json();
}

// ─────────────────────────────────────────────────────────────────────────────
// DocuSeal Client
// ─────────────────────────────────────────────────────────────────────────────

export class DocuSealClient {
  /**
   * Create a submission for e-signature
   * 
   * @param params - Submission parameters including signers and document
   * @returns Submission response with IDs and signing URLs
   */
  static async createSubmission(params: CreateSubmissionParams): Promise<{
    submissionId: number;
    signerUrls: Record<string, string>;
    signerIds: Record<string, number>;
  }> {
    const {
      templateId,
      documentBase64,
      documentUrl,
      signers,
      metadata,
      expiresInDays = 30,
      message,
      sendEmail = false, // We'll send our own branded emails
    } = params;

    if (!templateId && !documentBase64 && !documentUrl) {
      throw new Error('Either templateId, documentBase64, or documentUrl is required');
    }

    // Build the submission request body
    const roleLabel = (role: DocuSealSigner['role']) => {
      switch (role) {
        case 'client':
          return 'Purchaser';
        case 'developer':
          return 'Developer';
        case 'lawyer':
          return 'Lawyer';
        case 'principal_agent':
          return 'Principal Agent (Fine & Country)';
        default:
          return role;
      }
    };

    const submitters = signers.map((signer, index) => ({
      email: signer.email,
      name: signer.name,
      role: signer.role,
      send_email: sendEmail,
      // Custom fields can be passed here for template variables
      fields: [
        { name: 'signer_name', default_value: signer.name },
        { name: 'signer_email', default_value: signer.email },
        { name: 'signer_role', default_value: roleLabel(signer.role) },
      ],
    }));

    const requestBody: Record<string, any> = {
      submitters,
      send_email: sendEmail,
      message: message || 'Please review and sign this contract.',
      expire_at: new Date(Date.now() + expiresInDays * 24 * 60 * 60 * 1000).toISOString(),
    };

    // Add metadata for webhook reference
    if (metadata) {
      requestBody.metadata = metadata;
    }

    // Use template or document
    if (templateId) {
      requestBody.template_id = templateId;
    } else if (documentBase64) {
      // Create from document (requires template creation first, or use submissions_from_emails)
      // For now, we'll use the documents endpoint approach
      requestBody.documents = [{
        name: `contract-${metadata?.contractId || 'document'}.pdf`,
        file: documentBase64,
      }];
    } else if (documentUrl) {
      requestBody.documents = [{
        name: `contract-${metadata?.contractId || 'document'}.pdf`,
        url: documentUrl,
      }];
    }

    logger.info('Creating DocuSeal submission', {
      module: 'DocuSeal',
      action: 'CREATE_SUBMISSION',
      signerCount: signers.length,
      contractId: metadata?.contractId,
    });

    // Create submission
    const response = await docusealFetch<SubmissionResponse>('/submissions', {
      method: 'POST',
      body: JSON.stringify(requestBody),
    });

    // Extract signing URLs for each signer
    const signerUrls: Record<string, string> = {};
    const signerIds: Record<string, number> = {};

    response.submitters.forEach((submitter) => {
      const signerRole = signers.find(s => s.email === submitter.email)?.role || 'unknown';
      if (submitter.embed_src) {
        signerUrls[signerRole] = submitter.embed_src;
      } else if (submitter.slug) {
        // Build signing URL from slug
        signerUrls[signerRole] = `https://docuseal.co/s/${submitter.slug}`;
      }
      signerIds[signerRole] = submitter.id;
    });

    logger.info('DocuSeal submission created', {
      module: 'DocuSeal',
      action: 'SUBMISSION_CREATED',
      submissionId: response.id,
      contractId: metadata?.contractId,
    });

    return {
      submissionId: response.id,
      signerUrls,
      signerIds,
    };
  }

  /**
   * Get submission status
   * 
   * @param submissionId - DocuSeal submission ID
   * @returns Current submission status
   */
  static async getSubmission(submissionId: number): Promise<SubmissionStatus> {
    logger.info('Getting DocuSeal submission', {
      module: 'DocuSeal',
      action: 'GET_SUBMISSION',
      submissionId,
    });

    const response = await docusealFetch<SubmissionResponse>(`/submissions/${submissionId}`);

    return {
      id: response.id,
      status: response.status,
      submitters: response.submitters.map(s => ({
        id: s.id,
        email: s.email,
        name: s.name,
        status: s.status,
        completed_at: undefined, // Would need to track this separately
      })),
      documents: response.documents,
      completedAt: response.completed_at,
    };
  }

  /**
   * Download signed PDF from completed submission
   * 
   * @param submissionId - DocuSeal submission ID
   * @returns Buffer containing PDF data
   */
  static async downloadSignedPdf(submissionId: number): Promise<Buffer> {
    logger.info('Downloading signed PDF', {
      module: 'DocuSeal',
      action: 'DOWNLOAD_PDF',
      submissionId,
    });

    // First get the submission to find the document URL
    const submission = await this.getSubmission(submissionId);

    if (submission.status !== 'completed') {
      throw new Error('Submission is not completed yet');
    }

    if (!submission.documents || submission.documents.length === 0) {
      throw new Error('No documents found in submission');
    }

    // Download the signed document
    const documentUrl = submission.documents[0].url;
    const response = await fetch(documentUrl);

    if (!response.ok) {
      throw new Error(`Failed to download signed PDF: ${response.status}`);
    }

    const arrayBuffer = await response.arrayBuffer();
    return Buffer.from(arrayBuffer);
  }

  /**
   * Cancel/archive a submission
   * 
   * @param submissionId - DocuSeal submission ID
   */
  static async archiveSubmission(submissionId: number): Promise<void> {
    logger.info('Archiving DocuSeal submission', {
      module: 'DocuSeal',
      action: 'ARCHIVE_SUBMISSION',
      submissionId,
    });

    await docusealFetch(`/submissions/${submissionId}`, {
      method: 'DELETE',
    });
  }

  /**
   * Verify webhook signature
   * 
   * @param payload - Raw request body
   * @param signature - X-DocuSeal-Signature header value
   * @returns true if signature is valid
   */
  static verifyWebhookSignature(payload: string, signature: string): boolean {
    try {
      const secret = getWebhookSecret();
      
      // DocuSeal uses HMAC-SHA256 for webhook signatures
      const crypto = require('crypto');
      const expectedSignature = crypto
        .createHmac('sha256', secret)
        .update(payload)
        .digest('hex');

      // Compare signatures (timing-safe comparison)
      return crypto.timingSafeEqual(
        Buffer.from(signature),
        Buffer.from(expectedSignature)
      );
    } catch (error) {
      logger.error('Webhook signature verification failed', error as Error, {
        module: 'DocuSeal',
        action: 'VERIFY_WEBHOOK',
      });
      return false;
    }
  }

  /**
   * Parse webhook event
   * 
   * @param body - Parsed JSON body from webhook
   * @returns Typed webhook event
   */
  static parseWebhookEvent(body: any): WebhookEvent {
    return {
      event_type: body.event_type,
      timestamp: body.timestamp,
      data: body.data,
    };
  }

  /**
   * Send signing reminder
   * 
   * @param submitterId - DocuSeal submitter ID
   */
  static async sendReminder(submitterId: number): Promise<void> {
    logger.info('Sending signing reminder', {
      module: 'DocuSeal',
      action: 'SEND_REMINDER',
      submitterId,
    });

    await docusealFetch(`/submitters/${submitterId}/remind`, {
      method: 'POST',
    });
  }

  /**
   * Get signing URL for a specific submitter
   * 
   * @param submitterId - DocuSeal submitter ID
   * @returns Signing URL
   */
  static async getSigningUrl(submitterId: number): Promise<string> {
    const response = await docusealFetch<{ url: string }>(`/submitters/${submitterId}`);
    return response.url;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Contract Status Mapping
// ─────────────────────────────────────────────────────────────────────────────

export type DocuSealContractStatus = 
  | 'DRAFT'
  | 'SENT'
  | 'VIEWED'
  | 'PARTIALLY_SIGNED'
  | 'SIGNED'
  | 'EXPIRED'
  | 'DECLINED';

/**
 * Map DocuSeal submission/submitter status to contract status
 */
export function mapToContractStatus(
  submissionStatus: string,
  submitterStatuses: string[]
): DocuSealContractStatus {
  // If submission is expired
  if (submissionStatus === 'expired') {
    return 'EXPIRED';
  }

  // If any submitter declined
  if (submitterStatuses.includes('declined')) {
    return 'DECLINED';
  }

  // If submission is completed (all signed)
  if (submissionStatus === 'completed') {
    return 'SIGNED';
  }

  // Check submitter statuses
  const completedCount = submitterStatuses.filter(s => s === 'completed').length;
  const openedCount = submitterStatuses.filter(s => s === 'opened' || s === 'completed').length;

  if (completedCount > 0 && completedCount < submitterStatuses.length) {
    return 'PARTIALLY_SIGNED';
  }

  if (openedCount > 0) {
    return 'VIEWED';
  }

  return 'SENT';
}

/**
 * Get status badge color for UI
 */
export function getStatusBadgeColor(status: DocuSealContractStatus): string {
  const colors: Record<DocuSealContractStatus, string> = {
    'DRAFT': 'bg-gray-100 text-gray-700',
    'SENT': 'bg-blue-100 text-blue-700',
    'VIEWED': 'bg-purple-100 text-purple-700',
    'PARTIALLY_SIGNED': 'bg-amber-100 text-amber-700',
    'SIGNED': 'bg-green-100 text-green-700',
    'EXPIRED': 'bg-red-100 text-red-700',
    'DECLINED': 'bg-red-100 text-red-700',
  };
  return colors[status] || 'bg-gray-100 text-gray-700';
}

export default DocuSealClient;
