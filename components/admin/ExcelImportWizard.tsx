/**
 * Excel Import Wizard for LakeCity Format with Format Auto-Detection
 * 
 * Handles the complete flow:
 * 1. Upload Excel file (.xlsx)
 * 2. Auto-detect format (LakeCity Ledger vs Flat CSV/Excel)
 * 3. Show format detection results
 * 4. Parse and preview (dry run)
 * 5. Show validation issues
 * 6. Execute live import
 * 7. Show results with batch ID
 */

'use client';

import React, { useState, useCallback } from 'react';
import { 
  Upload, FileSpreadsheet, FileText, AlertCircle, CheckCircle, 
  X, ChevronRight, ChevronLeft, Building2, Users, 
  CreditCard, Calendar, AlertTriangle, Info, FileCheck,
  Table, FileType
} from 'lucide-react';
import { Button } from '../ui/button';

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

type FileFormat = 'FLAT_CSV' | 'FLAT_EXCEL' | 'LAKECITY_LEDGER' | 'UNKNOWN';

interface FormatDetectionResult {
  format: FileFormat;
  sheets?: string[];
  standCount?: number;
  columnCount?: number;
  rowCount?: number;
  detectedSheets?: Array<{
    name: string;
    developer: string;
    development: string;
  }>;
}

interface ParseResult {
  success: boolean;
  parseId: string;
  fileName: string;
  summary: {
    totalSheets: number;
    totalStands: number;
    totalTransactions: number;
    totalCollected: number;
    invalidDateCount: number;
    missingAgentCount: number;
    duplicateStandCount: number;
  };
  developers: Array<{ name: string; standCount: number }>;
  developments: Array<{
    name: string;
    developerName: string;
    priceTier: number;
    standCount: number;
    stands: Array<{
      standNumber: string;
      clientName: string;
      agentCode: string | null;
      isDuplicate: boolean;
      transactionCount: number;
      totals: {
        clientPayments: number;
        disbursements: number;
        balance: number;
      };
    }>;
  }>;
  validationIssues: {
    invalidDates: Array<{ sheet: string; row: number; value: string }>;
    missingAgentCount: number;
    duplicateStands: Array<{ sheet: string; standNumber: string; development: string }>;
  };
  errors: Array<{ sheet: string; row: number; message: string }>;
}

interface ImportResult {
  success: boolean;
  batchId: string;
  counts: {
    developersCreated: number;
    developmentsCreated: number;
    standsCreated: number;
    clientsCreated: number;
    salesCreated: number;
    paymentsCreated: number;
    transactionsImported: number;
    transactionsSkipped: number;
  };
  logs: Array<{
    row: number;
    type: string;
    message: string;
    severity: 'info' | 'warning' | 'error';
  }>;
  errors: string[];
}

// ─────────────────────────────────────────────────────────────────────────────
// Components
// ─────────────────────────────────────────────────────────────────────────────

