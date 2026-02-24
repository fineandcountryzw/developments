'use client';

import React, { useState, useCallback } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import AutomationSettingsForm from './AutomationSettingsForm';
import EmailLogsViewer from './EmailLogsViewer';
import TestEmailModal from './TestEmailModal';

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

export default function AdminPaymentAutomation() {
  const [settings, setSettings] = useState<PaymentAutomationSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [showTestEmail, setShowTestEmail] = useState(false);
  const [activeTab, setActiveTab] = useState('settings');

  // Load settings on component mount
  React.useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = useCallback(async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/admin/payment-automation/settings?branch=Harare');
      if (!response.ok) throw new Error('Failed to load settings');
      const data = await response.json();
      setSettings(data.data);
    } catch (error) {
      console.error('Error loading settings:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-fcGold mx-auto mb-2"></div>
          <p>Loading payment automation settings...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-fcSlate">Payment Automation Control Panel</h1>
        <p className="text-gray-600 mt-2">
          Manage email reminders, escalation, and follow-ups for outstanding invoices
        </p>
      </div>

      {/* Status Overview */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-gray-600">Reminders Status</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {settings?.enableReminders ? (
                <span className="text-green-600">Enabled</span>
              ) : (
                <span className="text-red-600">Disabled</span>
              )}
            </div>
            <p className="text-xs text-gray-500 mt-1">
              {settings?.enableReminders ? '✅ Sending reminders on 5th & 20th' : '❌ Reminders disabled'}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-gray-600">Escalation Status</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {settings?.enableEscalation ? (
                <span className="text-green-600">Enabled</span>
              ) : (
                <span className="text-red-600">Disabled</span>
              )}
            </div>
            <p className="text-xs text-gray-500 mt-1">
              {settings?.enableEscalation
                ? `✅ After ${settings?.escalationDaysOverdue || 30} days overdue`
                : '❌ Escalation disabled'}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-gray-600">Follow-ups Status</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {settings?.enableFollowups ? (
                <span className="text-green-600">Enabled</span>
              ) : (
                <span className="text-red-600">Disabled</span>
              )}
            </div>
            <p className="text-xs text-gray-500 mt-1">
              {settings?.enableFollowups
                ? `✅ Every ${settings?.followupFrequencyDays || 15} days`
                : '❌ Follow-ups disabled'}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="settings">Settings</TabsTrigger>
          <TabsTrigger value="logs">Email Logs</TabsTrigger>
          <TabsTrigger value="test">Test Email</TabsTrigger>
        </TabsList>

        {/* Settings Tab */}
        <TabsContent value="settings" className="space-y-4">
          {settings && <AutomationSettingsForm settings={settings} onSuccess={loadSettings} />}
        </TabsContent>

        {/* Logs Tab */}
        <TabsContent value="logs" className="space-y-4">
          <EmailLogsViewer />
        </TabsContent>

        {/* Test Email Tab */}
        <TabsContent value="test" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Send Test Email</CardTitle>
              <CardDescription>
                Test your SMTP configuration by sending a sample email
              </CardDescription>
            </CardHeader>
            <CardContent>
              <TestEmailModal 
                isOpen={showTestEmail}
                onOpenChange={setShowTestEmail}
              />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
