/**
 * Forensic Attachment Viewer Component
 * 
 * Modal component for viewing payment proofs and property images.
 * Automatically detects file type and renders appropriate viewer.
 * 
 * Features:
 * - PDF rendering via iframe
 * - Image display with object-fit contain
 * - Forensic logging for audit trail
 * - Download and external link options
 * - Keyboard accessibility (ESC to close)
 */

'use client';

import React, { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X, Download, ExternalLink, FileText, Image as ImageIcon } from 'lucide-react';

// ─────────────────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────────────────

interface AttachmentViewerProps {
  /** URL of the attachment to view */
  url: string;
  
  /** Display name/title for the attachment */
  title?: string;
  
  /** Callback when modal is closed */
  onClose: () => void;
  
  /** Optional metadata for forensic logging */
  metadata?: {
    reservationId?: string;
    standId?: string;
    clientEmail?: string;
    uploadedBy?: string;
  };
}

type FileType = 'pdf' | 'image' | 'unknown';

// ─────────────────────────────────────────────────────────────────────────────
// UTILITY FUNCTIONS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Detect File Type from URL
 * 
 * Determines if the URL is a PDF, image, or unknown file type.
 * Uses file extension and content-type detection.
 */
function detectFileType(url: string): FileType {
  const urlLower = url.toLowerCase();
  
  // PDF detection
  if (urlLower.endsWith('.pdf')) {
    return 'pdf';
  }
  
  // Image detection
  const imageExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp', '.svg'];
  if (imageExtensions.some(ext => urlLower.endsWith(ext))) {
    return 'image';
  }
  
  // Check for common image hosting patterns (UploadThing, etc.)
  if (urlLower.includes('/image/') || urlLower.includes('image-')) {
    return 'image';
  }
  
  return 'unknown';
}

/**
 * Get File Name from URL
 * 
 * Extracts the filename from the URL for display and download.
 */
