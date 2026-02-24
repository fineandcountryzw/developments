'use client';

/**
 * Stands Inventory View
 * 
 * Unified component for viewing stands inventory across all dashboards.
 * Shows available stands per development with robust filtering and instant
 * Reserve/Sell actions.
 * 
 * Used by: Admin, Manager, Accounts, Developer dashboards
 * @module components/stands/StandsInventoryView
 */

import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Home,
  Search,
  Filter,
  Download,
  RefreshCw,
  CheckCircle,
  XCircle,
  Clock,
  ChevronLeft,
  ChevronRight,
  ShoppingCart,
  DollarSign,
  AlertTriangle,
  Building2,
  LayoutGrid,
  Loader2,
} from 'lucide-react';
import { formatCurrency } from '@/lib/utils';
import { KPICard } from '@/components/dashboards/shared';

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

interface Development {
  id: string;
  name: string;
  branch: string;
  status: string;
  totalStands: number;
  availableStands: number;
  reservedStands: number;
  soldStands: number;
}

interface Stand {
  id: string;
  standNumber: string;
  developmentId: string;
  developmentName: string;
  branch: string;
  sizeSqm: number;
  price: number;
  pricePerSqm: number;
  discountPercent?: number;
  discountedPrice?: number;
  hasDiscount: boolean;
  status: string;
  reservedBy?: string;
  reservedByName?: string;
  soldAt?: string;
  soldReason?: string;
  updatedAt: string;
}

interface Summary {
  totalCount: number;
  availableCount: number;
  reservedCount: number;
  soldCount: number;
  blockedCount: number;
  totalValue: number;
  availableValue: number;
}

interface Permissions {
  canReserve: boolean;
  canSell: boolean;
}

