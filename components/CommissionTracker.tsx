import React, { useState, useEffect } from 'react';
import { DollarSign, TrendingUp, Clock, CheckCircle2, Loader2 } from 'lucide-react';
import { getAgentCommissions } from '../lib/db';
import { SkeletonCard } from './SkeletonLoader.tsx';

/**
 * Commission Tracker - Agent Attribution Module
 * Shows: Total Earned, Pending, Projected Commissions
 * Filtered by: agent_id
 */

interface Commission {
  id: string;
  stand_id: string;
  stand_number: string;
  development_name: string;
  client_name: string;
  stand_price: number;
  commission_rate: number;
  amount: number;
  status: 'earned' | 'pending' | 'projected';
  date: string;
}

interface CommissionTrackerProps {
  agentId: string;
}

export const CommissionTracker: React.FC<CommissionTrackerProps> = ({ agentId }) => {
  const [commissions, setCommissions] = useState<Commission[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadCommissions();
  }, [agentId]);

  const loadCommissions = async () => {
    setIsLoading(true);
    console.log('[COMMISSION_TRACKER] Loading for agent:', agentId);
    
    // SQL: SELECT * FROM commissions WHERE agent_id = auth.uid()
    const data = await getAgentCommissions(agentId);
    console.log('[COMMISSION_TRACKER] Fetched:', data.length, 'records');
    
    setCommissions(data);
    setIsLoading(false);
  };

  const totalEarned = commissions
    .filter(c => c.status === 'earned')
    .reduce((sum, c) => sum + c.amount, 0);

  const totalPending = commissions
    .filter(c => c.status === 'pending')
    .reduce((sum, c) => sum + c.amount, 0);

  const totalProjected = commissions
    .filter(c => c.status === 'projected')
    .reduce((sum, c) => sum + c.amount, 0);

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <SkeletonCard />
          <SkeletonCard />
          <SkeletonCard />
        </div>
        <SkeletonCard />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Commission Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-gradient-to-br from-green-500 to-green-600 rounded-2xl p-6 text-white shadow-xl">
          <div className="flex items-center justify-between mb-4">
            <CheckCircle2 size={24} />
            <div className="text-[10px] font-bold uppercase tracking-widest opacity-90">Earned</div>
          </div>
          <div className="text-3xl font-black">${totalEarned.toLocaleString()}</div>
          <div className="text-sm font-medium opacity-80 mt-1">
            {commissions.filter(c => c.status === 'earned').length} deals closed
          </div>
        </div>

        <div className="bg-gradient-to-br from-amber-500 to-amber-600 rounded-2xl p-6 text-white shadow-xl">
          <div className="flex items-center justify-between mb-4">
            <Clock size={24} />
            <div className="text-[10px] font-bold uppercase tracking-widest opacity-90">Pending</div>
          </div>
          <div className="text-3xl font-black">${totalPending.toLocaleString()}</div>
          <div className="text-sm font-medium opacity-80 mt-1">
            {commissions.filter(c => c.status === 'pending').length} deals in progress
          </div>
        </div>

        <div className="bg-gradient-to-br from-fcGold to-fcGold/80 rounded-2xl p-6 text-white shadow-xl">
          <div className="flex items-center justify-between mb-4">
            <TrendingUp size={24} />
            <div className="text-[10px] font-bold uppercase tracking-widest opacity-90">Projected</div>
          </div>
          <div className="text-3xl font-black">${totalProjected.toLocaleString()}</div>
          <div className="text-sm font-medium opacity-80 mt-1">
            {commissions.filter(c => c.status === 'projected').length} potential deals
          </div>
        </div>
      </div>

      {/* Commission Details Table */}
      <div className="bg-white rounded-2xl border border-fcDivider shadow-sm overflow-hidden">
        <div className="p-6 border-b border-fcDivider">
          <h3 className="text-xl font-bold text-fcSlate">Commission Breakdown</h3>
          <p className="text-sm text-gray-600 mt-1">All deals attributed to you as selling agent</p>
        </div>

        {commissions.length === 0 ? (
          <div className="p-12 text-center">
            <DollarSign size={48} className="mx-auto text-slate-200 mb-4" />
            <h3 className="text-lg font-bold text-fcSlate">No Commissions Yet</h3>
            <p className="text-sm text-gray-600 mt-2">
              Close your first deal to start earning commissions
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-white">
                <tr>
                  <th className="px-6 py-4 text-left text-[10px] font-bold uppercase tracking-widest text-gray-600">
                    Development
                  </th>
                  <th className="px-6 py-4 text-left text-[10px] font-bold uppercase tracking-widest text-gray-600">
                    Stand
                  </th>
                  <th className="px-6 py-4 text-left text-[10px] font-bold uppercase tracking-widest text-gray-600">
                    Client
                  </th>
                  <th className="px-6 py-4 text-right text-[10px] font-bold uppercase tracking-widest text-gray-600">
                    Stand Price
                  </th>
                  <th className="px-6 py-4 text-right text-[10px] font-bold uppercase tracking-widest text-gray-600">
                    Rate
                  </th>
                  <th className="px-6 py-4 text-right text-[10px] font-bold uppercase tracking-widest text-gray-600">
                    Commission
                  </th>
                  <th className="px-6 py-4 text-center text-[10px] font-bold uppercase tracking-widest text-gray-600">
                    Status
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-fcDivider">
                {commissions.map((comm) => (
                  <tr key={comm.id} className="hover:bg-white transition-colors">
                    <td className="px-6 py-4 text-sm font-bold text-fcSlate">{comm.development_name}</td>
                    <td className="px-6 py-4 text-sm font-mono text-gray-600">#{comm.stand_number}</td>
                    <td className="px-6 py-4 text-sm font-medium text-slate-700">{comm.client_name}</td>
                    <td className="px-6 py-4 text-sm font-mono text-right">${comm.stand_price.toLocaleString()}</td>
                    <td className="px-6 py-4 text-sm font-mono text-right">{comm.commission_rate}%</td>
                    <td className="px-6 py-4 text-sm font-bold text-right text-fcGold">${comm.amount.toLocaleString()}</td>
                    <td className="px-6 py-4 text-center">
                      <span
                        className={`inline-flex items-center px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                          comm.status === 'earned'
                            ? 'bg-green-100 text-green-700'
                            : comm.status === 'pending'
                            ? 'bg-amber-100 text-amber-700'
                            : 'bg-slate-100 text-gray-600'
                        }`}
                      >
                        {comm.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
