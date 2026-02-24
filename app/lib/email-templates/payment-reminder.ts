export interface PaymentReminderData {
  client: any;
  invoices: (any & { stand?: { id: string; area_sqm: number; price: number } })[]
  totalOutstanding: number;
  daysOverdue: number;
  paymentMethods: {
    method: string;
    account: string;
    reference?: string;
  }[];
}

export function generatePaymentReminderHTML(data: PaymentReminderData): string {
  const { client, invoices, totalOutstanding, daysOverdue, paymentMethods } = data;
  const formattedAmount = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(totalOutstanding);

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
        <span style="background-color: #fff3cd; color: #856404; padding: 4px 8px; border-radius: 4px; font-size: 12px;">
          ${inv.status}
        </span>
      </td>
    </tr>
  `
    )
    .join('');

  const paymentMethodsHTML = paymentMethods
    .map(
      (method) => `
    <div style="margin: 8px 0; padding: 8px; background-color: #f8f9fa; border-left: 3px solid #85754e;">
      <strong>${method.method}</strong><br/>
      ${method.account}
      ${method.reference ? `<br/><small>Reference: ${method.reference}</small>` : ''}
    </div>
  `
    )
    .join('');

  return `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Payment Reminder - Fine & Country Zimbabwe</title>
      </head>
      <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333;">
        <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border: 1px solid #e0e0e0; border-radius: 8px; overflow: hidden;">
          
          <!-- Header -->
          <div style="background: linear-gradient(135deg, #85754e 0%, #6d5c3f 100%); color: white; padding: 30px; text-align: center;">
            <h1 style="margin: 0; font-size: 24px; font-weight: 600;">Payment Reminder</h1>
            <p style="margin: 10px 0 0 0; opacity: 0.9;">Outstanding Balance Due</p>
          </div>

          <!-- Content -->
          <div style="padding: 30px;">
            
            <!-- Greeting -->
            <p style="font-size: 16px; margin-bottom: 20px;">
              Dear <strong>${client.firstName} ${client.lastName}</strong>,
            </p>

            <!-- Alert Box -->
            <div style="background-color: #fff3cd; border-left: 4px solid #ffc107; padding: 15px; margin-bottom: 25px; border-radius: 4px;">
              <p style="margin: 0; color: #856404; font-weight: 500;">
                ⚠️ You have an outstanding balance of <strong>${formattedAmount}</strong>
                ${daysOverdue > 0 ? `that is <strong>${daysOverdue} days overdue</strong>` : 'due soon'}
              </p>
            </div>

            <!-- Invoice Details -->
            <p style="font-weight: 600; margin-bottom: 10px; color: #1e293b;">Outstanding Invoices</p>
            <table style="width: 100%; border-collapse: collapse; margin-bottom: 25px;">
              <thead>
                <tr style="background-color: #f8f9fa; border-bottom: 2px solid #85754e;">
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

            <!-- Payment Methods -->
            <p style="font-weight: 600; margin-bottom: 10px; color: #1e293b;">Payment Methods</p>
            <div style="margin-bottom: 25px;">
              ${paymentMethodsHTML}
            </div>

            <!-- Action -->
            <div style="background-color: #f0f4f8; padding: 20px; border-radius: 6px; text-align: center; margin-bottom: 25px;">
              <p style="margin: 0 0 15px 0; color: #666;">
                Please process payment at your earliest convenience to avoid further action.
              </p>
              <a href="https://erp.finecountry.co.zw/dashboard" style="display: inline-block; background-color: #85754e; color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px; font-weight: 600;">
                View Dashboard
              </a>
            </div>

            <!-- Contact Info -->
            <p style="font-size: 14px; color: #666; margin-bottom: 10px; padding-top: 15px; border-top: 1px solid #e0e0e0;">
              If you have already processed this payment, please ignore this email. <br/>
              For questions, contact our accounting team at <strong>accounts@finecountry.co.zw</strong>
            </p>
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

export function generatePaymentReminderText(data: PaymentReminderData): string {
  const { client, invoices, totalOutstanding, daysOverdue } = data;
  const formattedAmount = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(totalOutstanding);

  return `
Payment Reminder

Dear ${client.firstName} ${client.lastName},

This is a friendly reminder that you have an outstanding balance of ${formattedAmount}${daysOverdue > 0 ? ` that is ${daysOverdue} days overdue` : ''}.

OUTSTANDING INVOICES:
${invoices
  .map(
    (inv) =>
      `Invoice #${inv.invoiceNumber} - ${new Date(inv.invoiceDate).toLocaleDateString()} - ${new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD',
      }).format(Number(inv.totalAmount))} [${inv.status}]`
  )
  .join('\n')}

Please process payment at your earliest convenience.

If you have already processed this payment, please disregard this email.

For assistance, contact accounts@finecountry.co.zw

Best regards,
Fine & Country Zimbabwe Team
  `.trim();
}
