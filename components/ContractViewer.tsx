'use client';

import React, { useState, useEffect } from 'react';
import { Download, Send, Loader2, FileText, CheckCircle2, Clock, XCircle } from 'lucide-react';

interface Contract {
  id: string;
  templateId: string;
  clientId: string;
  content: string;
  status: 'draft' | 'sent' | 'signed' | 'archived';
  createdAt: string;
  updatedAt: string;
  template?: {
    id: string;
    name: string;
    type: string;
  };
  client?: {
    id: string;
    name: string;
    email: string;
  };
  signatures?: Array<{
    id: string;
    signerName: string;
    signerEmail: string;
    status: 'pending' | 'signed' | 'declined';
    signedAt?: string;
  }>;
}

interface ContractViewerProps {
  contractId: string;
}

export const ContractViewer: React.FC<ContractViewerProps> = ({ contractId }) => {
  const [contract, setContract] = useState<Contract | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [sending, setSending] = useState(false);
  const [signers, setSigners] = useState<Array<{ name: string; email: string; role: string }>>([]);
  const [showSignForm, setShowSignForm] = useState(false);
  const [newSigner, setNewSigner] = useState({ name: '', email: '', role: 'signer' });

  useEffect(() => {
    loadContract();
  }, [contractId]);

  const loadContract = async () => {
    try {
      setLoading(true);
      const res = await fetch(`/api/admin/contracts/${contractId}`);
      if (!res.ok) throw new Error('Failed to load contract');
      
      const data = await res.json();
      setContract(data);
      setSigners(data.signatures?.map((s: any) => ({
        name: s.signerName,
        email: s.signerEmail,
        role: s.signerRole || 'signer'
      })) || []);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDownloadPDF = async () => {
    try {
      const res = await fetch(`/api/admin/contracts/${contractId}/render`, {
        method: 'POST'
      });

      if (!res.ok) throw new Error('Failed to generate PDF');

      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `contract-${contractId}.pdf`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (err: any) {
      alert('Error downloading PDF: ' + err.message);
    }
  };

  const handleAddSigner = () => {
    if (!newSigner.name || !newSigner.email) {
      alert('Please fill in all fields');
      return;
    }

    setSigners([...signers, newSigner]);
    setNewSigner({ name: '', email: '', role: 'signer' });
  };

  const handleRemoveSigner = (index: number) => {
    setSigners(signers.filter((_, i) => i !== index));
  };

  const handleSendForSignature = async () => {
    try {
      if (signers.length === 0) {
        alert('Please add at least one signer');
        return;
      }

      setSending(true);
      const res = await fetch(`/api/admin/contracts/${contractId}/send-for-signature`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ signers })
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || 'Failed to send contract');
      }

      alert('Contract sent for signatures!');
      setShowSignForm(false);
      loadContract();
    } catch (err: any) {
      alert('Error: ' + err.message);
    } finally {
      setSending(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'draft':
        return <span className="inline-flex items-center gap-1 bg-gray-100 text-gray-700 px-3 py-1 rounded-full text-sm font-bold"><Clock size={14} /> Draft</span>;
      case 'sent':
        return <span className="inline-flex items-center gap-1 bg-blue-100 text-blue-700 px-3 py-1 rounded-full text-sm font-bold"><Send size={14} /> Sent</span>;
      case 'signed':
        return <span className="inline-flex items-center gap-1 bg-green-100 text-green-700 px-3 py-1 rounded-full text-sm font-bold"><CheckCircle2 size={14} /> Signed</span>;
      default:
        return <span className="inline-flex items-center gap-1 bg-gray-100 text-gray-700 px-3 py-1 rounded-full text-sm font-bold">{status}</span>;
    }
  };

  const getSignatureStatus = (status: string) => {
    switch (status) {
      case 'signed':
        return <span className="inline-flex items-center gap-1 text-green-600"><CheckCircle2 size={16} /> Signed</span>;
      case 'pending':
        return <span className="inline-flex items-center gap-1 text-amber-600"><Clock size={16} /> Pending</span>;
      case 'declined':
        return <span className="inline-flex items-center gap-1 text-red-600"><XCircle size={16} /> Declined</span>;
      default:
        return status;
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="animate-spin" size={32} />
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
        {error}
      </div>
    );
  }

  if (!contract) {
    return <div className="text-center py-12 text-gray-500">Contract not found</div>;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white p-6 rounded-lg shadow">
        <div className="flex items-start justify-between mb-4">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <FileText size={24} className="text-fcGold" />
              <h1 className="text-3xl font-bold">{contract.template?.name || 'Contract'}</h1>
            </div>
            <p className="text-gray-600">Contract ID: {contract.id}</p>
          </div>
          <div>
            {getStatusBadge(contract.status)}
          </div>
        </div>

        <div className="grid grid-cols-3 gap-4 text-sm">
          <div>
            <p className="text-gray-600">Client</p>
            <p className="font-bold">{contract.client?.name}</p>
            <p className="text-xs text-gray-500">{contract.client?.email}</p>
          </div>
          <div>
            <p className="text-gray-600">Type</p>
            <p className="font-bold">{contract.template?.type}</p>
          </div>
          <div>
            <p className="text-gray-600">Created</p>
            <p className="font-bold">{new Date(contract.createdAt).toLocaleDateString()}</p>
          </div>
        </div>
      </div>

      {/* Contract Content */}
      <div className="bg-white p-8 rounded-lg shadow border">
        <div
          className="prose prose-sm max-w-none"
          dangerouslySetInnerHTML={{ __html: contract.content }}
        />
      </div>

      {/* Signatures Section */}
      <div className="bg-white p-6 rounded-lg shadow">
        <h2 className="text-xl font-bold mb-4">Signatures ({contract.signatures?.length || 0})</h2>

        {contract.signatures && contract.signatures.length > 0 ? (
          <div className="space-y-3">
            {contract.signatures.map((sig, i) => (
              <div key={i} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                <div>
                  <p className="font-bold">{sig.signerName}</p>
                  <p className="text-sm text-gray-600">{sig.signerEmail}</p>
                </div>
                <div className="text-right">
                  {getSignatureStatus(sig.status)}
                  {sig.signedAt && (
                    <p className="text-xs text-gray-500 mt-1">
                      {new Date(sig.signedAt).toLocaleDateString()}
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-gray-500 text-sm">No signatures yet</p>
        )}
      </div>

      {/* Add Signers Section */}
      {!showSignForm ? (
        <button
          onClick={() => setShowSignForm(true)}
          className="w-full bg-fcGold text-white py-3 rounded-lg font-bold hover:bg-fcGold/90 flex items-center justify-center gap-2"
        >
          <Send size={18} />
          Send for Signature
        </button>
      ) : (
        <div className="bg-white p-6 rounded-lg shadow space-y-4">
          <h3 className="text-lg font-bold">Add Signers</h3>

          {/* Signers List */}
          <div className="space-y-2">
            {signers.map((signer, i) => (
              <div key={i} className="flex items-center justify-between p-3 bg-gray-50 rounded">
                <div>
                  <p className="font-bold text-sm">{signer.name}</p>
                  <p className="text-xs text-gray-600">{signer.email}</p>
                </div>
                <button
                  onClick={() => handleRemoveSigner(i)}
                  className="text-red-500 hover:text-red-700 text-sm font-bold"
                >
                  Remove
                </button>
              </div>
            ))}
          </div>

          {/* Add Signer Form */}
          <div className="space-y-2 pt-2 border-t">
            <input
              type="text"
              placeholder="Signer Name"
              value={newSigner.name}
              onChange={(e) => setNewSigner({ ...newSigner, name: e.target.value })}
              className="w-full px-3 py-2 border rounded text-sm"
            />
            <input
              type="email"
              placeholder="Email Address"
              value={newSigner.email}
              onChange={(e) => setNewSigner({ ...newSigner, email: e.target.value })}
              className="w-full px-3 py-2 border rounded text-sm"
            />
            <select
              value={newSigner.role}
              onChange={(e) => setNewSigner({ ...newSigner, role: e.target.value })}
              className="w-full px-3 py-2 border rounded text-sm"
            >
              <option value="signer">Signer</option>
              <option value="witness">Witness</option>
              <option value="notary">Notary</option>
            </select>
            <button
              onClick={handleAddSigner}
              className="w-full bg-gray-600 text-white py-2 rounded font-bold text-sm hover:bg-gray-700"
            >
              Add Signer
            </button>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-3 pt-4 border-t">
            <button
              onClick={handleSendForSignature}
              disabled={sending || signers.length === 0}
              className="flex-1 bg-fcGold text-white py-2 rounded-lg font-bold hover:bg-fcGold/90 disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {sending ? (
                <>
                  <Loader2 className="animate-spin" size={16} />
                  Sending...
                </>
              ) : (
                <>
                  <Send size={16} />
                  Send for Signature
                </>
              )}
            </button>
            <button
              onClick={() => setShowSignForm(false)}
              className="flex-1 bg-gray-200 text-gray-800 py-2 rounded-lg font-bold hover:bg-gray-300"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Download Button */}
      <button
        onClick={handleDownloadPDF}
        className="w-full bg-gray-600 text-white py-3 rounded-lg font-bold hover:bg-gray-700 flex items-center justify-center gap-2"
      >
        <Download size={18} />
        Download as PDF
      </button>
    </div>
  );
};
