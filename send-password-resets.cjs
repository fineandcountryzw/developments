require('dotenv').config({ path: '.env.local' });

const { PrismaClient } = require('@prisma/client');
const { PrismaNeon } = require('@prisma/adapter-neon');
const crypto = require('crypto');

const connectionString = process.env.DATABASE_URL;
const adapter = new PrismaNeon({ connectionString });
const prisma = new PrismaClient({ adapter });

// Resend API
const RESEND_API_KEY = process.env.RESEND_API_KEY;
const FROM_EMAIL = process.env.RESEND_FROM || 'no-reply@fineandcountryerp.com';

async function sendPasswordResetEmail(email, name, resetLink) {
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: linear-gradient(135deg, #1a2b3c 0%, #2d4a5c 100%); color: white; padding: 30px; text-align: center; }
        .content { padding: 30px; background: #f9f9f9; }
        .button { display: inline-block; background: #c4a052; color: white; padding: 15px 30px; text-decoration: none; border-radius: 5px; margin: 20px 0; }
        .footer { padding: 20px; text-align: center; color: #666; font-size: 12px; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>Password Reset</h1>
          <p>Fine & Country Zimbabwe</p>
        </div>
        <div class="content">
          <p>Hello ${name},</p>
          <p>We received a request to reset your password for your Fine & Country Zimbabwe ERP account.</p>
          <p>Click the button below to set your new password:</p>
          <p style="text-align: center;">
            <a href="${resetLink}" class="button">Reset Password</a>
          </p>
          <p>Or copy and paste this link:</p>
          <p style="word-break: break-all; background: #eee; padding: 10px; font-size: 12px;">${resetLink}</p>
          <p><strong>This link expires in 1 hour.</strong></p>
          <p>If you didn't request this, you can safely ignore this email.</p>
        </div>
        <div class="footer">
          <p>Fine & Country Zimbabwe ERP</p>
          <p>© ${new Date().getFullYear()} All rights reserved</p>
        </div>
      </div>
    </body>
    </html>
  `;

  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${RESEND_API_KEY}`
    },
    body: JSON.stringify({
      from: FROM_EMAIL,
      to: email,
      subject: 'Reset Your Password - Fine & Country Zimbabwe',
      html: html
    })
  });

  const result = await response.json();
  return { ok: response.ok, result };
}

async function triggerPasswordReset(email) {
  console.log(`\n=== Processing ${email} ===`);
  
  // Find user
  const user = await prisma.user.findUnique({
    where: { email: email.toLowerCase() }
  });
  
  if (!user) {
    console.log(`  User not found: ${email}`);
    return;
  }
  
  console.log(`  Found: ${user.name} (${user.role})`);
  
  // Generate reset token
  const resetToken = crypto.randomBytes(32).toString('hex');
  const resetTokenHash = crypto.createHash('sha256').update(resetToken).digest('hex');
  const resetTokenExpiry = new Date(Date.now() + 60 * 60 * 1000); // 1 hour
  
  // Update user with reset token
  await prisma.$executeRaw`
    UPDATE users 
    SET reset_token = ${resetTokenHash}, 
        reset_token_expiry = ${resetTokenExpiry}
    WHERE id = ${user.id}
  `;
  
  console.log(`  Reset token generated (expires: ${resetTokenExpiry.toISOString()})`);
  
  // Build reset link
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://www.fineandcountryerp.com';
  const resetLink = `${baseUrl}/reset-password?token=${resetToken}`;
  
  console.log(`  Reset link: ${resetLink}`);
  
  // Send email
  const { ok, result } = await sendPasswordResetEmail(email, user.name || email, resetLink);
  
  if (ok) {
    console.log(`  ✅ Email sent successfully!`);
  } else {
    console.log(`  ❌ Email failed:`, result);
  }
}

async function main() {
  const emails = [
    'karen.n@fineandcountry.com',
    'benkumbirai1@gmail.com'
  ];
  
  for (const email of emails) {
    await triggerPasswordReset(email);
  }
  
  console.log('\n=== Done ===');
}

main().catch(console.error).finally(() => prisma.$disconnect());
