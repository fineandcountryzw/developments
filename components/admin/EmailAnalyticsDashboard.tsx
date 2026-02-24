'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Loader2, BarChart3, TrendingUp, Mail } from 'lucide-react';
import AnalyticsOverviewCards from './AnalyticsOverviewCards';
import AnalyticsCharts from './AnalyticsCharts';
import RecipientsTable from './RecipientsTable';
import EngagementTimeline from './EngagementTimeline';

interface AnalyticsData {
  overview: {
    totalSent: number;
    totalOpened: number;
    totalClicked: number;
    totalBounced: number;
    uniqueOpens: number;
    uniqueClicks: number;
    openRate: number;
    clickRate: number;
    bounceRate: number;
  };
  actionBreakdown: Array<{ action: string; count: number }>;
  deviceBreakdown: Array<{ deviceType: string; count: number }>;
}

interface TimelineData {
  timeline: Array<{
    timestamp: string;
    sent: number;
    opened: number;
    clicked: number;
    bounced: number;
    openRate: number;
    clickRate: number;
  }>;
}

export default function EmailAnalyticsDashboard() {
  const [analyticsData, setAnalyticsData] = useState<AnalyticsData | null>(null);
  const [timelineData, setTimelineData] = useState<TimelineData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filter states
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [action, setAction] = useState('all');
  const [granularity, setGranularity] = useState('DAILY');
  const [activeTab, setActiveTab] = useState('overview');
  const [recipientsData, setRecipientsData] = useState<any>(null);
  const [currentPage, setCurrentPage] = useState(1);

  // Initialize with last 30 days
  useEffect(() => {
    const end = new Date();
    const start = new Date(end.getTime() - 30 * 24 * 60 * 60 * 1000);

    setEndDate(end.toISOString().split('T')[0]);
    setStartDate(start.toISOString().split('T')[0]);
  }, []);

  // Fetch analytics data
  useEffect(() => {
    if (!startDate || !endDate) return;

    const fetchAnalytics = async () => {
      try {
        setLoading(true);
        setError(null);

        const params = new URLSearchParams({
          startDate,
          endDate,
          ...(action && action !== 'all' && { action }),
        });

        const response = await fetch(`/api/admin/email-analytics/overview?${params}`);
        if (!response.ok) throw new Error('Failed to fetch analytics');

        const data = await response.json();
        setAnalyticsData(data);

        // Fetch timeline data
        const timelineParams = new URLSearchParams({
          startDate,
          endDate,
          granularity,
          ...(action && { action }),
        });

        const timelineResponse = await fetch(
          `/api/admin/email-analytics/timeline?${timelineParams}`
        );
        if (!timelineResponse.ok) throw new Error('Failed to fetch timeline');

        const timelineDataResponse = await timelineResponse.json();
        setTimelineData(timelineDataResponse);

        // Fetch recipients data
        const recipientsParams = new URLSearchParams({
          limit: '10',
          offset: '0',
          ...(action && { action }),
        });

        const recipientsResponse = await fetch(
          `/api/admin/email-analytics/recipients?${recipientsParams}`
        );
        if (!recipientsResponse.ok) throw new Error('Failed to fetch recipients');

        const recipientsDataResponse = await recipientsResponse.json();
        setRecipientsData(recipientsDataResponse);
      } catch (error) {
        setError(error instanceof Error ? error.message : 'Failed to fetch analytics');
      } finally {
        setLoading(false);
      }
    };

    fetchAnalytics();
  }, [startDate, endDate, action, granularity]);

  const handleResetFilters = () => {
    setAction('');
    const end = new Date();
    const start = new Date(end.getTime() - 30 * 24 * 60 * 60 * 1000);
    setStartDate(start.toISOString().split('T')[0]);
    setEndDate(end.toISOString().split('T')[0]);
  };

  if (loading && !analyticsData) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Email Analytics</h1>
          <p className="text-gray-600 mt-1">Track email delivery, opens, clicks, and engagement</p>
        </div>
        <Button className="gap-2 bg-fcGold text-white hover:bg-fcGold/90">
          <BarChart3 className="w-4 h-4" />
          Export Report
        </Button>
      </div>

      {/* Error Alert */}
      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle>Filters</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
            <div>
              <Label htmlFor="start-date">Start Date</Label>
              <Input
                id="start-date"
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="mt-1"
              />
            </div>

            <div>
              <Label htmlFor="end-date">End Date</Label>
              <Input
                id="end-date"
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="mt-1"
              />
            </div>

            <div>
              <Label htmlFor="action">Action Type</Label>
              <Select value={action} onValueChange={setAction}>
                <SelectTrigger id="action" className="mt-1">
                  <SelectValue placeholder="All Actions" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Actions</SelectItem>
                  <SelectItem value="REMINDER">Reminder</SelectItem>
                  <SelectItem value="ESCALATION">Escalation</SelectItem>
                  <SelectItem value="FOLLOWUP">Follow-up</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="granularity">Granularity</Label>
              <Select value={granularity} onValueChange={setGranularity}>
                <SelectTrigger id="granularity" className="mt-1">
                  <SelectValue placeholder="Daily" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="HOURLY">Hourly</SelectItem>
                  <SelectItem value="DAILY">Daily</SelectItem>
                  <SelectItem value="WEEKLY">Weekly</SelectItem>
                  <SelectItem value="MONTHLY">Monthly</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-end">
              <Button variant="outline" onClick={handleResetFilters} className="w-full">
                Reset Filters
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Overview Cards */}
      {analyticsData && <AnalyticsOverviewCards data={analyticsData.overview} />}

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-3 bg-gray-100">
          <TabsTrigger value="overview">Overview Charts</TabsTrigger>
          <TabsTrigger value="timeline">Engagement Timeline</TabsTrigger>
          <TabsTrigger value="recipients">Recipients</TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview">
          {analyticsData && (
            <AnalyticsCharts
              overview={analyticsData.overview}
              actionBreakdown={analyticsData.actionBreakdown}
              deviceBreakdown={analyticsData.deviceBreakdown}
            />
          )}
        </TabsContent>

        {/* Timeline Tab */}
        <TabsContent value="timeline">
          {timelineData && (
            <EngagementTimeline
              data={timelineData.timeline}
              granularity={granularity as 'HOURLY' | 'DAILY' | 'WEEKLY' | 'MONTHLY'}
              isLoading={loading}
            />
          )}
        </TabsContent>

        {/* Recipients Tab */}
        <TabsContent value="recipients">
          {recipientsData && (
            <RecipientsTable
              recipients={recipientsData.recipients}
              totalCount={recipientsData.total}
              onPageChange={(page) => setCurrentPage(page)}
              currentPage={currentPage}
              pageSize={10}
              isLoading={loading}
            />
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
