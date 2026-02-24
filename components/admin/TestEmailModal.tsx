'use client';

import React, { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Loader2, CheckCircle, AlertCircle, FileText } from 'lucide-react';

// Email Templates
const EMAIL_TEMPLATES = {
  payment_reminder: {
    name: '💳 Payment Reminder',
    subject: 'Payment Reminder - Invoice #INV-2026-001',
    content: `<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
  <div style="background: #0A1629; padding: 20px; text-align: center;">
    <h1 style="color: #85754E; margin: 0;">FINE & COUNTRY</h1>
    <p style="color: #fff; margin: 5px 0 0; font-size: 12px;">RESIDENTIAL & COMMERCIAL REAL ESTATE ZIMBABWE</p>
  </div>
  <div style="padding: 30px; background: #fff;">
    <h2 style="color: #333;">Payment Reminder</h2>
    <p>Dear Valued Client,</p>
    <p>This is a friendly reminder that your payment is due.</p>
    <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
      <tr style="background: #f5f5f5;">
        <td style="padding: 10px; border: 1px solid #ddd;"><strong>Invoice Reference</strong></td>
        <td style="padding: 10px; border: 1px solid #ddd;">INV-2026-001</td>
      </tr>
      <tr>
        <td style="padding: 10px; border: 1px solid #ddd;"><strong>Amount Due</strong></td>
        <td style="padding: 10px; border: 1px solid #ddd;">$5,000.00 USD</td>
      </tr>
      <tr style="background: #f5f5f5;">
        <td style="padding: 10px; border: 1px solid #ddd;"><strong>Due Date</strong></td>
        <td style="padding: 10px; border: 1px solid #ddd;">January 25, 2026</td>
      </tr>
    </table>
    <p>Please make payment at your earliest convenience to avoid late fees.</p>
    <p style="margin-top: 30px;">Best regards,<br><strong>Fine & Country Zimbabwe</strong><br>Accounts Department</p>
  </div>
  <div style="background: #f5f5f5; padding: 15px; text-align: center; font-size: 12px; color: #666;">
    <p>15 Nigels Lane, Ballantyne Park Borrowdale Harare | 08644 253731</p>
  </div>
</div>`
  },
  payment_confirmation: {
    name: '✅ Payment Confirmation',
    subject: 'Payment Received - Thank You!',
    content: `<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
  <div style="background: #0A1629; padding: 20px; text-align: center;">
    <h1 style="color: #85754E; margin: 0;">FINE & COUNTRY</h1>
    <p style="color: #fff; margin: 5px 0 0; font-size: 12px;">RESIDENTIAL & COMMERCIAL REAL ESTATE ZIMBABWE</p>
  </div>
  <div style="padding: 30px; background: #fff;">
    <div style="text-align: center; margin-bottom: 20px;">
      <span style="font-size: 48px;">✅</span>
    </div>
    <h2 style="color: #10b981; text-align: center;">Payment Received!</h2>
    <p>Dear Valued Client,</p>
    <p>Thank you for your payment. We have successfully received your funds.</p>
    <div style="background: #d1fae5; padding: 20px; border-radius: 8px; margin: 20px 0;">
      <p style="margin: 0;"><strong>Receipt Number:</strong> FC-HRE-2026-00001</p>
      <p style="margin: 10px 0 0;"><strong>Amount Received:</strong> $5,000.00 USD</p>
      <p style="margin: 10px 0 0;"><strong>Payment Method:</strong> Bank Transfer</p>
      <p style="margin: 10px 0 0;"><strong>Date:</strong> January 20, 2026</p>
    </div>
    <p>Your official receipt is attached to this email.</p>
    <p style="margin-top: 30px;">Best regards,<br><strong>Fine & Country Zimbabwe</strong></p>
  </div>
</div>`
  },
  overdue_notice: {
    name: '⚠️ Overdue Notice',
    subject: 'URGENT: Overdue Payment Notice - Action Required',
    content: `<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
  <div style="background: #dc2626; padding: 20px; text-align: center;">
    <h1 style="color: #fff; margin: 0;">⚠️ OVERDUE NOTICE</h1>
  </div>
  <div style="background: #0A1629; padding: 10px; text-align: center;">
    <h2 style="color: #85754E; margin: 0; font-size: 16px;">FINE & COUNTRY ZIMBABWE</h2>
  </div>
  <div style="padding: 30px; background: #fff;">
    <p>Dear Client,</p>
    <p style="color: #dc2626;"><strong>Your payment is now overdue.</strong></p>
    <div style="background: #fef2f2; border-left: 4px solid #dc2626; padding: 15px; margin: 20px 0;">
      <p style="margin: 0;"><strong>Outstanding Amount:</strong> $5,000.00 USD</p>
      <p style="margin: 10px 0 0;"><strong>Days Overdue:</strong> 15 days</p>
      <p style="margin: 10px 0 0;"><strong>Original Due Date:</strong> January 5, 2026</p>
    </div>
    <p>Please make payment immediately to avoid further action. If you have already made payment, please disregard this notice and contact us with proof of payment.</p>
    <p><strong>Payment Options:</strong></p>
    <ul>
      <li>Bank Transfer to our account</li>
      <li>EcoCash: 0772 XXX XXX</li>
      <li>Visit our office in person</li>
    </ul>
    <p style="margin-top: 30px;">Accounts Department<br><strong>Fine & Country Zimbabwe</strong></p>
  </div>
</div>`
  },
  welcome: {
    name: '🎉 Welcome / Onboarding',
    subject: 'Welcome to Fine & Country Zimbabwe!',
    content: `<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
  <div style="background: linear-gradient(135deg, #0A1629 0%, #1a2838 100%); padding: 40px 20px; text-align: center;">
    <h1 style="color: #85754E; margin: 0; font-size: 28px;">FINE & COUNTRY</h1>
    <p style="color: #fff; margin: 10px 0 0;">Welcome to our family!</p>
  </div>
  <div style="padding: 30px; background: #fff;">
    <h2>Dear Valued Client,</h2>
    <p>Thank you for choosing Fine & Country Zimbabwe for your property investment.</p>
    <p>We are delighted to confirm your reservation:</p>
    <div style="background: #f9fafb; padding: 20px; border-radius: 8px; margin: 20px 0;">
      <p><strong>🏠 Property:</strong> Stand #123, Sunrise View Estate</p>
      <p><strong>📐 Size:</strong> 1,000 m²</p>
      <p><strong>💰 Price:</strong> $25,000 USD</p>
    </div>
    <p><strong>Next Steps:</strong></p>
    <ol>
      <li>Review and sign your contract (sent separately)</li>
      <li>Make your deposit payment</li>
      <li>Set up your payment plan</li>
    </ol>
    <p>Your dedicated agent will be in touch shortly.</p>
    <p style="margin-top: 30px;">Welcome aboard!<br><strong>The Fine & Country Team</strong></p>
  </div>
</div>`
  },
  simple_test: {
    name: '🧪 Simple Test',
    subject: '[TEST] Email System Verification',
    content: `<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
  <h2 style="color: #0A1629;">Email System Test</h2>
  <p>This is a test email from <strong>Fine & Country Zimbabwe ERP</strong>.</p>
  <p>If you received this email, your email configuration is working correctly! ✅</p>
  <hr style="border: none; border-top: 1px solid #ddd; margin: 20px 0;">
  <p style="color: #666; font-size: 12px;">Sent at: ${new Date().toLocaleString()}</p>
</div>`
  }
};

