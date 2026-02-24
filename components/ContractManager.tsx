'use client';

import React, { useState, useEffect } from 'react';
import { supabaseMock } from '@/services/supabase';
import { formatDistanceToNow } from 'date-fns';

interface ContractTemplate {
  id: string;
  name: string;
  description?: string;
  content: string;
  variables: string[];
  branch: string;
  status: string;
  createdAt: string;
  updatedAt: string;
}

interface GeneratedContract {
  id: string;
  clientId: string;
  templateId: string;
  standId: string;
  templateName: string;
  content: string;
  status: string;
  signedAt?: string;
  signedBy?: string;
  branch: string;
  createdAt: string;
}

interface Client {
  id: string;
  name: string;
  email: string;
  phone: string;
  branch: string;
}

type Tab = 'templates' | 'generate' | 'contracts';

export function ContractManager() {
  const [activeTab, setActiveTab] = useState<Tab>('templates');
  const [templates, setTemplates] = useState<ContractTemplate[]>([]);
  const [contracts, setContracts] = useState<GeneratedContract[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showTemplateForm, setShowTemplateForm] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<ContractTemplate | null>(null);
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [selectedStandId, setSelectedStandId] = useState('');
  const [signingContractId, setSigningContractId] = useState<string | null>(null);

  useEffect(() => {
    loadTemplates();
    loadContracts();
    loadClients();
  }, []);

  const loadTemplates = async () => {
    try {
      setLoading(true);
      const data = await supabaseMock.getContractTemplates();
      setTemplates(data || []);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const loadContracts = async () => {
    try {
      const data = await supabaseMock.getContracts();
      setContracts(data || []);
    } catch (err: any) {
      setError(err.message);
    }
  };

  const loadClients = async () => {
    try {
      const data = await supabaseMock.getClients();
      setClients(data || []);
    } catch (err: any) {
      setError(err.message);
    }
  };

  return (
    <div className="w-full max-w-6xl mx-auto p-6">
      <div className="bg-white rounded-lg shadow">
        <div className="bg-gradient-to-r from-blue-600 to-blue-700 text-white p-6">
          <h1 className="text-3xl font-bold">Contract Manager</h1>
          <p className="text-blue-100 mt-2">Create, manage, and sign contracts</p>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-6 py-4 m-6 rounded">
            {error}
          </div>
        )}

        <div className="border-b border-gray-200">
          <div className="flex gap-8 px-6">
            {(['templates', 'generate', 'contracts'] as const).map(tab => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`py-4 font-medium border-b-2 transition ${
                  activeTab === tab
                    ? 'border-blue-600 text-blue-600'
                    : 'border-transparent text-gray-600 hover:text-gray-900'
                }`}
              >
                {tab === 'templates' && 'Templates'}
                {tab === 'generate' && 'Generate'}
                {tab === 'contracts' && `Contracts (${contracts.length})`}
              </button>
            ))}
          </div>
        </div>

        <div className="p-6">
          {loading && <div className="text-center py-8 text-gray-500">Loading...</div>}
          
          {activeTab === 'templates' && (
            <div>
              <h2 className="text-2xl font-bold mb-6">Contract Templates</h2>
              <button
                onClick={() => setShowTemplateForm(!showTemplateForm)}
                className="mb-6 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded font-medium"
              >
                + New Template
              </button>

              {templates.length === 0 ? (
                <p className="text-gray-500 text-center py-8">No templates yet.</p>
              ) : (
                <div className="grid gap-4 md:grid-cols-2">
                  {templates.map((t) => (
                    <div key={t.id} className="border border-gray-200 rounded-lg p-4">
                      <h3 className="font-bold text-lg">{t.name}</h3>
                      <p className="text-sm text-gray-600">{t.description}</p>
                      <button
                        onClick={() => setSelectedTemplate(t)}
                        className="mt-4 w-full bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded font-medium text-sm"
                      >
                        Use Template
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {activeTab === 'generate' && (
            <div>
              <h2 className="text-2xl font-bold mb-6">Generate Contract</h2>
              {selectedTemplate ? (
                <div className="space-y-4">
                  <div className="bg-white p-4 rounded">
                    <h3 className="font-bold text-blue-900">Template: {selectedTemplate.name}</h3>
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-2">Select Client</label>
                    <select
                      value={selectedClient?.id || ''}
                      onChange={(e) => {
                        const c = clients.find(cl => cl.id === e.target.value) || null;
                        setSelectedClient(c);
                      }}
                      className="w-full px-4 py-2 border border-gray-300 rounded"
                    >
                      <option value="">Choose client...</option>
                      {clients.map((c) => (
                        <option key={c.id} value={c.id}>{c.name}</option>
                      ))}
                    </select>
                  </div>
                </div>
              ) : (
                <p className="text-gray-500 text-center py-12">Select a template to begin.</p>
              )}
            </div>
          )}

          {activeTab === 'contracts' && (
            <div>
              <h2 className="text-2xl font-bold mb-6">Generated Contracts</h2>
              {contracts.length === 0 ? (
                <p className="text-gray-500 text-center py-12">No contracts yet.</p>
              ) : (
                <div className="space-y-4">
                  {contracts.map((c) => (
                    <div key={c.id} className="border border-gray-200 rounded-lg p-4">
                      <div className="flex justify-between items-start mb-2">
                        <h3 className="font-bold">{c.templateName}</h3>
                        <span className="px-3 py-1 rounded text-sm font-medium bg-blue-100 text-blue-800">
                          {c.status}
                        </span>
                      </div>
                      <p className="text-sm text-gray-600">
                        {formatDistanceToNow(new Date(c.createdAt), { addSuffix: true })}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
