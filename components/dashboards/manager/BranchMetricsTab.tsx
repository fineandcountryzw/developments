'use client';

import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import type { BranchMetrics } from './types';

type Props = {
  branchMetrics: BranchMetrics[];
};

export function ManagerBranchMetricsTab({ branchMetrics }: Props) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Branch Metrics</CardTitle>
        <CardDescription>Performance overview by branch</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <table className="w-full text-sm" role="table" aria-label="Branch performance metrics">
            <thead>
              <tr className="border-b">
                <th className="text-left py-2 font-semibold">Branch</th>
                <th className="text-center py-2 font-semibold">Leads</th>
                <th className="text-center py-2 font-semibold">Deals</th>
                <th className="text-center py-2 font-semibold">Revenue</th>
                <th className="text-center py-2 font-semibold">Agents</th>
                <th className="text-center py-2 font-semibold">Conversion</th>
              </tr>
            </thead>
            <tbody>
              {branchMetrics.length === 0 ? (
                <tr>
                  <td colSpan={6} className="text-center py-8 text-gray-500">
                    No branch data available
                  </td>
                </tr>
              ) : (
                branchMetrics.map((branch) => (
                  <tr key={branch.branch} className="border-b hover:bg-gray-50">
                    <td className="py-3 font-medium">{branch.branch}</td>
                    <td className="text-center py-3">{branch.totalLeads}</td>
                    <td className="text-center py-3 font-semibold">{branch.totalDeals}</td>
                    <td className="text-center py-3 font-semibold">USD {(branch.revenue / 1000).toFixed(0)}K</td>
                    <td className="text-center py-3">{branch.agents}</td>
                    <td className="text-center py-3">
                      <span className="bg-green-100 text-green-800 px-2 py-1 rounded text-xs font-medium">
                        {branch.conversionRate.toFixed(1)}%
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}

