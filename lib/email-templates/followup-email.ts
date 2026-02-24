/**
 * Follow-up Email Template
 * Sends follow-up emails for properties and leads
 */

interface FollowupEmailData {
  recipientName: string;
  propertyName: string;
  propertyUrl: string;
  agentName: string;
  agentPhone: string;
  agentEmail: string;
}

const followupEmailTemplate = (data: FollowupEmailData) => {
  return {
    subject: `Follow-up: Your Interest in ${data.propertyName}`,
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
            .property-info { background: white; border: 1px solid #e5e7eb; padding: 15px; border-radius: 5px; margin: 20px 0; }
            .button { 
              display: inline-block; 
              background: #2563eb; 
              color: white; 
              padding: 10px 20px; 
              text-decoration: none; 
              border-radius: 5px; 
              margin: 20px 0;
            }
            .agent-info { background: #f3f4f6; padding: 15px; border-radius: 5px; margin: 20px 0; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>Thank You for Your Interest</h1>
            </div>
            <div class="content">
              <p>Dear ${data.recipientName},</p>
              
              <p>Thank you for showing interest in <strong>${data.propertyName}</strong>. We would love to help you find your perfect property.</p>
              
              <div class="property-info">
                <h3>${data.propertyName}</h3>
                <p>We have additional information and would like to schedule a viewing at your convenience.</p>
              </div>
              
              <a href="${data.propertyUrl}" class="button">View Property Details</a>
              
              <div class="agent-info">
                <h4>Your Agent</h4>
                <p><strong>${data.agentName}</strong></p>
                <p>📞 <a href="tel:${data.agentPhone}" style="color: #2563eb; text-decoration: none;">${data.agentPhone}</a></p>
                <p>📧 <a href="mailto:${data.agentEmail}" style="color: #2563eb; text-decoration: none;">${data.agentEmail}</a></p>
              </div>
              
              <p>Feel free to reach out with any questions or to schedule a viewing.</p>
            </div>
            <div class="footer">
              <p>&copy; 2025 Fine & Country Zimbabwe. All rights reserved.</p>
            </div>
          </div>
        </body>
      </html>
    `,
    text: `
Thank You for Your Interest

Dear ${data.recipientName},

Thank you for showing interest in ${data.propertyName}. We would love to help you find your perfect property.

View Property Details: ${data.propertyUrl}

Your Agent
${data.agentName}
📞 ${data.agentPhone}
📧 ${data.agentEmail}

Feel free to reach out with any questions or to schedule a viewing.

© 2025 Fine & Country Zimbabwe
    `.trim(),
  };
};

export function generateFollowupEmailHTML(data: FollowupEmailData): string {
  return followupEmailTemplate(data).html;
}

export function generateFollowupEmailText(data: FollowupEmailData): string {
  return followupEmailTemplate(data).text;
}
