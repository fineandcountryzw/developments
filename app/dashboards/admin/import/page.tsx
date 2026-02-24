/**
 * Admin Import Page
 * Import past sales data from CSV
 */

'use client';

import { PastSalesImportForm } from '@/app/components/import/PastSalesImportForm';
import { Upload } from 'lucide-react';

export default function AdminImportPage() {
  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-6xl mx-auto px-4">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-blue-100 rounded-lg">
              <Upload className="w-6 h-6 text-blue-600" />
            </div>
            <h1 className="text-2xl font-bold text-gray-900">
              Import Past Sales
            </h1>
          </div>
          <p className="text-gray-600">
            Upload CSV files containing historical sales data that occurred outside the ERP system.
            This will create client records, offline sales, and update billing statements.
          </p>
        </div>

        {/* Import Form */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8">
          <PastSalesImportForm
            onImportComplete={(batchId) => {
              console.log('Import completed with batch ID:', batchId);
            }}
          />
        </div>

        {/* Help Section */}
        <div className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <h3 className="font-medium text-gray-900 mb-2">
              Before You Start
            </h3>
            <ul className="text-sm text-gray-600 space-y-2">
              <li>• Download the CSV template first</li>
              <li>• Ensure all required fields are filled</li>
              <li>• Client emails must be unique</li>
              <li>• Stand numbers must match existing stands</li>
            </ul>
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <h3 className="font-medium text-gray-900 mb-2">
              Required Fields
            </h3>
            <ul className="text-sm text-gray-600 space-y-2">
              <li>• Client Name</li>
              <li>• Client Email</li>
              <li>• Stand Number</li>
              <li>• Development Name</li>
              <li>• Sale Date</li>
              <li>• Sale Price</li>
              <li>• Deposit Amount</li>
              <li>• Payment Method</li>
            </ul>
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <h3 className="font-medium text-gray-900 mb-2">
              After Import
            </h3>
            <ul className="text-sm text-gray-600 space-y-2">
              <li>• Review import batch status</li>
              <li>• Generate contracts for imported sales</li>
              <li>• Update client statements</li>
              <li>• Verify payment allocations</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
