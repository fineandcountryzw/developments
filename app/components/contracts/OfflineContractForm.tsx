'use client';

import { useState, useEffect } from 'react';
import { FileText, Download, User, Building, Search, AlertCircle, ChevronDown, Check } from 'lucide-react';

interface ContractTemplate {
  id: string;
  name: string;
  description: string | null;
  content: string;
  variables?: Array<{ name: string; required?: boolean; dataType?: string }>;
  templateVariables?: Array<{ name: string; required?: boolean; dataType?: string }>;
  status: string;
  developmentId: string | null;
  isGlobal: boolean | null;
}

interface OfflineContractFormProps {
  sale?: unknown;
  onGenerated?: (contractId: string) => void;
}

interface Client {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  branch: string;
}

interface Stand {
  id: string;
  standNumber: string;
  developmentId: string;
  development: {
    id: string;
    name: string;
  };
  price: number;
  sizeSqm: number;
  status: string;
  branch: string;
}

export function OfflineContractForm({ onGenerated }: OfflineContractFormProps = {}) {
  // Form state
  const [selectedTemplate, setSelectedTemplate] = useState<ContractTemplate | null>(null);
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [selectedStand, setSelectedStand] = useState<Stand | null>(null);
  const [contractDate, setContractDate] = useState('');
  const [notes, setNotes] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);

  // Data state
  const [templates, setTemplates] = useState<ContractTemplate[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [stands, setStands] = useState<Stand[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Search/filter state
  const [clientSearch, setClientSearch] = useState('');
  const [standSearch, setStandSearch] = useState('');
  const [developmentFilter, setDevelopmentFilter] = useState('');

  // Dropdown visibility
  const [showTemplateDropdown, setShowTemplateDropdown] = useState(false);
  const [showClientDropdown, setShowClientDropdown] = useState(false);
  const [showStandDropdown, setShowStandDropdown] = useState(false);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [templatesRes, clientsRes, standsRes] = await Promise.all([
        fetch('/api/admin/contracts/templates?status=ACTIVE&includeGlobal=true'),
        fetch('/api/admin/clients?limit=100'),
        fetch('/api/admin/stands?limit=200'),
      ]);

      const [templatesData, clientsData, standsData] = await Promise.all([
        templatesRes.json(),
        clientsRes.json(),
        standsRes.json(),
      ]);

      if (!templatesRes.ok) throw new Error(templatesData.error || 'Failed to fetch templates');
      if (!clientsRes.ok) throw new Error(clientsData.error || 'Failed to fetch clients');
      if (!standsRes.ok) throw new Error(standsData.error || 'Failed to fetch stands');

      const templatePayload = templatesData?.data || templatesData;
      const templateList = Array.isArray(templatePayload)
        ? templatePayload
        : Array.isArray(templatePayload?.templates)
        ? templatePayload.templates
        : [];

      const normalizedTemplates: ContractTemplate[] = templateList.map((template: any) => ({
        ...template,
        variables: Array.isArray(template?.templateVariables)
          ? template.templateVariables
          : Array.isArray(template?.variables)
          ? template.variables
          : [],
      }));

      setTemplates(
        normalizedTemplates.sort((a, b) =>
          String(a?.name || '').localeCompare(String(b?.name || ''))
        )
      );
      setClients(clientsData.data?.data || clientsData.data || []);
      setStands(standsData.data?.stands || standsData.stands || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  const handleGenerate = async () => {
    if (!selectedTemplate || !selectedClient || !selectedStand) {
      setError('Please select a template, client, and stand');
      return;
    }

    setIsGenerating(true);
    setError(null);

    try {
      const response = await fetch('/api/admin/contracts/offline', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          templateId: selectedTemplate.id,
          clientId: selectedClient.id,
          standId: selectedStand.id,
          contractDate: contractDate || new Date().toISOString().split('T')[0],
          notes,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to generate contract');
      }

      alert('Contract generated successfully!');
      if (result?.contract?.id) {
        onGenerated?.(result.contract.id);
      }
      // Reset form
      setSelectedTemplate(null);
      setSelectedClient(null);
      setSelectedStand(null);
      setNotes('');
      setContractDate('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Generation failed');
    } finally {
      setIsGenerating(false);
    }
  };

  // Filter clients
  const filteredClients = clients.filter(client =>
    client.name.toLowerCase().includes(clientSearch.toLowerCase()) ||
    client.email.toLowerCase().includes(clientSearch.toLowerCase()) ||
    (client.phone && client.phone.includes(clientSearch))
  );

  // Filter stands
  const filteredStands = stands.filter(stand => {
    const matchesSearch = stand.standNumber.toLowerCase().includes(standSearch.toLowerCase()) ||
      stand.development.name.toLowerCase().includes(standSearch.toLowerCase());
    const matchesDevelopment = !developmentFilter || stand.developmentId === developmentFilter;
    return matchesSearch && matchesDevelopment;
  });

  // Filter templates based on selected stand's development
  const filteredTemplates = templates.filter(template => {
    // If no stand is selected, show all templates
    if (!selectedStand) {
      return true;
    }
    // Show global templates (is_global = true) OR templates specific to this development
    return template.isGlobal === true || template.developmentId === selectedStand.developmentId;
  });

  // Get unique developments
  const developments = Array.from(new Set(stands.map(s => s.development.id)))
    .map(id => stands.find(s => s.development.id === id)?.development)
    .filter(Boolean) as { id: string; name: string }[];

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full" />
      </div>
    );
  }

  if (error && !selectedTemplate && !selectedClient && !selectedStand) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-6 text-red-700">
        <div className="flex items-center gap-2 mb-2">
          <AlertCircle className="w-5 h-5" />
          <span className="font-medium">Error</span>
        </div>
        <p>{error}</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-blue-100 rounded-lg">
            <FileText className="w-5 h-5 text-blue-600" />
          </div>
          <h3 className="text-lg font-semibold text-gray-900">
            Generate Offline Contract
          </h3>
        </div>
        <button
          onClick={fetchData}
          className="text-sm text-blue-600 hover:text-blue-700"
        >
          Refresh
        </button>
      </div>

      {/* Template Selection */}
      <div className="mb-6">
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Select Contract Template
          {selectedStand && (
            <span className="ml-2 text-xs text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full">
              Filtered for {selectedStand.development.name}
            </span>
          )}
        </label>
        <div className="relative">
          <button
            onClick={() => setShowTemplateDropdown(!showTemplateDropdown)}
            className="w-full px-4 py-3 border border-gray-300 rounded-lg bg-white text-left flex items-center justify-between hover:border-blue-400 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            <span className={selectedTemplate ? 'text-gray-900' : 'text-gray-500'}>
              {selectedTemplate ? selectedTemplate.name : 'Choose a template...'}
            </span>
            <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform ${showTemplateDropdown ? 'rotate-180' : ''}`} />
          </button>
          
          {showTemplateDropdown && (
            <div className="absolute z-10 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-60 overflow-y-auto">
              {filteredTemplates.length === 0 ? (
                <div className="p-4 text-gray-500 text-sm">
                  {selectedStand 
                    ? 'No templates available for this development. Select a different stand or create a template for this development.'
                    : 'No templates available'}
                </div>
              ) : (
                filteredTemplates.map((template) => (
                  <button
                    key={template.id}
                    onClick={() => {
                      setSelectedTemplate(template);
                      setShowTemplateDropdown(false);
                    }}
                    className="w-full px-4 py-3 text-left hover:bg-blue-50 border-b border-gray-100 last:border-b-0 flex items-center justify-between"
                  >
                    <div className="flex-1">
                      <div className="font-medium text-gray-900 flex items-center gap-2">
                        {template.name}
                        {template.isGlobal && (
                          <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">Global</span>
                        )}
                        {template.developmentId && !template.isGlobal && (
                          <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full">Development</span>
                        )}
                      </div>
                      {template.description && (
                        <div className="text-xs text-gray-500 mt-1">{template.description}</div>
                      )}
                    </div>
                    {selectedTemplate?.id === template.id && (
                      <Check className="w-4 h-4 text-blue-600" />
                    )}
                  </button>
                ))
              )}
            </div>
          )}
        </div>
      </div>

      {/* Client Selection */}
      <div className="mb-6">
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Select Client
        </label>
        <div className="relative">
          <button
            onClick={() => setShowClientDropdown(!showClientDropdown)}
            className="w-full px-4 py-3 border border-gray-300 rounded-lg bg-white text-left flex items-center justify-between hover:border-blue-400 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            <span className={selectedClient ? 'text-gray-900' : 'text-gray-500'}>
              {selectedClient ? selectedClient.name : 'Choose a client...'}
            </span>
            <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform ${showClientDropdown ? 'rotate-180' : ''}`} />
          </button>
          
          {showClientDropdown && (
            <div className="absolute z-10 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-80 overflow-y-auto">
              <div className="p-3 border-b border-gray-100">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    type="text"
                    placeholder="Search clients..."
                    value={clientSearch}
                    onChange={(e) => setClientSearch(e.target.value)}
                    onClick={(e) => e.stopPropagation()}
                    className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
              </div>
              {filteredClients.length === 0 ? (
                <div className="p-4 text-gray-500 text-sm">No clients found</div>
              ) : (
                filteredClients.map((client) => (
                  <button
                    key={client.id}
                    onClick={() => {
                      setSelectedClient(client);
                      setShowClientDropdown(false);
                      setClientSearch('');
                    }}
                    className="w-full px-4 py-3 text-left hover:bg-blue-50 border-b border-gray-100 last:border-b-0 flex items-center justify-between"
                  >
                    <div>
                      <div className="font-medium text-gray-900 flex items-center gap-2">
                        <User className="w-4 h-4 text-gray-400" />
                        {client.name}
                      </div>
                      <div className="text-xs text-gray-500 mt-1">{client.email}</div>
                      {client.phone && (
                        <div className="text-xs text-gray-400">{client.phone}</div>
                      )}
                    </div>
                    {selectedClient?.id === client.id && (
                      <Check className="w-4 h-4 text-blue-600" />
                    )}
                  </button>
                ))
              )}
            </div>
          )}
        </div>
      </div>

      {/* Stand Selection */}
      <div className="mb-6">
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Select Stand
        </label>
        <div className="relative">
          <button
            onClick={() => setShowStandDropdown(!showStandDropdown)}
            className="w-full px-4 py-3 border border-gray-300 rounded-lg bg-white text-left flex items-center justify-between hover:border-blue-400 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            <span className={selectedStand ? 'text-gray-900' : 'text-gray-500'}>
              {selectedStand ? `${selectedStand.standNumber} - ${selectedStand.development.name}` : 'Choose a stand...'}
            </span>
            <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform ${showStandDropdown ? 'rotate-180' : ''}`} />
          </button>
          
          {showStandDropdown && (
            <div className="absolute z-10 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-80 overflow-y-auto">
              <div className="p-3 border-b border-gray-100 space-y-2">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    type="text"
                    placeholder="Search stands..."
                    value={standSearch}
                    onChange={(e) => setStandSearch(e.target.value)}
                    onClick={(e) => e.stopPropagation()}
                    className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
                {developments.length > 1 && (
                  <select
                    value={developmentFilter}
                    onChange={(e) => setDevelopmentFilter(e.target.value)}
                    onClick={(e) => e.stopPropagation()}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="">All Developments</option>
                    {developments.map((dev) => (
                      <option key={dev.id} value={dev.id}>{dev.name}</option>
                    ))}
                  </select>
                )}
              </div>
              {filteredStands.length === 0 ? (
                <div className="p-4 text-gray-500 text-sm">No stands found</div>
              ) : (
                filteredStands.map((stand) => (
                  <button
                    key={stand.id}
                    onClick={() => {
                      setSelectedStand(stand);
                      setShowStandDropdown(false);
                      setStandSearch('');
                      setDevelopmentFilter('');
                      // Clear selected template if it's not valid for this development
                      if (selectedTemplate && !selectedTemplate.isGlobal && selectedTemplate.developmentId !== stand.developmentId) {
                        setSelectedTemplate(null);
                      }
                    }}
                    className="w-full px-4 py-3 text-left hover:bg-blue-50 border-b border-gray-100 last:border-b-0 flex items-center justify-between"
                  >
                    <div>
                      <div className="font-medium text-gray-900 flex items-center gap-2">
                        <Building className="w-4 h-4 text-gray-400" />
                        {stand.standNumber}
                      </div>
                      <div className="text-xs text-gray-500 mt-1">{stand.development.name}</div>
                      <div className="text-xs text-gray-400">
                        {stand.sizeSqm}m² • R {Number(stand.price).toLocaleString()} • {stand.status}
                      </div>
                    </div>
                    {selectedStand?.id === stand.id && (
                      <Check className="w-4 h-4 text-blue-600" />
                    )}
                  </button>
                ))
              )}
            </div>
          )}
        </div>
      </div>

      {/* Contract Details */}
      <div className="space-y-4 mb-6">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Contract Date
          </label>
          <input
            type="date"
            value={contractDate}
            onChange={e => setContractDate(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Notes (optional)
          </label>
          <textarea
            value={notes}
            onChange={e => setNotes(e.target.value)}
            rows={3}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            placeholder="Additional notes for the contract..."
          />
        </div>
      </div>

      {error && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
          {error}
        </div>
      )}

      {/* Selected Items Summary */}
      {(selectedTemplate || selectedClient || selectedStand) && (
        <div className="bg-gray-50 rounded-lg p-4 mb-6">
          <h4 className="font-medium text-gray-900 mb-3">Selected Items</h4>
          <div className="space-y-2 text-sm">
            {selectedTemplate && (
              <div className="flex items-center gap-2">
                <FileText className="w-4 h-4 text-blue-600" />
                <span className="text-gray-600">Template:</span>
                <span className="font-medium">{selectedTemplate.name}</span>
              </div>
            )}
            {selectedClient && (
              <div className="flex items-center gap-2">
                <User className="w-4 h-4 text-blue-600" />
                <span className="text-gray-600">Client:</span>
                <span className="font-medium">{selectedClient.name}</span>
                <span className="text-gray-400">({selectedClient.email})</span>
              </div>
            )}
            {selectedStand && (
              <div className="flex items-center gap-2">
                <Building className="w-4 h-4 text-blue-600" />
                <span className="text-gray-600">Stand:</span>
                <span className="font-medium">{selectedStand.standNumber}</span>
                <span className="text-gray-400">- {selectedStand.development.name}</span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="flex gap-4">
        <button
          onClick={handleGenerate}
          disabled={isGenerating || !selectedTemplate || !selectedClient || !selectedStand}
          className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isGenerating ? (
            <>
              <div className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full" />
              Generating...
            </>
          ) : (
            <>
              <Download className="w-4 h-4" />
              Generate Contract
            </>
          )}
        </button>
      </div>

      <p className="mt-4 text-xs text-gray-500 text-center">
        This will generate a PDF agreement of sale without e-signature.
        The contract will be linked to the client and billing records.
      </p>
    </div>
  );
}
