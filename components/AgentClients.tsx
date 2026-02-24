import React, { useState, useEffect } from 'react';
import { Users, FileDown, Mail, Phone, CheckCircle2, XCircle, Loader2, DollarSign } from 'lucide-react';
import { supabaseMock } from '../services/supabase.ts';
import { generateClientStatementPDF } from '../services/pdfService.ts';
import { SkeletonCard } from './SkeletonLoader.tsx';
import { getClientPayments } from '../lib/db';

/**
 * Agent Clients - Directory of clients with reservations
 * Shows only clients where agent_id matches
 * Includes: Financial Statement downloads, Payment history, Legal compliance status
 */

// TODO: Implement getAgentClients from API
const getAgentClients = async (agentId: string): Promise<AgentClient[]> => {
  // Stub implementation - return empty array
  return [];
};

interface ClientPayment {
  id: string;
  amount: string | number;
  createdAt?: string;
  date?: string;
  manual_receipt_no?: string;
  received_by?: string;
  surcharge_amount?: string | number;
  description?: string;
  verification_status?: string;
}

interface AgentClient {
  id: string;
  name: string;
  email: string;
  phone: string;
  stands: {
    id: string;
    stand_number: string;
    development_name: string;
    price_usd: number;
    status: string;
    terms_accepted: boolean;
    reservation_date: string;
  }[];
  total_value: number;
  payments_made: number;
  terms_accepted: boolean;
}

interface AgentClientsProps {
  agentId: string;
  agentName: string;
}

