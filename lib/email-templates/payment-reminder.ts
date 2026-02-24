/**
 * Payment Reminder Email Template
 * Sends reminders for upcoming payment dates
 */

interface PaymentReminderData {
  clientName: string;
  invoiceNumber: string;
  amount: number;
  dueDate: string;
  daysUntilDue: number;
  dashboardUrl: string;
}

const paymentReminderTemplate = (data: PaymentReminderData) => {
  return {
    subject: `Payment Reminder: Invoice ${data.invoiceNumber} Due ${data.daysUntilDue} Days`,
    html: `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="UTF-8">
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: #1e40af; color: white; padding: 20px; border-radius: 5px 5px 0 0; }
            .content { background: #f9fafb; padding: 20px; border: 1px solid #e5e7eb; }
            .footer { background: #374151; color: white; padding: 20px; border-radius: 0 0 5px 5px; text-align: center; }
            .amount { font-size: 24px; font-weight: bold; color: #2563eb; margin: 10px 0; }
            .button { 
              display: inline-block; 
              background: #2563eb; 
              color: white; 
              padding: 10px 20px; 
              text-decoration: none; 
              border-radius: 5px; 
              margin: 20px 0;
            }
            .info { background: #dbeafe; border-left: 4px solid #2563eb; padding: 10px; margin: 10px 0; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>💳 Payment Reminder</h1>
            </div>
            <div class="content">
              <p>Dear ${data.clientName},</p>
              
              <div class="info">
                <strong>Payment is due in ${data.daysUntilDue} days</strong>
              </div>
              
              <p>This is a friendly reminder that the following invoice will be due soon:</p>
              
              <table style="width: 100%; margin: 20px 0;">
                <tr>
                  <td><strong>Invoice Number:</strong></td>
                  <td>${data.invoiceNumber}</td>
                </tr>
                <tr>
                  <td><strong>Due Date:</strong></td>
                  <td>${data.dueDate}</td>
                </tr>
                <tr>
                  <td><strong>Amount Due:</strong></td>
                  <td><span class="amount">$${data.amount.toLocaleString('en-US', { minimumFractionDigits: 2 })}</span></td>
                </tr>
              </table>
              
              <p>To ensure timely processing, please arrange payment before the due date.</p>
              
              <a href="${data.dashboardUrl}" class="button">View Invoice</a>
              
              <p>Thank you for your business!</p>
            </div>
            <div class="footer">
              <p>&copy; 2025 Fine & Country Zimbabwe. All rights reserved.</p>
            </div>
          </div>
        </body>
      </html>
    `,
    text: `
Payment Reminder

Dear ${data.clientName},

This is a friendly reminder that the following invoice will be due soon:

Invoice Number: ${data.invoiceNumber}
Due Date: ${data.dueDate}
Days Until Due: ${data.daysUntilDue}
Amount Due: $${data.amount.toLocaleString('en-US', { minimumFractionDigits: 2 })}

To ensure timely processing, please arrange payment before the due date.

View Invoice: ${data.dashboardUrl}

Thank you for your business!

© 2025 Fine & Country Zimbabwe
    `.trim(),
  };
};

export function generatePaymentReminderHTML(data: PaymentReminderData): string {
  return paymentReminderTemplate(data).html;
}

export function generatePaymentReminderText(data: PaymentReminderData): string {
  return paymentReminderTemplate(data).text;
}
