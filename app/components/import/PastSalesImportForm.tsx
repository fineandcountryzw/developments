'use client';

import { useState } from 'react';
import { CsvUploader } from './CsvUploader';
import { ImportPreview } from './ImportPreview';
import { ArrowRight, ArrowLeft, CheckCircle } from 'lucide-react';

interface ClientRow {
  name: string;
  email: string;
  phone?: string;
  address?: string;
}

interface SaleRow {
  standNumber: string;
  developmentName: string;
  saleDate: string;
  salePrice: string;
  depositAmount: string;
  paymentMethod: string;
  notes?: string;
}

interface ImportRow extends ClientRow, SaleRow {}

interface PastSalesImportFormProps {
  onImportComplete?: (batchId: string) => void;
}

export function PastSalesImportForm({ onImportComplete }: PastSalesImportFormProps) {
  const [step, setStep] = useState<'upload' | 'preview' | 'processing' | 'complete'>('upload');
  const [csvData, setCsvData] = useState<ImportRow[]>([]);
  const [batchId, setBatchId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleFileAccepted = (data: ImportRow[]) => {
    setCsvData(data);
    setStep('preview');
  };

  const handleProcessImport = async () => {
    setStep('processing');
    setError(null);

    try {
      const response = await fetch('/api/admin/import/past-sales', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sales: csvData }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Import failed');
      }

      setBatchId(result.batchId);
      setStep('complete');
      onImportComplete?.(result.batchId);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Import failed');
      setStep('preview');
    }
  };

  return (
    <div className="space-y-6">
      {/* Progress Steps */}
      <div className="flex items-center justify-between mb-8">
        {[
          { key: 'upload', label: 'Upload CSV' },
          { key: 'preview', label: 'Preview Data' },
          { key: 'complete', label: 'Complete' },
        ].map((s, idx) => (
          <div key={s.key} className="flex items-center">
            <div
              className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                step === 'upload' && s.key === 'upload' ||
                step === 'preview' && (s.key === 'preview' || s.key === 'upload') ||
                step === 'complete' || step === 'processing'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-200 text-gray-500'
              }`}
            >
              {step === 'complete' && s.key === 'complete' ? (
                <CheckCircle className="w-5 h-5" />
              ) : (
                idx + 1
              )}
            </div>
            <span className={`ml-2 text-sm ${step === 'complete' ? 'text-gray-900' : 'text-gray-500'}`}>
              {s.label}
            </span>
            {idx < 2 && (
              <div className={`w-16 h-0.5 mx-4 ${
                step === 'complete' || (step === 'preview' && idx === 0)
                  ? 'bg-blue-600'
                  : 'bg-gray-200'
              }`} />
            )}
          </div>
        ))}
      </div>

      {/* Upload Step */}
      {step === 'upload' && (
        <div className="text-center py-8">
          <CsvUploader onFileAccepted={handleFileAccepted} />
          <div className="mt-6 text-sm text-gray-500">
            <a
              href="/templates/past-sales-template.csv"
              className="text-blue-600 hover:underline"
              download
            >
              Download CSV Template
            </a>
          </div>
        </div>
      )}

      {/* Preview Step */}
      {step === 'preview' && (
        <div>
          <ImportPreview data={csvData} onRemove={(index) => {
            setCsvData(prev => prev.filter((_, i) => i !== index));
          }} />

          <div className="flex justify-between mt-6">
            <button
              onClick={() => {
                setCsvData([]);
                setStep('upload');
              }}
              className="flex items-center px-4 py-2 text-gray-600 hover:text-gray-900"
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back
            </button>
            <button
              onClick={handleProcessImport}
              disabled={csvData.length === 0}
              className="flex items-center px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
            >
              Process Import
              <ArrowRight className="w-4 h-4 ml-2" />
            </button>
          </div>

          {error && (
            <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
              {error}
            </div>
          )}
        </div>
      )}

      {/* Processing Step */}
      {step === 'processing' && (
        <div className="text-center py-12">
          <div className="animate-spin w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full mx-auto mb-4" />
          <p className="text-gray-600">Processing {csvData.length} sales...</p>
          <p className="text-sm text-gray-500 mt-2">This may take a few moments</p>
        </div>
      )}

      {/* Complete Step */}
      {step === 'complete' && (
        <div className="text-center py-8">
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <CheckCircle className="w-8 h-8 text-green-600" />
          </div>
          <h3 className="text-xl font-semibold text-gray-900 mb-2">
            Import Successful!
          </h3>
          <p className="text-gray-600 mb-6">
            {csvData.length} sales have been imported successfully.
          </p>
          <div className="flex justify-center gap-4">
            <a
              href={`/admin/contracts/offline?batchId=${batchId}`}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              Generate Contracts
            </a>
            <button
              onClick={() => {
                setCsvData([]);
                setStep('upload');
              }}
              className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
            >
              Import More
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