function getFileName(url: string): string {
  try {
    const urlObj = new URL(url);
    const pathname = urlObj.pathname;
    const segments = pathname.split('/');
    return segments[segments.length - 1] || 'attachment';
  } catch {
    return 'attachment';
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// COMPONENT
// ─────────────────────────────────────────────────────────────────────────────

export default function AttachmentViewer({
  url,
  title,
  onClose,
  metadata = {},
}: AttachmentViewerProps) {
  const fileType = detectFileType(url);
  const fileName = getFileName(url);
  
  // Forensic logging on mount
  useEffect(() => {
    console.log('[ATTACHMENT_VIEWER][OPENED]', {
      url,
      file_type: fileType,
      file_name: fileName,
      title,
      reservation_id: metadata.reservationId,
      stand_id: metadata.standId,
      client_email: metadata.clientEmail,
      uploaded_by: metadata.uploadedBy,
      timestamp: new Date().toISOString(),
    });
    
    return () => {
      console.log('[ATTACHMENT_VIEWER][CLOSED]', {
        url,
        file_type: fileType,
        timestamp: new Date().toISOString(),
      });
    };
  }, [url, fileType, fileName, title, metadata]);
  
  // Handle ESC key to close
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [onClose]);
  
  // Handle download
  const handleDownload = async () => {
    try {
      console.log('[ATTACHMENT_VIEWER][DOWNLOAD_STARTED]', {
        url,
        file_name: fileName,
        timestamp: new Date().toISOString(),
      });
      
      const response = await fetch(url);
      const blob = await response.blob();
      const blobUrl = window.URL.createObjectURL(blob);
      
      const link = document.createElement('a');
      link.href = blobUrl;
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      window.URL.revokeObjectURL(blobUrl);
      
      console.log('[ATTACHMENT_VIEWER][DOWNLOAD_SUCCESS]', {
        file_name: fileName,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      console.error('[ATTACHMENT_VIEWER][DOWNLOAD_ERROR]', {
        url,
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString(),
      });
    }
  };
  
  // Handle open in new tab
  const handleOpenInNewTab = () => {
    console.log('[ATTACHMENT_VIEWER][EXTERNAL_LINK]', {
      url,
      timestamp: new Date().toISOString(),
    });
    window.open(url, '_blank', 'noopener,noreferrer');
  };
  
  // Render appropriate viewer based on file type
  const renderViewer = () => {
    switch (fileType) {
      case 'pdf':
        return (
          <div className="w-full h-full bg-gray-100">
            <iframe
              src={url}
              className="w-full h-full border-0"
              title={title || 'PDF Document'}
            />
          </div>
        );
      
      case 'image':
        return (
          <div className="w-full h-full flex items-center justify-center bg-white p-4">
            <img
              src={url}
              alt={title || 'Attachment'}
              className="max-w-full max-h-full object-contain"
              style={{ objectFit: 'contain' }}
            />
          </div>
        );
      
      case 'unknown':
      default:
        return (
          <div className="w-full h-full flex items-center justify-center bg-gray-100 p-8">
            <div className="text-center">
              <div className="inline-flex items-center justify-center w-16 h-16 bg-fcGold/10 rounded-full mb-4">
                <FileText size={32} className="text-fcGold" />
              </div>
              <h3 className="text-lg font-bold text-fcSlate mb-2">
                Preview Not Available
              </h3>
              <p className="text-sm text-gray-600 mb-6">
                This file type cannot be previewed in the browser.
              </p>
              <div className="flex items-center justify-center gap-3">
                <button
                  onClick={handleDownload}
                  className="flex items-center gap-2 px-4 py-2 bg-fcGold text-white rounded-lg hover:bg-fcSlate transition-colors"
                >
                  <Download size={16} />
                  Download File
                </button>
                <button
                  onClick={handleOpenInNewTab}
                  className="flex items-center gap-2 px-4 py-2 bg-white border-2 border-fcGold text-fcGold rounded-lg hover:bg-fcGold hover:text-white transition-colors"
                >
                  <ExternalLink size={16} />
                  Open in New Tab
                </button>
              </div>
            </div>
          </div>
        );
    }
  };
  
  // Get icon based on file type
  const getFileIcon = () => {
    switch (fileType) {
      case 'pdf':
        return <FileText size={24} className="text-fcGold" />;
      case 'image':
        return <ImageIcon size={24} className="text-fcGold" />;
      default:
        return <FileText size={24} className="text-fcGold" />;
    }
  };
  
  // Render modal using React Portal
  return createPortal(
    <div className="fixed inset-0 z-[2000] flex items-center justify-center">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
        onClick={onClose}
      />
      
      {/* Modal */}
      <div 
        className="relative z-[2001] bg-white rounded-2xl shadow-2xl w-[95vw] h-[95vh] max-w-7xl flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-300"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b-2 border-fcDivider bg-white">
          <div className="flex items-center gap-3">
            {getFileIcon()}
            <div>
              <h2 className="text-lg font-bold text-fcSlate uppercase tracking-wider">
                {title || 'Attachment Viewer'}
              </h2>
              <p className="text-xs text-gray-600 mt-0.5">{fileName}</p>
            </div>
          </div>
          
          {/* Actions */}
          <div className="flex items-center gap-2">
            <button
              onClick={handleDownload}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              title="Download"
            >
              <Download size={20} className="text-gray-600" />
            </button>
            <button
              onClick={handleOpenInNewTab}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              title="Open in New Tab"
            >
              <ExternalLink size={20} className="text-gray-600" />
            </button>
            <button
              onClick={onClose}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              title="Close (ESC)"
            >
              <X size={20} className="text-gray-600" />
            </button>
          </div>
        </div>
        
        {/* Viewer Content */}
        <div className="flex-1 overflow-hidden">
          {renderViewer()}
        </div>
        
        {/* Footer */}
        <div className="px-6 py-4 border-t-2 border-fcDivider bg-gray-50">
          <div className="flex items-center justify-between">
            {/* Metadata */}
            <div className="text-xs text-gray-600">
              {metadata.clientEmail && (
                <span className="font-semibold">Client: {metadata.clientEmail}</span>
              )}
              {metadata.reservationId && (
                <span className="ml-4 text-gray-500">
                  Reservation: {metadata.reservationId.slice(0, 8)}...
                </span>
              )}
            </div>
            
            {/* Close Button */}
            <button
              onClick={onClose}
              className="px-4 py-2 bg-fcGold text-white font-semibold rounded-lg hover:bg-fcSlate transition-colors"
            >
              Close Viewer
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}