export const AgentClients: React.FC<AgentClientsProps> = ({ agentId, agentName }) => {
  const [clients, setClients] = useState<AgentClient[]>([]);
  const [clientPayments, setClientPayments] = useState<Record<string, ClientPayment[]>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [downloadingClient, setDownloadingClient] = useState<string | null>(null);

  useEffect(() => {
    loadClients();
  }, [agentId]);

  const loadClients = async () => {
    setIsLoading(true);
    console.log('[AGENT_CLIENTS] Loading for agent:', agentId);
    
    // SQL: SELECT * FROM reservations WHERE agent_id = auth.uid()
    const data = await getAgentClients(agentId);
    console.log('[AGENT_CLIENTS] Fetched:', data.length, 'clients');
    
    setClients(data);
    
    // Load payments for each client
    const paymentsMap: Record<string, ClientPayment[]> = {};
    for (const client of data) {
      try {
        const payments = await getClientPayments(client.id);
        paymentsMap[client.id] = payments as ClientPayment[];
      } catch (error) {
        console.error('[AGENT_CLIENTS] Failed to load payments for client:', client.id, error);
        paymentsMap[client.id] = [];
      }
    }
    setClientPayments(paymentsMap);
    
    setIsLoading(false);
  };

  const handleDownloadStatement = async (client: AgentClient) => {
    setDownloadingClient(client.id);
    console.log('[AGENT_CLIENTS] Generating statement for:', client.name);
    
    try {
      const payments = clientPayments[client.id] || [];
      // Generate branded PDF with agent attribution
      await generateClientStatementPDF(
        client as any,
        payments as any,
        client.stands as any,
        'Harare' // or get from client data
      );
    } catch (error) {
      console.error('[AGENT_CLIENTS] PDF generation failed:', error);
    } finally {
      setDownloadingClient(null);
    }
  };

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <SkeletonCard />
        <SkeletonCard />
        <SkeletonCard />
        <SkeletonCard />
      </div>
    );
  }

  if (clients.length === 0) {
    return (
      <div className="bg-white rounded-2xl border border-fcDivider p-16 text-center">
        <Users size={64} className="mx-auto text-slate-200 mb-6" />
        <h3 className="text-2xl font-bold text-fcSlate mb-2">No Clients Yet</h3>
        <p className="text-sm text-gray-600 max-w-md mx-auto">
          Your client directory is empty. Create a reservation to start building your client base.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-2xl border border-fcDivider p-6">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-xl font-bold text-fcSlate">My Clients</h3>
            <p className="text-sm text-gray-600 mt-1">{clients.length} clients with active reservations</p>
          </div>
          <Users size={24} className="text-fcGold" />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {clients.map((client) => (
          <div
            key={client.id}
            className="bg-white rounded-2xl border border-fcDivider p-6 space-y-4 hover:shadow-lg transition-all"
          >
            {/* Client Header */}
            <div className="flex items-start justify-between">
              <div>
                <h4 className="text-lg font-bold text-fcSlate">{client.name}</h4>
                <div className="flex items-center gap-2 mt-1">
                  <Mail size={12} className="text-gray-600" />
                  <span className="text-xs text-gray-600">{client.email}</span>
                </div>
                <div className="flex items-center gap-2 mt-1">
                  <Phone size={12} className="text-gray-600" />
                  <span className="text-xs text-gray-600">{client.phone}</span>
                </div>
              </div>
              
              {/* Legal Compliance Badge */}
              <div className="flex items-center gap-1">
                {client.terms_accepted ? (
                  <>
                    <CheckCircle2 size={16} className="text-green-500" />
                    <span className="text-[10px] font-bold uppercase tracking-wider text-green-600">
                      Terms OK
                    </span>
                  </>
                ) : (
                  <>
                    <XCircle size={16} className="text-red-500" />
                    <span className="text-[10px] font-bold uppercase tracking-wider text-red-600">
                      Pending
                    </span>
                  </>
                )}
              </div>
            </div>

            {/* Client Stats */}
            <div className="grid grid-cols-2 gap-4 pt-4 border-t border-fcDivider">
              <div>
                <div className="text-[10px] font-bold uppercase tracking-widest text-gray-600">
                  Total Value
                </div>
                <div className="text-xl font-bold text-fcSlate font-mono mt-1">
                  ${client.total_value.toLocaleString()}
                </div>
              </div>
              <div>
                <div className="text-[10px] font-bold uppercase tracking-widest text-gray-600">
                  Properties
                </div>
                <div className="text-xl font-bold text-fcSlate mt-1">
                  {client.stands.length}
                </div>
              </div>
            </div>

            {/* Payment Information */}
            {clientPayments[client.id] && clientPayments[client.id].length > 0 && (
              <div className="space-y-2 pt-4 border-t border-fcDivider">
                <div className="flex items-center justify-between">
                  <div className="text-[10px] font-bold uppercase tracking-widest text-gray-600 mb-2">
                    Recent Payments
                  </div>
                  <DollarSign size={14} className="text-green-600" />
                </div>
                <div className="space-y-2 max-h-[200px] overflow-y-auto">
                  {clientPayments[client.id].slice(0, 3).map((payment) => {
                    const amount = typeof payment.amount === 'string' ? parseFloat(payment.amount) : payment.amount;
                    const paymentDate = payment.date || payment.createdAt;
                    
                    return (
                      <div key={payment.id} className="bg-green-50 rounded-lg p-3 border border-green-100">
                        <div className="flex items-center justify-between">
                          <div>
                            <div className="text-sm font-bold text-green-700">
                              ${amount.toLocaleString()}
                            </div>
                            <div className="text-[10px] text-green-600 font-mono">
                              {payment.manual_receipt_no || 'REC-PENDING'}
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="text-[10px] font-bold text-gray-600">
                              {paymentDate ? new Date(paymentDate).toLocaleDateString('en-US', { 
                                month: 'short', 
                                day: 'numeric' 
                              }) : 'N/A'}
                            </div>
                            <div className="text-[8px] bg-amber-100 text-amber-700 px-2 py-0.5 rounded mt-1 font-bold">
                              {payment.received_by || 'OFFICE'}
                            </div>
                          </div>
                        </div>
                        {payment.description && (
                          <div className="text-[10px] text-gray-600 mt-1">
                            {payment.description}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
                {clientPayments[client.id].length > 3 && (
                  <div className="text-[10px] text-gray-600 font-bold text-center pt-1">
                    +{clientPayments[client.id].length - 3} more payments
                  </div>
                )}
              </div>
            )}

            {/* Client Properties */}
            <div className="space-y-2 pt-4 border-t border-fcDivider">
              <div className="text-[10px] font-bold uppercase tracking-widest text-gray-600 mb-2">
                Reserved Stands
              </div>
              {client.stands.map((stand) => (
                <div
                  key={stand.id}
                  className="flex items-center justify-between bg-white rounded-lg p-3"
                >
                  <div>
                    <div className="text-sm font-bold text-fcSlate">{stand.development_name}</div>
                    <div className="text-xs text-gray-600">Stand #{stand.stand_number}</div>
                  </div>
                  <div className="text-right">
                    <div className="text-sm font-bold text-fcGold font-mono">
                      ${stand.price_usd.toLocaleString()}
                    </div>
                    <div className="flex items-center gap-1 justify-end mt-1">
                      {stand.terms_accepted ? (
                        <CheckCircle2 size={10} className="text-green-500" />
                      ) : (
                        <XCircle size={10} className="text-red-500" />
                      )}
                      <span className="text-[8px] font-bold uppercase text-gray-600">
                        {stand.terms_accepted ? 'Legal OK' : 'No Terms'}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Action Buttons */}
            <div className="flex gap-3 pt-4 border-t border-fcDivider">
              <button
                onClick={() => handleDownloadStatement(client)}
                disabled={downloadingClient === client.id}
                className="flex-1 bg-fcGold text-white py-3 rounded-lg font-bold text-xs uppercase tracking-wider hover:bg-fcGold/90 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {downloadingClient === client.id ? (
                  <>
                    <Loader2 size={14} className="animate-spin" />
                    Generating...
                  </>
                ) : (
                  <>
                    <FileDown size={14} />
                    Statement
                  </>
                )}
              </button>
              <button
                className="flex-1 bg-slate-100 text-fcSlate py-3 rounded-lg font-bold text-xs uppercase tracking-wider hover:bg-slate-200 transition-all flex items-center justify-center gap-2"
              >
                <Mail size={14} />
                Contact
              </button>
            </div>

            {/* Agent Attribution */}
            <div className="pt-4 border-t border-fcDivider text-center">
              <div className="text-[8px] font-bold uppercase tracking-widest text-slate-300">
                Selling Agent: {agentName}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
