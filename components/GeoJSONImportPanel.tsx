'use client';

import React, { useState, useCallback, useRef, useEffect } from 'react';
import {
  Upload, FileText, Eye, Save, AlertCircle, CheckCircle2,
  Loader2, RefreshCw, X, ChevronRight, Info, AlertTriangle,
  MapPin, Layers, DollarSign, Square, File, Zap, Settings,
  ArrowRight, Sparkles
} from 'lucide-react';

// Maximum file size (10MB)
const MAX_FILE_SIZE = 10 * 1024 * 1024;

interface PreviewReport {
  requestId: string;
  totalFeatures: number;
  validFeatures: number;
  invalidFeatures: number;
  geometryTypeCounts: Record<string, number>;
  sampleErrors: string[];
  sampleFeature: any;
  computedBounds: { minLng: number; minLat: number; maxLng: number; maxLat: number } | null;
  missingPropertiesCounts: {
    stand_number: number;
    size_sqm: number;
    price: number;
  };
  hasCRS: boolean;
  warnings: { type: string; message: string }[];
  durationMs: number;
  importSource?: 'geojson' | 'dxf';
  dxfLayers?: string[];
  dxfStats?: {
    totalEntities: number;
    polygonEntities: number;
    circleEntities: number;
    polylineEntities: number;
    ellipseEntities: number;
    lineEntities: number;
    arcEntities: number;
  };
}

interface ImportResult {
  requestId: string;
  success: boolean;
  insertedCount: number;
  updatedCount: number;
  skippedCount: number;
  rejectedCount: number;
  rejectedReasons: string[];
  totalProcessed: number;
  durationMs: number;
}

interface GeoJSONImportPanelProps {
  developmentId: string;
  developmentName: string;
  onImportComplete?: () => void;
}

