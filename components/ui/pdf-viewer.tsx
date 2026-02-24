'use client';

import React, { useState } from 'react';
import { X, Download, ExternalLink, FileText, Loader2, Eye } from 'lucide-react';
import { cn } from '@/lib/utils';

interface PDFViewerProps {
  /** URL of the PDF to display */
  url: string;
  /** Title shown in the modal header */
  title?: string;
  /** Whether the modal is open */
  open: boolean;
  /** Callback when modal should close */
  onClose: () => void;
  /** Optional filename for download */
  filename?: string;
  /** Custom class for the modal */
  className?: string;
}

/**
 * PDFViewer - A reusable PDF viewing modal component
 * Supports viewing PDFs inline, downloading, and opening in new tab
 */
export function PDFViewer({
  url,
  title = 'Document',
  open,
  onClose,
  filename,
  className,
}: PDFViewerProps) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  if (!open) return null;

  const handleDownload = async () => {
    try {
      const response = await fetch(url);
      const blob = await response.blob();
      const downloadUrl = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = downloadUrl;
      link.download = filename || `${title.replace(/\s+/g, '_')}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(downloadUrl);
    } catch (err) {
      console.error('Download failed:', err);
      // Fallback: open in new tab
      window.open(url, '_blank');
    }
  };

  const handleOpenNewTab = () => {
    window.open(url, '_blank');
  };

  return (
    <div 
      className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div 
        className={cn(
          'bg-white rounded-2xl shadow-2xl w-full max-w-5xl max-h-[90vh] flex flex-col overflow-hidden',
          className
        )}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 bg-gray-50">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-[#B8860B]/10 rounded-lg">
              <FileText className="w-5 h-5 text-[#B8860B]" />
            </div>
            <div>
              <h3 className="font-semibold text-gray-900">{title}</h3>
              <p className="text-xs text-gray-500">PDF Document</p>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            <button
              onClick={handleOpenNewTab}
              className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
              title="Open in new tab"
            >
              <ExternalLink className="w-4 h-4" />
              <span className="hidden sm:inline">Open</span>
            </button>
            <button
              onClick={handleDownload}
              className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-white bg-[#B8860B] hover:bg-[#996F00] rounded-lg transition-colors"
              title="Download PDF"
            >
              <Download className="w-4 h-4" />
              <span className="hidden sm:inline">Download</span>
            </button>
            <button
              onClick={onClose}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors text-gray-500 hover:text-gray-700"
              title="Close"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 relative min-h-[500px] bg-gray-100">
          {loading && (
            <div className="absolute inset-0 flex items-center justify-center bg-gray-100">
              <div className="text-center space-y-3">
                <Loader2 className="w-8 h-8 animate-spin text-[#B8860B] mx-auto" />
                <p className="text-sm text-gray-600">Loading document...</p>
              </div>
            </div>
          )}
          
          {error && (
            <div className="absolute inset-0 flex items-center justify-center bg-gray-100">
              <div className="text-center space-y-4 p-6">
                <div className="p-4 bg-red-50 rounded-full w-fit mx-auto">
                  <FileText className="w-8 h-8 text-red-500" />
                </div>
                <div>
                  <p className="text-gray-900 font-medium">Unable to display PDF</p>
                  <p className="text-sm text-gray-600 mt-1">Try downloading or opening in a new tab</p>
                </div>
                <div className="flex items-center gap-3 justify-center">
                  <button
                    onClick={handleOpenNewTab}
                    className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 hover:bg-gray-50 rounded-lg transition-colors"
                  >
                    <ExternalLink className="w-4 h-4" />
                    Open in New Tab
                  </button>
                  <button
                    onClick={handleDownload}
                    className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-[#B8860B] hover:bg-[#996F00] rounded-lg transition-colors"
                  >
                    <Download className="w-4 h-4" />
                    Download
                  </button>
                </div>
              </div>
            </div>
          )}

          <iframe
            src={`${url}#toolbar=1&navpanes=1&scrollbar=1`}
            className="w-full h-full min-h-[500px]"
            onLoad={() => setLoading(false)}
            onError={() => {
              setLoading(false);
              setError(true);
            }}
            title={title}
          />
        </div>
      </div>
    </div>
  );
}

