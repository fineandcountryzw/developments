import React, { useState } from 'react';
import { EmailTemplate } from '../types';
import { EmailTemplateEditor } from './EmailTemplateEditor';
import { sendEmail } from '../lib/email-service';

// Example initial template (replace with real fetch logic)
const initialTemplate: EmailTemplate = {
  id: 'investment-opportunity',
  name: 'Investment Opportunity',
  subject: 'Exciting Opportunity: {{ client_name }}',
  bodyHtml: `<div style="font-family: 'Plus Jakarta Sans', Arial, sans-serif; color: #0F172A;">
    <h2 style="color: #85754E;">Investment Opportunity</h2>
    <p>Dear {{ client_name }},</p>
    <p>We are pleased to present a new opportunity in {{ development_name }}.</p>
    <p>Contact us for more details.</p>
    <hr style="border: 0; border-top: 1px solid #EFECE7; margin: 30px 0;" />
    <p style="font-size: 11px; color: #94A3B8;">Fine & Country Zimbabwe</p>
  </div>`,
  category: 'Marketing',
  lastUpdated: new Date().toISOString(),
  version: 1
};

export const AdminEmailModule: React.FC = () => {
  const [template, setTemplate] = useState<EmailTemplate>(initialTemplate);
  const [status, setStatus] = useState<string | null>(null);

  const handleSave = (updated: EmailTemplate) => {
    setTemplate(updated);
    setStatus('Template saved!');
    // TODO: Save to /supabase/functions/email-templates and backend
  };

  const handleSendTest = async (tmpl: EmailTemplate) => {
    setStatus('Sending test email...');
    try {
      await sendEmail({
        to: 'admin@fineandcountry.co.zw',
        subject: `[TEST] ${tmpl.subject}`,
        html: tmpl.bodyHtml
      });
      setStatus('Test email sent!');
    } catch (error: any) {
      setStatus(error?.message || 'Failed to send test email.');
    }
  };

  return (
    <div className="p-8">
      <EmailTemplateEditor
        template={template}
        onSave={handleSave}
        onSendTest={handleSendTest}
      />
      {status && <div className="mt-4 text-sm text-fcGold font-bold">{status}</div>}
    </div>
  );
};
