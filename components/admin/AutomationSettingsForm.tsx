'use client';

import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';

interface PaymentAutomationSettings {
  id: string;
  branch: string;
  enableReminders: boolean;
  enableEscalation: boolean;
  enableFollowups: boolean;
  reminderDaysAfterDue: number;
  escalationDaysOverdue: number;
  followupFrequencyDays: number;
  maxFollowups: number;
  customEmailTemplate: string | null;
  notificationEmails: string[];
  createdAt: string;
  updatedAt: string;
}

interface AutomationSettingsFormProps {
  settings: PaymentAutomationSettings;
  onSuccess: () => void;
}

export default function AutomationSettingsForm({
  settings,
  onSuccess,
}: AutomationSettingsFormProps) {
  const [formData, setFormData] = useState(settings);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const handleToggle = (field: keyof typeof formData) => {
    setFormData((prev) => ({
      ...prev,
      [field]: !prev[field],
    }));
  };

  const handleInputChange = (field: string, value: any) => {
    setFormData((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const handleEmailsChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const emails = e.target.value.split('\n').filter((e) => e.trim());
    setFormData((prev) => ({
      ...prev,
      notificationEmails: emails,
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setLoading(true);
      setMessage(null);

      const response = await fetch('/api/admin/payment-automation/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      if (!response.ok) {
        throw new Error('Failed to update settings');
      }

      setMessage({ type: 'success', text: 'Settings updated successfully!' });
      onSuccess();
    } catch (error) {
      setMessage({
        type: 'error',
        text: error instanceof Error ? error.message : 'Failed to update settings',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {message && (
        <div
          className={`p-4 rounded-lg ${
            message.type === 'success'
              ? 'bg-green-50 text-green-800 border border-green-200'
              : 'bg-red-50 text-red-800 border border-red-200'
          }`}
        >
          {message.text}
        </div>
      )}

      {/* Email Reminders Section */}
      <Card>
        <CardHeader>
          <CardTitle>Payment Reminders</CardTitle>
          <CardDescription>Friendly reminders for outstanding invoices</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <Label htmlFor="enableReminders" className="text-base">
              Enable Payment Reminders
            </Label>
            <Switch
              id="enableReminders"
              checked={formData.enableReminders}
              onCheckedChange={() => handleToggle('enableReminders')}
            />
          </div>
          {formData.enableReminders && (
            <div>
              <Label htmlFor="reminderDaysAfterDue">Days After Due Date to Send Reminder</Label>
              <Input
                id="reminderDaysAfterDue"
                type="number"
                min="0"
                value={formData.reminderDaysAfterDue}
                onChange={(e) =>
                  handleInputChange('reminderDaysAfterDue', parseInt(e.target.value))
                }
                className="mt-1"
              />
              <p className="text-xs text-gray-500 mt-2">
                Set to 0 to send immediately on due date, or higher for delayed reminders
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Escalation Section */}
      <Card>
        <CardHeader>
          <CardTitle>Invoice Escalation</CardTitle>
          <CardDescription>Critical notices for overdue invoices</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <Label htmlFor="enableEscalation" className="text-base">
              Enable Escalation
            </Label>
            <Switch
              id="enableEscalation"
              checked={formData.enableEscalation}
              onCheckedChange={() => handleToggle('enableEscalation')}
            />
          </div>
          {formData.enableEscalation && (
            <div>
              <Label htmlFor="escalationDaysOverdue">Days Overdue Before Escalation</Label>
              <Input
                id="escalationDaysOverdue"
                type="number"
                min="1"
                value={formData.escalationDaysOverdue}
                onChange={(e) =>
                  handleInputChange('escalationDaysOverdue', parseInt(e.target.value))
                }
                className="mt-1"
              />
              <p className="text-xs text-gray-500 mt-2">Default: 30 days</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Follow-ups Section */}
      <Card>
        <CardHeader>
          <CardTitle>Follow-up Emails</CardTitle>
          <CardDescription>Additional reminders for persistent overdue invoices</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <Label htmlFor="enableFollowups" className="text-base">
              Enable Follow-ups
            </Label>
            <Switch
              id="enableFollowups"
              checked={formData.enableFollowups}
              onCheckedChange={() => handleToggle('enableFollowups')}
            />
          </div>
          {formData.enableFollowups && (
            <>
              <div>
                <Label htmlFor="followupFrequencyDays">Days Between Follow-ups</Label>
                <Input
                  id="followupFrequencyDays"
                  type="number"
                  min="1"
                  value={formData.followupFrequencyDays}
                  onChange={(e) =>
                    handleInputChange('followupFrequencyDays', parseInt(e.target.value))
                  }
                  className="mt-1"
                />
                <p className="text-xs text-gray-500 mt-2">Default: 15 days</p>
              </div>
              <div>
                <Label htmlFor="maxFollowups">Maximum Follow-ups Per Invoice</Label>
                <Input
                  id="maxFollowups"
                  type="number"
                  min="1"
                  value={formData.maxFollowups}
                  onChange={(e) => handleInputChange('maxFollowups', parseInt(e.target.value))}
                  className="mt-1"
                />
                <p className="text-xs text-gray-500 mt-2">After this, legal action may be taken</p>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Admin Notifications */}
      <Card>
        <CardHeader>
          <CardTitle>Admin Notifications</CardTitle>
          <CardDescription>Who should be notified of escalations</CardDescription>
        </CardHeader>
        <CardContent>
          <Label htmlFor="notificationEmails">Email Addresses (one per line)</Label>
          <Textarea
            id="notificationEmails"
            value={formData.notificationEmails.join('\n')}
            onChange={handleEmailsChange}
            placeholder="director@finecountry.co.zw&#10;finance@finecountry.co.zw"
            className="mt-2 font-mono text-sm"
            rows={4}
          />
        </CardContent>
      </Card>

      {/* Custom Email Template (Optional) */}
      <Card>
        <CardHeader>
          <CardTitle>Custom Email Template (Optional)</CardTitle>
          <CardDescription>Override default template with custom HTML</CardDescription>
        </CardHeader>
        <CardContent>
          <Label htmlFor="customEmailTemplate">Custom HTML Template</Label>
          <Textarea
            id="customEmailTemplate"
            value={formData.customEmailTemplate || ''}
            onChange={(e) => handleInputChange('customEmailTemplate', e.target.value)}
            placeholder="Leave blank to use default template"
            className="mt-2 font-mono text-sm"
            rows={8}
          />
          <p className="text-xs text-gray-500 mt-2">
            Variables: {`{CLIENT_NAME}, {TOTAL_AMOUNT}, {DAYS_OVERDUE}, {INVOICE_NUMBER}, {DUE_DATE}`}
          </p>
        </CardContent>
      </Card>

      {/* Submit Button */}
      <div className="flex justify-end gap-4">
        <Button variant="outline" type="button" disabled={loading}>
          Cancel
        </Button>
        <Button
          type="submit"
          disabled={loading}
          className="bg-fcGold text-white hover:bg-fcGold/90"
        >
          {loading ? 'Saving...' : 'Save Settings'}
        </Button>
      </div>
    </form>
  );
}
