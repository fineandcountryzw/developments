'use client';

import React, { useState, useRef } from 'react';
import { Upload, FileText, X, Loader2, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';

interface DOCXTemplateUploaderProps {
  onTemplateUploaded?: (template: any) => void;
  userBranch?: string;
}

function extractSortedVariables(template: any): any[] {
  const rawVariables =
    template?.templateVariables ||
    template?._extractedVariables ||
    [];

  if (!Array.isArray(rawVariables)) return [];

  return [...rawVariables].sort((a, b) => {
    const nameA = String(a?.name || a?.fullName || '').toLowerCase();
    const nameB = String(b?.name || b?.fullName || '').toLowerCase();
    return nameA.localeCompare(nameB);
  });
}

export const DOCXTemplateUploader: React.FC<DOCXTemplateUploaderProps> = ({ 
  onTemplateUploaded, 
  userBranch = 'Harare' 
}) => {
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadResult, setUploadResult] = useState<{ success: boolean; message: string; template?: any } | null>(null);
  const [templateName, setTemplateName] = useState('');
  const [templateDescription, setTemplateDescription] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      
      // Validate file type
      if (!file.name.toLowerCase().endsWith('.docx')) {
        setUploadResult({ 
          success: false, 
          message: 'Please select a valid DOCX file' 
        });
        return;
      }

      // Validate file size (max 20MB)
      if (file.size > 20 * 1024 * 1024) {
        setUploadResult({ 
          success: false, 
          message: 'Document too large. Maximum size is 20MB.' 
        });
        return;
      }

      setSelectedFile(file);
      
      // Auto-generate template name from filename
      if (!templateName) {
        const filename = file.name.replace('.docx', '');
        setTemplateName(filename);
      }
    }
  };

  const handleUpload = async () => {
    if (!selectedFile) {
      setUploadResult({ 
        success: false, 
        message: 'Please select a DOCX file to upload' 
      });
      return;
    }

    if (!templateName.trim()) {
      setUploadResult({ 
        success: false, 
        message: 'Please provide a template name' 
      });
      return;
    }

    setIsUploading(true);
    setUploadProgress(0);
    setUploadResult(null);

    try {
      // Simulate progress
      const progressInterval = setInterval(() => {
        setUploadProgress(prev => {
          if (prev >= 90) {
            clearInterval(progressInterval);
            return 90;
          }
          return prev + 10;
        });
      }, 200);

      const formData = new FormData();
      formData.append('file', selectedFile);
      formData.append('name', templateName.trim());
      if (templateDescription.trim()) {
        formData.append('description', templateDescription.trim());
      }
      formData.append('isGlobal', 'true');

      const response = await fetch('/api/admin/contracts/templates/upload', {
        method: 'POST',
        body: formData,
      });

      clearInterval(progressInterval);
      setUploadProgress(100);

      const result = await response.json();

      if (response.ok) {
        const payload = result?.data || result;
        const template = payload?.template || payload;
        const sortedVariables = extractSortedVariables(template);

        setUploadResult({
          success: true,
          message: 'Template uploaded successfully!',
          template: {
            ...template,
            templateVariables: sortedVariables,
            _compilation: payload?.compilation || template?._compilation
          }
        });
        
        onTemplateUploaded?.(template);
      } else {
        const details = result?.details?.errorDetails;
        const detailedError = Array.isArray(details)
          ? details.map((item: any) => item?.message).filter(Boolean).join(' | ')
          : null;

        setUploadResult({
          success: false,
          message: detailedError || result.error || result.message || 'Failed to upload template'
        });
      }
    } catch (error) {
      setUploadResult({
        success: false,
        message: error instanceof Error ? error.message : 'An unexpected error occurred'
      });
    } finally {
      setIsUploading(false);
    }
  };

  const handleReset = () => {
    setSelectedFile(null);
    setTemplateName('');
    setTemplateDescription('');
    setUploadProgress(0);
    setUploadResult(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="outline" className="flex items-center gap-2">
          <Upload size={16} />
          Upload DOCX Template
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Upload Contract Template</DialogTitle>
          <DialogDescription>
            Upload a Word document (DOCX) to create a new contract template with variables.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* File Selection */}
          <div className="space-y-2">
            <label className="text-sm font-medium">Select DOCX File</label>
            <input
              ref={fileInputRef}
              type="file"
              accept=".docx"
              onChange={handleFileChange}
              className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-fcGold file:text-white hover:file:bg-fcGold/90 cursor-pointer"
            />
            {selectedFile && (
              <div className="flex items-center gap-2 text-sm text-gray-600 bg-gray-50 p-2 rounded">
                <FileText size={16} />
                <span className="truncate">{selectedFile.name}</span>
                <Badge variant="outline" className="text-xs">
                  {Math.round(selectedFile.size / 1024)} KB
                </Badge>
                <button
                  onClick={() => {
                    setSelectedFile(null);
                    if (fileInputRef.current) {
                      fileInputRef.current.value = '';
                    }
                  }}
                  className="ml-auto text-gray-400 hover:text-red-500"
                >
                  <X size={16} />
                </button>
              </div>
            )}
          </div>

          {/* Template Info */}
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium">Template Name *</label>
              <Input
                value={templateName}
                onChange={(e) => setTemplateName(e.target.value)}
                placeholder="Enter template name"
                disabled={isUploading}
              />
            </div>
            <div>
              <label className="text-sm font-medium">Description</label>
              <Textarea
                value={templateDescription}
                onChange={(e) => setTemplateDescription(e.target.value)}
                placeholder="Enter template description (optional)"
                rows={3}
                disabled={isUploading}
              />
            </div>
          </div>

          {/* Upload Progress */}
          {isUploading && (
            <div className="space-y-2">
              <div className="flex justify-between text-sm text-gray-600">
                <span>Uploading...</span>
                <span>{uploadProgress}%</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div
                  className="bg-fcGold h-2 rounded-full transition-all duration-300"
                  style={{ width: `${uploadProgress}%` }}
                />
              </div>
            </div>
          )}

          {/* Upload Result */}
          {uploadResult && (
            <div className={`p-4 rounded-lg border ${
              uploadResult.success ? 'bg-green-50 border-green-200 text-green-700' : 'bg-red-50 border-red-200 text-red-700'
            }`}>
              <div className="flex items-start gap-2">
                {uploadResult.success ? (
                  <CheckCircle2 size={20} className="mt-0.5 flex-shrink-0" />
                ) : (
                  <X size={20} className="mt-0.5 flex-shrink-0" />
                )}
                <div className="flex-1">
                  <p className="font-medium">{uploadResult.message}</p>
                  {uploadResult.success && uploadResult.template && (
                    <div className="mt-2 text-sm">
                      <p>Variables detected: {uploadResult.template.templateVariables?.length || 0}</p>
                      {uploadResult.template.templateVariables?.length > 0 && (
                        <div className="mt-2 flex flex-wrap gap-1">
                          {uploadResult.template.templateVariables.slice(0, 10).map((variable: any) => (
                            <Badge key={variable.name || variable.fullName} variant="outline" className="text-xs">
                              {variable.name || variable.fullName}
                            </Badge>
                          ))}
                        </div>
                      )}
                      {uploadResult.template._compilation?.warnings?.length > 0 && (
                        <p className="text-yellow-600">
                          Warnings: {uploadResult.template._compilation.warnings.length}
                        </p>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex gap-2">
            <Button
              onClick={handleUpload}
              disabled={!selectedFile || isUploading || !templateName.trim()}
              className="flex-1"
            >
              {isUploading ? (
                <>
                  <Loader2 className="mr-2 animate-spin" size={16} />
                  Uploading...
                </>
              ) : (
                'Upload Template'
              )}
            </Button>
            <Button
              variant="outline"
              onClick={handleReset}
              disabled={isUploading}
            >
              Reset
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
