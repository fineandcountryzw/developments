'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
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
import { 
  Building2, 
  DollarSign, 
  Download, 
  Eye,
  CheckCircle,
  Clock,
  Wallet,
  TrendingUp,
  AlertCircle,
  ChevronDown,
  ChevronUp,
  RefreshCw,
  Send,
  Building,
  Mail,
  User
} from 'lucide-react';
import { formatCurrency } from '@/lib/utils';

interface DeveloperPayoutsTabProps {
  branch: string;
}

interface PaymentDetail {
  id: string;
  reference: string;
  clientName: string;
  clientEmail?: string;
  standNumber?: string;
  amount: number;
  standPricePortion: number;
  vatAmount: number;
  cessionAmount: number;
  endowmentAmount: number;
  aosAmount: number;
  commission: number;
  developerNet: number;
  status: string;
  createdAt: string;
}

interface DevelopmentPayout {
  developmentId: string;
  developmentName: string;
  developerName: string;
  developerEmail?: string;
  paymentCount: number;
  totalStandPrice: number;
  totalFees: number;
  totalCommission: number;
  totalDeveloperNet: number;
  pendingPayout: number;
  paidOut: number;
  payments: PaymentDetail[];
}

interface PayoutSummary {
  totalDevelopments: number;
  totalPayments: number;
  totalPendingPayout: number;
  totalPaidOut: number;
  totalDeveloperNet: number;
}

interface Development {
  id: string;
  name: string;
  developerName?: string;
}

