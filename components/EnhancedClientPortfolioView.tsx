'use client';

import React, { useState, useEffect } from 'react';
import { 
  Home, DollarSign, Calendar, TrendingUp, AlertCircle, CheckCircle2,
  Loader2, ChevronDown, ChevronUp, Download, Edit2, Trash2, Plus,
  FileText, Clock, MapPin
} from 'lucide-react';

interface OwnedProperty {
  id: string;
  standNumber: string;
  developmentName: string;
  developmentId: string;
  price: number;
  location?: string;
  size?: string;
  type?: string;
  createdAt: string;
  status?: string;
}

interface DevelopmentTerms {
  depositRequired: number;
  depositPercentage: number;
  maxInstallments: number;
  defaultInstallmentPeriod: number;
  interestRate: number;
  paymentTermsDescription: string;
}

interface PaymentRecord {
  id: string;
  amount: number;
  date: string;
  type: string;
  method: string;
  receiptNumber?: string;
  status: string;
  standId?: string;
}

interface EnhancedPropertyView extends OwnedProperty {
  developmentTerms: DevelopmentTerms;
  payments: PaymentRecord[];
  installmentPlan?: {
    totalAmount: number;
    depositPaid: boolean;
    depositAmount: number;
    periodMonths: number;
    monthlyAmount: number;
    paidAmount: number;
    balance: number;
    nextDueDate?: string;
  };
  calculations: {
    depositRequired: number;
    depositPaid: number;
    depositRemaining: number;
    totalPaid: number;
    balanceRemaining: number;
    percentagePaid: number;
    installmentsRemaining: number;
    estimatedMonthlyPayment: number;
  };
}

interface EnhancedClientPortfolioViewProps {
  clientId: string;
  clientEmail: string;
  activeTab?: string;
}

