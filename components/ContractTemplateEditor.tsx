'use client';

import React, { useState, useEffect } from 'react';
import { Save, Plus, Trash2, X, Globe, Building2 } from 'lucide-react';

interface TemplateVariable {
  id?: string;
  name: string;
  placeholder: string;
  dataType: 'text' | 'number' | 'date' | 'email' | 'currency';
  required: boolean;
  defaultValue?: string;
}

interface Development {
  id: string;
  name: string;
  location: string;
}

interface ContractTemplateEditorProps {
  templateId?: string;
  onSave?: (template: any) => void;
  onCancel?: () => void;
  userRole?: string;
  userBranch?: string;
}

export const ContractTemplateEditor: React.FC<ContractTemplateEditorProps> = ({
  templateId,
  onSave,
  onCancel,
  userRole = 'ADMIN',
  userBranch = 'Harare'
}) => {
  const [loading, setLoading] = useState(!!templateId);
  const [name, setName] = useState('');
  const [type, setType] = useState('purchase');
  const [description, setDescription] = useState('');
  const [content, setContent] = useState('');
  const [variables, setVariables] = useState<TemplateVariable[]>([]);
  const [newVariable, setNewVariable] = useState<TemplateVariable>({
    name: '',
    placeholder: '',
    dataType: 'text',
    required: true
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  // New state for development-specific templates
  const [developments, setDevelopments] = useState<Development[]>([]);
  const [selectedDevelopmentId, setSelectedDevelopmentId] = useState<string>('');
  const [isGlobal, setIsGlobal] = useState(true);
  const [loadingDevelopments, setLoadingDevelopments] = useState(false);

  // Load template if editing
  useEffect(() => {
    if (templateId) {
      loadTemplate();
    }
    loadDevelopments();
  }, [templateId]);

  const loadTemplate = async () => {
    try {
      const res = await fetch(`/api/admin/contracts/templates/${templateId}`);
      if (!res.ok) throw new Error('Failed to load template');

      const data = await res.json();
      const payload = data?.data || data;
      const template = payload?.template || payload;
      const sortedVariables = Array.isArray(template?.templateVariables)
        ? [...template.templateVariables]
            .map((variable: any) => ({
              ...variable,
              placeholder: variable?.placeholder || `{{${variable?.name}}}`,
            }))
            .sort((a, b) => String(a?.name || '').localeCompare(String(b?.name || '')))
        : [];
      setName(template.name);
      setType(template.type || 'purchase');
      setDescription(template.description || '');
      setContent(template.content);
      setVariables(sortedVariables);
      setIsGlobal(template.isGlobal ?? !template.developmentId);
      setSelectedDevelopmentId(template.developmentId || '');
    } catch (err: any) {
      setError(err.message);
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
      
      console.log('[ContractTemplateEditor] Loaded developments:', devs.length, devs.map(d => d.name));
      setDevelopments(devs);
    } catch (err: any) {
      console.error('Failed to load developments:', err);
      setDevelopments([]); // Ensure it's always an array on error
    } finally {
      setLoadingDevelopments(false);
    }
  };

  const handleAddVariable = () => {
    if (!newVariable.name) {
      setError('Variable name is required');
      return;
    }

    if (!newVariable.name.includes('.')) {
      setError('Variable name must use namespace.field format, e.g. client.fullName');
      return;
    }

    const placeholder = `{{${newVariable.name}}}`;
    const variable: TemplateVariable = {
      ...newVariable,
      placeholder
    };

    setVariables(
      [...variables, variable].sort((a, b) =>
        String(a?.name || '').localeCompare(String(b?.name || ''))
      )
    );
    setNewVariable({
      name: '',
      placeholder: '',
      dataType: 'text',
      required: true
    });
    setError('');
  };

  const handleRemoveVariable = (index: number) => {
    setVariables(variables.filter((_, i) => i !== index));
  };

  const insertVariablePlaceholder = (varName: string) => {
    const placeholder = `{{${varName}}}`;
    const textarea = document.querySelector('textarea[name="content"]') as HTMLTextAreaElement;
    if (textarea) {
      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      const newContent = content.substring(0, start) + placeholder + content.substring(end);
      setContent(newContent);
    }
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      setError('');

      // Enhanced validation with specific error messages
      if (!name || !name.trim()) {
        setError('Template name is required and cannot be empty');
        return;
      }

      if (!content || !content.trim()) {
        setError('Template content is required and cannot be empty');
        return;
      }

      // Development-specific validation
      if (!templateId && !isGlobal && !selectedDevelopmentId) {
        setError('Please select a development for development-specific templates');
        return;
      }

      const templateData: any = {
        name: name.trim(),
        type,
        description: description?.trim() || undefined,
        content: content.trim(),
        templateVariables: variables.length > 0 ? variables : []
      };

      // Add development/global scope for new templates
      if (!templateId) {
        if (isGlobal) {
          templateData.isGlobal = true;
          // Don't send developmentId for global templates
        } else if (selectedDevelopmentId) {
          templateData.developmentId = selectedDevelopmentId;
          templateData.isGlobal = false;
        }
      }

      const url = templateId
        ? `/api/admin/contracts/templates/${templateId}`
        : '/api/admin/contracts/templates';

      const method = templateId ? 'PUT' : 'POST';

      console.log('[ContractTemplateEditor] Submitting template:', {
        method,
        url,
        isGlobal: templateData.isGlobal,
        developmentId: templateData.developmentId,
        nameLength: templateData.name.length,
        contentLength: templateData.content.length,
        variablesCount: templateData.templateVariables.length
      });

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(templateData)
      });

      const responseData = await res.json();

      if (!res.ok) {
        const errorMessage = responseData.error || responseData.message || 'Failed to save template';
        const errorDetails = responseData.details ? ` (${responseData.details})` : '';
        
        console.error('[ContractTemplateEditor] Save failed:', {
          status: res.status,
          statusText: res.statusText,
          error: responseData
        });
        
        throw new Error(`${errorMessage}${errorDetails}`);
      }

      console.log('[ContractTemplateEditor] Template saved successfully:', responseData);
      const saved = responseData?.data || responseData;
      onSave?.(saved);
    } catch (err: any) {
      console.error('[ContractTemplateEditor] Exception during save:', err);
      setError(err.message || 'An unexpected error occurred. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  // Check if user can create development-specific templates
  const canCreateDevelopmentTemplate = ['ADMIN', 'MANAGER', 'DEVELOPER'].includes(userRole?.toUpperCase() || '');

  if (loading) {
    return <div className="text-center py-12">Loading template...</div>;
  }

  return (
    <div className="space-y-6 bg-white p-8 rounded-lg">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">
          {templateId ? 'Edit Template' : 'New Contract Template'}
        </h2>
        {onCancel && (
          <button onClick={onCancel} className="text-gray-500 hover:text-gray-700">
            <X size={24} />
          </button>
        )}
      </div>

      {/* Error message */}
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
          {error}
        </div>
      )}

      {/* Basic Info */}
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-bold mb-2">Template Name *</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g., Plot Purchase Agreement"
            className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-fcGold"
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-bold mb-2">Type</label>
            <select
              value={type}
              onChange={(e) => setType(e.target.value)}
              className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-fcGold"
            >
              <option value="purchase">Purchase Agreement</option>
              <option value="installment">Installment Plan</option>
              <option value="management">Property Management</option>
              <option value="partnership">Partnership Agreement</option>
              <option value="lease">Lease Agreement</option>
              <option value="other">Other</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-bold mb-2">Status</label>
            <select
              disabled
              className="w-full px-4 py-2 border rounded-lg bg-gray-50"
            >
              <option>Active</option>
            </select>
          </div>
        </div>

        {/* Template Scope - Only for new templates or editable by ADMIN */}
        {!templateId && canCreateDevelopmentTemplate && (
          <div className="border rounded-lg p-4 bg-gray-50">
            <label className="block text-sm font-bold mb-3">Template Scope</label>

            <div className="space-y-3">
              {/* Global Template Option */}
              <label className="flex items-start gap-3 cursor-pointer">
                <input
                  type="radio"
                  name="templateScope"
                  checked={isGlobal}
                  onChange={() => {
                    setIsGlobal(true);
                    setSelectedDevelopmentId('');
                  }}
                  className="mt-1"
                />
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <Globe size={16} className="text-blue-500" />
                    <span className="font-medium">Global Template</span>
                  </div>
                  <p className="text-sm text-gray-600 mt-1">
                    Available to all developments. Can be used by any agent or manager.
                  </p>
                </div>
              </label>

              {/* Development-Specific Option */}
              <label className="flex items-start gap-3 cursor-pointer">
                <input
                  type="radio"
                  name="templateScope"
                  checked={!isGlobal}
                  onChange={() => setIsGlobal(false)}
                  className="mt-1"
                />
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <Building2 size={16} className="text-fcGold" />
                    <span className="font-medium">Development-Specific</span>
                  </div>
                  <p className="text-sm text-gray-600 mt-1 mb-2">
                    Only available for a specific development. Use this for custom terms per estate.
                  </p>

                  {!isGlobal && (
                    <select
                      value={selectedDevelopmentId}
                      onChange={(e) => setSelectedDevelopmentId(e.target.value)}
                      disabled={loadingDevelopments}
                      className="w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-fcGold disabled:bg-gray-100"
                    >
                      {loadingDevelopments ? (
                        <option value="">Loading developments...</option>
                      ) : !Array.isArray(developments) || developments.length === 0 ? (
                        <option value="">No developments available</option>
                      ) : (
                        <>
                          <option value="">Select a development...</option>
                          {developments.map((dev) => (
                            <option key={dev.id} value={dev.id}>
                              {dev.name} ({dev.location})
                            </option>
                          ))}
                        </>
                      )}
                    </select>
                  )}

                  {!isGlobal && !selectedDevelopmentId && !loadingDevelopments && (
                    <div className="mt-2 flex items-start gap-2 text-sm text-red-600 bg-red-50 border border-red-200 rounded px-3 py-2">
                      <span className="font-bold">⚠</span>
                      <span>
                        <strong>Selection Required:</strong> Please select a development from the dropdown above to create a development-specific template.
                      </span>
                    </div>
                  )}
                </div>
              </label>
            </div>
          </div>
        )}

        {/* Show current scope for existing templates */}
        {templateId && (
          <div className="flex items-center gap-2 text-sm">
            <span className="text-gray-600">Scope:</span>
            {isGlobal ? (
              <span className="flex items-center gap-1 text-blue-600 bg-blue-50 px-2 py-1 rounded">
                <Globe size={14} /> Global Template
              </span>
            ) : selectedDevelopmentId ? (
              <span className="flex items-center gap-1 text-fcGold bg-amber-50 px-2 py-1 rounded">
                <Building2 size={14} /> Development-Specific
              </span>
            ) : (
              <span className="text-gray-500">Standard Template</span>
            )}
          </div>
        )}

        <div>
          <label className="block text-sm font-bold mb-2">Description</label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Describe what this template is for..."
            rows={2}
            className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-fcGold"
          />
        </div>
      </div>

      {/* Variables Section */}
      <div className="border-t pt-6">
        <h3 className="text-lg font-bold mb-4">Variables & Placeholders</h3>

        {/* Variable List */}
        <div className="space-y-2 mb-4">
          {variables.length > 0 && (
            <div className="bg-gray-50 rounded-lg p-4">
              {variables.map((v, i) => (
                <div
                  key={i}
                  className="flex items-center justify-between py-2 px-3 bg-white rounded mb-2 text-sm"
                >
                  <div className="flex-1">
                    <code className="text-fcGold font-bold">{v.placeholder}</code>
                    <span className="text-gray-600 ml-3">({v.dataType})</span>
                    {v.required && <span className="text-red-500 ml-2">*</span>}
                  </div>
                  <div className="space-x-2">
                    <button
                      onClick={() => insertVariablePlaceholder(v.name)}
                      className="text-xs bg-gray-200 hover:bg-gray-300 px-2 py-1 rounded"
                    >
                      Insert
                    </button>
                    <button
                      onClick={() => handleRemoveVariable(i)}
                      className="text-red-500 hover:text-red-700"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Add Variable Form */}
        <div className="bg-gray-50 p-4 rounded-lg space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <input
              type="text"
              placeholder="Variable name (e.g., clientName)"
              value={newVariable.name}
              onChange={(e) => setNewVariable({ ...newVariable, name: e.target.value })}
              className="px-3 py-2 border rounded text-sm"
            />
            <select
              value={newVariable.dataType}
              onChange={(e) => setNewVariable({ ...newVariable, dataType: e.target.value as any })}
              className="px-3 py-2 border rounded text-sm"
            >
              <option value="text">Text</option>
              <option value="number">Number</option>
              <option value="date">Date</option>
              <option value="email">Email</option>
              <option value="currency">Currency</option>
            </select>
          </div>
          <div className="flex gap-2">
            <input
              type="text"
              placeholder="Default value (optional)"
              value={newVariable.defaultValue || ''}
              onChange={(e) => setNewVariable({ ...newVariable, defaultValue: e.target.value })}
              className="flex-1 px-3 py-2 border rounded text-sm"
            />
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={newVariable.required}
                onChange={(e) => setNewVariable({ ...newVariable, required: e.target.checked })}
              />
              Required
            </label>
          </div>
          <button
            onClick={handleAddVariable}
            className="w-full bg-fcGold text-white py-2 rounded-lg font-bold text-sm hover:bg-fcGold/90 flex items-center justify-center gap-2"
          >
            <Plus size={16} /> Add Variable
          </button>
        </div>
      </div>

      {/* Template Content */}
      <div className="border-t pt-6">
        <h3 className="text-lg font-bold mb-4">Template Content</h3>
        <p className="text-sm text-gray-600 mb-3">
          Click "Insert" above to add variables to the content, or type them manually as {'{{variableName}}'} format
        </p>
        <textarea
          name="content"
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder="Enter your contract template here. Use {{variable}} syntax for placeholders..."
          rows={15}
          className="w-full px-4 py-3 border rounded-lg font-mono text-sm focus:outline-none focus:ring-2 focus:ring-fcGold"
        />
      </div>

      {/* Action Buttons */}
      <div className="flex gap-3 pt-6 border-t">
        <button
          onClick={handleSave}
          disabled={saving || (!isGlobal && !selectedDevelopmentId && !templateId)}
          className="flex-1 bg-fcGold text-white py-3 rounded-lg font-bold hover:bg-fcGold/90 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          title={
            !isGlobal && !selectedDevelopmentId && !templateId
              ? 'Please select a development first'
              : ''
          }
        >
          <Save size={18} />
          {saving ? 'Saving...' : 
           (!isGlobal && !selectedDevelopmentId && !templateId) ? 'Select Development First' :
           'Save Template'}
        </button>
        {onCancel && (
          <button
            onClick={onCancel}
            className="flex-1 bg-gray-200 text-gray-800 py-3 rounded-lg font-bold hover:bg-gray-300"
          >
            Cancel
          </button>
        )}
      </div>
    </div>
  );
};

export default ContractTemplateEditor;
