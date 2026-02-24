'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
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
  Home, 
  Search, 
  Filter, 
  DollarSign, 
  Download, 
  Eye,
  FileText,
  Receipt,
  CreditCard,
  CheckCircle,
  XCircle,
  Clock,
  ChevronDown,
  ChevronUp,
  MoreHorizontal,
  Plus
} from 'lucide-react';
import { formatCurrency } from '@/lib/utils';
import RecordPaymentModal from './RecordPaymentModal';

interface StandsPaymentsTabProps {
  branch: string;
}

interface StandPayment {
  standId: string;
  standNumber: string;
  developmentName: string;
  clientName: string;
  clientEmail: string;
  standPrice: number;
  totalPaid: number;
  balance: number;
  paymentStatus: 'paid' | 'partial' | 'pending' | 'overdue';
  lastPaymentDate: string | null;
  nextDueDate: string | null;
  installmentPlan: boolean;
  totalInstallments: number;
  paidInstallments: number;
  contractStatus: 'signed' | 'pending' | 'none';
}

interface PaymentRecord {
  id: string;
  amount: number;
  method: string;
  status: 'confirmed' | 'pending' | 'rejected';
  createdAt: string;
  receiptUrl?: string;
}

export default function StandsPaymentsTab({ branch }: StandsPaymentsTabProps) {
  const [stands, setStands] = useState<StandPayment[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [selectedStand, setSelectedStand] = useState<StandPayment | null>(null);
  const [payments, setPayments] = useState<PaymentRecord[]>([]);
  const [paymentsLoading, setPaymentsLoading] = useState(false);
  const [expandedStand, setExpandedStand] = useState<string | null>(null);
  const [isRecordPaymentOpen, setIsRecordPaymentOpen] = useState(false);
  const [selectedStandForPayment, setSelectedStandForPayment] = useState<{
    id: string;
    standNumber: string;
    developmentName: string;
    clientId?: string;
    clientName?: string;
  } | null>(null);

  const fetchStands = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (branch && branch !== 'all') params.append('branch', branch);
      if (statusFilter !== 'all') params.append('status', statusFilter);
      if (searchQuery) params.append('search', searchQuery);

      const res = await fetch(`/api/account/stands-payments?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        if (data.success) {
          setStands(data.data);
        }
      }
    } catch (error) {
      console.error('Failed to fetch stands payments:', error);
    } finally {
      setLoading(false);
    }
  }, [branch, statusFilter, searchQuery]);

  const fetchPayments = async (standId: string) => {
    setPaymentsLoading(true);
    try {
      const res = await fetch(`/api/account/stands-payments/${standId}/payments`);
      if (res.ok) {
        const data = await res.json();
        if (data.success) {
          setPayments(data.data);
        }
      }
    } catch (error) {
      console.error('Failed to fetch payments:', error);
    } finally {
      setPaymentsLoading(false);
    }
  };

  useEffect(() => {
    fetchStands();
  }, [fetchStands]);

  const handleViewDetails = (stand: StandPayment) => {
    setSelectedStand(stand);
    fetchPayments(stand.standId);
  };

  const handleDownloadStatement = async (standId: string) => {
    try {
      const res = await fetch(`/api/account/stands-payments/${standId}/statement`);
      if (res.ok) {
        const blob = await res.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `statement-${standId}.pdf`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
      }
    } catch (error) {
      console.error('Failed to download statement:', error);
    }
  };

  const handleRecordPayment = (stand?: StandPayment) => {
    if (stand) {
      setSelectedStandForPayment({
        id: stand.standId,
        standNumber: stand.standNumber,
        developmentName: stand.developmentName,
        clientName: stand.clientName,
      });
    } else {
      setSelectedStandForPayment(null);
    }
    setIsRecordPaymentOpen(true);
  };

  const handlePaymentSuccess = () => {
    fetchStands();
    if (selectedStand) {
      fetchPayments(selectedStand.standId);
    }
  };

  const handleDownloadReceipt = async (paymentId: string) => {
    try {
      const res = await fetch(`/api/account/payments/${paymentId}/receipt`);
      if (res.ok) {
        const blob = await res.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `receipt-${paymentId}.pdf`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
      }
    } catch (error) {
      console.error('Failed to download receipt:', error);
    }
  };

  const getStatusBadge = (status: string) => {
    const styles = {
      paid: 'bg-green-100 text-green-800 border-green-200',
      partial: 'bg-yellow-100 text-yellow-800 border-yellow-200',
      pending: 'bg-gray-100 text-gray-800 border-gray-200',
      overdue: 'bg-red-100 text-red-800 border-red-200',
    };
    const labels = {
      paid: 'Fully Paid',
      partial: 'Partially Paid',
      pending: 'Pending',
      overdue: 'Overdue',
    };
    return (
      <Badge variant="outline" className={styles[status as keyof typeof styles] || styles.pending}>
        {labels[status as keyof typeof labels] || status}
      </Badge>
    );
  };

  const getContractBadge = (status: string) => {
    const styles = {
      signed: 'bg-green-100 text-green-800',
      pending: 'bg-yellow-100 text-yellow-800',
      none: 'bg-gray-100 text-gray-800',
    };
    const labels = {
      signed: 'Signed',
      pending: 'Pending',
      none: 'No Contract',
    };
    return (
      <Badge variant="secondary" className={styles[status as keyof typeof styles] || styles.none}>
        {labels[status as keyof typeof labels] || status}
      </Badge>
    );
  };

  const toggleExpand = (standId: string) => {
    if (expandedStand === standId) {
      setExpandedStand(null);
    } else {
      setExpandedStand(standId);
      fetchPayments(standId);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header & Filters */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Home className="w-5 h-5 text-[#B8860B]" />
            Stands & Payments
          </CardTitle>
          <CardDescription>
            View all stands with their payment status, client details, and payment history
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <Input
                placeholder="Search by stand number, client name, or development..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[180px]">
                <Filter className="w-4 h-4 mr-2" />
                <SelectValue placeholder="Filter by status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value="paid">Fully Paid</SelectItem>
                <SelectItem value="partial">Partially Paid</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="overdue">Overdue</SelectItem>
              </SelectContent>
            </Select>
            <Button variant="outline" onClick={fetchStands}>
              Refresh
            </Button>
            <Button 
              onClick={() => handleRecordPayment()}
              className="bg-[#B8860B] hover:bg-[#9A7209] text-white"
            >
              <Plus className="w-4 h-4 mr-2" />
              Record Payment
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Stands Table */}
      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="flex items-center justify-center h-64">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#B8860B]"></div>
            </div>
          ) : stands.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-64 text-gray-500">
              <Home className="w-12 h-12 mb-4 text-gray-300" />
              <p>No stands found matching your criteria</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Stand</TableHead>
                  <TableHead>Development</TableHead>
                  <TableHead>Client</TableHead>
                  <TableHead>Price</TableHead>
                  <TableHead>Paid</TableHead>
                  <TableHead>Balance</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Contract</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {stands.map((stand) => (
                  <React.Fragment key={stand.standId}>
                    <TableRow className="cursor-pointer hover:bg-gray-50" onClick={() => toggleExpand(stand.standId)}>
                      <TableCell className="font-medium">
                        <div className="flex items-center gap-2">
                          {expandedStand === stand.standId ? (
                            <ChevronUp className="w-4 h-4 text-gray-400" />
                          ) : (
                            <ChevronDown className="w-4 h-4 text-gray-400" />
                          )}
                          {stand.standNumber}
                        </div>
                      </TableCell>
                      <TableCell>{stand.developmentName}</TableCell>
                      <TableCell>
                        <div>
                          <p className="font-medium">{stand.clientName}</p>
                          <p className="text-sm text-gray-500">{stand.clientEmail}</p>
                        </div>
                      </TableCell>
                      <TableCell>{formatCurrency(stand.standPrice)}</TableCell>
                      <TableCell className="text-green-600">{formatCurrency(stand.totalPaid)}</TableCell>
                      <TableCell className={stand.balance > 0 ? 'text-red-600' : 'text-green-600'}>
                        {formatCurrency(stand.balance)}
                      </TableCell>
                      <TableCell>{getStatusBadge(stand.paymentStatus)}</TableCell>
                      <TableCell>{getContractBadge(stand.contractStatus)}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleRecordPayment(stand);
                            }}
                            title="Record Payment"
                          >
                            <DollarSign className="w-4 h-4 text-green-600" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleViewDetails(stand);
                            }}
                            title="View Details"
                          >
                            <Eye className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDownloadStatement(stand.standId);
                            }}
                            title="Download Statement"
                          >
                            <FileText className="w-4 h-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                    
                    {/* Expanded Payment History */}
                    {expandedStand === stand.standId && (
                      <TableRow className="bg-gray-50">
                        <TableCell colSpan={9} className="p-4">
                          <div className="bg-white rounded-lg border border-gray-200 p-4">
                            <h4 className="font-semibold mb-4 flex items-center gap-2">
                              <Receipt className="w-4 h-4" />
                              Payment History
                            </h4>
                            
                            {paymentsLoading ? (
                              <div className="flex items-center justify-center h-32">
                                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-[#B8860B]"></div>
                              </div>
                            ) : payments.length === 0 ? (
                              <p className="text-gray-500 text-center py-8">No payments recorded</p>
                            ) : (
                              <div className="space-y-3">
                                {payments.map((payment) => (
                                  <div
                                    key={payment.id}
                                    className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                                  >
                                    <div className="flex items-center gap-3">
                                      {payment.status === 'confirmed' ? (
                                        <CheckCircle className="w-5 h-5 text-green-500" />
                                      ) : payment.status === 'pending' ? (
                                        <Clock className="w-5 h-5 text-yellow-500" />
                                      ) : (
                                        <XCircle className="w-5 h-5 text-red-500" />
                                      )}
                                      <div>
                                        <p className="font-medium">{formatCurrency(payment.amount)}</p>
                                        <p className="text-sm text-gray-500">
                                          {new Date(payment.createdAt).toLocaleDateString()} • {payment.method}
                                        </p>
                                      </div>
                                    </div>
                                    <div className="flex items-center gap-2">
                                      <Badge variant={payment.status === 'confirmed' ? 'default' : 'secondary'}>
                                        {payment.status}
                                      </Badge>
                                      {payment.status === 'confirmed' && (
                                        <Button
                                          variant="ghost"
                                          size="sm"
                                          onClick={() => handleDownloadReceipt(payment.id)}
                                        >
                                          <Download className="w-4 h-4" />
                                        </Button>
                                      )}
                                    </div>
                                  </div>
                                ))}
                              </div>
                            )}
                            
                            {/* Stand Summary */}
                            <div className="mt-4 pt-4 border-t border-gray-200">
                              <div className="grid grid-cols-4 gap-4 text-sm">
                                <div>
                                  <p className="text-gray-500">Stand Price</p>
                                  <p className="font-semibold">{formatCurrency(stand.standPrice)}</p>
                                </div>
                                <div>
                                  <p className="text-gray-500">Total Paid</p>
                                  <p className="font-semibold text-green-600">{formatCurrency(stand.totalPaid)}</p>
                                </div>
                                <div>
                                  <p className="text-gray-500">Balance</p>
                                  <p className={`font-semibold ${stand.balance > 0 ? 'text-red-600' : 'text-green-600'}`}>
                                    {formatCurrency(stand.balance)}
                                  </p>
                                </div>
                                <div>
                                  <p className="text-gray-500">Installments</p>
                                  <p className="font-semibold">
                                    {stand.paidInstallments} / {stand.totalInstallments}
                                  </p>
                                </div>
                              </div>
                            </div>
                          </div>
                        </TableCell>
                      </TableRow>
                    )}
                  </React.Fragment>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Stand Details Dialog */}
      <Dialog open={!!selectedStand} onOpenChange={() => setSelectedStand(null)}>
        <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Home className="w-5 h-5 text-[#B8860B]" />
              Stand {selectedStand?.standNumber}
            </DialogTitle>
            <DialogDescription>
              {selectedStand?.developmentName}
            </DialogDescription>
          </DialogHeader>
          
          {selectedStand && (
            <div className="space-y-6">
              {/* Client Info */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Client Information</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-sm text-gray-500">Name</p>
                      <p className="font-medium">{selectedStand.clientName}</p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-500">Email</p>
                      <p className="font-medium">{selectedStand.clientEmail}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Payment Summary */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Payment Summary</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="p-4 bg-gray-50 rounded-lg">
                      <p className="text-sm text-gray-500">Stand Price</p>
                      <p className="text-xl font-bold">{formatCurrency(selectedStand.standPrice)}</p>
                    </div>
                    <div className="p-4 bg-green-50 rounded-lg">
                      <p className="text-sm text-gray-500">Total Paid</p>
                      <p className="text-xl font-bold text-green-600">{formatCurrency(selectedStand.totalPaid)}</p>
                    </div>
                    <div className={`p-4 rounded-lg ${selectedStand.balance > 0 ? 'bg-red-50' : 'bg-green-50'}`}>
                      <p className="text-sm text-gray-500">Balance</p>
                      <p className={`text-xl font-bold ${selectedStand.balance > 0 ? 'text-red-600' : 'text-green-600'}`}>
                        {formatCurrency(selectedStand.balance)}
                      </p>
                    </div>
                    <div className="p-4 bg-gray-50 rounded-lg">
                      <p className="text-sm text-gray-500">Payment Status</p>
                      <div className="mt-1">{getStatusBadge(selectedStand.paymentStatus)}</div>
                    </div>
                  </div>
                  
                  {selectedStand.installmentPlan && (
                    <div className="mt-4 p-4 bg-blue-50 rounded-lg">
                      <p className="text-sm text-gray-500">Installment Progress</p>
                      <div className="flex items-center gap-4 mt-2">
                        <div className="flex-1 bg-gray-200 rounded-full h-2">
                          <div
                            className="bg-blue-600 h-2 rounded-full transition-all"
                            style={{
                              width: `${(selectedStand.paidInstallments / selectedStand.totalInstallments) * 100}%`,
                            }}
                          />
                        </div>
                        <p className="text-sm font-medium">
                          {selectedStand.paidInstallments} of {selectedStand.totalInstallments} installments
                        </p>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Payment History */}
              <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                  <CardTitle className="text-base">Payment History</CardTitle>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleDownloadStatement(selectedStand.standId)}
                  >
                    <Download className="w-4 h-4 mr-2" />
                    Download Statement
                  </Button>
                </CardHeader>
                <CardContent>
                  {paymentsLoading ? (
                    <div className="flex items-center justify-center h-32">
                      <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-[#B8860B]"></div>
                    </div>
                  ) : payments.length === 0 ? (
                    <p className="text-gray-500 text-center py-8">No payments recorded</p>
                  ) : (
                    <div className="space-y-3">
                      {payments.map((payment) => (
                        <div
                          key={payment.id}
                          className="flex items-center justify-between p-4 border border-gray-200 rounded-lg"
                        >
                          <div className="flex items-center gap-4">
                            <div className={`p-2 rounded-full ${
                              payment.status === 'confirmed' ? 'bg-green-100' : 
                              payment.status === 'pending' ? 'bg-yellow-100' : 'bg-red-100'
                            }`}>
                              {payment.status === 'confirmed' ? (
                                <CheckCircle className="w-5 h-5 text-green-600" />
                              ) : payment.status === 'pending' ? (
                                <Clock className="w-5 h-5 text-yellow-600" />
                              ) : (
                                <XCircle className="w-5 h-5 text-red-600" />
                              )}
                            </div>
                            <div>
                              <p className="font-semibold">{formatCurrency(payment.amount)}</p>
                              <p className="text-sm text-gray-500">
                                {new Date(payment.createdAt).toLocaleDateString()} • {payment.method}
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <Badge variant={payment.status === 'confirmed' ? 'default' : 'secondary'}>
                              {payment.status}
                            </Badge>
                            {payment.status === 'confirmed' && (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleDownloadReceipt(payment.id)}
                              >
                                <Receipt className="w-4 h-4 mr-2" />
                                Receipt
                              </Button>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          )}
          
          <DialogFooter className="gap-2">
            <Button 
              variant="outline" 
              onClick={() => setSelectedStand(null)}
            >
              Close
            </Button>
            {selectedStand && (
              <Button 
                onClick={() => {
                  setSelectedStand(null);
                  handleRecordPayment(selectedStand);
                }}
                className="bg-[#B8860B] hover:bg-[#9A7209] text-white"
              >
                <Plus className="w-4 h-4 mr-2" />
                Record Payment
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Record Payment Modal */}
      <RecordPaymentModal
        isOpen={isRecordPaymentOpen}
        onClose={() => {
          setIsRecordPaymentOpen(false);
          setSelectedStandForPayment(null);
        }}
        onSuccess={handlePaymentSuccess}
        branch={branch}
        preselectedStand={selectedStandForPayment}
      />
    </div>
  );
}
