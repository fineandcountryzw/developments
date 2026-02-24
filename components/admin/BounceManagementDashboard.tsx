import React, { useState, useEffect } from 'react';
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { AlertCircle, TrendingUp, TrendingDown, Shield, Eye, Mouse, Mail } from 'lucide-react';

interface BounceStats {
  summary: {
    totalBounces: number;
    hardBounces: number;
    softBounces: number;
    suppressedRecipients: number;
    suppressionRate: string;
  };
  bounceByType: Array<{ type: string; count: number }>;
  recentBounces: Array<{
    recipientEmail: string;
    bounceType: string;
    bounceReason?: string;
    consecutiveBounces: number;
    smtpCode?: string;
    lastBounceAt: string;
  }>;
}

export const BounceManagementDashboard: React.FC<{ branch?: string }> = ({ branch = 'Harare' }) => {
  const [stats, setStats] = useState<BounceStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchBounceStats();
  }, [branch]);

  const fetchBounceStats = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/admin/bounces/summary?branch=${branch}`);
      if (!response.ok) throw new Error('Failed to fetch bounce stats');
      const data = await response.json();
      setStats(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <div className="p-6 text-center">Loading bounce data...</div>;
  if (error) return <div className="p-6 text-red-600">{error}</div>;
  if (!stats) return <div className="p-6">No bounce data available</div>;

  const COLORS = ['#ef4444', '#f97316', '#eab308'];

  return (
    <div className="space-y-6 p-6">
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-lg shadow">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Total Bounces</p>
              <p className="text-2xl font-bold">{stats.summary.totalBounces}</p>
            </div>
            <AlertCircle className="w-8 h-8 text-red-500" />
          </div>
        </div>

        <div className="bg-white p-4 rounded-lg shadow">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Hard Bounces</p>
              <p className="text-2xl font-bold">{stats.summary.hardBounces}</p>
            </div>
            <TrendingDown className="w-8 h-8 text-red-600" />
          </div>
        </div>

        <div className="bg-white p-4 rounded-lg shadow">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Soft Bounces</p>
              <p className="text-2xl font-bold">{stats.summary.softBounces}</p>
            </div>
            <TrendingUp className="w-8 h-8 text-orange-500" />
          </div>
        </div>

        <div className="bg-white p-4 rounded-lg shadow">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Suppression Rate</p>
              <p className="text-2xl font-bold">{stats.summary.suppressionRate}%</p>
            </div>
            <Shield className="w-8 h-8 text-blue-500" />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white p-6 rounded-lg shadow">
          <h3 className="text-lg font-semibold mb-4">Bounce Distribution</h3>
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={stats.bounceByType}
                dataKey="count"
                nameKey="type"
                cx="50%"
                cy="50%"
                outerRadius={100}
              >
                {stats.bounceByType.map((_, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        </div>

        <div className="bg-white p-6 rounded-lg shadow">
          <h3 className="text-lg font-semibold mb-4">Recent Bounces</h3>
          <div className="space-y-3 max-h-80 overflow-y-auto">
            {stats.recentBounces.slice(0, 10).map((bounce, idx) => (
              <div key={idx} className="p-3 bg-gray-50 rounded border-l-4 border-red-500">
                <div className="flex justify-between items-start">
                  <div>
                    <p className="font-mono text-sm text-gray-700">{bounce.recipientEmail}</p>
                    <p className="text-xs text-gray-500">{bounce.bounceReason || 'No reason provided'}</p>
                  </div>
                  <span className={`text-xs px-2 py-1 rounded ${
                    bounce.bounceType === 'hard' 
                      ? 'bg-red-100 text-red-700'
                      : 'bg-orange-100 text-orange-700'
                  }`}>
                    {bounce.bounceType}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
