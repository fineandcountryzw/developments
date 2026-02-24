'use client';

/**
 * BackupDashboard Component
 * Shared backup management UI for Developer and Admin dashboards
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  Database,
  Download,
  RefreshCw,
  Calendar,
  FileText,
  Archive,
  Mail,
  CheckCircle2,
  XCircle,
  Clock,
  AlertTriangle,
  Loader2,
  HardDrive,
} from 'lucide-react';

interface BackupJob {
  id: string;
  scopeType: 'DEVELOPER' | 'ADMIN';
  scopeId: string;
  weekStart: string;
  weekEnd: string;
  weekLabel: string;
  status: 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'FAILED';
  artifactUrl: string | null;
  fileSize: string | null;
  errorMessage: string | null;
  startedAt: string | null;
  completedAt: string | null;
  emailSent: boolean;
  emailSentAt: string | null;
  retriesCount: number;
  metadata: any;
  createdAt: string;
}

interface BackupDashboardProps {
  userRole: 'developer' | 'admin';
  userEmail: string;
}

export default function BackupDashboard({ userRole, userEmail }: BackupDashboardProps) {
  const [backups, setBackups] = useState<BackupJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [emailSending, setEmailSending] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const fetchBackups = useCallback(async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (userRole === 'admin') {
        params.set('scopeType', 'ADMIN');
        params.set('scopeId', 'admin');
      }
      const res = await fetch(`/api/backups?${params.toString()}`);
      if (!res.ok) throw new Error('Failed to fetch backups');
      const data = await res.json();
      setBackups(data.backups || []);
    } catch (err) {
      console.error('Error fetching backups:', err);
      setError('Failed to load backups');
    } finally {
      setLoading(false);
    }
  }, [userRole]);

  useEffect(() => {
    fetchBackups();
  }, [fetchBackups]);

  const handleGenerate = async () => {
    try {
      setGenerating(true);
      setError(null);
      setSuccessMessage(null);

      const body = {
        scopeType: userRole === 'admin' ? 'ADMIN' : 'DEVELOPER',
        scopeId: userRole === 'admin' ? 'admin' : userEmail,
      };

      const res = await fetch('/api/backups/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.message || 'Failed to generate backup');
      }

      const data = await res.json();
      setSuccessMessage(`Backup generated successfully for week ${data.weekLabel}`);
      await fetchBackups();
    } catch (err) {
      console.error('Error generating backup:', err);
      setError(err instanceof Error ? err.message : 'Failed to generate backup');
    } finally {
      setGenerating(false);
    }
  };

  const handleDownload = async (backup: BackupJob) => {
    try {
      const res = await fetch(`/api/backups/${backup.id}/download`);
      if (!res.ok) throw new Error('Failed to get download link');
      const data = await res.json();

      // Open download URL
      window.open(data.downloadUrl, '_blank');
    } catch (err) {
      console.error('Error downloading:', err);
      setError('Failed to download backup');
    }
  };

  const handleResendEmail = async (backup: BackupJob) => {
    try {
      setEmailSending(backup.id);
      const res = await fetch(`/api/backups/${backup.id}/email`, {
        method: 'POST',
      });
      if (!res.ok) throw new Error('Failed to send email');
      setSuccessMessage('Email sent successfully');
      await fetchBackups();
    } catch (err) {
      console.error('Error sending email:', err);
      setError('Failed to send email');
    } finally {
      setEmailSending(null);
    }
  };

  const formatFileSize = (bytes: string | null) => {
    if (!bytes) return 'N/A';
    const b = parseInt(bytes);
    if (b < 1024) return `${b} B`;
    if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} KB`;
    return `${(b / (1024 * 1024)).toFixed(1)} MB`;
  };

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return 'N/A';
    return new Date(dateStr).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const formatDateTime = (dateStr: string | null) => {
    if (!dateStr) return 'N/A';
    return new Date(dateStr).toLocaleString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'COMPLETED':
        return <CheckCircle2 size={16} className="text-green-500" />;
      case 'IN_PROGRESS':
        return <Loader2 size={16} className="text-blue-500 animate-spin" />;
      case 'FAILED':
        return <XCircle size={16} className="text-red-500" />;
      default:
        return <Clock size={16} className="text-amber-500" />;
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'COMPLETED':
        return 'Completed';
      case 'IN_PROGRESS':
        return 'Generating...';
      case 'FAILED':
        return 'Failed';
      default:
        return 'Pending';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'COMPLETED':
        return 'bg-green-100 text-green-700';
      case 'IN_PROGRESS':
        return 'bg-blue-100 text-blue-700';
      case 'FAILED':
        return 'bg-red-100 text-red-700';
      default:
        return 'bg-amber-100 text-amber-700';
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold text-gray-900">
            Backup & Data Management
          </h2>
          <p className="text-sm text-gray-500 mt-1">
            {userRole === 'admin'
              ? 'System-wide weekly backups with CSV exports and PDF summaries'
              : 'Your weekly development backups with CSV exports and PDF summaries'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={fetchBackups}
            disabled={loading}
            className="flex items-center gap-2 px-3 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
            Refresh
          </button>
          <button
            onClick={handleGenerate}
            disabled={generating}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium bg-[#C5A059] text-white rounded-lg hover:bg-opacity-90 transition-colors disabled:opacity-50"
          >
            {generating ? (
              <Loader2 size={14} className="animate-spin" />
            ) : (
              <Database size={14} />
            )}
            {generating ? 'Generating...' : 'Generate This Week\'s Backup'}
          </button>
        </div>
      </div>

      {/* Success/Error Messages */}
      {successMessage && (
        <div className="flex items-center gap-2 p-3 bg-green-50 border border-green-200 rounded-lg text-sm text-green-700">
          <CheckCircle2 size={16} />
          {successMessage}
          <button onClick={() => setSuccessMessage(null)} className="ml-auto text-green-500 hover:text-green-700">
            &times;
          </button>
        </div>
      )}
      {error && (
        <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
          <AlertTriangle size={16} />
          {error}
          <button onClick={() => setError(null)} className="ml-auto text-red-500 hover:text-red-700">
            &times;
          </button>
        </div>
      )}

      {/* Info Card */}
      <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
        <div className="flex items-start gap-3">
          <Archive size={20} className="text-blue-600 mt-0.5 flex-shrink-0" />
          <div>
            <h4 className="font-medium text-blue-900">Weekly Backup Contents</h4>
            <p className="text-sm text-blue-700 mt-1">
              Each backup ZIP contains CSV files (developments, stands, reservations, contracts, 
              payments, receipts, installments, allocations{userRole === 'admin' ? ', payouts' : ''}, reconciliation summary) 
              and a PDF summary report. Backups run automatically every week.
            </p>
          </div>
        </div>
      </div>

      {/* Backups List */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 size={32} className="animate-spin text-[#C5A059]" />
        </div>
      ) : backups.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-2xl border border-gray-200">
          <Database size={48} className="mx-auto mb-4 text-gray-300" />
          <h3 className="font-semibold text-gray-900 mb-2">No Backups Yet</h3>
          <p className="text-sm text-gray-500 mb-4">
            Click "Generate This Week's Backup" to create your first backup.
          </p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
          {/* Table Header */}
          <div className="hidden sm:grid grid-cols-12 gap-4 px-6 py-3 bg-gray-50 border-b text-xs font-medium text-gray-500 uppercase tracking-wider">
            <div className="col-span-2">Week</div>
            <div className="col-span-2">Period</div>
            <div className="col-span-2">Status</div>
            <div className="col-span-1">Size</div>
            <div className="col-span-2">Generated</div>
            <div className="col-span-3 text-right">Actions</div>
          </div>

          {/* Table Rows */}
          {backups.map((backup) => (
            <div
              key={backup.id}
              className="grid grid-cols-1 sm:grid-cols-12 gap-2 sm:gap-4 px-4 sm:px-6 py-3 sm:py-4 border-b border-gray-100 hover:bg-gray-50 transition-colors last:border-b-0"
            >
              {/* Week Label */}
              <div className="sm:col-span-2 flex items-center gap-2">
                <Calendar size={14} className="text-gray-400 flex-shrink-0 hidden sm:block" />
                <span className="font-medium text-gray-900 text-sm">{backup.weekLabel}</span>
              </div>

              {/* Period */}
              <div className="sm:col-span-2 flex items-center">
                <span className="text-xs sm:text-sm text-gray-600">
                  {formatDate(backup.weekStart)} - {formatDate(backup.weekEnd)}
                </span>
              </div>

              {/* Status */}
              <div className="sm:col-span-2 flex items-center gap-1.5">
                {getStatusIcon(backup.status)}
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${getStatusColor(backup.status)}`}>
                  {getStatusLabel(backup.status)}
                </span>
              </div>

              {/* Size */}
              <div className="sm:col-span-1 flex items-center">
                <span className="text-xs sm:text-sm text-gray-600">
                  {formatFileSize(backup.fileSize)}
                </span>
              </div>

              {/* Generated date */}
              <div className="sm:col-span-2 flex items-center">
                <span className="text-xs text-gray-500">
                  {formatDateTime(backup.completedAt)}
                </span>
              </div>

              {/* Actions */}
              <div className="sm:col-span-3 flex items-center justify-start sm:justify-end gap-2 mt-2 sm:mt-0">
                {backup.status === 'COMPLETED' && (
                  <>
                    <button
                      onClick={() => handleDownload(backup)}
                      className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                    >
                      <Download size={12} />
                      Download
                    </button>
                    <button
                      onClick={() => handleResendEmail(backup)}
                      disabled={emailSending === backup.id}
                      className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
                    >
                      {emailSending === backup.id ? (
                        <Loader2 size={12} className="animate-spin" />
                      ) : (
                        <Mail size={12} />
                      )}
                      Email
                    </button>
                  </>
                )}
                {backup.status === 'FAILED' && (
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-red-600 max-w-[150px] truncate" title={backup.errorMessage || ''}>
                      {backup.errorMessage || 'Unknown error'}
                    </span>
                    <button
                      onClick={handleGenerate}
                      disabled={generating}
                      className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-amber-600 text-white rounded-lg hover:bg-amber-700 transition-colors"
                    >
                      <RefreshCw size={12} />
                      Retry
                    </button>
                  </div>
                )}
                {backup.status === 'IN_PROGRESS' && (
                  <span className="text-xs text-blue-600 flex items-center gap-1">
                    <Loader2 size={12} className="animate-spin" />
                    Processing...
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Metadata Section */}
      {backups.length > 0 && (
        <div className="bg-white rounded-2xl border border-gray-200 p-6">
          <h3 className="font-bold text-gray-900 mb-4 flex items-center gap-2">
            <FileText size={18} />
            Backup Contents Guide
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {[
              { file: 'developments.csv', desc: 'All development projects and their details' },
              { file: 'stands.csv', desc: 'Stand inventory with prices and statuses' },
              { file: 'reservations.csv', desc: 'Stand reservations and their statuses' },
              { file: 'contracts.csv', desc: 'Generated contracts and agreements' },
              { file: 'payments.csv', desc: 'Payment transactions and methods' },
              { file: 'receipts.csv', desc: 'Payment receipts and receipt numbers' },
              { file: 'installments.csv', desc: 'Installment plans and payment schedules' },
              { file: 'allocations.csv', desc: 'Payment allocation ledger (prevents double-counting)' },
              ...(userRole === 'admin' ? [{ file: 'payouts.csv', desc: 'Commission payouts to developers' }] : []),
              { file: 'recon_summary.csv', desc: 'Reconciliation summary records' },
              { file: 'backup_summary.pdf', desc: 'Visual PDF report with KPIs and charts' },
            ].map((item) => (
              <div
                key={item.file}
                className="flex items-start gap-2 p-3 bg-gray-50 rounded-lg"
              >
                <HardDrive size={14} className="text-gray-400 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="text-sm font-medium text-gray-900">{item.file}</p>
                  <p className="text-xs text-gray-500">{item.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
