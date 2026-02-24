'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Loader2 } from 'lucide-react';

interface AutomationDetailProps {
  automationId: string;
  onClose?: () => void;
}

interface Automation {
  id: string;
  name: string;
  description: string | null;
  enabled: boolean;
  triggerType: string;
  eventType: string | null;
  schedule: string | null;
  webhookUrl: string | null;
  entityType: string;
  condition: any;
  actions: any[];
  branch: string;
  retryPolicy: any;
  lastRunAt: Date | null;
  runCount: number;
  successCount: number;
  failureCount: number;
}

export default function AutomationDetail({ automationId, onClose }: AutomationDetailProps) {
  const [automation, setAutomation] = useState<Automation | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  useEffect(() => {
    fetchAutomation();
  }, [automationId]);
  
  const fetchAutomation = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/admin/automations/${automationId}`);
      if (!response.ok) throw new Error('Failed to fetch automation');
      
      const result = await response.json();
      setAutomation(result.data);
      setError(null);
    } catch (err: any) {
      setError(err.message || 'Failed to load automation');
    } finally {
      setLoading(false);
    }
  };
  
  const handleSave = async () => {
    if (!automation) return;
    
    try {
      setSaving(true);
      const response = await fetch(`/api/admin/automations/${automationId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(automation)
      });
      
      if (!response.ok) throw new Error('Failed to update automation');
      
      alert('Automation updated successfully!');
      if (onClose) onClose();
    } catch (err: any) {
      alert(`Failed to update automation: ${err.message}`);
    } finally {
      setSaving(false);
    }
  };
  
  const updateField = (field: string, value: any) => {
    if (!automation) return;
    setAutomation({ ...automation, [field]: value });
  };
  
  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
      </div>
    );
  }
  
  if (error || !automation) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="text-red-600">{error || 'Automation not found'}</div>
        </CardContent>
      </Card>
    );
  }
  
  const successRate = automation.runCount > 0
    ? Math.round((automation.successCount / automation.runCount) * 100)
    : 0;
  
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">{automation.name}</h2>
          <p className="text-gray-600 mt-1">{automation.description || 'No description'}</p>
        </div>
        <div className="flex items-center gap-4">
          <Badge variant={automation.enabled ? 'default' : 'secondary'}>
            {automation.enabled ? 'Enabled' : 'Disabled'}
          </Badge>
          <Button variant="outline" onClick={onClose}>
            Close
          </Button>
        </div>
      </div>
      
      {/* Stats */}
      <div className="grid grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="text-sm text-gray-600">Total Runs</div>
            <div className="text-2xl font-bold">{automation.runCount}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-sm text-gray-600">Success Rate</div>
            <div className={`text-2xl font-bold ${successRate >= 90 ? 'text-green-600' : 'text-yellow-600'}`}>
              {successRate}%
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-sm text-gray-600">Success</div>
            <div className="text-2xl font-bold text-green-600">{automation.successCount}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-sm text-gray-600">Failures</div>
            <div className="text-2xl font-bold text-red-600">{automation.failureCount}</div>
          </CardContent>
        </Card>
      </div>
      
      {/* Basic Info */}
      <Card>
        <CardHeader>
          <CardTitle>Basic Information</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label>Name</Label>
            <Input
              value={automation.name}
              onChange={(e) => updateField('name', e.target.value)}
            />
          </div>
          <div>
            <Label>Description</Label>
            <Textarea
              value={automation.description || ''}
              onChange={(e) => updateField('description', e.target.value)}
              rows={3}
            />
          </div>
          <div className="flex items-center space-x-2">
            <Switch
              checked={automation.enabled}
              onCheckedChange={(enabled) => updateField('enabled', enabled)}
            />
            <Label>Enabled</Label>
          </div>
          <div>
            <Label>Branch</Label>
            <Input
              value={automation.branch}
              onChange={(e) => updateField('branch', e.target.value)}
            />
          </div>
        </CardContent>
      </Card>
      
      {/* Trigger */}
      <Card>
        <CardHeader>
          <CardTitle>Trigger</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label>Trigger Type</Label>
            <Select
              value={automation.triggerType}
              onValueChange={(value) => updateField('triggerType', value)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="event">Event</SelectItem>
                <SelectItem value="schedule">Schedule</SelectItem>
                <SelectItem value="webhook">Webhook</SelectItem>
              </SelectContent>
            </Select>
          </div>
          
          {automation.triggerType === 'event' && (
            <>
              <div>
                <Label>Event Type</Label>
                <Input
                  value={automation.eventType || ''}
                  onChange={(e) => updateField('eventType', e.target.value)}
                  placeholder="payment.confirmed"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Examples: payment.confirmed, deal.updated, invoice.created
                </p>
              </div>
              <div>
                <Label>Entity Type</Label>
                <Input
                  value={automation.entityType}
                  onChange={(e) => updateField('entityType', e.target.value)}
                  placeholder="payment"
                />
              </div>
            </>
          )}
          
          {automation.triggerType === 'schedule' && (
            <div>
              <Label>Cron Schedule</Label>
              <Input
                value={automation.schedule || ''}
                onChange={(e) => updateField('schedule', e.target.value)}
                placeholder="0 9 5,20 * *"
              />
              <p className="text-xs text-gray-500 mt-1">
                Cron expression (e.g., "0 9 5,20 * *" for 5th and 20th at 09:00 UTC)
              </p>
            </div>
          )}
          
          {automation.triggerType === 'webhook' && (
            <div>
              <Label>Webhook URL</Label>
              <Input
                value={automation.webhookUrl || ''}
                onChange={(e) => updateField('webhookUrl', e.target.value)}
                placeholder="https://example.com/webhook"
              />
            </div>
          )}
        </CardContent>
      </Card>
      
      {/* Condition (Read-only for now) */}
      <Card>
        <CardHeader>
          <CardTitle>Condition (Optional)</CardTitle>
        </CardHeader>
        <CardContent>
          <Textarea
            value={JSON.stringify(automation.condition || null, null, 2)}
            readOnly
            rows={6}
            className="font-mono text-sm"
          />
          <p className="text-xs text-gray-500 mt-2">
            Condition editing will be available in a future update
          </p>
        </CardContent>
      </Card>
      
      {/* Actions (Read-only for now) */}
      <Card>
        <CardHeader>
          <CardTitle>Actions</CardTitle>
        </CardHeader>
        <CardContent>
          <Textarea
            value={JSON.stringify(automation.actions || [], null, 2)}
            readOnly
            rows={8}
            className="font-mono text-sm"
          />
          <p className="text-xs text-gray-500 mt-2">
            Action editing will be available in a future update
          </p>
        </CardContent>
      </Card>
      
      {/* Last Run */}
      {automation.lastRunAt && (
        <Card>
          <CardHeader>
            <CardTitle>Last Run</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm">
              {new Date(automation.lastRunAt).toLocaleString()}
            </p>
          </CardContent>
        </Card>
      )}
      
      {/* Actions */}
      <div className="flex justify-end gap-4">
        <Button variant="outline" onClick={onClose}>
          Cancel
        </Button>
        <Button onClick={handleSave} disabled={saving}>
          {saving ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Saving...
            </>
          ) : (
            'Save Changes'
          )}
        </Button>
      </div>
    </div>
  );
}
