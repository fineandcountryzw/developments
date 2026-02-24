
import React, { useState, useEffect } from 'react';
import { 
  ArrowLeft, DollarSign, Clock, CheckCircle2, AlertCircle,
  FileText, TrendingUp, Landmark, Receipt, Download, Calendar,
  MapPin, Building2, User, Mail, Phone, Loader2
} from 'lucide-react';
import { Client, Payment, Stand, Branch } from '../types.ts';
import { getClientPayments, getStandsByClient, BRANCH_SETTINGS } from '../lib/db';
import { generateReceipt, generateClientStatementPDF } from '../services/pdfService.ts';

interface ClientStatementProps {
  client: Client;
  onBack: () => void;
}

export const ClientStatement: React.FC<ClientStatementProps> = ({ client, onBack }) => {
  const [payments, setPayments] = useState<Payment[]>([]);
  const [stands, setStands] = useState<Stand[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    console.log('NAVIGATING_TO_CLIENT:', client.id);
    const fetchData = async () => {
      setIsLoading(true);
      const [paymentData, standData] = await Promise.all([
        getClientPayments(client.id),
        getStandsByClient(client.id)
      ]);
      setPayments(paymentData);
      setStands(standData);
      setIsLoading(false);
    };
    fetchData();
  }, [client.id]);

  const totalPaid = payments.reduce((sum, p) => sum + p.amountUsd, 0);
  const totalContractValue = stands.reduce((sum, s) => sum + s.priceUsd, 0);
  const outstandingBalance = Math.max(0, totalContractValue - totalPaid);

  const branchSettings = BRANCH_SETTINGS[client.branch];

  if (isLoading) {
    return (
      <div className="h-[60vh] flex flex-col items-center justify-center space-y-4 opacity-30 font-sans">
        <Loader2 className="animate-spin text-fcGold" size={40} />
        <p className="text-[10px] font-black uppercase tracking-[0.4em] text-fcGold font-sans">Loading Statement...</p>
      </div>
    );
  }

  return (
    <div className="space-y-10 animate-in fade-in duration-700 pb-20 font-sans">
      {/* Header with Back Button */}
      <div className="flex items-center justify-between">
        <button 
          onClick={onBack}
          className="flex items-center space-x-3 text-fcGold hover:text-fcSlate transition-colors font-sans"
        >
          <ArrowLeft size={20} />
          <span className="text-sm font-bold uppercase tracking-widest">Back to Registry</span>
        </button>
        <div className="flex items-center space-x-3">
          <div className={`px-4 py-2 rounded-full text-[10px] font-black uppercase tracking-widest border shadow-sm font-sans ${
            client.branch === 'Harare' 
              ? 'bg-fcSlate text-white border-gray-200' 
              : 'bg-fcGold text-white border-fcGold/20'
          }`}>
            {client.branch === 'Harare' ? 'Harare (HQ)' : 'Bulawayo (Branch)'}
          </div>
        </div>
      </div>

      {/* Client Header Card */}
      <div className="bg-white rounded-[40px] border border-fcDivider shadow-sm p-10">
        <div className="flex items-start justify-between">
          <div className="flex items-center space-x-6">
            <div className="w-20 h-20 bg-fcCream rounded-2xl flex items-center justify-center text-fcGold font-black text-2xl shadow-inner">
              {client.name.split(' ').map(n => n[0]).join('')}
            </div>
            <div className="space-y-2">
              <h1 className="text-3xl font-black text-fcSlate tracking-tight font-sans">{client.name}</h1>
              <div className="flex flex-col space-y-1">
                <div className="flex items-center text-sm font-bold text-gray-600">
                  <Mail size={14} className="mr-2 text-fcGold" />
                  {client.email}
                </div>
                <div className="flex items-center text-sm font-bold text-gray-600">
                  <Phone size={14} className="mr-2 text-fcGold" />
                  {client.phone}
                </div>
                {client.nationalId && (
                  <div className="flex items-center text-sm font-bold text-gray-600">
                    <FileText size={14} className="mr-2 text-fcGold" />
                    ID: {client.nationalId}
                  </div>
                )}
              </div>
            </div>
          </div>
          <div className="text-right">
            <div className="text-[10px] font-black text-gray-600 uppercase tracking-widest mb-2 font-sans">Client ID</div>
            <div className="text-sm font-bold text-fcSlate font-mono">{client.id}</div>
          </div>
        </div>
      </div>

      {/* Financial Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white rounded-[32px] border border-fcDivider p-8 shadow-sm">
          <div className="flex items-center justify-between mb-6">
            <div className="p-3 bg-green-50 text-green-600 rounded-2xl">
              <CheckCircle2 size={24} />
            </div>
            <TrendingUp size={16} className="text-green-500" />
          </div>
          <div className="space-y-2">
            <div className="text-[10px] font-black text-gray-600 uppercase tracking-widest font-sans">Total Paid</div>
            <div className="text-3xl font-black text-fcSlate font-mono tabular-nums">${totalPaid.toLocaleString()}</div>
          </div>
        </div>

        <div className="bg-white rounded-[32px] border border-fcDivider p-8 shadow-sm">
          <div className="flex items-center justify-between mb-6">
            <div className="p-3 bg-amber-50 text-amber-600 rounded-2xl">
              <Clock size={24} />
            </div>
          </div>
          <div className="space-y-2">
            <div className="text-[10px] font-black text-gray-600 uppercase tracking-widest font-sans">Outstanding</div>
            <div className="text-3xl font-black text-amber-600 font-mono tabular-nums">${outstandingBalance.toLocaleString()}</div>
          </div>
        </div>

        <div className="bg-white rounded-[32px] border border-fcDivider p-8 shadow-sm">
          <div className="flex items-center justify-between mb-6">
            <div className="p-3 bg-fcGold/10 text-fcGold rounded-2xl">
              <Building2 size={24} />
            </div>
          </div>
          <div className="space-y-2">
            <div className="text-[10px] font-black text-gray-600 uppercase tracking-widest font-sans">Contract Value</div>
            <div className="text-3xl font-black text-fcGold font-mono tabular-nums">${totalContractValue.toLocaleString()}</div>
          </div>
        </div>
      </div>

      {/* Active Reservations */}
      <div className="bg-white rounded-[40px] border border-fcDivider shadow-sm overflow-hidden">
        <div className="p-8 border-b border-fcDivider bg-white">
          <h2 className="text-lg font-black text-fcSlate tracking-tight font-sans">Active Reservations & Holdings</h2>
          <p className="text-[10px] text-gray-600 font-bold uppercase tracking-widest mt-1 font-sans">Property Portfolio</p>
        </div>
        <div className="p-8">
          {stands.length > 0 ? (
            <div className="space-y-6">
              {stands.map(stand => (
                <div key={stand.id} className="flex items-center justify-between p-6 bg-white/50 rounded-2xl border border-fcDivider">
                  <div className="flex items-center space-x-6">
                    <div className="p-4 bg-white rounded-xl border border-fcDivider">
                      <MapPin size={24} className="text-fcGold" />
                    </div>
                    <div className="space-y-1">
                      <div className="text-base font-black text-fcSlate font-sans">{stand.developmentName}</div>
                      <div className="text-sm font-bold text-gray-600 font-sans">Stand #{stand.number}</div>
                      <div className="text-[10px] font-black text-gray-600 uppercase tracking-widest font-sans">
                        Stand ID: {stand.id} • {stand.areaSqm} m² • {stand.status}
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-xl font-black text-fcSlate font-mono">${stand.priceUsd.toLocaleString()}</div>
                    <div className="text-[10px] font-black text-gray-600 uppercase tracking-widest font-sans">Contract Value</div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="py-20 text-center opacity-30">
              <Building2 size={64} strokeWidth={1} className="mx-auto text-slate-300 mb-4" />
              <p className="text-sm font-bold uppercase tracking-widest text-gray-600 font-sans">No properties found</p>
            </div>
          )}
        </div>
      </div>

      {/* Statement of Account */}
      <div className="bg-white rounded-[40px] border border-fcDivider shadow-sm overflow-hidden">
        <div className="p-8 border-b border-fcDivider bg-white flex justify-between items-center">
          <div>
            <h2 className="text-lg font-black text-fcSlate tracking-tight font-sans">Statement of Account</h2>
            <p className="text-[10px] text-gray-600 font-bold uppercase tracking-widest mt-1 font-sans">Transaction History</p>
          </div>
          <button 
            onClick={() => generateClientStatementPDF(client, payments, stands, client.branch)}
            className="flex items-center space-x-2 text-[10px] font-black text-fcGold uppercase tracking-widest hover:brightness-75 transition-all font-sans"
          >
            <Download size={14} />
            <span>Export PDF</span>
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-white/50 border-b border-fcDivider">
              <tr className="text-[10px] font-black uppercase tracking-[0.3em] text-gray-600 font-sans">
                <th className="px-10 py-6">Date</th>
                <th className="px-10 py-6">Reference</th>
                <th className="px-10 py-6">Description</th>
                <th className="px-10 py-6">Method</th>
                <th className="px-10 py-6">Status</th>
                <th className="px-10 py-6 text-right">Amount (USD)</th>
                <th className="px-10 py-6 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {payments.length > 0 ? (
                payments.map(payment => (
                  <tr key={payment.id} className="group hover:bg-white/50 transition-colors">
                    <td className="px-10 py-6">
                      <div className="flex items-center space-x-2">
                        <Calendar size={14} className="text-fcGold" />
                        <span className="text-sm font-bold text-fcSlate font-sans">
                          {new Date(payment.createdAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
                        </span>
                      </div>
                    </td>
                    <td className="px-10 py-6">
                      <div className="text-xs font-bold text-gray-600 font-mono">{payment.reference}</div>
                    </td>
                    <td className="px-10 py-6">
                      <div className="text-sm font-bold text-fcSlate font-sans">{payment.description}</div>
                    </td>
                    <td className="px-10 py-6">
                      <span className={`px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest border font-sans ${
                        payment.paymentMethod === 'Bank' 
                          ? 'bg-white text-blue-600 border-blue-100' 
                          : 'bg-white text-gray-600 border-slate-200'
                      }`}>
                        {payment.paymentMethod}
                      </span>
                    </td>
                    <td className="px-10 py-6">
                      <span className={`flex items-center space-x-1 text-[9px] font-black uppercase tracking-widest px-3 py-1 rounded-full border w-fit font-sans ${
                        payment.verificationStatus === 'Verified' 
                          ? 'bg-green-50 text-green-600 border-green-100' 
                          : 'bg-amber-50 text-amber-600 border-amber-100'
                      }`}>
                        {payment.verificationStatus === 'Verified' ? <CheckCircle2 size={10} /> : <Clock size={10} />}
                        <span>{payment.verificationStatus}</span>
                      </span>
                    </td>
                    <td className="px-10 py-6 text-right">
                      <div className="text-lg font-black text-fcSlate font-mono tabular-nums">${payment.amountUsd.toLocaleString()}</div>
                    </td>
                    <td className="px-10 py-6 text-right">
                      <button 
                        onClick={() => generateReceipt(payment, client.name)}
                        className="p-2 text-slate-300 hover:text-fcGold transition-colors"
                        title="Download Receipt"
                      >
                        <Receipt size={18} />
                      </button>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={7} className="py-24 text-center">
                    <div className="opacity-30 space-y-4">
                      <Landmark size={64} strokeWidth={1} className="mx-auto text-slate-300" />
                      <h3 className="text-lg font-bold text-fcSlate font-sans">No transactions found</h3>
                      <p className="text-sm font-medium text-gray-600 max-w-md mx-auto font-sans">
                        No payment history has been recorded for this client yet.
                      </p>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {payments.length > 0 && (
          <div className="bg-white/50 p-8 border-t border-fcDivider">
            <div className="max-w-md ml-auto space-y-4">
              <div className="flex justify-between items-center">
                <span className="text-sm font-bold text-gray-600 uppercase tracking-widest font-sans">Total Paid:</span>
                <span className="text-xl font-black text-green-600 font-mono">${totalPaid.toLocaleString()}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm font-bold text-gray-600 uppercase tracking-widest font-sans">Outstanding:</span>
                <span className="text-xl font-black text-amber-600 font-mono">${outstandingBalance.toLocaleString()}</span>
              </div>
              <div className="pt-4 border-t border-fcDivider flex justify-between items-center">
                <span className="text-base font-black text-fcSlate uppercase tracking-widest font-sans">Contract Value:</span>
                <span className="text-2xl font-black text-fcGold font-mono">${totalContractValue.toLocaleString()}</span>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
