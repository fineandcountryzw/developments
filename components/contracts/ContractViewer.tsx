'use client';

import React, { useState, useEffect } from 'react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { AlertCircle, Download, Send, History, Lock, CheckCircle } from 'lucide-react';

interface Signature {
  id: string;
  signerName: string;
  signerEmail: string;
  signerRole: string;
  status: 'pending' | 'signed' | 'declined';
  signedAt?: string;
  declineReason?: string;
  expiresAt: string;
}

interface Contract {
  id: string;
  title: string;
  status: 'draft' | 'in-review' | 'signed' | 'executed' | 'archived';
  templateName: string;
  content: string;
  createdAt: string;
  updatedAt: string;
  createdBy: string;
  signatures: Signature[];
  signedCount: number;
  requiredSignatures: number;
  version: number;
}

interface Activity {
  id: string;
  action: string;
  actor: string;
  timestamp: string;
  changesBefore?: Record<string, any>;
  changesAfter?: Record<string, any>;
}

interface ContractViewerProps {
  contractId: string;
  onClose?: () => void;
}

export function ContractViewer({ contractId, onClose }: ContractViewerProps) {
  const [contract, setContract] = useState<Contract | null>(null);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string>('');
  const [showSendDialog, setShowSendDialog] = useState(false);
  const [showSignDialog, setShowSignDialog] = useState(false);

  useEffect(() => {
    loadContract();
  }, [contractId]);

  const loadContract = async () => {
    try {
      setIsLoading(true);
      const response = await fetch(`/api/admin/contracts/${contractId}`);
      if (!response.ok) throw new Error('Failed to load contract');

      const data = await response.json();
      setContract(data.contract);

      // Load activities
      const actResponse = await fetch(`/api/admin/contracts/${contractId}/activities`);
      if (actResponse.ok) {
        const actData = await actResponse.json();
        setActivities(actData.activities || []);
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const downloadContract = async () => {
    try {
      // Open contract in new window for printing to PDF
      const printWindow = window.open(`/api/admin/contracts/${contractId}/download`, '_blank');
      if (printWindow) {
        printWindow.onload = () => {
          // Auto-trigger print dialog after a short delay
          setTimeout(() => {
            printWindow.print();
          }, 500);
        };
      }
    } catch (err: any) {
      setError(`Download failed: ${err.message}`);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'draft':
        return 'bg-gray-100 text-gray-800';
      case 'in-review':
        return 'bg-blue-100 text-blue-800';
      case 'signed':
        return 'bg-green-100 text-green-800';
      case 'executed':
        return 'bg-purple-100 text-purple-800';
      case 'archived':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="pt-6">
          <p className="text-center text-gray-500">Loading contract...</p>
        </CardContent>
      </Card>
    );
  }

  if (error || !contract) {
    return (
      <Card>
        <CardContent className="pt-6">
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error || 'Contract not found'}</AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    );
  }

  const completionPercent = Math.round(
    (contract.signedCount / contract.requiredSignatures) * 100
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <Card>
        <CardHeader>
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <CardTitle>{contract.title}</CardTitle>
              <CardDescription className="mt-2">
                Template: {contract.templateName} • Version {contract.version}
              </CardDescription>
            </div>
            <div className="flex gap-2">
              <Badge className={getStatusColor(contract.status)}>
                {contract.status.charAt(0).toUpperCase() + contract.status.slice(1)}
              </Badge>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Meta Info */}
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <p className="text-gray-600">Created</p>
              <p className="font-medium">{new Date(contract.createdAt).toLocaleDateString()}</p>
            </div>
            <div>
              <p className="text-gray-600">Created By</p>
              <p className="font-medium">{contract.createdBy}</p>
            </div>
          </div>

          {/* Progress */}
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span>Signature Progress</span>
              <span className="font-medium">
                {contract.signedCount}/{contract.requiredSignatures}
              </span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div
                className={`h-2 rounded-full transition-all ${
                  completionPercent === 100 ? 'bg-green-500' : 'bg-blue-500'
                }`}
                style={{ width: `${completionPercent}%` }}
              />
            </div>
            <p className="text-xs text-gray-600">{completionPercent}% complete</p>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-2 pt-2">
            <Button
              variant="outline"
              onClick={downloadContract}
              disabled={contract.status === 'draft'}
            >
              <Download className="w-4 h-4 mr-2" />
              Download PDF
            </Button>
            {contract.status !== 'archived' && contract.status !== 'executed' && (
              <>
                <Button onClick={() => setShowSendDialog(true)}>
                  <Send className="w-4 h-4 mr-2" />
                  Send for Signature
                </Button>
              </>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Content Tabs */}
      <Tabs defaultValue="document" className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="document">Document</TabsTrigger>
          <TabsTrigger value="signatures">
            Signatures
            {contract.signedCount < contract.requiredSignatures && (
              <Badge variant="destructive" className="ml-2 text-xs">
                {contract.requiredSignatures - contract.signedCount}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="history">History</TabsTrigger>
          <TabsTrigger value="versions">Versions</TabsTrigger>
        </TabsList>

        {/* Document Tab */}
        <TabsContent value="document">
          <Card>
            <CardContent className="pt-6">
              <div className="bg-white border rounded-lg p-8 max-h-96 overflow-y-auto prose prose-sm max-w-none">
                <div dangerouslySetInnerHTML={{ __html: contract.content }} />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Signatures Tab */}
        <TabsContent value="signatures">
          <Card>
            <CardContent className="pt-6">
              {contract.signatures.length === 0 ? (
                <p className="text-center text-gray-500">No signatures requested yet</p>
              ) : (
                <div className="space-y-3">
                  {contract.signatures.map(sig => (
                    <div
                      key={sig.id}
                      className="border rounded-lg p-4 space-y-2"
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-medium">{sig.signerName}</p>
                          <p className="text-sm text-gray-600">{sig.signerEmail}</p>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge
                            variant={
                              sig.status === 'signed'
                                ? 'default'
                                : sig.status === 'declined'
                                  ? 'destructive'
                                  : 'outline'
                            }
                          >
                            {sig.status === 'signed' && (
                              <>
                                <CheckCircle className="w-3 h-3 mr-1" />
                                Signed
                              </>
                            )}
                            {sig.status === 'pending' && 'Pending'}
                            {sig.status === 'declined' && 'Declined'}
                          </Badge>
                        </div>
                      </div>
                      <div className="text-xs text-gray-600">
                        <p>Role: {sig.signerRole}</p>
                        {sig.signedAt && (
                          <p>Signed: {new Date(sig.signedAt).toLocaleDateString()}</p>
                        )}
                        {sig.status === 'pending' && (
                          <p>Expires: {new Date(sig.expiresAt).toLocaleDateString()}</p>
                        )}
                        {sig.declineReason && (
                          <p className="text-red-600">Declined: {sig.declineReason}</p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* History Tab */}
        <TabsContent value="history">
          <Card>
            <CardContent className="pt-6">
              {activities.length === 0 ? (
                <p className="text-center text-gray-500">No activity yet</p>
              ) : (
                <div className="space-y-4">
                  {activities.map(activity => (
                    <div key={activity.id} className="border-l-4 border-blue-500 pl-4">
                      <div className="flex justify-between items-start">
                        <div>
                          <p className="font-medium">{activity.action}</p>
                          <p className="text-sm text-gray-600">By {activity.actor}</p>
                        </div>
                        <p className="text-xs text-gray-500">
                          {new Date(activity.timestamp).toLocaleString()}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Versions Tab */}
        <TabsContent value="versions">
          <Card>
            <CardContent className="pt-6">
              <p className="text-center text-gray-500">
                This contract is version {contract.version}
              </p>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Send for Signature Dialog */}
      <Dialog open={showSendDialog} onOpenChange={setShowSendDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Send for Signature</DialogTitle>
            <DialogDescription>
              Invite signers to review and sign this contract
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-gray-600">
              This will send signature requests to the specified signers via email.
            </p>
            <Button
              onClick={() => setShowSendDialog(false)}
              className="w-full"
            >
              Proceed
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}