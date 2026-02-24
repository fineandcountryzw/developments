import React, { useState, useEffect } from 'react';
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { Users, TrendingUp, Zap, Eye, Mouse } from 'lucide-react';

interface EngagementStats {
  scores: Array<{
    id: string;
    recipientEmail: string;
    clientName?: string;
    engagementScore: number;
    engagementTier: string;
    openCount: number;
    clickCount: number;
    lastEngagementAt?: string;
    predictedPaymentProbability: number;
  }>;
  pagination: {
    page: number;
    limit: number;
    total: number;
    pages: number;
  };
  tierDistribution: Array<{
    tier: string;
    count: number;
    avgScore: string;
  }>;
}

export const EngagementScoringDashboard: React.FC<{ branch?: string }> = ({ branch = 'Harare' }) => {
  const [stats, setStats] = useState<EngagementStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tier, setTier] = useState<string>('');
  const [page, setPage] = useState(1);

  useEffect(() => {
    fetchEngagementStats();
  }, [branch, tier, page]);

  const fetchEngagementStats = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams({
        branch,
        page: page.toString(),
        ...(tier && { tier })
      });
      const response = await fetch(`/api/admin/engagement/scores?${params}`);
      if (!response.ok) throw new Error('Failed to fetch engagement stats');
      const data = await response.json();
      setStats(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  const COLORS = { hot: '#22c55e', warm: '#eab308', cold: '#64748b' };

  if (loading) return <div className="p-6 text-center">Loading engagement data...</div>;
  if (error) return <div className="p-6 text-red-600">{error}</div>;
  if (!stats) return <div className="p-6">No engagement data available</div>;

  const tierData = stats.tierDistribution.map(t => ({
    name: t.tier,
    count: t.count,
    avgScore: parseFloat(t.avgScore)
  }));

  return (
    <div className="space-y-6 p-6">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {stats.tierDistribution.map(dist => (
          <div key={dist.tier} className="bg-white p-4 rounded-lg shadow">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 capitalize">{dist.tier} Engagement</p>
                <p className="text-2xl font-bold">{dist.count}</p>
                <p className="text-xs text-gray-500">Avg Score: {dist.avgScore}</p>
              </div>
              <div 
                className="w-12 h-12 rounded-full flex items-center justify-center"
                style={{ backgroundColor: COLORS[dist.tier as keyof typeof COLORS] + '20' }}
              >
                <Zap 
                  className="w-6 h-6" 
                  style={{ color: COLORS[dist.tier as keyof typeof COLORS] }}
                />
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white p-6 rounded-lg shadow">
          <h3 className="text-lg font-semibold mb-4">Engagement Distribution</h3>
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={tierData}
                dataKey="count"
                nameKey="name"
                cx="50%"
                cy="50%"
                outerRadius={100}
              >
                {tierData.map((entry, index) => (
                  <Cell 
                    key={`cell-${index}`} 
                    fill={COLORS[entry.name as keyof typeof COLORS]}
                  />
                ))}
              </Pie>
              <Tooltip />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        </div>

        <div className="bg-white p-6 rounded-lg shadow">
          <h3 className="text-lg font-semibold mb-4">Top Filters</h3>
          <div className="space-y-3">
            <select 
              value={tier} 
              onChange={(e) => {
                setTier(e.target.value);
                setPage(1);
              }}
              className="w-full p-2 border rounded"
            >
              <option value="">All Tiers</option>
              <option value="hot">Hot</option>
              <option value="warm">Warm</option>
              <option value="cold">Cold</option>
            </select>
          </div>
        </div>
      </div>

      <div className="bg-white p-6 rounded-lg shadow">
        <h3 className="text-lg font-semibold mb-4">Top Engaged Recipients</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-2 text-left">Email</th>
                <th className="px-4 py-2 text-center">Score</th>
                <th className="px-4 py-2 text-center">Tier</th>
                <th className="px-4 py-2 text-center">Opens</th>
                <th className="px-4 py-2 text-center">Clicks</th>
                <th className="px-4 py-2 text-center">Payment Probability</th>
              </tr>
            </thead>
            <tbody>
              {stats.scores.map((score) => (
                <tr key={score.id} className="border-t hover:bg-gray-50">
                  <td className="px-4 py-3 font-mono text-xs">{score.recipientEmail}</td>
                  <td className="px-4 py-3 text-center font-bold">{score.engagementScore}</td>
                  <td className="px-4 py-3 text-center">
                    <span 
                      className="px-2 py-1 rounded text-white text-xs capitalize"
                      style={{ backgroundColor: COLORS[score.engagementTier as keyof typeof COLORS] }}
                    >
                      {score.engagementTier}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-center flex items-center justify-center gap-1">
                    <Eye className="w-4 h-4" />
                    {score.openCount}
                  </td>
                  <td className="px-4 py-3 text-center flex items-center justify-center gap-1">
                    <Mouse className="w-4 h-4" />
                    {score.clickCount}
                  </td>
                  <td className="px-4 py-3 text-center">
                    {(score.predictedPaymentProbability * 100).toFixed(0)}%
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {stats.pagination.pages > 1 && (
          <div className="mt-4 flex justify-center gap-2">
            {Array.from({ length: stats.pagination.pages }).map((_, idx) => (
              <button
                key={idx}
                onClick={() => setPage(idx + 1)}
                className={`px-3 py-1 rounded ${
                  page === idx + 1
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-200 hover:bg-gray-300'
                }`}
              >
                {idx + 1}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
