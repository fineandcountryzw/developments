'use client';

import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

interface TimelineDataPoint {
  timestamp: string;
  sent: number;
  opened: number;
  clicked: number;
  bounced: number;
  openRate: number;
  clickRate: number;
}

interface EngagementTimelineProps {
  data: TimelineDataPoint[];
  granularity: 'HOURLY' | 'DAILY' | 'WEEKLY' | 'MONTHLY';
  isLoading?: boolean;
}

export default function EngagementTimeline({
  data,
  granularity,
  isLoading = false,
}: EngagementTimelineProps) {
  const formatTimestamp = (timestamp: string, granularity: string) => {
    const date = new Date(timestamp);
    
    switch (granularity) {
      case 'HOURLY':
        return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
      case 'DAILY':
        return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      case 'WEEKLY':
        const nextWeek = new Date(date);
        nextWeek.setDate(nextWeek.getDate() + 6);
        return `${date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - ${nextWeek.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`;
      case 'MONTHLY':
        return date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
      default:
        return date.toLocaleDateString();
    }
  };

  const maxValue = Math.max(...data.map((d) => Math.max(d.sent, d.opened, d.clicked)));

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Engagement Timeline</CardTitle>
          <CardDescription>Email engagement trends over time</CardDescription>
        </CardHeader>
        <CardContent className="py-12 text-center text-gray-500">
          Loading timeline data...
        </CardContent>
      </Card>
    );
  }

  if (data.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Engagement Timeline</CardTitle>
          <CardDescription>Email engagement trends over time</CardDescription>
        </CardHeader>
        <CardContent className="py-12 text-center text-gray-500">
          No data available for the selected date range.
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Engagement Timeline</CardTitle>
        <CardDescription>Email engagement trends over time ({granularity})</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-6">
          {data.map((point, index) => {
            const sentPercent = (point.sent / maxValue) * 100;
            const openedPercent = (point.opened / maxValue) * 100;
            const clickedPercent = (point.clicked / maxValue) * 100;

            return (
              <div key={index} className="space-y-3 pb-4 border-b last:border-b-0">
                {/* Timestamp */}
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-sm">
                    {formatTimestamp(point.timestamp, granularity)}
                  </span>
                  <div className="flex gap-2">
                    <Badge variant="secondary" className="text-xs">
                      Sent: {point.sent}
                    </Badge>
                  </div>
                </div>

                {/* Sent Bar */}
                <div>
                  <div className="flex justify-between mb-1">
                    <span className="text-xs text-gray-600">Delivered</span>
                    <span className="text-xs font-medium">{point.sent} emails</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div
                      className="bg-blue-600 h-2 rounded-full transition-all"
                      style={{ width: `${sentPercent}%` }}
                    ></div>
                  </div>
                </div>

                {/* Opened Bar */}
                <div>
                  <div className="flex justify-between mb-1">
                    <span className="text-xs text-gray-600">
                      Opened ({point.openRate.toFixed(1)}%)
                    </span>
                    <span className="text-xs font-medium">{point.opened} emails</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div
                      className="bg-green-600 h-2 rounded-full transition-all"
                      style={{ width: `${openedPercent}%` }}
                    ></div>
                  </div>
                </div>

                {/* Clicked Bar */}
                <div>
                  <div className="flex justify-between mb-1">
                    <span className="text-xs text-gray-600">
                      Clicked ({point.clickRate.toFixed(1)}%)
                    </span>
                    <span className="text-xs font-medium">{point.clicked} emails</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div
                      className="bg-purple-600 h-2 rounded-full transition-all"
                      style={{ width: `${clickedPercent}%` }}
                    ></div>
                  </div>
                </div>

                {/* Bounced (if any) */}
                {point.bounced > 0 && (
                  <div>
                    <div className="flex justify-between mb-1">
                      <span className="text-xs text-gray-600">Bounced</span>
                      <span className="text-xs font-medium">{point.bounced} emails</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div
                        className="bg-red-600 h-2 rounded-full transition-all"
                        style={{
                          width: `${(point.bounced / maxValue) * 100}%`,
                        }}
                      ></div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Legend */}
        <div className="grid grid-cols-2 gap-4 mt-6 pt-4 border-t">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-blue-600"></div>
            <span className="text-xs text-gray-600">Delivered</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-green-600"></div>
            <span className="text-xs text-gray-600">Opened</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-purple-600"></div>
            <span className="text-xs text-gray-600">Clicked</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-red-600"></div>
            <span className="text-xs text-gray-600">Bounced</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
