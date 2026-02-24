'use client';

import React, { useMemo } from 'react';
import { Users } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import type { TeamMember } from './types';

type Props = {
  teamMembers: TeamMember[];
  selectedBranch: string;
};

export function ManagerTeamTab({ teamMembers, selectedBranch }: Props) {
  const filteredTeam = useMemo(() => {
    return selectedBranch === 'all' ? teamMembers : teamMembers.filter((m) => m.branch === selectedBranch);
  }, [teamMembers, selectedBranch]);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Team Members Performance</CardTitle>
        <CardDescription>Individual agent metrics and targets</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {filteredTeam.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              <Users className="w-12 h-12 mx-auto mb-3 opacity-50" />
              <p>No team members found</p>
            </div>
          ) : (
            filteredTeam.map((member) => (
              <div
                key={member.id}
                className="flex items-center justify-between p-4 border rounded-lg hover:bg-gray-50 transition-colors"
              >
                <div className="flex-1">
                  <div className="font-semibold">{member.name}</div>
                  <div className="text-sm text-gray-600">{member.email}</div>
                  <div className="text-xs text-gray-500 mt-1">{member.lastActivity}</div>
                </div>

                <div className="grid grid-cols-4 gap-6">
                  <div className="text-center">
                    <div className="text-lg font-bold">{member.leadsGenerated}</div>
                    <div className="text-xs text-gray-600">Leads</div>
                  </div>
                  <div className="text-center">
                    <div className="text-lg font-bold">{member.dealsClosedThisMonth}</div>
                    <div className="text-xs text-gray-600">Deals</div>
                  </div>
                  <div className="text-center">
                    <div className="text-lg font-bold">{member.conversionRate.toFixed(1)}%</div>
                    <div className="text-xs text-gray-600">Conversion</div>
                  </div>
                  <div className="text-center">
                    <div className="text-lg font-bold text-green-600">{member.targetAchievement}%</div>
                    <div className="text-xs text-gray-600">Target</div>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </CardContent>
    </Card>
  );
}

