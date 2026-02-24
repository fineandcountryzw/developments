import { neon } from '@neondatabase/serverless';
import { 
  extractVariablesFromDocx,
  generateDocxFromTemplate,
  validateDocxTemplate,
  type DetectedVariable,
  type TemplateVariableContext
} from './docx-template-engine';
import { logger } from './logger';

const sql = neon(process.env.DATABASE_URL!);

export interface ContractVariables {
  [key: string]: string | number | boolean;
}

export interface ContractTemplate {
  id: string;
  name: string;
  content: string;
  variables?: string[];
  templateType?: 'html' | 'docx';
  templateFileUrl?: string;
  templateFileKey?: string;
  templateVariables?: any[];
}

export interface DocumentVersionData {
  id: string;
  contractId: string;
  templateId: string;
  version: number;
  documentType: 'html' | 'docx' | 'pdf';
  storageKey: string;
  storageUrl: string;
  fileSize?: number;
  checksum?: string;
  generatedAt: Date;
  generatedBy?: string;
}

export interface ContractData {
  id: string;
  templateId: string;
  clientId: string;
  dealId?: string;
  title: string;
  content: string;
  variables: ContractVariables;
  status: string;
  createdAt: Date;
  signed_count?: number;
  required_signatures?: number;
  templateType?: 'html' | 'docx';
  htmlContent?: string;
}

/**
 * Contract Generator - Handles contract creation and rendering
 */
export class ContractGenerator {
  /**
   * Generate contract from template with variable substitution
   * Supports both HTML and DOCX templates
   */
  static async generateFromTemplate(
    templateId: string,
    clientId: string,
    dealId: string | null,
    variables: ContractVariables,
    title: string,
    userId: string,
    branch: string = 'Harare'
  ): Promise<ContractData> {
    // Get template
    const templateQuery = 'SELECT * FROM contract_templates WHERE id = $1';
    const templateResult = await sql.query(templateQuery, [templateId]);

    if (!templateResult || templateResult.length === 0) {
      throw new Error('Template not found');
    }

    const template = templateResult[0];
    const templateType = template.template_type || 'html';
    
    let content: string;
    let htmlContent: string | null = null;

    // Generate content based on template type
    if (templateType === 'docx') {
      // DOCX template processing
      // For DOCX templates, we store the content as a placeholder since the actual
      // DOCX is stored separately. The HTML content is used for display.
      content = `[DOCX Template: ${template.name}]`;
      htmlContent = this.renderContent(template.content || '', variables);
      
      logger.info('[ContractGenerator] Generated contract from DOCX template', {
        templateId,
        templateType,
        clientId
      });
    } else {
      // HTML template processing
      content = this.renderContent(template.content, variables);
      htmlContent = content;
      
      logger.info('[ContractGenerator] Generated contract from HTML template', {
        templateId,
        templateType,
        clientId
      });
    }

    // Create contract
    const contractId = Math.random().toString(36).substring(7);
    const insertQuery = `
      INSERT INTO contracts (
        id, template_id, client_id, deal_id, title, content, variables, 
        branch, created_by, status, created_at, updated_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW(), NOW())
      RETURNING *
    `;

    const result = await sql.query(insertQuery, [
      contractId,
      templateId,
      clientId,
      dealId,
      title,
      content,
      JSON.stringify(variables),
      branch,
      userId,
      'draft'
    ]);

    // Log activity
    await this.logActivity(contractId, userId, 'created', {}, {}, null);

    return {
      ...result[0],
      templateType,
      htmlContent: htmlContent || undefined
    } as ContractData;
  }

  /**
   * Render template content with variable substitution
   */
  static renderContent(content: string, variables: ContractVariables): string {
    let rendered = content;

    // Replace {{variable}} placeholders
    Object.entries(variables).forEach(([key, value]) => {
      const placeholder = `{{${key}}}`;
      rendered = rendered.replace(new RegExp(placeholder, 'g'), String(value || ''));
    });

    // Replace {VARIABLE} placeholders (legacy format)
    Object.entries(variables).forEach(([key, value]) => {
      const placeholder = `{${key.toUpperCase()}}`;
      rendered = rendered.replace(new RegExp(placeholder, 'g'), String(value || ''));
    });

    return rendered;
  }

  /**
   * Get contract by ID
   */
  static async getContract(id: string): Promise<ContractData | null> {
    const query = 'SELECT * FROM contracts WHERE id = $1';
    const result = await sql.query(query, [id]);

    return (result?.[0] as ContractData) || null;
  }

  /**
   * Update contract status
   */
  static async updateStatus(
    contractId: string,
    status: string,
    userId: string
  ): Promise<ContractData> {
    const updateQuery = `
      UPDATE contracts 
      SET status = $1, updated_at = NOW()
      WHERE id = $2
      RETURNING *
    `;

    const result = await sql.query(updateQuery, [status, contractId]);

    if (!result || result.length === 0) {
      throw new Error('Contract not found');
    }

    // Log activity
    await this.logActivity(contractId, userId, status, {}, {}, null);

    return result[0] as ContractData;
  }

  /**
   * Create contract version for change tracking
   */
  static async createVersion(
    contractId: string,
    versionNumber: number,
    content: string,
    changes: Record<string, any>,
    changedBy?: string
  ): Promise<any> {
    const query = `
      INSERT INTO contract_versions (
        id, contract_id, version_number, content, changes, changed_by, created_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, NOW())
      RETURNING *
    `;

    const result = await sql.query(query, [
      Math.random().toString(36).substring(7),
      contractId,
      versionNumber,
      content,
      JSON.stringify(changes),
      changedBy
    ]);

    return result[0];
  }

