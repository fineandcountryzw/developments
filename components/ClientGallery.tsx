
import React, { useState, useEffect, useMemo } from 'react';
import {
  Search, User, DollarSign, Building2, Plus,
  ChevronRight, ArrowRight, UserPlus, Filter,
  CreditCard, LayoutGrid, List, MoreHorizontal,
  Mail, Phone, ShieldCheck, Loader2, MapPin
} from 'lucide-react';
import { Client, ReconRecord, Branch } from '../types.ts';
import { supabaseMock } from '../services/supabase.ts';
import { getClients, getReconLedger } from '../lib/db';

interface ClientGalleryProps {
  activeBranch: Branch;
  onSelectClient: (client: Client) => void;
  onOpenPayment: () => void;
}

export const ClientGallery: React.FC<ClientGalleryProps> = ({ activeBranch, onSelectClient, onOpenPayment }) => {
  const [clients, setClients] = useState<Client[]>([]);
  const [recon, setRecon] = useState<ReconRecord[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [regionFilter, setRegionFilter] = useState<'All' | Branch>('All');

  // Debounce search term: 300ms
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(searchTerm), 300);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  useEffect(() => {
    const fetchData = async () => {
      setIsLoading(true);
      try {
        const [clientData, reconData] = await Promise.all([
          getClients(), // Fetch all clients to allow multi-branch filtering
          getReconLedger()
        ]);
        setClients(Array.isArray(clientData) ? clientData : []);
        setRecon(Array.isArray(reconData) ? reconData : []);
      } catch (error) {
        console.error('[ClientGallery] Error fetching data:', error);
        setClients([]);
        setRecon([]);
      } finally {
        setIsLoading(false);
      }
    };
    fetchData();
  }, [activeBranch]);

  const filteredClients = useMemo(() => {
    return clients.filter(c => {
      const matchesSearch = c.name.toLowerCase().includes(debouncedSearch.toLowerCase()) ||
        c.email.toLowerCase().includes(debouncedSearch.toLowerCase()) ||
        (c.nationalId && c.nationalId.toLowerCase().includes(debouncedSearch.toLowerCase()));

      const matchesRegion = regionFilter === 'All' || c.branch === regionFilter;

      return matchesSearch && matchesRegion;
    });
  }, [clients, debouncedSearch, regionFilter]);

  const getClientMetrics = (clientName: string) => {
    const clientRecon = recon.filter(r => r.clientName === clientName);
    const totalPayments = clientRecon.reduce((sum, r) => sum + r.totalPaidUsd, 0);
    const uniqueDevelopments = Array.from(new Set(clientRecon.map(r => r.developmentName).filter(Boolean)));
    return { totalPayments, uniqueDevelopments };
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-700 font-sans">
      {/* Gallery Header Controls */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
        <div className="space-y-1">
          <h2 className="text-2xl font-black text-fcSlate uppercase tracking-tightest font-sans">Purchaser Registry</h2>
          <p className="text-[10px] text-gray-600 font-bold uppercase tracking-[0.3em]">Verified Institutional Base</p>
        </div>

        <div className="flex flex-col md:flex-row items-center gap-4 w-full md:w-auto">
          {/* Regional Segmented Filter */}
          <div className="flex bg-white p-1 rounded-2xl border border-fcDivider shadow-sm self-stretch md:self-auto font-['Plus Jakarta Sans'],sans-serif">
            {(['All', 'Harare', 'Bulawayo'] as const).map(region => (
              <button
                key={region}
                onClick={() => setRegionFilter(region)}
                className={`px-6 py-2.5 rounded-xl text-[10px] font-extrabold uppercase tracking-widest transition-all font-[\'Plus Jakarta Sans\'],sans-serif ${regionFilter === region ? 'bg-fcGold text-white shadow-lg' : 'text-gray-600 hover:text-fcSlate'
                  }`}
                style={{ fontFamily: 'Plus Jakarta Sans, sans-serif' }}
              >
                {region}
              </button>
            ))}
          </div>

          <div className="relative flex-1 md:w-80 group">
            <Search className="absolute left-5 top-1/2 -translate-y-1/2 text-fcGold group-focus-within:scale-110 transition-transform" size={18} />
            <input
              type="text"
              placeholder="Search by name, email, or ID..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-white border border-fcDivider rounded-[20px] pl-14 pr-6 py-4 text-sm font-bold text-fcSlate focus:ring-2 focus:ring-fcGold outline-none transition-all placeholder:text-slate-300"
            />
          </div>
          <button
            onClick={onOpenPayment}
            className="p-4 bg-fcGold text-white rounded-[20px] shadow-lg shadow-fcGold/20 hover:brightness-110 transition-all flex items-center justify-center shrink-0"
            title="Register Walk-in Client"
          >
            <UserPlus size={20} />
          </button>
        </div>
      </div>

      {isLoading ? (
        <div className="h-96 flex flex-col items-center justify-center space-y-4 opacity-40">
          <Loader2 className="animate-spin text-fcGold" size={40} />
          <p className="text-[10px] font-black uppercase tracking-[0.4em] text-fcGold">Synchronizing Registry...</p>
        </div>
      ) : filteredClients.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {filteredClients.map((client) => {
            const { totalPayments, uniqueDevelopments } = getClientMetrics(client.name);
            return (
              <div
                key={client.id}
                onClick={() => onSelectClient(client)}
                className="group relative bg-white rounded-[32px] border border-fcDivider p-8 shadow-sm hover:shadow-2xl hover:border-fcGold/30 transition-all cursor-pointer overflow-hidden"
              >
                {/* Branch Badge - Top Right */}
                <div className="absolute top-6 right-6 z-20">
                  <div
                    className={`px-3 py-1 rounded-full text-[9px] font-extrabold uppercase tracking-widest border shadow-md font-[\'Plus Jakarta Sans\'],sans-serif ${client.branch === 'Harare'
                        ? 'bg-fcSlate text-white border-gray-200'
                        : 'bg-fcGold text-white border-fcGold/20'
                      }`}
                    style={{ fontFamily: 'Plus Jakarta Sans, sans-serif', letterSpacing: '0.15em', boxShadow: '0 2px 8px rgba(0,0,0,0.07)' }}
                  >
                    {client.branch === 'Harare' ? 'HRE' : 'BYO'}
                  </div>
                </div>

                {/* Accent Ribbon */}
                <div className="absolute top-0 left-0 w-1.5 h-full bg-fcGold/10 group-hover:bg-fcGold transition-colors" />

                <div className="space-y-8 relative z-10">
                  <div className="flex justify-between items-start">
                    <div className="w-14 h-14 bg-white rounded-2xl flex items-center justify-center text-fcGold font-black text-lg shadow-inner group-hover:bg-fcGold group-hover:text-white transition-all duration-500 font-mono">
                      {client.name.split(' ').map(n => n[0]).join('')}
                    </div>
                    <div className="flex items-center space-x-2 mr-12"> {/* Space for branch badge */}
                      {client.isPortalUser && (
                        <span className="flex items-center space-x-1 text-[8px] font-black bg-green-50 text-green-600 px-2 py-0.5 rounded-full border border-green-100 uppercase tracking-widest">
                          <ShieldCheck size={8} />
                          <span>Verified</span>
                        </span>
                      )}
                      <button className="text-slate-200 group-hover:text-gray-600 transition-colors">
                        <MoreHorizontal size={18} />
                      </button>
                    </div>
                  </div>

                  <div className="space-y-1">
                    <h3 className="text-xl font-black text-fcSlate tracking-tight font-sans group-hover:text-fcGold transition-colors">
                      {client.name}
                    </h3>
                    <div className="flex flex-col space-y-1">
                      <div className="flex items-center text-[10px] font-bold text-gray-600 lowercase">
                        <Mail size={10} className="mr-1.5 text-slate-300" />
                        {client.email}
                      </div>
                      <div className="flex items-center text-[10px] font-bold text-gray-600">
                        <Phone size={10} className="mr-1.5 text-slate-300" />
                        {client.phone}
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4 pt-4 border-t border-fcDivider">
                    <div className="space-y-1">
                      <span className="text-[9px] font-black text-gray-600 uppercase tracking-widest font-sans">Total Payments</span>
                      <div className="flex items-center text-sm font-black text-fcSlate font-mono tabular-nums">
                        <DollarSign size={12} className="text-fcGold mr-0.5" />
                        {totalPayments.toLocaleString()}
                      </div>
                    </div>
                    <div className="space-y-1">
                      <span className="text-[9px] font-black text-gray-600 uppercase tracking-widest font-sans">Portfolios</span>
                      <div className="text-sm font-black text-fcSlate font-mono tabular-nums">
                        {uniqueDevelopments.length} Developments
                      </div>
                    </div>
                  </div>

                  <div className="space-y-3">
                    <span className="text-[9px] font-black text-gray-600 uppercase tracking-widest font-sans block">Invested Developments</span>
                    <div className="flex flex-wrap gap-2">
                      {uniqueDevelopments.length > 0 ? (
                        uniqueDevelopments.map((dev, i) => (
                          <span key={i} className="px-3 py-1 bg-white text-[9px] font-black text-fcGold rounded-lg border border-fcGold/10 uppercase tracking-tight">
                            {dev}
                          </span>
                        ))
                      ) : (
                        <span className="text-[9px] text-slate-300 font-bold">No active investments found</span>
                      )}
                    </div>
                  </div>

                  <div className="pt-2 flex justify-between items-center group-hover:translate-x-1 transition-transform">
                    <span className="text-[10px] font-black text-fcGold uppercase tracking-widest">Open Portfolio</span>
                    <ChevronRight size={16} className="text-fcGold" />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="bg-white rounded-[48px] border-2 border-dashed border-fcDivider p-24 text-center space-y-10 animate-in zoom-in-95 duration-500">
          <div className="p-12 bg-white w-fit mx-auto rounded-full border border-fcDivider opacity-40">
            <User size={80} strokeWidth={1} className="text-slate-300" />
          </div>
          <div className="space-y-4 max-w-sm mx-auto">
            <h3 className="text-2xl font-black text-fcSlate font-sans">No clients found in the registry.</h3>
            <p className="text-sm text-gray-600 font-bold uppercase tracking-widest leading-relaxed">
              Your search parameters yielded zero results from the regional development manifest.
            </p>
          </div>
          <button
            onClick={onOpenPayment}
            className="bg-fcGold text-white px-12 py-5 rounded-2xl font-black uppercase tracking-[0.3em] text-[11px] shadow-2xl shadow-fcGold/30 hover:brightness-110 transition-all flex items-center justify-center space-x-4 mx-auto font-sans"
          >
            <span>Add New Walk-in Client</span>
            <ArrowRight size={18} />
          </button>
        </div>
      )}
    </div>
  );
};
