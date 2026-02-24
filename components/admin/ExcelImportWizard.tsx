/**
 * Excel Import Wizard for LakeCity Format
 * 
 * Handles the complete flow:
 * 1. Upload Excel file (.xlsx)
 * 2. Parse and preview (dry run)
 * 3. Show validation issues (invalid dates, duplicates, missing agents)
 * 4. Execute live import
 * 5. Show results with batch ID
 */

'use client';

import React, { useState, useCallback } from 'react';
import { 
  Upload, FileSpreadsheet, AlertCircle, CheckCircle, 
  X, ChevronRight, ChevronLeft, Building2, Users, 
  CreditCard, Calendar, AlertTriangle, Info
} from 'lucide-react';
import { Button } from '../ui/button';

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

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
  const [step, setStep] = useState<'upload' | 'parsing' | 'preview' | 'importing' | 'complete'>('upload');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [parseResult, setParseResult] = useState<ParseResult | null>(null);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  // Handle file drop
  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file && (file.name.endsWith('.xlsx') || file.name.endsWith('.xls'))) {
      setSelectedFile(file);
      setError(null);
    } else {
      setError('Please upload an Excel file (.xlsx or .xls)');
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
      if (file.name.endsWith('.xlsx') || file.name.endsWith('.xls')) {
        setSelectedFile(file);
        setError(null);
      } else {
        setError('Please upload an Excel file (.xlsx or .xls)');
      }
    }
  }, []);

  // Parse the Excel file (dry run)
  const handleParse = async () => {
    if (!selectedFile) return;

    setStep('parsing');
    setError(null);

    try {
      const formData = new FormData();
      formData.append('file', selectedFile);

      const response = await fetch('/api/admin/import/excel/parse', {
        method: 'POST',
        body: formData,
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to parse Excel file');
      }

      setParseResult(result);
      setStep('preview');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Parse failed');
      setStep('upload');
    }
  };

  // Execute live import
  const handleImport = async () => {
    if (!selectedFile || !parseResult) return;

    setStep('importing');
    setError(null);

    try {
      // Read file as base64 for the execute API
      const buffer = await selectedFile.arrayBuffer();
      const base64 = Buffer.from(buffer).toString('base64');

      const response = await fetch('/api/admin/import/excel/execute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fileBuffer: base64,
          fileName: selectedFile.name,
          options: {
            skipInvalidDates: true,
            allowFutureDates: true,
            duplicateSuffix: 'sheet',
            dryRun: false,
          },
        }),
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
    setParseResult(null);
    setImportResult(null);
    setError(null);
  };

  // ─────────────────────────────────────────────────────────────────────────
  // Render Steps
  // ─────────────────────────────────────────────────────────────────────────

  return (
    <div className="max-w-6xl mx-auto py-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Excel Import Wizard</h1>
          <p className="text-gray-500 mt-1">
            Import legacy LakeCity Excel files with ledger-style data.
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
          { key: 'preview', label: 'Preview' },
          { key: 'complete', label: 'Import' },
        ].map((s, idx) => (
          <React.Fragment key={s.key}>
            <div className="flex flex-col items-center">
              <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm ${
                step === s.key || 
                (step === 'parsing' && s.key === 'preview') ||
                (step === 'importing' && s.key === 'complete') ||
                (step === 'complete' && idx < 2)
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-400'
              }`}>
                {step === 'complete' && idx < 2 ? (
                  <CheckCircle size={20} />
                ) : (
                  idx + 1
                )}
              </div>
              <span className="text-xs font-semibold mt-2 text-gray-500 uppercase tracking-wider">
                {s.label}
              </span>
            </div>
            {idx < 2 && (
              <div className={`w-24 h-0.5 mx-4 -mt-6 ${
                step === 'preview' || step === 'importing' || step === 'complete'
                  ? 'bg-blue-600'
                  : 'bg-gray-100'
              }`} />
            )}
          </React.Fragment>
        ))}
      </div>

      {/* Step: Upload */}
      {step === 'upload' && (
        <div className="bg-white border border-gray-200 rounded-2xl p-8 shadow-sm">
          <div
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            className={`border-2 border-dashed rounded-xl p-16 text-center transition-colors ${
              isDragging
                ? 'border-blue-500 bg-blue-50'
                : 'border-gray-300 hover:border-gray-400'
            }`}
          >
            <div className="flex justify-center mb-4">
              <div className={`p-4 rounded-full ${isDragging ? 'bg-blue-100' : 'bg-gray-100'}`}>
                <FileSpreadsheet className={`w-10 h-10 ${isDragging ? 'text-blue-600' : 'text-gray-500'}`} />
              </div>
            </div>
            <h3 className="text-lg font-medium text-gray-900 mb-2">
              Drop your Excel file here
            </h3>
            <p className="text-gray-500 mb-6">
              Supports .xlsx and .xls files with LakeCity ledger format
            </p>
            <label className="inline-flex">
              <input
                type="file"
                accept=".xlsx,.xls"
                onChange={handleFileSelect}
                className="hidden"
              />
              <span className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 cursor-pointer">
                Select Excel File
              </span>
            </label>
          </div>

          {selectedFile && (
            <div className="mt-6 p-4 bg-green-50 border border-green-200 rounded-lg">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <FileSpreadsheet className="w-5 h-5 text-green-600" />
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
                  <Button onClick={handleParse}>
                    Parse File <ChevronRight className="w-4 h-4 ml-1" />
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
          <div className="mt-8 bg-amber-50 border border-amber-200 rounded-xl p-6">
            <div className="flex items-start gap-4">
              <Info className="w-5 h-5 text-amber-600 mt-0.5" />
              <div>
                <h4 className="font-semibold text-amber-900 mb-2">Expected Excel Format</h4>
                <ul className="text-sm text-amber-800 space-y-1 list-disc pl-4">
                  <li>Multiple sheets (one per development/price tier)</li>
                  <li>Ledger-style: each stand = ~18 rows</li>
                  <li>Two-sided accounting: LEFT = payments, RIGHT = disbursements</li>
                  <li>Agent codes in header row (KCM, KK, PM, RJ, TM)</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Step: Parsing */}
      {step === 'parsing' && (
        <div className="bg-white border border-gray-200 rounded-2xl p-16 shadow-sm text-center">
          <div className="animate-spin w-16 h-16 border-4 border-blue-600 border-t-transparent rounded-full mx-auto mb-6" />
          <h3 className="text-xl font-bold text-gray-900">Parsing Excel File...</h3>
          <p className="text-gray-500 mt-2">
            Analyzing sheets, stands, and transactions. This may take a moment.
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
            <Button variant="outline" onClick={() => setStep('upload')}>
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
            Creating developers, developments, stands, clients, sales, and payments.
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
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-8">
            <div className="bg-gray-50 rounded-lg p-4 text-center">
              <p className="text-2xl font-bold text-gray-900">{importResult.counts.developersCreated}</p>
              <p className="text-sm text-gray-500">Developers Created</p>
            </div>
            <div className="bg-gray-50 rounded-lg p-4 text-center">
              <p className="text-2xl font-bold text-gray-900">{importResult.counts.developmentsCreated}</p>
              <p className="text-sm text-gray-500">Developments Created</p>
            </div>
            <div className="bg-gray-50 rounded-lg p-4 text-center">
              <p className="text-2xl font-bold text-gray-900">{importResult.counts.standsCreated}</p>
              <p className="text-sm text-gray-500">Stands Created</p>
            </div>
            <div className="bg-gray-50 rounded-lg p-4 text-center">
              <p className="text-2xl font-bold text-gray-900">{importResult.counts.clientsCreated}</p>
              <p className="text-sm text-gray-500">Clients Created</p>
            </div>
            <div className="bg-gray-50 rounded-lg p-4 text-center">
              <p className="text-2xl font-bold text-gray-900">{importResult.counts.salesCreated}</p>
              <p className="text-sm text-gray-500">Sales Created</p>
            </div>
            <div className="bg-gray-50 rounded-lg p-4 text-center">
              <p className="text-2xl font-bold text-gray-900">{importResult.counts.paymentsCreated}</p>
              <p className="text-sm text-gray-500">Payments Created</p>
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
