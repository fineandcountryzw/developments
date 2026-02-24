
import React, { useState, useEffect, useMemo } from 'react';
import { 
  Building2, Download, ShieldCheck, 
  Search, FileText, CheckCircle2, Clock, 
  TrendingUp, ArrowLeft, Layout, 
  MapPin, Loader2, ChevronRight, Activity,
  AlertCircle, HardDrive, FileCheck, Mail, FileSignature, Zap, X,
  Receipt, Wallet, Landmark, Info, User, Fingerprint
} from 'lucide-react';
import { Client, Payment, Stand, KYCStatus, Role, DetailedPipelineStage, GeneratedContract, Development } from '../types.ts';
import { ReservationTimer } from './ReservationTimer.tsx';
import { supabaseMock } from '../services/supabase.ts';
import { generateReceipt } from '../services/pdfService.ts';
import { ClientGallery } from './ClientGallery.tsx';
import { NotificationBell } from './NotificationBell.tsx';
import { PaymentModule } from './PaymentModule.tsx';
import { ClientStatement } from './ClientStatement.tsx';

interface PortfolioProps {
  role: Role;
  initialView?: 'portfolio' | 'documents' | 'statements';
}

const PIPELINE_STAGES: DetailedPipelineStage[] = ['RESERVATION', 'OFFER LETTER', 'AGREEMENT OF SALE', 'PAYMENT TRACKING', 'TRANSFER'];

