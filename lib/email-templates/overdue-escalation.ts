/**
 * Overdue Escalation Email Template
 * Sends escalation notifications for overdue invoices
 */

interface OverdueEscalationData {
  client: { name: string; email?: string; id?: string };
  invoices: Array<{ invoiceNumber: string; totalAmount?: number; dueDate: string; reminderSentAt?: string }>;
  totalOverdue: number;
  daysOverdue: number;
  lastReminderDate?: string;
  dashboardUrl?: string;
}

const overdueEscalationTemplate = (data: OverdueEscalationData) => {
  const clientName = data.client.name;
  const firstInvoice = data.invoices[0];
  return {
    subject: `Urgent: ${data.invoices.length} Invoice${data.invoices.length > 1 ? 's' : ''} Overdue - ${data.daysOverdue} Days`,
    html: `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="UTF-8">
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: #dc2626; color: white; padding: 20px; border-radius: 5px 5px 0 0; }
            .content { background: #f9fafb; padding: 20px; border: 1px solid #e5e7eb; }
            .footer { background: #374151; color: white; padding: 20px; border-radius: 0 0 5px 5px; text-align: center; }
            .amount { font-size: 24px; font-weight: bold; color: #dc2626; margin: 10px 0; }
            .button { 
              display: inline-block; 
              background: #2563eb; 
              color: white; 
              padding: 10px 20px; 
              text-decoration: none; 
              border-radius: 5px; 
              margin: 20px 0;
            }
            .alert { background: #fee2e2; border-left: 4px solid #dc2626; padding: 10px; margin: 10px 0; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>⚠️ Invoice Payment Overdue</h1>
            </div>
            <div class="content">
              <p>Dear ${clientName},</p>
              
              <div class="alert">
                <strong>You have ${data.invoices.length} overdue invoice${data.invoices.length > 1 ? 's' : ''} - ${data.daysOverdue} days overdue</strong>
              </div>
              
              <p>We have not yet received payment for the following invoice${data.invoices.length > 1 ? 's' : ''}:</p>
              
              <table style="width: 100%; margin: 20px 0;">
                ${data.invoices.map(inv => `
                <tr>
                  <td><strong>Invoice Number:</strong> ${inv.invoiceNumber}</td>
                  <td><strong>Due Date:</strong> ${new Date(inv.dueDate).toLocaleDateString()}</td>
                  <td><strong>Amount:</strong> ${inv.totalAmount ? '$' + inv.totalAmount.toLocaleString('en-US', { minimumFractionDigits: 2 }) : 'N/A'}</td>
                </tr>
                `).join('')}
                <tr style="font-weight: bold; border-top: 2px solid #e5e7eb;">
                  <td colspan="3">Total Outstanding: <span class="amount">$${data.totalOverdue.toLocaleString('en-US', { minimumFractionDigits: 2 })}</span></td>
                </tr>
              </table>
              
              <p>Please arrange immediate payment to avoid further action. If payment has already been made, please disregard this notice.</p>
              
              <a href="${data.dashboardUrl || 'https://your-dashboard.com'}" class="button">View Invoice Details</a>
              
              <p>If you have any questions or need to discuss payment arrangements, please contact our accounts team.</p>
            </div>
            <div class="footer">
              <p>&copy; 2025 Fine & Country Zimbabwe. All rights reserved.</p>
            </div>
          </div>
        </body>
      </html>
    `,
    text: `
Invoice Payment Overdue

Dear ${clientName},

You have ${data.invoices.length} overdue invoice${data.invoices.length > 1 ? 's' : ''} - ${data.daysOverdue} days overdue.

${data.invoices.map(inv => `Invoice Number: ${inv.invoiceNumber}\nDue Date: ${new Date(inv.dueDate).toLocaleDateString()}\nAmount: ${inv.totalAmount ? '$' + inv.totalAmount.toLocaleString('en-US', { minimumFractionDigits: 2 }) : 'N/A'}\n`).join('\n')}

Total Outstanding Amount: $${data.totalOverdue.toLocaleString('en-US', { minimumFractionDigits: 2 })}

Please arrange immediate payment to avoid further action.

If you have any questions, please contact our accounts team.

© 2025 Fine & Country Zimbabwe
    `.trim(),
  };
};

export function generateOverdueEscalationHTML(data: OverdueEscalationData): string {
  return overdueEscalationTemplate(data).html;
}

export function generateOverdueEscalationText(data: OverdueEscalationData): string {
  return overdueEscalationTemplate(data).text;
}
