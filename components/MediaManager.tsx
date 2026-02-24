
import React, { useState, useRef, useCallback } from 'react';
import Image from 'next/image';
import { 
  Upload, X, Image as ImageIcon, CheckCircle2, 
  AlertCircle, Loader2, Star, Trash2, Camera,
  ShieldCheck, Zap, FileImage
} from 'lucide-react';
import { UploadButton } from '@uploadthing/react';
import { Development, Branch } from '../types.ts';
import { saveDevelopmentMedia, updateDevelopment } from '../lib/db';
import type { OurFileRouter } from '../app/api/uploadthing/core';

interface MediaManagerProps {
  development: Development;
  activeBranch: Branch;
  onUpdate: (updatedDev: Development) => void;
  category: 'LOGO' | 'RENDER';
}

export const MediaManager: React.FC<MediaManagerProps> = ({ 
  development, 
  activeBranch, 
  onUpdate,
  category 
}) => {
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /**
   * Handle successful upload from UploadButton
   */
  const handleUploadComplete = async (res: Array<{ url: string }>) => {
    if (res && res.length > 0) {
      const uploadedUrl = res[0].url;

      try {
        let updatedDev: Development;
        
        if (category === 'LOGO') {
          updatedDev = { ...development, logoUrl: uploadedUrl };
          const mediaResult = await saveDevelopmentMedia(development.id, 'LOGO', uploadedUrl, 'logos', '');
          if (mediaResult.error) {
            console.error('[FORENSIC][MEDIA RECORD ERROR]', mediaResult.error);
            throw mediaResult.error;
          }
        } else {
          updatedDev = { ...development, imageUrls: [...development.imageUrls, uploadedUrl] };
          const mediaResult = await saveDevelopmentMedia(development.id, 'RENDER', uploadedUrl, 'media', '');
          if (mediaResult.error) {
            console.error('[FORENSIC][MEDIA RECORD ERROR]', mediaResult.error);
            throw mediaResult.error;
          }
        }

        const updateResult = await updateDevelopment(development.id, updatedDev);
        if (updateResult.error) {
          console.error('[FORENSIC][DB UPDATE ERROR]', updateResult.error);
          throw updateResult.error;
        }

        onUpdate(updatedDev);
        setError(null);
      } catch (err: any) {
        console.error('[FORENSIC][UPLOAD FATAL]', {
          error_message: err.message || 'Unknown error',
          development_id: development.id,
          category
        });
        setError("Unable to securely store media. Please check your connection and try again.");
      }
    }
  };

  const handleUploadError = (error: Error) => {
    console.error('[FORENSIC][IMAGE UPLOAD ERROR]', error);
    setError(error.message || "Upload failed. Please try again.");
  };

  const onDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
  }, []);

  const onDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
  }, []);

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
  }, []);

  const setPrimary = async (url: string) => {
    // Reorders the array so the primary image is at index 0 for Map/Card display
    const reordered = [url, ...development.imageUrls.filter(u => u !== url)];
    const updated = { ...development, imageUrls: reordered };
    await updateDevelopment(development.id, updated);
    onUpdate(updated);
  };

  const removeMedia = async (url: string) => {
    const filtered = development.imageUrls.filter(u => u !== url);
    const updated = { ...development, imageUrls: filtered };
    await updateDevelopment(development.id, updated);
    onUpdate(updated);
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500 font-sans">
      
      {/* Executive Dropzone: Executive Cream with Gold Accents */}
      <div 
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        onDrop={onDrop}
        className={`relative h-64 rounded-[32px] border-2 border-dashed transition-all duration-500 flex flex-col items-center justify-center group overflow-hidden ${
          isUploading ? 'bg-fcGold/10 border-fcGold scale-[0.99] shadow-inner' : 'bg-fcCream border-[#EFECE7] hover:border-fcGold/50 hover:bg-white'
        } ${isUploading ? 'cursor-wait opacity-80' : ''}`}
      >
        {isUploading ? (
          <div className="w-full max-w-xs space-y-6 text-center animate-in zoom-in-95">
            <div className="relative inline-block">
               <Loader2 className="animate-spin text-fcGold" size={48} strokeWidth={1.5} />
               <Zap className="absolute inset-0 m-auto text-fcGold/30" size={16} />
            </div>
            <div className="space-y-2">
               <p className="text-[10px] font-black text-fcGold uppercase tracking-[0.3em]">Synchronizing Vault...</p>
               <div className="h-2 w-full bg-fcGold/10 rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-fcGold transition-all duration-300 rounded-full shadow-[0_0_15px_rgba(133,117,78,0.4)]" 
                    style={{ width: '100%' }}
                  />
               </div>
               <p className="text-[9px] font-bold text-gray-600 font-mono">100% SYNCED</p>
            </div>
          </div>
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center cursor-pointer">
            <UploadButton<OurFileRouter, 'developmentMainImage' | 'developmentGallery'>
              endpoint={category === 'LOGO' ? 'developmentMainImage' : 'developmentGallery'}
              input={{ developmentId: development.id }}
              onClientUploadComplete={async (res) => {
                setIsUploading(true);
                await handleUploadComplete(res);
                setIsUploading(false);
              }}
              onUploadBegin={() => setIsUploading(true)}
              onUploadError={handleUploadError}
              appearance={{
                button: "hidden",
                allowedContent: "hidden",
                container: "w-full h-full flex items-center justify-center"
              }}
              content={{
                button: "",
                allowedContent: ""
              }}
              className="w-full h-full"
            />
            
            {/* Fallback UI when button is hidden */}
            <div className="text-center space-y-4 px-8 pointer-events-none">
              <div className="w-16 h-16 bg-white rounded-2xl flex items-center justify-center text-fcGold shadow-sm group-hover:scale-110 group-hover:bg-fcGold group-hover:text-white transition-all duration-500 mx-auto">
                 <Upload size={28} strokeWidth={1.5} />
              </div>
              <div className="space-y-1">
                 <h4 className="text-sm font-black text-fcSlate uppercase tracking-tight font-sans">
                   {category === 'LOGO' ? 'Deposit Brand Identity' : 'Deposit Asset Render'}
                 </h4>
                 <p className="text-[10px] text-gray-600 font-bold uppercase tracking-widest leading-relaxed font-sans">
                   Drag media files here or click to browse<br/>
                   <span className="text-[8px] opacity-60">Verified Formats: .JPG, .PNG, .WEBP</span>
                 </p>
              </div>
            </div>
          </div>
        )}

        {/* Status Protocol Tag */}
        {!isUploading && !error && (
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center space-x-2 text-[8px] font-black text-slate-300 uppercase tracking-widest bg-white/50 px-4 py-1.5 rounded-full backdrop-blur-sm border border-white/50 group-hover:text-fcGold group-hover:border-fcGold/20 transition-all pointer-events-none">
             <ShieldCheck size={10} />
             <span>Forensic Protocol Active</span>
          </div>
        )}
      </div>

      {/* Executive Error Messaging */}
      {error && (
        <div className="flex items-start space-x-4 p-6 bg-red-50 rounded-[24px] border border-red-100 animate-in slide-in-from-top-2 duration-500">
           <div className="p-2.5 bg-red-600 text-white rounded-xl shadow-lg"><AlertCircle size={20} /></div>
           <div className="space-y-1">
              <h5 className="text-[10px] font-black text-red-600 uppercase tracking-widest">Security Handshake Failure</h5>
              <p className="text-sm font-bold text-red-800 leading-relaxed font-sans">{error}</p>
           </div>
        </div>
      )}

      {/* Primary Image & Gallery Controls */}
      {category === 'RENDER' && development.imageUrls.length > 0 && (
        <div className="space-y-6">
           <div className="flex justify-between items-center px-2">
              <div className="flex items-center space-x-3 text-fcGold">
                <ImageIcon size={18} />
                <h3 className="text-[10px] font-black uppercase tracking-[0.3em]">Managed Asset Cluster</h3>
              </div>
              <span className="text-[9px] font-black text-slate-300 uppercase tracking-widest bg-white px-3 py-1 rounded-full border border-slate-100">
                {development.imageUrls.length} Objects Realized
              </span>
           </div>
           
           <div className="grid grid-cols-2 lg:grid-cols-3 gap-6">
              {development.imageUrls.map((url, idx) => (
                <div key={url} className="group relative aspect-video bg-fcCream rounded-[32px] border border-[#EFECE7] overflow-hidden shadow-sm hover:shadow-2xl hover:border-fcGold/30 transition-all duration-700">
                   {url ? (
                     <Image 
                       src={url} 
                       fill
                       className="object-cover transition-transform duration-1000 group-hover:scale-110" 
                       alt={`Development render ${idx + 1}`}
                       sizes="(max-width: 768px) 50vw, (max-width: 1024px) 33vw, 25vw"
                       onError={(e) => {
                         const target = e.target as HTMLImageElement;
                         target.style.display = 'none';
                         const fallback = target.nextElementSibling as HTMLElement;
                         if (fallback) fallback.classList.remove('hidden');
                       }}
                     />
                   ) : null}
                   <div className="hidden absolute inset-0 flex flex-col items-center justify-center bg-slate-100">
                     <ImageIcon size={48} className="text-slate-300 mb-2" />
                     <span className="text-xs font-semibold text-gray-600 font-sans">Image unavailable</span>
                   </div>
                   
                   {/* Primary Render Identifier */}
                   {idx === 0 && (
                     <div className="absolute top-4 left-4 z-20 flex items-center space-x-2 bg-fcGold text-white px-4 py-2 rounded-full text-[9px] font-black uppercase tracking-widest shadow-2xl border border-white/20">
                        <Star size={12} fill="currentColor" />
                        <span>Master Render</span>
                     </div>
                   )}

                   {/* Management Controls Overlay */}
                   <div className="absolute inset-0 bg-fcSlate/60 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center space-y-4 backdrop-blur-sm">
                      {idx !== 0 && (
                        <button 
                          onClick={(e) => { e.stopPropagation(); setPrimary(url); }}
                          className="flex items-center space-x-3 bg-white text-fcSlate px-6 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-2xl hover:bg-fcGold hover:text-white transition-all transform translate-y-4 group-hover:translate-y-0 duration-500 font-sans"
                        >
                           <Star size={14} />
                           <span>Set as Primary</span>
                        </button>
                      )}
                      <button 
                        onClick={(e) => { e.stopPropagation(); removeMedia(url); }}
                        className="flex items-center space-x-3 bg-red-600 text-white px-6 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-2xl hover:bg-red-700 transition-all transform translate-y-8 group-hover:translate-y-0 duration-700 font-sans"
                      >
                         <Trash2 size={14} />
                         <span>Change Image</span>
                      </button>
                   </div>

                   {/* Forensic ID Tag */}
                   <div className="absolute bottom-4 right-4 text-[8px] font-mono text-white/50 bg-black/20 px-2 py-0.5 rounded backdrop-blur-sm">
                      CRC: {url.split('_').pop()?.split('.')[0]}
                   </div>
                </div>
              ))}
           </div>
        </div>
      )}

      {/* Brand Signature Preview */}
      {category === 'LOGO' && development.logoUrl && (
        <div className="flex flex-col items-center p-16 bg-white rounded-[40px] border border-[#EFECE7] shadow-inner animate-in fade-in duration-700">
           <div className="text-[10px] font-black text-slate-300 uppercase tracking-[0.4em] mb-10 font-sans">Active Institutional Signature</div>
           <div className="w-48 h-48 p-8 bg-fcCream rounded-3xl border border-[#EFECE7] shadow-sm flex items-center justify-center overflow-hidden group relative">
              {development.logoUrl ? (
                <Image 
                  src={development.logoUrl} 
                  fill
                  className="object-contain" 
                  alt="Development logo"
                  sizes="192px"
                  onError={(e) => {
                    const target = e.target as HTMLImageElement;
                    target.style.display = 'none';
                    const fallback = target.nextElementSibling as HTMLElement;
                    if (fallback) fallback.classList.remove('hidden');
                  }}
                />
              ) : null}
              <div className="hidden flex flex-col items-center justify-center">
                <ImageIcon size={48} className="text-slate-300 mb-2" />
                <span className="text-xs font-semibold text-gray-600 font-sans">Logo unavailable</span>
              </div>
              <div className="absolute inset-0 bg-white/60 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                 <button 
                   onClick={() => onUpdate({ ...development, logoUrl: '' })}
                   className="p-4 bg-red-600 text-white rounded-full shadow-xl hover:scale-110 transition-transform"
                 >
                    <Trash2 size={24} />
                 </button>
              </div>
           </div>
           <p className="mt-8 text-[9px] font-black text-gray-600 uppercase tracking-widest">Stored on VPC S3 Storage</p>
        </div>
      )}
    </div>
  );
};
