/**
 * Client Dashboard - Redesigned
 * Clean, modern UI for property management and tracking
 * Top navigation layout for desktop/laptop
 */

'use client';

import React, { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { usePaymentRefresh } from '@/hooks/usePaymentRefresh';
import {
  MapPin,
  DollarSign,
  Calendar,
  FileText,
  Download,
  Home,
  Building2,
  TrendingUp,
  Package,
  RefreshCw,
  Loader2,
  Eye,
  CreditCard,
  BarChart2,
  Phone,
  Mail,
  MessageCircle,
  CheckCircle2,
  Clock,
  User,
  ShieldCheck,
} from 'lucide-react';
import { PDFViewButton, PDFDownloadButton } from '@/components/ui/pdf-viewer';
import { DashboardHeader, DashboardTabs, KPICard, StatusBadge, type TabItem } from '@/components/dashboards/shared';
import { getPrimaryContact, generateWhatsAppLink, formatPhoneForTel, type CompanyContact } from '@/lib/config/company';
import { logger } from '@/lib/logger';

interface Reservation {
  id: string;
  property: string;
  location: string;
  status: 'pending' | 'confirmed' | 'completed' | 'cancelled';
  reservationDate: string;
  completionDate?: string;
  price: number;
  paid: number;
  balance: number;
  agent: string;
  agentPhone: string;
  agentEmail?: string;
  termsPdfUrl?: string | null;
  refundPdfUrl?: string | null;
  expiresAt?: string;
}

interface AgentInfo {
  name: string;
  phone: string;
  email?: string;
  isCompanyFallback?: boolean; // Flag to indicate if this is company fallback
}

interface Document {
  id: string;
  name: string;
  type: 'contract' | 'receipt' | 'statement' | 'deed' | 'insurance' | 'other';
  uploadDate: string;
  size: string;
  url?: string;
  amount?: number;
}

interface Payment {
  id: string;
  month: string;
  year?: number;
  amount: number;
  status: 'paid' | 'pending' | 'overdue';
  date: string;
  receiptUrl?: string;
  receiptNumber?: string;
  description?: string;
}

export function ClientDashboard() {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState<'reservations' | 'documents' | 'payments'>('reservations');

  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [documents, setDocuments] = useState<Document[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [assignedAgent, setAssignedAgent] = useState<AgentInfo | null>(null);

  const [metrics, setMetrics] = useState({
    totalInvested: 0,
    activeReservations: 0,
    totalDocuments: 0,
    nextPaymentDue: 0,
  });

  // Fetch client data from APIs - OPTIMIZED with parallel requests
  const fetchClientData = async () => {
    try {
      setRefreshing(true);

      // Claim any unclaimed reservations first (async, don't block)
      fetch('/api/client/claim-reservations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      }).catch(err => {
        // Non-fatal - log but don't block data fetch
        if (process.env.NODE_ENV === 'development') {
          console.warn('[ClientDashboard] Failed to claim reservations:', err);
        }
      });

      // Parallel API calls for better performance (Saved Properties removed per spec)
      // Use unified payments API to get all payments from both Payment and PaymentTransaction tables
      const [reservationsResponse, documentsResponse, paymentsResponse] = await Promise.all([
        fetch('/api/client/reservations'),
        fetch('/api/client/documents'),
        fetch('/api/payments/unified?limit=1000'),
      ]);

      // Process reservations
      try {
        if (reservationsResponse.ok) {
          const reservationsData = await reservationsResponse.json();
          if (reservationsData.success && reservationsData.data) {
            const fetchedReservations: Reservation[] = reservationsData.data.map((res: any) => ({
              id: res.id,
              property: res.stand?.standNumber || res.standNumber || 'Property',
              location: res.stand?.development?.name || res.developmentName || 'Location',
              status: mapReservationStatus(res.status),
              reservationDate: res.createdAt,
              completionDate: res.estimatedCompletionDate,
              price: res.totalAmount || res.finalPriceAtReservation || 0,
              paid: res.depositPaid || 0,
              balance: res.balanceRemaining || 0,
              agent: res.agent?.name || 'Your Agent',
              agentPhone: res.agent?.phone || '+263 77 000 0000',
              agentEmail: res.agent?.email || undefined,
              // Add document URLs if available
              termsPdfUrl: res.stand?.development?.termsPdfUrl || res.termsPdfUrl,
              refundPdfUrl: res.stand?.development?.refundPdfUrl || res.refundPdfUrl,
              expiresAt: res.expiresAt,
            }));
            setReservations(fetchedReservations);

            // Extract assigned agent from reservations
            // Priority: Use agent from most recent active reservation
            let foundAgent: AgentInfo | null = null;

            if (fetchedReservations.length > 0) {
              // Find first reservation with valid agent data
              const reservationWithAgent = fetchedReservations.find(
                (res) => res.agent &&
                  res.agent !== 'Your Agent' &&
                  res.agentPhone &&
                  res.agentPhone !== '+263 77 000 0000' // Skip placeholder
              );

              if (reservationWithAgent) {
                foundAgent = {
                  name: reservationWithAgent.agent,
                  phone: reservationWithAgent.agentPhone,
                  email: reservationWithAgent.agentEmail,
                  isCompanyFallback: false,
                };
              }
            }

            // Fallback to company contact if no agent found
            if (!foundAgent) {
              const companyContact = getPrimaryContact();
              foundAgent = {
                name: companyContact.label,
                phone: companyContact.phone,
                email: companyContact.email,
                isCompanyFallback: true,
              };

              // Log non-fatal warning for debugging
              if (process.env.NODE_ENV === 'development') {
                logger.warn('Client Dashboard: No agent found in reservations, using company fallback', {
                  module: 'ClientDashboard',
                  reservationCount: fetchedReservations.length,
                });
              }
            }

            setAssignedAgent(foundAgent);

            const total = fetchedReservations.reduce((sum, r) => sum + r.price, 0);
            setMetrics(prev => ({
              ...prev,
              totalInvested: total,
              activeReservations: fetchedReservations.filter(r => r.status !== 'completed' && r.status !== 'cancelled').length,
            }));
          } else if (!Array.isArray(reservationsData.data)) {
            console.error('[ClientDashboard] Reservations data is not an array:', { data: reservationsData.data, type: typeof reservationsData.data });
            setReservations([]);
          }
        }
      } catch (reservationError) {
        console.error('[ClientDashboard] Error processing reservations:', reservationError);
        setReservations([]);
      }
      // Process documents
      try {
        if (documentsResponse.ok) {
          const documentsData = await documentsResponse.json();
          if (documentsData.success && documentsData.data) {
            const fetchedDocuments: Document[] = documentsData.data.map((doc: any) => ({
              id: doc.id,
              name: doc.name,
              type: doc.type as Document['type'],
              uploadDate: doc.date,
              size: doc.amount ? `$${doc.amount.toLocaleString()}` : 'PDF',
              url: doc.url,
              amount: doc.amount,
            }));
            setDocuments(fetchedDocuments);
            setMetrics(prev => ({ ...prev, totalDocuments: fetchedDocuments.length }));
          } else {
            console.error('[ClientDashboard] Documents data is not an array:', { data: documentsData.data, type: typeof documentsData.data });
            setDocuments([]);
          }
        }
      } catch (documentError) {
        console.error('[ClientDashboard] Error processing documents:', documentError);
        setDocuments([]);
      }

      // Process payments from unified API
      try {
        if (paymentsResponse.ok) {
          const paymentsData = await paymentsResponse.json();
          // Unified API returns { data: { payments: [...], summary: {...} } }
          const paymentsArray = paymentsData.data?.payments || [];
          if (paymentsData.success && paymentsArray.length > 0) {
            const fetchedPayments: Payment[] = paymentsArray.map((p: any) => ({
              id: p.id,
              month: new Date(p.createdAt).toLocaleString('default', { month: 'short' }),
              year: new Date(p.createdAt).getFullYear(),
              amount: p.amount,
              status: (p.status === 'CONFIRMED' || p.status === 'VERIFIED' || p.status === 'COMPLETED') ? 'paid' :
                p.status === 'PENDING' ? 'pending' : 'overdue',
              date: p.createdAt,
              receiptUrl: p.receiptUrl,
              receiptNumber: p.manualReceiptNo || p.reference,
              description: p.description || p.paymentType,
            }));
            setPayments(fetchedPayments);

            // Update metrics with payment summary
            const pendingPayment = fetchedPayments.find(p => p.status === 'pending');
            if (pendingPayment) {
              setMetrics(prev => ({ ...prev, nextPaymentDue: pendingPayment.amount }));
            }
          }
        }
      } catch (paymentError) {
        console.error('[ClientDashboard] Error processing payments:', paymentError);
        setPayments([]);
      }

    } catch (error) {
      console.error('Error fetching client data:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const mapReservationStatus = (status: string): Reservation['status'] => {
    const lowerStatus = status?.toLowerCase() || '';
    if (lowerStatus.includes('confirm') || lowerStatus.includes('active')) return 'confirmed';
    if (lowerStatus.includes('complet') || lowerStatus.includes('closed')) return 'completed';
    if (lowerStatus.includes('cancel')) return 'cancelled';
    return 'pending';
  };

  useEffect(() => {
    fetchClientData();
  }, []);

  // Listen for payment refresh events and auto-refresh dashboard
  usePaymentRefresh(() => fetchClientData(), []);

  // Tab configuration (Saved Properties removed per spec)
  const tabs: TabItem[] = [
    { id: 'reservations', label: 'Reservations', icon: FileText },
    { id: 'documents', label: 'Documents', icon: Package },
    { id: 'payments', label: 'Payments', icon: CreditCard },
  ];

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <div className="text-center space-y-3">
          <Loader2 className="w-10 h-10 animate-spin text-fcGold mx-auto" />
          <p className="text-gray-600 font-normal text-base">Loading your portal...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white">
      {/* Header - Using shared component */}
      <DashboardHeader
        title="Client Portal"
        subtitle="Fine & Country Zimbabwe • All amounts USD"
        onRefresh={fetchClientData}
        refreshing={refreshing}
        showNotifications={true}
        actions={
          <button
            onClick={() => {
              // Navigate to landing page and scroll to developments section
              if (window.location.pathname === '/') {
                // Already on landing page, just scroll
                const inventorySection = document.getElementById('inventory');
                inventorySection?.scrollIntoView({ behavior: 'smooth', block: 'start' });
              } else {
                // Navigate to landing page with anchor, then scroll after load
                window.location.href = '/#inventory';
              }
            }}
            className="bg-fcGold hover:bg-fcGold/90 text-white px-6 py-3 rounded-xl text-base font-semibold flex items-center gap-2 shadow-sm hover:shadow-md transition-all duration-150 ease-out"
          >
            <Home className="w-4 h-4" aria-hidden="true" />
            Browse
          </button>
        }
        onBrowseClick={() => {
          // Navigate to landing page and scroll to developments section
          if (window.location.pathname === '/') {
            const inventorySection = document.getElementById('inventory');
            inventorySection?.scrollIntoView({ behavior: 'smooth', block: 'start' });
          } else {
            window.location.href = '/#inventory';
          }
        }}
        onNotificationsClick={() => {
          // TODO: Implement notifications panel or scroll to notifications section
          console.log('Notifications clicked');
        }}
      />

      {/* Navigation Tabs - Using shared component */}
      <DashboardTabs
        tabs={tabs}
        activeTab={activeTab}
        onTabChange={(tabId) => setActiveTab(tabId as 'reservations' | 'documents' | 'payments')}
      />

      {/* Main Content */}
      <main className="max-w-full lg:max-w-[1280px] mx-auto px-4 md:px-6 lg:px-8 py-6 md:py-8 lg:py-12 pb-24 md:pb-12">
        {/* Mobile: Subtitle & Refresh (moved from header) */}
        <div className="md:hidden mb-6 space-y-3">
          <p className="text-xs text-gray-500 font-normal">Fine & Country Zimbabwe • All amounts USD</p>
          <button
            onClick={fetchClientData}
            disabled={refreshing}
            className="flex items-center gap-2 text-sm font-medium text-gray-700 hover:text-fcGold transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
            <span>{refreshing ? 'Refreshing...' : 'Refresh'}</span>
          </button>
        </div>

        <div className="space-y-8 md:space-y-12 animate-in fade-in duration-200">

          {/* Summary Hero Section - Landing Page Style */}
          <section className="space-y-6">
            <div className="text-center md:text-left space-y-2">
              <h1 className="text-3xl md:text-[32px] font-semibold text-fcSlate tracking-tight leading-[1.25]">
                Your Investment Portfolio
              </h1>
              <p className="text-base text-gray-600 leading-[1.6] font-normal">
                Track your reservations, payments, and documents in one place
              </p>
            </div>

            {/* KPI Cards - Simple White Cards Matching Landing Page */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
              <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm hover:shadow-md transition-shadow duration-150 ease-out">
                <div className="flex items-center justify-between mb-4">
                  <div className="p-2 bg-fcGold/10 rounded-lg">
                    <TrendingUp className="w-5 h-5 text-fcGold" aria-hidden="true" />
                  </div>
                </div>
                <div className="text-3xl font-semibold text-fcSlate mb-1">${metrics.totalInvested.toLocaleString()}</div>
                <div className="text-sm text-gray-600 font-normal">Total Invested</div>
              </div>

              <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm hover:shadow-md transition-shadow duration-150 ease-out">
                <div className="flex items-center justify-between mb-4">
                  <div className="p-2 bg-fcGold/10 rounded-lg">
                    <Building2 className="w-5 h-5 text-fcGold" aria-hidden="true" />
                  </div>
                </div>
                <div className="text-3xl font-semibold text-fcSlate mb-1">{metrics.activeReservations}</div>
                <div className="text-sm text-gray-600 font-normal">Active Reservations</div>
              </div>

              <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm hover:shadow-md transition-shadow duration-150 ease-out">
                <div className="flex items-center justify-between mb-4">
                  <div className="p-2 bg-fcGold/10 rounded-lg">
                    <Package className="w-5 h-5 text-fcGold" aria-hidden="true" />
                  </div>
                </div>
                <div className="text-3xl font-semibold text-fcSlate mb-1">{metrics.totalDocuments}</div>
                <div className="text-sm text-gray-600 font-normal">Documents</div>
              </div>

              <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm hover:shadow-md transition-shadow duration-150 ease-out">
                <div className="flex items-center justify-between mb-4">
                  <div className="p-2 bg-fcGold/10 rounded-lg">
                    <DollarSign className="w-5 h-5 text-fcGold" aria-hidden="true" />
                  </div>
                </div>
                <div className="text-3xl font-semibold text-fcSlate mb-1">${metrics.nextPaymentDue.toLocaleString()}</div>
                <div className="text-sm text-gray-600 font-normal">Next Payment</div>
              </div>
            </div>
          </section>

          {/* Support & Actions Zone - Your Agent / Support Card */}
          {assignedAgent && (
            <section className="space-y-6">
              <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm hover:shadow-md transition-shadow duration-150 ease-out">
                <div className="flex items-start justify-between mb-6">
                  <div className="flex items-center gap-4">
                    <div className="p-3 bg-fcGold/10 rounded-xl">
                      <User className="w-6 h-6 text-fcGold" aria-hidden="true" />
                    </div>
                    <div>
                      <h2 className="text-xl font-semibold text-fcSlate mb-1 leading-[1.3]">
                        {assignedAgent.isCompanyFallback ? 'Support' : 'Your Agent'}
                      </h2>
                      <p className="text-sm text-gray-600 font-normal">
                        {assignedAgent.isCompanyFallback
                          ? 'Contact our support team for assistance'
                          : 'Your dedicated contact for questions and support'}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  {/* Contact Info */}
                  <div className="bg-gray-50 rounded-xl p-4">
                    <div className="text-base font-semibold text-fcSlate mb-1">{assignedAgent.name}</div>
                    <div className="flex items-center gap-2 text-sm text-gray-600 font-normal">
                      <Phone className="w-4 h-4" />
                      <a href={`tel:${formatPhoneForTel(assignedAgent.phone)}`} className="hover:text-fcGold transition-colors">
                        {assignedAgent.phone}
                      </a>
                    </div>
                    {assignedAgent.email && (
                      <div className="flex items-center gap-2 text-sm text-gray-600 font-normal mt-2">
                        <Mail className="w-4 h-4" />
                        <a href={`mailto:${assignedAgent.email}`} className="hover:text-fcGold transition-colors">
                          {assignedAgent.email}
                        </a>
                      </div>
                    )}
                  </div>

                  {/* Contact Actions */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <a
                      href={`tel:${formatPhoneForTel(assignedAgent.phone)}`}
                      className="flex items-center justify-center gap-2 px-4 py-3 bg-white border border-gray-200 text-fcSlate font-semibold text-sm rounded-xl hover:border-fcGold hover:text-fcGold transition-all duration-150 ease-out min-h-[44px]"
                    >
                      <Phone className="w-4 h-4" />
                      Call
                    </a>
                    <a
                      href={generateWhatsAppLink(
                        assignedAgent.phone,
                        assignedAgent.isCompanyFallback
                          ? 'Hello, I need assistance with my reservation.'
                          : `Hello ${assignedAgent.name}, I have a question about my reservation.`
                      )}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center justify-center gap-2 px-4 py-3 bg-white border border-gray-200 text-fcSlate font-semibold text-sm rounded-xl hover:border-green-500 hover:text-green-600 transition-all duration-150 ease-out min-h-[44px]"
                    >
                      <MessageCircle className="w-4 h-4" />
                      WhatsApp
                    </a>
                    {assignedAgent.email && (
                      <a
                        href={`mailto:${assignedAgent.email}?subject=${encodeURIComponent(assignedAgent.isCompanyFallback ? 'Support Request' : 'Question about my reservation')}`}
                        className="flex items-center justify-center gap-2 px-4 py-3 bg-white border border-gray-200 text-fcSlate font-semibold text-sm rounded-xl hover:border-fcGold hover:text-fcGold transition-all duration-150 ease-out min-h-[44px]"
                      >
                        <Mail className="w-4 h-4" />
                        Email
                      </a>
                    )}
                  </div>

                  {/* Reassurance Message */}
                  <div className="pt-4 border-t border-gray-100">
                    <p className="text-sm text-gray-600 font-normal leading-relaxed">
                      {assignedAgent.isCompanyFallback
                        ? 'Our support team is here to help. We typically respond within 24 hours.'
                        : 'Your reservation is secure. Your agent will guide you through the next steps.'}
                    </p>
                  </div>
                </div>
              </div>
            </section>
          )}

          {/* Reservations Section */}
          {activeTab === 'reservations' && (
            <section className="space-y-6 animate-in fade-in duration-200">
              <div className="flex justify-between items-center">
                <h2 className="text-2xl md:text-[28px] font-semibold text-fcSlate tracking-tight leading-[1.3]">Your Reservations</h2>
                <span className="text-sm text-gray-500 font-normal">{reservations.length} {reservations.length === 1 ? 'reservation' : 'reservations'}</span>
              </div>

              <div className="space-y-4">
                {reservations.length === 0 ? (
                  <div className="bg-white rounded-2xl border border-gray-200 p-12 text-center shadow-sm">
                    <FileText className="w-14 h-14 text-gray-300 mx-auto mb-4" aria-hidden="true" />
                    <h3 className="text-xl font-semibold text-fcSlate mb-2">You haven't reserved a stand yet</h3>
                    <p className="text-base text-gray-600 mb-6 leading-[1.6] font-normal">Browse available developments and reserve your stand to get started.</p>
                    <button
                      onClick={() => {
                        // Navigate to landing page and scroll to developments section
                        if (window.location.pathname === '/') {
                          // Already on landing page, just scroll
                          const inventorySection = document.getElementById('inventory');
                          inventorySection?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                        } else {
                          // Navigate to landing page with anchor, then scroll after load
                          window.location.href = '/#inventory';
                        }
                      }}
                      className="inline-flex items-center gap-2 bg-fcGold text-white px-6 py-3 rounded-xl font-semibold text-base hover:bg-fcGold/90 transition-all duration-150 ease-out shadow-sm hover:shadow-md"
                    >
                      Browse Developments
                      <Home className="w-4 h-4" />
                    </button>
                  </div>
                ) : reservations.map((reservation) => {
                  const paymentProgress = (reservation.paid / reservation.price) * 100;

                  return (
                    <div
                      key={reservation.id}
                      className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm hover:shadow-md transition-shadow duration-150 ease-out"
                    >
                      <div className="flex flex-col sm:flex-row justify-between items-start gap-4 mb-6">
                        <div className="flex-1">
                          <h3 className="text-xl font-semibold text-fcSlate mb-2 leading-[1.3]">{reservation.property}</h3>
                          <div className="flex items-center text-base text-gray-600 font-normal">
                            <MapPin className="w-4 h-4 mr-2" />
                            {reservation.location}
                          </div>
                        </div>
                        <StatusBadge status={reservation.status} size="md" />
                      </div>

                      {/* Status Timeline */}
                      <div className="mb-6 pb-6 border-b border-gray-100">
                        <div className="flex items-center justify-between relative">
                          {/* Timeline Steps */}
                          <div className="flex items-center gap-2 flex-1">
                            <div className={`flex flex-col items-center gap-1 flex-1 ${reservation.status !== 'cancelled' ? 'opacity-100' : 'opacity-40'}`}>
                              <div className={`w-8 h-8 rounded-full flex items-center justify-center ${reservation.status === 'pending' || reservation.status === 'confirmed' || reservation.status === 'completed' ? 'bg-fcGold text-white' : 'bg-gray-200 text-gray-500'}`}>
                                {reservation.status === 'pending' || reservation.status === 'confirmed' || reservation.status === 'completed' ? (
                                  <CheckCircle2 className="w-4 h-4" />
                                ) : (
                                  <Clock className="w-4 h-4" />
                                )}
                              </div>
                              <span className="text-xs font-medium text-gray-600 text-center">Reserved</span>
                            </div>
                            <div className={`h-0.5 flex-1 ${reservation.status === 'confirmed' || reservation.status === 'completed' ? 'bg-fcGold' : 'bg-gray-200'}`} />
                            <div className={`flex flex-col items-center gap-1 flex-1 ${reservation.status === 'confirmed' || reservation.status === 'completed' ? 'opacity-100' : 'opacity-40'}`}>
                              <div className={`w-8 h-8 rounded-full flex items-center justify-center ${reservation.status === 'confirmed' || reservation.status === 'completed' ? 'bg-fcGold text-white' : 'bg-gray-200 text-gray-500'}`}>
                                {reservation.status === 'confirmed' || reservation.status === 'completed' ? (
                                  <CheckCircle2 className="w-4 h-4" />
                                ) : (
                                  <Clock className="w-4 h-4" />
                                )}
                              </div>
                              <span className="text-xs font-medium text-gray-600 text-center">Paid</span>
                            </div>
                            <div className={`h-0.5 flex-1 ${reservation.status === 'completed' ? 'bg-fcGold' : 'bg-gray-200'}`} />
                            <div className={`flex flex-col items-center gap-1 flex-1 ${reservation.status === 'completed' ? 'opacity-100' : 'opacity-40'}`}>
                              <div className={`w-8 h-8 rounded-full flex items-center justify-center ${reservation.status === 'completed' ? 'bg-fcGold text-white' : 'bg-gray-200 text-gray-500'}`}>
                                {reservation.status === 'completed' ? (
                                  <CheckCircle2 className="w-4 h-4" />
                                ) : (
                                  <Clock className="w-4 h-4" />
                                )}
                              </div>
                              <span className="text-xs font-medium text-gray-600 text-center">Complete</span>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Payment Confidence */}
                      <div className="mb-6 bg-gray-50 rounded-xl p-4">
                        <div className="flex justify-between items-center mb-3">
                          <span className="text-sm font-semibold text-fcSlate">Payment Progress</span>
                          <span className="text-sm font-semibold text-fcSlate">{paymentProgress.toFixed(0)}%</span>
                        </div>
                        <div className="w-full bg-gray-200 rounded-full h-2.5 mb-3">
                          <div
                            className="bg-fcGold h-2.5 rounded-full transition-all duration-300 ease-out"
                            style={{ width: `${paymentProgress}%` }}
                          />
                        </div>
                        <div className="flex items-center justify-between text-xs text-gray-600 font-normal">
                          <span>Paid: ${reservation.paid.toLocaleString()}</span>
                          <span>Balance: ${reservation.balance.toLocaleString()}</span>
                        </div>
                        {reservation.balance > 0 && (
                          <div className="mt-3 pt-3 border-t border-gray-200">
                            <div className="flex items-center justify-between">
                              <span className="text-xs text-gray-600 font-normal">Next payment due</span>
                              <span className="text-sm font-semibold text-amber-600">
                                ${metrics.nextPaymentDue > 0 ? metrics.nextPaymentDue.toLocaleString() : reservation.balance.toLocaleString()}
                              </span>
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Document Trust */}
                      {(reservation.termsPdfUrl || reservation.refundPdfUrl) && (
                        <div className="py-4 border-t border-gray-100">
                          <div className="flex items-center justify-between mb-3">
                            <p className="text-xs font-medium text-gray-600 uppercase tracking-wider">Documents</p>
                            <div className="flex items-center gap-1 text-xs text-gray-500 font-normal">
                              <CheckCircle2 className="w-3 h-3 text-green-600" />
                              <span>Verified</span>
                            </div>
                          </div>
                          <div className="flex flex-wrap gap-3">
                            {reservation.termsPdfUrl && (
                              <a
                                href={reservation.termsPdfUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-200 hover:border-fcGold hover:text-fcGold rounded-xl transition-all duration-150 ease-out"
                              >
                                <FileText className="w-4 h-4" />
                                Terms & Conditions
                              </a>
                            )}
                            {reservation.refundPdfUrl && (
                              <a
                                href={reservation.refundPdfUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-200 hover:border-fcGold hover:text-fcGold rounded-xl transition-all duration-150 ease-out"
                              >
                                <FileText className="w-4 h-4" />
                                Refund Policy
                              </a>
                            )}
                          </div>
                        </div>
                      )}

                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-6 py-6 border-t border-gray-100">
                        <div>
                          <div className="text-xs text-gray-600 mb-2 font-normal">Total Price</div>
                          <div className="text-lg font-semibold text-fcSlate">${reservation.price.toLocaleString()}</div>
                        </div>
                        <div>
                          <div className="text-xs text-gray-600 mb-2 font-normal">Paid</div>
                          <div className="text-lg font-semibold text-green-600">${reservation.paid.toLocaleString()}</div>
                        </div>
                        <div>
                          <div className="text-xs text-gray-600 mb-2 font-normal">Balance</div>
                          <div className="text-lg font-semibold text-amber-600">${reservation.balance.toLocaleString()}</div>
                        </div>
                        <div>
                          <div className="text-xs text-gray-600 mb-2 font-normal">Reserved On</div>
                          <div className="text-base font-semibold text-fcSlate">
                            {new Date(reservation.reservationDate).toLocaleDateString()}
                          </div>
                        </div>
                      </div>

                      {/* Reassurance Message */}
                      <div className="pt-6 border-t border-gray-100">
                        <div className="bg-fcGold/5 rounded-xl p-4 border border-fcGold/20">
                          <div className="flex items-start gap-3">
                            <ShieldCheck className="w-5 h-5 text-fcGold flex-shrink-0 mt-0.5" />
                            <div>
                              <p className="text-sm font-semibold text-fcSlate mb-1">Your reservation is secure</p>
                              <p className="text-xs text-gray-600 font-normal leading-relaxed">
                                Your agent will guide you through the next steps. Contact them anytime if you have questions.
                              </p>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          )}

          {/* Documents Section */}
          {activeTab === 'documents' && (
            <section className="space-y-6 animate-in fade-in duration-200">
              <div className="flex justify-between items-center">
                <h2 className="text-2xl md:text-[28px] font-semibold text-fcSlate tracking-tight leading-[1.3]">Your Documents</h2>
                <span className="text-sm text-gray-500 font-normal">{documents.length} {documents.length === 1 ? 'file' : 'files'}</span>
              </div>

              <div className="space-y-4">
                {documents.length === 0 ? (
                  <div className="bg-white rounded-2xl border border-gray-200 p-12 text-center shadow-sm">
                    <Package className="w-14 h-14 text-gray-300 mx-auto mb-4" aria-hidden="true" />
                    <h3 className="text-xl font-semibold text-fcSlate mb-2">No documents yet</h3>
                    <p className="text-base text-gray-600 leading-[1.6] font-normal">Contracts, receipts, and statements will appear here once available.</p>
                  </div>
                ) : documents.map((doc) => {
                  const docIcon = doc.type === 'contract' ? FileText : doc.type === 'receipt' ? DollarSign : doc.type === 'statement' ? BarChart2 : FileText;

                  return (
                    <div
                      key={doc.id}
                      className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm hover:shadow-md transition-shadow duration-150 ease-out flex items-center justify-between"
                    >
                      <div className="flex items-center gap-4 flex-1">
                        <div className="p-2 bg-fcGold/10 rounded-lg">
                          {React.createElement(docIcon, { className: "w-5 h-5 text-fcGold" })}
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <h3 className="text-base font-semibold text-fcSlate">{doc.name}</h3>
                            <CheckCircle2 className="w-4 h-4 text-green-600" aria-label="Verified document" />
                          </div>
                          <p className="text-sm text-gray-600 font-normal">
                            Updated {new Date(doc.uploadDate).toLocaleDateString()} • {doc.size}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <StatusBadge status={doc.type} size="sm" />
                        {doc.url && (
                          <>
                            <PDFViewButton
                              url={doc.url}
                              title={doc.name}
                              filename={`${doc.name}.pdf`}
                              variant="icon"
                              className="text-gray-500 hover:text-[#B8860B]"
                            />
                            <PDFDownloadButton
                              url={doc.url}
                              filename={`${doc.name}.pdf`}
                              variant="icon"
                              className="text-gray-500 hover:text-[#B8860B]"
                            />
                          </>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          )}

          {/* Payments Section */}
          {activeTab === 'payments' && (
            <section className="space-y-6 animate-in fade-in duration-200">
              <div className="flex justify-between items-center">
                <h2 className="text-2xl md:text-[28px] font-semibold text-fcSlate tracking-tight leading-[1.3]">Payment Timeline</h2>
                <span className="text-sm text-gray-500 font-normal">{payments.length} {payments.length === 1 ? 'payment' : 'payments'}</span>
              </div>

              <div className="space-y-4">
                {payments.length === 0 ? (
                  <div className="bg-white rounded-2xl border border-gray-200 p-12 text-center shadow-sm">
                    <CreditCard className="w-14 h-14 text-gray-300 mx-auto mb-4" aria-hidden="true" />
                    <h3 className="text-xl font-semibold text-fcSlate mb-2">No payments yet</h3>
                    <p className="text-base text-gray-600 leading-[1.6] font-normal">Payment history will appear here once you have made payments.</p>
                  </div>
                ) : payments.map((payment) => {
                  return (
                    <div
                      key={payment.id}
                      className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm hover:shadow-md transition-shadow duration-150 ease-out flex items-center justify-between"
                    >
                      <div className="flex items-center gap-4">
                        <div className="p-2 bg-fcGold/10 rounded-lg">
                          <DollarSign className="w-5 h-5 text-fcGold" aria-hidden="true" />
                        </div>
                        <div>
                          <h3 className="text-base font-semibold text-fcSlate mb-1">{payment.month} {payment.year || 2026}</h3>
                          <p className="text-sm text-gray-600 font-normal">
                            {new Date(payment.date).toLocaleDateString()}
                            {payment.description && <span className="ml-2">• {payment.description}</span>}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-6">
                        <div className="text-right">
                          <div className="text-xl font-semibold text-fcSlate mb-2">${payment.amount.toLocaleString()}</div>
                          <div>
                            <StatusBadge status={payment.status} size="sm" />
                          </div>
                        </div>
                        {payment.status === 'paid' && payment.receiptUrl && (
                          <div className="flex items-center gap-1 ml-2">
                            <PDFViewButton
                              url={payment.receiptUrl}
                              title={`Receipt ${payment.receiptNumber || payment.month}`}
                              filename={`Receipt_${payment.receiptNumber || payment.month}_${payment.year || 2026}.pdf`}
                              variant="icon"
                              className="text-gray-500 hover:text-[#B8860B]"
                            />
                            <PDFDownloadButton
                              url={payment.receiptUrl}
                              filename={`Receipt_${payment.receiptNumber || payment.month}_${payment.year || 2026}.pdf`}
                              variant="icon"
                              className="text-gray-500 hover:text-[#B8860B]"
                            />
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          )}
        </div>
      </main>

      {/* Mobile Sticky Contact Agent Button */}
      {assignedAgent && (
        <div className="fixed bottom-0 left-0 right-0 z-30 md:hidden bg-white border-t border-gray-200 shadow-lg p-4">
          <a
            href={`tel:${assignedAgent.phone.replace(/\s/g, '')}`}
            className="w-full bg-fcGold text-white py-4 rounded-xl font-semibold text-base hover:bg-fcGold/90 focus:outline-none focus:ring-2 focus:ring-fcGold focus:ring-offset-2 transition-all duration-150 ease-out flex items-center justify-center gap-2 shadow-sm hover:shadow-md min-h-[44px]"
          >
            <Phone className="w-5 h-5" />
            <span>Contact Your Agent</span>
          </a>
        </div>
      )}
    </div>
  );
}
