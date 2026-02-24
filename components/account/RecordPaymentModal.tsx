'use client';

import React, { useState, useCallback } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Loader2, DollarSign, User, Home, CreditCard, FileText, Receipt } from 'lucide-react';
import { formatCurrency } from '@/lib/utils';
import { logger } from '@/lib/logger';

interface RecordPaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
  branch: string;
  preselectedStand?: {
    id: string;
    standNumber: string;
    developmentName: string;
    clientId?: string;
    clientName?: string;
  } | null;
}

interface PaymentFormData {
  clientId: string;
  clientName: string;
  amount: string;
  surcharge_amount: string;
  standId: string;
  standNumber: string;
  payment_type: 'Deposit' | 'Installment' | 'Agreement of Sale Fee' | 'Endowment Fees' | 'VAT Fees';
  payment_method: 'Cash' | 'Bank';
  office_location: string;
  reference: string;
  manual_receipt_no: string;
  description: string;
  status: 'PENDING' | 'CONFIRMED';
}

const initialFormData: PaymentFormData = {
  clientId: '',
  clientName: '',
  amount: '',
  surcharge_amount: '',
  standId: '',
  standNumber: '',
  payment_type: 'Deposit',
  payment_method: 'Cash',
  office_location: 'Harare',
  reference: '',
  manual_receipt_no: '',
  description: '',
  status: 'CONFIRMED',
};

