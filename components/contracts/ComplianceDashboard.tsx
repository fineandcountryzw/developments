'use client';

import React, { useState, useEffect } from 'react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  AlertCircle,
  CheckCircle,
  Clock,
  TrendingUp,
  BarChart3,
  AlertTriangle,
} from 'lucide-react';

interface AnalyticsSummary {
  total: number;
  byStatus: Record<string, number>;
  totalValue: number;
  overdueSignatures: number;
  expiringThirtyDays: number;
}

interface SLAMetrics {
  averageTimeToSign: number;
  averageTimeToExecute: number;
  onTimeSigningRate: number;
  onTimeExecutionRate: number;
}

interface PendingItem {
  contractId: string;
  contractTitle: string;
  signerName: string;
  signerEmail: string;
  signerRole: string;
  daysOverdue: number;
  isOverdue: boolean;
}

interface Alert {
  contractId: string;
  contractTitle: string;
  signerName: string;
  daysOverdue: number;
}

interface ComplianceDashboardProps {
  branch?: string;
}

export function ComplianceDashboard({ branch = 'Harare' }: ComplianceDashboardProps) {
  const [summary, setSummary] = useState<AnalyticsSummary | null>(null);
  const [sla, setSLA] = useState<SLAMetrics | null>(null);
  const [pending, setPending] = useState<PendingItem[]>([]);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string>('');

  useEffect(() => {
    loadDashboard();
  }, [branch]);

  const loadDashboard = async () => {
    try {
      setIsLoading(true);

      // Load summary
      const summaryRes = await fetch(
        `/api/admin/contracts/analytics/summary?branch=${encodeURIComponent(branch)}`
      );
      if (summaryRes.ok) {
        const summaryData = await summaryRes.json();
        setSummary(summaryData.summary);
        setSLA(summaryData.sla);
      }

      // Load pending
      const pendingRes = await fetch(
        `/api/admin/contracts/analytics/pending?branch=${encodeURIComponent(branch)}`
      );
      if (pendingRes.ok) {
        const pendingData = await pendingRes.json();
        setPending(pendingData.pending.items || []);
        setAlerts(pendingData.pending.alerts || []);
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="pt-6">
          <p className="text-center text-gray-500">Loading dashboard...</p>
        </CardContent>
      </Card>
    );
  }

  const statusCards = [
    {
      key: 'draft',
      label: 'Draft',
      value: summary?.byStatus?.['draft'] || 0,
      icon: Clock,
      color: 'bg-gray-100 text-gray-800',
    },
    {
      key: 'in-review',
      label: 'In Review',
      value: summary?.byStatus?.['in-review'] || 0,
      icon: AlertCircle,
      color: 'bg-blue-100 text-blue-800',
    },
    {
      key: 'signed',
      label: 'Signed',
      value: summary?.byStatus?.['signed'] || 0,
      icon: CheckCircle,
      color: 'bg-green-100 text-green-800',
    },
    {
      key: 'executed',
      label: 'Executed',
      value: summary?.byStatus?.['executed'] || 0,
      icon: CheckCircle,
      color: 'bg-purple-100 text-purple-800',
    },
  ];

  return (
    <div className="space-y-6">
      {/* Alerts Section */}
      {alerts.length > 0 && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            {alerts.length} contract{alerts.length !== 1 ? 's' : ''} have overdue signatures
            (more than 5 days)
          </AlertDescription>
        </Alert>
      )}

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {statusCards.map(card => (
          <Card key={card.key}>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">{card.label}</p>
                  <p className="text-2xl font-bold">{card.value}</p>
                </div>
                <div className={`p-3 rounded-lg ${card.color}`}>
                  <card.icon className="w-6 h-6" />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Key Metrics */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="w-5 h-5" />
            Key Metrics
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div>
              <p className="text-sm text-gray-600">Total Value</p>
              <p className="text-2xl font-bold">
                ${(summary?.totalValue || 0).toLocaleString('en-US', {
                  minimumFractionDigits: 2,
                })}
              </p>
            </div>
            <div>
              <p className="text-sm text-gray-600">Overdue Signatures</p>
              <p className="text-2xl font-bold text-red-600">
                {summary?.overdueSignatures || 0}
              </p>
            </div>
            <div>
              <p className="text-sm text-gray-600">Expiring in 30 Days</p>
              <p className="text-2xl font-bold text-yellow-600">
                {summary?.expiringThirtyDays || 0}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* SLA Metrics */}
      {sla && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="w-5 h-5" />
              SLA Performance
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <p className="text-sm text-gray-600">Avg. Time to Sign</p>
                <p className="text-2xl font-bold">{sla.averageTimeToSign} days</p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Avg. Time to Execute</p>
                <p className="text-2xl font-bold">{sla.averageTimeToExecute} days</p>
              </div>
              <div>
                <p className="text-sm text-gray-600">On-Time Signing Rate</p>
                <div className="flex items-center gap-2">
                  <p className="text-2xl font-bold">{sla.onTimeSigningRate}%</p>
                  {sla.onTimeSigningRate >= 95 ? (
                    <Badge className="bg-green-600">Good</Badge>
                  ) : sla.onTimeSigningRate >= 80 ? (
                    <Badge className="bg-yellow-600">Fair</Badge>
                  ) : (
                    <Badge variant="destructive">Poor</Badge>
                  )}
                </div>
              </div>
              <div>
                <p className="text-sm text-gray-600">On-Time Execution Rate</p>
                <div className="flex items-center gap-2">
                  <p className="text-2xl font-bold">{sla.onTimeExecutionRate}%</p>
                  {sla.onTimeExecutionRate >= 95 ? (
                    <Badge className="bg-green-600">Good</Badge>
                  ) : sla.onTimeExecutionRate >= 80 ? (
                    <Badge className="bg-yellow-600">Fair</Badge>
                  ) : (
                    <Badge variant="destructive">Poor</Badge>
                  )}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Pending Signatures */}
      <Card>
        <CardHeader>
          <CardTitle>Pending Signatures</CardTitle>
          <CardDescription>
            {pending.length} signature{pending.length !== 1 ? 's' : ''} awaiting action
          </CardDescription>
        </CardHeader>
        <CardContent>
          {pending.length === 0 ? (
            <p className="text-center text-gray-500 py-8">
              No pending signatures at this time
            </p>
          ) : (
            <div className="space-y-3 max-h-96 overflow-y-auto">
              {pending.map(item => (
                <div
                  key={`${item.contractId}-${item.signerEmail}`}
                  className={`border rounded-lg p-4 ${
                    item.isOverdue ? 'bg-red-50 border-red-200' : ''
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex-1">
                      <p className="font-medium">{item.contractTitle}</p>
                      <p className="text-sm text-gray-600">
                        {item.signerName} ({item.signerRole})
                      </p>
                    </div>
                    {item.isOverdue && (
                      <Badge variant="destructive">
                        {item.daysOverdue}d overdue
                      </Badge>
                    )}
                  </div>
                  <p className="text-xs text-gray-500">{item.signerEmail}</p>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Critical Alerts */}
      {alerts.length > 0 && (
        <Card className="border-red-200 bg-red-50">
          <CardHeader>
            <CardTitle className="text-red-800 flex items-center gap-2">
              <AlertTriangle className="w-5 h-5" />
              Critical Alerts
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {alerts.map(alert => (
                <div
                  key={`${alert.contractId}-${alert.signerName}`}
                  className="border-l-4 border-red-500 pl-4 py-2"
                >
                  <p className="font-medium text-red-900">{alert.contractTitle}</p>
                  <p className="text-sm text-red-800">
                    {alert.signerName} signature overdue by {alert.daysOverdue} days
                  </p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}