'use client';

import React, { useState, useEffect, useCallback } from 'react';
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
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { AlertCircle, Zap, CheckCircle, FileText } from 'lucide-react';

interface Template {
  id: string;
  name: string;
  category: string;
  description: string;
  version: number;
}

interface Variable {
  name: string;
  value: string;
  format?: string;
  description?: string;
}

interface ContractData {
  title: string;
  templateId: string;
  clientId: string;
  dealId: string;
  variables: Record<string, string>;
  notes?: string;
}

export function ContractGenerator({ dealId, clientId }: { dealId?: string; clientId?: string }) {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState<Template | null>(null);
  const [templateVariables, setTemplateVariables] = useState<Variable[]>([]);
  const [isLoadingTemplates, setIsLoadingTemplates] = useState(true);
  const [isGenerating, setIsGenerating] = useState(false);
  const [preview, setPreview] = useState<string>('');
  const [message, setMessage] = useState<string>('');
  const [step, setStep] = useState<'select' | 'variables' | 'review' | 'complete'>('select');

  const [contractData, setContractData] = useState<ContractData>({
    title: '',
    templateId: '',
    clientId: clientId || '',
    dealId: dealId || '',
    variables: {},
    notes: '',
  });

  // Load templates
  useEffect(() => {
    async function loadTemplates() {
      try {
        const response = await fetch('/api/admin/contracts/templates');
        if (!response.ok) throw new Error('Failed to load templates');
        const data = await response.json();
        setTemplates(data.templates || []);
      } catch (error: any) {
        setMessage(`Error loading templates: ${error.message}`);
      } finally {
        setIsLoadingTemplates(false);
      }
    }
    loadTemplates();
  }, []);

  // Load template details when selected
  useEffect(() => {
    if (selectedTemplate) {
      const templateId = selectedTemplate.id;
      async function loadTemplate() {
        try {
          const response = await fetch(
            `/api/admin/contracts/templates/${templateId}`
          );
          if (!response.ok) throw new Error('Failed to load template');
          const data = await response.json();

          const variables: Variable[] = (data.template?.variables || []).map(
            (v: any) => ({
              name: v.name,
              value: '',
              format: v.format,
              description: v.description,
            })
          );

          setTemplateVariables(variables);
          setContractData(prev => ({
            ...prev,
            templateId: templateId,
            variables: Object.fromEntries(variables.map(v => [v.name, ''])),
          }));

          setPreview(data.template?.content || '');
        } catch (error: any) {
          setMessage(`Error loading template: ${error.message}`);
        }
      }
      loadTemplate();
    }
  }, [selectedTemplate]);

  // Update preview with variable values
  useEffect(() => {
    if (selectedTemplate && preview) {
      let rendered = preview;
      Object.entries(contractData.variables).forEach(([key, value]) => {
        const regex = new RegExp(`{{${key}}}|{${key.toUpperCase()}}`, 'g');
        rendered = rendered.replace(regex, value);
      });
      setPreview(rendered);
    }
  }, [contractData.variables, selectedTemplate]);

  const handleVariableChange = useCallback(
    (name: string, value: string) => {
      setContractData(prev => ({
        ...prev,
        variables: { ...prev.variables, [name]: value },
      }));
    },
    []
  );

  const generateContract = async () => {
    if (!contractData.title || !contractData.templateId || !contractData.clientId) {
      setMessage('Please fill in all required fields');
      return;
    }

    setIsGenerating(true);
    try {
      const response = await fetch('/api/admin/contracts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: contractData.title,
          templateId: contractData.templateId,
          clientId: contractData.clientId,
          dealId: contractData.dealId,
          variables: contractData.variables,
          notes: contractData.notes,
        }),
      });

      if (!response.ok) throw new Error('Failed to generate contract');
      const data = await response.json();

      setMessage('Contract generated successfully!');
      setStep('complete');

      // Reset after successful generation
      setTimeout(() => {
        setSelectedTemplate(null);
        setContractData({
          title: '',
          templateId: '',
          clientId: clientId || '',
          dealId: dealId || '',
          variables: {},
          notes: '',
        });
        setStep('select');
        setMessage('');
      }, 2000);
    } catch (error: any) {
      setMessage(`Error: ${error.message}`);
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Generate Contract</CardTitle>
          <CardDescription>
            Create a new contract from a template with custom variables
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs value={step} onValueChange={v => setStep(v as any)} className="w-full">
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger
                value="select"
                disabled={step !== 'select' && !selectedTemplate}
                className="flex items-center gap-2"
              >
                <span>1. Template</span>
              </TabsTrigger>
              <TabsTrigger
                value="variables"
                disabled={step === 'select' || !selectedTemplate}
                className="flex items-center gap-2"
              >
                <span>2. Variables</span>
              </TabsTrigger>
              <TabsTrigger
                value="review"
                disabled={step === 'select' || step === 'variables' || !selectedTemplate}
                className="flex items-center gap-2"
              >
                <span>3. Review</span>
              </TabsTrigger>
              <TabsTrigger value="complete" disabled={step !== 'complete'}>
                <span>4. Complete</span>
              </TabsTrigger>
            </TabsList>

            {/* Step 1: Select Template */}
            <TabsContent value="select" className="space-y-4">
              {isLoadingTemplates ? (
                <p className="text-center text-gray-500">Loading templates...</p>
              ) : templates.length === 0 ? (
                <Alert>
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    No templates available. Create one in the Template Editor first.
                  </AlertDescription>
                </Alert>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {templates.map(template => (
                    <Card
                      key={template.id}
                      className={`cursor-pointer transition-all ${
                        selectedTemplate?.id === template.id
                          ? 'border-blue-500 bg-blue-50'
                          : 'hover:border-gray-400'
                      }`}
                      onClick={() => setSelectedTemplate(template)}
                    >
                      <CardContent className="pt-6">
                        <div className="space-y-2">
                          <div className="flex items-start justify-between">
                            <h3 className="font-semibold">{template.name}</h3>
                            {selectedTemplate?.id === template.id && (
                              <CheckCircle className="w-5 h-5 text-blue-500" />
                            )}
                          </div>
                          <p className="text-sm text-gray-600">{template.description}</p>
                          <div className="flex gap-2">
                            <Badge variant="outline">{template.category}</Badge>
                            <Badge variant="secondary">v{template.version}</Badge>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}

              {selectedTemplate && (
                <Button
                  onClick={() => setStep('variables')}
                  className="w-full"
                  size="lg"
                >
                  Next: Enter Variables
                </Button>
              )}
            </TabsContent>

            {/* Step 2: Enter Variables */}
            <TabsContent value="variables" className="space-y-4">
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium">Contract Title *</label>
                    <Input
                      value={contractData.title}
                      onChange={e =>
                        setContractData(prev => ({
                          ...prev,
                          title: e.target.value,
                        }))
                      }
                      placeholder="e.g., Property Sale - 123 Main St"
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium">Client ID *</label>
                    <Input
                      value={contractData.clientId}
                      onChange={e =>
                        setContractData(prev => ({
                          ...prev,
                          clientId: e.target.value,
                        }))
                      }
                      placeholder="Client ID"
                    />
                  </div>
                </div>

                {dealId && (
                  <div>
                    <label className="text-sm font-medium">Deal ID</label>
                    <Input value={contractData.dealId} disabled />
                  </div>
                )}

                <div className="border-t pt-4">
                  <label className="text-sm font-medium mb-4 block">
                    Template Variables
                  </label>
                  {templateVariables.length === 0 ? (
                    <p className="text-sm text-gray-500">
                      No variables defined for this template
                    </p>
                  ) : (
                    <div className="grid grid-cols-1 gap-4">
                      {templateVariables.map(variable => (
                        <div key={variable.name} className="space-y-2">
                          <label className="text-sm font-medium">
                            {variable.name}
                            {variable.description && (
                              <span className="text-xs text-gray-500 ml-2">
                                {variable.description}
                              </span>
                            )}
                          </label>
                          {variable.format === 'date' ? (
                            <Input
                              type="date"
                              value={contractData.variables[variable.name] || ''}
                              onChange={e =>
                                handleVariableChange(variable.name, e.target.value)
                              }
                            />
                          ) : variable.format === 'number' ? (
                            <Input
                              type="number"
                              value={contractData.variables[variable.name] || ''}
                              onChange={e =>
                                handleVariableChange(variable.name, e.target.value)
                              }
                            />
                          ) : variable.format === 'email' ? (
                            <Input
                              type="email"
                              value={contractData.variables[variable.name] || ''}
                              onChange={e =>
                                handleVariableChange(variable.name, e.target.value)
                              }
                            />
                          ) : (
                            <Input
                              value={contractData.variables[variable.name] || ''}
                              onChange={e =>
                                handleVariableChange(variable.name, e.target.value)
                              }
                            />
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div>
                  <label className="text-sm font-medium">Notes</label>
                  <Textarea
                    value={contractData.notes || ''}
                    onChange={e =>
                      setContractData(prev => ({
                        ...prev,
                        notes: e.target.value,
                      }))
                    }
                    placeholder="Additional notes or context..."
                    rows={3}
                  />
                </div>
              </div>

              <div className="flex gap-2">
                <Button
                  variant="outline"
                  onClick={() => setStep('select')}
                  className="flex-1"
                >
                  Back
                </Button>
                <Button
                  onClick={() => setStep('review')}
                  className="flex-1"
                  disabled={!contractData.title || !contractData.clientId}
                >
                  Review
                </Button>
              </div>
            </TabsContent>

            {/* Step 3: Review */}
            <TabsContent value="review" className="space-y-4">
              <Alert>
                <FileText className="h-4 w-4" />
                <AlertDescription>
                  Review the contract preview before generating. This is how it will appear
                  with your variables substituted.
                </AlertDescription>
              </Alert>

              <div className="bg-white border rounded-lg p-6 max-h-96 overflow-y-auto prose prose-sm max-w-none">
                <div dangerouslySetInnerHTML={{ __html: preview }} />
              </div>

              <div className="space-y-2 text-sm bg-gray-50 p-4 rounded-lg">
                <p>
                  <strong>Title:</strong> {contractData.title}
                </p>
                <p>
                  <strong>Template:</strong> {selectedTemplate?.name}
                </p>
                <p>
                  <strong>Client ID:</strong> {contractData.clientId}
                </p>
                {contractData.dealId && (
                  <p>
                    <strong>Deal ID:</strong> {contractData.dealId}
                  </p>
                )}
              </div>

              <div className="flex gap-2">
                <Button
                  variant="outline"
                  onClick={() => setStep('variables')}
                  className="flex-1"
                >
                  Back
                </Button>
                <Button
                  onClick={generateContract}
                  disabled={isGenerating}
                  className="flex-1 bg-green-600 hover:bg-green-700"
                >
                  <Zap className="w-4 h-4 mr-2" />
                  {isGenerating ? 'Generating...' : 'Generate Contract'}
                </Button>
              </div>
            </TabsContent>

            {/* Step 4: Complete */}
            <TabsContent value="complete" className="text-center py-8">
              <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-4" />
              <h3 className="text-lg font-semibold mb-2">Contract Generated!</h3>
              <p className="text-gray-600 mb-6">
                Your contract has been created successfully and is ready for signing.
              </p>
              <Button onClick={() => setStep('select')} className="w-full">
                Generate Another Contract
              </Button>
            </TabsContent>
          </Tabs>

          {/* Message Display */}
          {message && (
            <Alert className="mt-4">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{message}</AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>
    </div>
  );
}