interface PDFViewButtonProps {
  /** URL of the PDF */
  url: string;
  /** Title for the viewer */
  title?: string;
  /** Optional filename for download */
  filename?: string;
  /** Button variant */
  variant?: 'icon' | 'button' | 'link';
  /** Button size */
  size?: 'sm' | 'md' | 'lg';
  /** Custom class */
  className?: string;
  /** Children content */
  children?: React.ReactNode;
}

/**
 * PDFViewButton - A button that opens the PDF viewer
 */
export function PDFViewButton({
  url,
  title = 'Document',
  filename,
  variant = 'button',
  size = 'md',
  className,
  children,
}: PDFViewButtonProps) {
  const [open, setOpen] = useState(false);

  const sizeClasses = {
    sm: 'px-2 py-1 text-xs',
    md: 'px-3 py-2 text-sm',
    lg: 'px-4 py-2.5 text-base',
  };

  const baseClasses = {
    icon: 'p-2 hover:bg-gray-100 rounded-lg transition-colors text-gray-600 hover:text-gray-900',
    button: `flex items-center gap-2 ${sizeClasses[size]} font-medium text-gray-700 bg-white border border-gray-300 hover:bg-gray-50 rounded-lg transition-colors`,
    link: 'text-[#B8860B] hover:text-[#996F00] hover:underline font-medium transition-colors',
  };

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className={cn(baseClasses[variant], className)}
        title={`View ${title}`}
      >
        {children || (
          <>
            <Eye className="w-4 h-4" />
            {variant !== 'icon' && <span>View</span>}
          </>
        )}
      </button>

      <PDFViewer
        url={url}
        title={title}
        filename={filename}
        open={open}
        onClose={() => setOpen(false)}
      />
    </>
  );
}

interface PDFDownloadButtonProps {
  /** URL of the PDF */
  url: string;
  /** Filename for download */
  filename?: string;
  /** Button variant */
  variant?: 'icon' | 'button';
  /** Button size */
  size?: 'sm' | 'md' | 'lg';
  /** Custom class */
  className?: string;
  /** Children content */
  children?: React.ReactNode;
}

/**
 * PDFDownloadButton - A button that directly downloads the PDF
 */
export function PDFDownloadButton({
  url,
  filename = 'document.pdf',
  variant = 'button',
  size = 'md',
  className,
  children,
}: PDFDownloadButtonProps) {
  const [downloading, setDownloading] = useState(false);

  const handleDownload = async () => {
    setDownloading(true);
    try {
      const response = await fetch(url);
      const blob = await response.blob();
      const downloadUrl = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = downloadUrl;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(downloadUrl);
    } catch (err) {
      console.error('Download failed:', err);
      window.open(url, '_blank');
    } finally {
      setDownloading(false);
    }
  };

  const sizeClasses = {
    sm: 'px-2 py-1 text-xs',
    md: 'px-3 py-2 text-sm',
    lg: 'px-4 py-2.5 text-base',
  };

  const baseClasses = {
    icon: 'p-2 hover:bg-gray-100 rounded-lg transition-colors text-gray-600 hover:text-gray-900',
    button: `flex items-center gap-2 ${sizeClasses[size]} font-medium text-white bg-[#B8860B] hover:bg-[#996F00] rounded-lg transition-colors`,
  };

  return (
    <button
      onClick={handleDownload}
      disabled={downloading}
      className={cn(baseClasses[variant], downloading && 'opacity-70 cursor-not-allowed', className)}
      title={`Download ${filename}`}
    >
      {downloading ? (
        <>
          <Loader2 className="w-4 h-4 animate-spin" />
          {variant !== 'icon' && <span>Downloading...</span>}
        </>
      ) : (
        children || (
          <>
            <Download className="w-4 h-4" />
            {variant !== 'icon' && <span>Download</span>}
          </>
        )
      )}
    </button>
  );
}

export default PDFViewer;
