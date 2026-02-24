/**
 * Admin Offline Contracts Page
 * Generate contracts for past sales
 */

'use client';

import { useState, useEffect } from 'react';
import { OfflineContractForm } from '@/app/components/contracts/OfflineContractForm';
import { FileText, Search, Filter } from 'lucide-react';

interface OfflineSale {
  id: string;
  standNumber: string;
  developmentName: string;
  clientName: string;
  clientEmail: string;
  saleDate: string;
  salePrice: number;
  depositAmount: number;
  paymentMethod: string;
}

export default function AdminOfflineContractsPage() {
  const [sales, setSales] = useState<OfflineSale[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedSale, setSelectedSale] = useState<OfflineSale | null>(null);
  const [search, setSearch] = useState('');

  useEffect(() => {
    // Placeholder - fetch from API when implemented
    setLoading(false);
  }, []);

  const filteredSales = sales.filter(sale =>
    sale.standNumber.toLowerCase().includes(search.toLowerCase()) ||
    sale.clientName.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-6xl mx-auto px-4">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-blue-100 rounded-lg">
              <FileText className="w-6 h-6 text-blue-600" />
            </div>
            <h1 className="text-2xl font-bold text-gray-900">
              Offline Contract Generation
            </h1>
          </div>
          <p className="text-gray-600">
            Generate agreements of sale for past sales that occurred outside the ERP system.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Sales List */}
          <div className="lg:col-span-2 bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <div className="flex gap-4 mb-6">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search by stand or client..."
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
            </div>

            {loading ? (
              <div className="text-center py-8">
                <div className="animate-spin w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full mx-auto" />
              </div>
            ) : filteredSales.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                No past sales found. Import past sales first.
              </div>
            ) : (
              <div className="space-y-3">
                {filteredSales.map(sale => (
                  <div
                    key={sale.id}
                    onClick={() => setSelectedSale(sale)}
                    className={`p-4 border rounded-lg cursor-pointer transition-colors ${
                      selectedSale?.id === sale.id
                        ? 'border-blue-500 bg-blue-50'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <div className="flex justify-between items-start">
                      <div>
                        <h3 className="font-medium text-gray-900">
                          Stand {sale.standNumber}
                        </h3>
                        <p className="text-sm text-gray-500">{sale.developmentName}</p>
                      </div>
                      <div className="text-right">
                        <p className="font-medium text-gray-900">
                          R {sale.salePrice.toLocaleString()}
                        </p>
                        <p className="text-sm text-gray-500">{sale.saleDate}</p>
                      </div>
                    </div>
                    <div className="mt-2 text-sm">
                      <span className="text-gray-500">Client:</span>{' '}
                      <span className="text-gray-900">{sale.clientName}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Contract Form */}
          <div className="lg:col-span-1">
            {selectedSale ? (
              <OfflineContractForm
                sale={selectedSale}
                onGenerated={(contractId) => {
                  console.log('Contract generated:', contractId);
                }}
              />
            ) : (
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 text-center text-gray-500">
                Select a past sale to generate a contract
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
