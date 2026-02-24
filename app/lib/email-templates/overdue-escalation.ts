export interface OverdueEscalationData {
  client: any;
  invoices: (any & { stand?: { id: string; standNumber: string; price: number } })[]
  totalOverdue: number;
  daysOverdue: number;
  lastReminderDate?: Date;
}

export function generateOverdueEscalationHTML(data: OverdueEscalationData): string {
  const { client, invoices, totalOverdue, daysOverdue, lastReminderDate } = data;
  const formattedAmount = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(totalOverdue);

  const invoiceRows = invoices
    .map(
      (inv) => `
    <tr style="border-bottom: 1px solid #e0e0e0;">
      <td style="padding: 10px; text-align: left;">#${inv.invoiceNumber}</td>
      <td style="padding: 10px; text-align: center;">${new Date(inv.invoiceDate).toLocaleDateString()}</td>
      <td style="padding: 10px; text-align: right;">${new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD',
      }).format(Number(inv.totalAmount))}</td>
      <td style="padding: 10px; text-align: center;">
        <span style="background-color: #f8d7da; color: #721c24; padding: 4px 8px; border-radius: 4px; font-size: 12px; font-weight: 600;">
          OVERDUE
        </span>
      </td>
    </tr>
  `
    )
    .join('');

  return `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Overdue Payment Notice - Fine & Country Zimbabwe</title>
      </head>
      <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333;">
        <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border: 1px solid #e0e0e0; border-radius: 8px; overflow: hidden;">
          
          <!-- Header -->
          <div style="background: linear-gradient(135deg, #c41e3a 0%, #8b0000 100%); color: white; padding: 30px; text-align: center;">
            <h1 style="margin: 0; font-size: 24px; font-weight: 600;">⚠️ Overdue Payment Notice</h1>
            <p style="margin: 10px 0 0 0; opacity: 0.9;">Immediate Action Required</p>
          </div>

          <!-- Content -->
          <div style="padding: 30px;">
            
            <!-- Greeting -->
            <p style="font-size: 16px; margin-bottom: 20px;">
              Dear <strong>${client.firstName} ${client.lastName}</strong>,
            </p>

            <!-- Critical Alert -->
            <div style="background-color: #f8d7da; border-left: 4px solid #c41e3a; padding: 15px; margin-bottom: 25px; border-radius: 4px;">
              <p style="margin: 0; color: #721c24; font-weight: 600; font-size: 16px;">
                🚨 Critical: Your account has ${daysOverdue} days overdue payments
              </p>
              <p style="margin: 8px 0 0 0; color: #721c24;">
                Total Outstanding: <strong style="font-size: 18px;">${formattedAmount}</strong>
              </p>
            </div>

            <!-- Overdue Details -->
            <p style="font-weight: 600; margin-bottom: 10px; color: #c41e3a;">OVERDUE INVOICES</p>
            <table style="width: 100%; border-collapse: collapse; margin-bottom: 25px;">
              <thead>
                <tr style="background-color: #f8f9fa; border-bottom: 2px solid #c41e3a;">
                  <th style="padding: 10px; text-align: left; font-weight: 600;">Invoice #</th>
                  <th style="padding: 10px; text-align: center; font-weight: 600;">Date</th>
                  <th style="padding: 10px; text-align: right; font-weight: 600;">Amount</th>
                  <th style="padding: 10px; text-align: center; font-weight: 600;">Status</th>
                </tr>
              </thead>
              <tbody>
                ${invoiceRows}
              </tbody>
            </table>

            <!-- Last Reminder Info -->
            ${
              lastReminderDate
                ? `
              <div style="background-color: #ffeaa7; padding: 10px; border-radius: 4px; margin-bottom: 25px; font-size: 14px;">
                <strong>Note:</strong> Previous reminder sent on ${lastReminderDate.toLocaleDateString()}
              </div>
            `
                : ''
            }

            <!-- Consequences -->
            <div style="background-color: #f0f4f8; padding: 20px; border-radius: 6px; margin-bottom: 25px;">
              <p style="margin: 0 0 10px 0; color: #666; font-weight: 600;">
                Please act immediately. Further action may include:
              </p>
              <ul style="margin: 10px 0; padding-left: 20px; color: #666;">
                <li>Legal action to recover outstanding amount</li>
                <li>Suspension of services and access to portal</li>
                <li>Impact on credit rating with Fine & Country Zimbabwe</li>
                <li>Additional penalties and interest charges</li>
              </ul>
            </div>

            <!-- Urgent Action -->
            <div style="border-top: 2px solid #c41e3a; padding-top: 15px; margin-bottom: 25px;">
              <p style="margin: 0 0 15px 0; color: #c41e3a; font-weight: 600; font-size: 16px;">
                ⏰ REQUIRED RESPONSE: Within 5 business days
              </p>
              <a href="https://erp.finecountry.co.zw/dashboard" style="display: inline-block; background-color: #c41e3a; color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px; font-weight: 600;">
                Process Payment Now
              </a>
            </div>

            <!-- Contact Info -->
            <p style="font-size: 14px; color: #666; margin-bottom: 10px; padding-top: 15px; border-top: 1px solid #e0e0e0;">
              For immediate assistance or to discuss payment arrangements, <strong>contact our finance team immediately</strong>:<br/>
              <strong>Email:</strong> accounts@finecountry.co.zw<br/>
              <strong>Phone:</strong> +263 4 668 8500
            </p>

            <!-- Legal Notice -->
            <div style="background-color: #f8f9fa; padding: 15px; margin-top: 25px; border-left: 3px solid #6c757d; border-radius: 4px; font-size: 12px; color: #666;">
              <strong>Legal Notice:</strong> This is an official notice of overdue payment. If payment is not received within 5 business days, we reserve the right to pursue all legal remedies available under the law, including but not limited to legal proceedings to recover the outstanding amount plus costs and interest.
            </div>
          </div>

          <!-- Footer -->
          <div style="background-color: #f8f9fa; padding: 20px; text-align: center; font-size: 12px; color: #666; border-top: 1px solid #e0e0e0;">
            <p style="margin: 0;">Fine & Country Zimbabwe ERP<br/>
            Harare • Bulawayo • Mutare<br/>
            <a href="https://erp.finecountry.co.zw" style="color: #85754e; text-decoration: none;">Visit Portal</a></p>
          </div>
        </div>
      </body>
    </html>
  `;
}

export function generateOverdueEscalationText(data: OverdueEscalationData): string {
  const { client, invoices, totalOverdue, daysOverdue } = data;
  const formattedAmount = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(totalOverdue);

  return `
⚠️ CRITICAL: OVERDUE PAYMENT NOTICE

Dear ${client.firstName} ${client.lastName},

Your account has ${daysOverdue} days OVERDUE payments totaling ${formattedAmount}.

IMMEDIATE ACTION REQUIRED within 5 business days.

OVERDUE INVOICES:
${invoices
  .map(
    (inv) =>
      `[OVERDUE] Invoice #${inv.invoiceNumber} - ${new Date(inv.invoiceDate).toLocaleDateString()} - ${new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD',
      }).format(Number(inv.totalAmount))}`
  )
  .join('\n')}

CONSEQUENCES OF NON-PAYMENT:
- Legal action to recover outstanding amount
- Suspension of services and portal access
- Impact on credit rating
- Additional penalties and interest charges

CONTACT IMMEDIATELY:
Email: accounts@finecountry.co.zw
Phone: +263 4 668 8500

This is an official notice of overdue payment. If payment is not received within 5 business days, we reserve the right to pursue all legal remedies available under the law.

Fine & Country Zimbabwe Team
  `.trim();
}
