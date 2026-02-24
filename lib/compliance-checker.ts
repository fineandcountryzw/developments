import { neon } from '@neondatabase/serverless';

const sql = neon(process.env.DATABASE_URL!);

export interface ComplianceStatus {
  contractId: string;
  status: string;
  isCompliant: boolean;
  issues: string[];
  pendingSignatures: number;
  requiredSignatures: number;
  daysToExpiry: number;
}

/**
 * Compliance Checker - Auditing and compliance tracking for contracts
 */
export class ComplianceChecker {
  /**
   * Validate contract compliance
   */
  static async validateContract(contractId: string): Promise<ComplianceStatus> {
    const contractQuery = 'SELECT * FROM contracts WHERE id = $1';
    const contractResult = await sql.query(contractQuery, [contractId]);

    if (!contractResult || contractResult.length === 0) {
      throw new Error('Contract not found');
    }

    const contract = contractResult[0];
    const issues: string[] = [];

    // Check if all required signatures are present
    const sigsQuery = `
      SELECT COUNT(*) as total, 
             SUM(CASE WHEN status = 'signed' THEN 1 ELSE 0 END) as signed
      FROM contract_signatures 
      WHERE contract_id = $1
    `;

    const sigsResult = await sql.query(sigsQuery, [contractId]);
    const signedCount = parseInt((sigsResult[0] as any)?.signed || 0, 10);
    const requiredSignatures = contract.required_signatures || 1;

    if (signedCount < requiredSignatures) {
      issues.push(`Missing ${requiredSignatures - signedCount} signatures`);
    }

    // Check if contract has expired
    let daysToExpiry = Number.MAX_VALUE;
    if (contract.end_date) {
      const endDate = new Date(contract.end_date);
      const today = new Date();
      daysToExpiry = Math.floor((endDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

      if (daysToExpiry < 0) {
        issues.push(`Contract has expired ${Math.abs(daysToExpiry)} days ago`);
      } else if (daysToExpiry < 30) {
        issues.push(`Contract expiring in ${daysToExpiry} days`);
      }
    }

    // Check if content has required elements
    if (!contract.content || contract.content.length < 100) {
      issues.push('Contract content appears incomplete');
    }

    // Check audit trail
    const activitiesQuery = 'SELECT COUNT(*) as count FROM contract_activities WHERE contract_id = $1';
    const activitiesResult = await sql.query(activitiesQuery, [contractId]);
    const activityCount = parseInt((activitiesResult[0] as any)?.count, 10);

    if (activityCount === 0) {
      issues.push('No audit trail found');
    }

    return {
      contractId,
      status: contract.status,
      isCompliant: issues.length === 0,
      issues,
      pendingSignatures: requiredSignatures - signedCount,
      requiredSignatures,
      daysToExpiry
    };
  }

  /**
   * Generate compliance report for date range
   */
  static async generateComplianceReport(
    branch: string,
    startDate: Date,
    endDate: Date
  ): Promise<{
    totalContracts: number;
    compliant: number;
    nonCompliant: number;
    pendingSignatures: number;
    expiredContracts: number;
    expiringThirtyDays: number;
  }> {
    const contractsQuery = `
      SELECT id, status, required_signatures, end_date FROM contracts 
      WHERE branch = $1 AND created_at BETWEEN $2 AND $3
    `;

    const contractsResult = await sql.query(contractsQuery, [
      branch,
      startDate,
      endDate
    ]);

    const contracts = contractsResult as any[] || [];
    let compliant = 0;
    let nonCompliant = 0;
    let pendingSignatures = 0;
    let expiredContracts = 0;
    let expiringThirtyDays = 0;

    for (const contract of contracts) {
      const status = await this.validateContract(contract.id);

      if (status.isCompliant) {
        compliant++;
      } else {
        nonCompliant++;
      }

      pendingSignatures += status.pendingSignatures;

      if (status.daysToExpiry < 0) {
        expiredContracts++;
      } else if (status.daysToExpiry < 30) {
        expiringThirtyDays++;
      }
    }

    return {
      totalContracts: contracts.length,
      compliant,
      nonCompliant,
      pendingSignatures,
      expiredContracts,
      expiringThirtyDays
    };
  }

  /**
   * Get all contracts with overdue signatures
   */
  static async getOverdueSignatureContracts(): Promise<any[]> {
    const query = `
      SELECT DISTINCT c.* FROM contracts c
      INNER JOIN contract_signatures cs ON c.id = cs.contract_id
      WHERE cs.status = 'pending' AND cs.expires_at < NOW()
      ORDER BY cs.expires_at ASC
    `;

    const result = await sql.query(query);
    return result || [];
  }

  /**
   * Get contracts expiring soon
   */
  static async getExpiringContracts(daysFromNow: number = 30): Promise<any[]> {
    const expiryDate = new Date();
    expiryDate.setDate(expiryDate.getDate() + daysFromNow);

    const query = `
      SELECT * FROM contracts 
      WHERE end_date IS NOT NULL 
        AND end_date > NOW() 
        AND end_date <= $1
      ORDER BY end_date ASC
    `;

    const result = await sql.query(query, [expiryDate]);
    return result || [];
  }

  /**
   * Get audit trail for contract
   */
  static async getAuditTrail(contractId: string): Promise<any[]> {
    const query = `
      SELECT * FROM contract_activities 
      WHERE contract_id = $1 
      ORDER BY created_at DESC
    `;

    const result = await sql.query(query, [contractId]);
    return result || [];
  }

  /**
   * Log audit event
   */
  static async logAuditEvent(
    contractId: string,
    action: string,
    actorId: string,
    details: Record<string, any>,
    ipAddress?: string
  ): Promise<void> {
    const query = `
      INSERT INTO contract_activities (
        id, contract_id, action, actor_id, details, ip_address, created_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, NOW())
    `;

    await sql.query(query, [
      Math.random().toString(36).substring(7),
      contractId,
      action,
      actorId,
      JSON.stringify(details),
      ipAddress
    ]);
  }

  /**
   * Verify document integrity (via hash)
   */
  static async verifyDocumentIntegrity(contractId: string, contentHash: string): Promise<boolean> {
    const query = 'SELECT content FROM contracts WHERE id = $1';
    const result = await sql.query(query, [contractId]);

    if (!result || result.length === 0) {
      return false;
    }

    // TODO: Implement actual hash verification
    // For now, just verify content exists
    return !!(result[0] as any)?.content;
  }

  /**
   * Generate SLA compliance metrics
   */
  static async generateSLAMetrics(branch: string): Promise<{
    averageTimeToSign: number;
    averageTimeToExecute: number;
    onTimeSigningRate: number;
    onTimeExecutionRate: number;
  }> {
    // Get contracts that are signed or executed
    const query = `
      SELECT 
        EXTRACT(DAY FROM (signed_at - created_at)) as days_to_sign,
        EXTRACT(DAY FROM (updated_at - created_at)) as days_to_execute
      FROM contracts 
      WHERE branch = $1 
        AND (status = 'signed' OR status = 'executed')
        AND signed_at IS NOT NULL
      LIMIT 100
    `;

    const result = await sql.query(query, [branch]);
    const records = (result as any[]) || [];

    if (records.length === 0) {
      return {
        averageTimeToSign: 0,
        averageTimeToExecute: 0,
        onTimeSigningRate: 0,
        onTimeExecutionRate: 0
      };
    }

    const avgTimeToSign = records.reduce((sum: number, r: any) => sum + (r.days_to_sign || 0), 0) / records.length;
    const avgTimeToExecute = records.reduce((sum: number, r: any) => sum + (r.days_to_execute || 0), 0) / records.length;

    // Calculate on-time rate (SLA target: 5 days to sign, 10 days to execute)
    const onTimeSigningCount = records.filter((r: any) => (r.days_to_sign || 0) <= 5).length;
    const onTimeExecutionCount = records.filter((r: any) => (r.days_to_execute || 0) <= 10).length;

    return {
      averageTimeToSign: Math.round(avgTimeToSign * 10) / 10,
      averageTimeToExecute: Math.round(avgTimeToExecute * 10) / 10,
      onTimeSigningRate: Math.round((onTimeSigningCount / records.length) * 100),
      onTimeExecutionRate: Math.round((onTimeExecutionCount / records.length) * 100)
    };
  }
}