export const GeoJSONImportPanel: React.FC<GeoJSONImportPanelProps> = ({
  developmentId,
  developmentName,
  onImportComplete
}) => {
  // State
  const [geoJsonInput, setGeoJsonInput] = useState('');
  const [fileName, setFileName] = useState<string | null>(null);
  const [fileSize, setFileSize] = useState<number | null>(null);
  const [previewReport, setPreviewReport] = useState<PreviewReport | null>(null);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const [isPreviewing, setIsPreviewing] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [infoMessage, setInfoMessage] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'input' | 'preview' | 'result'>('input');
  const [inputMode, setInputMode] = useState<'text' | 'file'>('text');
  const [processingProgress, setProcessingProgress] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Reset all state
  const handleReset = useCallback(() => {
    setGeoJsonInput('');
    setFileName(null);
    setFileSize(null);
    setPreviewReport(null);
    setImportResult(null);
    setError(null);
    setInfoMessage(null);
    setActiveTab('input');
    setInputMode('text');
    setProcessingProgress(0);
  }, []);

  // Handle file drag and drop
  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);

    const files = e.dataTransfer.files;
    if (files.length > 0) {
      handleFileSelect(files[0]);
    }
  }, []);

  // Validate file before processing
  const validateFile = useCallback((file: File): { valid: boolean; error?: string } => {
    // Check file size
    if (file.size > MAX_FILE_SIZE) {
      return {
        valid: false,
        error: `File too large (${(file.size / 1024 / 1024).toFixed(1)}MB). Maximum size is 10MB.`
      };
    }

    // Check file extension
    const validExtensions = ['.json', '.geojson', '.dxf'];
    const fileExtension = file.name.toLowerCase().slice(file.name.lastIndexOf('.'));

    if (!validExtensions.includes(fileExtension)) {
      return {
        valid: false,
        error: `Invalid file type. Please upload .json, .geojson, or .dxf files only.`
      };
    }

    return { valid: true };
  }, []);

  // Handle file selection
  const handleFileSelect = useCallback((file: File) => {
    // Validate file first
    const validation = validateFile(file);
    if (!validation.valid) {
      setError(validation.error || 'Invalid file');
      return;
    }

    const fileExtension = file.name.toLowerCase().slice(file.name.lastIndexOf('.'));
    setInputMode('file');
    setFileName(file.name);
    setFileSize(file.size);
    setError(null);
    setInfoMessage(null);

    // Show loading indicator for DXF files
    if (fileExtension === '.dxf') {
      setInfoMessage('Reading DXF file...');
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      const content = e.target?.result as string;
      setGeoJsonInput(content);
      setInfoMessage(fileExtension === '.dxf'
        ? `DXF file loaded (${(file.size / 1024).toFixed(1)}KB). Ready to convert.`
        : null);
    };
    reader.onerror = () => {
      setError('Failed to read file. Please try again.');
    };
    reader.readAsText(file);
  }, [validateFile]);

  // Handle file input change
  const handleFileInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      handleFileSelect(files[0]);
    }
  }, [handleFileSelect]);

  // Simulate progress for UX
  useEffect(() => {
    if (isPreviewing && processingProgress < 90) {
      const timer = setTimeout(() => {
        setProcessingProgress(prev => Math.min(prev + 10, 90));
      }, 200);
      return () => clearTimeout(timer);
    }
    return undefined;
  }, [isPreviewing, processingProgress]);

  // Handle Preview
  const handlePreview = async () => {
    if (!geoJsonInput.trim()) {
      setError('Please enter GeoJSON/DXF data or upload a file');
      return;
    }

    setIsPreviewing(true);
    setError(null);
    setInfoMessage(null);
    setProcessingProgress(10);

    try {
      const isDxf = fileName?.toLowerCase().endsWith('.dxf') ||
        geoJsonInput.includes('SECTION') &&
        (geoJsonInput.includes('ENTITIES') || geoJsonInput.includes('HEADER'));

      const response = await fetch(`/api/developments/${developmentId}/geojson/preview`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          geoJsonData: geoJsonInput,
          source: 'file',
          fileName: fileName,
          isDxf: isDxf
        })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Preview failed');
      }

      setProcessingProgress(100);
      setPreviewReport(data);
      setActiveTab('preview');

      if (data.importSource === 'dxf') {
        setInfoMessage(`Successfully converted ${data.dxfStats?.polygonEntities || 0} entities from DXF file.`);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to preview file');
    } finally {
      setIsPreviewing(false);
      setProcessingProgress(0);
    }
  };

  // Handle Import
  const handleImport = async () => {
    if (!previewReport || previewReport.validFeatures === 0) {
      setError('No valid features to import');
      return;
    }

    setIsImporting(true);
    setError(null);

    try {
      const isDxf = fileName?.toLowerCase().endsWith('.dxf');

      const response = await fetch(`/api/developments/${developmentId}/geojson/import`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          geoJsonData: geoJsonInput,
          source: 'file',
          fileName: fileName,
          isDxf: isDxf
        })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Import failed');
      }

      setImportResult(data);
      setActiveTab('result');

      // Callback to parent
      if (onImportComplete) {
        onImportComplete();
      }
    } catch (err: any) {
      setError(err.message || 'Failed to import file');
    } finally {
      setIsImporting(false);
    }
  };

  // Render input tab
  const renderInputTab = () => (
    <div className="space-y-4">
      {/* Info Banner */}
      <div className="p-4 bg-blue-50 border border-blue-200 rounded-xl">
        <div className="flex items-start gap-3">
          <Info size={18} className="text-blue-600 mt-0.5" />
          <div className="text-sm text-blue-900">
            <p className="font-semibold mb-1">Import Guidelines</p>
            <ul className="list-disc list-inside space-y-1 text-xs opacity-80">
              <li>Supports <strong>GeoJSON</strong> (.geojson, .json) and <strong>DXF</strong> (.dxf) files</li>
              <li>GeoJSON: FeatureCollection with Polygon/MultiPolygon features</li>
              <li>DXF: LWPOLYLINE, POLYLINE, CIRCLE entities converted to polygons</li>
              <li>Required property: <code>stand_number</code></li>
              <li>Optional: <code>size_sqm</code>, <code>price</code></li>
            </ul>
          </div>
        </div>
      </div>

      {/* File Upload Zone */}
      <div>
        <label className="block text-sm font-semibold text-gray-700 mb-2">
          <File size={16} className="inline mr-2" />
          Upload File
          <span className="ml-2 text-xs font-normal text-gray-500">(GeoJSON or DXF)</span>
        </label>
        <div
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          className={`relative border-2 border-dashed rounded-xl p-8 text-center transition-all cursor-pointer ${isDragOver
              ? 'border-fcGold bg-fcGold/5'
              : 'border-gray-300 hover:border-fcGold hover:bg-gray-50'
            }`}
          onClick={() => fileInputRef.current?.click()}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept=".json,.geojson,.dxf"
            onChange={handleFileInputChange}
            className="hidden"
          />
          <div className="space-y-3">
            <div className="flex justify-center gap-4">
              <div className={`p-3 rounded-lg ${isDragOver ? 'bg-fcGold/20' : 'bg-green-50'}`}>
                <FileText size={20} className={isDragOver ? 'text-fcGold' : 'text-green-600'} />
              </div>
              <div className={`p-3 rounded-lg ${isDragOver ? 'bg-fcGold/20' : 'bg-orange-50'}`}>
                <Layers size={20} className={isDragOver ? 'text-fcGold' : 'text-orange-600'} />
              </div>
            </div>
            {fileName ? (
              <div>
                <p className="font-medium text-gray-900">{fileName}</p>
                <p className="text-xs text-gray-500">Click to replace file</p>
              </div>
            ) : (
              <div>
                <p className="font-medium text-gray-700">Drag & drop GeoJSON or DXF file</p>
                <p className="text-xs text-gray-500">or click to browse</p>
                <div className="flex justify-center gap-2 mt-2">
                  <span className="px-2 py-0.5 bg-gray-100 rounded text-xs text-gray-600">.geojson</span>
                  <span className="px-2 py-0.5 bg-gray-100 rounded text-xs text-gray-600">.json</span>
                  <span className="px-2 py-0.5 bg-orange-100 rounded text-xs text-orange-700 font-medium">.dxf</span>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Text Input */}
      <div>
        <label className="block text-sm font-semibold text-gray-700 mb-2">
          <FileText size={16} className="inline mr-2" />
          Or Paste Data
        </label>
        <textarea
          value={geoJsonInput}
          onChange={(e) => setGeoJsonInput(e.target.value)}
          placeholder={fileName?.toLowerCase().endsWith('.dxf')
            ? `# DXF file content will appear here
# Paste DXF content if not using file upload
# Supports LWPOLYLINE, POLYLINE, CIRCLE, LINE entities`
            : `{
  "type": "FeatureCollection",
  "features": [
    {
      "type": "Feature",
      "properties": {
        "stand_number": "1",
        "size_sqm": 500,
        "price": 50000
      },
      "geometry": {
        "type": "Polygon",
        "coordinates": [...]
      }
    }
  ]
}`}
          className="w-full h-64 p-4 font-mono text-xs border-2 border-gray-200 rounded-xl focus:border-fcGold focus:ring-4 focus:ring-fcGold/10 outline-none resize-none bg-gray-50"
        />
      </div>

      {/* File Type Indicator */}
      {fileName && (
        <div className={`inline-flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium ${fileName.toLowerCase().endsWith('.dxf')
            ? 'bg-orange-100 text-orange-700'
            : 'bg-green-100 text-green-700'
          }`}>
          <File size={14} />
          {fileName.toLowerCase().endsWith('.dxf') ? 'DXF File' : 'GeoJSON File'}
          <button
            onClick={(e) => {
              e.stopPropagation();
              setFileName(null);
              setInputMode('text');
            }}
            className="ml-2 hover:bg-orange-200/50 p-1 rounded"
          >
            <X size={12} />
          </button>
        </div>
      )}

      <div className="flex gap-3">
        <button
          onClick={handlePreview}
          disabled={isPreviewing || !geoJsonInput.trim()}
          className="flex-1 flex items-center justify-center gap-2 px-6 py-3 bg-gradient-to-r from-fcGold to-[#9A8B5F] text-white rounded-xl font-semibold text-sm hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed transition-all"
        >
          {isPreviewing ? (
            <>
              <Loader2 size={16} className="animate-spin" />
              {fileName?.toLowerCase().endsWith('.dxf') ? 'Converting DXF...' : 'Analyzing...'}
            </>
          ) : (
            <>
              <Eye size={16} />
              Load / Preview
            </>
          )}
        </button>

        {(geoJsonInput || fileName) && (
          <button
            onClick={handleReset}
            className="px-4 py-3 border-2 border-gray-200 rounded-xl text-gray-600 hover:bg-gray-50 transition-all"
          >
            <X size={16} />
          </button>
        )}
      </div>
    </div>
  );

  // Render preview tab
  const renderPreviewTab = () => {
    if (!previewReport) return null;

    const isDxf = previewReport.importSource === 'dxf';

    return (
      <div className="space-y-4">
        {/* Source Badge */}
        {isDxf && (
          <div className="bg-orange-50 border border-orange-200 rounded-xl p-3 flex items-center gap-2">
            <File size={16} className="text-orange-600" />
            <span className="text-sm font-medium text-orange-700">
              Converted from DXF file: {fileName}
            </span>
          </div>
        )}

        {/* DXF Entity Stats */}
        {isDxf && previewReport.dxfStats && (
          <div className="bg-gray-50 border border-gray-200 rounded-xl p-4">
            <h4 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
              <Layers size={14} />
              DXF Entity Breakdown
            </h4>
            <div className="grid grid-cols-4 gap-2">
              <div className="bg-white rounded-lg p-2 text-center">
                <p className="text-lg font-bold text-gray-900">{previewReport.dxfStats.polygonEntities}</p>
                <p className="text-xs text-gray-500">Polylines</p>
              </div>
              <div className="bg-white rounded-lg p-2 text-center">
                <p className="text-lg font-bold text-gray-900">{previewReport.dxfStats.circleEntities}</p>
                <p className="text-xs text-gray-500">Circles</p>
              </div>
              <div className="bg-white rounded-lg p-2 text-center">
                <p className="text-lg font-bold text-gray-900">{previewReport.dxfStats.polylineEntities}</p>
                <p className="text-xs text-gray-500">Polylines</p>
              </div>
              <div className="bg-white rounded-lg p-2 text-center">
                <p className="text-lg font-bold text-gray-900">{previewReport.dxfStats.ellipseEntities}</p>
                <p className="text-xs text-gray-500">Ellipses</p>
              </div>
            </div>
            {previewReport.dxfLayers && previewReport.dxfLayers.length > 0 && (
              <div className="mt-3 pt-3 border-t border-gray-200">
                <p className="text-xs text-gray-500 mb-2">DXF Layers Found:</p>
                <div className="flex flex-wrap gap-1">
                  {previewReport.dxfLayers.map((layer, i) => (
                    <span key={i} className="px-2 py-0.5 bg-orange-100 text-orange-700 rounded text-xs">
                      {layer}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Summary Cards */}
        <div className="grid grid-cols-3 gap-3">
          <div className="bg-green-50 border border-green-200 rounded-xl p-4 text-center">
            <CheckCircle2 size={24} className="text-green-600 mx-auto mb-2" />
            <p className="text-2xl font-bold text-green-900">{previewReport.validFeatures}</p>
            <p className="text-xs text-green-700 uppercase tracking-wider">Valid</p>
          </div>
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-center">
            <AlertTriangle size={24} className="text-amber-600 mx-auto mb-2" />
            <p className="text-2xl font-bold text-amber-900">{previewReport.invalidFeatures}</p>
            <p className="text-xs text-amber-700 uppercase tracking-wider">Invalid</p>
          </div>
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 text-center">
            <Layers size={24} className="text-blue-600 mx-auto mb-2" />
            <p className="text-2xl font-bold text-blue-900">{previewReport.totalFeatures}</p>
            <p className="text-xs text-blue-700 uppercase tracking-wider">Total</p>
          </div>
        </div>

        {/* Geometry Types */}
        <div className="bg-gray-50 border border-gray-200 rounded-xl p-4">
          <h4 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
            <MapPin size={14} />
            Geometry Types
          </h4>
          <div className="flex flex-wrap gap-2">
            {Object.entries(previewReport.geometryTypeCounts).map(([type, count]) => (
              <span key={type} className="px-3 py-1 bg-white border border-gray-200 rounded-full text-xs font-medium text-gray-700">
                {type}: <strong>{count}</strong>
              </span>
            ))}
          </div>
        </div>

        {/* Missing Properties */}
        <div className="bg-gray-50 border border-gray-200 rounded-xl p-4">
          <h4 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
            <AlertCircle size={14} />
            Missing Properties
          </h4>
          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-600">stand_number</span>
              <span className={`text-sm font-medium ${previewReport.missingPropertiesCounts.stand_number > 0 ? 'text-amber-600' : 'text-green-600'}`}>
                {previewReport.missingPropertiesCounts.stand_number}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-600">size_sqm</span>
              <span className="text-sm font-medium text-gray-600">{previewReport.missingPropertiesCounts.size_sqm}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-600">price</span>
              <span className="text-sm font-medium text-gray-600">{previewReport.missingPropertiesCounts.price}</span>
            </div>
          </div>
        </div>

        {/* Computed Bounds */}
        {previewReport.computedBounds && (
          <div className="bg-gray-50 border border-gray-200 rounded-xl p-4">
            <h4 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
              <Square size={14} />
              Computed Bounds
            </h4>
            <div className="grid grid-cols-2 gap-2 text-xs text-gray-600">
              <div>Lng: {previewReport.computedBounds.minLng.toFixed(4)} to {previewReport.computedBounds.maxLng.toFixed(4)}</div>
              <div>Lat: {previewReport.computedBounds.minLat.toFixed(4)} to {previewReport.computedBounds.maxLat.toFixed(4)}</div>
            </div>
          </div>
        )}

        {/* Sample Errors */}
        {previewReport.sampleErrors.length > 0 && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-4">
            <h4 className="text-sm font-semibold text-red-700 mb-3 flex items-center gap-2">
              <AlertCircle size={14} />
              Sample Errors ({previewReport.sampleErrors.length})
            </h4>
            <ul className="space-y-1 text-xs text-red-600 max-h-32 overflow-y-auto">
              {previewReport.sampleErrors.map((error, i) => (
                <li key={i}>• {error}</li>
              ))}
            </ul>
          </div>
        )}

        {/* Warnings */}
        {previewReport.warnings.length > 0 && (
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
            <h4 className="text-sm font-semibold text-amber-700 mb-3 flex items-center gap-2">
              <Info size={14} />
              Warnings
            </h4>
            <ul className="space-y-1 text-xs text-amber-600">
              {previewReport.warnings.map((w, i) => (
                <li key={i}>• {w.message}</li>
              ))}
            </ul>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex gap-3 pt-2">
          <button
            onClick={handleReset}
            className="px-4 py-3 border-2 border-gray-200 rounded-xl text-gray-600 hover:bg-gray-50 transition-all text-sm"
          >
            Cancel
          </button>
          <button
            onClick={handleImport}
            disabled={isImporting || previewReport.validFeatures === 0}
            className="flex-1 flex items-center justify-center gap-2 px-6 py-3 bg-gradient-to-r from-green-600 to-green-500 text-white rounded-xl font-semibold text-sm hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed transition-all"
          >
            {isImporting ? (
              <>
                <Loader2 size={16} className="animate-spin" />
                Importing...
              </>
            ) : (
              <>
                <Save size={16} />
                Save / Apply ({previewReport.validFeatures} stands)
              </>
            )}
          </button>
        </div>
      </div>
    );
  };

  // Render result tab
  const renderResultTab = () => {
    if (!importResult) return null;

    return (
      <div className="space-y-4">
        {/* Success/Error Header */}
        <div className={`rounded-xl p-6 text-center ${importResult.success ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'}`}>
          {importResult.success ? (
            <>
              <CheckCircle2 size={48} className="text-green-600 mx-auto mb-3" />
              <h3 className="text-lg font-bold text-green-900">Import Successful!</h3>
              <p className="text-sm text-green-700 mt-1">
                {importResult.insertedCount} new stands created, {importResult.updatedCount} updated
              </p>
            </>
          ) : (
            <>
              <AlertCircle size={48} className="text-red-600 mx-auto mb-3" />
              <h3 className="text-lg font-bold text-red-900">Import Failed</h3>
              <p className="text-sm text-red-700 mt-1">
                {importResult.insertedCount + importResult.updatedCount === 0 ? 'No stands could be imported' : 'Some stands failed'}
              </p>
            </>
          )}
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-4 gap-2">
          <div className="bg-green-50 border border-green-200 rounded-xl p-3 text-center">
            <p className="text-xl font-bold text-green-900">+{importResult.insertedCount}</p>
            <p className="text-xs text-green-700">Inserted</p>
          </div>
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 text-center">
            <p className="text-xl font-bold text-blue-900">{importResult.updatedCount}</p>
            <p className="text-xs text-blue-700">Updated</p>
          </div>
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-center">
            <p className="text-xl font-bold text-amber-900">{importResult.skippedCount}</p>
            <p className="text-xs text-amber-700">Skipped</p>
          </div>
          <div className="bg-red-50 border border-red-200 rounded-xl p-3 text-center">
            <p className="text-xl font-bold text-red-900">{importResult.rejectedCount}</p>
            <p className="text-xs text-red-700">Rejected</p>
          </div>
        </div>

        {/* Rejection Reasons */}
        {importResult.rejectedReasons.length > 0 && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-4">
            <h4 className="text-sm font-semibold text-red-700 mb-3">
              Rejection Reasons (first {Math.min(10, importResult.rejectedReasons.length)} shown)
            </h4>
            <ul className="space-y-1 text-xs text-red-600 max-h-40 overflow-y-auto">
              {importResult.rejectedReasons.slice(0, 10).map((reason, i) => (
                <li key={i}>• {reason}</li>
              ))}
            </ul>
          </div>
        )}

        {/* Duration */}
        <div className="text-center text-xs text-gray-500">
          Processed in {importResult.durationMs}ms • Request ID: {importResult.requestId}
        </div>

        {/* Action Buttons */}
        <div className="flex gap-3 pt-2">
          <button
            onClick={handleReset}
            className="flex-1 flex items-center justify-center gap-2 px-6 py-3 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl font-semibold text-sm transition-all"
          >
            <RefreshCw size={16} />
            Import Another
          </button>
          <button
            onClick={() => setActiveTab('preview')}
            className="flex-1 flex items-center justify-center gap-2 px-6 py-3 border-2 border-gray-200 rounded-xl text-gray-600 hover:bg-gray-50 transition-all"
          >
            <ChevronRight size={16} />
            Back to Preview
          </button>
        </div>
      </div>
    );
  };

  return (
    <div className="bg-white rounded-2xl border border-gray-200/80 shadow-lg overflow-hidden">
      {/* Header */}
      <div className="px-6 py-4 border-b border-gray-100 bg-gray-50">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-fcGold/10 rounded-lg">
              <Upload size={20} className="text-fcGold" />
            </div>
            <div>
              <h3 className="font-bold text-gray-900">GeoJSON/DXF Import</h3>
              <p className="text-xs text-gray-500">{developmentName}</p>
            </div>
          </div>
          <div className="flex gap-1">
            {['input', 'preview', 'result'].map((tab) => (
              <button
                key={tab}
                onClick={() => tab !== 'result' && setActiveTab(tab as any)}
                disabled={tab === 'result' && !importResult}
                className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-all ${activeTab === tab
                    ? 'bg-fcGold text-white'
                    : 'text-gray-500 hover:text-gray-700'
                  }`}
              >
                {tab.charAt(0).toUpperCase() + tab.slice(1)}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="p-6">
        {error && (
          <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-xl flex items-start gap-3">
            <AlertCircle size={18} className="text-red-600 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-red-800">Error</p>
              <p className="text-xs text-red-600 mt-1">{error}</p>
            </div>
          </div>
        )}

        {activeTab === 'input' && renderInputTab()}
        {activeTab === 'preview' && renderPreviewTab()}
        {activeTab === 'result' && renderResultTab()}
      </div>
    </div>
  );
};

export default GeoJSONImportPanel;
