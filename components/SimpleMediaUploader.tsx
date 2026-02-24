/**
 * Simple Media Uploader using UploadThing
 * For development logos and images
 */

import React, { useState } from 'react';
import Image from 'next/image';
import { CheckCircle2, AlertCircle, Loader2, Trash2, Star } from 'lucide-react';
import { UploadButton } from '@uploadthing/react';
import type { OurFileRouter } from '../app/api/uploadthing/core';

interface SimpleMediaUploaderProps {
  developmentId: string;
  developmentName: string;
  currentImages: string[];
  onImagesUpdate: (urls: string[]) => void;
  category: 'logo' | 'images';
}

export const SimpleMediaUploader: React.FC<SimpleMediaUploaderProps> = ({
  developmentId,
  developmentName,
  currentImages,
  onImagesUpdate,
  category
}) => {
  const [isUploading, setIsUploading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const handleUploadComplete = (res: Array<{ url: string }>) => {
    setIsUploading(false);
    
    if (res && res.length > 0) {
      const newUrls = res.map(file => file.url);
      const updatedImages = [...currentImages, ...newUrls];
      onImagesUpdate(updatedImages);
      
      setMessage({ 
        type: 'success', 
        text: `✓ ${newUrls.length} file(s) uploaded successfully` 
      });
      
      setTimeout(() => setMessage(null), 3000);
    }
  };

  const handleUploadError = (error: Error) => {
    setIsUploading(false);
    setMessage({ 
      type: 'error', 
      text: `Upload failed: ${error.message}` 
    });
    console.error('[UPLOAD ERROR]', error);
  };

  const removeImage = (urlToRemove: string) => {
    const updated = currentImages.filter(url => url !== urlToRemove);
    onImagesUpdate(updated);
  };

  const setPrimary = (url: string) => {
    const reordered = [url, ...currentImages.filter(u => u !== url)];
    onImagesUpdate(reordered);
  };

  return (
    <div className="space-y-4">
      {/* Upload Button */}
      <div className="border-2 border-dashed border-slate-200 rounded-lg p-8 text-center hover:border-slate-300 transition-colors">
        <UploadButton<OurFileRouter, 'developmentMainImage' | 'developmentGallery'>
          endpoint={category === 'logo' ? 'developmentMainImage' : 'developmentGallery'}
          input={{ developmentId }}
          onClientUploadComplete={handleUploadComplete}
          onUploadError={handleUploadError}
          onUploadBegin={() => {
            setIsUploading(true);
            setMessage(null);
          }}
          appearance={{
            button: "bg-fcGold text-white px-6 py-2 rounded-lg font-semibold hover:bg-fcGold/90 transition-colors",
            allowedContent: "text-gray-600 text-sm mt-2"
          }}
        />
        
        {isUploading && (
          <div className="flex items-center justify-center gap-2 mt-4 text-gray-600">
            <Loader2 className="w-4 h-4 animate-spin" />
            <span className="text-sm">Uploading...</span>
          </div>
        )}
      </div>

      {/* Status Messages */}
      {message && (
        <div className={`flex items-center gap-2 p-3 rounded-lg ${
          message.type === 'success' 
            ? 'bg-green-50 text-green-800' 
            : 'bg-red-50 text-red-800'
        }`}>
          {message.type === 'success' ? (
            <CheckCircle2 className="w-4 h-4" />
          ) : (
            <AlertCircle className="w-4 h-4" />
          )}
          <span className="text-sm font-medium">{message.text}</span>
        </div>
      )}

      {/* Uploaded Images Grid */}
      {currentImages.length > 0 && (
        <div className="space-y-2">
          <h4 className="text-sm font-semibold text-slate-700">
            Uploaded {category === 'logo' ? 'Logo' : 'Images'} ({currentImages.length})
          </h4>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {currentImages.map((url, index) => (
              <div 
                key={url} 
                className="relative group rounded-lg overflow-hidden border border-slate-200 hover:border-fcGold transition-colors h-32"
              >
                <Image 
                  src={url} 
                  alt={`${developmentName} - Image ${index + 1}`}
                  fill
                  className="object-cover"
                  sizes="(max-width: 768px) 50vw, (max-width: 1024px) 33vw, 25vw"
                />
                
                {/* Image Controls */}
                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                  {category === 'images' && index !== 0 && (
                    <button
                      onClick={() => setPrimary(url)}
                      className="p-2 bg-white rounded-lg hover:bg-gray-50 transition-colors"
                      title="Set as primary"
                    >
                      <Star className="w-4 h-4 text-fcGold" />
                    </button>
                  )}
                  <button
                    onClick={() => removeImage(url)}
                    className="p-2 bg-white rounded-lg hover:bg-red-50 transition-colors"
                    title="Remove image"
                  >
                    <Trash2 className="w-4 h-4 text-red-600" />
                  </button>
                </div>

                {/* Primary Badge */}
                {index === 0 && category === 'images' && (
                  <div className="absolute top-2 right-2 bg-fcGold text-white px-2 py-1 rounded text-xs font-semibold flex items-center gap-1">
                    <Star className="w-3 h-3 fill-current" />
                    Primary
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
