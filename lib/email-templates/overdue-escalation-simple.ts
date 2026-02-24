/**
 * Overdue Escalation Email Template (Simplified)
 * Sends escalation notifications for overdue invoices
 */

export interface OverdueEscalationData {
  client: { name: string; email?: string; id?: string };
  invoices: Array<{ invoiceNumber: string; totalAmount?: number; dueDate: string }>;
  totalOverdue: number;
  daysOverdue: number;
}

export function generateOverdueEscalationHTML(data: OverdueEscalationData): string {
  const clientName = data.client.name;
  const invoiceList = data.invoices
    .map((inv) => `<li>${inv.invoiceNumber} - $${(inv.totalAmount || 0).toFixed(2)}</li>`)
    .join('');

  return `
    <!DOCTYPE html>
    <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: #dc2626; color: white; padding: 20px; border-radius: 5px; }
          .content { background: #f9fafb; padding: 20px; border: 1px solid #e5e7eb; }
          .amount { font-size: 24px; font-weight: bold; color: #dc2626; }
          .alert { background: #fee2e2; border-left: 4px solid #dc2626; padding: 10px; }
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
            <p>Outstanding Invoices:</p>
            <ul>${invoiceList}</ul>
            <p class="amount">Total: $${data.totalOverdue.toFixed(2)}</p>
            <p>Please arrange immediate payment.</p>
          </div>
        </div>
      </body>
    </html>
  `;
}

export function generateOverdueEscalationText(data: OverdueEscalationData): string {
  const clientName = data.client.name;
  const invoiceList = data.invoices
    .map((inv) => `- ${inv.invoiceNumber}: $${(inv.totalAmount || 0).toFixed(2)}`)
    .join('\n');

  return `
Invoice Payment Overdue

Dear ${clientName},

You have ${data.invoices.length} overdue invoice${data.invoices.length > 1 ? 's' : ''} - ${data.daysOverdue} days overdue.

${invoiceList}

Total Outstanding: $${data.totalOverdue.toFixed(2)}

Please arrange immediate payment to avoid further action.
  `.trim();
}
