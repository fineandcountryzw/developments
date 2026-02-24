-- Migration: Add DOCX Template Support
-- Date: 2026-02-09
-- Description: Add support for DOCX templates with file versioning

-- Add DOCX template fields to contract_templates table
ALTER TABLE contract_templates 
ADD COLUMN IF NOT EXISTS template_type VARCHAR(10) DEFAULT 'html',
ADD COLUMN IF NOT EXISTS template_file_url TEXT,
ADD COLUMN IF NOT EXISTS template_file_key TEXT,
ADD COLUMN IF NOT EXISTS template_variables JSONB DEFAULT '[]'::jsonb;

-- Create index for template_type
CREATE INDEX IF NOT EXISTS idx_contract_templates_template_type ON contract_templates(template_type);

-- Create contract_document_versions table for file versioning
CREATE TABLE IF NOT EXISTS contract_document_versions (
    id VARCHAR(25) PRIMARY KEY,
    contract_id VARCHAR(25) NOT NULL,
    template_id VARCHAR(25) NOT NULL,
    version INTEGER NOT NULL,
    document_type VARCHAR(10) NOT NULL,
    storage_key TEXT NOT NULL,
    storage_url TEXT NOT NULL,
    file_size INTEGER,
    checksum VARCHAR(64),
    generated_at TIMESTAMP DEFAULT NOW(),
    generated_by VARCHAR(25),
    CONSTRAINT fk_contract_document_versions_contract 
        FOREIGN KEY (contract_id) REFERENCES generated_contracts(id) ON DELETE CASCADE,
    CONSTRAINT fk_contract_document_versions_template 
        FOREIGN KEY (template_id) REFERENCES contract_templates(id) ON DELETE CASCADE,
    CONSTRAINT uk_contract_document_versions_unique 
        UNIQUE (contract_id, version, document_type)
);

-- Create indexes for contract_document_versions
CREATE INDEX IF NOT EXISTS idx_contract_document_versions_contract_id ON contract_document_versions(contract_id);
CREATE INDEX IF NOT EXISTS idx_contract_document_versions_template_id ON contract_document_versions(template_id);

-- Add comments for documentation
COMMENT ON COLUMN contract_templates.template_type IS 'Template type: html or docx';
COMMENT ON COLUMN contract_templates.template_file_url IS 'UploadThing URL for DOCX template file';
COMMENT ON COLUMN contract_templates.template_file_key IS 'UploadThing storage key for DOCX template file';
COMMENT ON COLUMN contract_templates.template_variables IS 'Detected variables from DOCX template (JSON array)';
COMMENT ON TABLE contract_document_versions IS 'Stores generated contract documents (DOCX, HTML, PDF) for versioning';
COMMENT ON COLUMN contract_document_versions.document_type IS 'Document type: html, docx, or pdf';
COMMENT ON COLUMN contract_document_versions.storage_key IS 'UploadThing storage key';
COMMENT ON COLUMN contract_document_versions.storage_url IS 'UploadThing URL for download';
COMMENT ON COLUMN contract_document_versions.checksum IS 'SHA-256 hash for integrity verification';