interface StandsInventoryViewProps {
  /** Dashboard role context */
  role: 'admin' | 'manager' | 'account' | 'developer';
  /** Initial development to show */
  initialDevelopmentId?: string;
  /** Page title */
  title?: string;
  /** Page subtitle */
  subtitle?: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────────────────────

export default function StandsInventoryView({
  role,
  initialDevelopmentId,
  title = 'Stands Inventory',
  subtitle = 'View and manage stands across developments',
}: StandsInventoryViewProps) {
  // State: Data
  const [developments, setDevelopments] = useState<Development[]>([]);
  const [stands, setStands] = useState<Stand[]>([]);
  const [summary, setSummary] = useState<Summary>({
    totalCount: 0,
    availableCount: 0,
    reservedCount: 0,
    soldCount: 0,
    blockedCount: 0,
    totalValue: 0,
    availableValue: 0,
  });
  const [permissions, setPermissions] = useState<Permissions>({
    canReserve: false,
    canSell: false,
  });

  // State: Filters
  const [selectedDevelopment, setSelectedDevelopment] = useState<string>(initialDevelopmentId || '');
  const [statusFilter, setStatusFilter] = useState<string>('AVAILABLE');
  const [searchQuery, setSearchQuery] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize] = useState(50);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);

  // State: UI
  const [loading, setLoading] = useState(true);
  const [devsLoading, setDevsLoading] = useState(true);
  const [selectedStands, setSelectedStands] = useState<Set<string>>(new Set());

  // State: Reserve Modal
  const [reserveModalOpen, setReserveModalOpen] = useState(false);
  const [reserveStand, setReserveStandState] = useState<Stand | null>(null);
  const [reserveForm, setReserveForm] = useState({
    clientName: '',
    clientEmail: '',
    clientPhone: '',
    notes: '',
  });
  const [reserveLoading, setReserveLoading] = useState(false);

  // State: Sell Modal
  const [sellModalOpen, setSellModalOpen] = useState(false);
  const [sellStand, setSellStandState] = useState<Stand | null>(null);
  const [sellForm, setSellForm] = useState({
    reason: '',
    notes: '',
  });
  const [sellLoading, setSellLoading] = useState(false);

  // ─────────────────────────────────────────────────────────────────────────
  // Data Fetching
  // ─────────────────────────────────────────────────────────────────────────

  const fetchDevelopments = useCallback(async () => {
    setDevsLoading(true);
    try {
      const res = await fetch('/api/stands/developments');
      if (res.ok) {
        const data = await res.json();
        if (data.success) {
          setDevelopments(data.developments || []);
          // Defaults: Default to 'ALL' for a consolidated view if multiple exist
          if (!selectedDevelopment) {
            setSelectedDevelopment('ALL');
          }
        }
      }
    } catch (error) {
      console.error('[StandsInventoryView] Failed to fetch developments:', error);
    } finally {
      setDevsLoading(false);
    }
  }, [selectedDevelopment]);

  const fetchStands = useCallback(async () => {
    const isAll = selectedDevelopment === 'ALL';

    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: page.toString(),
        pageSize: pageSize.toString(),
      });

      if (!isAll) {
        params.append('developmentId', selectedDevelopment);
      }

      if (statusFilter && statusFilter !== 'ALL') {
        params.append('status', statusFilter);
      }
      if (searchQuery) {
        params.append('search', searchQuery);
      }

      const res = await fetch(`/api/stands/inventory?${params}`);
      if (res.ok) {
        const data = await res.json();
        if (data.success) {
          setStands(data.stands || []);
          setSummary(data.summary || {
            totalCount: 0,
            availableCount: 0,
            reservedCount: 0,
            soldCount: 0,
            blockedCount: 0,
            totalValue: 0,
            availableValue: 0,
          });
          setPermissions(data.permissions || { canReserve: false, canSell: false });
          setTotalPages(data.pagination?.totalPages || 1);
          setTotalCount(data.pagination?.totalCount || 0);
        }
      }
    } catch (error) {
      console.error('[StandsInventoryView] Failed to fetch stands:', error);
    } finally {
      setLoading(false);
    }
  }, [selectedDevelopment, statusFilter, searchQuery, page, pageSize]);

  // Initial load
  useEffect(() => {
    fetchDevelopments();
  }, [fetchDevelopments]);

  // Refetch when filters change
  useEffect(() => {
    fetchStands();
  }, [fetchStands]);

  // Reset page when filters change
  useEffect(() => {
    setPage(1);
  }, [selectedDevelopment, statusFilter, searchQuery]);

  // ─────────────────────────────────────────────────────────────────────────
  // Actions
  // ─────────────────────────────────────────────────────────────────────────

  const handleReserve = async () => {
    if (!reserveStand) return;

    if (!reserveForm.clientName.trim()) {
      alert('Client name is required');
      return;
    }

    setReserveLoading(true);
    try {
      const res = await fetch('/api/stands/reserve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          standId: reserveStand.id,
          clientName: reserveForm.clientName,
          clientEmail: reserveForm.clientEmail || undefined,
          clientPhone: reserveForm.clientPhone || undefined,
          notes: reserveForm.notes || undefined,
        }),
      });

      const data = await res.json();
      if (data.success) {
        setReserveModalOpen(false);
        setReserveStandState(null);
        setReserveForm({ clientName: '', clientEmail: '', clientPhone: '', notes: '' });
        fetchStands();
        fetchDevelopments();
      } else {
        alert(data.error || 'Failed to reserve stand');
      }
    } catch (error) {
      console.error('[StandsInventoryView] Reserve failed:', error);
      alert('Failed to reserve stand');
    } finally {
      setReserveLoading(false);
    }
  };

  const handleSell = async () => {
    if (!sellStand) return;

    if (!sellForm.reason.trim()) {
      alert('Reason is required');
      return;
    }

    setSellLoading(true);
    try {
      const res = await fetch('/api/stands/sell', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          standId: sellStand.id,
          reason: sellForm.reason,
          notes: sellForm.notes || undefined,
        }),
      });

      const data = await res.json();
      if (data.success) {
        setSellModalOpen(false);
        setSellStandState(null);
        setSellForm({ reason: '', notes: '' });
        fetchStands();
        fetchDevelopments();
      } else {
        alert(data.error || 'Failed to sell stand');
      }
    } catch (error) {
      console.error('[StandsInventoryView] Sell failed:', error);
      alert('Failed to sell stand');
    } finally {
      setSellLoading(false);
    }
  };

  const openReserveModal = (stand: Stand) => {
    setReserveStandState(stand);
    setReserveModalOpen(true);
  };

  const openSellModal = (stand: Stand) => {
    setSellStandState(stand);
    setSellModalOpen(true);
  };

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedStands(new Set(stands.filter(s => s.status === 'AVAILABLE').map(s => s.id)));
    } else {
      setSelectedStands(new Set());
    }
  };

  const handleSelectStand = (standId: string, checked: boolean) => {
    const newSet = new Set(selectedStands);
    if (checked) {
      newSet.add(standId);
    } else {
      newSet.delete(standId);
    }
    setSelectedStands(newSet);
  };

  const handleExportCSV = () => {
    // Build CSV content
    const headers = ['Stand #', 'Development', 'Size (sqm)', 'Price', 'Price/sqm', 'Status', 'Updated'];
    const rows = stands.map(s => [
      s.standNumber,
      s.developmentName,
      s.sizeSqm.toString(),
      s.price.toString(),
      s.pricePerSqm.toFixed(2),
      s.status,
      new Date(s.updatedAt).toLocaleDateString(),
    ]);

    const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `stands-inventory-${selectedDevelopment || 'all'}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // ─────────────────────────────────────────────────────────────────────────
  // Helpers
  // ─────────────────────────────────────────────────────────────────────────

  const getStatusBadge = (status: string) => {
    const styles: Record<string, string> = {
      AVAILABLE: 'bg-green-100 text-green-800 border-green-200',
      RESERVED: 'bg-yellow-100 text-yellow-800 border-yellow-200',
      SOLD: 'bg-blue-100 text-blue-800 border-blue-200',
      BLOCKED: 'bg-red-100 text-red-800 border-red-200',
      WITHDRAWN: 'bg-gray-100 text-gray-800 border-gray-200',
      CANCELLED: 'bg-gray-100 text-gray-800 border-gray-200',
    };
    return (
      <Badge variant="outline" className={styles[status] || styles.AVAILABLE}>
        {status}
      </Badge>
    );
  };

  const selectedDevelopmentObj = developments.find(d => d.id === selectedDevelopment);

  // ─────────────────────────────────────────────────────────────────────────
  // Render
  // ─────────────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{title}</h1>
          <p className="text-gray-600">{subtitle}</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => fetchStands()}>
            <RefreshCw className="w-4 h-4 mr-2" />
            Refresh
          </Button>
          <Button variant="outline" size="sm" onClick={handleExportCSV}>
            <Download className="w-4 h-4 mr-2" />
            Export CSV
          </Button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KPICard
          title="Available"
          value={summary.availableCount}
          icon={CheckCircle}
          variant="gradient"
          color="green"
          subtitle={`${formatCurrency(summary.availableValue)} value`}
        />
        <KPICard
          title="Reserved"
          value={summary.reservedCount}
          icon={Clock}
          variant="gradient"
          color="amber"
        />
        <KPICard
          title="Sold"
          value={summary.soldCount}
          icon={DollarSign}
          variant="gradient"
          color="blue"
        />
        <KPICard
          title="Total"
          value={summary.totalCount}
          icon={LayoutGrid}
          variant="gradient"
          color="indigo"
          subtitle={`${formatCurrency(summary.totalValue)} value`}
        />
      </div>

      {/* Filters Bar */}
      <Card>
        <CardContent className="py-4">
          <div className="flex flex-col md:flex-row gap-4">
            {/* Development Selector */}
            <div className="flex-1 min-w-[200px]">
              <Label className="text-xs text-gray-500 mb-1 block">Development</Label>
              <Select
                value={selectedDevelopment}
                onValueChange={setSelectedDevelopment}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder={devsLoading ? 'Loading...' : 'Select development'} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">
                    <div className="flex items-center gap-2">
                      <LayoutGrid className="w-4 h-4 text-fcGold" />
                      <span className="font-medium text-fcGold">All Developments</span>
                    </div>
                  </SelectItem>
                  {developments.map((dev) => (
                    <SelectItem key={dev.id} value={dev.id}>
                      <div className="flex items-center gap-2">
                        <Building2 className="w-4 h-4 text-gray-400" />
                        <span>{dev.name}</span>
                        <Badge variant="secondary" className="ml-2 text-xs">
                          {dev.availableStands} avail
                        </Badge>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Status Filter */}
            <div className="min-w-[150px]">
              <Label className="text-xs text-gray-500 mb-1 block">Status</Label>
              <Select
                value={statusFilter}
                onValueChange={setStatusFilter}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">All Statuses</SelectItem>
                  <SelectItem value="AVAILABLE">Available</SelectItem>
                  <SelectItem value="RESERVED">Reserved</SelectItem>
                  <SelectItem value="SOLD">Sold</SelectItem>
                  <SelectItem value="BLOCKED">Blocked</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Search */}
            <div className="flex-1 min-w-[200px]">
              <Label className="text-xs text-gray-500 mb-1 block">Search</Label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <Input
                  placeholder="Stand # or client name..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Stands Table */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between py-4">
          <div>
            <CardTitle className="text-lg">
              {selectedDevelopment === 'ALL' ? 'Global Inventory' : (selectedDevelopmentObj?.name || 'Development Stands')}
            </CardTitle>
            <CardDescription>
              {totalCount} stands found · Page {page} of {totalPages}
            </CardDescription>
          </div>
          {selectedStands.size > 0 && (
            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-600">{selectedStands.size} selected</span>
              {/* Bulk actions could go here */}
            </div>
          )}
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
            </div>
          ) : stands.length === 0 ? (
            <div className="text-center py-12">
              <Home className="w-12 h-12 text-gray-300 mx-auto mb-4" />
              <p className="text-gray-500">No stands found</p>
              <p className="text-gray-400 text-sm mt-1">
                {!selectedDevelopment
                  ? 'Select a development to view stands'
                  : 'Try adjusting your filters'}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-12">
                      <Checkbox
                        checked={
                          stands.filter(s => s.status === 'AVAILABLE').length > 0 &&
                          stands.filter(s => s.status === 'AVAILABLE').every(s => selectedStands.has(s.id))
                        }
                        onCheckedChange={handleSelectAll}
                      />
                    </TableHead>
                    <TableHead>Stand #</TableHead>
                    <TableHead>Size (sqm)</TableHead>
                    <TableHead>Price/m²</TableHead>
                    <TableHead>Total Price</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Reserved By</TableHead>
                    <TableHead>Last Updated</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {stands.map((stand) => (
                    <TableRow key={stand.id} className="hover:bg-gray-50">
                      <TableCell>
                        <Checkbox
                          checked={selectedStands.has(stand.id)}
                          onCheckedChange={(checked) =>
                            handleSelectStand(stand.id, checked as boolean)
                          }
                          disabled={stand.status !== 'AVAILABLE'}
                        />
                      </TableCell>
                      <TableCell className="font-medium">{stand.standNumber}</TableCell>
                      <TableCell>{stand.sizeSqm?.toFixed(0) || '-'}</TableCell>
                      <TableCell>
                        {stand.pricePerSqm ? formatCurrency(stand.pricePerSqm) : '-'}
                      </TableCell>
                      <TableCell>
                        <div>
                          {stand.hasDiscount ? (
                            <>
                              <span className="line-through text-gray-400 text-sm">
                                {formatCurrency(stand.price)}
                              </span>
                              <br />
                              <span className="text-green-600 font-semibold">
                                {formatCurrency(stand.discountedPrice || stand.price)}
                              </span>
                            </>
                          ) : (
                            formatCurrency(stand.price)
                          )}
                        </div>
                      </TableCell>
                      <TableCell>{getStatusBadge(stand.status)}</TableCell>
                      <TableCell>
                        {stand.reservedByName || stand.reservedBy || '-'}
                      </TableCell>
                      <TableCell className="text-sm text-gray-500">
                        {new Date(stand.updatedAt).toLocaleDateString()}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-2">
                          {permissions.canReserve && stand.status === 'AVAILABLE' && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => openReserveModal(stand)}
                            >
                              <ShoppingCart className="w-4 h-4 mr-1" />
                              Reserve
                            </Button>
                          )}
                          {permissions.canSell && ['AVAILABLE', 'RESERVED'].includes(stand.status) && (
                            <Button
                              variant="default"
                              size="sm"
                              className="bg-green-600 hover:bg-green-700"
                              onClick={() => openSellModal(stand)}
                            >
                              <DollarSign className="w-4 h-4 mr-1" />
                              Sell
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between px-4 py-4 border-t">
              <p className="text-sm text-gray-600">
                Showing {((page - 1) * pageSize) + 1} to {Math.min(page * pageSize, totalCount)} of {totalCount}
              </p>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page <= 1}
                  onClick={() => setPage(p => p - 1)}
                >
                  <ChevronLeft className="w-4 h-4" />
                  Prev
                </Button>
                <span className="text-sm text-gray-600">
                  Page {page} of {totalPages}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page >= totalPages}
                  onClick={() => setPage(p => p + 1)}
                >
                  Next
                  <ChevronRight className="w-4 h-4" />
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Reserve Modal */}
      <Dialog open={reserveModalOpen} onOpenChange={setReserveModalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Reserve Stand</DialogTitle>
            <DialogDescription>
              Reserve stand {reserveStand?.standNumber} in {reserveStand?.developmentName}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <Label htmlFor="clientName">Client Name *</Label>
              <Input
                id="clientName"
                value={reserveForm.clientName}
                onChange={(e) => setReserveForm(f => ({ ...f, clientName: e.target.value }))}
                placeholder="Enter client name"
              />
            </div>
            <div>
              <Label htmlFor="clientEmail">Client Email</Label>
              <Input
                id="clientEmail"
                type="email"
                value={reserveForm.clientEmail}
                onChange={(e) => setReserveForm(f => ({ ...f, clientEmail: e.target.value }))}
                placeholder="client@example.com"
              />
            </div>
            <div>
              <Label htmlFor="clientPhone">Client Phone</Label>
              <Input
                id="clientPhone"
                value={reserveForm.clientPhone}
                onChange={(e) => setReserveForm(f => ({ ...f, clientPhone: e.target.value }))}
                placeholder="+263 7XX XXX XXX"
              />
            </div>
            <div>
              <Label htmlFor="notes">Notes</Label>
              <Textarea
                id="notes"
                value={reserveForm.notes}
                onChange={(e) => setReserveForm(f => ({ ...f, notes: e.target.value }))}
                placeholder="Optional notes..."
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setReserveModalOpen(false)}
              disabled={reserveLoading}
            >
              Cancel
            </Button>
            <Button
              onClick={handleReserve}
              disabled={reserveLoading || !reserveForm.clientName.trim()}
              className="bg-amber-600 hover:bg-amber-700"
            >
              {reserveLoading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Reserve Stand
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Sell Modal */}
      <Dialog open={sellModalOpen} onOpenChange={setSellModalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Sell Stand</DialogTitle>
            <DialogDescription>
              Mark stand {sellStand?.standNumber} in {sellStand?.developmentName} as sold
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
              <div className="flex items-start gap-3">
                <AlertTriangle className="w-5 h-5 text-amber-600 mt-0.5" />
                <div>
                  <p className="font-medium text-amber-800">This action cannot be undone</p>
                  <p className="text-sm text-amber-700 mt-1">
                    Once sold, the stand cannot be changed back to available or reserved.
                  </p>
                </div>
              </div>
            </div>
            <div>
              <Label htmlFor="reason">Reason *</Label>
              <Input
                id="reason"
                value={sellForm.reason}
                onChange={(e) => setSellForm(f => ({ ...f, reason: e.target.value }))}
                placeholder="e.g., Cash sale, Full payment received"
              />
            </div>
            <div>
              <Label htmlFor="sellNotes">Notes</Label>
              <Textarea
                id="sellNotes"
                value={sellForm.notes}
                onChange={(e) => setSellForm(f => ({ ...f, notes: e.target.value }))}
                placeholder="Additional details..."
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setSellModalOpen(false)}
              disabled={sellLoading}
            >
              Cancel
            </Button>
            <Button
              onClick={handleSell}
              disabled={sellLoading || !sellForm.reason.trim()}
              className="bg-green-600 hover:bg-green-700"
            >
              {sellLoading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Confirm Sale
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