export default function RecordPaymentModal({
  isOpen,
  onClose,
  onSuccess,
  branch,
  preselectedStand,
}: RecordPaymentModalProps) {
  const [formData, setFormData] = useState<PaymentFormData>({
    ...initialFormData,
    office_location: branch,
    standId: preselectedStand?.id || '',
    clientId: preselectedStand?.clientId || '',
    clientName: preselectedStand?.clientName || '',
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Array<{
    id: string;
    standNumber: string;
    developmentName: string;
    clientId?: string;
    clientName?: string;
    price?: number;
  }>>([]);
  const [isSearching, setIsSearching] = useState(false);

  // Reset form when modal opens/closes
  React.useEffect(() => {
    if (isOpen) {
      setFormData({
        ...initialFormData,
        office_location: branch,
        standId: preselectedStand?.id || '',
        clientId: preselectedStand?.clientId || '',
        clientName: preselectedStand?.clientName || '',
      });
      setError(null);
      setSearchQuery('');
      setSearchResults([]);
    }
  }, [isOpen, branch, preselectedStand]);

  const handleInputChange = useCallback((field: keyof PaymentFormData, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    setError(null);
  }, []);

  const searchStands = useCallback(async () => {
    if (!searchQuery.trim()) return;
    
    setIsSearching(true);
    try {
      const params = new URLSearchParams({
        search: searchQuery,
        branch,
        status: 'AVAILABLE,SOLD,RESERVED',
      });
      
      const response = await fetch(`/api/account/stands-payments?${params.toString()}`);
      if (response.ok) {
        const data = await response.json();
        // Transform stands data for search results
        const stands = data.stands?.map((s: any) => ({
          id: s.standId,
          standNumber: s.standNumber,
          developmentName: s.developmentName,
          clientId: s.clientId,
          clientName: s.clientName,
          price: s.standPrice,
        })) || [];
        setSearchResults(stands);
      }
    } catch (err) {
      logger.error('Error searching stands', err instanceof Error ? err : undefined, { module: 'RecordPaymentModal' });
    } finally {
      setIsSearching(false);
    }
  }, [searchQuery, branch]);

  const selectStand = useCallback((stand: typeof searchResults[0]) => {
    setFormData(prev => ({
      ...prev,
      standId: stand.id,
      clientId: stand.clientId || prev.clientId,
      clientName: stand.clientName || prev.clientName,
    }));
    setSearchResults([]);
    setSearchQuery('');
  }, []);

  const validateForm = useCallback((): boolean => {
    if (!formData.clientName.trim()) {
      setError('Client name is required');
      return false;
    }
    if (!formData.amount || parseFloat(formData.amount) <= 0) {
      setError('Valid amount is required');
      return false;
    }
    if (!formData.standId.trim()) {
      setError('Stand selection is required');
      return false;
    }
    if (!formData.reference.trim()) {
      setError('Reference number is required');
      return false;
    }
    if (!formData.manual_receipt_no.trim()) {
      setError('Receipt number is required');
      return false;
    }
    return true;
  }, [formData]);

  const handleSubmit = useCallback(async () => {
    if (!validateForm()) return;

    setIsSubmitting(true);
    setError(null);

    try {
      // Build payload with proper data types
      const payload = {
        clientId: formData.clientId || 'STAND-ONLY',
        clientName: formData.clientName.trim(),
        amount: parseFloat(formData.amount),
        surcharge_amount: formData.surcharge_amount ? parseFloat(formData.surcharge_amount) : 0,
        standId: formData.standId.trim(),
        standNumber: formData.standNumber?.trim() || undefined,
        payment_type: formData.payment_type,
        payment_method: formData.payment_method,
        office_location: formData.office_location,
        reference: formData.reference.trim(),
        manual_receipt_no: formData.manual_receipt_no.trim(),
        description: formData.description?.trim() || undefined,
      };

      console.log('Submitting payment payload:', payload);

      const response = await fetch('/api/account/payments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || errorData.error || 'Failed to record payment');
      }

      const result = await response.json();
      
      logger.info('Payment recorded successfully', {
        module: 'RecordPaymentModal',
        paymentId: result.data?.id,
        amount: payload.amount,
      });

      onSuccess?.();
      onClose();
    } catch (err: any) {
      logger.error('Error recording payment', err, { module: 'RecordPaymentModal' });
      setError(err.message || 'Failed to record payment. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  }, [formData, validateForm, onSuccess, onClose]);

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl">
            <DollarSign className="w-6 h-6 text-[#B8860B]" />
            Record Payment
          </DialogTitle>
          <DialogDescription>
            Record a new payment for a client. All fields marked with * are required.
          </DialogDescription>
        </DialogHeader>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
            {error}
          </div>
        )}

        <div className="space-y-6 py-4">
          {/* Stand Selection */}
          {!preselectedStand && (
            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <Home className="w-4 h-4" />
                Stand Search
              </Label>
              <div className="flex gap-2">
                <Input
                  placeholder="Search by stand number or development..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && searchStands()}
                />
                <Button
                  type="button"
                  variant="outline"
                  onClick={searchStands}
                  disabled={isSearching}
                >
                  {isSearching ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Search'}
                </Button>
              </div>
              
              {searchResults.length > 0 && (
                <div className="border rounded-lg max-h-40 overflow-y-auto">
                  {searchResults.map((stand) => (
                    <button
                      key={stand.id}
                      type="button"
                      className="w-full text-left px-4 py-2 hover:bg-gray-50 border-b last:border-b-0 flex justify-between items-center"
                      onClick={() => selectStand(stand)}
                    >
                      <div>
                        <span className="font-medium">Stand {stand.standNumber}</span>
                        <span className="text-gray-500 ml-2">- {stand.developmentName}</span>
                      </div>
                      {stand.price && (
                        <Badge variant="outline">{formatCurrency(stand.price)}</Badge>
                      )}
                    </button>
                  ))}
                </div>
              )}
              
              {formData.standId && (
                <div className="flex items-center gap-2 text-sm text-green-600">
                  <CheckIcon className="w-4 h-4" />
                  Stand selected
                </div>
              )}
            </div>
          )}

          {preselectedStand && (
            <div className="bg-gray-50 p-4 rounded-lg">
              <div className="flex items-center gap-2 text-sm text-gray-600">
                <Home className="w-4 h-4" />
                <span>Stand {preselectedStand.standNumber}</span>
                <span className="text-gray-400">|</span>
                <span>{preselectedStand.developmentName}</span>
              </div>
            </div>
          )}

          {/* Client Information */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="clientName" className="flex items-center gap-2">
                <User className="w-4 h-4" />
                Client Name *
              </Label>
              <Input
                id="clientName"
                value={formData.clientName}
                onChange={(e) => handleInputChange('clientName', e.target.value)}
                placeholder="Enter client name"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="clientId">Client ID (Optional)</Label>
              <Input
                id="clientId"
                value={formData.clientId}
                onChange={(e) => handleInputChange('clientId', e.target.value)}
                placeholder="Client system ID"
              />
            </div>
          </div>

          {/* Payment Details */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="amount" className="flex items-center gap-2">
                <DollarSign className="w-4 h-4" />
                Amount *
              </Label>
              <Input
                id="amount"
                type="number"
                min="0"
                step="0.01"
                value={formData.amount}
                onChange={(e) => handleInputChange('amount', e.target.value)}
                placeholder="0.00"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="payment_type">Payment Type *</Label>
              <Select
                value={formData.payment_type}
                onValueChange={(value) => handleInputChange('payment_type', value)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Deposit">Deposit</SelectItem>
                  <SelectItem value="Installment">Installment</SelectItem>
                  <SelectItem value="Agreement of Sale Fee">Agreement of Sale Fee</SelectItem>
                  <SelectItem value="Endowment Fees">Endowment Fees</SelectItem>
                  <SelectItem value="VAT Fees">VAT Fees</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Payment Method & Status */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="payment_method" className="flex items-center gap-2">
                <CreditCard className="w-4 h-4" />
                Payment Method *
              </Label>
              <Select
                value={formData.payment_method}
                onValueChange={(value) => handleInputChange('payment_method', value)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Cash">Cash</SelectItem>
                  <SelectItem value="Bank">Bank Transfer</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="status">Status *</Label>
              <Select
                value={formData.status}
                onValueChange={(value) => handleInputChange('status', value as 'PENDING' | 'CONFIRMED')}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="CONFIRMED">Confirmed</SelectItem>
                  <SelectItem value="PENDING">Pending</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Reference & Receipt */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="reference" className="flex items-center gap-2">
                <FileText className="w-4 h-4" />
                Reference Number *
              </Label>
              <Input
                id="reference"
                value={formData.reference}
                onChange={(e) => handleInputChange('reference', e.target.value)}
                placeholder="e.g., BANK-REF-001"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="manual_receipt_no" className="flex items-center gap-2">
                <Receipt className="w-4 h-4" />
                Receipt Number *
              </Label>
              <Input
                id="manual_receipt_no"
                value={formData.manual_receipt_no}
                onChange={(e) => handleInputChange('manual_receipt_no', e.target.value)}
                placeholder="e.g., RCP-001"
              />
            </div>
          </div>

          {/* Office Location */}
          <div className="space-y-2">
            <Label htmlFor="office_location">Office Location *</Label>
            <Select
              value={formData.office_location}
              onValueChange={(value) => handleInputChange('office_location', value)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Harare">Harare</SelectItem>
                <SelectItem value="Bulawayo">Bulawayo</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Description */}
          <div className="space-y-2">
            <Label htmlFor="description">Description (Optional)</Label>
            <Input
              id="description"
              value={formData.description}
              onChange={(e) => handleInputChange('description', e.target.value)}
              placeholder="Additional notes about this payment"
            />
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onClose} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={isSubmitting}
            className="bg-[#B8860B] hover:bg-[#9A7209] text-white"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Recording...
              </>
            ) : (
              <>
                <DollarSign className="w-4 h-4 mr-2" />
                Record Payment
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// Simple check icon component
function CheckIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M5 13l4 4L19 7"
      />
    </svg>
  );
}