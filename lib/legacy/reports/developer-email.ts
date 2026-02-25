/**
 * Developer Report Email Service
 * 
 * Composes and sends developer reports via email using Resend.
 */

import { Resend } from 'resend';
import { DeveloperReportData, formatCurrency, formatDate, PeriodType } from './developer-report-data';
import { generateDeveloperExcel } from './developer-excel';

// Initialize Resend with API key
const resend = new Resend(process.env.RESEND_API_KEY);

export interface EmailReportOptions {
  to: string;
  cc?: string[];
  developerName: string;
  data: DeveloperReportData;
  periodType: PeriodType;
  customMessage?: string;
  includePDF?: boolean;
  includeExcel?: boolean;
  pdfBuffer?: ArrayBuffer;
  excelBuffer?: ArrayBuffer;
}

export interface EmailReportResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

/**
 * Generate default email subject
 */
export function generateEmailSubject(developerName: string, periodType: string): string {
  const periodText = periodType === 'ALL_TIME' 
    ? 'All Time' 
    : periodType === 'THIS_MONTH' 
    ? 'This Month' 
    : 'Custom Period';
  return `Portfolio Report — ${developerName} — ${periodText}`;
}

/**
 * Generate default email body
 */
export function generateEmailBody(data: DeveloperReportData, customMessage?: string): string {
  const { summary, developerName, reportPeriod } = data;
  
  const periodText = reportPeriod.type === 'ALL_TIME' 
    ? 'All Time' 
    : reportPeriod.type === 'THIS_MONTH' 
    ? 'This Month' 
    : `${formatDate(reportPeriod.from)} - ${formatDate(reportPeriod.to)}`;

  let body = `Dear ${developerName},\n\n`;
  
  body += `Please find attached your portfolio performance report for the period ${periodText}.\n\n`;
  
  body += `Summary:\n`;
  body += `- Stands sold: ${summary.soldStands} of ${summary.totalStands} total\n`;
  body += `- Total collected: ${formatCurrency(summary.totalCollected)}\n`;
  body += `- Outstanding balance: ${formatCurrency(summary.totalOutstanding)}\n`;
  body += `- Collection rate: ${summary.collectionRate.toFixed(1)}%\n\n`;
  
  // Add alerts if needed
  if (summary.overdueAccounts > 0) {
    body += `⚠️ Action Required: ${summary.overdueAccounts} client accounts are currently overdue.\n`;
    body += `Please review the attached report for details.\n\n`;
  }
  
  if (summary.clientsWithoutAgreements > 0) {
    body += `⚠️ Action Required: ${summary.clientsWithoutAgreements} clients do not have signed agreements on file.\n\n`;
  }
  
  // Add custom message if provided
  if (customMessage) {
    body += `${customMessage}\n\n`;
  }
  
  body += `For queries please contact us at:\n`;
  body += `zimbabwe@fineandcountry.com | 08644 253731\n\n`;
  
  body += `Regards,\n`;
  body += `Natasha Mugabe\n`;
  body += `Principal Real Estate Agent\n`;
  body += `Fine & Country Zimbabwe\n`;
  
  return body;
}

/**
 * Generate HTML email body
 */
