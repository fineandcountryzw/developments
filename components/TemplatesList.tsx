'use client';

import React, { useState, useEffect } from 'react';
import { Loader2, Edit2, Copy, Trash2, Search, FileText } from 'lucide-react';

interface Template {
  id: string;
  name: string;
  description?: string | null;
  type: string;
  templateVariables?: any[];
  sections?: any[];
  isGlobal?: boolean;
  developmentId?: string;
  developmentName?: string;
  createdAt: string;
  content?: string;
  usageCount?: number;
  status?: string;
}

interface TemplatesListProps {
  onEdit?: (templateId: string) => void;
}

export const TemplatesList: React.FC<TemplatesListProps> = ({ onEdit }) => {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [typeFilter, setTypeFilter] = useState<string | null>(null);
  const [page, setPage] = useState(1);

  useEffect(() => {
    loadTemplates();
  }, [page, typeFilter]);

  const loadTemplates = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams({ page: page.toString(), limit: '20' });
      if (typeFilter) params.append('type', typeFilter);

      const res = await fetch(`/api/admin/contracts/templates?${params.toString()}`);
      if (!res.ok) throw new Error('Failed to load templates');

      const data = await res.json();
      const templateList = Array.isArray(data.templates) ? data.templates :
                          Array.isArray(data.data) ? data.data :
                          [];
      setTemplates(templateList);
    } catch (err: any) {
      setError(err.message);
      setTemplates([]); // Ensure templates is always an array
    } finally {
      setLoading(false);
    }
  };

  const handleDuplicate = async (templateId: string, name: string) => {
    try {
      const res = await fetch(`/api/admin/contract-templates/${templateId}`);
      if (!res.ok) throw new Error('Failed to load template');
      const data = await res.json();
      const payload = data?.data || data;
      const template = payload?.template || payload;

      const newTemplate = {
        name: `${name} (Copy)`,
        type: template.type || 'purchase',
        description: template.description,
        content: template.content || '',
        templateVariables: template.templateVariables || []
      };

      const createRes = await fetch('/api/admin/contracts/templates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newTemplate)
      });

      if (!createRes.ok) throw new Error('Failed to duplicate template');
      loadTemplates();
    } catch (err: any) {
      alert(`Error: ${err.message}`);
    }
  };

  const handleDelete = async (templateId: string, usageCount: number, templateName: string) => {
    // Pre-check: Warn if template has generated contracts
    if (usageCount > 0) {
      const confirmed = confirm(
        `\"${templateName}\" has ${usageCount} generated contract(s).\n\n` +
        `Templates with contracts cannot be permanently deleted.\n` +
        `They will be archived instead.\n\n` +
        `Do you want to archive this template?`
      );
      if (!confirmed) return;
    } else {
      if (!confirm(`Are you sure you want to delete \"${templateName}\"?\n\nThis action cannot be undone.`)) return;
    }

    try {
      const res = await fetch(`/api/admin/contracts/templates/${templateId}`, {
        method: 'DELETE'
      });
      const errorData = await res.json().catch(() => ({}));
      
      if (!res.ok) {
        // Show detailed error message
        const errorMsg = errorData?.error || 'Failed to delete template';
        alert(`Error: ${errorMsg}`);
        return;
      }
      
      loadTemplates();
    } catch (err: any) {
      alert(`Error: ${err.message}`);
    }
  };

  const getTypeColor = (type: string) => {
    const colors: { [key: string]: string } = {
      purchase: 'bg-blue-100 text-blue-700',
      installment: 'bg-purple-100 text-purple-700',
      management: 'bg-green-100 text-green-700',
      lease: 'bg-orange-100 text-orange-700',
      employment: 'bg-red-100 text-red-700',
      nda: 'bg-yellow-100 text-yellow-700'
    };
    return colors[type] || 'bg-gray-100 text-gray-700';
  };

  const filteredTemplates = templates.filter(t =>
    t.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (t.description || '').toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-6">
      {/* Search & Filter */}
      <div className="flex gap-4 flex-wrap">
        <div className="flex-1 min-w-[250px]">
          <div className="relative">
            <Search className="absolute left-3 top-3 text-gray-400" size={18} />
            <input
              type="text"
              placeholder="Search templates..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-fcGold"
            />
          </div>
        </div>
        <select
          value={typeFilter || ''}
          onChange={(e) => {
            setTypeFilter(e.target.value || null);
            setPage(1);
          }}
          className="px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-fcGold"
        >
          <option value="">All Types</option>
          <option value="purchase">Purchase</option>
          <option value="installment">Installment</option>
          <option value="management">Management</option>
          <option value="lease">Lease</option>
          <option value="employment">Employment</option>
          <option value="nda">NDA</option>
        </select>
      </div>

      {/* Error Message */}
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
          {error}
        </div>
      )}

      {/* Loading State */}
      {loading && (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="animate-spin" size={32} />
        </div>
      )}

      {/* Templates Grid */}
      {!loading && filteredTemplates.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredTemplates.map((template) => (
            <div
              key={template.id}
              className="border rounded-lg p-6 hover:shadow-lg transition-shadow bg-white"
            >
              {/* Header */}
              <div className="mb-4">
                <h3 className="font-bold text-lg text-gray-800 mb-2">{template.name}</h3>
                <div className="flex items-center gap-2 flex-wrap">
                  <span className={`inline-block px-2 py-1 rounded text-xs font-bold ${getTypeColor(template.type)}`}>
                    {template.type?.toUpperCase() || 'WORD'}
                  </span>
                  {template.isGlobal && (
                    <span className="inline-block px-2 py-1 rounded text-xs font-bold bg-purple-100 text-purple-700">
                      GLOBAL
                    </span>
                  )}
                  {template.developmentName && (
                    <span className="inline-block px-2 py-1 rounded text-xs font-bold bg-green-100 text-green-700">
                      {template.developmentName}
                    </span>
                  )}
                </div>
              </div>

              {/* Description */}
              <p className="text-sm text-gray-600 mb-4 line-clamp-2">{template.description}</p>

              {/* Metadata */}
              <div className="mb-4 space-y-2 text-xs text-gray-500">
                <div>
                  <span className="font-bold">{template.templateVariables?.length || 0}</span> variables
                </div>
                <div>
                  <span className="font-bold">{template.sections?.length || 0}</span> sections
                </div>
                <div>
                  Created {new Date(template.createdAt).toLocaleDateString()}
                </div>
              </div>

              {/* Actions */}
              <div className="flex gap-2 pt-4 border-t">
                <button
                  onClick={() => onEdit?.(template.id)}
                  className="flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-fcGold text-white rounded font-bold hover:opacity-90 transition-opacity"
                >
                  <Edit2 size={14} />
                  Edit
                </button>
                <button
                  onClick={() => handleDuplicate(template.id, template.name)}
                  title="Duplicate"
                  className="px-3 py-2 border rounded hover:bg-gray-50 transition-colors"
                >
                  <Copy size={16} />
                </button>
                <button
                  onClick={() => handleDelete(template.id, template.usageCount || 0, template.name)}
                  title="Delete"
                  className="px-3 py-2 border border-red-300 text-red-600 rounded hover:bg-red-50 transition-colors"
                  disabled={template.status === 'ARCHIVED'}
                >
                  <Trash2 size={16} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Empty State */}
      {!loading && filteredTemplates.length === 0 && (
        <div className="text-center py-12 bg-gray-50 rounded-lg">
          <FileText className="mx-auto mb-4 text-gray-400" size={48} />
          <p className="text-gray-600 font-bold">No templates found</p>
          <p className="text-gray-500 text-sm">Create a template to get started</p>
        </div>
      )}

      {/* Pagination */}
      {!loading && Math.ceil((templates.length || 0) / 20) > 1 && (
        <div className="flex justify-center gap-2 mt-6">
          <button
            onClick={() => setPage(p => Math.max(1, p - 1))}
            disabled={page === 1}
            className="px-4 py-2 border rounded disabled:opacity-50"
          >
            Previous
          </button>
          <span className="px-4 py-2">Page {page}</span>
          <button
            onClick={() => setPage(p => p + 1)}
            className="px-4 py-2 border rounded hover:bg-gray-50"
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
};
