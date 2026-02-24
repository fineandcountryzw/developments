
import React, { useState } from 'react';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
    DialogFooter,
    DialogClose
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { AlertTriangle, Loader2 } from 'lucide-react';

interface VoidPaymentModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess: () => void;
    paymentId: string;
}

export const VoidPaymentModal: React.FC<VoidPaymentModalProps> = ({
    isOpen,
    onClose,
    onSuccess,
    paymentId
}) => {
    const [reason, setReason] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handleSubmit = async () => {
        if (!reason.trim()) {
            setError('Please provide a reason for voiding this payment.');
            return;
        }

        setIsSubmitting(true);
        setError(null);

        try {
            const response = await fetch(`/api/payments/${paymentId}/void`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ reason }),
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.message || 'Failed to void payment');
            }

            onSuccess();
            onClose();
            setReason(''); // Reset reason on success
        } catch (err) {
            setError(err instanceof Error ? err.message : 'An error occurred');
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2 text-red-600">
                        <AlertTriangle className="h-5 w-5" />
                        Void Payment
                    </DialogTitle>
                    <DialogDescription>
                        Are you sure you want to void this payment? This action cannot be undone and will reverse any associated allocations.
                    </DialogDescription>
                </DialogHeader>

                <div className="grid gap-4 py-4">
                    <div className="space-y-2">
                        <label htmlFor="reason" className="text-sm font-medium text-gray-700">
                            Reason for Voiding <span className="text-red-500">*</span>
                        </label>
                        <Textarea
                            id="reason"
                            placeholder="e.g. Duplicate entry, Wrong amount, Bounce check..."
                            value={reason}
                            onChange={(e) => setReason(e.target.value)}
                            className="resize-none"
                            rows={3}
                        />
                        {error && <p className="text-sm text-red-600">{error}</p>}
                    </div>
                </div>

                <DialogFooter>
                    <Button variant="outline" onClick={onClose} disabled={isSubmitting}>
                        Cancel
                    </Button>
                    <Button
                        variant="destructive"
                        onClick={handleSubmit}
                        disabled={isSubmitting}
                    >
                        {isSubmitting ? (
                            <>
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                Voiding...
                            </>
                        ) : (
                            'Confirm Void'
                        )}
                    </Button>
                </DialogFooter>
                <DialogClose />
            </DialogContent>
        </Dialog>
    );
};
