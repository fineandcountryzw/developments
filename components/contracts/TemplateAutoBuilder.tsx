'use client';

import React, { useState, useRef } from 'react';
import { Upload, FileText, X, Loader2, CheckCircle2, ArrowRight, Save } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

// ============================================================================
// Types
// ============================================================================

interface DetectedBlank {
  placeholder: string;
  contextBefore: string;
  contextAfter: string;
  blankType: string;
  selectedMapping?: string;
}

interface MappingOption {
  category: string;
  options: {
    label: string;
    value: string;
    type: string;
  }[];
}

interface BlankPreview {
  hasBlanks: boolean;
  count: number;
  blanks: DetectedBlank[];
  mappingOptions: MappingOption[];
}

interface TemplateAutoBuilderProps {
  onTemplateCreated?: (template: any) => void;
  userBranch?: string;
  developmentId?: string;
}

// ============================================================================
// Component
// ============================================================================

export const TemplateAutoBuilder: React.FC<TemplateAutoBuilderProps> = ({
  onTemplateCreated,
  userBranch = 'Harare',
  developmentId
}) => {
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [templateName, setTemplateName] = useState('');
  const [templateDescription, setTemplateDescription] = useState('');
  const [previewResult, setPreviewResult] = useState<BlankPreview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [mappings, setMappings] = useState<Record<string, string>>({});
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Flatten all mapping options for dropdown
  const getAllMappingOptions = () => {
    if (!previewResult) return [];
    const options: { label: string; value: string; category: string }[] = [];
    previewResult.mappingOptions.forEach(group => {
      group.options.forEach(opt => {
        options.push({ ...opt, category: group.category });
      });
    });
    return options;
  };

  // Handle file selection
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];

      if (!file.name.toLowerCase().endsWith('.docx')) {
        setError('Please select a valid DOCX file');
        return;
      }

      if (file.size > 20 * 1024 * 1024) {
        setError('Document too large. Maximum size is 20MB.');
        return;
      }

      setSelectedFile(file);
      setError(null);
      setPreviewResult(null);
      setMappings({});
      setSaveSuccess(false);

      // Auto-generate template name from filename
      if (!templateName) {
        setTemplateName(file.name.replace('.docx', ''));
      }
    }
  };

  // Upload and preview
  const handlePreview = async () => {
    if (!selectedFile) {
      setError('Please select a DOCX file');
      return;
    }

    setIsUploading(true);
    setError(null);

    try {
      const formData = new FormData();
      formData.append('file', selectedFile);

      const response = await fetch('/api/admin/contracts/templates/auto-build', {
        method: 'POST',
        body: formData,
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to preview template');
      }

      // Initialize mappings with empty values
      const initialMappings: Record<string, string> = {};
      result.data.blanks?.forEach((blank: DetectedBlank) => {
        initialMappings[blank.placeholder] = '';
      });

      setPreviewResult(result.data);
      setMappings(initialMappings);

    } catch (err: any) {
      setError(err.message || 'Failed to preview template');
    } finally {
      setIsUploading(false);
    }
  };

  // Handle mapping change
  const handleMappingChange = (placeholder: string, value: string) => {
    setMappings(prev => ({
      ...prev,
      [placeholder]: value
    }));
  };

  // Save template with mappings
  const handleSave = async () => {
    if (!selectedFile) {
      setError('Please select a DOCX file');
      return;
    }

    if (!templateName.trim()) {
      setError('Please provide a template name');
      return;
    }

    // Validate mappings
    const unmappedBlanks = Object.entries(mappings)
      .filter(([_, value]) => !value)
      .map(([key]) => key);

    if (unmappedBlanks.length > 0) {
      const confirmed = confirm(
        `${unmappedBlanks.length} blank(s) are not mapped to variables.\n` +
        `They will be saved as {{${unmappedBlanks.join('}}, {{')}}}.\n\n` +
        `Continue anyway?`
      );
      if (!confirmed) return;
    }

    setIsSaving(true);
    setError(null);

    try {
      const formData = new FormData();
      formData.append('file', selectedFile);
      formData.append('name', templateName.trim());
      if (templateDescription.trim()) {
        formData.append('description', templateDescription.trim());
      }
      if (developmentId) {
        formData.append('developmentId', developmentId);
      }
      formData.append('isGlobal', (!developmentId).toString());
      formData.append('mappings', JSON.stringify(mappings));

      const response = await fetch('/api/admin/contracts/templates/auto-build', {
        method: 'POST',
        body: formData,
      });

      const result = await response.json();

      if (!response.ok) {
        const errorMsg = result.details || result.error || 'Failed to save template';
        throw new Error(errorMsg);
      }

      setSaveSuccess(true);
      onTemplateCreated?.(result.data.template);

    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsSaving(false);
    }
  };

  // Reset
  const handleReset = () => {
    setSelectedFile(null);
    setTemplateName('');
    setTemplateDescription('');
    setPreviewResult(null);
    setMappings({});
    setError(null);
    setSaveSuccess(false);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="outline" className="flex items-center gap-2">
          <MagicWandIcon className="w-4 h-4" />
          Auto-Build Template
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Template Auto-Builder</DialogTitle>
          <DialogDescription>
            Upload a DOCX with blank fields (underscores, dots, dashes) and map them to ERP variables.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Step 1: File Selection */}
          {!previewResult && (
            <div className="space-y-4">
              <div>
                <Label>Select DOCX File</Label>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".docx"
                  onChange={handleFileChange}
                  className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-fcGold file:text-white hover:file:bg-fcGold/90 cursor-pointer mt-2"
                />
                {selectedFile && (
                  <div className="flex items-center gap-2 text-sm text-gray-600 bg-gray-50 p-2 rounded mt-2">
                    <FileText size={16} />
                    <span className="truncate">{selectedFile.name}</span>
                    <Badge variant="outline" className="text-xs">
                      {Math.round(selectedFile.size / 1024)} KB
                    </Badge>
                    <button
                      onClick={() => {
                        setSelectedFile(null);
                        if (fileInputRef.current) fileInputRef.current.value = '';
                      }}
                      className="ml-auto text-gray-400 hover:text-red-500"
                    >
                      <X size={16} />
                    </button>
                  </div>
                )}
              </div>

              {/* Template Info */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Template Name *</Label>
                  <Input
                    value={templateName}
                    onChange={(e) => setTemplateName(e.target.value)}
                    placeholder="Enter template name"
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label>Description</Label>
                  <Input
                    value={templateDescription}
                    onChange={(e) => setTemplateDescription(e.target.value)}
                    placeholder="Optional description"
                    className="mt-1"
                  />
                </div>
              </div>

              {/* Error */}
              {error && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
                  {error}
                </div>
              )}

              {/* Action */}
              <div className="flex gap-2">
                <Button
                  onClick={handlePreview}
                  disabled={!selectedFile || isUploading}
                  className="flex-1"
                >
                  {isUploading ? (
                    <>
                      <Loader2 className="mr-2 animate-spin" size={16} />
                      Analyzing...
                    </>
                  ) : (
                    <>
                      <Upload className="mr-2" size={16} />
                      Detect Blanks
                    </>
                  )}
                </Button>
                {selectedFile && (
                  <Button variant="outline" onClick={handleReset}>
                    Reset
                  </Button>
                )}
              </div>
            </div>
          )}

          {/* Step 2: Mapping */}
          {previewResult && !saveSuccess && (
            <div className="space-y-4">
              {/* Status */}
              <div className={`p-4 rounded-lg ${previewResult.hasBlanks ? 'bg-green-50 border border-green-200' : 'bg-yellow-50 border border-yellow-200'}`}>
                <div className="flex items-center gap-2">
                  {previewResult.hasBlanks ? (
                    <CheckCircle2 className="text-green-600" size={20} />
                  ) : (
                    <AlertIcon className="text-yellow-600" size={20} />
                  )}
                  <div>
                    <p className="font-medium">
                      {previewResult.hasBlanks
                        ? `Found ${previewResult.count} blank field(s)`
                        : 'No blanks detected'}
                    </p>
                    <p className="text-sm text-gray-600">
                      {previewResult.hasBlanks
                        ? 'Map each blank to an ERP variable below'
                        : 'Upload a DOCX with underscores, dots, or dashes to create blanks'}
                    </p>
                  </div>
                </div>
              </div>

              {/* Mapping Table */}
              {previewResult.hasBlanks && previewResult.blanks.length > 0 && (
                <div className="border rounded-lg overflow-hidden">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50 border-b">
                      <tr>
                        <th className="px-4 py-3 text-left font-medium text-gray-600">Blank Field</th>
                        <th className="px-4 py-3 text-left font-medium text-gray-600">Context</th>
                        <th className="px-4 py-3 text-left font-medium text-gray-600">Map to Variable</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {previewResult.blanks.map((blank) => (
                        <tr key={blank.placeholder}>
                          <td className="px-4 py-3">
                            <code className="bg-gray-100 px-2 py-1 rounded text-xs font-mono">
                              {`{{${blank.placeholder}}}`}
                            </code>
                          </td>
                          <td className="px-4 py-3 text-gray-500 text-xs">
                            <span className="line-clamp-1" title={`${blank.contextBefore}...${blank.contextAfter}`}>
                              {blank.contextBefore}
                              <span className="text-gray-400">[...]</span>
                              {blank.contextAfter}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            <Select
                              value={mappings[blank.placeholder] || ''}
                              onValueChange={(value) => handleMappingChange(blank.placeholder, value)}
                            >
                              <SelectTrigger className="w-full">
                                <SelectValue placeholder="Select variable..." />
                              </SelectTrigger>
                              <SelectContent>
                                {getAllMappingOptions().map((opt) => (
                                  <SelectItem key={opt.value} value={opt.value}>
                                    <div className="flex items-center gap-2">
                                      <Badge variant="outline" className="text-xs capitalize">
                                        {opt.category}
                                      </Badge>
                                      <span>{opt.label}</span>
                                    </div>
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {/* Error */}
              {error && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
                  {error}
                </div>
              )}

              {/* Actions */}
              <div className="flex gap-2">
                <Button
                  onClick={handleSave}
                  disabled={isSaving || !templateName.trim()}
                  className="flex-1"
                >
                  {isSaving ? (
                    <>
                      <Loader2 className="mr-2 animate-spin" size={16} />
                      Saving...
                    </>
                  ) : (
                    <>
                      <Save className="mr-2" size={16} />
                      Save Template
                    </>
                  )}
                </Button>
                <Button variant="outline" onClick={handleReset}>
                  Start Over
                </Button>
              </div>
            </div>
          )}

          {/* Step 3: Success */}
          {saveSuccess && (
            <div className="text-center py-8">
              <CheckCircle2 className="mx-auto text-green-500 mb-4" size={48} />
              <h3 className="text-lg font-semibold mb-2">Template Created!</h3>
              <p className="text-gray-600 mb-4">
                Your template has been saved and is ready to use.
              </p>
              <div className="flex gap-2 justify-center">
                <Button onClick={handleReset}>
                  Create Another
                </Button>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

// ============================================================================
// Icons (inline for simplicity)
// ============================================================================

function MagicWandIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z" />
      <path d="M5 3v4" />
      <path d="M19 17v4" />
      <path d="M3 5h4" />
      <path d="M17 19h4" />
    </svg>
  );
}

function AlertIcon({ className, size }: { className?: string; size?: number }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={size || 24}
      height={size || 24}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <circle cx="12" cy="12" r="10" />
      <line x1="12" x2="12" y1="8" y2="12" />
      <line x1="12" x2="12.01" y1="16" y2="16" />
    </svg>
  );
}

export default TemplateAutoBuilder;
