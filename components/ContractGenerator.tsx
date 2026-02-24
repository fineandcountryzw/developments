'use client';

import React, { useState, useEffect } from 'react';
import { Send, Loader2, Globe, Building2, Filter } from 'lucide-react';

interface Template {
  id: string;
  name: string;
  type: string;
  description?: string;
  isGlobal?: boolean;
  developmentId?: string;
  development?: {
    id: string;
    name: string;
  };
  templateVariables?: Array<{
    name: string;
    dataType: string;
    required: boolean;
    defaultValue?: string;
  }>;
}

interface Development {
  id: string;
  name: string;
  location: string;
}

interface StandOption {
  id: string;
  standNumber: string;
  status?: string;
  developmentId?: string;
  development?: {
    id: string;
    name: string;
  };
}

interface ContractGeneratorProps {
  dealId?: string;
  clientId?: string;
  clientName?: string;
  standId?: string;
  developmentId?: string; // Pre-selected development
  onSuccess?: (contractId: string) => void;
}

export const ContractGenerator: React.FC<ContractGeneratorProps> = ({
  dealId,
  clientId,
  clientName,
  standId,
  developmentId: preSelectedDevelopmentId,
  onSuccess
}) => {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [filteredTemplates, setFilteredTemplates] = useState<Template[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState<Template | null>(null);
  const [variables, setVariables] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // New state for filtering
  const [developments, setDevelopments] = useState<Development[]>([]);
  const [selectedDevelopmentId, setSelectedDevelopmentId] = useState<string>(preSelectedDevelopmentId || '');
  const [filterByDevelopment, setFilterByDevelopment] = useState<'all' | 'global' | 'development'>('all');
  const [loadingDevelopments, setLoadingDevelopments] = useState(false);
  const [stands, setStands] = useState<StandOption[]>([]);
  const [selectedStandId, setSelectedStandId] = useState<string>(standId || '');
  const [loadingStands, setLoadingStands] = useState(false);

  // Load templates on mount
  useEffect(() => {
    loadTemplates();
    loadDevelopments();
    if (!standId) {
      loadStands();
    }
  }, []);

  useEffect(() => {
    if (standId) {
      setSelectedStandId(standId);
    }
  }, [standId]);

  // Filter templates when selection changes
  useEffect(() => {
    filterTemplates();
  }, [templates, filterByDevelopment, selectedDevelopmentId]);

  // Pre-fill client name if provided
  useEffect(() => {
    if (clientName && selectedTemplate) {
      const clientNameVar = selectedTemplate.templateVariables?.find(
        v => v.name.toLowerCase().includes('client')
      );
      if (clientNameVar) {
        setVariables(prev => ({
          ...prev,
          [clientNameVar.name]: clientName
        }));
      }
    }
  }, [clientName, selectedTemplate]);

  const loadTemplates = async () => {
    try {
      setLoading(true);
      // Use the new API that returns scoped templates based on user role
      const res = await fetch('/api/admin/contracts/templates?status=ACTIVE&includeGlobal=true');
      if (!res.ok) throw new Error('Failed to load templates');

      const response = await res.json();
      // Handle apiSuccess wrapper: { success: true, data: { templates: [...] } }
      let templateList: Template[] = [];
      
      if (Array.isArray(response)) {
        templateList = response;
      } else if (response && typeof response === 'object') {
        // Handle apiSuccess wrapper: response.data contains the actual payload
        const payload = response.data || response;
        
        if (Array.isArray(payload)) {
          templateList = payload;
        } else if (payload && typeof payload === 'object') {
          // Try payload.templates or payload.data
          templateList = Array.isArray(payload.templates) ? payload.templates :
                        Array.isArray(payload.data) ? payload.data :
                        [];
        }
      }
      
      console.log('[ContractGenerator] Loaded templates:', templateList.length, templateList.map(t => t.name));
      setTemplates(templateList);
    } catch (err: any) {
      console.error('[ContractGenerator] Failed to load templates:', err);
      setError(err.message);
      setTemplates([]); // Ensure templates is always an array even on error
    } finally {
      setLoading(false);
    }
  };

  const loadDevelopments = async () => {
    try {
      setLoadingDevelopments(true);
      const res = await fetch('/api/admin/developments?limit=100');
      if (!res.ok) throw new Error('Failed to load developments');

      const response = await res.json();
      // Robust extraction: handle apiSuccess wrapper { success, data: { data, developments } }
      let devs: Development[] = [];
      
      // If response is directly an array
      if (Array.isArray(response)) {
        devs = response;
      } else if (response && typeof response === 'object') {
        // Handle apiSuccess wrapper: response.data contains the actual payload
        const payload = response.data || response;
        
        if (Array.isArray(payload)) {
          devs = payload;
        } else if (payload && typeof payload === 'object') {
          // Try payload.data or payload.developments
          devs = Array.isArray(payload.data) ? payload.data :
                 Array.isArray(payload.developments) ? payload.developments :
                 Array.isArray(payload.items) ? payload.items :
                 [];
        }
      }
      
      console.log('[ContractGenerator] Loaded developments:', devs.length, devs.map(d => d.name));
      setDevelopments(devs);
    } catch (err: any) {
      console.error('Failed to load developments:', err);
      setDevelopments([]); // Ensure it's always an array on error
    } finally {
      setLoadingDevelopments(false);
    }
  };

  const loadStands = async () => {
    try {
      setLoadingStands(true);
      const res = await fetch('/api/admin/stands');
      if (!res.ok) throw new Error('Failed to load stands');

      const response = await res.json();
      const payload = response?.data || response;
      const standList: StandOption[] = Array.isArray(payload)
        ? payload
        : Array.isArray(payload?.stands)
        ? payload.stands
        : [];

      setStands(
        [...standList].sort((a, b) =>
          String(a?.standNumber || '').localeCompare(String(b?.standNumber || ''))
        )
      );
    } catch (err) {
      console.error('[ContractGenerator] Failed to load stands:', err);
      setStands([]);
    } finally {
      setLoadingStands(false);
    }
  };

  const filterTemplates = () => {
    // Defensive check: ensure templates is an array
    if (!Array.isArray(templates)) {
      setFilteredTemplates([]);
      return;
    }

    let filtered = [...templates];

    switch (filterByDevelopment) {
      case 'global':
        filtered = filtered.filter(t => t.isGlobal);
        break;
      case 'development':
        if (selectedDevelopmentId) {
          filtered = filtered.filter(t =>
            t.developmentId === selectedDevelopmentId || t.isGlobal
          );
        } else {
          // Show only development-specific templates
          filtered = filtered.filter(t => !t.isGlobal);
        }
        break;
      case 'all':
      default:
        // Show all templates user has access to
        if (selectedDevelopmentId) {
          // If a development is selected, prioritize its templates
          filtered = filtered.filter(t =>
            t.isGlobal || t.developmentId === selectedDevelopmentId
          );
        }
        break;
    }

    setFilteredTemplates(filtered);
  };

  const handleTemplateSelect = (template: Template) => {
    setSelectedTemplate(template);
    setVariables({});
    setError('');
    setSuccess('');

    // Pre-fill default values
    const defaults: Record<string, string> = {};
    template.templateVariables?.forEach(v => {
      if (v.defaultValue) {
        defaults[v.name] = v.defaultValue;
      }
    });
    setVariables(defaults);
  };

  const handleVariableChange = (varName: string, value: string) => {
    setVariables(prev => ({
      ...prev,
      [varName]: value
    }));
  };

  const validateVariables = (): boolean => {
    if (!selectedTemplate) return false;

    const autoResolvedNamespaces = new Set([
      'client',
      'stand',
      'development',
      'terms',
      'pricing',
      'contract'
    ]);

    // Check for required template variables
    for (const v of selectedTemplate.templateVariables || []) {
      const namespace = v.name?.split('.')?.[0];
      const isAutoResolved = namespace && autoResolvedNamespaces.has(namespace);

      if (v.required && !isAutoResolved && !variables[v.name]) {
        setError(`Required field missing: ${v.name}`);
        return false;
      }
    }
    return true;
  };

  const validateTemplateForDevelopment = (): boolean => {
    if (!selectedTemplate) return false;

    // Warn if using a development-specific template without a matching stand/development context
    if (selectedTemplate.developmentId && selectedDevelopmentId && 
        selectedTemplate.developmentId !== selectedDevelopmentId) {
      setError('Selected template is specific to a different development. Please choose a compatible template.');
      return false;
    }

    return true;
  };

  const handleGenerate = async () => {
    try {
      if (!validateVariables()) return;
      if (!validateTemplateForDevelopment()) return;
      if (!selectedTemplate) {
        setError('Please select a template');
        return;
      }

      const effectiveStandId = standId || selectedStandId;
      if (!effectiveStandId) {
        setError('Stand ID is required to generate a contract');
        return;
      }

      // Log template selection for debugging
      console.log('Generating contract with template:', {
        templateId: selectedTemplate.id,
        templateName: selectedTemplate.name,
        isGlobal: selectedTemplate.isGlobal,
        developmentId: selectedTemplate.developmentId
      });

      setGenerating(true);
      setError('');

      const res = await fetch('/api/admin/contracts/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          standId: effectiveStandId,
          templateId: selectedTemplate.id,
          preview: false,
          variables
        })
      });

      const data = await res.json();
      
      if (!res.ok) {
        // Extract detailed error message from API response
        const errorMessage = data.error || data.message || 
          (data.data && data.data.message) || 
          'Failed to generate contract';
        
        // Log detailed error for debugging
        console.error('Contract generation failed:', {
          status: res.status,
          error: errorMessage,
          templateId: selectedTemplate.id,
          templateName: selectedTemplate.name,
          isDevelopmentSpecific: !selectedTemplate.isGlobal && !!selectedTemplate.developmentId
        });
        
        throw new Error(errorMessage);
      }
      
      // Handle apiSuccess response format
      const contractId = data.data?.contract?.id || data.contract?.id;
      
      if (!contractId) {
        console.warn('Contract generated but no ID returned:', data);
      }
      
      setSuccess('Contract generated successfully!');
      onSuccess?.(contractId);

      // Reset form
      setTimeout(() => {
        setSelectedTemplate(null);
        setVariables({});
        setSuccess('');
      }, 2000);
    } catch (err: any) {
      console.error('Contract generation error:', err);
      setError(err.message || 'An unexpected error occurred during contract generation');
    } finally {
      setGenerating(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="animate-spin" size={32} />
      </div>
    );
  }

  return (
    <div className="space-y-6 bg-white p-8 rounded-lg">
      <h2 className="text-2xl font-bold">Generate Contract</h2>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
          {error}
        </div>
      )}

      {success && (
        <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-lg">
          {success}
        </div>
      )}

      {!standId && (
        <div>
          <label className="block text-sm font-bold mb-2">
            Select Stand *
          </label>
          <select
            value={selectedStandId}
            onChange={(e) => setSelectedStandId(e.target.value)}
            disabled={loadingStands}
            className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-fcGold"
          >
            <option value="">
              {loadingStands ? 'Loading stands...' : 'Select a stand...'}
            </option>
            {stands
              .filter((standOption) =>
                selectedDevelopmentId
                  ? standOption.developmentId === selectedDevelopmentId
                  : true
              )
              .map((standOption) => (
                <option key={standOption.id} value={standOption.id}>
                  {standOption.standNumber}
                  {standOption.development?.name
                    ? ` - ${standOption.development.name}`
                    : ''}
                  {standOption.status ? ` (${standOption.status})` : ''}
                </option>
              ))}
          </select>
          <p className="text-xs text-gray-500 mt-1">
            Client data is auto-filled from the stand&apos;s latest reservation.
          </p>
        </div>
      )}

      {/* Template Filter */}
      <div className="border rounded-lg p-4 bg-gray-50">
        <div className="flex items-center gap-2 mb-3">
          <Filter size={16} className="text-gray-600" />
          <span className="font-medium text-sm">Filter Templates</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Filter Type */}
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Template Type</label>
            <select
              value={filterByDevelopment}
              onChange={(e) => setFilterByDevelopment(e.target.value as any)}
              className="w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-fcGold"
            >
              <option value="all">All Templates</option>
              <option value="global">Global Templates Only</option>
              <option value="development">Development-Specific</option>
            </select>
          </div>

          {/* Development Selector */}
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">
              Development {filterByDevelopment === 'development' && <span className="text-red-500">*</span>}
            </label>
            <select
              value={selectedDevelopmentId}
              onChange={(e) => setSelectedDevelopmentId(e.target.value)}
              disabled={loadingDevelopments}
              className="w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-fcGold"
            >
              <option value="">
                {filterByDevelopment === 'development'
                  ? 'Select a development...'
                  : 'Any Development'}
              </option>
              {Array.isArray(developments) && developments.map((dev) => (
                <option key={dev.id} value={dev.id}>
                  {dev.name} ({dev.location})
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Template Selection */}
      <div>
        <label className="block text-sm font-bold mb-3">
          Select Template *
          <span className="text-gray-500 font-normal ml-2">
            ({filteredTemplates.length} available)
          </span>
        </label>

        {filteredTemplates.length === 0 ? (
          <div className="text-center py-8 bg-gray-50 rounded-lg">
            <p className="text-gray-500">No templates match your filters.</p>
            <button
              onClick={() => {
                setFilterByDevelopment('all');
                setSelectedDevelopmentId('');
              }}
              className="text-fcGold hover:underline text-sm mt-2"
            >
              Clear filters
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-96 overflow-y-auto">
            {filteredTemplates.map(template => (
              <button
                key={template.id}
                onClick={() => handleTemplateSelect(template)}
                className={`p-4 rounded-lg border-2 text-left transition-all ${
                  selectedTemplate?.id === template.id
                    ? 'border-fcGold bg-fcGold/10'
                    : 'border-gray-200 hover:border-fcGold'
                }`}
              >
                <div className="flex items-start justify-between">
                  <h4 className="font-bold">{template.name}</h4>
                  {/* Scope Badge */}
                  {template.isGlobal ? (
                    <span className="flex items-center gap-1 text-xs text-blue-600 bg-blue-50 px-2 py-0.5 rounded">
                      <Globe size={12} /> Global
                    </span>
                  ) : template.development ? (
                    <span className="flex items-center gap-1 text-xs text-fcGold bg-amber-50 px-2 py-0.5 rounded">
                      <Building2 size={12} /> {template.development.name}
                    </span>
                  ) : (
                    <span className="flex items-center gap-1 text-xs text-fcGold bg-amber-50 px-2 py-0.5 rounded">
                      <Building2 size={12} /> Dev-Specific
                    </span>
                  )}
                </div>
                <p className="text-xs text-gray-600 mt-1">{template.type}</p>
                {template.description && (
                  <p className="text-xs text-gray-500 mt-2 line-clamp-2">{template.description}</p>
                )}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Variables Form */}
      {selectedTemplate && (
        <div className="border-t pt-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-bold">Contract Details</h3>
            <span className="text-sm text-gray-500">
              Using: {selectedTemplate.name}
            </span>
          </div>

          <div className="space-y-4">
            {[...(selectedTemplate.templateVariables || [])]
              .sort((a, b) => String(a?.name || '').localeCompare(String(b?.name || '')))
              .map(variable => (
              <div key={variable.name}>
                <label className="block text-sm font-bold mb-2">
                  {variable.name.replace(/([A-Z])/g, ' $1').trim()}
                  {variable.required && !variable.name.includes('.') && <span className="text-red-500">*</span>}
                </label>

                {variable.dataType === 'date' ? (
                  <input
                    type="date"
                    value={variables[variable.name] || ''}
                    onChange={(e) => handleVariableChange(variable.name, e.target.value)}
                    className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-fcGold"
                  />
                ) : variable.dataType === 'email' ? (
                  <input
                    type="email"
                    value={variables[variable.name] || ''}
                    onChange={(e) => handleVariableChange(variable.name, e.target.value)}
                    className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-fcGold"
                  />
                ) : variable.dataType === 'number' || variable.dataType === 'currency' ? (
                  <input
                    type="number"
                    value={variables[variable.name] || ''}
                    onChange={(e) => handleVariableChange(variable.name, e.target.value)}
                    className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-fcGold"
                  />
                ) : (
                  <input
                    type="text"
                    value={variables[variable.name] || ''}
                    onChange={(e) => handleVariableChange(variable.name, e.target.value)}
                    placeholder={variable.defaultValue || `Enter ${variable.name.toLowerCase()}`}
                    className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-fcGold"
                  />
                )}
              </div>
            ))}
          </div>

          {/* Generate Button */}
          <div className="mt-6 flex gap-3">
            <button
              onClick={handleGenerate}
              disabled={generating}
              className="flex-1 bg-fcGold text-white py-3 rounded-lg font-bold hover:bg-fcGold/90 disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {generating ? (
                <>
                  <Loader2 className="animate-spin" size={18} />
                  Generating...
                </>
              ) : (
                <>
                  <Send size={18} />
                  Generate Contract
                </>
              )}
            </button>
            <button
              onClick={() => {
                setSelectedTemplate(null);
                setVariables({});
                setError('');
              }}
              className="flex-1 bg-gray-200 text-gray-800 py-3 rounded-lg font-bold hover:bg-gray-300"
            >
              Clear
            </button>
          </div>
        </div>
      )}

      {templates.length === 0 && !loading && (
        <div className="text-center py-12 text-gray-500">
          <p>No templates available. Create a template first.</p>
        </div>
      )}
    </div>
  );
};

export default ContractGenerator;
