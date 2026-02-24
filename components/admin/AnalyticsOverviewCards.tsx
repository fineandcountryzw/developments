'use client';

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { TrendingUp, Mail, CheckCircle, MousePointer } from 'lucide-react';

interface OverviewData {
  totalSent: number;
  totalOpened: number;
  totalClicked: number;
  totalBounced: number;
  uniqueOpens: number;
  uniqueClicks: number;
  openRate: number;
  clickRate: number;
  bounceRate: number;
}

interface AnalyticsOverviewCardsProps {
  data: OverviewData;
}

export default function AnalyticsOverviewCards({ data }: AnalyticsOverviewCardsProps) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
      {/* Total Sent */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-gray-600 flex items-center gap-2">
            <Mail className="w-4 h-4" />
            Sent
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{data.totalSent}</div>
          <p className="text-xs text-gray-500 mt-1">Emails sent</p>
        </CardContent>
      </Card>

      {/* Open Rate */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-gray-600 flex items-center gap-2">
            <CheckCircle className="w-4 h-4" />
            Open Rate
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{data.openRate.toFixed(1)}%</div>
          <p className="text-xs text-gray-500 mt-1">{data.totalOpened} opens</p>
        </CardContent>
      </Card>

      {/* Click Rate */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-gray-600 flex items-center gap-2">
            <TrendingUp className="w-4 h-4" />
            Click Rate
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{data.clickRate.toFixed(1)}%</div>
          <p className="text-xs text-gray-500 mt-1">{data.totalClicked} clicks</p>
        </CardContent>
      </Card>

      {/* Bounce Rate */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-gray-600">Bounce Rate</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-red-600">{data.bounceRate.toFixed(1)}%</div>
          <p className="text-xs text-gray-500 mt-1">{data.totalBounced} bounces</p>
        </CardContent>
      </Card>

      {/* Engagement */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-gray-600">Engagement</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">
            {((data.openRate + data.clickRate) / 2).toFixed(1)}%
          </div>
          <p className="text-xs text-gray-500 mt-1">Avg engagement</p>
        </CardContent>
      </Card>
    </div>
  );
}
