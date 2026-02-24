'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Loader2 } from 'lucide-react';

interface Automation {
  id: string;
  name: string;
  description: string | null;
  enabled: boolean;
  triggerType: string;
  eventType: string | null;
  schedule: string | null;
  entityType: string;
  lastRunAt: Date | null;
  runCount: number;
  successCount: number;
  failureCount: number;
  _count: {
    runs: number;
  };
}

export default function AutomationList() {
  const [automations, setAutomations] = useState<Automation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  useEffect(() => {
    fetchAutomations();
  }, []);
  
  const fetchAutomations = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/admin/automations');
      if (!response.ok) throw new Error('Failed to fetch automations');
      
      const result = await response.json();
      setAutomations(result.data || []);
      setError(null);
    } catch (err: any) {
      setError(err.message || 'Failed to load automations');
    } finally {
      setLoading(false);
    }
  };
  
  const toggleEnabled = async (id: string, currentEnabled: boolean) => {
    try {
      const response = await fetch(`/api/admin/automations/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled: !currentEnabled })
      });
      
      if (!response.ok) throw new Error('Failed to update automation');
      
      fetchAutomations();
    } catch (err: any) {
      alert(`Failed to update automation: ${err.message}`);
    }
  };
  
  const getSuccessRate = (automation: Automation): number => {
    if (automation.runCount === 0) return 0;
    return Math.round((automation.successCount / automation.runCount) * 100);
  };
  
  const getTriggerDisplay = (automation: Automation): string => {
    if (automation.triggerType === 'event') {
      return automation.eventType || 'N/A';
    }
    if (automation.triggerType === 'schedule') {
      return automation.schedule || 'N/A';
    }
    return automation.triggerType;
  };
  
  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
      </div>
    );
  }
  
  if (error) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="text-red-600">{error}</div>
        </CardContent>
      </Card>
    );
  }
  
  return (
    <Card>
      <CardHeader>
        <CardTitle>Automations</CardTitle>
        <CardDescription>
          Manage automated workflows and triggers
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Trigger</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Last Run</TableHead>
              <TableHead>Success Rate</TableHead>
              <TableHead>Runs</TableHead>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {automations.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center text-gray-500">
                  No automations found
                </TableCell>
              </TableRow>
            ) : (
              automations.map(automation => (
                <TableRow key={automation.id}>
                  <TableCell className="font-medium">{automation.name}</TableCell>
                  <TableCell>
                    <code className="text-xs bg-gray-100 px-2 py-1 rounded">
                      {getTriggerDisplay(automation)}
                    </code>
                  </TableCell>
                  <TableCell>
                    <Badge variant={automation.enabled ? 'default' : 'secondary'}>
                      {automation.enabled ? 'Enabled' : 'Disabled'}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {automation.lastRunAt
                      ? new Date(automation.lastRunAt).toLocaleString()
                      : 'Never'}
                  </TableCell>
                  <TableCell>
                    {automation.runCount > 0 ? (
                      <span className={getSuccessRate(automation) >= 90 ? 'text-green-600' : 'text-yellow-600'}>
                        {getSuccessRate(automation)}%
                      </span>
                    ) : (
                      <span className="text-gray-400">N/A</span>
                    )}
                  </TableCell>
                  <TableCell>{automation.runCount}</TableCell>
                  <TableCell>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => toggleEnabled(automation.id, automation.enabled)}
                    >
                      {automation.enabled ? 'Disable' : 'Enable'}
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