export const EnhancedClientPortfolioView: React.FC<EnhancedClientPortfolioViewProps> = ({
  clientId,
  clientEmail,
  activeTab
}) => {
  const [properties, setProperties] = useState<EnhancedPropertyView[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedPropertyId, setExpandedPropertyId] = useState<string | null>(null);
  const [editingPropertyId, setEditingPropertyId] = useState<string | null>(null);

  useEffect(() => {
    fetchEnhancedPortfolio();
  }, [clientId, clientEmail]);

  const fetchEnhancedPortfolio = async () => {
    setIsLoading(true);
    setError(null);
    try {
      // Fetch properties, payments, and installment plans in parallel
      const [propertiesRes, paymentsRes, installmentsRes] = await Promise.all([
        fetch(`/api/client/properties?clientId=${clientId}`),
        fetch(`/api/client/payments?clientEmail=${clientEmail}`),
        fetch(`/api/client/installments`)
      ]);

      if (!propertiesRes.ok || !paymentsRes.ok) {
        throw new Error('Failed to fetch portfolio data');
      }

      const propertiesData = await propertiesRes.json();
      const paymentsData = await paymentsRes.json();
      const installmentsData = installmentsRes.ok ? await installmentsRes.json() : { data: [] };

      // Map installment plans by standId for quick lookup
      const plansByStandId = new Map<string, any>();
      (installmentsData.data || []).forEach((plan: any) => {
        if (plan.standId) {
          plansByStandId.set(plan.standId, plan);
        }
      });

      // Enhance properties with calculations using actual installment plan data
      const enhanced = (propertiesData.data || []).map((prop: OwnedProperty) => {
        const propertyPayments = paymentsData.data?.filter(
          (p: PaymentRecord) => p.standId === prop.id
        ) || [];

        // Get actual installment plan for this property if exists
        const installmentPlan = plansByStandId.get(prop.id);

        // Use actual plan data if available, otherwise use defaults
        const developmentTerms: DevelopmentTerms = installmentPlan ? {
          depositRequired: Number(installmentPlan.depositAmount) || prop.price * 0.2,
          depositPercentage: installmentPlan.depositAmount && installmentPlan.totalAmount 
            ? Math.round((Number(installmentPlan.depositAmount) / Number(installmentPlan.totalAmount)) * 100)
            : 20,
          maxInstallments: installmentPlan.periodMonths || 12,
          defaultInstallmentPeriod: installmentPlan.periodMonths || 12,
          interestRate: 0,
          paymentTermsDescription: 'Payment plan based on installment schedule'
        } : {
          depositRequired: prop.price * 0.2,
          depositPercentage: 20,
          maxInstallments: 12,
          defaultInstallmentPeriod: 12,
          interestRate: 0,
          paymentTermsDescription: 'Standard payment plan'
        };

        const depositRequired = developmentTerms.depositRequired;
        const totalPaid = propertyPayments.reduce((sum: number, p: PaymentRecord) => sum + p.amount, 0);
        const depositPaid = Math.min(totalPaid, depositRequired);
        const balanceRemaining = prop.price - totalPaid;
        const percentagePaid = Math.round((totalPaid / prop.price) * 100);

        // Calculate remaining installments from actual plan data
        let installmentsRemaining = 0;
        let estimatedMonthlyPayment = 0;
        
        if (installmentPlan) {
          // Use actual plan data
          const paidInstallments = installmentPlan.paidInstallments || 0;
          const periodMonths = installmentPlan.periodMonths || 12;
          installmentsRemaining = Math.max(0, periodMonths - paidInstallments);
          estimatedMonthlyPayment = Number(installmentPlan.monthlyAmount) || 0;
        } else {
          // Fallback calculation if no plan exists
          installmentsRemaining = developmentTerms.maxInstallments;
          const remainingBalance = Math.max(0, balanceRemaining - depositRequired);
          estimatedMonthlyPayment = remainingBalance > 0
            ? Math.ceil(remainingBalance / (developmentTerms.defaultInstallmentPeriod || 12))
            : 0;
        }

        return {
          ...prop,
          developmentTerms,
          payments: propertyPayments,
          installmentPlan: installmentPlan ? {
            totalAmount: Number(installmentPlan.totalAmount),
            depositPaid: installmentPlan.depositPaid || false,
            depositAmount: Number(installmentPlan.depositAmount),
            periodMonths: installmentPlan.periodMonths,
            monthlyAmount: Number(installmentPlan.monthlyAmount),
            paidAmount: Number(installmentPlan.totalPaid),
            balance: Number(installmentPlan.remainingBalance),
            nextDueDate: installmentPlan.nextDueDate
          } : undefined,
          calculations: {
            depositRequired,
            depositPaid,
            depositRemaining: Math.max(0, depositRequired - depositPaid),
            totalPaid,
            balanceRemaining,
            percentagePaid,
            installmentsRemaining,
            estimatedMonthlyPayment
          }
        };
      });

      setProperties(enhanced);
    } catch (err: any) {
      console.error('Error fetching portfolio:', err);
      setError(err.message || 'Failed to load portfolio');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteProperty = async (propertyId: string) => {
    if (!confirm('Are you sure you want to remove this property from your portfolio?')) return;

    try {
      const res = await fetch(`/api/client/properties/${propertyId}`, {
        method: 'DELETE'
      });

      if (!res.ok) throw new Error('Failed to delete property');

      setProperties(properties.filter(p => p.id !== propertyId));
    } catch (err) {
      console.error('Error deleting property:', err);
      alert('Failed to remove property');
    }
  };

  const handleDownloadStatement = async (propertyId: string) => {
    try {
      const res = await fetch(`/api/client/properties/${propertyId}/statement`);
      if (!res.ok) throw new Error('Failed to download statement');

      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `property-statement-${propertyId}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Error downloading statement:', err);
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(amount);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-6 h-6 animate-spin text-fcGold" />
        <span className="ml-2 text-gray-600">Loading your portfolio...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-xl p-6 text-center">
        <AlertCircle className="w-8 h-8 text-red-600 mx-auto mb-2" />
        <p className="text-red-600">{error}</p>
        <button
          onClick={fetchEnhancedPortfolio}
          className="mt-4 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
        >
          Retry
        </button>
      </div>
    );
  }

  // Summary Statistics
  const totalInvested = properties.reduce((sum, p) => sum + p.price, 0);
  const totalPaid = properties.reduce((sum, p) => sum + p.calculations.totalPaid, 0);
  const totalRemaining = properties.reduce((sum, p) => sum + p.calculations.balanceRemaining, 0);
  const averagePaymentProgress = properties.length > 0
    ? Math.round(properties.reduce((sum, p) => sum + p.calculations.percentagePaid, 0) / properties.length)
    : 0;

  return (
    <div className="space-y-6">
      {/* Portfolio Summary */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl p-4 border border-fcDivider shadow-sm">
          <div className="text-xs text-gray-500 uppercase font-bold tracking-wider">Total Invested</div>
          <div className="text-2xl font-black text-fcSlate mt-2">{formatCurrency(totalInvested)}</div>
          <div className="text-xs text-gray-500 mt-1">{properties.length} properties</div>
        </div>

        <div className="bg-white rounded-xl p-4 border border-fcDivider shadow-sm">
          <div className="text-xs text-gray-500 uppercase font-bold tracking-wider">Amount Paid</div>
          <div className="text-2xl font-black text-green-600 mt-2">{formatCurrency(totalPaid)}</div>
          <div className="text-xs text-gray-500 mt-1">{averagePaymentProgress}% average progress</div>
        </div>

        <div className="bg-white rounded-xl p-4 border border-fcDivider shadow-sm">
          <div className="text-xs text-gray-500 uppercase font-bold tracking-wider">Balance Due</div>
          <div className="text-2xl font-black text-amber-600 mt-2">{formatCurrency(totalRemaining)}</div>
          <div className="text-xs text-gray-500 mt-1">Across all properties</div>
        </div>

        <div className="bg-white rounded-xl p-4 border border-fcDivider shadow-sm">
          <div className="text-xs text-gray-500 uppercase font-bold tracking-wider">Est. Monthly Payment</div>
          <div className="text-2xl font-black text-blue-600 mt-2">
            {formatCurrency(properties.reduce((sum, p) => sum + p.calculations.estimatedMonthlyPayment, 0))}
          </div>
          <div className="text-xs text-gray-500 mt-1">Based on terms</div>
        </div>
      </div>

      {/* Properties List */}
      {properties.length === 0 ? (
        <div className="bg-white rounded-2xl p-12 text-center border border-fcDivider">
          <Home className="w-12 h-12 mx-auto text-slate-300 mb-4" />
          <p className="text-gray-600 font-medium">No properties in your portfolio</p>
          <p className="text-sm text-gray-400 mt-1">Contact your agent to start your investment journey</p>
        </div>
      ) : (
        <div className="space-y-4">
          {properties.map((property) => {
            const isExpanded = expandedPropertyId === property.id;
            const calc = property.calculations;

            return (
              <div
                key={property.id}
                className="bg-white rounded-2xl border border-fcDivider shadow-sm overflow-hidden hover:shadow-md transition-shadow"
              >
                {/* Property Header */}
                <div
                  className="p-6 cursor-pointer hover:bg-gray-50 transition-colors"
                  onClick={() => setExpandedPropertyId(isExpanded ? null : property.id)}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <div className="p-2 bg-fcGold/10 rounded-lg">
                          <Home size={20} className="text-fcGold" />
                        </div>
                        <div>
                          <h3 className="text-xl font-black text-fcSlate">{property.standNumber}</h3>
                          <p className="text-sm text-gray-600">{property.developmentName}</p>
                        </div>
                      </div>

                      {/* Quick Stats Row */}
                      <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mt-4 text-sm">
                        <div>
                          <span className="text-xs text-gray-500 uppercase font-bold">Price</span>
                          <div className="font-black text-fcSlate">{formatCurrency(property.price)}</div>
                        </div>
                        <div>
                          <span className="text-xs text-gray-500 uppercase font-bold">Paid</span>
                          <div className="font-black text-green-600">{formatCurrency(calc.totalPaid)}</div>
                        </div>
                        <div>
                          <span className="text-xs text-gray-500 uppercase font-bold">Balance</span>
                          <div className="font-black text-amber-600">{formatCurrency(calc.balanceRemaining)}</div>
                        </div>
                        <div>
                          <span className="text-xs text-gray-500 uppercase font-bold">Progress</span>
                          <div className="font-black text-blue-600">{calc.percentagePaid}%</div>
                        </div>
                        <div>
                          <span className="text-xs text-gray-500 uppercase font-bold">Monthly</span>
                          <div className="font-black text-purple-600">{formatCurrency(calc.estimatedMonthlyPayment)}</div>
                        </div>
                      </div>

                      {/* Progress Bar */}
                      <div className="mt-4">
                        <div className="w-full bg-gray-200 rounded-full h-2.5 overflow-hidden">
                          <div
                            className="bg-gradient-to-r from-fcGold to-green-500 h-full transition-all duration-300"
                            style={{ width: `${Math.min(100, calc.percentagePaid)}%` }}
                          />
                        </div>
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex gap-2">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDownloadStatement(property.id);
                        }}
                        className="p-2 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                        title="Download Statement"
                      >
                        <Download size={20} />
                      </button>
                      <button
                        className="p-2 text-gray-500 hover:text-purple-600 hover:bg-purple-50 rounded-lg transition-colors"
                        title="Edit Property"
                      >
                        <Edit2 size={20} />
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteProperty(property.id);
                        }}
                        className="p-2 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                        title="Remove Property"
                      >
                        <Trash2 size={20} />
                      </button>
                      {isExpanded ? (
                        <ChevronUp className="w-5 h-5 text-gray-400" />
                      ) : (
                        <ChevronDown className="w-5 h-5 text-gray-400" />
                      )}
                    </div>
                  </div>
                </div>

                {/* Expanded Details */}
                {isExpanded && (
                  <div className="border-t bg-gray-50 p-6 space-y-6">
                    {/* Payment Breakdown */}
                    <div>
                      <h4 className="font-bold text-lg text-fcSlate mb-4 flex items-center gap-2">
                        <DollarSign size={20} className="text-fcGold" />
                        Payment Breakdown
                      </h4>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        {/* Deposit Section */}
                        <div className="bg-white rounded-lg p-4 border border-blue-200">
                          <div className="text-xs text-blue-600 uppercase font-bold mb-3">Deposit</div>
                          <div className="space-y-2">
                            <div className="flex justify-between text-sm">
                              <span className="text-gray-600">Required</span>
                              <span className="font-bold">{formatCurrency(calc.depositRequired)}</span>
                            </div>
                            <div className="flex justify-between text-sm">
                              <span className="text-gray-600">Paid</span>
                              <span className="font-bold text-green-600">{formatCurrency(calc.depositPaid)}</span>
                            </div>
                            <div className="flex justify-between text-sm border-t pt-2">
                              <span className="text-gray-600">Remaining</span>
                              <span className={`font-bold ${calc.depositRemaining > 0 ? 'text-amber-600' : 'text-green-600'}`}>
                                {formatCurrency(calc.depositRemaining)}
                              </span>
                            </div>
                          </div>
                        </div>

                        {/* Installment Section */}
                        <div className="bg-white rounded-lg p-4 border border-purple-200">
                          <div className="text-xs text-purple-600 uppercase font-bold mb-3">Installments</div>
                          <div className="space-y-2">
                            <div className="flex justify-between text-sm">
                              <span className="text-gray-600">Period</span>
                              <span className="font-bold">{property.developmentTerms.defaultInstallmentPeriod} months</span>
                            </div>
                            <div className="flex justify-between text-sm">
                              <span className="text-gray-600">Monthly</span>
                              <span className="font-bold">{formatCurrency(calc.estimatedMonthlyPayment)}</span>
                            </div>
                            <div className="flex justify-between text-sm border-t pt-2">
                              <span className="text-gray-600">Remaining</span>
                              <span className="font-bold text-purple-600">{calc.installmentsRemaining}</span>
                            </div>
                          </div>
                        </div>

                        {/* Summary */}
                        <div className="bg-white rounded-lg p-4 border border-green-200">
                          <div className="text-xs text-green-600 uppercase font-bold mb-3">Summary</div>
                          <div className="space-y-2">
                            <div className="flex justify-between text-sm">
                              <span className="text-gray-600">Total Price</span>
                              <span className="font-bold">{formatCurrency(property.price)}</span>
                            </div>
                            <div className="flex justify-between text-sm">
                              <span className="text-gray-600">Amount Paid</span>
                              <span className="font-bold text-green-600">{formatCurrency(calc.totalPaid)}</span>
                            </div>
                            <div className="flex justify-between text-sm border-t pt-2">
                              <span className="text-gray-600">Balance Due</span>
                              <span className="font-bold text-amber-600">{formatCurrency(calc.balanceRemaining)}</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Development Terms */}
                    <div>
                      <h4 className="font-bold text-lg text-fcSlate mb-4 flex items-center gap-2">
                        <FileText size={20} className="text-fcGold" />
                        Payment Terms
                      </h4>
                      <div className="bg-white rounded-lg p-4 border">
                        <p className="text-sm text-gray-700">{property.developmentTerms.paymentTermsDescription}</p>
                        <div className="grid grid-cols-2 gap-4 mt-4 text-sm">
                          <div>
                            <span className="text-gray-500">Max Installments</span>
                            <div className="font-bold">{property.developmentTerms.maxInstallments}</div>
                          </div>
                          <div>
                            <span className="text-gray-500">Interest Rate</span>
                            <div className="font-bold">{property.developmentTerms.interestRate}%</div>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Payment History */}
                    {property.payments.length > 0 && (
                      <div>
                        <h4 className="font-bold text-lg text-fcSlate mb-4 flex items-center gap-2">
                          <Clock size={20} className="text-fcGold" />
                          Payment History
                        </h4>
                        <div className="space-y-2 max-h-64 overflow-y-auto">
                          {property.payments.map((payment) => (
                            <div
                              key={payment.id}
                              className="flex items-center justify-between p-3 bg-white rounded-lg border border-gray-200 hover:border-gray-300"
                            >
                              <div className="flex-1">
                                <div className="font-medium text-sm text-gray-900">{payment.type}</div>
                                <div className="text-xs text-gray-500">
                                  {formatDate(payment.date)} • {payment.method}
                                </div>
                              </div>
                              <div className="text-right">
                                <div className="font-bold text-green-600">{formatCurrency(payment.amount)}</div>
                                {payment.receiptNumber && (
                                  <div className="text-xs text-gray-500">Receipt: {payment.receiptNumber}</div>
                                )}
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
      )}
    </div>
  );
};

export default EnhancedClientPortfolioView;