export default function DeveloperPayoutsTab({ branch }: DeveloperPayoutsTabProps) {
  const [payouts, setPayouts] = useState<DevelopmentPayout[]>([]);
  const [developments, setDevelopments] = useState<Development[]>([]);
  const [summary, setSummary] = useState<PayoutSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedDevelopment, setSelectedDevelopment] = useState<string>('all');
  const [selectedStatus, setSelectedStatus] = useState<string>('all');
  const [expandedDevelopment, setExpandedDevelopment] = useState<string | null>(null);
  const [selectedPayout, setSelectedPayout] = useState<DevelopmentPayout | null>(null);
  const [isProcessModalOpen, setIsProcessModalOpen] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [selectedPayments, setSelectedPayments] = useState<string[]>([]);

  const fetchPayouts = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.append('branch', branch);
      if (selectedDevelopment !== 'all') params.append('developmentId', selectedDevelopment);
      if (selectedStatus !== 'all') params.append('status', selectedStatus);

      const res = await fetch(`/api/account/developer-payouts?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        setPayouts(data.payouts || []);
        setDevelopments(data.developments || []);
        setSummary(data.summary || null);
      }
    } catch (error) {
      console.error('Failed to fetch developer payouts:', error);
    } finally {
      setLoading(false);
    }
  }, [branch, selectedDevelopment, selectedStatus]);

  useEffect(() => {
    fetchPayouts();
  }, [fetchPayouts]);

  const handleProcessPayout = async (notes?: string) => {
    if (!selectedPayout) return;
    
    setIsProcessing(true);
    try {
      const res = await fetch('/api/account/developer-payouts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          developmentId: selectedPayout.developmentId,
          paymentIds: selectedPayments.length > 0 
            ? selectedPayments 
            : selectedPayout.payments.filter(p => p.status === 'PENDING').map(p => p.id),
          notes,
          branch,
        }),
      });

      if (res.ok) {
        await fetchPayouts();
        setIsProcessModalOpen(false);
        setSelectedPayout(null);
        setSelectedPayments([]);
      }
    } catch (error) {
      console.error('Failed to process payout:', error);
    } finally {
      setIsProcessing(false);
    }
  };

  const getStatusBadge = (status: string) => {
    const statusConfig: Record<string, { class: string; icon: React.ElementType }> = {
      PENDING: { class: 'bg-yellow-100 text-yellow-700 border-yellow-200', icon: Clock },
      PAID: { class: 'bg-green-100 text-green-700 border-green-200', icon: CheckCircle },
      HOLD: { class: 'bg-orange-100 text-orange-700 border-orange-200', icon: AlertCircle },
    };
    const config = statusConfig[status] || statusConfig.PENDING;
    const Icon = config.icon;
    return (
      <Badge variant="outline" className={`${config.class} flex items-center gap-1`}>
        <Icon className="w-3 h-3" />
        {status}
      </Badge>
    );
  };

  const togglePaymentSelection = (paymentId: string) => {
    setSelectedPayments(prev => 
      prev.includes(paymentId) 
        ? prev.filter(id => id !== paymentId)
        : [...prev, paymentId]
    );
  };

  const selectAllPending = (payout: DevelopmentPayout) => {
    const pendingIds = payout.payments.filter(p => p.status === 'PENDING').map(p => p.id);
    setSelectedPayments(pendingIds);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-gray-900">Developer Payouts</h2>
          <p className="text-sm text-gray-500 mt-1">
            Manage settlements and payouts to developers
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            onClick={fetchPayouts}
            disabled={loading}
            className="flex items-center gap-2"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          <Button
            variant="outline"
            className="flex items-center gap-2"
          >
            <Download className="w-4 h-4" />
            Export
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      {summary && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-blue-100 rounded-lg">
                  <Building2 className="w-5 h-5 text-blue-600" />
                </div>
                <div>
                  <p className="text-sm text-gray-500">Developments</p>
                  <p className="text-xl font-bold text-gray-900">{summary.totalDevelopments}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-purple-100 rounded-lg">
                  <DollarSign className="w-5 h-5 text-purple-600" />
                </div>
                <div>
                  <p className="text-sm text-gray-500">Total Net</p>
                  <p className="text-xl font-bold text-gray-900">{formatCurrency(summary.totalDeveloperNet)}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-yellow-100 rounded-lg">
                  <Clock className="w-5 h-5 text-yellow-600" />
                </div>
                <div>
                  <p className="text-sm text-gray-500">Pending Payout</p>
                  <p className="text-xl font-bold text-gray-900">{formatCurrency(summary.totalPendingPayout)}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-green-100 rounded-lg">
                  <CheckCircle className="w-5 h-5 text-green-600" />
                </div>
                <div>
                  <p className="text-sm text-gray-500">Paid Out</p>
                  <p className="text-xl font-bold text-gray-900">{formatCurrency(summary.totalPaidOut)}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1">
              <label className="text-sm font-medium text-gray-700 mb-1 block">Development</label>
              <Select value={selectedDevelopment} onValueChange={setSelectedDevelopment}>
                <SelectTrigger>
                  <SelectValue placeholder="All Developments" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Developments</SelectItem>
                  {developments.map((dev) => (
                    <SelectItem key={dev.id} value={dev.id}>
                      {dev.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex-1">
              <label className="text-sm font-medium text-gray-700 mb-1 block">Status</label>
              <Select value={selectedStatus} onValueChange={setSelectedStatus}>
                <SelectTrigger>
                  <SelectValue placeholder="All Statuses" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Statuses</SelectItem>
                  <SelectItem value="PENDING">Pending</SelectItem>
                  <SelectItem value="PAID">Paid</SelectItem>
                  <SelectItem value="HOLD">On Hold</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Payouts List */}
      <div className="space-y-4">
        {loading ? (
          <Card>
            <CardContent className="p-8 text-center">
              <RefreshCw className="w-8 h-8 animate-spin mx-auto mb-4 text-gray-400" />
              <p className="text-gray-500">Loading developer payouts...</p>
            </CardContent>
          </Card>
        ) : payouts.length === 0 ? (
          <Card>
            <CardContent className="p-8 text-center">
              <Building2 className="w-12 h-12 mx-auto mb-4 text-gray-300" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">No Payouts Found</h3>
              <p className="text-gray-500 max-w-md mx-auto">
                No confirmed payments with developer payouts found for the selected filters.
                Payments must be confirmed to appear here.
              </p>
            </CardContent>
          </Card>
        ) : (
          payouts.map((payout) => (
            <Card key={payout.developmentId} className="overflow-hidden">
              <CardHeader className="bg-gray-50/50">
                <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
                  <div className="flex items-start gap-4">
                    <div className="p-3 bg-[#B8860B]/10 rounded-lg">
                      <Building className="w-6 h-6 text-[#B8860B]" />
                    </div>
                    <div>
                      <CardTitle className="text-lg">{payout.developmentName}</CardTitle>
                      <CardDescription className="flex items-center gap-4 mt-1">
                        <span className="flex items-center gap-1">
                          <User className="w-3 h-3" />
                          {payout.developerName}
                        </span>
                        {payout.developerEmail && (
                          <span className="flex items-center gap-1">
                            <Mail className="w-3 h-3" />
                            {payout.developerEmail}
                          </span>
                        )}
                      </CardDescription>
                    </div>
                  </div>
                  
                  <div className="flex flex-wrap items-center gap-4">
                    <div className="text-right">
                      <p className="text-sm text-gray-500">Pending Payout</p>
                      <p className="text-xl font-bold text-yellow-600">{formatCurrency(payout.pendingPayout)}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm text-gray-500">Total Net</p>
                      <p className="text-xl font-bold text-gray-900">{formatCurrency(payout.totalDeveloperNet)}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setExpandedDevelopment(
                          expandedDevelopment === payout.developmentId ? null : payout.developmentId
                        )}
                      >
                        {expandedDevelopment === payout.developmentId ? (
                          <>
                            <ChevronUp className="w-4 h-4 mr-1" />
                            Hide
                          </>
                        ) : (
                          <>
                            <Eye className="w-4 h-4 mr-1" />
                            View
                          </>
                        )}
                      </Button>
                      {payout.pendingPayout > 0 && (
                        <Button
                          size="sm"
                          className="bg-[#B8860B] hover:bg-[#996F00]"
                          onClick={() => {
                            setSelectedPayout(payout);
                            selectAllPending(payout);
                            setIsProcessModalOpen(true);
                          }}
                        >
                          <Send className="w-4 h-4 mr-1" />
                          Process
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              </CardHeader>
              
              {expandedDevelopment === payout.developmentId && (
                <CardContent className="p-0">
                  <div className="border-t">
                    {/* Summary Stats */}
                    <div className="grid grid-cols-2 md:grid-cols-5 gap-4 p-4 bg-gray-50/30">
                      <div>
                        <p className="text-xs text-gray-500">Payments</p>
                        <p className="font-semibold">{payout.paymentCount}</p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-500">Stand Price</p>
                        <p className="font-semibold">{formatCurrency(payout.totalStandPrice)}</p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-500">Fees (VAT, etc.)</p>
                        <p className="font-semibold text-gray-600">{formatCurrency(payout.totalFees)}</p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-500">Commission</p>
                        <p className="font-semibold text-gray-600">{formatCurrency(payout.totalCommission)}</p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-500">Paid Out</p>
                        <p className="font-semibold text-green-600">{formatCurrency(payout.paidOut)}</p>
                      </div>
                    </div>
                    
                    {/* Payments Table */}
                    <div className="overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow className="bg-gray-50">
                            <TableHead className="w-10">
                              <input 
                                type="checkbox" 
                                className="rounded border-gray-300"
                                onChange={() => {
                                  const allPending = payout.payments.filter(p => p.status === 'PENDING').map(p => p.id);
                                  const allSelected = allPending.every(id => selectedPayments.includes(id));
                                  if (allSelected) {
                                    setSelectedPayments(prev => prev.filter(id => !allPending.includes(id)));
                                  } else {
                                    setSelectedPayments(prev => [...new Set([...prev, ...allPending])]);
                                  }
                                }}
                                checked={
                                  payout.payments.filter(p => p.status === 'PENDING').length > 0 &&
                                  payout.payments.filter(p => p.status === 'PENDING').every(p => selectedPayments.includes(p.id))
                                }
                              />
                            </TableHead>
                            <TableHead>Reference</TableHead>
                            <TableHead>Client</TableHead>
                            <TableHead>Stand</TableHead>
                            <TableHead className="text-right">Payment</TableHead>
                            <TableHead className="text-right">Stand Price</TableHead>
                            <TableHead className="text-right">Commission</TableHead>
                            <TableHead className="text-right">Developer Net</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead>Date</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {payout.payments.map((payment) => (
                            <TableRow key={payment.id} className="hover:bg-gray-50">
                              <TableCell>
                                {payment.status === 'PENDING' && (
                                  <input 
                                    type="checkbox" 
                                    className="rounded border-gray-300"
                                    checked={selectedPayments.includes(payment.id)}
                                    onChange={() => togglePaymentSelection(payment.id)}
                                  />
                                )}
                              </TableCell>
                              <TableCell className="font-mono text-xs">{payment.reference}</TableCell>
                              <TableCell>
                                <div>
                                  <p className="font-medium">{payment.clientName}</p>
                                  {payment.clientEmail && (
                                    <p className="text-xs text-gray-500">{payment.clientEmail}</p>
                                  )}
                                </div>
                              </TableCell>
                              <TableCell>{payment.standNumber || '-'}</TableCell>
                              <TableCell className="text-right font-medium">
                                {formatCurrency(payment.amount)}
                              </TableCell>
                              <TableCell className="text-right">
                                {formatCurrency(payment.standPricePortion)}
                              </TableCell>
                              <TableCell className="text-right text-gray-600">
                                {formatCurrency(payment.commission)}
                              </TableCell>
                              <TableCell className="text-right font-semibold text-green-600">
                                {formatCurrency(payment.developerNet)}
                              </TableCell>
                              <TableCell>{getStatusBadge(payment.status)}</TableCell>
                              <TableCell className="text-sm text-gray-500">
                                {new Date(payment.createdAt).toLocaleDateString()}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                    
                    {/* Bulk Action Bar */}
                    {selectedPayments.length > 0 && (
                      <div className="p-4 bg-yellow-50 border-t flex items-center justify-between">
                        <p className="text-sm text-yellow-800">
                          {selectedPayments.length} payment(s) selected
                        </p>
                        <Button
                          size="sm"
                          className="bg-[#B8860B] hover:bg-[#996F00]"
                          onClick={() => {
                            setSelectedPayout(payout);
                            setIsProcessModalOpen(true);
                          }}
                        >
                          <Send className="w-4 h-4 mr-1" />
                          Process Selected
                        </Button>
                      </div>
                    )}
                  </div>
                </CardContent>
              )}
            </Card>
          ))
        )}
      </div>

      {/* Process Payout Modal */}
      <Dialog open={isProcessModalOpen} onOpenChange={setIsProcessModalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Process Developer Payout</DialogTitle>
            <DialogDescription>
              Confirm payout to {selectedPayout?.developerName} for {selectedPayout?.developmentName}
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div className="bg-gray-50 p-4 rounded-lg space-y-2">
              <div className="flex justify-between">
                <span className="text-gray-600">Selected Payments:</span>
                <span className="font-medium">{selectedPayments.length}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Total Payout Amount:</span>
                <span className="font-bold text-green-600">
                  {selectedPayout && formatCurrency(
                    selectedPayout.payments
                      .filter(p => selectedPayments.includes(p.id))
                      .reduce((sum, p) => sum + p.developerNet, 0)
                  )}
                </span>
              </div>
            </div>
            
            <div>
              <label className="text-sm font-medium text-gray-700 mb-1 block">
                Notes (optional)
              </label>
              <textarea
                className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#B8860B] focus:border-transparent"
                rows={3}
                placeholder="Add any notes about this payout..."
                id="payout-notes"
              />
            </div>
          </div>
          
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setIsProcessModalOpen(false);
                setSelectedPayments([]);
              }}
              disabled={isProcessing}
            >
              Cancel
            </Button>
            <Button
              className="bg-[#B8860B] hover:bg-[#996F00]"
              onClick={() => {
                const notes = (document.getElementById('payout-notes') as HTMLTextAreaElement)?.value;
                handleProcessPayout(notes);
              }}
              disabled={isProcessing}
            >
              {isProcessing ? (
                <>
                  <RefreshCw className="w-4 h-4 mr-1 animate-spin" />
                  Processing...
                </>
              ) : (
                <>
                  <Send className="w-4 h-4 mr-1" />
                  Confirm Payout
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
