'use client';

import React, { useState, useEffect } from 'react';
import { 
  Calendar, DollarSign, Download, CheckCircle2, Clock, AlertCircle,
  Loader2, ChevronDown, ChevronUp, Receipt
} from 'lucide-react';

interface InstallmentPlan {
  id: string;
  developmentName: string;
  standNumber?: string;
  totalAmount: number;
  depositAmount: number;
  depositPaid: boolean;
  periodMonths: number;
  monthlyAmount: number;
  paidAmount: number;
  balance: number;
  nextDueDate?: string;
  status: string;
  installments: Installment[];
  receipts: ReceiptItem[];
}

interface Installment {
  id: string;
  installmentNumber: number;
  amount: number;
  dueDate: string;
  paidAt?: string;
  status: string;
}

interface ReceiptItem {
  id: string;
  receiptNumber: string;
  amount: number;
  createdAt: string;
  type: string;
}

interface ClientInstallmentsViewProps {
  clientEmail: string;
}

export const ClientInstallmentsView: React.FC<ClientInstallmentsViewProps> = ({ clientEmail }) => {
  const [plans, setPlans] = useState<InstallmentPlan[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedPlanId, setExpandedPlanId] = useState<string | null>(null);

  useEffect(() => {
    fetchInstallments();
  }, [clientEmail]);

  const fetchInstallments = async () => {
    setIsLoading(true);
    setError(null);
    
    try {
      const res = await fetch('/api/client/installments');
      if (!res.ok) throw new Error('Failed to fetch installments');
      
      const data = await res.json();
      setPlans(data.data || []);
    } catch (err: any) {
      console.error('Error fetching installments:', err);
      setError(err.message || 'Failed to load installment data');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDownloadReceipt = async (receiptId: string) => {
    try {
      const res = await fetch(`/api/client/receipts/${receiptId}?format=pdf`);
      if (!res.ok) throw new Error('Failed to download receipt');
      
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `receipt-${receiptId}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Error downloading receipt:', err);
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2
    }).format(amount);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    });
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'ACTIVE': return 'bg-blue-100 text-blue-800';
      case 'COMPLETED': return 'bg-green-100 text-green-800';
      case 'PENDING': return 'bg-yellow-100 text-yellow-800';
      case 'DEFAULTED': return 'bg-red-100 text-red-800';
      case 'PAID': return 'bg-green-100 text-green-800';
      case 'OVERDUE': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-6 h-6 animate-spin text-fcGold" />
        <span className="ml-2 text-gray-600">Loading your payment plans...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-center">
        <AlertCircle className="w-6 h-6 text-red-600 mx-auto mb-2" />
        <p className="text-red-600">{error}</p>
        <button 
          onClick={fetchInstallments}
          className="mt-2 px-4 py-1 text-sm bg-red-600 text-white rounded hover:bg-red-700"
        >
          Retry
        </button>
      </div>
    );
  }

  if (plans.length === 0) {
    return (
      <div className="bg-white rounded-2xl p-12 text-center border border-fcDivider">
        <Calendar className="w-12 h-12 mx-auto text-slate-300 mb-4" />
        <p className="text-gray-600 font-medium">No active payment plans</p>
        <p className="text-sm text-gray-400 mt-1">Contact your agent to set up an installment plan</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-6">
        <div className="bg-white rounded-xl p-4 border shadow-sm">
          <div className="text-xs text-gray-500 uppercase font-bold tracking-wider">Total Owed</div>
          <div className="text-xl font-black text-fcSlate mt-1">
            {formatCurrency(plans.reduce((sum, p) => sum + p.totalAmount, 0))}
          </div>
        </div>
        <div className="bg-white rounded-xl p-4 border shadow-sm">
          <div className="text-xs text-gray-500 uppercase font-bold tracking-wider">Total Paid</div>
          <div className="text-xl font-black text-green-600 mt-1">
            {formatCurrency(plans.reduce((sum, p) => sum + p.paidAmount, 0))}
          </div>
        </div>
        <div className="bg-white rounded-xl p-4 border shadow-sm">
          <div className="text-xs text-gray-500 uppercase font-bold tracking-wider">Balance</div>
          <div className="text-xl font-black text-amber-600 mt-1">
            {formatCurrency(plans.reduce((sum, p) => sum + p.balance, 0))}
          </div>
        </div>
      </div>

      {/* Payment Plans */}
      {plans.map(plan => {
        const isExpanded = expandedPlanId === plan.id;
        const progressPercent = Math.round((plan.paidAmount / plan.totalAmount) * 100);
        
        return (
          <div key={plan.id} className="bg-white rounded-2xl border border-fcDivider shadow-sm overflow-hidden">
            {/* Plan Header */}
            <div 
              className="p-4 cursor-pointer hover:bg-gray-50 transition-colors"
              onClick={() => setExpandedPlanId(isExpanded ? null : plan.id)}
            >
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <h3 className="font-bold text-fcSlate">{plan.developmentName}</h3>
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${getStatusColor(plan.status)}`}>
                      {plan.status}
                    </span>
                  </div>
                  {plan.standNumber && (
                    <p className="text-sm text-gray-500">Stand: {plan.standNumber}</p>
                  )}
                </div>
                <div className="text-right mr-4">
                  <div className="text-sm text-gray-500">Balance</div>
                  <div className="font-bold text-amber-600">{formatCurrency(plan.balance)}</div>
                </div>
                {isExpanded ? (
                  <ChevronUp className="w-5 h-5 text-gray-400" />
                ) : (
                  <ChevronDown className="w-5 h-5 text-gray-400" />
                )}
              </div>
              
              {/* Progress Bar */}
              <div className="mt-3">
                <div className="flex justify-between text-xs text-gray-500 mb-1">
                  <span>{formatCurrency(plan.paidAmount)} paid</span>
                  <span>{progressPercent}%</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div 
                    className="bg-green-500 h-2 rounded-full transition-all"
                    style={{ width: `${Math.min(100, progressPercent)}%` }}
                  />
                </div>
              </div>
            </div>
            
            {/* Expanded Content */}
            {isExpanded && (
              <div className="border-t bg-gray-50 p-4">
                {/* Plan Details */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4 text-sm">
                  <div>
                    <div className="text-gray-500">Total Amount</div>
                    <div className="font-bold">{formatCurrency(plan.totalAmount)}</div>
                  </div>
                  <div>
                    <div className="text-gray-500">Deposit ({plan.depositPaid ? 'Paid' : 'Pending'})</div>
                    <div className={`font-bold ${plan.depositPaid ? 'text-green-600' : 'text-amber-600'}`}>
                      {formatCurrency(plan.depositAmount)}
                    </div>
                  </div>
                  <div>
                    <div className="text-gray-500">Monthly Payment</div>
                    <div className="font-bold">{formatCurrency(plan.monthlyAmount)}</div>
                  </div>
                  <div>
                    <div className="text-gray-500">Period</div>
                    <div className="font-bold">{plan.periodMonths} months</div>
                  </div>
                </div>
                
                {/* Next Due Date */}
                {plan.nextDueDate && plan.status === 'ACTIVE' && (
                  <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 mb-4 flex items-center gap-2">
                    <Clock className="w-4 h-4 text-amber-600" />
                    <span className="text-sm text-amber-800">
                      Next payment of {formatCurrency(plan.monthlyAmount)} due on {formatDate(plan.nextDueDate)}
                    </span>
                  </div>
                )}
                
                {/* Installment Schedule */}
                {plan.installments && plan.installments.length > 0 && (
                  <div className="mb-4">
                    <h4 className="font-bold text-sm text-gray-700 mb-2">Payment Schedule</h4>
                    <div className="space-y-2 max-h-48 overflow-y-auto">
                      {plan.installments.map(inst => (
                        <div 
                          key={inst.id}
                          className="flex items-center justify-between p-2 bg-white rounded-lg"
                        >
                          <div className="flex items-center gap-2">
                            <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                              inst.status === 'PAID' ? 'bg-green-100 text-green-800' :
                              inst.status === 'OVERDUE' ? 'bg-red-100 text-red-800' :
                              'bg-gray-100 text-gray-600'
                            }`}>
                              {inst.installmentNumber}
                            </div>
                            <div>
                              <div className="text-sm font-medium">{formatCurrency(inst.amount)}</div>
                              <div className="text-xs text-gray-500">Due: {formatDate(inst.dueDate)}</div>
                            </div>
                          </div>
                          {inst.status === 'PAID' && (
                            <CheckCircle2 className="w-4 h-4 text-green-600" />
                          )}
                          {inst.status === 'OVERDUE' && (
                            <AlertCircle className="w-4 h-4 text-red-600" />
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                
                {/* Receipts */}
                {plan.receipts && plan.receipts.length > 0 && (
                  <div>
                    <h4 className="font-bold text-sm text-gray-700 mb-2">Payment Receipts</h4>
                    <div className="space-y-2">
                      {plan.receipts.map(receipt => (
                        <div 
                          key={receipt.id}
                          className="flex items-center justify-between p-2 bg-white rounded-lg"
                        >
                          <div className="flex items-center gap-2">
                            <Receipt className="w-4 h-4 text-gray-400" />
                            <div>
                              <div className="text-sm font-medium">{receipt.receiptNumber}</div>
                              <div className="text-xs text-gray-500">{receipt.type} • {formatDate(receipt.createdAt)}</div>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-sm">{formatCurrency(receipt.amount)}</span>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDownloadReceipt(receipt.id);
                              }}
                              className="p-1 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded"
                              title="Download Receipt"
                            >
                              <Download className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};

export default ClientInstallmentsView;
