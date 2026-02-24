'use client';

import { useState, useMemo } from 'react';
import { Search, Filter, ArrowUpDown } from 'lucide-react';

interface Stand {
  id: string;
  standNumber: string;
  status: 'available' | 'reserved' | 'sold' | 'blocked';
  price: number;
  size?: string;
  features?: string[];
  ownerName?: string;
  ownerEmail?: string;
  reservationDate?: string;
  saleDate?: string;
}

interface StandTableViewProps {
  stands: Stand[];
  onStandClick?: (stand: Stand) => void;
}

export function StandTableView({ stands, onStandClick }: StandTableViewProps) {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [sortBy, setSortBy] = useState<'standNumber' | 'price' | 'status'>('standNumber');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');

  const filteredAndSortedStands = useMemo(() => {
    let result = stands.filter(stand => {
      const matchesSearch = stand.standNumber.toLowerCase().includes(search.toLowerCase()) ||
        (stand.ownerName?.toLowerCase().includes(search.toLowerCase()) ?? false);
      const matchesStatus = statusFilter === 'all' || stand.status === statusFilter;
      return matchesSearch && matchesStatus;
    });

    result.sort((a, b) => {
      let comparison = 0;
      switch (sortBy) {
        case 'standNumber':
          comparison = a.standNumber.localeCompare(b.standNumber);
          break;
        case 'price':
          comparison = a.price - b.price;
          break;
        case 'status':
          comparison = a.status.localeCompare(b.status);
          break;
      }
      return sortOrder === 'asc' ? comparison : -comparison;
    });

    return result;
  }, [stands, search, statusFilter, sortBy, sortOrder]);

  const handleSort = (column: typeof sortBy) => {
    if (sortBy === column) {
      setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(column);
      setSortOrder('asc');
    }
  };

  const getStatusColor = (status: Stand['status']) => {
    switch (status) {
      case 'available': return 'bg-green-100 text-green-800';
      case 'reserved': return 'bg-yellow-100 text-yellow-800';
      case 'sold': return 'bg-red-100 text-red-800';
      case 'blocked': return 'bg-gray-100 text-gray-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const stats = useMemo(() => ({
    total: stands.length,
    available: stands.filter(s => s.status === 'available').length,
    reserved: stands.filter(s => s.status === 'reserved').length,
    sold: stands.filter(s => s.status === 'sold').length,
  }), [stands]);

  return (
    <div className="space-y-4">
      {/* Stats */}
      <div className="grid grid-cols-4 gap-4">
        <div className="bg-gray-50 rounded-lg p-3">
          <div className="text-2xl font-bold text-gray-900">{stats.total}</div>
          <div className="text-sm text-gray-500">Total Stands</div>
        </div>
        <div className="bg-green-50 rounded-lg p-3">
          <div className="text-2xl font-bold text-green-700">{stats.available}</div>
          <div className="text-sm text-green-600">Available</div>
        </div>
        <div className="bg-yellow-50 rounded-lg p-3">
          <div className="text-2xl font-bold text-yellow-700">{stats.reserved}</div>
          <div className="text-sm text-yellow-600">Reserved</div>
        </div>
        <div className="bg-red-50 rounded-lg p-3">
          <div className="text-2xl font-bold text-red-700">{stats.sold}</div>
          <div className="text-sm text-red-600">Sold</div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search by stand number or owner..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>
        <div className="relative">
          <Filter className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <select
            value={statusFilter}
            onChange={e => setStatusFilter(e.target.value)}
            className="pl-10 pr-8 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent appearance-none bg-white"
          >
            <option value="all">All Status</option>
            <option value="available">Available</option>
            <option value="reserved">Reserved</option>
            <option value="sold">Sold</option>
            <option value="blocked">Blocked</option>
          </select>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto border border-gray-200 rounded-lg">
        <table className="w-full text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-3 text-left">
                <button
                  onClick={() => handleSort('standNumber')}
                  className="flex items-center gap-1 text-xs font-medium text-gray-500 uppercase hover:text-gray-700"
                >
                  Stand
                  <ArrowUpDown className="w-3 h-3" />
                </button>
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                Status
              </th>
              <th className="px-4 py-3 text-left">
                <button
                  onClick={() => handleSort('price')}
                  className="flex items-center gap-1 text-xs font-medium text-gray-500 uppercase hover:text-gray-700"
                >
                  Price
                  <ArrowUpDown className="w-3 h-3" />
                </button>
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                Size
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                Owner
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                Date
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {filteredAndSortedStands.map(stand => (
              <tr
                key={stand.id}
                onClick={() => onStandClick?.(stand)}
                className="hover:bg-gray-50 cursor-pointer"
              >
                <td className="px-4 py-3 font-medium text-gray-900">
                  {stand.standNumber}
                </td>
                <td className="px-4 py-3">
                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(stand.status)}`}>
                    {stand.status.charAt(0).toUpperCase() + stand.status.slice(1)}
                  </span>
                </td>
                <td className="px-4 py-3 text-gray-700">
                  R {stand.price.toLocaleString()}
                </td>
                <td className="px-4 py-3 text-gray-500">
                  {stand.size || '-'}
                </td>
                <td className="px-4 py-3">
                  {stand.ownerName ? (
                    <div>
                      <div className="text-gray-900">{stand.ownerName}</div>
                      <div className="text-xs text-gray-500">{stand.ownerEmail}</div>
                    </div>
                  ) : (
                    <span className="text-gray-400">-</span>
                  )}
                </td>
                <td className="px-4 py-3 text-gray-500">
                  {stand.saleDate || stand.reservationDate || '-'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {filteredAndSortedStands.length === 0 && (
          <div className="text-center py-8 text-gray-500">
            No stands match your search criteria
          </div>
        )}
      </div>

      {/* Pagination Info */}
      <div className="text-sm text-gray-500 text-right">
        Showing {filteredAndSortedStands.length} of {stands.length} stands
      </div>
    </div>
  );
}
