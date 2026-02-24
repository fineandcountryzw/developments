import { validateResendApiKey, sendEmail } from '../lib/email-service';

async function testEmailService() {
  console.log('=== Testing Email Service ===');
  
  // Test 1: Validate Resend API key
  console.log('\n1. Testing Resend API Key Validation');
  try {
    const validationResult = await validateResendApiKey();
    console.log('Validation Result:', validationResult);
    
    if (!validationResult.valid) {
      console.error('API key is invalid');
      return;
    }
  } catch (error) {
    console.error('Error validating API key:', error);
    return;
  }
  
  // Test 2: Test sending a simple email with attachment
  console.log('\n2. Testing Email Sending with Attachment');
  try {
    // Create a simple test PDF buffer
    const testPdfBuffer = Buffer.from('Test PDF Content', 'utf-8');
    
    const result = await sendEmail({
      to: 'test@example.com',
      subject: 'Test Account Statement',
      html: `
        <h1>Test Statement</h1>
        <p>This is a test email with a PDF attachment.</p>
      `,
      attachments: [
        {
          filename: 'Test_Statement.pdf',
          content: testPdfBuffer,
          contentType: 'application/pdf'
        }
      ]
    });
    
    console.log('Email Sent Successfully:', result);
  } catch (error) {
    console.error('Error sending email:', error);
  }
}

testEmailService().catch(console.error);
