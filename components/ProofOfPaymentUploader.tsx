/**
 * Proof of Payment (POP) Uploader Component
 * 
 * Secure file upload for bank transfers, RTGS, and cash payments.
 * Pauses the 72-hour timer and triggers admin verification workflow.
 */

import React, { useState } from 'react';
import { Upload, FileText, CheckCircle, AlertCircle, X } from 'lucide-react';

interface ProofOfPaymentUploaderProps {
  reservationId: string;
  standId: string;
  standNumber: string;
  branchId: string;
  amount: number;
  onUploadSuccess?: () => void;
}

export const ProofOfPaymentUploader: React.FC<ProofOfPaymentUploaderProps> = ({
  reservationId,
  standId,
  standNumber,
  branchId,
  amount,
  onUploadSuccess
}) => {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadSuccess, setUploadSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<'bank_transfer' | 'rtgs' | 'cash'>('bank_transfer');

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    
    if (!file) return;

    // Validate file type
    const validTypes = ['application/pdf', 'image/jpeg', 'image/jpg', 'image/png'];
    if (!validTypes.includes(file.type)) {
      setError('Please upload a PDF, JPG, or PNG file');
      return;
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      setError('File size must be less than 5MB');
      return;
    }

    setSelectedFile(file);
    setError(null);

    console.log('[FORENSIC][POP_FILE_SELECTED]', {
      reservation_id: reservationId,
      stand_id: standId,
      file_name: file.name,
      file_size: file.size,
      file_type: file.type,
      timestamp: new Date().toISOString()
    });
  };

  const handleUpload = async () => {
    if (!selectedFile) {
      setError('Please select a file first');
      return;
    }

    setUploading(true);
    setError(null);

    console.log('[FORENSIC][POP_UPLOAD_START]', {
      reservation_id: reservationId,
      stand_id: standId,
      stand_number: standNumber,
      branch_id: branchId,
      payment_method: paymentMethod,
      amount,
      file_name: selectedFile.name,
      timestamp: new Date().toISOString()
    });

    try {
      // TODO: Implement Supabase Storage upload
      // const fileName = `${standId}_POP_${Date.now()}.${selectedFile.name.split('.').pop()}`;
      // const filePath = `payment-proofs/${branchId}/${fileName}`;
      
      // const { data: uploadData, error: uploadError } = await supabase.storage
      //   .from('payment-proofs')
      //   .upload(filePath, selectedFile, {
      //     cacheControl: '3600',
      //     upsert: false
      //   });

      // if (uploadError) throw uploadError;

      // Update reservation status to "Awaiting Verification"
      // const { error: updateError } = await supabase
      //   .from('reservations')
      //   .update({
      //     status: 'Payment Pending Verification',
      //     payment_method: paymentMethod,
      //     payment_proof_url: uploadData.path,
      //     payment_uploaded_at: new Date().toISOString(),
      //     timer_paused: true
      //   })
      //   .eq('id', reservationId);

      // if (updateError) throw updateError;

      // Trigger admin notification
      // await triggerAdminNotification({
      //   type: 'payment_verification_needed',
      //   reservation_id: reservationId,
      //   branch_id: branchId,
      //   stand_number: standNumber,
      //   amount,
      //   payment_method: paymentMethod
      // });

      // Mock success for development
      await new Promise(resolve => setTimeout(resolve, 1500));

      setUploadSuccess(true);
      setUploading(false);

      console.log('[FORENSIC][POP_UPLOAD_SUCCESS]', {
        reservation_id: reservationId,
        stand_id: standId,
        payment_method: paymentMethod,
        status: 'Payment Pending Verification',
        timer_paused: true,
        timestamp: new Date().toISOString()
      });

      if (onUploadSuccess) {
        onUploadSuccess();
      }
    } catch (err) {
      console.error('[FORENSIC][POP_UPLOAD_ERROR]', {
        reservation_id: reservationId,
        error: err instanceof Error ? err.message : 'Unknown error',
        timestamp: new Date().toISOString()
      });

      setError(err instanceof Error ? err.message : 'Upload failed. Please try again.');
      setUploading(false);
    }
  };

  const handleRemoveFile = () => {
    setSelectedFile(null);
    setError(null);
    setUploadSuccess(false);
  };

  if (uploadSuccess) {
    return (
      <div className="bg-green-50 border-2 border-green-500 rounded-lg p-6">
        <div className="flex items-start gap-4">
          <CheckCircle className="text-green-600 shrink-0" size={24} />
          <div className="flex-1">
            <h3 className="font-semibold text-green-900 mb-2">
              Payment Proof Uploaded Successfully
            </h3>
            <p className="text-sm text-green-700 mb-4">
              Your payment proof has been received. The 72-hour timer has been paused.
              Our {branchId === 'harare' ? 'Harare' : 'Bulawayo'} team will verify your payment within 24 hours.
            </p>
            <div className="bg-white rounded p-3 text-xs text-gray-600">
              <strong>Status:</strong> Payment Pending Verification<br />
              <strong>Reference:</strong> {standNumber}_{Date.now().toString().slice(-6)}<br />
              <strong>Uploaded:</strong> {new Date().toLocaleString('en-ZW')}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white border-2 border-gray-200 rounded-lg p-6">
      <div className="mb-6">
        <h3 className="font-semibold text-gray-900 mb-2">
          Upload Proof of Payment
        </h3>
        <p className="text-sm text-gray-600">
          Paid via bank transfer, RTGS, or cash? Upload your proof to pause the timer.
        </p>
      </div>

      {/* Payment Method Selection */}
      <div className="mb-6">
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Payment Method
        </label>
        <div className="grid grid-cols-3 gap-2">
          <button
            onClick={() => setPaymentMethod('bank_transfer')}
            className={`px-4 py-2 rounded border-2 text-sm font-medium transition-colors ${
              paymentMethod === 'bank_transfer'
                ? 'border-emerald-500 bg-emerald-50 text-emerald-700'
                : 'border-gray-300 bg-white text-gray-700 hover:border-gray-400'
            }`}
          >
            Bank Transfer
          </button>
          <button
            onClick={() => setPaymentMethod('rtgs')}
            className={`px-4 py-2 rounded border-2 text-sm font-medium transition-colors ${
              paymentMethod === 'rtgs'
                ? 'border-emerald-500 bg-emerald-50 text-emerald-700'
                : 'border-gray-300 bg-white text-gray-700 hover:border-gray-400'
            }`}
          >
            RTGS
          </button>
          <button
            onClick={() => setPaymentMethod('cash')}
            className={`px-4 py-2 rounded border-2 text-sm font-medium transition-colors ${
              paymentMethod === 'cash'
                ? 'border-emerald-500 bg-emerald-50 text-emerald-700'
                : 'border-gray-300 bg-white text-gray-700 hover:border-gray-400'
            }`}
          >
            Cash
          </button>
        </div>
      </div>

      {/* File Upload Area */}
      <div className="mb-6">
        <label
          htmlFor="pop-file-input"
          className={`
            flex flex-col items-center justify-center
            border-2 border-dashed rounded-lg p-8
            cursor-pointer transition-colors
            ${selectedFile ? 'border-emerald-500 bg-emerald-50' : 'border-gray-300 bg-gray-50 hover:border-gray-400'}
          `}
        >
          {selectedFile ? (
            <div className="flex items-center gap-3">
              <FileText className="text-emerald-600" size={32} />
              <div className="text-left">
                <p className="font-medium text-emerald-900">
                  {selectedFile.name}
                </p>
                <p className="text-sm text-emerald-600">
                  {(selectedFile.size / 1024).toFixed(2)} KB
                </p>
              </div>
              <button
                onClick={(e) => {
                  e.preventDefault();
                  handleRemoveFile();
                }}
                className="ml-4 p-1 hover:bg-emerald-200 rounded"
              >
                <X size={20} className="text-emerald-700" />
              </button>
            </div>
          ) : (
            <>
              <Upload className="text-gray-400 mb-3" size={40} />
              <p className="text-sm font-medium text-gray-700 mb-1">
                Click to upload or drag and drop
              </p>
              <p className="text-xs text-gray-500">
                PDF, JPG, or PNG (Max 5MB)
              </p>
            </>
          )}
        </label>
        <input
          id="pop-file-input"
          type="file"
          accept=".pdf,.jpg,.jpeg,.png"
          onChange={handleFileSelect}
          className="hidden"
        />
      </div>

      {/* Error Message */}
      {error && (
        <div className="mb-4 flex items-center gap-2 text-red-600 bg-red-50 p-3 rounded">
          <AlertCircle size={20} />
          <p className="text-sm">{error}</p>
        </div>
      )}

      {/* Upload Button */}
      <button
        onClick={handleUpload}
        disabled={!selectedFile || uploading}
        className={`
          w-full py-3 px-4 rounded font-semibold transition-colors
          ${selectedFile && !uploading
            ? 'bg-emerald-600 hover:bg-emerald-700 text-white'
            : 'bg-gray-300 text-gray-500 cursor-not-allowed'
          }
        `}
      >
        {uploading ? (
          <span className="flex items-center justify-center gap-2">
            <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent" />
            Uploading & Pausing Timer...
          </span>
        ) : (
          'Upload & Pause Timer'
        )}
      </button>

      {/* Info Box */}
      <div className="mt-4 bg-amber-50 border border-amber-200 rounded p-3">
        <p className="text-xs text-amber-800">
          <strong>Note:</strong> Once uploaded, your 72-hour timer will pause immediately. 
          Admin verification typically takes 12-24 hours.
        </p>
      </div>
    </div>
  );
};
