# SMTP Configuration Guide for Payment Automation

## 📧 Overview

The payment automation system uses SMTP (Simple Mail Transfer Protocol) to send emails. This guide covers setup for common email providers.

---

## 🟣 Gmail Configuration

### Step 1: Enable 2-Factor Authentication

1. Go to [Google Account](https://myaccount.google.com)
2. Click "Security" in the left menu
3. Scroll to "2-Step Verification"
4. Complete setup (verify phone, etc.)

### Step 2: Generate App Password

1. Go to [Google Account](https://myaccount.google.com)
2. Click "Security" in the left menu
3. Scroll to "App passwords" (requires 2FA)
4. Select:
   - App: **Mail**
   - Device: **Windows/Linux/Mac/Other**
5. Google generates a **16-character password**
6. Copy this password

### Step 3: Configure Environment Variables

```env
# Gmail SMTP Settings
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your-email@gmail.com
SMTP_PASSWORD=your-16-char-app-password

# Email Headers
SMTP_FROM=noreply@finecountry.co.zw
SMTP_REPLY_TO=accounts@finecountry.co.zw
```

### Step 4: Test Connection

```bash
npm install nodemailer
node -e "
const nodemailer = require('nodemailer');
const transporter = nodemailer.createTransport({
  host: 'smtp.gmail.com',
  port: 587,
  secure: false,
  auth: {
    user: 'your-email@gmail.com',
    pass: 'your-app-password'
  }
});

transporter.verify((error, success) => {
  if (error) console.log('Error:', error);
  if (success) console.log('✅ SMTP connection successful!');
});
"
```

---

## 🔵 Office 365 Configuration

### Step 1: Enable App Password

1. Go to [Microsoft Account Security](https://account.microsoft.com/security)
2. Create **App password**:
   - Platform: **Windows**
   - App: **Mail**
3. Microsoft generates 16-character password

### Step 2: Configure Environment Variables

```env
# Office 365 SMTP Settings
SMTP_HOST=smtp.office365.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your-email@company.com
SMTP_PASSWORD=your-app-password

# Email Headers
SMTP_FROM=noreply@finecountry.co.zw
SMTP_REPLY_TO=accounts@finecountry.co.zw
```

---

## 🟡 Custom Domain Email (Hostinger, GoDaddy, Namecheap)

### Step 1: Get SMTP Details from Provider

| Provider | Host | Port | Secure |
|----------|------|------|--------|
| Hostinger | smtp.hostinger.com | 587 | false |
| GoDaddy | smtp.secureserver.net | 465 | true |
| Namecheap | mail.privateemail.com | 587 | false |

### Step 2: Configure Environment Variables

```env
# Custom Domain SMTP
SMTP_HOST=smtp.your-provider.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=noreply@finecountry.co.zw
SMTP_PASSWORD=your-email-password

# Email Headers
SMTP_FROM=noreply@finecountry.co.zw
SMTP_REPLY_TO=accounts@finecountry.co.zw
```

---

## 🔴 SendGrid Configuration

### Step 1: Create SendGrid Account

1. Sign up at [SendGrid](https://sendgrid.com)
2. Verify email address
3. Create **API Key**:
   - Go to Settings → API Keys
   - Click "Create API Key"
   - Copy the key (shown only once)

### Step 2: Configure Environment Variables

```env
# SendGrid SMTP Settings
SMTP_HOST=smtp.sendgrid.net
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=apikey
SMTP_PASSWORD=SG.your-very-long-api-key

# Email Headers
SMTP_FROM=noreply@finecountry.co.zw
SMTP_REPLY_TO=accounts@finecountry.co.zw
```

### Step 3: Set Sender

Add verified sender address in SendGrid:
1. Settings → Sender Authentication
2. Click "Verify a Domain" or "Verify a Single Sender"
3. Add: `noreply@finecountry.co.zw`

---

## 🟠 Mailgun Configuration

### Step 1: Create Mailgun Account

1. Sign up at [Mailgun](https://mailgun.com)
2. Verify domain
3. Get API key from dashboard

### Step 2: Configure Environment Variables

```env
# Mailgun SMTP Settings
SMTP_HOST=smtp.mailgun.org
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=postmaster@finecountry.co.zw
SMTP_PASSWORD=your-mailgun-password

# Email Headers
SMTP_FROM=noreply@finecountry.co.zw
SMTP_REPLY_TO=accounts@finecountry.co.zw
```

---

## 🟢 AWS SES (Simple Email Service)

### Step 1: Set Up SES

1. Go to [AWS SES Console](https://console.aws.amazon.com/ses)
2. Verify domain: **Domains**
3. Create **SMTP Credentials**
4. Download credentials

### Step 2: Configure Environment Variables

```env
# AWS SES SMTP Settings
SMTP_HOST=email-smtp.region.amazonaws.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your-ses-username
SMTP_PASSWORD=your-ses-password

# Email Headers
SMTP_FROM=noreply@finecountry.co.zw
SMTP_REPLY_TO=accounts@finecountry.co.zw
```

**Note**: Replace `region` with your AWS region (e.g., `us-east-1`)

---

## 🔒 Security Best Practices

### 1. Never Hardcode Credentials
```javascript
// ❌ BAD
const password = 'my-secret-password';

// ✅ GOOD
const password = process.env.SMTP_PASSWORD;
```

### 2. Use App-Specific Passwords
- Never use your main email password
- Use provider's app password feature
- Rotate passwords periodically

### 3. Restrict Email Usage
- Limit to legitimate business emails only
- Monitor for abuse/spam
- Set sending rate limits

### 4. Use TLS/SSL
```env
# Standard configuration
SMTP_SECURE=false
SMTP_PORT=587

# Alternative (if provider requires)
SMTP_SECURE=true
SMTP_PORT=465
```

---

## 🧪 Testing SMTP Connection

### Quick Test Script

```bash
# Create test.js
cat > test-smtp.js << 'EOF'
const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: process.env.SMTP_PORT,
  secure: process.env.SMTP_SECURE === 'true',
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASSWORD,
  },
});

// Test connection
transporter.verify((error, success) => {
  if (error) {
    console.error('❌ SMTP Error:', error);
    process.exit(1);
  } else {
    console.log('✅ SMTP connection successful!');
    
    // Send test email
    transporter.sendMail({
      from: process.env.SMTP_FROM,
      to: 'test@example.com',
      subject: 'SMTP Test Email',
      text: 'This is a test email from your ERP system.',
    }, (err, info) => {
      if (err) console.error('❌ Send Error:', err);
      else console.log('✅ Email sent:', info.response);
      process.exit(0);
    });
  }
});
EOF

# Run test
node test-smtp.js
```

---

## ⚠️ Common Issues & Solutions

### Issue 1: "Authentication Failed"
**Cause**: Wrong username/password  
**Solution**:
- Double-check SMTP_USER and SMTP_PASSWORD
- Use app password, not main password
- Ensure no extra spaces in env vars

### Issue 2: "Connection Refused"
**Cause**: Wrong host or port  
**Solution**:
- Verify SMTP_HOST and SMTP_PORT
- Check provider documentation
- Ensure firewall allows outbound port 587/465

### Issue 3: "TLS Error"
**Cause**: SMTP_SECURE mismatch  
**Solution**:
- Port 587 → SMTP_SECURE=false
- Port 465 → SMTP_SECURE=true

### Issue 4: "554 Service Unavailable"
**Cause**: Daily sending limit reached  
**Solution**:
- Check provider rate limits
- Upgrade account plan
- Spread sends across hours

### Issue 5: "550 Sender Address Rejected"
**Cause**: SMTP_FROM not verified  
**Solution**:
- Verify sender in provider dashboard
- Use format: `Name <email@domain.com>`
- Check SPF/DKIM records

---

## 📋 Verification Checklist

- [ ] SMTP_HOST set correctly
- [ ] SMTP_PORT matches security setting
- [ ] SMTP_USER is correct username
- [ ] SMTP_PASSWORD is app password (not main password)
- [ ] SMTP_FROM is verified sender
- [ ] SMTP_REPLY_TO set for customer replies
- [ ] Test connection successful
- [ ] Test email received
- [ ] .env file not committed to git
- [ ] Firewall allows outbound SMTP port

---

## 🚀 Production Setup

### Recommended Configuration

```env
# Production SMTP (Gmail)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=business-email@finecountry.co.zw
SMTP_PASSWORD=app-specific-password-16-chars
SMTP_FROM=noreply@finecountry.co.zw
SMTP_REPLY_TO=accounts@finecountry.co.zw

# Security
CRON_SECRET=very-long-random-secret-key-here

# Admin Notifications
ADMIN_EMAILS=director@finecountry.co.zw,finance@finecountry.co.zw
```

### Volume Estimates

| Provider | Daily Limit | Monthly | Cost |
|----------|------------|---------|------|
| Gmail | 500 | 15,000 | Free |
| SendGrid | 40,000/mo | 40,000 | Free (starter) |
| Mailgun | 5,000/mo | 5,000 | Free |
| AWS SES | 200/day | 6,000 | Pay-per-use (~$0.10 per 1000) |

---

## 📞 Provider Support

- **Gmail**: [Google Support](https://support.google.com/mail)
- **Office 365**: [Microsoft Support](https://support.microsoft.com)
- **SendGrid**: [SendGrid Docs](https://docs.sendgrid.com)
- **Mailgun**: [Mailgun Docs](https://documentation.mailgun.com)
- **AWS SES**: [AWS SES Docs](https://docs.aws.amazon.com/ses)

---

*SMTP Configuration Guide v1.0*
*For Fine & Country Zimbabwe ERP - Phase 4 Payment Automation*
