'use client';

import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

interface ChartData {
  overview: {
    totalSent: number;
    totalOpened: number;
    totalClicked: number;
    totalBounced: number;
    openRate: number;
    clickRate: number;
    bounceRate: number;
  };
  actionBreakdown: Array<{ action: string; count: number }>;
  deviceBreakdown: Array<{ deviceType: string; count: number }>;
}

export default function AnalyticsCharts({
  overview,
  actionBreakdown,
  deviceBreakdown,
}: ChartData) {
  return (
    <Tabs defaultValue="overview" className="w-full">
      <TabsList className="grid w-full grid-cols-3">
        <TabsTrigger value="overview">Delivery Overview</TabsTrigger>
        <TabsTrigger value="actions">By Action Type</TabsTrigger>
        <TabsTrigger value="devices">By Device Type</TabsTrigger>
      </TabsList>

      {/* Delivery Overview */}
      <TabsContent value="overview">
        <Card>
          <CardHeader>
            <CardTitle>Email Delivery Metrics</CardTitle>
            <CardDescription>Overview of sent, opened, clicked, and bounced emails</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Delivery Status */}
            <div>
              <h3 className="font-semibold mb-4">Delivery Status</h3>
              <div className="space-y-3">
                <div>
                  <div className="flex justify-between mb-1">
                    <span className="text-sm font-medium">Sent</span>
                    <span className="text-sm">{overview.totalSent}</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div
                      className="bg-blue-600 h-2 rounded-full"
                      style={{ width: '100%' }}
                    ></div>
                  </div>
                </div>

                <div>
                  <div className="flex justify-between mb-1">
                    <span className="text-sm font-medium">Opened ({overview.openRate.toFixed(1)}%)</span>
                    <span className="text-sm">{overview.totalOpened}</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div
                      className="bg-green-600 h-2 rounded-full"
                      style={{
                        width: `${(overview.totalOpened / overview.totalSent) * 100}%`,
                      }}
                    ></div>
                  </div>
                </div>

                <div>
                  <div className="flex justify-between mb-1">
                    <span className="text-sm font-medium">Clicked ({overview.clickRate.toFixed(1)}%)</span>
                    <span className="text-sm">{overview.totalClicked}</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div
                      className="bg-purple-600 h-2 rounded-full"
                      style={{
                        width: `${(overview.totalClicked / overview.totalSent) * 100}%`,
                      }}
                    ></div>
                  </div>
                </div>

                <div>
                  <div className="flex justify-between mb-1">
                    <span className="text-sm font-medium">Bounced ({overview.bounceRate.toFixed(1)}%)</span>
                    <span className="text-sm">{overview.totalBounced}</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div
                      className="bg-red-600 h-2 rounded-full"
                      style={{
                        width: `${(overview.totalBounced / overview.totalSent) * 100}%`,
                      }}
                    ></div>
                  </div>
                </div>
              </div>
            </div>

            {/* Key Metrics */}
            <div className="grid grid-cols-3 gap-4 pt-4 border-t">
              <div className="text-center">
                <p className="text-2xl font-bold">{overview.openRate.toFixed(1)}%</p>
                <p className="text-xs text-gray-600">Open Rate</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold">{overview.clickRate.toFixed(1)}%</p>
                <p className="text-xs text-gray-600">Click Rate</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold">{overview.bounceRate.toFixed(1)}%</p>
                <p className="text-xs text-gray-600">Bounce Rate</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </TabsContent>

      {/* By Action Type */}
      <TabsContent value="actions">
        <Card>
          <CardHeader>
            <CardTitle>Performance by Action Type</CardTitle>
            <CardDescription>Email metrics broken down by action (Reminder, Escalation, Follow-up)</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {actionBreakdown.map((item) => (
                <div key={item.action}>
                  <div className="flex justify-between mb-2">
                    <span className="font-medium text-sm">{item.action}</span>
                    <span className="text-sm text-gray-600">{item.count} sent</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-3">
                    <div
                      className="bg-blue-600 h-3 rounded-full"
                      style={{
                        width: `${(item.count / Math.max(...actionBreakdown.map((a) => a.count))) * 100}%`,
                      }}
                    ></div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </TabsContent>

      {/* By Device Type */}
      <TabsContent value="devices">
        <Card>
          <CardHeader>
            <CardTitle>Engagement by Device Type</CardTitle>
            <CardDescription>How recipients opened/clicked emails across devices</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {deviceBreakdown.map((item) => (
                <div key={item.deviceType}>
                  <div className="flex justify-between mb-2">
                    <span className="font-medium text-sm capitalize">{item.deviceType || 'Unknown'}</span>
                    <span className="text-sm text-gray-600">{item.count} interactions</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-3">
                    <div
                      className="bg-purple-600 h-3 rounded-full"
                      style={{
                        width: `${(item.count / Math.max(...deviceBreakdown.map((d) => d.count))) * 100}%`,
                      }}
                    ></div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </TabsContent>
    </Tabs>
  );
}
