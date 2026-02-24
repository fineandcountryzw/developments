'use client';

import React, { useState, useEffect } from 'react';
import { 
  Loader2, Eye, Download, Send, Trash2, Search, FileText, 
  CheckCircle, Clock, AlertCircle, XCircle, RefreshCw, ExternalLink,
  PenTool
} from 'lucide-react';
import { ContractViewer } from './ContractViewer';

// Extended contract interface with DocuSeal fields
interface Contract {
  id: string;
  templateId: string;
  clientId: string;
  standId: string;
  templateName?: string;
  content: string;
  status: string;
  createdAt: string;
  template?: { name: string; type: string };
  client?: { name: string; email: string };
  stand?: { standNumber: string; development?: { name: string } };
  signatures?: Array<{ status: 'pending' | 'signed' | 'declined' }>;
  // DocuSeal fields
  docusealSubmissionId?: string;
  docusealStatus?: string;
  docusealSignerClientStatus?: string;
  docusealSignerDevStatus?: string;
  signedPdfUrl?: string;
  sentForSignatureAt?: string;
  fullySignedAt?: string;
  developerEmail?: string;
  developerName?: string;
  signers?: Array<{
    role: string;
    name?: string | null;
    email?: string | null;
    status?: string | null;
  }>;
}

interface SendForSignatureModalProps {
  contract: Contract;
  onClose: () => void;
  onSent: () => void;
}

interface AutoPopulatedData {
  client: { email: string | null; name: string; source: string };
  developer: { email: string | null; name: string; source: string | null };
  lawyer?: { email: string | null; name: string; source: string | null };
  principalAgent?: { email: string | null; name: string; source: string | null };
}

