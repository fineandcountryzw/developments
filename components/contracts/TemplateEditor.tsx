'use client';

import React, { useState, useCallback, useEffect } from 'react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { AlertCircle, Plus, Save, Eye, X } from 'lucide-react';

interface TemplateVariable {
  name: string;
  description: string;
  format?: string; // 'text', 'number', 'date', 'email'
}

interface TemplateSection {
  id: string;
  title: string;
  content: string;
  optional?: boolean;
  conditionalOn?: string;
}

interface ContractTemplate {
  id?: string;
  name: string;
  description: string;
  category: string;
  content: string;
  variables: TemplateVariable[];
  sections: TemplateSection[];
  version?: number;
}

export function TemplateEditor() {
  const [template, setTemplate] = useState<ContractTemplate>({
    name: '',
    description: '',
    category: 'property-sale',
    content: '',
    variables: [],
    sections: [],
  });

  const [newVariable, setNewVariable] = useState<TemplateVariable>({
    name: '',
    description: '',
    format: 'text',
  });

  const [preview, setPreview] = useState<string>('');
  const [isSaving, setIsSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState<string>('');

  // Render content with variable placeholders highlighted
  useEffect(() => {
    let rendered = template.content;
    template.variables.forEach(variable => {
      const regex = new RegExp(`{{${variable.name}}}|{${variable.name.toUpperCase()}}`, 'g');
      rendered = rendered.replace(
        regex,
        `<span class="bg-yellow-100 px-1 rounded">[${variable.name}]</span>`
      );
    });
    setPreview(rendered);
  }, [template.content, template.variables]);

  const addVariable = useCallback(() => {
    if (newVariable.name.trim()) {
      setTemplate(prev => ({
        ...prev,
        variables: [...prev.variables, newVariable],
      }));
      setNewVariable({ name: '', description: '', format: 'text' });
    }
  }, [newVariable]);

  const removeVariable = useCallback((name: string) => {
    setTemplate(prev => ({
      ...prev,
      variables: prev.variables.filter(v => v.name !== name),
    }));
  }, []);

  const addSection = useCallback(() => {
    const newSection: TemplateSection = {
      id: Math.random().toString(36).substr(2, 9),
      title: 'New Section',
      content: '',
      optional: false,
    };
    setTemplate(prev => ({
      ...prev,
      sections: [...prev.sections, newSection],
    }));
  }, []);

  const updateSection = useCallback((id: string, field: string, value: any) => {
    setTemplate(prev => ({
      ...prev,
      sections: prev.sections.map(s =>
        s.id === id ? { ...s, [field]: value } : s
      ),
    }));
  }, []);

  const removeSection = useCallback((id: string) => {
    setTemplate(prev => ({
      ...prev,
      sections: prev.sections.filter(s => s.id !== id),
    }));
  }, []);

  const saveTemplate = async () => {
    setIsSaving(true);
    try {
      const response = await fetch('/api/admin/contracts/templates', {
        method: template.id ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(template),
      });

      if (!response.ok) throw new Error('Failed to save template');

      const data = await response.json();
      setSaveMessage('Template saved successfully!');
      if (!template.id) {
        setTemplate(prev => ({ ...prev, id: data.id }));
      }

      setTimeout(() => setSaveMessage(''), 3000);
    } catch (error: any) {
      setSaveMessage(`Error: ${error.message}`);
    } finally {
      setIsSaving(false);
    }
  };

  const insertVariable = (name: string) => {
    setTemplate(prev => ({
      ...prev,
      content: prev.content + `{{${name}}}`,
    }));
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Contract Template Editor</CardTitle>
          <CardDescription>
            Create and edit contract templates with variable substitution support
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Basic Info */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium">Template Name *</label>
              <Input
                value={template.name}
                onChange={e =>
                  setTemplate(prev => ({ ...prev, name: e.target.value }))
                }
                placeholder="e.g., Property Sale Agreement"
              />
            </div>
            <div>
              <label className="text-sm font-medium">Category</label>
              <select
                value={template.category}
                onChange={e =>
                  setTemplate(prev => ({ ...prev, category: e.target.value }))
                }
                className="w-full px-3 py-2 border rounded-md"
              >
                <option value="property-sale">Property Sale</option>
                <option value="property-lease">Property Lease</option>
                <option value="management-agreement">Management Agreement</option>
                <option value="listing-agreement">Listing Agreement</option>
                <option value="other">Other</option>
              </select>
            </div>
          </div>

          <div>
            <label className="text-sm font-medium">Description</label>
            <Textarea
              value={template.description}
              onChange={e =>
                setTemplate(prev => ({
                  ...prev,
                  description: e.target.value,
                }))
              }
              placeholder="Brief description of this template"
              rows={2}
            />
          </div>

          <Tabs defaultValue="content" className="w-full">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="content">Content</TabsTrigger>
              <TabsTrigger value="variables">Variables</TabsTrigger>
              <TabsTrigger value="sections">Sections</TabsTrigger>
            </TabsList>

            {/* Content Tab */}
            <TabsContent value="content" className="space-y-4">
              <div>
                <div className="flex justify-between items-center mb-2">
                  <label className="text-sm font-medium">Contract Content *</label>
                  <Dialog>
                    <DialogTrigger>
                      <Button variant="outline" size="sm">
                        <Eye className="w-4 h-4 mr-2" />
                        Preview
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="max-w-2xl max-h-96 overflow-y-auto">
                      <DialogHeader>
                        <DialogTitle>Template Preview</DialogTitle>
                      </DialogHeader>
                      <div
                        className="prose max-w-none text-sm"
                        dangerouslySetInnerHTML={{ __html: preview }}
                      />
                    </DialogContent>
                  </Dialog>
                </div>
                <Textarea
                  value={template.content}
                  onChange={e =>
                    setTemplate(prev => ({
                      ...prev,
                      content: e.target.value,
                    }))
                  }
                  placeholder="Enter contract content. Use {{variableName}} or {VARIABLE_NAME} for variable substitution."
                  rows={12}
                  className="font-mono text-sm"
                />
              </div>
            </TabsContent>

            {/* Variables Tab */}
            <TabsContent value="variables" className="space-y-4">
              <div className="space-y-4">
                {/* Add Variable Form */}
                <Card className="bg-gray-50">
                  <CardContent className="pt-6 space-y-3">
                    <div>
                      <label className="text-sm font-medium">Variable Name *</label>
                      <Input
                        value={newVariable.name}
                        onChange={e =>
                          setNewVariable(prev => ({
                            ...prev,
                            name: e.target.value,
                          }))
                        }
                        placeholder="e.g., buyerName (no spaces)"
                      />
                    </div>
                    <div>
                      <label className="text-sm font-medium">Description</label>
                      <Input
                        value={newVariable.description}
                        onChange={e =>
                          setNewVariable(prev => ({
                            ...prev,
                            description: e.target.value,
                          }))
                        }
                        placeholder="e.g., Full name of property buyer"
                      />
                    </div>
                    <div>
                      <label className="text-sm font-medium">Format</label>
                      <select
                        value={newVariable.format}
                        onChange={e =>
                          setNewVariable(prev => ({
                            ...prev,
                            format: e.target.value,
                          }))
                        }
                        className="w-full px-3 py-2 border rounded-md text-sm"
                      >
                        <option value="text">Text</option>
                        <option value="number">Number</option>
                        <option value="date">Date</option>
                        <option value="email">Email</option>
                      </select>
                    </div>
                    <Button onClick={addVariable} className="w-full">
                      <Plus className="w-4 h-4 mr-2" />
                      Add Variable
                    </Button>
                  </CardContent>
                </Card>

                {/* Variables List */}
                <div className="space-y-2">
                  <label className="text-sm font-medium">Defined Variables</label>
                  {template.variables.length === 0 ? (
                    <p className="text-sm text-gray-500">No variables defined yet</p>
                  ) : (
                    <div className="space-y-2">
                      {template.variables.map(variable => (
                        <div
                          key={variable.name}
                          className="flex items-center justify-between p-3 bg-white border rounded-lg"
                        >
                          <div className="flex-1">
                            <div className="font-medium text-sm">{variable.name}</div>
                            <div className="text-xs text-gray-600">
                              {variable.description} • {variable.format}
                            </div>
                          </div>
                          <div className="flex gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => insertVariable(variable.name)}
                            >
                              Insert
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => removeVariable(variable.name)}
                            >
                              <X className="w-4 h-4" />
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </TabsContent>

            {/* Sections Tab */}
            <TabsContent value="sections" className="space-y-4">
              <Button onClick={addSection} className="w-full">
                <Plus className="w-4 h-4 mr-2" />
                Add Section
              </Button>

              {template.sections.length === 0 ? (
                <p className="text-sm text-gray-500 text-center py-8">
                  No sections defined. Add sections to organize your contract.
                </p>
              ) : (
                <div className="space-y-4">
                  {template.sections.map(section => (
                    <Card key={section.id}>
                      <CardContent className="pt-6 space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <label className="text-sm font-medium">Section Title</label>
                            <Input
                              value={section.title}
                              onChange={e =>
                                updateSection(section.id, 'title', e.target.value)
                              }
                            />
                          </div>
                          <div className="flex items-end gap-2">
                            <div className="flex-1">
                              <label className="text-sm font-medium">Optional</label>
                              <input
                                type="checkbox"
                                checked={section.optional || false}
                                onChange={e =>
                                  updateSection(section.id, 'optional', e.target.checked)
                                }
                                className="mt-2"
                              />
                            </div>
                            <Button
                              variant="destructive"
                              size="sm"
                              onClick={() => removeSection(section.id)}
                            >
                              <X className="w-4 h-4" />
                            </Button>
                          </div>
                        </div>
                        <div>
                          <label className="text-sm font-medium">Content</label>
                          <Textarea
                            value={section.content}
                            onChange={e =>
                              updateSection(section.id, 'content', e.target.value)
                            }
                            rows={6}
                          />
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </TabsContent>
          </Tabs>

          {/* Save Section */}
          <div className="flex items-center gap-4">
            <Button
              onClick={saveTemplate}
              disabled={isSaving || !template.name || !template.content}
              size="lg"
            >
              <Save className="w-4 h-4 mr-2" />
              {isSaving ? 'Saving...' : 'Save Template'}
            </Button>
            {saveMessage && (
              <div className="flex items-center gap-2 text-sm">
                {saveMessage.startsWith('Error') ? (
                  <>
                    <AlertCircle className="w-4 h-4 text-red-500" />
                    <span className="text-red-600">{saveMessage}</span>
                  </>
                ) : (
                  <>
                    <div className="w-4 h-4 bg-green-500 rounded-full" />
                    <span className="text-green-600">{saveMessage}</span>
                  </>
                )}
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}