  /**
   * Log contract activity
   */
  static async logActivity(
    contractId: string,
    actorId: string,
    action: string,
    changesBefore: Record<string, any>,
    changesAfter: Record<string, any>,
    ipAddress: string | null
  ): Promise<void> {
    const query = `
      INSERT INTO contract_activities (
        id, contract_id, action, actor_id, changes_before, changes_after, ip_address, created_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
    `;

    await sql.query(query, [
      Math.random().toString(36).substring(7),
      contractId,
      action,
      actorId,
      JSON.stringify(changesBefore),
      JSON.stringify(changesAfter),
      ipAddress
    ]);
  }

  /**
   * Get contract with signatures
   */
  static async getContractWithSignatures(contractId: string): Promise<any> {
    const contractQuery = 'SELECT * FROM contracts WHERE id = $1';
    const contractResult = await sql.query(contractQuery, [contractId]);

    if (!contractResult || contractResult.length === 0) {
      throw new Error('Contract not found');
    }

    const sigsQuery = 'SELECT * FROM contract_signatures WHERE contract_id = $1 ORDER BY created_at';
    const sigsResult = await sql.query(sigsQuery, [contractId]);

    return {
      ...(contractResult[0] as any),
      signatures: sigsResult || []
    };
  }

  /**
   * Calculate contract completion status
   */
  static async getCompletionStatus(contractId: string): Promise<{
    status: string;
    percentage: number;
    signedCount: number;
    requiredSignatures: number;
  }> {
    const contract = await this.getContract(contractId);

    if (!contract) {
      throw new Error('Contract not found');
    }

    const percentage = Math.round(
      ((contract.signed_count ?? 0) / (contract.required_signatures || 1)) * 100
    );

    return {
      status: contract.status,
      percentage,
      signedCount: contract.signed_count ?? 0,
      requiredSignatures: contract.required_signatures || 1
    };
  }

  /**
   * Generate DOCX document from template
   * Requires the template file buffer and variable context
   */
  static async generateDocxDocument(
    templateBuffer: Buffer,
    context: TemplateVariableContext
  ): Promise<Buffer> {
    try {
      const docxBuffer = generateDocxFromTemplate(templateBuffer, context);
      logger.info('[ContractGenerator] Generated DOCX document', {
        contextKeys: Object.keys(context)
      });
      return docxBuffer;
    } catch (error) {
      logger.error('[ContractGenerator] Failed to generate DOCX document', error as Error);
      throw new Error(`Failed to generate DOCX document: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Extract variables from DOCX template file
   */
  static async extractDocxVariables(docxBuffer: Buffer): Promise<DetectedVariable[]> {
    try {
      const variables = extractVariablesFromDocx(docxBuffer);
      logger.info('[ContractGenerator] Extracted variables from DOCX template', {
        count: variables.length,
        variables: variables.map(v => v.name)
      });
      return variables;
    } catch (error) {
      logger.error('[ContractGenerator] Failed to extract DOCX variables', error as Error);
      throw new Error(`Failed to extract DOCX variables: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Validate DOCX template file
   */
  static validateDocxTemplate(fileBuffer: Buffer): { valid: boolean; error?: string } {
    return validateDocxTemplate(fileBuffer);
  }

  /**
   * Create document version record for file versioning
   */
  static async createDocumentVersion(
    contractId: string,
    templateId: string,
    version: number,
    documentType: 'html' | 'docx' | 'pdf',
    storageKey: string,
    storageUrl: string,
    fileSize?: number,
    checksum?: string,
    generatedBy?: string
  ): Promise<DocumentVersionData> {
    const query = `
      INSERT INTO contract_document_versions (
        id, contract_id, template_id, version, document_type, 
        storage_key, storage_url, file_size, checksum, generated_at, generated_by
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW(), $10)
      RETURNING *
    `;

    const result = await sql.query(query, [
      Math.random().toString(36).substring(7),
      contractId,
      templateId,
      version,
      documentType,
      storageKey,
      storageUrl,
      fileSize,
      checksum,
      generatedBy
    ]);

    logger.info('[ContractGenerator] Created document version', {
      contractId,
      version,
      documentType,
      storageKey
    });

    return result[0] as DocumentVersionData;
  }

  /**
   * Get document versions for a contract
   */
  static async getDocumentVersions(
    contractId: string,
    documentType?: 'html' | 'docx' | 'pdf'
  ): Promise<DocumentVersionData[]> {
    let query = 'SELECT * FROM contract_document_versions WHERE contract_id = $1';
    const params: any[] = [contractId];

    if (documentType) {
      query += ' AND document_type = $2';
      params.push(documentType);
    }

    query += ' ORDER BY version DESC';

    const result = await sql.query(query, params);
    return result as DocumentVersionData[];
  }

  /**
   * Get latest document version for a contract
   */
  static async getLatestDocumentVersion(
    contractId: string,
    documentType: 'html' | 'docx' | 'pdf'
  ): Promise<DocumentVersionData | null> {
    const query = `
      SELECT * FROM contract_document_versions 
      WHERE contract_id = $1 AND document_type = $2 
      ORDER BY version DESC 
      LIMIT 1
    `;

    const result = await sql.query(query, [contractId, documentType]);
    return (result?.[0] as DocumentVersionData) || null;
  }
}