'use client';

import React, { useState } from 'react';
import { FileText, Plus, Settings } from 'lucide-react';
import { ContractTemplateEditor } from './ContractTemplateEditor';
import { ContractGenerator } from './ContractGenerator';
import { ContractsList } from './ContractsList';
import { TemplatesList } from './TemplatesList';
import { DOCXTemplateUploader } from './DOCXTemplateUploader';
import { TemplateAutoBuilder } from './contracts/TemplateAutoBuilder';

type Tab = 'contracts' | 'templates';

interface ContractManagementProps {
  dealId?: string;
  clientId?: string;
}

const ContractManagement: React.FC<ContractManagementProps> = ({
  dealId,
  clientId
}) => {
  const [activeTab, setActiveTab] = useState<Tab>('contracts');
  const [showTemplateEditor, setShowTemplateEditor] = useState(false);
  const [editingTemplateId, setEditingTemplateId] = useState<string | null>(null);
  const [showContractGenerator, setShowContractGenerator] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  const handleTemplateCreated = () => {
    setShowTemplateEditor(false);
    setEditingTemplateId(null);
    setRefreshKey(prev => prev + 1);
    setActiveTab('templates');
  };

  const handleContractCreated = () => {
    setShowContractGenerator(false);
    setRefreshKey(prev => prev + 1);
    setActiveTab('contracts');
  };

  const handleEditTemplate = (templateId: string) => {
    setEditingTemplateId(templateId);
    setShowTemplateEditor(true);
  };

  return (
    <div className="w-full min-w-0 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <FileText size={32} className="text-fcGold" />
          <div>
            <h1 className="text-3xl font-bold">Contract Management</h1>
            <p className="text-gray-600">Create, manage, and track contracts</p>
          </div>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="bg-white rounded-lg shadow">
        <div className="flex border-b">
          <button
            onClick={() => setActiveTab('contracts')}
            className={`flex-1 px-6 py-4 font-bold text-center transition-all ${
              activeTab === 'contracts'
                ? 'border-b-2 border-fcGold text-fcGold'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            <div className="flex items-center justify-center gap-2">
              <FileText size={18} />
              Contracts
            </div>
          </button>
          <button
            onClick={() => setActiveTab('templates')}
            className={`flex-1 px-6 py-4 font-bold text-center transition-all ${
              activeTab === 'templates'
                ? 'border-b-2 border-fcGold text-fcGold'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            <div className="flex items-center justify-center gap-2">
              <Settings size={18} />
              Templates
            </div>
          </button>
        </div>

        {/* Tab Content */}
        <div className="p-6">
          {/* Contracts Tab */}
          {activeTab === 'contracts' && (
            <div className="space-y-6">
              {/* Action Buttons */}
              {!showContractGenerator && (
                <div className="flex gap-3">
                  <button
                    onClick={() => setShowContractGenerator(true)}
                    className="flex items-center gap-2 bg-fcGold text-white px-6 py-3 rounded-lg font-bold hover:bg-fcGold/90"
                  >
                    <Plus size={18} />
                    Generate New Contract
                  </button>
                </div>
              )}

              {/* Contract Generator Form */}
              {showContractGenerator ? (
                <div className="border rounded-lg p-6">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-bold">Generate Contract</h3>
                    <button
                      onClick={() => setShowContractGenerator(false)}
                      className="text-gray-500 hover:text-gray-700 text-xl"
                    >
                      ✕
                    </button>
                  </div>
                  <ContractGenerator
                    dealId={dealId}
                    clientId={clientId}
                    onSuccess={handleContractCreated}
                  />
                </div>
              ) : (
                <ContractsList key={refreshKey} />
              )}
            </div>
          )}

          {/* Templates Tab */}
          {activeTab === 'templates' && (
            <div className="space-y-6">
              {/* Action Buttons */}
              {!showTemplateEditor && (
                <div className="flex gap-3">
                  <button
                    onClick={() => {
                      setEditingTemplateId(null);
                      setShowTemplateEditor(true);
                    }}
                    className="flex items-center gap-2 bg-fcGold text-white px-6 py-3 rounded-lg font-bold hover:bg-fcGold/90"
                  >
                    <Plus size={18} />
                    Create New Template
                  </button>
                  <DOCXTemplateUploader 
                    onTemplateUploaded={handleTemplateCreated}
                  />
                  <TemplateAutoBuilder
                    onTemplateCreated={handleTemplateCreated}
                  />
                </div>
              )}

              {/* Template Editor Form */}
              {showTemplateEditor ? (
                <div className="border rounded-lg">
                  <ContractTemplateEditor
                    templateId={editingTemplateId || undefined}
                    onSave={handleTemplateCreated}
                    onCancel={() => {
                      setShowTemplateEditor(false);
                      setEditingTemplateId(null);
                    }}
                  />
                </div>
              ) : (
                <TemplatesList
                  key={refreshKey}
                  onEdit={handleEditTemplate}
                />
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ContractManagement;
export { ContractManagement };
