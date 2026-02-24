'use client';

import React from 'react';
import { AlertTriangle, CheckCircle2, Clock, DollarSign, Package, RefreshCw, Search, Tag } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { KPICard, StatusBadge } from '@/components/dashboards/shared';

type InventorySortBy = 'standNumber' | 'sizeSqm' | 'price' | 'updatedAt' | 'status';
type SortOrder = 'asc' | 'desc';

export interface DeveloperInventoryFilters {
  developmentId: string;
  status: string;
  search: string;
  sortBy: InventorySortBy;
  sortOrder: SortOrder;
}

export interface DeveloperInventoryData {
  stands: any[];
  pagination: { page: number; limit: number; total: number; totalPages: number };
  summary: { total: number; available: number; reserved: number; sold: number; blocked: number };
}

export function DeveloperInventoryTab(props: {
  inventoryLoading: boolean;
  inventoryData: DeveloperInventoryData;
  inventoryFilters: DeveloperInventoryFilters;
  setInventoryFilters: React.Dispatch<React.SetStateAction<DeveloperInventoryFilters>>;
  inventoryPage: number;
  setInventoryPage: React.Dispatch<React.SetStateAction<number>>;
  developments: Array<{ id: string; name: string }>;
  onRefresh: () => void;
  onStandAction: (stand: any) => void;
  formatCurrency: (value: number) => string;
  formatDate: (value: any) => string;
}) {
  const {
    inventoryLoading,
    inventoryData,
    inventoryFilters,
    setInventoryFilters,
    inventoryPage,
    setInventoryPage,
    developments,
    onRefresh,
    onStandAction,
    formatCurrency,
    formatDate,
  } = props;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold text-gray-900">Stands Inventory</h2>
          <p className="text-sm text-gray-500">View and manage all stands across your developments</p>
        </div>
        <Button variant="outline" size="sm" onClick={onRefresh} disabled={inventoryLoading}>
          <RefreshCw className={`w-4 h-4 mr-2 ${inventoryLoading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <KPICard title="Total Stands" value={inventoryData.summary.total} icon={Package} color="blue" />
        <KPICard title="Available" value={inventoryData.summary.available} icon={CheckCircle2} color="green" />
        <KPICard title="Reserved" value={inventoryData.summary.reserved} icon={Clock} color="amber" />
        <KPICard title="Sold" value={inventoryData.summary.sold} icon={DollarSign} color="red" />
        <KPICard title="Blocked" value={inventoryData.summary.blocked} icon={AlertTriangle} color="indigo" />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Filters</CardTitle>
          <CardDescription>Filter and search your stands inventory</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Development</label>
              <select
                value={inventoryFilters.developmentId}
                onChange={(e) => {
                  setInventoryFilters({ ...inventoryFilters, developmentId: e.target.value });
                  setInventoryPage(1);
                }}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#C5A059]"
              >
                <option value="">All Developments</option>
                {developments.map((dev) => (
                  <option key={dev.id} value={dev.id}>
                    {dev.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
              <select
                value={inventoryFilters.status}
                onChange={(e) => {
                  setInventoryFilters({ ...inventoryFilters, status: e.target.value });
                  setInventoryPage(1);
                }}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#C5A059]"
              >
                <option value="">All Statuses</option>
                <option value="AVAILABLE">Available</option>
                <option value="RESERVED">Reserved</option>
                <option value="SOLD">Sold</option>
                <option value="BLOCKED">Blocked</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Search</label>
              <div className="relative">
                <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  placeholder="Stand number or client..."
                  value={inventoryFilters.search}
                  onChange={(e) => {
                    setInventoryFilters({ ...inventoryFilters, search: e.target.value });
                    setInventoryPage(1);
                  }}
                  className="w-full pl-9 pr-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#C5A059]"
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Sort By</label>
              <select
                value={inventoryFilters.sortBy}
                onChange={(e) => {
                  setInventoryFilters({ ...inventoryFilters, sortBy: e.target.value as InventorySortBy });
                  setInventoryPage(1);
                }}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#C5A059]"
              >
                <option value="standNumber">Stand Number</option>
                <option value="sizeSqm">Size</option>
                <option value="price">Price</option>
                <option value="updatedAt">Last Updated</option>
                <option value="status">Status</option>
              </select>
            </div>
          </div>
          <div className="mt-4 flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setInventoryFilters({
                  developmentId: '',
                  status: '',
                  search: '',
                  sortBy: 'standNumber',
                  sortOrder: 'asc',
                });
                setInventoryPage(1);
              }}
            >
              Clear Filters
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setInventoryFilters({
                  ...inventoryFilters,
                  sortOrder: inventoryFilters.sortOrder === 'asc' ? 'desc' : 'asc',
                });
                setInventoryPage(1);
              }}
            >
              {inventoryFilters.sortOrder === 'asc' ? '↓ Ascending' : '↑ Descending'}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Inventory List</CardTitle>
          <CardDescription>
            Showing {((inventoryData.pagination.page - 1) * inventoryData.pagination.limit) + 1} to{' '}
            {Math.min(inventoryData.pagination.page * inventoryData.pagination.limit, inventoryData.pagination.total)} of{' '}
            {inventoryData.pagination.total} stands
          </CardDescription>
        </CardHeader>
        <CardContent>
          {inventoryLoading ? (
            <div className="text-center py-8">
              <RefreshCw className="w-8 h-8 animate-spin text-blue-500 mx-auto mb-2" />
              <p className="text-gray-500">Loading inventory...</p>
            </div>
          ) : inventoryData.stands.length === 0 ? (
            <div className="text-center py-8">
              <Package className="w-12 h-12 text-gray-400 mx-auto mb-3" />
              <p className="text-gray-500 text-lg">No stands found</p>
              <p className="text-gray-400">Try adjusting your filters or add stands to your developments</p>
            </div>
          ) : (
            <>
              <div className="overflow-x-auto -mx-4 sm:mx-0">
                <div className="inline-block min-w-full align-middle">
                  <table className="w-full text-xs sm:text-sm">
                    <thead>
                      <tr className="border-b bg-gray-50">
                        <th className="text-left p-2 sm:p-3 font-semibold">Status</th>
                        <th className="text-left p-2 sm:p-3 font-semibold">Stand #</th>
                        <th className="text-left p-2 sm:p-3 font-semibold hidden sm:table-cell">Development</th>
                        <th className="text-left p-2 sm:p-3 font-semibold hidden md:table-cell">Size</th>
                        <th className="text-left p-2 sm:p-3 font-semibold">Price</th>
                        <th className="text-left p-2 sm:p-3 font-semibold hidden lg:table-cell">Client</th>
                        <th className="text-left p-2 sm:p-3 font-semibold hidden xl:table-cell">Updated</th>
                        <th className="text-left p-2 sm:p-3 font-semibold">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {inventoryData.stands.map((stand: any) => (
                        <tr key={stand.id} className="border-b hover:bg-gray-50">
                          <td className="p-2 sm:p-3">
                            <StatusBadge status={stand.status?.toLowerCase() || 'available'} size="sm" />
                          </td>
                          <td className="p-2 sm:p-3">
                            <div className="font-medium text-gray-900">{stand.standNumber}</div>
                          </td>
                          <td className="p-2 sm:p-3 hidden sm:table-cell">
                            <div className="text-gray-600">{stand.development?.name || 'N/A'}</div>
                          </td>
                          <td className="p-2 sm:p-3 hidden md:table-cell">
                            <div className="text-gray-600">{stand.sizeSqm ? `${Number(stand.sizeSqm)} m²` : 'N/A'}</div>
                          </td>
                          <td className="p-2 sm:p-3">
                            <div className="font-medium text-gray-900">{formatCurrency(stand.price || 0)}</div>
                          </td>
                          <td className="p-2 sm:p-3 hidden lg:table-cell">
                            <div className="text-gray-600 text-xs">{stand.clientName || '-'}</div>
                          </td>
                          <td className="p-2 sm:p-3 hidden xl:table-cell">
                            <div className="text-gray-500 text-xs">{stand.updatedAt ? formatDate(stand.updatedAt) : '-'}</div>
                          </td>
                          <td className="p-2 sm:p-3">
                            <div className="flex gap-1">
                              {stand.status === 'AVAILABLE' && (
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => onStandAction(stand)}
                                  className="text-[10px] sm:text-xs px-2 py-1"
                                >
                                  <Tag className="w-3 h-3 sm:w-4 sm:h-4 mr-0 sm:mr-1" />
                                  <span className="hidden sm:inline">Sell</span>
                                </Button>
                              )}
                              {stand.status === 'RESERVED' && (
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => onStandAction(stand)}
                                  className="text-[10px] sm:text-xs px-2 py-1"
                                >
                                  <Tag className="w-3 h-3 sm:w-4 sm:h-4 mr-0 sm:mr-1" />
                                  <span className="hidden sm:inline">Complete</span>
                                </Button>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {inventoryData.pagination.totalPages > 1 && (
                <div className="flex flex-col sm:flex-row items-center justify-between gap-3 sm:gap-0 mt-4 sm:mt-6">
                  <div className="text-xs sm:text-sm text-gray-500 text-center sm:text-left">
                    Showing {((inventoryData.pagination.page - 1) * inventoryData.pagination.limit) + 1} to{' '}
                    {Math.min(inventoryData.pagination.page * inventoryData.pagination.limit, inventoryData.pagination.total)} of{' '}
                    {inventoryData.pagination.total} stands
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setInventoryPage((prev) => Math.max(1, prev - 1))}
                      disabled={inventoryPage === 1 || inventoryLoading}
                      className="text-xs px-2 sm:px-3"
                    >
                      Previous
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setInventoryPage((prev) => prev + 1)}
                      disabled={inventoryPage >= inventoryData.pagination.totalPages || inventoryLoading}
                      className="text-xs px-2 sm:px-3"
                    >
                      Next
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