interface TestEmailModalProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

export default function TestEmailModal({ isOpen, onOpenChange, onSuccess }: TestEmailModalProps) {
  const [email, setEmail] = useState('');
  const [subject, setSubject] = useState(EMAIL_TEMPLATES.simple_test.subject);
  const [content, setContent] = useState(EMAIL_TEMPLATES.simple_test.content);
  const [selectedTemplate, setSelectedTemplate] = useState<string>('simple_test');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{
    type: 'success' | 'error';
    message: string;
  } | null>(null);

  const handleTemplateChange = (templateKey: string) => {
    const template = EMAIL_TEMPLATES[templateKey as keyof typeof EMAIL_TEMPLATES];
    if (template) {
      setSelectedTemplate(templateKey);
      setSubject(template.subject);
      setContent(template.content);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setResult(null);

    if (!email.trim()) {
      setResult({ type: 'error', message: 'Please enter a valid email address' });
      return;
    }

    if (!subject.trim()) {
      setResult({ type: 'error', message: 'Please enter a subject line' });
      return;
    }

    try {
      setLoading(true);

      const response = await fetch('/api/admin/payment-automation/test-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: email.trim(),
          subject: subject.trim(),
          content: content.trim(),
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || data.details || 'Failed to send test email');
      }

      setResult({
        type: 'success',
        message: `Email sent successfully! Message ID: ${data.data?.messageId || 'N/A'}`,
      });

      // Reset form and close after delay
      setTimeout(() => {
        setEmail('');
        handleTemplateChange('simple_test');
        setResult(null);
        onOpenChange(false);
        onSuccess?.();
      }, 2000);
    } catch (error) {
      setResult({
        type: 'error',
        message: error instanceof Error ? error.message : 'Failed to send test email',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleReset = () => {
    setEmail('');
    handleTemplateChange('simple_test');
    setResult(null);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Send Test Email</DialogTitle>
          <DialogDescription>
            Test your SMTP configuration by sending a test email to verify everything is working
          </DialogDescription>
        </DialogHeader>

        {result && (
          <div
            className={`p-4 rounded-lg flex items-start gap-3 ${
              result.type === 'success'
                ? 'bg-green-50 text-green-900 border border-green-200'
                : 'bg-red-50 text-red-900 border border-red-200'
            }`}
          >
            {result.type === 'success' ? (
              <CheckCircle className="w-5 h-5 mt-0.5 flex-shrink-0" />
            ) : (
              <AlertCircle className="w-5 h-5 mt-0.5 flex-shrink-0" />
            )}
            <div>
              <p className="font-medium">{result.type === 'success' ? 'Success' : 'Error'}</p>
              <p className="text-sm">{result.message}</p>
            </div>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Template Selector */}
          <div>
            <Label htmlFor="template-select">Email Template</Label>
            <div className="flex flex-wrap gap-2 mt-2">
              {Object.entries(EMAIL_TEMPLATES).map(([key, template]) => (
                <Button
                  key={key}
                  type="button"
                  variant={selectedTemplate === key ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => handleTemplateChange(key)}
                  className={selectedTemplate === key ? 'bg-fcGold hover:bg-fcGold/90' : ''}
                >
                  <FileText className="w-3 h-3 mr-1" />
                  {template.name}
                </Button>
              ))}
            </div>
          </div>

          {/* Email Field */}
          <div>
            <Label htmlFor="test-email">Recipient Email Address</Label>
            <Input
              id="test-email"
              type="email"
              placeholder="admin@finecountry.co.zw"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="mt-1"
              required
            />
            <p className="text-xs text-gray-500 mt-1">
              Email address where the test message will be sent
            </p>
          </div>

          {/* Subject Field */}
          <div>
            <Label htmlFor="test-subject">Subject</Label>
            <Input
              id="test-subject"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              className="mt-1"
              required
            />
          </div>

          {/* Content Field */}
          <div>
            <Label htmlFor="test-content">Email Content (HTML)</Label>
            <Textarea
              id="test-content"
              value={content}
              onChange={(e) => setContent(e.target.value)}
              className="mt-1 font-mono text-sm"
              rows={10}
              required
            />
            <p className="text-xs text-gray-500 mt-1">You can edit the HTML content if needed</p>
          </div>

          {/* Buttons */}
          <div className="flex justify-end gap-3 pt-4 border-t border-gray-200">
            <Button
              type="button"
              variant="outline"
              onClick={handleReset}
              disabled={loading}
            >
              Reset
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={loading}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={loading}
              className="bg-fcGold text-white hover:bg-fcGold/90"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Sending...
                </>
              ) : (
                'Send Test Email'
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
