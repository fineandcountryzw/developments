import { neon } from '@neondatabase/serverless';

const sql = neon(process.env.DATABASE_URL!);

export interface SignatureRequest {
  id: string;
  contractId: string;
  signerName: string;
  signerEmail: string;
  signerRole: string;
  status: string;
  sentAt?: Date;
  signedAt?: Date;
  expiresAt?: Date;
}

/**
 * Signature Manager - Handles e-signature workflows and tracking
 */
export class SignatureManager {
  /**
   * Create a signature request
   */
  static async createSignatureRequest(
    contractId: string,
    signerName: string,
    signerEmail: string,
    signerRole: string = 'buyer',
    expiresInDays: number = 30
  ): Promise<SignatureRequest> {
    const signatureId = Math.random().toString(36).substring(7);
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + expiresInDays);

    const query = `
      INSERT INTO contract_signatures (
        id, contract_id, signer_name, signer_email, signer_role, 
        status, expires_at, created_at, updated_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), NOW())
      RETURNING *
    `;

    const result = await sql.query(query, [
      signatureId,
      contractId,
      signerName,
      signerEmail,
      signerRole,
      'pending',
      expiresAt
    ]);

    return result[0] as SignatureRequest;
  }

  /**
   * Send signature request email (placeholder for actual email service)
   */
  static async sendSignatureRequest(
    signatureId: string,
    signerEmail: string,
    contractTitle: string
  ): Promise<void> {
    // TODO: Integrate with email service (SendGrid, Mailgun, etc.)
    // For now, just update the sentAt timestamp
    const updateQuery = `
      UPDATE contract_signatures
      SET sent_at = NOW()
      WHERE id = $1
    `;

    await sql.query(updateQuery, [signatureId]);

    console.log(`[Signature Request] Sending to ${signerEmail} for contract: ${contractTitle}`);
  }

  /**
   * Record a signature
   */
  static async recordSignature(
    signatureId: string,
    signatureData: string,
    ipAddress?: string,
    userAgent?: string,
    signedByUserId?: string
  ): Promise<SignatureRequest> {
    const updateQuery = `
      UPDATE contract_signatures
      SET 
        status = 'signed',
        signature_data = $1,
        signed_at = NOW(),
        ip_address = $2,
        user_agent = $3,
        signed_by_user_id = $4,
        updated_at = NOW()
      WHERE id = $5
      RETURNING *
    `;

    const result = await sql.query(updateQuery, [
      signatureData,
      ipAddress,
      userAgent,
      signedByUserId,
      signatureId
    ]);

    if (!result || result.length === 0) {
      throw new Error('Signature record not found');
    }

    const signature = result[0] as SignatureRequest;

    // Update contract signed count
    await this.updateContractSignedCount((signature as any).contract_id);

    return signature;
  }

  /**
   * Get signature by ID
   */
  static async getSignature(id: string): Promise<SignatureRequest | null> {
    const query = 'SELECT * FROM contract_signatures WHERE id = $1';
    const result = await sql.query(query, [id]);

    return (result?.[0] as SignatureRequest) || null;
  }

  /**
   * Get all signatures for a contract
   */
  static async getContractSignatures(contractId: string): Promise<SignatureRequest[]> {
    const query = `
      SELECT * FROM contract_signatures 
      WHERE contract_id = $1 
      ORDER BY created_at ASC
    `;

    const result = await sql.query(query, [contractId]);
    return (result as SignatureRequest[]) || [];
  }

  /**
   * Update contract signed count
   */
  private static async updateContractSignedCount(contractId: string): Promise<void> {
    const countQuery = `
      SELECT COUNT(*) as signed_count FROM contract_signatures 
      WHERE contract_id = $1 AND status = 'signed'
    `;

    const countResult = await sql.query(countQuery, [contractId]);
    const signedCount = parseInt((countResult[0] as any).signed_count, 10);

    const updateQuery = `
      UPDATE contracts 
      SET signed_count = $1
      WHERE id = $2
    `;

    await sql.query(updateQuery, [signedCount, contractId]);
  }

  /**
   * Verify signature data integrity
   */
  static async verifySignature(signatureData: string, contractId: string): Promise<boolean> {
    // TODO: Implement actual signature verification
    // For now, just check if signature exists and is not empty
    if (!signatureData || signatureData.length === 0) {
      return false;
    }

    // Check if signature is associated with contract
    const query = `
      SELECT COUNT(*) as count FROM contract_signatures 
      WHERE contract_id = $1 AND signature_data = $2
    `;

    const result = await sql.query(query, [contractId, signatureData]);
    return parseInt((result[0] as any).count, 10) > 0;
  }

  /**
   * Send signature reminder
   */
  static async sendReminder(signatureId: string, signerEmail: string, contractTitle: string): Promise<void> {
    // TODO: Integrate with email service
    const updateQuery = `
      UPDATE contract_signatures
      SET reminder_sent_at = NOW()
      WHERE id = $1
    `;

    await sql.query(updateQuery, [signatureId]);

    console.log(`[Signature Reminder] Sent to ${signerEmail} for contract: ${contractTitle}`);
  }

  /**
   * Decline signature request
   */
  static async declineSignature(signatureId: string, reason?: string): Promise<SignatureRequest> {
    const updateQuery = `
      UPDATE contract_signatures
      SET status = 'declined'
      WHERE id = $1
      RETURNING *
    `;

    const result = await sql.query(updateQuery, [signatureId]);

    if (!result || result.length === 0) {
      throw new Error('Signature record not found');
    }

    return result[0] as SignatureRequest;
  }

  /**
   * Get pending signatures (not yet signed)
   */
  static async getPendingSignatures(contractId: string): Promise<SignatureRequest[]> {
    const query = `
      SELECT * FROM contract_signatures 
      WHERE contract_id = $1 AND status = 'pending'
      ORDER BY created_at ASC
    `;

    const result = await sql.query(query, [contractId]);
    return (result as SignatureRequest[]) || [];
  }

  /**
   * Get overdue signatures
   */
  static async getOverdueSignatures(): Promise<SignatureRequest[]> {
    const query = `
      SELECT * FROM contract_signatures 
      WHERE status = 'pending' AND expires_at < NOW()
      ORDER BY expires_at ASC
    `;

    const result = await sql.query(query);
    return (result as SignatureRequest[]) || [];
  }
}