export function generateEmailHTML(data: DeveloperReportData, customMessage?: string): string {
  const { summary, developerName, reportPeriod } = data;
  
  const periodText = reportPeriod.type === 'ALL_TIME' 
    ? 'All Time' 
    : reportPeriod.type === 'THIS_MONTH' 
    ? 'This Month' 
    : `${formatDate(reportPeriod.from)} - ${formatDate(reportPeriod.to)}`;

  let html = `
<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
    .header { background: #C5A028; color: white; padding: 20px; text-align: center; }
    .header h1 { margin: 0; font-size: 24px; }
    .header p { margin: 5px 0 0; font-size: 14px; }
    .content { padding: 20px; }
    .summary { background: #f9fafb; padding: 15px; border-radius: 5px; margin: 20px 0; }
    .summary h3 { margin-top: 0; color: #C5A028; }
    .summary ul { list-style: none; padding: 0; }
    .summary li { padding: 5px 0; }
    .alert { background: #fee2e2; border-left: 4px solid #dc2626; padding: 15px; margin: 15px 0; }
    .alert-warning { background: #fef3c7; border-left-color: #f59e0b; }
    .footer { background: #f3f4f6; padding: 20px; text-align: center; font-size: 12px; color: #666; }
    .signature { margin-top: 30px; }
  </style>
</head>
<body>
  <div class="header">
    <h1>Fine & Country Zimbabwe</h1>
    <p>Developer Portfolio Report</p>
  </div>
  
  <div class="content">
    <p>Dear ${developerName},</p>
    
    <p>Please find attached your portfolio performance report for the period <strong>${periodText}</strong>.</p>
    
    <div class="summary">
      <h3>Summary</h3>
      <ul>
        <li><strong>Stands sold:</strong> ${summary.soldStands} of ${summary.totalStands} total</li>
        <li><strong>Total collected:</strong> ${formatCurrency(summary.totalCollected)}</li>
        <li><strong>Outstanding balance:</strong> ${formatCurrency(summary.totalOutstanding)}</li>
        <li><strong>Collection rate:</strong> ${summary.collectionRate.toFixed(1)}%</li>
      </ul>
    </div>
`;

  if (summary.overdueAccounts > 0) {
    html += `
    <div class="alert">
      <strong>⚠️ Action Required:</strong> ${summary.overdueAccounts} client accounts are currently overdue.
      Please review the attached report for details.
    </div>
`;
  }
  
  if (summary.clientsWithoutAgreements > 0) {
    html += `
    <div class="alert alert-warning">
      <strong>⚠️ Action Required:</strong> ${summary.clientsWithoutAgreements} clients do not have signed agreements on file.
    </div>
`;
  }
  
  if (customMessage) {
    html += `
    <p>${customMessage.replace(/\n/g, '<br>')}</p>
`;
  }
  
  html += `
    <p>For queries please contact us at:<br>
    <a href="mailto:zimbabwe@fineandcountry.com">zimbabwe@fineandcountry.com</a> | 08644 253731</p>
    
    <div class="signature">
      <p>Regards,<br>
      <strong>Natasha Mugabe</strong><br>
      Principal Real Estate Agent<br>
      Fine & Country Zimbabwe</p>
    </div>
  </div>
  
  <div class="footer">
    <p>15 Nigels Lane, Borrowdale, Harare | 08644 253731</p>
    <p>CONFIDENTIAL — For developer use only</p>
  </div>
</body>
</html>`;

  return html;
}

/**
 * Send developer report via email
 */
export async function sendDeveloperReportEmail(
  options: EmailReportOptions
): Promise<EmailReportResult> {
  try {
    const {
      to,
      cc = [],
      developerName,
      data,
      periodType,
      customMessage,
      includePDF = true,
      includeExcel = true,
      pdfBuffer,
      excelBuffer,
    } = options;

    // Always include Natasha's email in CC
    const allCc = ['natasha.mugabe@fineandcountry.com', ...cc];

    // Generate attachments
    const attachments = [];
    
    if (includePDF && pdfBuffer) {
      attachments.push({
        filename: `FC_${developerName.replace(/[^a-zA-Z0-9]/g, '_')}_Report_${periodType}_${new Date().toISOString().split('T')[0]}.pdf`,
        content: Buffer.from(pdfBuffer).toString('base64'),
      });
    }
    
    if (includeExcel && excelBuffer) {
      attachments.push({
        filename: `FC_${developerName.replace(/[^a-zA-Z0-9]/g, '_')}_Report_${periodType}_${new Date().toISOString().split('T')[0]}.xlsx`,
        content: Buffer.from(excelBuffer).toString('base64'),
      });
    }

    // Send email
    const result = await resend.emails.send({
      from: 'Fine & Country Zimbabwe <reports@fineandcountry.co.zw>',
      to,
      cc: allCc,
      subject: generateEmailSubject(developerName, periodType),
      text: generateEmailBody(data, customMessage),
      html: generateEmailHTML(data, customMessage),
      attachments,
    });

    return {
      success: true,
      messageId: result.data?.id,
    };
  } catch (error: any) {
    console.error('Error sending developer report email:', error);
    return {
      success: false,
      error: error.message || 'Failed to send email',
    };
  }
}

/**
 * Validate email address
 */
export function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

/**
 * Get developer email from data or return null
 */
export function getDeveloperEmail(data: DeveloperReportData): string | null {
  return data.developerEmail || null;
}