export const ClientPortfolio: React.FC<PortfolioProps> = ({ role, initialView = 'portfolio' }) => {
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [showStatement, setShowStatement] = useState(false);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [stands, setStands] = useState<Stand[]>([]);
  const [contracts, setContracts] = useState<GeneratedContract[]>([]);
  const [activeTab, setActiveTab] = useState<'portfolio' | 'documents' | 'statements'>(initialView);
  const [selectedStandId, setSelectedStandId] = useState<string | null>(null);
  const [isDownloading, setIsDownloading] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isPaynowModalOpen, setIsPaynowModalOpen] = useState(false);
  const [isProcessingPayment, setIsProcessingPayment] = useState(false);
  const [isPaymentModuleOpen, setIsPaymentModuleOpen] = useState(false);
  const [selectedAuditPayment, setSelectedAuditPayment] = useState<Payment | null>(null);

  useEffect(() => {
    const init = async () => {
      setIsLoading(true);
      // TODO: getClients() not available in next.js serverless environment
      // Client should be passed as prop or fetched via API route
      if (role === 'Client') {
        // const data = await getClients();
        // const me = data[0]; 
        // setSelectedClient(me);
        // await loadClientData(me.id);
      }
      setIsLoading(false);
    };
    init();
  }, [role]);

  useEffect(() => {
    setActiveTab(initialView);
    setSelectedStandId(null);
  }, [initialView]);

  const loadClientData = async (clientId: string) => {
    // TODO: getClientDashboardData not available - use API route instead
    // const { portfolio, payments, contracts, reservations } = await getClientDashboardData(clientId);
    // setStands([...portfolio, ...(reservations || [])]);
    // setPayments(payments);
    // setContracts(contracts);
  };

  const handleSelectGalleryClient = async (client: Client) => {
    console.log('CLIENT_CARD_CLICKED:', { clientId: client.id, clientName: client.name });
    setIsLoading(true);
    setSelectedClient(client);
    await loadClientData(client.id);
    setShowStatement(true); // Show statement view
    setIsLoading(false);
  };

  const handleBackToGallery = () => {
    console.log('RETURNING_TO_GALLERY');
    setShowStatement(false);
    setSelectedClient(null);
  };

  const selectedStand = useMemo(() => 
    stands.find(s => s.id === selectedStandId), 
  [stands, selectedStandId]);

  // Financial Calculations
  const financialSummary = useMemo(() => {
    const totalInvested = payments
      .filter(p => p.verificationStatus === 'Verified')
      .reduce((sum, p) => sum + p.amountUsd, 0);
    
    const totalContractValue = stands.reduce((sum, s) => sum + s.priceUsd, 0);
    const outstandingBalance = Math.max(0, totalContractValue - totalInvested);

    return { totalInvested, outstandingBalance, totalContractValue };
  }, [payments, stands]);

  const ProgressStepper = ({ stage, createdAt }: { stage?: DetailedPipelineStage; createdAt?: string }) => {
    const currentStepIndex = stage ? PIPELINE_STAGES.indexOf(stage) + 1 : 1;
    
    return (
      <div className="w-full min-w-0 space-y-16 py-10 font-sans">
        <div className="flex items-center justify-between">
           <h4 className="text-[11px] font-[800] text-fcGold uppercase tracking-[0.4em] flex items-center font-sans">
             <Activity size={14} className="mr-2" />
             Asset Conveyance Lifecycle
           </h4>
           {createdAt && (
             <span className="text-[10px] font-[800] text-gray-600 uppercase tracking-widest font-sans">
               Manifest Entry: {new Date(createdAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
             </span>
           )}
        </div>

        <div className="relative flex items-center justify-between px-4">
          <div className="absolute top-5 left-0 w-full h-[1px] bg-[#EFECE7] z-0" />
          
          <div 
            className="absolute top-5 left-0 h-[1px] bg-fcGold transition-all duration-1000 ease-in-out z-0 shadow-[0_0_10px_rgba(133,117,78,0.3)]" 
            style={{ width: `${Math.max(0, (currentStepIndex - 1) / (PIPELINE_STAGES.length - 1) * 100)}%` }}
          />

          {PIPELINE_STAGES.map((s, idx) => {
            const stepNum = idx + 1;
            const isCompleted = stepNum < currentStepIndex;
            const isActive = stepNum === currentStepIndex;
            
            return (
              <div key={s} className="relative z-10 flex flex-col items-center">
                <div className={`w-12 h-12 rounded-full border border-white flex items-center justify-center transition-all duration-700 shadow-xl ${
                  isCompleted ? 'bg-green-600 text-white' : 
                  isActive ? 'bg-fcGold text-white scale-125 shadow-[0_0_20px_rgba(133,117,78,0.4)]' : 
                  'bg-white text-slate-300 border-[#EFECE7]'
                }`}>
                  {isCompleted ? <CheckCircle2 size={18} /> : <span className="text-xs font-bold font-sans">{stepNum}</span>}
                </div>

                <div className="absolute top-16 flex flex-col items-center space-y-1.5 w-32">
                   <span className={`text-[10px] font-[800] uppercase tracking-widest text-center transition-colors duration-300 font-sans ${
                     isActive || isCompleted ? 'text-fcSlate' : 'text-gray-600'
                   }`}>
                     {s.replace('AGREEMENT OF SALE', 'Legal Drafting')}
                   </span>
                   {isActive && (
                     <span className="text-[8px] font-extrabold text-fcGold uppercase animate-pulse tracking-widest font-sans">Active Stage</span>
                   )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  const handleDownloadDoc = async (id: string, name: string) => {
    setIsDownloading(id);
    // TODO: Document download not available in serverless client component
    // Use API route for document retrieval
    // await downloadDocument(`vault/${id}`, `${name}.pdf`);
    setIsDownloading(null);
  };

  const handlePaynowSim = async () => {
    if (!selectedStand) return;
    setIsProcessingPayment(true);
    await new Promise(r => setTimeout(r, 2000));
    
    const newPayment: Payment = {
      id: `pn-${Date.now()}`,
      clientId: selectedClient?.id || 'unknown',
      clientName: selectedClient?.name,
      standId: selectedStand.id,
      amountUsd: 1500, 
      surchargeAmount: 1500 * 0.035,
      paymentMethod: 'Bank',
      paymentType: 'Installment',
      officeLocation: selectedClient?.branch || 'Harare',
      reference: `PN-TX-${Math.floor(Math.random()*90000)}`,
      manualReceiptNo: `AUTO-${Date.now()}`,
      description: `Asset Installment for Stand ${selectedStand.number}`,
      createdAt: new Date().toISOString(),
      verificationStatus: 'Verified',
      paynowStatus: 'Paid',
      paynowReference: `PAYNOW-${Math.random().toString(36).substr(2,6).toUpperCase()}`
    };

    // TODO: savePayment not available - use API route instead
    // await savePayment(newPayment);
    setIsProcessingPayment(false);
    setIsPaynowModalOpen(false);
    // await loadClientData(selectedClient?.id || '');
  };

  if (isLoading) {
    return (
      <div className="h-[60vh] flex flex-col items-center justify-center space-y-10 opacity-40 font-sans">
        <Loader2 className="animate-spin text-fcGold" size={40} />
        <p className="text-[11px] font-[800] uppercase tracking-[0.5em] font-sans text-fcGold">Authenticating Client Data...</p>
      </div>
    );
  }

  // Show Gallery if role is Admin/Manager and no client is selected
  if (role !== 'Client' && !selectedClient) {
    if (isPaymentModuleOpen) {
      return (
        <div className="space-y-10">
          <button onClick={() => setIsPaymentModuleOpen(false)} className="flex items-center space-x-2 text-xs font-bold text-fcGold uppercase tracking-widest font-sans">
            <ArrowLeft size={16} />
            <span>Return to Gallery</span>
          </button>
          <PaymentModule activeBranch="Harare" />
        </div>
      );
    }
    return <ClientGallery activeBranch="Harare" onSelectClient={handleSelectGalleryClient} onOpenPayment={() => setIsPaymentModuleOpen(true)} />;
  }

  // Show Client Statement if client selected and showStatement is true
  if (role !== 'Client' && selectedClient && showStatement) {
    return <ClientStatement client={selectedClient} onBack={handleBackToGallery} />;
  }

  // CLIENT: Only show contracts in card form and reservations
  if (role === 'Client') {
    return (
      <div className="w-full min-w-0 max-w-7xl mx-auto space-y-12 animate-in fade-in duration-1000 font-sans">
        <div className="flex justify-between items-center">
          <h2 className="text-3xl font-bold text-fcSlate mb-8">My Contracts</h2>
          <NotificationBell 
            branch={selectedClient?.branch || 'Harare'} 
            recipientType={selectedClient?.id ? 'Client' : undefined}
            recipientId={selectedClient?.id}
          />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-10">
          {contracts.map(contract => (
            <div key={contract.id} className="bg-white rounded-3xl shadow-lg p-8 border border-fcDivider flex flex-col space-y-4">
              <div className="flex items-center space-x-3">
                <FileSignature size={32} className="text-fcGold" />
                <span className="text-lg font-bold text-fcSlate">{contract.category || 'Agreement'}</span>
              </div>
              <div className="text-sm text-gray-600">{`Contract for stand ${contract.standId}`}</div>
              <div className="flex justify-between items-center mt-4">
                <span className="text-xs font-bold text-fcGold uppercase tracking-widest">Status: {contract.status}</span>
                <button className="bg-fcGold text-white px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-widest shadow-lg hover:brightness-110 transition-all font-sans">
                  View PDF
                </button>
              </div>
            </div>
          ))}
          {contracts.length === 0 && (
            <div className="col-span-full py-40 text-center space-y-10 opacity-30">
              <div className="p-12 bg-white w-fit mx-auto rounded-full border-2 border-dashed border-[#EFECE7]">
                <FileSignature size={64} className="text-slate-200" />
              </div>
              <div className="space-y-4 font-sans">
                <h4 className="text-2xl font-[800] text-fcSlate uppercase tracking-tight">No Contracts Found</h4>
                <p className="text-sm font-[800] text-gray-600 uppercase tracking-widest">You have no contracts yet.</p>
              </div>
            </div>
          )}
        </div>
        <h2 className="text-3xl font-bold text-fcSlate mt-16 mb-8">My Reservations</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-10">
          {stands.filter(s => s.status === 'RESERVED').map(reservation => (
            <div key={reservation.id} className="bg-white rounded-3xl shadow-lg p-8 border border-fcDivider flex flex-col space-y-4 font-[Plus Jakarta Sans]">
              <div className="flex items-center space-x-3">
                <MapPin size={32} className="text-fcGold" />
                <span className="text-lg font-bold text-fcSlate">Stand #{reservation.number}</span>
              </div>
              <div className="text-sm text-gray-600">{reservation.developmentName}</div>
              <div className="text-xs font-bold text-fcGold uppercase tracking-widest mt-2">
                {reservation.agentName ? `Agent: ${reservation.agentName}` : 'Company Lead'}
              </div>
              <div className="flex justify-between items-center mt-4">
                <ReservationTimer expiresAt={reservation.reservationExpiresAt || null} />
                <button className="bg-fcGold text-white px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-widest shadow-lg hover:brightness-110 transition-all font-sans">
                  View Details
                </button>
              </div>
            </div>
          ))}
          {stands.filter(s => s.status === 'RESERVED').length === 0 && (
            <div className="col-span-full py-40 text-center space-y-10 opacity-30">
              <div className="p-12 bg-white w-fit mx-auto rounded-full border-2 border-dashed border-[#EFECE7]">
                <MapPin size={64} className="text-slate-200" />
              </div>
              <div className="space-y-4 font-sans">
                <h4 className="text-2xl font-[800] text-fcSlate uppercase tracking-tight">No Reservations Found</h4>
                <p className="text-sm font-[800] text-gray-600 uppercase tracking-widest">You have no reservations yet.</p>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  // Fallback for non-client roles with selected client but no statement shown
  return null;
};
