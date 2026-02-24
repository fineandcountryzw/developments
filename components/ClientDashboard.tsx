import React, { useState, useEffect } from 'react';
import { Clock, DollarSign, Home, Download, AlertCircle, CheckCircle, FileText, Mail, Phone, CalendarDays } from 'lucide-react';
import { getClientReservations, getClientPayments, getClientOwnedProperties } from '../lib/db';
import { generateClientStatementPDF } from '../services/pdfService';
import { EnhancedClientPortfolioView } from './EnhancedClientPortfolioView';

/**
 * Client Investment Terminal & Portfolio Tracker
 * Provides full transparency on property investments:
 * - Reservation timers (48-72 hour countdown)
 * - Payment history and installment tracking
 * - Owned properties (Asset Vault)
 */

interface ClientDashboardProps {
  clientId: string;
  clientName: string;
  clientEmail: string;
  activeTab?: string;
  onTabChange?: (tab: string) => void;
}

interface Reservation {
  id: string;
  standId: string;
  standName: string;
  developmentName: string;
  price: number;
  createdAt: string;
  expiresAt: string;
  agentName: string;
  agentPhone: string;
  status: 'active' | 'expired';
}

interface Payment {
  id: string;
  amount: string | number;
  date?: string;
  createdAt?: string;
  standName?: string;
  standId?: string;
  paymentType?: string;
  method?: string;
  receiptNumber?: string;
  manual_receipt_no?: string;
  received_by?: string;
  surcharge_amount?: string | number;
  description?: string;
  verification_status?: string;
}

interface OwnedProperty {
  id: string;
  standName: string;
  developmentName: string;
  price: number;
  status: 'AOS Signed' | 'Sold';
  purchaseDate: string;
  aosPdfUrl?: string;
  galleryImage?: string;
  infrastructure: {
    water: boolean;
    power: boolean;
    roads: boolean;
  };
}

