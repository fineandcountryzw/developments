/**
 * UploadSection Component
 * 
 * Multi-purpose file upload component for Fine & Country Zimbabwe ERP.
 * Supports property images and proof of payment uploads with UploadThing.
 * 
 * Features:
 * - Fine & Country themed styling (charcoal border, gold accents)
 * - Success feedback with file name display
 * - Automatic metadata passing (standId or reservationId)
 * - Both button and dropzone UI options
 */

'use client';

import { useState } from 'react';
import { UploadButton, UploadDropzone } from '@uploadthing/react';
import type { OurFileRouter } from '@/app/api/uploadthing/core';
import { CheckCircle, Upload, AlertCircle } from 'lucide-react';

// ─────────────────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────────────────

type UploadType = 'propertyImage' | 'proofOfPayment';

interface UploadSectionProps {
  /** Upload type: 'propertyImage' or 'proofOfPayment' */
  uploadType: UploadType;
  
  /** Stand ID for property image uploads */
  standId?: string;
  
  /** Reservation ID for proof of payment uploads */
  reservationId?: string;
  
  /** UI variant: 'button' or 'dropzone' */
  variant?: 'button' | 'dropzone';
  
  /** Callback fired when upload completes successfully */
  onUploadComplete?: (result: UploadResult) => void;
  
  /** Callback fired when upload fails */
  onUploadError?: (error: Error) => void;
}

interface UploadResult {
  success: boolean;
  fileName: string;
  fileUrl: string;
  standId?: string;
  standNumber?: string;
  reservationId?: string;
  developmentName?: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// COMPONENT
// ─────────────────────────────────────────────────────────────────────────────

export default function UploadSection({
  uploadType,
  standId,
  reservationId,
  variant = 'dropzone',
  onUploadComplete,
  onUploadError,
}: UploadSectionProps) {
  const [uploadSuccess, setUploadSuccess] = useState<UploadResult | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);

  // Validate required props based on upload type
  if (uploadType === 'propertyImage' && !standId) {
    console.error('[UPLOAD_SECTION][ERROR] standId is required for propertyImage uploads');
    return (
      <div className="rounded-lg border-2 border-red-500 bg-red-50 p-4">
        <div className="flex items-center gap-2 text-red-700">
          <AlertCircle className="h-5 w-5" />
          <span className="font-semibold">Configuration Error</span>
        </div>
        <p className="mt-1 text-sm text-red-600">
          standId is required for property image uploads
        </p>
      </div>
    );
  }

  if (uploadType === 'proofOfPayment' && !reservationId) {
    console.error('[UPLOAD_SECTION][ERROR] reservationId is required for proofOfPayment uploads');
    return (
      <div className="rounded-lg border-2 border-red-500 bg-red-50 p-4">
        <div className="flex items-center gap-2 text-red-700">
          <AlertCircle className="h-5 w-5" />
          <span className="font-semibold">Configuration Error</span>
        </div>
        <p className="mt-1 text-sm text-red-600">
          reservationId is required for proof of payment uploads
        </p>
      </div>
    );
  }

  // Determine metadata to pass to backend
  const metadata = uploadType === 'propertyImage' 
    ? { standId: standId! }
    : { reservationId: reservationId! };

  // Upload complete handler
  const handleUploadComplete = (res: any) => {
    setIsUploading(false);
    
    if (res && res[0]) {
      const file = res[0];
      const serverData = file.serverData || {};
      
      const result: UploadResult = {
        success: true,
        fileName: file.name,
        fileUrl: file.url,
        standId: serverData.standId,
        standNumber: serverData.standNumber,
        reservationId: serverData.reservationId,
        developmentName: serverData.developmentName,
      };
      
      setUploadSuccess(result);
      setUploadError(null);
      
      console.log('[UPLOAD_SECTION][SUCCESS]', {
        upload_type: uploadType,
        file_name: file.name,
        file_url: file.url,
        ...serverData,
      });
      
      onUploadComplete?.(result);
    }
  };

  // Upload error handler
  const handleUploadError = (error: Error) => {
    setIsUploading(false);
    setUploadError(error.message);
    setUploadSuccess(null);
    
    console.error('[UPLOAD_SECTION][ERROR]', {
      upload_type: uploadType,
      error: error.message,
    });
    
    onUploadError?.(error);
  };

  // Upload begin handler
  const handleUploadBegin = () => {
    setIsUploading(true);
    setUploadError(null);
    setUploadSuccess(null);
  };

  // Get upload configuration labels
  const config = {
    propertyImage: {
      title: 'Upload Property Image',
      description: 'Upload a map or image of the property stand (max 4MB)',
      acceptedTypes: 'Images (JPEG, PNG, WebP)',
    },
    proofOfPayment: {
      title: 'Upload Proof of Payment',
      description: 'Upload payment verification document (max 2MB)',
      acceptedTypes: 'PDF or Images (JPEG, PNG)',
    },
  }[uploadType];

