'use client';

import React from 'react';
import {
  AlertCircle,
  Archive,
  CheckCircle,
  Clock,
  DollarSign,
  Download,
  Eye,
  FileText,
  RefreshCw,
  Search,
} from 'lucide-react';
import { KPICard } from '@/components/dashboards/shared';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ContractViewer } from '@/components/ContractViewer';

type ContractFilters = {
  status: string;
  developmentId: string;
  agentId: string;
  dateFrom: string;
  dateTo: string;
  search: string;
};

type Props = {
  selectedContractId: string | null;
  setSelectedContractId: (id: string | null) => void;
  contractsData: any;
  contractsLoading: boolean;
  contractPage: number;
  fetchContractsData: (page: number) => void | Promise<void>;
  exportContracts: () => void | Promise<void>;
  contractFilters: ContractFilters;
  setContractFilters: React.Dispatch<React.SetStateAction<ContractFilters>>;
};

export function ManagerContractsTab({
  selectedContractId,
  setSelectedContractId,
  contractsData,
  contractsLoading,
  contractPage,
  fetchContractsData,
  exportContracts,
  contractFilters,
  setContractFilters,
}: Props) {
  return (
    <div className="space-y-6">
      {selectedContractId ? (
        <div className="space-y-4">
          <Button variant="outline" onClick={() => setSelectedContractId(null)} className="mb-4">
            ← Back to Contracts List
          </Button>
          <ContractViewer contractId={selectedContractId} />
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
            <KPICard
              title="Total Contracts"
              value={contractsData.summary.totalContracts}
              icon={FileText}
              color="blue"
              subtitle={`$${(contractsData.summary.totalValue / 1000).toFixed(0)}K total value`}
            />
            <KPICard
              title="Draft"
              value={contractsData.summary.draftContracts}
              icon={Clock}
              color="amber"
              subtitle="Pending signature"
            />
            <KPICard
              title="Signed"
              value={contractsData.summary.signedContracts}
              icon={CheckCircle}
              color="green"
              subtitle="Active contracts"
            />
            <KPICard
              title="Total Paid"
              value={`$${(contractsData.summary.totalPaid / 1000).toFixed(0)}K`}
              icon={DollarSign}
              color="green"
              subtitle={`${((contractsData.summary.totalPaid / contractsData.summary.totalValue) * 100 || 0).toFixed(1)}% collected`}
            />
            <KPICard
              title="Outstanding"
              value={`$${((contractsData.summary.totalValue - contractsData.summary.totalPaid) / 1000).toFixed(0)}K`}
              icon={AlertCircle}
              color="red"
              subtitle="Remaining balance"
            />
          </div>

          <Card>
            <CardHeader>
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                  <CardTitle>Contract Management</CardTitle>
                  <CardDescription>Monitor and manage all property contracts</CardDescription>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => fetchContractsData(contractPage)}
                    disabled={contractsLoading}
                  >
                    <RefreshCw className={`w-4 h-4 mr-2 ${contractsLoading ? 'animate-spin' : ''}`} />
                    Refresh
                  </Button>
                  <Button variant="outline" size="sm" onClick={exportContracts}>
                    <Download className="w-4 h-4 mr-2" />
                    Export CSV
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-4 mb-6 p-4 bg-gray-50 rounded-lg">
                <div className="flex-1 min-w-[200px]">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
                  <Select
                    value={contractFilters.status}
                    onValueChange={(value) => setContractFilters((prev) => ({ ...prev, status: value }))}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="All Statuses" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ALL">All Statuses</SelectItem>
                      <SelectItem value="DRAFT">Draft</SelectItem>
                      <SelectItem value="SIGNED">Signed</SelectItem>
                      <SelectItem value="ARCHIVED">Archived</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex-1 min-w-[200px]">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Development</label>
                  <Select
                    value={contractFilters.developmentId}
                    onValueChange={(value) => setContractFilters((prev) => ({ ...prev, developmentId: value }))}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="All Developments" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ALL">All Developments</SelectItem>
                      {/* Development options would be populated from API */}
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex-1 min-w-[200px]">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Date From</label>
                  <input
                    type="date"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    value={contractFilters.dateFrom}
                    onChange={(e) => setContractFilters((prev) => ({ ...prev, dateFrom: e.target.value }))}
                  />
                </div>

                <div className="flex-1 min-w-[200px]">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Date To</label>
                  <input
                    type="date"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    value={contractFilters.dateTo}
                    onChange={(e) => setContractFilters((prev) => ({ ...prev, dateTo: e.target.value }))}
                  />
                </div>

                <div className="flex-1 min-w-[200px]">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Search</label>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                    <input
                      type="text"
                      placeholder="Client name, stand..."
                      className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      value={contractFilters.search}
                      onChange={(e) => setContractFilters((prev) => ({ ...prev, search: e.target.value }))}
                    />
                  </div>
                </div>
              </div>

              <div className="overflow-x-auto">
                {contractsLoading ? (
                  <div className="text-center py-8">
                    <RefreshCw className="w-8 h-8 animate-spin text-blue-500 mx-auto mb-2" />
                    <p className="text-gray-500">Loading contracts...</p>
                  </div>
                ) : contractsData.contracts.length === 0 ? (
                  <div className="text-center py-8">
                    <FileText className="w-12 h-12 text-gray-400 mx-auto mb-3" />
                    <p className="text-gray-500 text-lg">No contracts found</p>
                    <p className="text-gray-400">Try adjusting your filters or date range</p>
                  </div>
                ) : (
                  <>
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b bg-gray-50">
                          <th className="text-left p-3 font-semibold">Status</th>
                          <th className="text-left p-3 font-semibold">Client</th>
                          <th className="text-left p-3 font-semibold hidden md:table-cell">Property</th>
                          <th className="text-left p-3 font-semibold hidden lg:table-cell">Development</th>
                          <th className="text-left p-3 font-semibold">Value</th>
                          <th className="text-left p-3 font-semibold hidden md:table-cell">Paid</th>
                          <th className="text-left p-3 font-semibold hidden lg:table-cell">Balance</th>
                          <th className="text-left p-3 font-semibold hidden lg:table-cell">Progress</th>
                          <th className="text-left p-3 font-semibold">Created</th>
                          <th className="text-left p-3 font-semibold">Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {contractsData.contracts.map((contract: any) => (
                          <tr key={contract.id} className="border-b hover:bg-gray-50">
                            <td className="p-3">
                              <div className="flex items-center gap-2">
                                {contract.status === 'DRAFT' && (
                                  <>
                                    <Clock className="w-4 h-4 text-yellow-500" />
                                    <span className="px-2 py-1 text-xs font-medium bg-yellow-100 text-yellow-800 rounded-full">
                                      Draft
                                    </span>
                                  </>
                                )}
                                {contract.status === 'SIGNED' && (
                                  <>
                                    <CheckCircle className="w-4 h-4 text-green-500" />
                                    <span className="px-2 py-1 text-xs font-medium bg-green-100 text-green-800 rounded-full">
                                      Signed
                                    </span>
                                  </>
                                )}
                                {contract.status === 'ARCHIVED' && (
                                  <>
                                    <Archive className="w-4 h-4 text-gray-500" />
                                    <span className="px-2 py-1 text-xs font-medium bg-gray-100 text-gray-800 rounded-full">
                                      Archived
                                    </span>
                                  </>
                                )}
                              </div>
                            </td>
                            <td className="p-3">
                              <div>
                                <div className="font-medium text-gray-900">{contract.client.name}</div>
                                <div className="text-sm text-gray-500">{contract.client.email}</div>
                              </div>
                            </td>
                            <td className="p-3">
                              <div>
                                <div className="font-medium">Stand {contract.stand?.standNumber || 'N/A'}</div>
                                <div className="text-sm text-gray-500">{contract.stand?.sizeSqm || 0} sqm</div>
                              </div>
                            </td>
                            <td className="p-3">
                              <div>
                                <div className="font-medium">{contract.stand?.development?.name || 'N/A'}</div>
                                <div className="text-sm text-gray-500">{contract.stand?.development?.location || ''}</div>
                              </div>
                            </td>
                            <td className="p-3">
                              <div className="font-medium">
                                ${(contract.paymentSummary.totalPrice / 1000).toFixed(0)}K
                              </div>
                            </td>
                            <td className="p-3">
                              <div className="text-green-600 font-medium">
                                ${(contract.paymentSummary.paidToDate / 1000).toFixed(0)}K
                              </div>
                              <div className="text-xs text-gray-500">
                                {contract.paymentSummary.paymentCount} payment
                                {contract.paymentSummary.paymentCount !== 1 ? 's' : ''}
                              </div>
                            </td>
                            <td className="p-3">
                              <div
                                className={`font-medium ${
                                  contract.paymentSummary.remainingBalance > 0 ? 'text-red-600' : 'text-green-600'
                                }`}
                              >
                                ${(contract.paymentSummary.remainingBalance / 1000).toFixed(0)}K
                              </div>
                            </td>
                            <td className="p-3">
                              <div className="w-full bg-gray-200 rounded-full h-2 mb-1">
                                <div
                                  className="bg-blue-500 h-2 rounded-full"
                                  style={{ width: `${Math.min(contract.paymentSummary.paymentProgress, 100)}%` }}
                                ></div>
                              </div>
                              <div className="text-xs text-gray-600 text-center">
                                {contract.paymentSummary.paymentProgress.toFixed(1)}%
                              </div>
                            </td>
                            <td className="p-3">
                              <div className="text-sm text-gray-500">
                                {new Date(contract.createdAt).toLocaleDateString()}
                              </div>
                            </td>
                            <td className="p-3">
                              <Button variant="outline" size="sm" onClick={() => setSelectedContractId(contract.id)}>
                                <Eye className="w-4 h-4 mr-1" />
                                View
                              </Button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>

                    {contractsData.pagination.totalPages > 1 && (
                      <div className="flex items-center justify-between mt-6">
                        <div className="text-sm text-gray-500">
                          Showing {((contractsData.pagination.page - 1) * contractsData.pagination.limit) + 1} to{' '}
                          {Math.min(
                            contractsData.pagination.page * contractsData.pagination.limit,
                            contractsData.pagination.total
                          )}{' '}
                          of {contractsData.pagination.total} contracts
                        </div>
                        <div className="flex gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => fetchContractsData(contractPage - 1)}
                            disabled={!contractsData.pagination.hasPrev || contractsLoading}
                          >
                            Previous
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => fetchContractsData(contractPage + 1)}
                            disabled={!contractsData.pagination.hasNext || contractsLoading}
                          >
                            Next
                          </Button>
                        </div>
                      </div>
                    )}
                  </>
                )}
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
