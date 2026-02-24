'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Loader2, Mail } from 'lucide-react';
import AutomationSettingsForm from './AutomationSettingsForm';
import EmailLogsViewer from './EmailLogsViewer';
import TestEmailModal from './TestEmailModal';
import { BounceManagementDashboard } from './BounceManagementDashboard';
import { EngagementScoringDashboard } from './EngagementScoringDashboard';
import { UnsubscribeListManager } from './UnsubscribeListManager';

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

export default function AdminPaymentAutomationDashboard() {
  const [settings, setSettings] = useState<PaymentAutomationSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [testEmailOpen, setTestEmailOpen] = useState(false);
  const [refreshLogsKey, setRefreshLogsKey] = useState(0);
  const [activeTab, setActiveTab] = useState('overview');

  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const response = await fetch('/api/admin/payment-automation/settings');
        if (!response.ok) throw new Error('Failed to fetch settings');
        const data = await response.json();
        setSettings(data);
      } catch (error) {
        setError(error instanceof Error ? error.message : 'Failed to load settings');
      } finally {
        setLoading(false);
      }
    };

    fetchSettings();
  }, []);

  const handleSettingsSuccess = () => {
    // Refetch settings after update
    const fetchSettings = async () => {
      try {
        const response = await fetch('/api/admin/payment-automation/settings');
        if (!response.ok) throw new Error('Failed to fetch settings');
        const data = await response.json();
        setSettings(data);
      } catch (error) {
        console.error('Failed to refetch settings:', error);
      }
    };
    fetchSettings();
  };

  const handleTestEmailSuccess = () => {
    // Refresh logs when test email is sent
    setRefreshLogsKey((k) => k + 1);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
      </div>
    );
  }

  if (error || !settings) {
    return (
      <Alert variant="destructive">
        <AlertDescription>{error || 'Failed to load payment automation settings'}</AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="w-full min-w-0 space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Payment Automation</h1>
          <p className="text-gray-600 mt-1">Manage automated payment reminders and escalations</p>
        </div>
        <Button
          onClick={() => {
            setActiveTab('test');
            setTestEmailOpen(true);
          }}
          className="gap-2 bg-fcGold text-white hover:bg-fcGold/90"
        >
          <Mail className="w-4 h-4" />
          Send Test Email
        </Button>
      </div>

      {/* Status Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="border-l-4 border-l-blue-500">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-gray-600 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-blue-500" />
              Payment Reminders
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {settings.enableReminders ? (
                <span className="text-green-600">●</span>
              ) : (
                <span className="text-gray-400">●</span>
              )}{' '}
              <span className="text-lg ml-2">
                {settings.enableReminders ? 'Active' : 'Inactive'}
              </span>
            </div>
            <p className="text-xs text-gray-500 mt-2">
              Sends after {settings.reminderDaysAfterDue} day{settings.reminderDaysAfterDue !== 1 ? 's' : ''} of invoice due date
            </p>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-red-500">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-gray-600 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-red-500" />
              Escalations
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {settings.enableEscalation ? (
                <span className="text-red-600">●</span>
              ) : (
                <span className="text-gray-400">●</span>
              )}{' '}
              <span className="text-lg ml-2">
                {settings.enableEscalation ? 'Active' : 'Inactive'}
              </span>
            </div>
            <p className="text-xs text-gray-500 mt-2">
              Triggers after {settings.escalationDaysOverdue} day{settings.escalationDaysOverdue !== 1 ? 's' : ''} overdue
            </p>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-purple-500">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-gray-600 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-purple-500" />
              Follow-ups
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {settings.enableFollowups ? (
                <span className="text-purple-600">●</span>
              ) : (
                <span className="text-gray-400">●</span>
              )}{' '}
              <span className="text-lg ml-2">
                {settings.enableFollowups ? 'Active' : 'Inactive'}
              </span>
            </div>
            <p className="text-xs text-gray-500 mt-2">
              Every {settings.followupFrequencyDays} day{settings.followupFrequencyDays !== 1 ? 's' : ''} (max {settings.maxFollowups})
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Tabs for Settings, Logs, and Test */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-8 gap-1 lg:grid-cols-8">
          <TabsTrigger value="overview" className="text-xs sm:text-sm">
            Overview
          </TabsTrigger>
          <TabsTrigger value="logs" className="text-xs sm:text-sm">
            Email Activity
          </TabsTrigger>
          <TabsTrigger value="analytics" className="text-xs sm:text-sm">
            Analytics
          </TabsTrigger>
          <TabsTrigger value="bounces" className="text-xs sm:text-sm">
            Bounce Mgmt
          </TabsTrigger>
          <TabsTrigger value="engagement" className="text-xs sm:text-sm">
            Engagement
          </TabsTrigger>
          <TabsTrigger value="unsubscribes" className="text-xs sm:text-sm">
            Unsub List
          </TabsTrigger>
          <TabsTrigger value="settings" className="text-xs sm:text-sm">
            Settings
          </TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview">
          <Card>
            <CardHeader>
              <CardTitle>System Status</CardTitle>
              <CardDescription>Summary of payment automation configuration</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div className="p-4 bg-gray-50 rounded-lg">
                  <p className="text-sm text-gray-600 mb-2">Branch</p>
                  <p className="text-lg font-semibold">{settings.branch}</p>
                </div>
                <div className="p-4 bg-gray-50 rounded-lg">
                  <p className="text-sm text-gray-600 mb-2">Last Updated</p>
                  <p className="text-lg font-semibold">
                    {new Date(settings.updatedAt).toLocaleDateString()}
                  </p>
                </div>
                <div className="p-4 bg-gray-50 rounded-lg">
                  <p className="text-sm text-gray-600 mb-2">Admin Notification Emails</p>
                  <p className="text-sm font-mono">
                    {settings.notificationEmails.length > 0
                      ? settings.notificationEmails.join(', ')
                      : 'None configured'}
                  </p>
                </div>
                <div className="p-4 bg-gray-50 rounded-lg">
                  <p className="text-sm text-gray-600 mb-2">Custom Template</p>
                  <p className="text-sm">
                    {settings.customEmailTemplate ? 'Custom HTML template' : 'Using default template'}
                  </p>
                </div>
              </div>

              <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                <p className="text-sm text-blue-900">
                  <strong>Tip:</strong> Use the Settings tab to modify automation rules, and the
                  Email Activity tab to view delivery logs and troubleshoot issues.
                </p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Email Activity Tab */}
        <TabsContent value="logs">
          <EmailLogsViewer refreshKey={refreshLogsKey} />
        </TabsContent>

        {/* Analytics Tab */}
        <TabsContent value="analytics">
          <Card>
            <CardHeader>
              <CardTitle>Email Analytics & Engagement</CardTitle>
              <CardDescription>View detailed metrics on email delivery, opens, and clicks</CardDescription>
            </CardHeader>
            <CardContent className="py-8">
              <div className="flex flex-col items-center justify-center gap-4">
                <p className="text-gray-600">Access comprehensive email analytics including delivery rates, open rates, and engagement metrics.</p>
                <Button
                  onClick={() => window.open('/admin/email-analytics', '_blank')}
                  className="bg-fcGold text-white hover:bg-fcGold/90"
                >
                  Open Analytics Dashboard
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Settings Tab */}
        <TabsContent value="settings">
          <AutomationSettingsForm settings={settings} onSuccess={handleSettingsSuccess} />
        </TabsContent>

        {/* Phase 5C - Bounce Management Tab */}
        <TabsContent value="bounces">
          <BounceManagementDashboard />
        </TabsContent>

        {/* Phase 5C - Engagement Scoring Tab */}
        <TabsContent value="engagement">
          <EngagementScoringDashboard />
        </TabsContent>

        {/* Phase 5C - Unsubscribe Management Tab */}
        <TabsContent value="unsubscribes">
          <UnsubscribeListManager />
        </TabsContent>
      </Tabs>

      {/* Test Email Modal */}
      <TestEmailModal
        isOpen={testEmailOpen}
        onOpenChange={setTestEmailOpen}
        onSuccess={handleTestEmailSuccess}
      />
    </div>
  );
}
