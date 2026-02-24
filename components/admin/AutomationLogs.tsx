'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Loader2, RefreshCw } from 'lucide-react';
import { Label } from '@/components/ui/label';

interface AutomationRun {
  id: string;
  automationId: string;
  automation: {
    id: string;
    name: string;
  };
  eventType: string;
  entityType: string;
  entityId: string;
  correlationId: string | null;
  status: string;
  actionType: string;
  actionTarget: string;
  errorMessage: string | null;
  durationMs: number | null;
  createdAt: Date;
  retryCount: number;
}

export default function AutomationLogs() {
  const [runs, setRuns] = useState<AutomationRun[]>([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({
    automationId: '',
    entityId: '',
    status: '',
    correlationId: ''
  });
  const [pagination, setPagination] = useState({
    total: 0,
    limit: 100,
    offset: 0
  });
  
  useEffect(() => {
    fetchLogs();
  }, [filters, pagination.offset]);
  
  const fetchLogs = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (filters.automationId) params.append('automationId', filters.automationId);
      if (filters.entityId) params.append('entityId', filters.entityId);
      if (filters.status) params.append('status', filters.status);
      if (filters.correlationId) params.append('correlationId', filters.correlationId);
      params.append('limit', pagination.limit.toString());
      params.append('offset', pagination.offset.toString());
      
      const response = await fetch(`/api/admin/automations/runs?${params}`);
      if (!response.ok) throw new Error('Failed to fetch logs');
      
      const result = await response.json();
      setRuns(result.data || []);
      setPagination(prev => ({
        ...prev,
        total: result.pagination?.total || 0
      }));
    } catch (err: any) {
      console.error('Failed to fetch logs:', err);
    } finally {
      setLoading(false);
    }
  };
  
  const retryRun = async (runId: string) => {
    try {
      const response = await fetch(`/api/admin/automations/runs/${runId}/retry`, {
        method: 'POST'
      });
      
      if (!response.ok) throw new Error('Failed to retry run');
      
      alert('Run queued for retry');
      fetchLogs();
    } catch (err: any) {
      alert(`Failed to retry run: ${err.message}`);
    }
  };
  
  const getStatusBadge = (status: string) => {
    const variants: Record<string, 'default' | 'secondary' | 'destructive'> = {
      'completed': 'default',
      'running': 'secondary',
      'failed': 'destructive',
      'pending': 'secondary'
    };
    
    return (
      <Badge variant={variants[status] || 'secondary'}>
        {status}
      </Badge>
    );
  };
  
  const resetFilters = () => {
    setFilters({
      automationId: '',
      entityId: '',
      status: '',
      correlationId: ''
    });
    setPagination(prev => ({ ...prev, offset: 0 }));
  };
  
  const totalPages = Math.ceil(pagination.total / pagination.limit);
  const currentPage = Math.floor(pagination.offset / pagination.limit) + 1;
  
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Automation Run History</CardTitle>
            <CardDescription>
              View and manage automation execution logs
            </CardDescription>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={fetchLogs}
            disabled={loading}
          >
            <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {/* Filters */}
        <div className="grid grid-cols-4 gap-4 mb-6">
          <div>
            <Label className="text-sm">Automation ID</Label>
            <Input
              placeholder="Filter by automation ID"
              value={filters.automationId}
              onChange={(e) => setFilters({ ...filters, automationId: e.target.value })}
              className="mt-1"
            />
          </div>
          <div>
            <Label className="text-sm">Entity ID</Label>
            <Input
              placeholder="Filter by entity ID"
              value={filters.entityId}
              onChange={(e) => setFilters({ ...filters, entityId: e.target.value })}
              className="mt-1"
            />
          </div>
          <div>
            <Label className="text-sm">Correlation ID</Label>
            <Input
              placeholder="Filter by correlation ID"
              value={filters.correlationId}
              onChange={(e) => setFilters({ ...filters, correlationId: e.target.value })}
              className="mt-1"
            />
          </div>
          <div>
            <Label className="text-sm">Status</Label>
            <Select
              value={filters.status}
              onValueChange={(value) => setFilters({ ...filters, status: value })}
            >
              <SelectTrigger className="mt-1">
                <SelectValue placeholder="All statuses" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">All</SelectItem>
                <SelectItem value="completed">Completed</SelectItem>
                <SelectItem value="failed">Failed</SelectItem>
                <SelectItem value="running">Running</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        
        <div className="flex justify-end mb-4">
          <Button variant="outline" size="sm" onClick={resetFilters}>
            Reset Filters
          </Button>
        </div>
        
        {/* Table */}
        {loading ? (
          <div className="flex items-center justify-center p-8">
            <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
          </div>
        ) : (
          <>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Timestamp</TableHead>
                  <TableHead>Automation</TableHead>
                  <TableHead>Event</TableHead>
                  <TableHead>Entity</TableHead>
                  <TableHead>Action</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Duration</TableHead>
                  <TableHead>Retries</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {runs.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={9} className="text-center text-gray-500">
                      No runs found
                    </TableCell>
                  </TableRow>
                ) : (
                  runs.map(run => (
                    <TableRow key={run.id}>
                      <TableCell>
                        {new Date(run.createdAt).toLocaleString()}
                      </TableCell>
                      <TableCell>
                        <div>
                          <div className="font-medium">{run.automation.name}</div>
                          <div className="text-xs text-gray-500">{run.automationId}</div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <code className="text-xs bg-gray-100 px-2 py-1 rounded">
                          {run.eventType}
                        </code>
                      </TableCell>
                      <TableCell>
                        <div>
                          <div>{run.entityId}</div>
                          {run.correlationId && (
                            <div className="text-xs text-gray-500">
                              Corr: {run.correlationId}
                            </div>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div>
                          <div className="text-sm">{run.actionType}</div>
                          <div className="text-xs text-gray-500">{run.actionTarget}</div>
                        </div>
                      </TableCell>
                      <TableCell>
                        {getStatusBadge(run.status)}
                      </TableCell>
                      <TableCell>
                        {run.durationMs ? `${run.durationMs}ms` : 'N/A'}
                      </TableCell>
                      <TableCell>
                        {run.retryCount > 0 ? (
                          <Badge variant="outline">{run.retryCount}</Badge>
                        ) : (
                          <span className="text-gray-400">0</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {run.status === 'failed' && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => retryRun(run.id)}
                          >
                            Retry
                          </Button>
                        )}
                        {run.errorMessage && (
                          <div className="text-xs text-red-600 mt-1" title={run.errorMessage}>
                            {run.errorMessage.substring(0, 50)}...
                          </div>
                        )}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
            
            {/* Pagination */}
            {pagination.total > pagination.limit && (
              <div className="flex items-center justify-between mt-4">
                <div className="text-sm text-gray-600">
                  Showing {pagination.offset + 1} to {Math.min(pagination.offset + pagination.limit, pagination.total)} of {pagination.total}
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPagination(prev => ({ ...prev, offset: Math.max(0, prev.offset - prev.limit) }))}
                    disabled={pagination.offset === 0}
                  >
                    Previous
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPagination(prev => ({ ...prev, offset: prev.offset + prev.limit }))}
                    disabled={pagination.offset + pagination.limit >= pagination.total}
                  >
                    Next
                  </Button>
                </div>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
