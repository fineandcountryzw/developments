'use client';

import React, { useState, useEffect } from 'react';
import { CheckCircle, Clock, XCircle, RefreshCw, ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface SyncStats {
  completed: number;
  pending: number;
  failed: number;
  total: number;
}

interface SyncStatusWidgetProps {
  refreshInterval?: number; // milliseconds
}

/**
 * Sync Status Widget
 * 
 * Shows sync health at a glance on the settings/dashboard page.
 * Auto-refreshes every 30 seconds by default.
 */
export const SyncStatusWidget: React.FC<SyncStatusWidgetProps> = ({
  refreshInterval = 30000,
}) => {
  const [stats, setStats] = useState<SyncStats | null>(null);
  const [loading, setLoading] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchStats = async () => {
    try {
      const response = await fetch('/api/sync/status');
      if (!response.ok) throw new Error('Failed to fetch sync status');
      const data = await response.json();
      setStats(data);
      setError(null);
    } catch (err) {
      setError('Failed to load sync status');
    }
  };

  const handleProcessNow = async () => {
    setProcessing(true);
    try {
      const response = await fetch('/api/sync/process', { method: 'POST' });
      if (!response.ok) throw new Error('Failed to process queue');
      const result = await response.json();
      
      // Refresh stats after processing
      await fetchStats();
      
      if (result.processed > 0) {
        alert(`Processed ${result.processed} items: ${result.succeeded} succeeded, ${result.failed} failed`);
      } else {
        alert('No pending items to process');
      }
    } catch (err) {
      alert('Failed to process sync queue');
    } finally {
      setProcessing(false);
    }
  };

  const handleRetryFailed = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/sync/retry', { method: 'POST' });
      if (!response.ok) throw new Error('Failed to retry failed items');
      const result = await response.json();
      
      await fetchStats();
      alert(`Queued ${result.queued} failed items for retry`);
    } catch (err) {
      alert('Failed to retry failed items');
    } finally {
      setLoading(false);
    }
  };

  // Initial fetch and auto-refresh
  useEffect(() => {
    fetchStats();
    const interval = setInterval(fetchStats, refreshInterval);
    return () => clearInterval(interval);
  }, [refreshInterval]);

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700">
        {error}
        <Button variant="ghost" size="sm" onClick={fetchStats} className="ml-2">
          Retry
        </Button>
      </div>
    );
  }

  if (!stats) {
    return (
      <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 animate-pulse">
        <div className="h-4 bg-gray-200 rounded w-1/3 mb-2"></div>
        <div className="h-8 bg-gray-200 rounded w-2/3"></div>
      </div>
    );
  }

  const hasFailed = stats.failed > 0;
  const hasPending = stats.pending > 0;

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold text-gray-900">Main Platform Sync</h3>
        <Button 
          variant="ghost" 
          size="sm" 
          onClick={fetchStats}
          disabled={loading}
          className="text-gray-400 hover:text-gray-600"
        >
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
        </Button>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-3 gap-3 mb-4">
        <div className="bg-green-50 rounded-lg p-3 text-center">
          <div className="flex items-center justify-center gap-1 text-green-600 mb-1">
            <CheckCircle size={16} />
            <span className="text-lg font-bold">{stats.completed}</span>
          </div>
          <p className="text-xs text-green-600/70">Synced</p>
        </div>

        <div className={`rounded-lg p-3 text-center ${hasPending ? 'bg-amber-50' : 'bg-gray-50'}`}>
          <div className={`flex items-center justify-center gap-1 mb-1 ${hasPending ? 'text-amber-600' : 'text-gray-400'}`}>
            <Clock size={16} />
            <span className="text-lg font-bold">{stats.pending}</span>
          </div>
          <p className={`text-xs ${hasPending ? 'text-amber-600/70' : 'text-gray-400'}`}>Pending</p>
        </div>

        <div className={`rounded-lg p-3 text-center ${hasFailed ? 'bg-red-50' : 'bg-gray-50'}`}>
          <div className={`flex items-center justify-center gap-1 mb-1 ${hasFailed ? 'text-red-600' : 'text-gray-400'}`}>
            <XCircle size={16} />
            <span className="text-lg font-bold">{stats.failed}</span>
          </div>
          <p className={`text-xs ${hasFailed ? 'text-red-600/70' : 'text-gray-400'}`}>Failed</p>
        </div>
      </div>

      {/* Total */}
      <div className="text-center mb-4">
        <span className="text-sm text-gray-500">
          Total: <span className="font-semibold text-gray-700">{stats.total}</span> items
        </span>
      </div>

      {/* Actions */}
      <div className="flex gap-2">
        <Button
          size="sm"
          className="flex-1"
          onClick={handleProcessNow}
          disabled={processing || (!hasPending && !hasFailed)}
        >
          {processing ? (
            <>
              <RefreshCw size={14} className="animate-spin mr-1" />
              Processing...
            </>
          ) : (
            'Process Now'
          )}
        </Button>

        {hasFailed && (
          <Button
            variant="outline"
            size="sm"
            onClick={handleRetryFailed}
            disabled={loading}
          >
            Retry Failed
          </Button>
        )}

        <Button
          variant="ghost"
          size="sm"
          asChild
        >
          <a href="/admin/sync-queue">
            <ExternalLink size={14} />
          </a>
        </Button>
      </div>

      {/* Last sync time indicator could go here */}
    </div>
  );
};

export default SyncStatusWidget;
