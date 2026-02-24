import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { X, FileText, CheckCircle2 } from 'lucide-react';
import { Agent } from '../types.ts';
import UploadSection from './UploadSection';

interface ReservationModalProps {
  standId: string;
  agents: Agent[];
  onClose: () => void;
  onConfirm: (agentId: string | null) => void;
  selectedStandFromMap?: string | null; // Stand ID captured from map event
}

export const ReservationModal: React.FC<ReservationModalProps> = ({ standId, agents, onClose, onConfirm, selectedStandFromMap }) => {
  // 1. Initial State - Forensic Legal Consent Pattern
  const [agreed, setAgreed] = useState(false);
  const [search, setSearch] = useState('');
  const [selectedAgent, setSelectedAgent] = useState<string | null>(null);
  const [payLater, setPayLater] = useState(false);
  const [uploadedProof, setUploadedProof] = useState(false);
  const [toast, setToast] = useState<{ type: 'success' | 'error'; msg: string } | null>(null);
  const filteredAgents = agents.filter(a => a.name.toLowerCase().includes(search.toLowerCase()));

  // 🎯 MODAL EVENT TRACKING - Log when stand is selected from map
  React.useEffect(() => {
    if (selectedStandFromMap) {
      console.log('[ReservationModal] Stand selected from map:', {
        standIdFromMap: selectedStandFromMap,
        reservationStandId: standId,
        timestamp: new Date().toISOString()
      });
    }
  }, [selectedStandFromMap, standId]);

  // 🎯 DIRECT EVENT LISTENER - Listen for open-access-modal event from map
  React.useEffect(() => {
    const handleOpenModal = async (event: any) => {
      const standId = event.detail;
      console.log('[ReservationModal] Direct event listener triggered:', {
        standIdFromEvent: standId,
        timestamp: new Date().toISOString()
      });

      // 🔍 FORENSIC LEAD CAPTURE: Log the intent immediately in Neon
      try {
        const logResponse = await fetch('/api/admin/log-lead', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            stand_id: standId,
            action_type: 'CLICKED_RESERVE',
            timestamp: new Date().toISOString(),
          }),
        });

        if (logResponse.ok) {
          const logData = await logResponse.json();
          console.log('[ReservationModal] Forensic lead captured:', {
            leadLogId: logData.leadLogId,
            location: logData.location,
            standId: standId,
          });
        } else {
          console.warn('[ReservationModal] Forensic log failed (non-blocking):', logResponse.status);
        }
      } catch (err) {
        console.error('[ReservationModal] Forensic lead capture error (non-blocking):', err);
      }
    };

    // Listen for the map click event
    window.addEventListener('open-access-modal', handleOpenModal);

    return () => {
      window.removeEventListener('open-access-modal', handleOpenModal);
    };
  }, []);

  // Show toast notification
  const showToast = (type: 'success' | 'error', msg: string) => {
    setToast({ type, msg });
    setTimeout(() => setToast(null), 5000);
  };

  // Check if user can proceed (agreed to terms AND either uploaded proof OR selected pay later)
  const canConfirm = agreed && (uploadedProof || payLater);

  // Render modal at document.body level using React Portal - Desktop Visibility Fix
  return createPortal(
    <div className="fixed inset-0 z-[2147483647] flex items-center justify-center pointer-events-auto" style={{ display: 'flex', visibility: 'visible' }}>
      {/* Backdrop - Separate layer for click-to-close */}
      <div 
        className="absolute inset-0 bg-black/40 backdrop-blur-sm pointer-events-auto" 
        onClick={onClose}
        style={{ pointerEvents: 'all' }}
      />
      
      {/* Modal Content - Higher z-index than backdrop */}
      <div 
        className="relative z-[2147483648] bg-white rounded-3xl shadow-2xl p-8 w-full max-w-md md:max-w-lg max-h-[90vh] overflow-y-auto animate-in scale-95 duration-300 md:scale-100 pointer-events-auto" 
        onClick={(e) => e.stopPropagation()}
        style={{ pointerEvents: 'all', fontFamily: 'Inter, sans-serif' }}
      >
        <div className="flex justify-between items-center mb-6">
          <div className="flex items-center space-x-4">
            <h2 className="text-xl font-bold text-fcSlate uppercase tracking-widest">Reserve Stand</h2>
            {/* 72-Hour Timer Badge - Fixed Amber Element */}
            <div className="flex items-center space-x-2 px-3 py-1.5 bg-amber-50 border-2 border-amber-300 rounded-lg shadow-sm">
              <div className="w-1.5 h-1.5 bg-amber-500 rounded-full animate-pulse"></div>
              <span className="text-[9px] font-black text-amber-900 uppercase tracking-widest">72H Timer</span>
            </div>
          </div>
          <button onClick={onClose} className="p-2 text-gray-600 hover:text-fcSlate hover:bg-gray-50 rounded-full transition-all"><X size={20} /></button>
        </div>
        <div className="mb-6">
          <label className="block text-xs font-bold text-fcGold uppercase mb-3 tracking-wider">Assisting Agent</label>
          <input
            type="text"
            placeholder="Search agent..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full p-3 border-2 border-fcDivider rounded-lg mb-3 text-sm focus:border-fcGold focus:ring-2 focus:ring-fcGold/20 outline-none transition-all"
          />
          <div className="max-h-48 overflow-y-auto mb-2 space-y-1">
            {/* SELF / DIRECT - Always at top with prominence */}
            <div
              className={`p-3 rounded-lg cursor-pointer font-bold border-2 transition-all ${
                selectedAgent === null 
                  ? 'bg-fcGold text-white border-fcGold shadow-lg' 
                  : 'border-fcGold/30 hover:border-fcGold hover:bg-fcGold/5'
              }`}
              onClick={() => setSelectedAgent(null)}
            >
              <div className="flex items-center justify-between">
                <span className="uppercase tracking-wide text-sm">SELF / DIRECT</span>
                <span className="text-[9px] px-2 py-0.5 bg-white/20 rounded uppercase tracking-widest">Company Lead</span>
              </div>
            </div>
            
            {/* Agent List */}
            {filteredAgents.map(agent => (
              <div
                key={agent.id}
                className={`p-3 rounded-lg cursor-pointer transition-all ${
                  selectedAgent === agent.id 
                    ? 'bg-fcSlate text-white shadow-md' 
                    : 'hover:bg-white border border-transparent hover:border-slate-200'
                }`}
                onClick={() => setSelectedAgent(agent.id)}
              >
                <span className="text-sm">{agent.name}</span>
              </div>
            ))}
          </div>
        </div>
        
        {/* Document Review Section - Unified with Mobile */}
        <div className="mb-6 space-y-3">
          <div className="flex items-start gap-3 p-4 bg-white rounded-xl border border-blue-100">
            <FileText size={18} className="text-blue-600 shrink-0 mt-0.5" />
            <div>
              <h4 className="text-xs font-black text-blue-900 uppercase tracking-wider mb-1">
                Mandatory Legal Review
              </h4>
              <p className="text-[11px] text-blue-700 leading-relaxed">
                Please review all required documents before proceeding.
              </p>
            </div>
          </div>

          <div className="space-y-2">
            <p className="text-[10px] font-bold text-gray-600 uppercase tracking-widest">
              Required Documents:
            </p>
            
            <a 
              href="/legal/terms-and-conditions.pdf" 
              target="_blank" 
              rel="noopener noreferrer"
              className="flex items-center justify-between p-3 bg-gray-50 hover:bg-fcGold/5 rounded-lg border border-gray-200 hover:border-fcGold transition-all group"
              onClick={(e) => e.stopPropagation()}
            >
              <span className="flex items-center gap-2 text-sm text-fcSlate font-semibold">
                📄 Payment Terms
              </span>
              <span className="text-[9px] bg-white px-2.5 py-1 rounded border border-fcGold/30 font-bold uppercase tracking-widest text-fcGold group-hover:bg-fcGold group-hover:text-white transition-colors">
                READ PDF
              </span>
            </a>

            <a 
              href="/legal/refund-policy.pdf" 
              target="_blank" 
              rel="noopener noreferrer"
              className="flex items-center justify-between p-3 bg-gray-50 hover:bg-fcGold/5 rounded-lg border border-gray-200 hover:border-fcGold transition-all group"
              onClick={(e) => e.stopPropagation()}
            >
              <span className="flex items-center gap-2 text-sm text-fcSlate font-semibold">
                📄 Refund Policy
              </span>
              <span className="text-[9px] bg-white px-2.5 py-1 rounded border border-fcGold/30 font-bold uppercase tracking-widest text-fcGold group-hover:bg-fcGold group-hover:text-white transition-colors">
                READ PDF
              </span>
            </a>
          </div>
        </div>

        {/* Legal Consent Checkbox with Document Links */}
        <div className="mt-6 pt-4 border-t border-fcDivider">
          <label className="flex items-start space-x-3 cursor-pointer group">
            <input
              type="checkbox"
              checked={agreed}
              onChange={(e) => {
                e.stopPropagation(); // Forensic Event Isolation
                setAgreed(e.target.checked);
              }}
              className="w-5 h-5 border-2 border-fcGold rounded cursor-pointer accent-fcGold mt-0.5 shrink-0"
            />
            <span className="text-xs text-gray-600 leading-relaxed">
              I have reviewed and accept the{' '}
              <a 
                href="/legal/terms-and-conditions.pdf" 
                target="_blank" 
                rel="noopener noreferrer"
                className="text-fcGold hover:text-fcSlate font-bold underline decoration-2 underline-offset-2 transition-colors"
                onClick={(e) => e.stopPropagation()}
              >
                legal terms
              </a>
              {' '}and{' '}
              <a 
                href="/legal/refund-policy.pdf" 
                target="_blank" 
                rel="noopener noreferrer"
                className="text-fcGold hover:text-fcSlate font-bold underline decoration-2 underline-offset-2 transition-colors"
                onClick={(e) => e.stopPropagation()}
              >
                conditions
              </a>
              {' '}for this reservation.
            </span>
          </label>
        </div>

        {/* Attach Proof of Payment Section */}
        <div className="mt-6 pt-4 border-t border-fcDivider">
          <div className="mb-4">
            <h3 className="text-xs font-bold text-fcGold uppercase mb-2 tracking-wider">
              Attach Proof of Payment
            </h3>
            <p className="text-[11px] text-gray-600 leading-relaxed">
              Upload your payment receipt or select "Pay Later" to proceed with your reservation.
            </p>
          </div>

          {/* Pay Later Checkbox */}
          <div className="mb-4">
            <label className="flex items-start space-x-3 cursor-pointer group">
              <input
                type="checkbox"
                checked={payLater}
                onChange={(e) => {
                  e.stopPropagation();
                  setPayLater(e.target.checked);
                  if (e.target.checked) {
                    setUploadedProof(false); // Clear upload if pay later is selected
                  }
                }}
                className="w-5 h-5 border-2 border-fcGold rounded cursor-pointer accent-fcGold mt-0.5 shrink-0"
              />
              <span className="text-xs text-gray-600 leading-relaxed">
                <span className="font-bold text-fcSlate">Pay Later:</span> I will submit proof of payment within the 72-hour reservation window
              </span>
            </label>
          </div>

          {/* Upload Section - Only show if Pay Later is NOT checked */}
          {!payLater && (
            <UploadSection
              uploadType="proofOfPayment"
              reservationId={standId} // Temporary - will be replaced with actual reservationId after creation
              variant="dropzone"
              onUploadComplete={(result) => {
                setUploadedProof(true);
                showToast('success', `Payment proof uploaded: ${result.fileName}`);
                console.log('[RESERVATION_MODAL][UPLOAD_SUCCESS]', result);
              }}
              onUploadError={(error) => {
                setUploadedProof(false);
                showToast('error', `Upload failed: ${error.message}`);
                console.error('[RESERVATION_MODAL][UPLOAD_ERROR]', error);
              }}
            />
          )}

          {/* Upload Success Indicator */}
          {uploadedProof && !payLater && (
            <div className="mt-3 flex items-center gap-2 p-3 bg-green-50 border-2 border-green-500 rounded-lg">
              <CheckCircle2 size={18} className="text-green-600 shrink-0" />
              <span className="text-xs font-semibold text-green-800">
                Payment proof uploaded successfully
              </span>
            </div>
          )}
        </div>

        {/* Toast Notification */}
        {toast && (
          <div className={`fixed top-6 right-6 z-[2147483649] flex items-center space-x-3 px-5 py-3 rounded-xl shadow-2xl border animate-in slide-in-from-right-4 duration-300 ${
            toast.type === 'success' ? 'bg-fcGold text-white border-fcGold/30' : 'bg-red-600 text-white border-red-400'
          }`}>
            {toast.type === 'success' && <CheckCircle2 size={16} />}
            <span className="text-[10px] font-black uppercase tracking-widest leading-none">
              {toast.msg}
            </span>
          </div>
        )}

        {/* Confirm Button - Now requires terms agreement AND (proof upload OR pay later) */}
        <button
          disabled={!canConfirm}
          className={`w-full py-4 rounded-xl font-bold uppercase tracking-[0.2em] text-sm mt-6 transition-all shadow-lg ${
            !canConfirm 
              ? 'bg-gray-300 text-gray-500 cursor-not-allowed opacity-60' 
              : 'bg-fcGold text-white hover:bg-fcSlate hover:shadow-xl cursor-pointer active:scale-[0.98]'
          }`}
          onClick={(e) => {
            // Forensic Validation Guard
            if (!canConfirm) {
              e.preventDefault();
              e.stopPropagation();
              if (!agreed) {
                alert("⚠️ Verification Required: You must acknowledge the 72-hour policy and legal terms first.");
              } else if (!uploadedProof && !payLater) {
                alert("⚠️ Payment Required: Please upload proof of payment or select 'Pay Later' to proceed.");
              }
              return;
            }
            // Forensic Save with company lead flag
            const isCompanyLead = selectedAgent === null;
            console.log('[FORENSIC][RESERVATION_CONSENT]', {
              stand_id: standId,
              agent_id: selectedAgent,
              is_company_lead: isCompanyLead,
              payment_uploaded: uploadedProof,
              pay_later: payLater,
              terms_accepted_at: new Date().toISOString(),
              expires_at: new Date(Date.now() + 72 * 60 * 60 * 1000).toISOString()
            });
            onConfirm(selectedAgent);
          }}
        >
          Confirm 72H Reservation
        </button>
      </div>
    </div>,
    document.body
  );
};