export const ClientDashboard: React.FC<ClientDashboardProps> = ({ 
  clientId, 
  clientName,
  clientEmail,
  activeTab: externalActiveTab,
  onTabChange 
}) => {
  const [internalActiveModule, setInternalActiveModule] = useState<'reservations' | 'portfolio' | 'statements'>('reservations');
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [ownedProperties, setOwnedProperties] = useState<OwnedProperty[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [currentTime, setCurrentTime] = useState(Date.now());

  // Map external activeTab to internal module
  useEffect(() => {
    if (externalActiveTab === 'portfolio') {
      setInternalActiveModule('portfolio');
    } else if (externalActiveTab === 'legal') {
      setInternalActiveModule('statements');
    } else {
      setInternalActiveModule('reservations');
    }
  }, [externalActiveTab]);

  // Update current time every minute for countdown timers
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTime(Date.now());
    }, 60000); // Update every minute
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    loadClientData();
  }, [clientId]);

  const loadClientData = async () => {
    setIsLoading(true);
    try {
      // Use client-facing APIs for better data consistency
      const [reservationsData, paymentsResponse, propertiesData] = await Promise.all([
        getClientReservations(clientId),
        fetch('/api/client/payments'), // Use client API instead of admin API
        getClientOwnedProperties(clientId)
      ]);

      setReservations(reservationsData);
      
      // Transform payments from client API to match expected format
      if (paymentsResponse.ok) {
        const paymentsData = await paymentsResponse.json();
        if (paymentsData.success && paymentsData.data) {
          // Map to format expected by statement generator
          const formattedPayments = paymentsData.data.map((p: any) => ({
            id: p.id,
            amount_usd: p.amount,
            amount: p.amount, // For compatibility
            created_at: p.date,
            reference: p.receiptNumber || `PAY-${p.id.substring(0, 8)}`,
            manual_receipt_no: p.receiptNumber,
            description: p.description || p.type || 'Payment',
            payment_type: p.type,
            payment_method: 'Bank', // Default, could be enhanced
            receiptNumber: p.receiptNumber,
            receiptUrl: p.receiptUrl
          }));
          setPayments(formattedPayments);
        } else {
          setPayments([]);
        }
      } else {
        // Fallback to admin API if client API fails
        const paymentsData = await getClientPayments(clientId);
        setPayments(paymentsData);
      }
      
      setOwnedProperties(propertiesData);
    } catch (error) {
      console.error('[CLIENT_DASHBOARD] Failed to load data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleModuleChange = (module: 'reservations' | 'portfolio' | 'statements') => {
    setInternalActiveModule(module);
    if (onTabChange) {
      const tabMap = {
        'reservations': 'portfolio',
        'portfolio': 'portfolio',
        'statements': 'legal'
      };
      onTabChange(tabMap[module]);
    }
  };

  const calculateTimeRemaining = (expiresAt: string) => {
    const expiryTime = new Date(expiresAt).getTime();
    const remaining = expiryTime - currentTime;
    
    if (remaining <= 0) {
      return { hours: 0, minutes: 0, status: 'expired' as const };
    }

    const hours = Math.floor(remaining / (1000 * 60 * 60));
    const minutes = Math.floor((remaining % (1000 * 60 * 60)) / (1000 * 60));
    
    let status: 'green' | 'orange' | 'red';
    if (hours > 24) status = 'green';
    else if (hours > 0) status = 'orange';
    else status = 'red';

    return { hours, minutes, status };
  };

  const getTimerColor = (status: 'green' | 'orange' | 'red' | 'expired') => {
    if (status === 'green') return 'text-green-600 bg-green-50 border-green-200';
    if (status === 'orange') return 'text-orange-600 bg-orange-50 border-orange-200';
    if (status === 'red') return 'text-red-600 bg-red-50 border-red-200';
    return 'text-gray-600 bg-white border-slate-200';
  };

  const totalPaid = payments.reduce((sum, p) => {
    const amount = typeof p.amount === 'string' ? parseFloat(p.amount) : p.amount;
    return sum + (isNaN(amount) ? 0 : amount);
  }, 0);
  const totalContractValue = ownedProperties.reduce((sum, p) => sum + p.price, 0);

  const handleDownloadStatement = async () => {
    try {
      const client = {
        id: clientId,
        name: clientName,
        email: clientEmail
      };
      await generateClientStatementPDF(client as any, payments as any, ownedProperties as any, 'Harare');
    } catch (error) {
      console.error('[CLIENT_DASHBOARD] Failed to generate PDF:', error);
    }
  };

  return (
    <div className="w-full min-w-0 space-y-8 animate-in fade-in duration-700 pb-20 font-sans">
      
      {/* Client Header */}
      <div className="bg-gradient-to-r from-fcGold to-fcGold/80 rounded-2xl p-8 text-white shadow-xl">
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-black tracking-tight">Investment Terminal</h1>
              <p className="text-sm font-bold uppercase tracking-widest opacity-90 mt-1">
                {clientName}
              </p>
            </div>
            <div className="p-4 bg-white/20 rounded-2xl backdrop-blur-sm">
              <Home size={32} />
            </div>
          </div>

          {/* Quick Stats */}
          {isLoading ? (
            <div className="flex items-center space-x-2">
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              <span className="text-sm">Loading your portfolio...</span>
            </div>
          ) : (
            <div className="grid grid-cols-3 gap-4 mt-6">
              <div className="bg-white/10 backdrop-blur-sm rounded-xl p-4">
                <div className="text-[10px] font-bold uppercase tracking-widest opacity-80">Active Reservations</div>
                <div className="text-2xl font-black mt-1">{reservations.filter(r => r.status === 'active').length}</div>
              </div>
              <div className="bg-white/10 backdrop-blur-sm rounded-xl p-4">
                <div className="text-[10px] font-bold uppercase tracking-widest opacity-80">Total Paid</div>
                <div className="text-2xl font-black mt-1">${totalPaid.toLocaleString()}</div>
              </div>
              <div className="bg-white/10 backdrop-blur-sm rounded-xl p-4">
                <div className="text-[10px] font-bold uppercase tracking-widest opacity-80">Owned Properties</div>
                <div className="text-2xl font-black mt-1">{ownedProperties.length}</div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Module Navigation */}
      <div className="flex space-x-3 bg-white rounded-2xl p-2 shadow-sm border border-fcDivider overflow-x-auto no-scrollbar">
        <button
          onClick={() => handleModuleChange('reservations')}
          className={`flex-1 min-w-[140px] py-3 px-4 rounded-xl font-bold text-sm uppercase tracking-wider transition-all ${
            internalActiveModule === 'reservations'
              ? 'bg-fcGold text-white shadow-lg'
              : 'text-gray-600 hover:text-fcSlate'
          }`}
        >
          <Clock size={16} className="inline mr-2" />
          Reservations
        </button>
        <button
          onClick={() => handleModuleChange('portfolio')}
          className={`flex-1 min-w-[140px] py-3 px-4 rounded-xl font-bold text-sm uppercase tracking-wider transition-all ${
            internalActiveModule === 'portfolio'
              ? 'bg-fcGold text-white shadow-lg'
              : 'text-gray-600 hover:text-fcSlate'
          }`}
        >
          <Home size={16} className="inline mr-2" />
          My Portfolio
        </button>
        <button
          onClick={() => handleModuleChange('statements')}
          className={`flex-1 min-w-[140px] py-3 px-4 rounded-xl font-bold text-sm uppercase tracking-wider transition-all ${
            internalActiveModule === 'statements'
              ? 'bg-fcGold text-white shadow-lg'
              : 'text-gray-600 hover:text-fcSlate'
          }`}
        >
          <FileText size={16} className="inline mr-2" />
          Statements
        </button>
      </div>

      {/* Active Module Content */}
      <div className="min-h-[600px]">
        
        {/* Reservations Module */}
        {internalActiveModule === 'reservations' && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-2xl font-black text-fcSlate">Active Reservations</h2>
              <span className="text-sm text-gray-600">48-72 Hour Window</span>
            </div>
            
            {reservations.length === 0 ? (
              <div className="bg-white rounded-2xl p-12 text-center border border-fcDivider">
                <AlertCircle size={48} className="mx-auto text-slate-300 mb-4" />
                <p className="text-gray-600 font-medium">No active reservations</p>
              </div>
            ) : (
              <div className="grid gap-6">
                {reservations.map((reservation) => {
                  const timeRemaining = calculateTimeRemaining(reservation.expiresAt);
                  return (
                    <div key={reservation.id} className="bg-white rounded-2xl p-6 border border-fcDivider shadow-sm">
                      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                        
                        {/* Property Info */}
                        <div className="flex-1">
                          <h3 className="text-xl font-black text-fcSlate">{reservation.standName}</h3>
                          <p className="text-sm text-gray-600 font-medium">{reservation.developmentName}</p>
                          <p className="text-2xl font-black text-fcGold mt-2">${reservation.price.toLocaleString()}</p>
                        </div>

                        {/* Timer */}
                        <div className={`flex items-center space-x-4 px-6 py-4 rounded-xl border-2 ${getTimerColor(timeRemaining.status)}`}>
                          <Clock size={32} />
                          <div>
                            <div className="text-[10px] font-bold uppercase tracking-widest opacity-80">Time Remaining</div>
                            {timeRemaining.status === 'expired' ? (
                              <div className="text-2xl font-black">EXPIRED</div>
                            ) : (
                              <div className="text-2xl font-black">
                                {timeRemaining.hours}h {timeRemaining.minutes}m
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Actions */}
                        <div className="flex flex-col gap-2">
                          {timeRemaining.status !== 'expired' ? (
                            <>
                              <button className="px-6 py-3 bg-fcGold text-white rounded-xl font-bold text-sm hover:bg-fcGold/90 transition-all shadow-lg">
                                Proceed to Payment
                              </button>
                              <button className="px-6 py-3 bg-white text-fcSlate border-2 border-fcDivider rounded-xl font-bold text-sm hover:bg-white transition-all flex items-center justify-center gap-2">
                                <Phone size={16} />
                                Contact Agent
                              </button>
                            </>
                          ) : (
                            <button className="px-6 py-3 bg-slate-100 text-gray-600 rounded-xl font-bold text-sm cursor-not-allowed">
                              Reservation Expired
                            </button>
                          )}
                        </div>
                      </div>

                      {/* Agent Info */}
                      <div className="mt-4 pt-4 border-t border-fcDivider flex items-center justify-between text-sm">
                        <span className="text-gray-600">Reserved with: <span className="font-bold text-fcSlate">{reservation.agentName}</span></span>
                        <span className="text-gray-600">{reservation.agentPhone}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Portfolio Module - Merged Payments, Installments & Assets */}
        {internalActiveModule === 'portfolio' && (
          <EnhancedClientPortfolioView 
            clientId={clientId}
            clientEmail={clientEmail}
            activeTab={internalActiveModule}
          />
        )}

        {/* Statements Module */}
        {internalActiveModule === 'statements' && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-2xl font-black text-fcSlate">Account Statements</h2>
              <button
                onClick={handleDownloadStatement}
                className="px-6 py-3 bg-fcGold text-white rounded-xl font-bold text-sm hover:bg-fcGold/90 transition-all shadow-lg flex items-center gap-2"
              >
                <Download size={16} />
                Download Statement
              </button>
            </div>

            <div className="bg-white rounded-2xl p-8 border border-fcDivider shadow-sm text-center">
              <FileText size={48} className="mx-auto text-fcGold mb-4" />
              <h3 className="text-xl font-black text-fcSlate mb-2">Download Full Statement</h3>
              <p className="text-gray-600 mb-6">
                Get a comprehensive PDF statement of all your properties, payments, installments, and balance due.
              </p>
              <button 
                onClick={handleDownloadStatement}
                className="px-8 py-3 bg-fcGold text-white rounded-xl font-bold hover:bg-fcGold/90 transition-all inline-flex items-center gap-2"
              >
                <Download size={20} />
                Download PDF
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
