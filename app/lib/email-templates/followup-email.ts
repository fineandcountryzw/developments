export interface FollowupEmailData {
  client: any;
  invoice: any & { stand?: { id: string; standNumber: string } };
  daysOverdue: number;
  totalOverdueAmount: number;
  previousReminders: number;
}

export function generateFollowupEmailHTML(data: FollowupEmailData): string {
  const { client, invoice, daysOverdue, totalOverdueAmount, previousReminders } = data;
  const formattedAmount = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(Number(invoice.totalAmount));
  const formattedTotal = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(Number(totalOverdueAmount));

  const urgency =
    daysOverdue > 60
      ? { color: '#8b0000', bgColor: '#f8d7da', text: 'CRITICAL - 60+ Days Overdue' }
      : daysOverdue > 30
        ? { color: '#c41e3a', bgColor: '#f8d7da', text: 'URGENT - 30+ Days Overdue' }
        : { color: '#856404', bgColor: '#fff3cd', text: 'Follow-up - Payment Due' };

  return `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Payment Follow-up - Fine & Country Zimbabwe</title>
      </head>
      <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333;">
        <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border: 1px solid #e0e0e0; border-radius: 8px; overflow: hidden;">
          
          <!-- Header -->
          <div style="background: linear-gradient(135deg, ${urgency.color === '#8b0000' ? '#8b0000' : '#85754e'} 0%, ${urgency.color === '#8b0000' ? '#c41e3a' : '#6d5c3f'} 100%); color: white; padding: 30px; text-align: center;">
            <h1 style="margin: 0; font-size: 24px; font-weight: 600;">${urgency.text}</h1>
            <p style="margin: 10px 0 0 0; opacity: 0.9;">Invoice ${invoice.invoiceNumber}</p>
          </div>

          <!-- Content -->
          <div style="padding: 30px;">
            
            <!-- Greeting -->
            <p style="font-size: 16px; margin-bottom: 20px;">
              Dear <strong>${client.firstName} ${client.lastName}</strong>,
            </p>

            <!-- Status -->
            <div style="background-color: ${urgency.bgColor}; border-left: 4px solid ${urgency.color}; padding: 15px; margin-bottom: 25px; border-radius: 4px;">
              <p style="margin: 0; color: ${urgency.color}; font-weight: 500;">
                This is a follow-up notice regarding your overdue payment. 
                <strong>${daysOverdue} days have passed</strong> since the original due date.
              </p>
              ${
                previousReminders > 0
                  ? `<p style="margin: 10px 0 0 0; color: ${urgency.color};"><strong>${previousReminders} previous reminder(s) sent</strong></p>`
                  : ''
              }
            </div>

            <!-- Invoice Details -->
            <div style="background-color: #f8f9fa; padding: 20px; border-radius: 6px; margin-bottom: 25px;">
              <h3 style="margin: 0 0 15px 0; color: #1e293b;">Invoice Details</h3>
              <table style="width: 100%; font-size: 14px;">
                <tr>
                  <td style="padding: 8px 0; color: #666;">Invoice Number:</td>
                  <td style="padding: 8px 0; font-weight: 600; text-align: right;">#${invoice.invoiceNumber}</td>
                </tr>
                <tr>
                  <td style="padding: 8px 0; color: #666;">Invoice Date:</td>
                  <td style="padding: 8px 0; font-weight: 600; text-align: right;">${new Date(invoice.invoiceDate).toLocaleDateString()}</td>
                </tr>
                <tr>
                  <td style="padding: 8px 0; color: #666;">Due Date:</td>
                  <td style="padding: 8px 0; font-weight: 600; text-align: right;">${new Date(invoice.dueDate).toLocaleDateString()}</td>
                </tr>
                <tr style="border-top: 2px solid #e0e0e0; border-bottom: 2px solid #e0e0e0;">
                  <td style="padding: 12px 0; color: #1e293b; font-weight: 600;">Amount Due:</td>
                  <td style="padding: 12px 0; font-weight: 700; text-align: right; font-size: 16px; color: #c41e3a;">${formattedAmount}</td>
                </tr>
              </table>
            </div>

            <!-- Total Outstanding -->
            <div style="background-color: #fff3cd; padding: 15px; border-radius: 6px; margin-bottom: 25px; text-align: center;">
              <p style="margin: 0; color: #856404; font-size: 14px;">Total Outstanding on Your Account</p>
              <p style="margin: 10px 0 0 0; color: #856404; font-size: 20px; font-weight: 700;">${formattedTotal}</p>
            </div>

            <!-- Actions -->
            <div style="margin-bottom: 25px;">
              <p style="font-weight: 600; margin-bottom: 15px; color: #1e293b;">Next Steps</p>
              <ol style="margin: 0; padding-left: 20px; color: #666;">
                <li style="margin-bottom: 8px;">Log in to your dashboard</li>
                <li style="margin-bottom: 8px;">Review the invoice details</li>
                <li style="margin-bottom: 8px;">Process payment using your preferred method</li>
                <li>Confirm payment was received</li>
              </ol>
            </div>

            <!-- CTA -->
            <div style="text-align: center; margin-bottom: 25px;">
              <a href="https://erp.finecountry.co.zw/dashboard" style="display: inline-block; background-color: #85754e; color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px; font-weight: 600;">
                View & Pay Invoice
              </a>
            </div>

            <!-- Help -->
            <div style="background-color: #f0f4f8; padding: 15px; border-radius: 6px; margin-bottom: 25px; font-size: 14px; color: #666;">
              <strong>Need Help?</strong><br/>
              If you've already sent payment, or if you have questions about this invoice, please contact us immediately:<br/>
              <strong>Email:</strong> accounts@finecountry.co.zw<br/>
              <strong>Phone:</strong> +263 4 668 8500
            </div>

            <!-- Important Note -->
            <p style="font-size: 13px; color: #999; margin: 0; padding-top: 15px; border-top: 1px solid #e0e0e0;">
              This is an automated follow-up notice. Continued non-payment may result in suspension of your account and/or legal action.
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

export function generateFollowupEmailText(data: FollowupEmailData): string {
  const { client, invoice, daysOverdue, totalOverdueAmount, previousReminders } = data;
  const formattedAmount = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(Number(invoice.totalAmount));
  const formattedTotal = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(Number(totalOverdueAmount));

  return `
PAYMENT FOLLOW-UP NOTICE

Dear ${client.firstName} ${client.lastName},

This is a follow-up regarding your overdue payment for Invoice #${invoice.invoiceNumber}.

${daysOverdue} days have passed since the original due date.
${previousReminders > 0 ? `${previousReminders} previous reminder(s) have been sent.` : ''}

INVOICE DETAILS:
Invoice Number: #${invoice.invoiceNumber}
Invoice Date: ${new Date(invoice.invoiceDate).toLocaleDateString()}
Due Date: ${new Date(invoice.dueDate).toLocaleDateString()}
Amount Due: ${formattedAmount}

Total Outstanding on Your Account: ${formattedTotal}

NEXT STEPS:
1. Log in to your dashboard
2. Review the invoice
3. Process payment immediately
4. Contact us if you have questions

We understand that delays can happen. However, we need to resolve this matter urgently to avoid suspension of your account or further action.

If you've already sent payment, please provide confirmation details to:
Email: accounts@finecountry.co.zw
Phone: +263 4 668 8500

View & Pay: https://erp.finecountry.co.zw/dashboard

Fine & Country Zimbabwe Team
  `.trim();
}