  return (
    <div className="space-y-4">
      {/* Header */}
      <div>
        <h3 className="text-lg font-semibold text-fcSlate">{config.title}</h3>
        <p className="mt-1 text-sm text-gray-600">{config.description}</p>
        <p className="mt-0.5 text-xs text-gray-500">{config.acceptedTypes}</p>
      </div>

      {/* Upload UI */}
      {variant === 'button' ? (
        <div className="flex items-center gap-3">
          <UploadButton<OurFileRouter, typeof uploadType>
            endpoint={uploadType}
            onClientUploadComplete={handleUploadComplete}
            onUploadError={handleUploadError}
            onUploadBegin={handleUploadBegin}
            onBeforeUploadBegin={(files) => {
              // Inject metadata into file metadata
              return files.map((file) => {
                const customFile = file as any;
                customFile.customMetadata = metadata;
                return customFile;
              });
            }}
            appearance={{
              button: 
                'ut-ready:bg-fcGold ut-uploading:cursor-not-allowed ut-uploading:bg-fcGold/50 ' +
                'bg-fcGold hover:bg-fcGold/90 ut-button:text-white ut-button:font-semibold ' +
                'ut-button:px-6 ut-button:py-2.5 ut-button:rounded-lg ut-button:transition-all ' +
                'ut-button:border-2 ut-button:border-fcSlate/20 focus:outline-none focus:ring-2 ' +
                'focus:ring-fcGold focus:ring-offset-2',
              allowedContent: 'text-sm text-gray-600',
            }}
          />
          {isUploading && (
            <div className="flex items-center gap-2 text-sm text-fcGold">
              <div className="h-4 w-4 animate-spin rounded-full border-2 border-fcGold border-t-transparent" />
              <span className="font-medium">Uploading...</span>
            </div>
          )}
        </div>
      ) : (
        <UploadDropzone<OurFileRouter, typeof uploadType>
          endpoint={uploadType}
          onClientUploadComplete={handleUploadComplete}
          onUploadError={handleUploadError}
          onUploadBegin={handleUploadBegin}
          onBeforeUploadBegin={(files) => {
            // Inject metadata into file metadata
            return files.map((file) => {
              const customFile = file as any;
              customFile.customMetadata = metadata;
              return customFile;
            });
          }}
          appearance={{
            container: 
              'border-2 border-dashed border-fcSlate/30 rounded-lg bg-white ' +
              'hover:border-fcGold/50 transition-colors duration-200 ' +
              'ut-uploading:border-fcGold ut-uploading:bg-fcGold/5',
            uploadIcon: 'text-fcGold',
            label: 'text-fcSlate font-medium hover:text-fcGold transition-colors',
            allowedContent: 'text-sm text-gray-600',
            button: 
              'ut-ready:bg-fcGold ut-uploading:cursor-not-allowed ut-uploading:bg-fcGold/50 ' +
              'bg-fcGold hover:bg-fcGold/90 text-white font-semibold px-6 py-2.5 rounded-lg ' +
              'transition-all border-2 border-fcSlate/20 focus:outline-none focus:ring-2 ' +
              'focus:ring-fcGold focus:ring-offset-2',
          }}
          content={{
            uploadIcon: () => (
              <Upload className="h-12 w-12 text-fcGold" />
            ),
            label: ({ ready, isUploading: uploading }) => {
              if (uploading) return 'Uploading...';
              if (ready) return 'Click or drag & drop to upload';
              return 'Loading...';
            },
          }}
        />
      )}

      {/* Success Message */}
      {uploadSuccess && (
        <div className="rounded-lg border-2 border-green-500 bg-green-50 p-4 animate-in fade-in slide-in-from-top-2 duration-300">
          <div className="flex items-start gap-3">
            <CheckCircle className="h-5 w-5 text-green-600 mt-0.5 flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <h4 className="font-semibold text-green-800">Upload Successful!</h4>
              <p className="mt-1 text-sm text-green-700">
                File: <span className="font-medium break-all">{uploadSuccess.fileName}</span>
              </p>
              {uploadSuccess.developmentName && uploadSuccess.standNumber && (
                <p className="mt-1 text-sm text-green-700">
                  Updated: {uploadSuccess.developmentName} - Stand {uploadSuccess.standNumber}
                </p>
              )}
              <a 
                href={uploadSuccess.fileUrl} 
                target="_blank" 
                rel="noopener noreferrer"
                className="mt-2 inline-flex items-center text-sm font-medium text-green-700 hover:text-green-800 underline"
              >
                View uploaded file →
              </a>
            </div>
          </div>
        </div>
      )}

      {/* Error Message */}
      {uploadError && (
        <div className="rounded-lg border-2 border-red-500 bg-red-50 p-4 animate-in fade-in slide-in-from-top-2 duration-300">
          <div className="flex items-start gap-3">
            <AlertCircle className="h-5 w-5 text-red-600 mt-0.5 flex-shrink-0" />
            <div className="flex-1">
              <h4 className="font-semibold text-red-800">Upload Failed</h4>
              <p className="mt-1 text-sm text-red-700">{uploadError}</p>
              <p className="mt-2 text-xs text-red-600">
                Please try again or contact support if the problem persists.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