export const ExcelImportWizard: React.FC = () => {
  const [step, setStep] = useState<'upload' | 'detecting' | 'format-detected' | 'parsing' | 'preview' | 'importing' | 'complete'>('upload');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [formatDetection, setFormatDetection] = useState<FormatDetectionResult | null>(null);
  const [parseResult, setParseResult] = useState<ParseResult | null>(null);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  // Handle file drop
  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file && (file.name.endsWith('.xlsx') || file.name.endsWith('.xls') || file.name.endsWith('.csv'))) {
      setSelectedFile(file);
      setError(null);
    } else {
      setError('Please upload an Excel file (.xlsx, .xls) or CSV file');
    }
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.name.endsWith('.xlsx') || file.name.endsWith('.xls') || file.name.endsWith('.csv')) {
        setSelectedFile(file);
        setError(null);
      } else {
        setError('Please upload an Excel file (.xlsx, .xls) or CSV file');
      }
    }
  }, []);

  // Step 1: Detect Format
  const handleDetectFormat = async () => {
    if (!selectedFile) return;

    setStep('detecting');
    setError(null);

    try {
      const formData = new FormData();
      formData.append('file', selectedFile);

      // First, detect the format
      const response = await fetch('/api/import/detect-format', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        throw new Error('Failed to detect format');
      }

      const detection = await response.json();
      setFormatDetection(detection);
      setStep('format-detected');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Format detection failed');
      setStep('upload');
    }
  };

  // Step 2: Parse the file (dry run)
  const handleParse = async () => {
    if (!selectedFile) return;

    setStep('parsing');
    setError(null);

    try {
      const formData = new FormData();
      formData.append('file', selectedFile);
      formData.append('dryRun', 'true');

      const response = await fetch('/api/import/execute', {
        method: 'POST',
        body: formData,
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to parse file');
      }

      // For now, simulate parse result from the execute endpoint
      // In production, you'd have a separate parse endpoint
      setParseResult({
        success: true,
        parseId: result.batchId || `parse_${Date.now()}`,
        fileName: selectedFile.name,
        summary: {
          totalSheets: result.summary?.totalSheets || formatDetection?.sheets?.length || 0,
          totalStands: result.counts?.standsCreated || 0,
          totalTransactions: result.counts?.transactionsImported || 0,
          totalCollected: result.summary?.totalCollected || 0,
          invalidDateCount: 0,
          missingAgentCount: 0,
          duplicateStandCount: 0,
        },
        developers: result.developers || [],
        developments: result.developments || [],
        validationIssues: {
          invalidDates: [],
          missingAgentCount: 0,
          duplicateStands: [],
        },
        errors: result.errors || [],
      });
      setStep('preview');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Parse failed');
      setStep('format-detected');
    }
  };

  // Step 3: Execute live import
  const handleImport = async () => {
    if (!selectedFile) return;

    setStep('importing');
    setError(null);

    try {
      const formData = new FormData();
      formData.append('file', selectedFile);
      formData.append('skipErrors', 'true');
      formData.append('dryRun', 'false');

      const response = await fetch('/api/import/execute', {
        method: 'POST',
        body: formData,
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Import failed');
      }

      setImportResult(result);
      setStep('complete');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Import failed');
      setStep('preview');
    }
  };

  const handleReset = () => {
    setStep('upload');
    setSelectedFile(null);
    setFormatDetection(null);
    setParseResult(null);
    setImportResult(null);
    setError(null);
  };

  // Get format display info
  const getFormatInfo = (format: FileFormat) => {
    switch (format) {
      case 'LAKECITY_LEDGER':
        return {
          label: 'LakeCity Ledger Format',
          icon: <Table className="w-5 h-5 text-blue-600" />,
          color: 'bg-blue-100 text-blue-800',
          description: 'Legacy ledger-style Excel with stands as blocks',
        };
      case 'FLAT_CSV':
        return {
          label: 'CSV File',
          icon: <FileText className="w-5 h-5 text-green-600" />,
          color: 'bg-green-100 text-green-800',
          description: 'Standard comma-separated values file',
        };
      case 'FLAT_EXCEL':
        return {
          label: 'Standard Excel',
          icon: <FileSpreadsheet className="w-5 h-5 text-purple-600" />,
          color: 'bg-purple-100 text-purple-800',
          description: 'Flat table format Excel file',
        };
      default:
        return {
          label: 'Unknown Format',
          icon: <AlertCircle className="w-5 h-5 text-red-600" />,
          color: 'bg-red-100 text-red-800',
          description: 'Could not determine file format',
        };
    }
  };

  // ─────────────────────────────────────────────────────────────────────────
  // Render Steps
  // ─────────────────────────────────────────────────────────────────────────

  return (
    <div className="max-w-6xl mx-auto py-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Data Import Wizard</h1>
          <p className="text-gray-500 mt-1">
            Import legacy LakeCity Excel files or standard CSV/Excel formats.
          </p>
        </div>
        {step !== 'upload' && (
          <Button variant="outline" onClick={handleReset}>
            Start Over
          </Button>
        )}
      </div>

      {/* Progress Steps */}
      <div className="flex items-center justify-center mb-10">
        {[
          { key: 'upload', label: 'Upload' },
          { key: 'detect', label: 'Detect' },
          { key: 'preview', label: 'Preview' },
          { key: 'import', label: 'Import' },
        ].map((s, idx) => {
          const isActive = 
            step === s.key ||
            (step === 'detecting' && s.key === 'detect') ||
            (step === 'format-detected' && s.key === 'detect') ||
            (step === 'parsing' && s.key === 'preview') ||
            (step === 'importing' && s.key === 'import') ||
            (step === 'complete' && idx < 3);
          
          const isComplete = step === 'complete' || 
            (step === 'importing' && idx < 3) ||
            (step === 'preview' && idx < 2) ||
            (step === 'parsing' && idx < 2);

          return (
            <React.Fragment key={s.key}>
              <div className="flex flex-col items-center">
                <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm ${
                  isActive ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-400'
                }`}>
                  {isComplete ? <CheckCircle size={20} /> : idx + 1}
                </div>
                <span className="text-xs font-semibold mt-2 text-gray-500 uppercase tracking-wider">
                  {s.label}
                </span>
              </div>
              {idx < 3 && (
                <div className={`w-24 h-0.5 mx-4 -mt-6 ${
                  isActive ? 'bg-blue-600' : 'bg-gray-100'
                }`} />
              )}
            </React.Fragment>
          );
        })}
      </div>

      {/* Step: Upload */}
      {step === 'upload' && (
        <div className="bg-white border border-gray-200 rounded-2xl p-8 shadow-sm">
          <div
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            className={`border-2 border-dashed rounded-xl p-16 text-center transition-colors ${
              isDragging ? 'border-blue-500 bg-blue-50' : 'border-gray-300 hover:border-gray-400'
            }`}
          >
            <div className="flex justify-center mb-4">
              <div className={`p-4 rounded-full ${isDragging ? 'bg-blue-100' : 'bg-gray-100'}`}>
                <Upload className={`w-10 h-10 ${isDragging ? 'text-blue-600' : 'text-gray-500'}`} />
              </div>
            </div>
            <h3 className="text-lg font-medium text-gray-900 mb-2">
              Drop your file here
            </h3>
            <p className="text-gray-500 mb-6">
              Supports .xlsx, .xls, and .csv files
            </p>
            <label className="inline-flex">
              <input
                type="file"
                accept=".xlsx,.xls,.csv"
                onChange={handleFileSelect}
                className="hidden"
              />
              <span className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 cursor-pointer">
                Select File
              </span>
            </label>
          </div>

          {selectedFile && (
            <div className="mt-6 p-4 bg-green-50 border border-green-200 rounded-lg">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <FileCheck className="w-5 h-5 text-green-600" />
                  <div>
                    <p className="font-medium text-gray-900">{selectedFile.name}</p>
                    <p className="text-sm text-gray-500">
                      {(selectedFile.size / 1024).toFixed(1)} KB
                    </p>
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button variant="ghost" size="sm" onClick={() => setSelectedFile(null)}>
                    <X className="w-4 h-4" />
                  </Button>
                  <Button onClick={handleDetectFormat}>
                    Continue <ChevronRight className="w-4 h-4 ml-1" />
                  </Button>
                </div>
              </div>
            </div>
          )}

          {error && (
            <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 flex items-center gap-2">
              <AlertCircle className="w-5 h-5" />
              {error}
            </div>
          )}

          {/* Instructions */}
          <div className="mt-8 grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-6">
              <div className="flex items-start gap-4">
                <Table className="w-5 h-5 text-amber-600 mt-0.5" />
                <div>
                  <h4 className="font-semibold text-amber-900 mb-2">LakeCity Ledger Format</h4>
                  <ul className="text-sm text-amber-800 space-y-1 list-disc pl-4">
                    <li>Excel files with multiple sheets</li>
                    <li>Each stand = block of rows</li>
                    <li>Two-sided accounting (LEFT/RIGHT)</li>
                    <li>Agent codes in header row</li>
                  </ul>
                </div>
              </div>
            </div>
            <div className="bg-green-50 border border-green-200 rounded-xl p-6">
              <div className="flex items-start gap-4">
                <FileText className="w-5 h-5 text-green-600 mt-0.5" />
                <div>
                  <h4 className="font-semibold text-green-900 mb-2">Standard CSV/Excel</h4>
                  <ul className="text-sm text-green-800 space-y-1 list-disc pl-4">
                    <li>Flat table format</li>
                    <li>One row per record</li>
                    <li>Standard column headers</li>
                    <li>Download templates below</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>

          {/* Templates */}
          <div className="mt-6 bg-gray-50 rounded-xl p-6">
            <h4 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <FileType className="w-4 h-4" />
              Download Templates (Standard Format)
            </h4>
            <div className="flex flex-wrap gap-3">
              <a href="/templates/stands_template.csv" download className="px-4 py-2 bg-white border border-gray-200 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50">
                Stands Template
              </a>
              <a href="/templates/sales_template.csv" download className="px-4 py-2 bg-white border border-gray-200 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50">
                Sales Template
              </a>
              <a href="/templates/payments_template.csv" download className="px-4 py-2 bg-white border border-gray-200 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50">
                Payments Template
              </a>
              <a href="/templates/clients_template.csv" download className="px-4 py-2 bg-white border border-gray-200 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50">
                Clients Template
              </a>
            </div>
          </div>
        </div>
      )}

      {/* Step: Detecting Format */}
      {step === 'detecting' && (
        <div className="bg-white border border-gray-200 rounded-2xl p-16 shadow-sm text-center">
          <div className="animate-spin w-16 h-16 border-4 border-blue-600 border-t-transparent rounded-full mx-auto mb-6" />
          <h3 className="text-xl font-bold text-gray-900">Detecting File Format...</h3>
          <p className="text-gray-500 mt-2">
            Analyzing file structure to determine the import method.
          </p>
        </div>
      )}

      {/* Step: Format Detected */}
      {step === 'format-detected' && formatDetection && (
        <div className="bg-white border border-gray-200 rounded-2xl p-8 shadow-sm">
          <div className="text-center mb-8">
            <div className={`inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium ${getFormatInfo(formatDetection.format).color}`}>
              {getFormatInfo(formatDetection.format).icon}
              {getFormatInfo(formatDetection.format).label}
            </div>
            <p className="text-gray-500 mt-2">{getFormatInfo(formatDetection.format).description}</p>
          </div>

          {/* Format-specific details */}
          {formatDetection.format === 'LAKECITY_LEDGER' && formatDetection.detectedSheets && (
            <div className="mb-6">
              <h4 className="font-semibold text-gray-900 mb-3">Detected Sheets ({formatDetection.detectedSheets.length})</h4>
              <div className="space-y-2">
                {formatDetection.detectedSheets.map((sheet, idx) => (
                  <div key={idx} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <div>
                      <p className="font-medium text-gray-900">{sheet.name}</p>
                      <p className="text-sm text-gray-500">{sheet.development}</p>
                    </div>
                    <span className="text-xs text-gray-400">{sheet.developer}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {(formatDetection.format === 'FLAT_CSV' || formatDetection.format === 'FLAT_EXCEL') && (
            <div className="mb-6 p-4 bg-amber-50 border border-amber-200 rounded-lg">
              <div className="flex items-start gap-3">
                <Info className="w-5 h-5 text-amber-600 mt-0.5" />
                <div>
                  <p className="font-medium text-amber-900">Flat Format Detected</p>
                  <p className="text-sm text-amber-700 mt-1">
                    This file uses the standard table format. You'll need to map columns in the next step.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex justify-between">
            <Button variant="outline" onClick={() => setStep('upload')}>
              <ChevronLeft className="w-4 h-4 mr-1" /> Back
            </Button>
            <Button onClick={handleParse} className="bg-blue-600 hover:bg-blue-700">
              Continue to Preview <ChevronRight className="w-4 h-4 ml-1" />
            </Button>
          </div>
        </div>
      )}

      {/* Step: Parsing */}
      {step === 'parsing' && (
        <div className="bg-white border border-gray-200 rounded-2xl p-16 shadow-sm text-center">
          <div className="animate-spin w-16 h-16 border-4 border-blue-600 border-t-transparent rounded-full mx-auto mb-6" />
          <h3 className="text-xl font-bold text-gray-900">Parsing File...</h3>
          <p className="text-gray-500 mt-2">
            Analyzing stands, transactions, and validation rules.
          </p>
        </div>
      )}

      {/* Step: Preview */}
      {step === 'preview' && parseResult && (
        <div className="space-y-6">
          {/* Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="bg-white border border-gray-200 rounded-xl p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-blue-100 rounded-lg">
                  <Building2 className="w-5 h-5 text-blue-600" />
                </div>
                <div>
                  <p className="text-sm text-gray-500">Sheets</p>
                  <p className="text-xl font-bold">{parseResult.summary.totalSheets}</p>
                </div>
              </div>
            </div>
            <div className="bg-white border border-gray-200 rounded-xl p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-green-100 rounded-lg">
                  <Users className="w-5 h-5 text-green-600" />
                </div>
                <div>
                  <p className="text-sm text-gray-500">Stands</p>
                  <p className="text-xl font-bold">{parseResult.summary.totalStands}</p>
                </div>
              </div>
            </div>
            <div className="bg-white border border-gray-200 rounded-xl p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-purple-100 rounded-lg">
                  <CreditCard className="w-5 h-5 text-purple-600" />
                </div>
                <div>
                  <p className="text-sm text-gray-500">Transactions</p>
                  <p className="text-xl font-bold">{parseResult.summary.totalTransactions}</p>
                </div>
              </div>
            </div>
            <div className="bg-white border border-gray-200 rounded-xl p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-amber-100 rounded-lg">
                  <span className="text-amber-600 font-bold">$</span>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Total Collected</p>
                  <p className="text-xl font-bold">
                    ${parseResult.summary.totalCollected.toLocaleString()}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Developers & Developments */}
          <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm">
            <h3 className="text-lg font-bold text-gray-900 mb-4">Developers & Developments</h3>
            <div className="space-y-3">
              {parseResult.developments.map((dev, idx) => (
                <div key={idx} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <div>
                    <p className="font-medium text-gray-900">{dev.name}</p>
                    <p className="text-sm text-gray-500">{dev.developerName}</p>
                  </div>
                  <div className="text-right">
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                      {dev.standCount} stands
                    </span>
                    {dev.priceTier > 0 && (
                      <span className="ml-2 inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                        ${dev.priceTier.toLocaleString()}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Validation Issues */}
          {(parseResult.validationIssues.invalidDates.length > 0 ||
            parseResult.validationIssues.missingAgentCount > 0 ||
            parseResult.validationIssues.duplicateStands.length > 0) && (
            <div className="bg-amber-50 border border-amber-200 rounded-2xl p-6">
              <h3 className="text-lg font-bold text-amber-900 mb-4 flex items-center gap-2">
                <AlertTriangle className="w-5 h-5" />
                Validation Issues
              </h3>
              
              {parseResult.validationIssues.invalidDates.length > 0 && (
                <div className="mb-4">
                  <p className="font-medium text-amber-800 mb-2">
                    Invalid Dates ({parseResult.validationIssues.invalidDates.length})
                  </p>
                  <p className="text-sm text-amber-700">
                    These transactions will be skipped during import.
                  </p>
                </div>
              )}

              {parseResult.validationIssues.missingAgentCount > 0 && (
                <div className="mb-4">
                  <p className="font-medium text-amber-800 mb-2">
                    Missing Agent Codes ({parseResult.validationIssues.missingAgentCount} stands)
                  </p>
                  <p className="text-sm text-amber-700">
                    Agent name will be set to NULL for these stands.
                  </p>
                </div>
              )}

              {parseResult.validationIssues.duplicateStands.length > 0 && (
                <div>
                  <p className="font-medium text-amber-800 mb-2">
                    Duplicate Stands ({parseResult.validationIssues.duplicateStands.length})
                  </p>
                  <p className="text-sm text-amber-700">
                    Both records will be imported with sheet name suffix.
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex justify-between">
            <Button variant="outline" onClick={() => setStep('format-detected')}>
              <ChevronLeft className="w-4 h-4 mr-1" /> Back
            </Button>
            <Button onClick={handleImport} className="bg-blue-600 hover:bg-blue-700">
              Execute Import <ChevronRight className="w-4 h-4 ml-1" />
            </Button>
          </div>
        </div>
      )}

      {/* Step: Importing */}
      {step === 'importing' && (
        <div className="bg-white border border-gray-200 rounded-2xl p-16 shadow-sm text-center">
          <div className="animate-spin w-16 h-16 border-4 border-blue-600 border-t-transparent rounded-full mx-auto mb-6" />
          <h3 className="text-xl font-bold text-gray-900">Executing Import...</h3>
          <p className="text-gray-500 mt-2">
            Creating developers, developments, stands, and payments in database.
          </p>
        </div>
      )}

      {/* Step: Complete */}
      {step === 'complete' && importResult && (
        <div className="bg-white border border-gray-200 rounded-2xl p-8 shadow-sm">
          <div className="text-center mb-8">
            <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <CheckCircle className="w-10 h-10 text-green-600" />
            </div>
            <h2 className="text-2xl font-bold text-gray-900 mb-2">Import Complete!</h2>
            <p className="text-gray-600">
              Batch ID: <code className="bg-gray-100 px-2 py-1 rounded text-sm">{importResult.batchId}</code>
            </p>
          </div>

          {/* Results Grid */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
            <div className="bg-gray-50 rounded-lg p-4 text-center">
              <p className="text-2xl font-bold text-gray-900">{importResult.counts.developersCreated}</p>
              <p className="text-sm text-gray-500">Developers</p>
            </div>
            <div className="bg-gray-50 rounded-lg p-4 text-center">
              <p className="text-2xl font-bold text-gray-900">{importResult.counts.developmentsCreated}</p>
              <p className="text-sm text-gray-500">Developments</p>
            </div>
            <div className="bg-gray-50 rounded-lg p-4 text-center">
              <p className="text-2xl font-bold text-gray-900">{importResult.counts.standsCreated}</p>
              <p className="text-sm text-gray-500">Stands</p>
            </div>
            <div className="bg-gray-50 rounded-lg p-4 text-center">
              <p className="text-2xl font-bold text-gray-900">{importResult.counts.paymentsCreated}</p>
              <p className="text-sm text-gray-500">Payments</p>
            </div>
          </div>

          {importResult.counts.transactionsSkipped > 0 && (
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mb-6">
              <p className="text-amber-800">
                <AlertCircle className="w-4 h-4 inline mr-1" />
                {importResult.counts.transactionsSkipped} transactions skipped (invalid dates)
              </p>
            </div>
          )}

          <div className="flex justify-center gap-4">
            <Button variant="outline" onClick={handleReset}>
              Import Another File
            </Button>
            <Button className="bg-blue-600 hover:bg-blue-700">
              View Import Batches
            </Button>
          </div>
        </div>
      )}
    </div>
  );
};
