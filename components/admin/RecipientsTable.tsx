'use client';

import React, { useState } from 'react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ChevronLeft, ChevronRight } from 'lucide-react';

interface Recipient {
  recipientEmail: string;
  clientName: string;
  openCount: number;
  clickCount: number;
  lastOpenedAt: string | null;
  deviceTypes: string[];
}

interface RecipientsTableProps {
  recipients: Recipient[];
  totalCount: number;
  onPageChange: (page: number) => void;
  currentPage: number;
  pageSize: number;
  sortBy?: 'openCount' | 'clickCount' | 'lastOpenedAt';
  isLoading?: boolean;
}

export default function RecipientsTable({
  recipients,
  totalCount,
  onPageChange,
  currentPage,
  pageSize,
  sortBy = 'openCount',
  isLoading = false,
}: RecipientsTableProps) {
  const totalPages = Math.ceil(totalCount / pageSize);
  const [hoveredRow, setHoveredRow] = useState<string | null>(null);

  const formatDate = (dateString: string | null) => {
    if (!dateString) return 'Never';
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;

    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined,
    });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Recipient Engagement</CardTitle>
        <CardDescription>
          Individual recipient statistics {totalCount > 0 && `(${totalCount} total)`}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[200px]">Email Address</TableHead>
                <TableHead className="w-[150px]">Client Name</TableHead>
                <TableHead className="text-center w-[80px]">
                  Opens {sortBy === 'openCount' && '↓'}
                </TableHead>
                <TableHead className="text-center w-[80px]">
                  Clicks {sortBy === 'clickCount' && '↓'}
                </TableHead>
                <TableHead className="text-center w-[120px]">
                  Last Opened {sortBy === 'lastOpenedAt' && '↓'}
                </TableHead>
                <TableHead className="w-[150px]">Devices</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8 text-gray-500">
                    Loading recipient data...
                  </TableCell>
                </TableRow>
              ) : recipients.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8 text-gray-500">
                    No recipient data available for the selected date range.
                  </TableCell>
                </TableRow>
              ) : (
                recipients.map((recipient) => (
                  <TableRow
                    key={recipient.recipientEmail}
                    className="cursor-pointer hover:bg-gray-50"
                    onMouseEnter={() => setHoveredRow(recipient.recipientEmail)}
                    onMouseLeave={() => setHoveredRow(null)}
                  >
                    <TableCell className="font-medium text-sm">{recipient.recipientEmail}</TableCell>
                    <TableCell className="text-sm text-gray-600">{recipient.clientName}</TableCell>
                    <TableCell className="text-center">
                      <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-green-100 text-green-800 font-semibold text-sm">
                        {recipient.openCount}
                      </span>
                    </TableCell>
                    <TableCell className="text-center">
                      <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-blue-100 text-blue-800 font-semibold text-sm">
                        {recipient.clickCount}
                      </span>
                    </TableCell>
                    <TableCell className="text-center text-sm text-gray-600">
                      {formatDate(recipient.lastOpenedAt)}
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {recipient.deviceTypes.length > 0 ? (
                          recipient.deviceTypes.map((device) => (
                            <span
                              key={device}
                              className="inline-flex items-center px-2 py-1 rounded-full text-xs bg-gray-100 text-gray-700 font-medium capitalize"
                            >
                              {device || 'Unknown'}
                            </span>
                          ))
                        ) : (
                          <span className="text-xs text-gray-500">-</span>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between mt-6 pt-4 border-t">
            <div className="text-sm text-gray-600">
              Showing {(currentPage - 1) * pageSize + 1} to{' '}
              {Math.min(currentPage * pageSize, totalCount)} of {totalCount} recipients
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => onPageChange(currentPage - 1)}
                disabled={currentPage === 1 || isLoading}
              >
                <ChevronLeft className="w-4 h-4" />
              </Button>
              <div className="flex items-center gap-1">
                {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
                  <Button
                    key={page}
                    variant={page === currentPage ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => onPageChange(page)}
                    disabled={isLoading}
                    className="w-8 h-8"
                  >
                    {page}
                  </Button>
                ))}
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => onPageChange(currentPage + 1)}
                disabled={currentPage === totalPages || isLoading}
              >
                <ChevronRight className="w-4 h-4" />
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
