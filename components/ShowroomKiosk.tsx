
import React, { useState, useEffect, useMemo } from 'react';
import { 
  X, MapPin, Maximize2, ShieldCheck, 
  Droplets, Zap, Route, Lock, Wifi, 
  ArrowRight, Loader2, Landmark, 
  ChevronRight, Calculator, PieChart, 
  UserPlus, CheckCircle2, DollarSign,
  TrendingUp, Globe, Building2
} from 'lucide-react';
import { Development, Stand, StandStatus, Branch } from '../types';
import { getDevelopments, getStandsByDevelopment } from '../lib/db';
import { PlotSelectorMap } from './PlotSelectorMap.tsx';
import { ReservationModal } from './ReservationModal.tsx';
import { getAgents } from '../services/agentService.ts';

/**
 * ShowroomKiosk Module v1.0
 * A Standalone high-fidelity interface for showrooms and external presentations.
 * Theme: Fine & Country Executive Dark
 */

const ShowroomKiosk: React.FC<{ activeBranch: Branch; onExit?: () => void }> = ({ activeBranch, onExit }) => {
  const [developments, setDevelopments] = useState<Development[]>([]);
  const [selectedDev, setSelectedDev] = useState<Development | null>(null);
  const [stands, setStands] = useState<Stand[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isCalculatorOpen, setIsCalculatorOpen] = useState(false);

  // Reservation Modal State
  const [reservationStandId, setReservationStandId] = useState<string | null>(null);
  const [agents, setAgents] = useState<any[]>([]);
  const [isReservationModalOpen, setIsReservationModalOpen] = useState(false);

  // Calculator State
  const [calcPrice, setCalcPrice] = useState(50000);
  const [calcDeposit, setCalcDeposit] = useState(15000);
  const [calcPeriod, setCalcPeriod] = useState(36);


  useEffect(() => {
    const fetchKioskData = async () => {
      setIsLoading(true);
      const devs = await getDevelopments(activeBranch);
      const activeDevs = devs.filter(d => d.status === 'Active');
      setDevelopments(activeDevs);
      if (activeDevs.length > 0) {
        setSelectedDev(activeDevs[0]);
        const standData = await getStandsByDevelopment(activeDevs[0].id);
        setStands(standData);
      }
      // Fetch agents for reservation modal
      const agentList = await getAgents();
      setAgents(agentList);
      setIsLoading(false);
    };
    fetchKioskData();
  }, [activeBranch]);


  const handleDevChange = async (dev: Development) => {
    setSelectedDev(dev);
    setIsLoading(true);
    const standData = await getStandsByDevelopment(dev.id);
    setStands(standData);
    setIsLoading(false);
  };

  // Reservation flow: open modal when stand reserved from map
  const handleReserve = (standId: string) => {
    setReservationStandId(standId);
    setIsReservationModalOpen(true);
  };

  // Handle reservation confirmation (agent or self)
  const handleReservationConfirm = async (agentId: string | null) => {
    // Here, trigger reservation logic (API call, etc.)
    // If agentId is null, mark as Company Lead (0% commission)
    // If agentId is set, flag for commission
    // For demo, just close modal
    setIsReservationModalOpen(false);
    setReservationStandId(null);
    // TODO: Add actual reservation logic here
    alert(agentId ? 'Reservation flagged for commission.' : 'Reservation marked as Company Lead (0% commission).');
  };

  const monthlyInstallment = useMemo(() => {
    const principal = calcPrice - calcDeposit;
    const interest = 0.085; // Fixed for kiosk simulation
    const totalWithInterest = principal * (1 + interest);
    return totalWithInterest / calcPeriod;
  }, [calcPrice, calcDeposit, calcPeriod]);

  if (isLoading) {
    return (
      <div className="fixed inset-0 bg-white z-[9999] flex flex-col items-center justify-center space-y-8 font-sans">
        <div className="relative">
          <div className="w-24 h-24 border-4 border-fcGold/20 border-t-fcGold rounded-full animate-spin" />
          <div className="absolute inset-0 flex items-center justify-center">
            <Building2 className="text-fcGold" size={32} />
          </div>
        </div>
        <div className="text-center space-y-2">
          <h2 className="text-xl font-bold text-brand-black uppercase tracking-[0.4em] font-sans">VPC Node Handshake</h2>
          <p className="text-[10px] text-brand-grey font-black uppercase tracking-widest">Encrypting Showroom Data Stream...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-white z-[9000] overflow-hidden flex flex-col font-sans selection:bg-brand-gold/30">
      
      {/* Kiosk Navigation Header */}
      <nav className="h-24 bg-white border-b border-brand-gold/20 px-12 flex justify-between items-center shrink-0">
        <div className="flex items-center space-x-12">
          <div className="flex items-center space-x-3">
             <div className="w-10 h-10 bg-brand-gold rounded flex items-center justify-center text-white font-bold text-lg shadow-forensic">FC</div>
             <div className="flex flex-col">
               <span className="text-lg font-bold tracking-tight text-brand-black leading-none font-sans">Fine & Country</span>
               <span className="text-[9px] font-bold text-brand-gold uppercase tracking-[0.3em] mt-1 font-sans">Executive Showroom</span>
             </div>
          </div>
          
          <div className="h-8 w-[1px] bg-brand-gold/10" />

          <div className="flex items-center space-x-4">
             {developments.map(dev => (
               <button 
                key={dev.id}
                onClick={() => handleDevChange(dev)}
                className={`px-6 py-2 rounded-full text-[10px] font-black uppercase tracking-widest transition-all ${
                  selectedDev?.id === dev.id ? 'bg-brand-gold text-white shadow-forensic' : 'text-brand-grey hover:text-brand-black'
                }`}
               >
                 {dev.name}
               </button>
             ))}
          </div>
        </div>

        <button 
          onClick={onExit}
          className="p-3 bg-brand-gold/5 text-brand-grey hover:text-brand-black hover:bg-brand-gold/10 rounded-2xl transition-all flex items-center space-x-3"
        >
          <span className="text-[10px] font-black uppercase tracking-widest">Exit Kiosk</span>
          <X size={18} />
        </button>
      </nav>

      {/* Main Kiosk Content Area */}
      <div className="flex-1 flex overflow-hidden">
        
        {/* Left Side: Information Panel */}
        <div className="w-1/3 border-r border-brand-gold/10 p-16 overflow-y-auto no-scrollbar space-y-16 bg-brand-light">
           <div className="space-y-6">
              <div className="flex items-center space-x-3 text-brand-gold">
                 <Globe size={18} />
                 <span className="text-[10px] font-black uppercase tracking-[0.4em]">{activeBranch} Regional Manifest</span>
              </div>
              <h1 className="text-6xl font-[900] text-brand-black tracking-tightest leading-none font-sans uppercase">
                {selectedDev?.name}
              </h1>
              <div className="flex items-center space-x-4">
                <div className="flex items-center space-x-2 px-4 py-1.5 bg-brand-gold/5 rounded-full border border-brand-gold/10 text-[9px] font-bold text-brand-black uppercase tracking-widest">
                  <MapPin size={12} className="text-brand-gold" />
                  <span>{selectedDev?.locationName}</span>
                </div>
                <div className="text-[10px] font-bold text-brand-gold uppercase tracking-widest">{stands.length} Asset Targets Available</div>
              </div>
           </div>

           <div className="grid grid-cols-2 gap-6">
              <div className="p-6 bg-brand-gold/5 rounded-3xl border border-brand-gold/20 space-y-4 group hover:border-brand-gold/40 transition-all cursor-default">
                 <TrendingUp size={20} className="text-brand-gold" />
                 <div className="space-y-1">
                   <p className="text-[10px] font-bold text-brand-grey uppercase tracking-widest">Asset Appreciation</p>
                   <p className="text-2xl font-black text-brand-black font-mono">+12.4% <span className="text-[10px] opacity-40 uppercase ml-1">Est. P.A.</span></p>
                 </div>
              </div>
              <div className="p-6 bg-brand-gold/5 rounded-3xl border border-brand-gold/20 space-y-4 group hover:border-brand-gold/40 transition-all cursor-default">
                 <Calculator size={20} className="text-brand-gold" />
                 <div className="space-y-1">
                   <p className="text-[10px] font-bold text-brand-grey uppercase tracking-widest">Entry Threshold</p>
                   <p className="text-2xl font-black text-brand-black font-mono">${selectedDev?.basePrice.toLocaleString()}</p>
                 </div>
              </div>
           </div>

           <div className="space-y-8">
              <h3 className="text-sm font-black text-brand-black uppercase tracking-[0.3em] border-b border-brand-gold/10 pb-4">Infrastructure Progress</h3>
              <div className="space-y-8">
                 {/* Dynamic estate_progress from API if available */}
                 {(() => {
                   const estateProgress = (selectedDev as any)?.estate_progress;
                   if (estateProgress && typeof estateProgress === 'object') {
                     const statusToPercent: Record<string, number> = {
                       'not_started': 0,
                       'planned': 25,
                       'in_progress': 60,
                       'completed': 100,
                     };
                     const items = [
                       { key: 'roads', label: 'Access Roads', icon: Route },
                       { key: 'water', label: 'Water Reticulation', icon: Droplets },
                       { key: 'electricity', label: 'Electrical Grid', icon: Zap },
                       { key: 'sewer', label: 'Sewer & Drainage', icon: Lock },
                     ];
                     return items.map(item => {
                       const val = statusToPercent[estateProgress[item.key]] || 0;
                       return (
                         <div key={item.key} className="space-y-3">
                            <div className="flex justify-between items-center px-1">
                               <div className="flex items-center space-x-3">
                                  <item.icon size={14} className="text-brand-gold" />
                                  <span className="text-[9px] font-black text-brand-grey uppercase tracking-widest">{item.label}</span>
                               </div>
                               <span className="text-xs font-mono font-black text-brand-black">{val}%</span>
                            </div>
                            <div className="h-1 w-full bg-brand-gold/10 rounded-full overflow-hidden">
                              <div className="h-full bg-brand-gold transition-all duration-1000" style={{ width: `${val}%` }} />
                            </div>
                         </div>
                       );
                     });
                   }
                   // Fallback to hardcoded values if no estate_progress
                   return [
                     { label: 'Gatehouse & Perimeter', val: 100, icon: Lock },
                     { label: 'Water Reticulation', val: 85, icon: Droplets },
                     { label: 'Electrical Grid', val: 60, icon: Zap },
                     { label: 'Statutory Access Roads', val: 95, icon: Route }
                   ].map(item => (
                     <div key={item.label} className="space-y-3">
                        <div className="flex justify-between items-center px-1">
                           <div className="flex items-center space-x-3">
                              <item.icon size={14} className="text-brand-gold" />
                              <span className="text-[9px] font-black text-brand-grey uppercase tracking-widest">{item.label}</span>
                           </div>
                           <span className="text-xs font-mono font-black text-brand-black">{item.val}%</span>
                        </div>
                        <div className="h-1 w-full bg-brand-gold/10 rounded-full overflow-hidden">
                          <div className="h-full bg-brand-gold transition-all duration-1000" style={{ width: `${item.val}%` }} />
                        </div>
                     </div>
                   ));
                 })()}
              </div>
           </div>

           <button 
             onClick={() => setIsCalculatorOpen(true)}
             className="w-full bg-brand-gold text-white py-6 rounded-2xl font-black uppercase tracking-[0.3em] text-[11px] shadow-forensic hover:bg-brand-gold hover:opacity-90 transition-all flex items-center justify-center space-x-4 font-sans"
           >
              <Calculator size={18} />
              <span>Simulate Investment Yield</span>
           </button>
        </div>

        {/* Right Side: Interactive Visualizer */}
        <div className="flex-1 relative bg-white">
           {selectedDev && <PlotSelectorMap development={selectedDev} onReserve={handleReserve} />}
              {/* Reservation Modal */}
              {isReservationModalOpen && reservationStandId && (
                <ReservationModal
                  standId={reservationStandId}
                  agents={agents}
                  onClose={() => { setIsReservationModalOpen(false); setReservationStandId(null); }}
                  onConfirm={handleReservationConfirm}
                />
              )}
        </div>
      </div>

      {/* Yield Simulator Drawer (Overlay) */}
      {isCalculatorOpen && (
        <div className="absolute inset-0 z-[9500] flex items-center justify-end p-12 pointer-events-none">
           <div className="absolute inset-0 bg-black/40 backdrop-blur-md pointer-events-auto" onClick={() => setIsCalculatorOpen(false)} />
           <div className="relative w-full max-w-xl bg-white h-full rounded-[48px] shadow-forensic-lg overflow-hidden flex flex-col animate-in slide-in-from-right-12 duration-700 pointer-events-auto border border-brand-gold/20 font-sans">
              <div className="bg-brand-gold p-16 text-white space-y-4 shrink-0 relative">
                 <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full -mr-32 -mt-32 blur-3xl" />
                 <button onClick={() => setIsCalculatorOpen(false)} className="absolute top-10 right-10 p-3 bg-white/20 rounded-full hover:bg-white/40 transition-all"><X size={24} /></button>
                 <div className="flex items-center space-x-4 mb-4">
                    <div className="p-4 bg-white/20 rounded-3xl backdrop-blur-xl"><PieChart size={32} /></div>
                    <div>
                      <h3 className="text-3xl font-[900] tracking-tightest font-sans uppercase">Yield Simulator</h3>
                      <p className="text-[10px] font-black uppercase tracking-[0.4em] opacity-80 mt-1">Institutional Settlement Modeling</p>
                    </div>
                 </div>
              </div>

              <div className="flex-1 overflow-y-auto p-16 space-y-12 no-scrollbar">
                 <div className="space-y-10">
                    <div className="space-y-4">
                       <div className="flex justify-between items-end">
                          <label className="text-[11px] font-black text-brand-grey uppercase tracking-widest font-sans">Asset Price (USD)</label>
                          <span className="text-2xl font-black text-brand-black font-mono">${calcPrice.toLocaleString()}</span>
                       </div>
                       <input 
                        type="range" min="10000" max="500000" step="5000" value={calcPrice}
                        onChange={(e) => setCalcPrice(parseInt(e.target.value))}
                        className="w-full h-2 bg-brand-light rounded-full appearance-none cursor-pointer accent-brand-gold"
                       />
                    </div>

                    <div className="space-y-4">
                       <div className="flex justify-between items-end">
                          <label className="text-[11px] font-black text-brand-grey uppercase tracking-widest font-sans">Deposit</label>
                          <span className="text-2xl font-black text-brand-gold font-mono">${calcDeposit.toLocaleString()}</span>
                       </div>
                       <input 
                        type="range" min="5000" max={calcPrice * 0.5} step="1000" value={calcDeposit}
                        onChange={(e) => setCalcDeposit(parseInt(e.target.value))}
                        className="w-full h-2 bg-brand-light rounded-full appearance-none cursor-pointer accent-brand-gold"
                       />
                    </div>
                 </div>

                 <div className="bg-white p-10 rounded-[32px] border border-brand-gold/10 space-y-8">
                    <div className="flex justify-between items-center">
                       <span className="text-[10px] font-black text-brand-grey uppercase tracking-widest">Monthly Installment</span>
                       <span className="text-4xl font-black text-brand-black font-mono">${monthlyInstallment.toFixed(0)}</span>
                    </div>
                    <div className="pt-6 border-t border-brand-gold/10">
                       <p className="text-[10px] text-brand-grey leading-relaxed font-bold uppercase tracking-tight">
                         Estimates include statutory 8.5% interest rates over a {calcPeriod} month settlement cycle.
                       </p>
                    </div>
                 </div>
              </div>
           </div>
        </div>
      )}
    </div>
  );
};

export default ShowroomKiosk;
