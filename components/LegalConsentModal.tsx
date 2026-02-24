import React, { useState } from 'react';
import { X, FileText, AlertCircle, CheckCircle2, ExternalLink } from 'lucide-react';
import { Development, Branch } from '../types';
import { downloadLegalDocument } from '../services/pdfService';

interface LegalConsentModalProps {
  development: Development;
  onClose: () => void;
  onConfirm: () => void;
}

export const LegalConsentModal: React.FC<LegalConsentModalProps> = ({ development, onClose, onConfirm }) => {
  // 1. Initial State - Forensic Legal Consent Pattern
  const [agreed, setAgreed] = useState(false);
  const [hasAcceptedTerms, setHasAcceptedTerms] = useState(false);

  const branchName = development.branch === 'Harare' ? 'Harare HQ' : 'Bulawayo Branch';

  return (
    <div className="fixed inset-0 z-[300] flex items-center justify-center p-6">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-md animate-in fade-in duration-300" onClick={onClose} />
      <div className="relative bg-white w-full max-w-2xl rounded-[32px] shadow-forensic-lg overflow-hidden animate-in zoom-in-95 duration-300 border border-brand-gold/20">
        
        {/* Header */}
        <div className="bg-gradient-to-br from-brand-gold/5 to-white p-10 border-b border-brand-gold/10">
          <div className="flex items-start justify-between">
            <div className="flex items-start space-x-4">
              <div className="p-3 bg-brand-gold/10 text-brand-gold rounded-2xl">
                <FileText size={28} />
              </div>
              <div className="flex-1">
                <h3 className="text-2xl font-black text-brand-black tracking-tight font-sans uppercase">Legal Acknowledgement</h3>
                <p className="text-xs text-brand-grey font-bold uppercase tracking-widest mt-2 font-sans">
                  {development.name} • {branchName}
                </p>
              </div>
            </div>
            <div className="flex items-center space-x-3">
              {/* 72-Hour Timer Badge - Forensic Urgency */}
              <div className="flex items-center space-x-2 px-4 py-2 bg-amber-50 border-2 border-amber-200 rounded-xl">
                <div className="w-2 h-2 bg-amber-500 rounded-full animate-pulse"></div>
                <span className="text-[10px] font-black text-amber-900 uppercase tracking-widest font-sans">72H Timer Starts on Confirm</span>
              </div>
              <button
                onClick={onClose}
                className="p-2 text-brand-grey hover:text-brand-black hover:bg-white rounded-xl transition-all"
              >
                <X size={20} />
              </button>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="p-10 space-y-8">
          
          {/* Info Alert */}
          <div className="flex items-start space-x-4 p-6 bg-amber-50 rounded-2xl border border-amber-100">
            <AlertCircle size={24} className="text-amber-600 shrink-0 mt-0.5" />
            <div className="flex-1">
              <h4 className="text-sm font-black text-amber-900 uppercase tracking-tight font-sans mb-2">
                Mandatory Legal Review
              </h4>
              <p className="text-xs text-amber-700 font-medium leading-relaxed font-sans">
                Before proceeding with your reservation, you must review and accept the following legal documents. 
                These documents outline your rights, obligations, and the terms governing this transaction.
              </p>
            </div>
          </div>

          {/* Document Links */}
          <div className="space-y-4">
            <h4 className="text-xs font-black text-gray-600 uppercase tracking-widest font-sans">
              Required Documents
            </h4>

            {/* Refund Policy */}
            {development.refundPolicyUrl ? (
              <button
                type="button"
                onClick={() => downloadLegalDocument(development.refundPolicyUrl!, `${development.name}_Refund_Policy.pdf`)}
                className="w-full flex items-center justify-between p-6 bg-white hover:bg-gray-50 rounded-2xl border border-brand-gold/10 hover:border-brand-gold/50 transition-all group cursor-pointer"
              >
                <div className="flex items-center space-x-4">
                  <div className="p-3 bg-white rounded-xl border border-brand-gold/10 group-hover:border-brand-gold/30 transition-all">
                    <FileText size={24} className="text-brand-gold" />
                  </div>
                  <div>
                    <div className="text-sm font-black text-brand-black font-sans group-hover:underline group-hover:text-brand-gold transition-all">Refund Policy</div>
                    <div className="text-[10px] text-brand-grey font-bold uppercase tracking-widest font-sans mt-1">
                      Click to download • PDF Document
                    </div>
                  </div>
                </div>
                <ExternalLink size={18} className="text-brand-grey group-hover:text-brand-gold transition-all" />
              </button>
            ) : (
              <div className="flex items-center space-x-4 p-6 bg-white rounded-2xl border border-dashed border-brand-gold/20 opacity-50">
                <FileText size={24} className="text-brand-grey" />
                <div className="text-xs font-bold text-brand-grey uppercase tracking-widest font-sans">
                  Refund Policy - Not Available
                </div>
              </div>
            )}

            {/* Payment Terms */}
            {development.paymentTermsUrl ? (
              <button
                type="button"
                onClick={() => downloadLegalDocument(development.paymentTermsUrl!, `${development.name}_Payment_Terms.pdf`)}
                className="w-full flex items-center justify-between p-6 bg-white hover:bg-gray-50 rounded-2xl border border-brand-gold/10 hover:border-brand-gold/50 transition-all group cursor-pointer"
              >
                <div className="flex items-center space-x-4">
                  <div className="p-3 bg-white rounded-xl border border-brand-gold/10 group-hover:border-brand-gold/30 transition-all">
                    <FileText size={24} className="text-brand-gold" />
                  </div>
                  <div>
                    <div className="text-sm font-black text-brand-black font-sans group-hover:underline group-hover:text-brand-gold transition-all">Payment Terms & Conditions</div>
                    <div className="text-[10px] text-brand-grey font-bold uppercase tracking-widest font-sans mt-1">
                      Click to download • PDF Document
                    </div>
                  </div>
                </div>
                <ExternalLink size={18} className="text-brand-grey group-hover:text-brand-gold transition-all" />
              </button>
            ) : (
              <div className="flex items-center space-x-4 p-6 bg-white rounded-2xl border border-dashed border-brand-gold/20 opacity-50">
                <FileText size={24} className="text-brand-grey" />
                <div className="text-xs font-bold text-brand-grey uppercase tracking-widest font-sans">
                  Payment Terms - Not Available
                </div>
              </div>
            )}
          </div>

          {/* Consent Checkbox */}
          <div className="pt-6 border-t border-brand-gold/10">
            <label className="flex items-start space-x-4 cursor-pointer group">
              <div className="relative flex items-center justify-center shrink-0">
                <input
                  type="checkbox"
                  checked={agreed}
                  onChange={(e) => {
                    e.stopPropagation(); // Forensic Event Isolation
                    const isChecked = e.target.checked;
                    setAgreed(isChecked);
                    setHasAcceptedTerms(isChecked);
                  }}
                  className="w-6 h-6 border-2 border-brand-gold rounded cursor-pointer accent-brand-gold"
                />
              </div>
              <div className="flex-1">
                <p className="text-sm font-bold text-brand-black leading-relaxed font-sans">
                  I have read and agree to the Refund Policy and Payment Terms & Conditions for{' '}
                  <span className="text-brand-gold font-black">{development.name}</span>.
                </p>
                <p className="text-[10px] text-brand-grey font-medium mt-2 font-sans">
                  By checking this box, you acknowledge that you understand and accept all terms outlined in the legal documents above. 
                  This acceptance will be recorded with a timestamp for audit purposes.
                </p>
              </div>
            </label>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center space-x-4 pt-4">
            <button
              onClick={onClose}
              className="flex-1 bg-brand-light text-brand-black px-6 py-4 rounded-xl text-xs font-bold uppercase tracking-widest hover:bg-brand-gold/10 transition-all font-sans"
            >
              Cancel
            </button>
            <button
              onClick={(e) => {
                // Forensic Validation Guard - Prevent Enter Key Bypass
                if (!agreed) {
                  e.preventDefault();
                  e.stopPropagation();
                  alert("⚠️ You must acknowledge the legal terms first. Please review and check the consent box above.");
                  return;
                }
                // 2. The Logic Gate - Forensic Legal Consent Pattern
                // 3. The Forensic Save - Timestamp recorded in parent component
                // Parent will save: terms_accepted_at: new Date().toISOString()
                console.log('[FORENSIC][LEGAL_CONSENT]', {
                  development: development.name,
                  terms_accepted_at: new Date().toISOString(),
                  consent_recorded: true
                });
                onConfirm();
              }}
              disabled={!agreed}
              className={`flex-1 px-6 py-4 rounded-xl text-xs font-bold uppercase tracking-widest transition-all shadow-forensic font-sans flex items-center justify-center space-x-2 ${
                !agreed 
                  ? 'bg-brand-grey cursor-not-allowed opacity-30' 
                  : 'bg-brand-gold text-white hover:opacity-90 cursor-pointer'
              }`}
            >
              {agreed ? (
                <>
                  <CheckCircle2 size={16} />
                  <span>Confirm Reservation</span>
                </>
              ) : (
                <span>Accept Terms to Continue</span>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