// Modal for sending contract for e-signature
// Auto-fetches emails from Client and Development records
const SendForSignatureModal: React.FC<SendForSignatureModalProps> = ({ contract, onClose, onSent }) => {
  const [loading, setLoading] = useState(true);
  const [autoData, setAutoData] = useState<AutoPopulatedData | null>(null);
  const [developerEmail, setDeveloperEmail] = useState('');
  const [developerName, setDeveloperName] = useState('');
  const [message, setMessage] = useState('');
  const [expiresInDays, setExpiresInDays] = useState(30);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');

  // Fetch auto-populated emails on mount
  useEffect(() => {
    const fetchAutoPopulated = async () => {
      try {
        const res = await fetch(`/api/admin/contracts/${contract.id}/send-docuseal`);
        const data = await res.json();
        
        if (data.success && data.data?.autoPopulated) {
          setAutoData(data.data.autoPopulated);
          // Pre-fill with auto-populated values
          if (data.data.autoPopulated.developer.email) {
            setDeveloperEmail(data.data.autoPopulated.developer.email);
          }
          if (data.data.autoPopulated.developer.name) {
            setDeveloperName(data.data.autoPopulated.developer.name);
          }
        }
      } catch (err) {
        console.error('Failed to fetch auto-populated data:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchAutoPopulated();
  }, [contract.id]);

  const handleSend = async () => {
    // Emails are auto-fetched, so we can send even with empty fields (backend will use auto values)
    try {
      setSending(true);
      setError('');

      const res = await fetch(`/api/admin/contracts/${contract.id}/send-docuseal`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          // Only send if user modified the values (for override)
          developerEmail: developerEmail.trim() || undefined,
          developerName: developerName.trim() || undefined,
          message: message.trim() || undefined,
          expiresInDays,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to send for signature');
      }

      onSent();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSending(false);
    }
  };

  const clientEmail = autoData?.client.email || contract.client?.email;
  const clientName = autoData?.client.name || contract.client?.name || 'N/A';
  const hasDevEmail = !!(developerEmail || autoData?.developer.email);
  const lawyerEmail = autoData?.lawyer?.email || null;
  const lawyerName = autoData?.lawyer?.name || 'Lawyer';
  const hasLawyerEmail = !!lawyerEmail;
  const principalAgentEmail = autoData?.principalAgent?.email || null;
  const principalAgentName = autoData?.principalAgent?.name || 'Principal Agent';
  const hasPrincipalAgentEmail = !!principalAgentEmail;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-md mx-4 overflow-hidden">
        <div className="bg-fcGold text-white px-6 py-4">
          <h2 className="text-lg font-bold">Send for E-Signature</h2>
          <p className="text-sm opacity-90">Contract will be sent to Client, Developer, Lawyer, and Principal Agent</p>
        </div>

        {loading ? (
          <div className="p-12 flex items-center justify-center">
            <Loader2 className="animate-spin" size={32} />
          </div>
        ) : (
          <>
            <div className="p-6 space-y-4">
              {error && (
                <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
                  {error}
                </div>
              )}

              {/* Client Info (auto-fetched, read-only) */}
              <div className="bg-green-50 border border-green-200 p-4 rounded-lg">
                <div className="flex items-center gap-2 mb-2">
                  <CheckCircle size={16} className="text-green-600" />
                  <span className="text-sm font-medium text-green-800">Client (Auto-fetched)</span>
                </div>
                <p className="text-sm text-gray-700 font-medium">{clientName}</p>
                <p className="text-sm text-gray-600">{clientEmail || 'No email found'}</p>
              </div>

              {/* Developer Info (auto-fetched with option to override) */}
              <div className={`p-4 rounded-lg border ${autoData?.developer.email ? 'bg-green-50 border-green-200' : 'bg-amber-50 border-amber-200'}`}>
                <div className="flex items-center gap-2 mb-2">
                  {autoData?.developer.email ? (
                    <CheckCircle size={16} className="text-green-600" />
                  ) : (
                    <AlertCircle size={16} className="text-amber-600" />
                  )}
                  <span className={`text-sm font-medium ${autoData?.developer.email ? 'text-green-800' : 'text-amber-800'}`}>
                    Developer {autoData?.developer.source ? `(From ${autoData.developer.source})` : '(Manual Entry Required)'}
                  </span>
                </div>
                
                <div className="space-y-3 mt-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">
                      Name {!autoData?.developer.name && '*'}
                    </label>
                    <input
                      type="text"
                      value={developerName}
                      onChange={(e) => setDeveloperName(e.target.value)}
                      placeholder={autoData?.developer.name || "Enter developer name"}
                      className="w-full px-3 py-2 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-fcGold"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">
                      Email {!autoData?.developer.email && '*'}
                    </label>
                    <input
                      type="email"
                      value={developerEmail}
                      onChange={(e) => setDeveloperEmail(e.target.value)}
                      placeholder={autoData?.developer.email || "Enter developer email"}
                      className="w-full px-3 py-2 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-fcGold"
                    />
                  </div>
                </div>
              </div>

              {/* Lawyer Info (auto-fetched, read-only) */}
              <div className={`p-4 rounded-lg border ${hasLawyerEmail ? 'bg-green-50 border-green-200' : 'bg-amber-50 border-amber-200'}`}>
                <div className="flex items-center gap-2 mb-2">
                  {hasLawyerEmail ? (
                    <CheckCircle size={16} className="text-green-600" />
                  ) : (
                    <AlertCircle size={16} className="text-amber-600" />
                  )}
                  <span className={`text-sm font-medium ${hasLawyerEmail ? 'text-green-800' : 'text-amber-800'}`}>
                    Lawyer {autoData?.lawyer?.source ? `(From ${autoData.lawyer.source})` : ''}
                  </span>
                </div>
                <p className="text-sm text-gray-700 font-medium">{lawyerName}</p>
                <p className="text-sm text-gray-600">{lawyerEmail || 'No lawyer email found (set it on the Development record).'}</p>
              </div>

              {/* Principal Agent Info (auto-fetched, read-only) */}
              <div className={`p-4 rounded-lg border ${hasPrincipalAgentEmail ? 'bg-green-50 border-green-200' : 'bg-amber-50 border-amber-200'}`}>
                <div className="flex items-center gap-2 mb-2">
                  {hasPrincipalAgentEmail ? (
                    <CheckCircle size={16} className="text-green-600" />
                  ) : (
                    <AlertCircle size={16} className="text-amber-600" />
                  )}
                  <span className={`text-sm font-medium ${hasPrincipalAgentEmail ? 'text-green-800' : 'text-amber-800'}`}>
                    Principal Agent {autoData?.principalAgent?.source ? `(From ${autoData.principalAgent.source})` : ''}
                  </span>
                </div>
                <p className="text-sm text-gray-700 font-medium">{principalAgentName}</p>
                <p className="text-sm text-gray-600">
                  {principalAgentEmail || 'No principal agent email found (set it in Settings → Branch Details).'}
                </p>
              </div>

              {/* Message */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Custom Message (optional)
                </label>
                <textarea
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="Add a personal message to all signers..."
                  rows={2}
                  className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-fcGold resize-none text-sm"
                />
              </div>

              {/* Expiry */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Expires In
                </label>
                <select
                  value={expiresInDays}
                  onChange={(e) => setExpiresInDays(Number(e.target.value))}
                  className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-fcGold text-sm"
                >
                  <option value={7}>7 days</option>
                  <option value={14}>14 days</option>
                  <option value={30}>30 days</option>
                  <option value={60}>60 days</option>
                  <option value={90}>90 days</option>
                </select>
              </div>
            </div>

            <div className="border-t px-6 py-4 flex gap-3 justify-end bg-gray-50">
              <button
                onClick={onClose}
                disabled={sending}
                className="px-4 py-2 text-gray-600 hover:bg-gray-200 rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSend}
                disabled={sending || !clientEmail || !hasDevEmail || !hasLawyerEmail || !hasPrincipalAgentEmail}
                className="px-4 py-2 bg-fcGold text-white rounded-lg hover:bg-fcGold/90 transition-colors flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {sending ? (
                  <>
                    <Loader2 size={16} className="animate-spin" />
                    Sending...
                  </>
                ) : (
                  <>
                    <Send size={16} />
                    Send for Signature
                  </>
                )}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export const ContractsList: React.FC = () => {
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedContractId, setSelectedContractId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [sendModalContract, setSendModalContract] = useState<Contract | null>(null);

  useEffect(() => {
    loadContracts();
  }, [page, statusFilter]);

  const loadContracts = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams({ page: page.toString(), limit: '20' });
      if (statusFilter) params.append('status', statusFilter);

      const res = await fetch(`/api/admin/contracts?${params.toString()}`);
      if (!res.ok) throw new Error('Failed to load contracts');

      const data = await res.json();
      // Handle both { data: [...] } and { data: { data: [...] } } response formats
      const contractsData = Array.isArray(data.data) ? data.data : 
                           (data.data?.data && Array.isArray(data.data.data)) ? data.data.data : [];
      setContracts(contractsData);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const normalizeSignerStatus = (status?: string | null) => {
    const s = (status || '').toLowerCase();
    if (!s) return 'pending';
    if (s === 'completed') return 'signed';
    return s;
  };

  const dotColorForStatus = (status?: string | null) => {
    const s = normalizeSignerStatus(status);
    switch (s) {
      case 'signed':
        return 'bg-green-500';
      case 'declined':
      case 'expired':
        return 'bg-red-500';
      case 'opened':
        return 'bg-fcGold';
      case 'not_invited':
        return 'bg-gray-200';
      default:
        return 'bg-gray-300';
    }
  };

  const signerRowsForDisplay = (contract: Contract) => {
    const order: Array<{ role: string; label: string }> = [
      { role: 'client', label: 'Client' },
      { role: 'developer', label: 'Developer' },
      { role: 'lawyer', label: 'Lawyer' },
      { role: 'principal_agent', label: 'Principal Agent' },
    ];

    if (Array.isArray(contract.signers) && contract.signers.length > 0) {
      const byRole = new Map(contract.signers.map(s => [s.role, s]));
      return order.map(({ role, label }) => {
        const row = byRole.get(role);
        return { role, label, status: normalizeSignerStatus(row?.status), email: row?.email, name: row?.name };
      });
    }

    // Back-compat for older DocuSeal contracts (client + developer only)
    return [
      { role: 'client', label: 'Client', status: normalizeSignerStatus(contract.docusealSignerClientStatus) },
      { role: 'developer', label: 'Developer', status: normalizeSignerStatus(contract.docusealSignerDevStatus) },
    ];
  };

  const getSignatureProgress = (contract: Contract): { completed: number; total: number } => {
    // For DocuSeal contracts
    if (contract.docusealSubmissionId) {
      if (Array.isArray(contract.signers) && contract.signers.length > 0) {
        const completed = contract.signers.filter(s => normalizeSignerStatus(s.status) === 'signed').length;
        return { completed, total: contract.signers.length };
      }

      let completed = 0;
      const total = 2;
      if (normalizeSignerStatus(contract.docusealSignerClientStatus) === 'signed') completed++;
      if (normalizeSignerStatus(contract.docusealSignerDevStatus) === 'signed') completed++;
      return { completed, total };
    }
    
    // Legacy signature tracking
    if (!Array.isArray(contract.signatures) || contract.signatures.length === 0) {
      return { completed: 0, total: 0 };
    }
    const completed = contract.signatures.filter(s => s.status === 'signed').length;
    return { completed, total: contract.signatures.length };
  };

  // Get display status (prefer DocuSeal status if available)
  const getDisplayStatus = (contract: Contract): string => {
    return contract.docusealStatus || contract.status;
  };

  const getStatusColor = (status: string) => {
    const upperStatus = status.toUpperCase();
    switch (upperStatus) {
      case 'DRAFT':
        return 'bg-gray-100 text-gray-700';
      case 'SENT':
        return 'bg-blue-100 text-blue-700';
      case 'VIEWED':
        return 'bg-purple-100 text-purple-700';
      case 'PARTIALLY_SIGNED':
        return 'bg-amber-100 text-amber-700';
      case 'SIGNED':
        return 'bg-green-100 text-green-700';
      case 'EXPIRED':
        return 'bg-red-100 text-red-700';
      case 'DECLINED':
        return 'bg-red-100 text-red-700';
      case 'ARCHIVED':
        return 'bg-gray-200 text-gray-600';
      default:
        return 'bg-gray-100 text-gray-700';
    }
  };

  const getStatusIcon = (status: string) => {
    const upperStatus = status.toUpperCase();
    switch (upperStatus) {
      case 'DRAFT':
        return <FileText size={14} />;
      case 'SENT':
        return <Send size={14} />;
      case 'VIEWED':
        return <Eye size={14} />;
      case 'PARTIALLY_SIGNED':
        return <PenTool size={14} />;
      case 'SIGNED':
        return <CheckCircle size={14} />;
      case 'EXPIRED':
        return <Clock size={14} />;
      case 'DECLINED':
        return <XCircle size={14} />;
      default:
        return null;
    }
  };

  const canSendForSignature = (contract: Contract): boolean => {
    const status = getDisplayStatus(contract).toUpperCase();
    return status === 'DRAFT' && !contract.docusealSubmissionId;
  };

  const handleDownload = async (contract: Contract, type: 'draft' | 'signed') => {
    if (type === 'signed' && contract.signedPdfUrl) {
      window.open(contract.signedPdfUrl, '_blank');
      return;
    }

    // Download draft/HTML version
    try {
      const res = await fetch(`/api/admin/contracts/${contract.id}/download`);
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `contract-${contract.id}.html`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (err) {
      console.error('Download failed:', err);
    }
  };

  // Show contract viewer if selected
  if (selectedContractId) {
    return (
      <div className="space-y-4">
        <button
          onClick={() => setSelectedContractId(null)}
          className="text-fcGold font-bold hover:underline flex items-center gap-2"
        >
          ← Back to List
        </button>
        <ContractViewer contractId={selectedContractId} />
      </div>
    );
  }

  // Show contracts list
  return (
    <div className="space-y-6">
      {/* Send for Signature Modal */}
      {sendModalContract && (
        <SendForSignatureModal
          contract={sendModalContract}
          onClose={() => setSendModalContract(null)}
          onSent={() => {
            setSendModalContract(null);
            loadContracts();
          }}
        />
      )}

      {/* Search & Filter */}
      <div className="flex gap-4 flex-wrap">
        <div className="flex-1 min-w-[250px]">
          <div className="relative">
            <Search className="absolute left-3 top-3 text-gray-400" size={18} />
            <input
              type="text"
              placeholder="Search contracts..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-fcGold"
            />
          </div>
        </div>
        <select
          value={statusFilter || ''}
          onChange={(e) => {
            setStatusFilter(e.target.value || null);
            setPage(1);
          }}
          className="px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-fcGold"
        >
          <option value="">All Status</option>
          <option value="DRAFT">Draft</option>
          <option value="SENT">Sent</option>
          <option value="VIEWED">Viewed</option>
          <option value="PARTIALLY_SIGNED">Partially Signed</option>
          <option value="SIGNED">Signed</option>
          <option value="EXPIRED">Expired</option>
          <option value="DECLINED">Declined</option>
          <option value="ARCHIVED">Archived</option>
        </select>
        <button
          onClick={loadContracts}
          className="px-4 py-2 border rounded-lg hover:bg-gray-100 transition-colors flex items-center gap-2"
        >
          <RefreshCw size={16} />
          Refresh
        </button>
      </div>

      {/* Error Message */}
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
          {error}
        </div>
      )}

      {/* Loading State */}
      {loading && (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="animate-spin" size={32} />
        </div>
      )}

      {/* Contracts Table */}
      {!loading && contracts.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b-2 border-gray-200">
                <th className="text-left py-3 px-4 font-bold">Template</th>
                <th className="text-left py-3 px-4 font-bold">Client</th>
                <th className="text-left py-3 px-4 font-bold">Status</th>
                <th className="text-left py-3 px-4 font-bold">Signatures</th>
                <th className="text-left py-3 px-4 font-bold">Created</th>
                <th className="text-right py-3 px-4 font-bold">Actions</th>
              </tr>
            </thead>
            <tbody>
              {contracts.map((contract) => {
                const sigProgress = getSignatureProgress(contract);
                const displayStatus = getDisplayStatus(contract);
                const isSigned = displayStatus.toUpperCase() === 'SIGNED';
                
                return (
                  <tr key={contract.id} className="border-b hover:bg-gray-50">
                    <td className="py-3 px-4">
                      <div className="font-bold">{contract.template?.name || contract.templateName || 'N/A'}</div>
                      <div className="text-xs text-gray-500">
                        {contract.stand?.standNumber && `Stand ${contract.stand.standNumber}`}
                        {contract.stand?.development?.name && ` • ${contract.stand.development.name}`}
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      <div className="font-bold">{contract.client?.name || 'N/A'}</div>
                      <div className="text-xs text-gray-500">{contract.client?.email}</div>
                      {contract.developerEmail && (
                        <div className="text-xs text-gray-400 mt-1">
                          Dev: {contract.developerName || contract.developerEmail}
                        </div>
                      )}
                    </td>
                    <td className="py-3 px-4">
                      <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-bold ${getStatusColor(displayStatus)}`}>
                        {getStatusIcon(displayStatus)}
                        {displayStatus.toUpperCase().replace('_', ' ')}
                      </span>
                      {contract.sentForSignatureAt && (
                        <div className="text-xs text-gray-400 mt-1">
                          Sent {new Date(contract.sentForSignatureAt).toLocaleDateString()}
                        </div>
                      )}
                    </td>
                    <td className="py-3 px-4">
                      {sigProgress.total > 0 ? (
                        <div>
                          <div className="font-bold text-sm">{sigProgress.completed}/{sigProgress.total}</div>
                          <div className="w-20 h-1.5 bg-gray-200 rounded-full mt-1 overflow-hidden">
                            <div
                              className={`h-full transition-all ${
                                sigProgress.completed === sigProgress.total 
                                  ? 'bg-green-500' 
                                  : 'bg-fcGold'
                              }`}
                              style={{ width: `${(sigProgress.completed / sigProgress.total) * 100}%` }}
                            />
                          </div>
                          {contract.docusealSubmissionId && (
                            <div className="text-xs text-gray-400 mt-1 space-y-0.5">
                              {signerRowsForDisplay(contract).map((s) => (
                                <div key={s.role} className="flex items-center gap-1">
                                  <span className={`w-2 h-2 rounded-full ${dotColorForStatus(s.status)}`} />
                                  {s.label}
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      ) : (
                        <span className="text-gray-400 text-sm">—</span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-sm text-gray-600">
                      {new Date(contract.createdAt).toLocaleDateString()}
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex gap-2 justify-end">
                        <button
                          onClick={() => setSelectedContractId(contract.id)}
                          title="View"
                          className="p-2 hover:bg-gray-200 rounded transition-all"
                        >
                          <Eye size={16} />
                        </button>
                        
                        {/* Download Draft */}
                        <button
                          onClick={() => handleDownload(contract, 'draft')}
                          title="Download Draft"
                          className="p-2 hover:bg-gray-200 rounded transition-all"
                        >
                          <Download size={16} />
                        </button>

                        {/* Download Signed PDF */}
                        {isSigned && contract.signedPdfUrl && (
                          <button
                            onClick={() => handleDownload(contract, 'signed')}
                            title="Download Signed PDF"
                            className="p-2 hover:bg-green-100 text-green-600 rounded transition-all"
                          >
                            <ExternalLink size={16} />
                          </button>
                        )}

                        {/* Send for Signature */}
                        {canSendForSignature(contract) && (
                          <button
                            onClick={() => setSendModalContract(contract)}
                            title="Send for E-Signature"
                            className="p-2 hover:bg-blue-100 text-blue-600 rounded transition-all"
                          >
                            <Send size={16} />
                          </button>
                        )}

                        {/* Archive/Delete */}
                        <button
                          onClick={() => {
                            const isDraft = contract.status === 'DRAFT';
                            const actionText = isDraft ? 'delete' : 'archive';
                            const confirmed = confirm(`Are you sure you want to ${actionText} this contract?`);
                            
                            if (confirmed) {
                              fetch(`/api/admin/contracts/${contract.id}`, {
                                method: 'DELETE'
                              }).then(() => loadContracts());
                            }
                          }}
                          title={contract.status === 'DRAFT' ? 'Delete' : 'Archive'}
                          className="p-2 hover:bg-red-100 text-red-600 rounded transition-all"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Empty State */}
      {!loading && contracts.length === 0 && (
        <div className="text-center py-12 bg-gray-50 rounded-lg">
          <FileText className="mx-auto mb-4 text-gray-400" size={48} />
          <p className="text-gray-600 font-bold">No contracts yet</p>
          <p className="text-gray-500 text-sm">Create a contract to get started</p>
        </div>
      )}
    </div>
  );
};
