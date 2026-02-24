# Google Sign-In Setup Guide

## ✅ What Was Done

1. **Added Google OAuth Provider** to NextAuth configuration
2. **Added Google Sign-In Button** to login page
3. **Added Auto-Registration** for new Google users (assigns CLIENT role)
4. **Environment variables** prepared in `.env.local`

---

## 📋 Setup Steps

### Step 1: Get Google OAuth Credentials

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project (or select existing)
   - Project name: "Fine & Country Zimbabwe ERP"
3. Enable **Google+ API**:
   - Go to "APIs & Services" → "Library"
   - Search for "Google+ API"
   - Click "Enable"

4. Create OAuth 2.0 Credentials:
   - Go to "Credentials" → "Create Credentials" → "OAuth 2.0 Client ID"
   - Configure OAuth consent screen (if first time):
     - User Type: External
     - App name: Fine & Country Zimbabwe ERP
     - User support email: your-email@example.com
     - Developer contact: your-email@example.com
     - Add scopes: email, profile
   
5. Create OAuth Client ID:
   - Application type: **Web application**
   - Name: "Fine & Country ERP Web"
   
6. **Add Authorized Redirect URIs**:
   ```
   Development:
   http://localhost:3000/api/auth/callback/google
   
   Production:
   https://www.fineandcountryerp.com/api/auth/callback/google
   ```

7. Copy your credentials:
   - **Client ID**: `xxxxx.apps.googleusercontent.com`
   - **Client Secret**: `xxxxx`

---

### Step 2: Update Environment Variables

Open `.env.local` and replace these placeholders:

```env
# Google OAuth Configuration
GOOGLE_CLIENT_ID=paste-your-client-id-here.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=paste-your-client-secret-here

# Make sure NextAuth URL is set
NEXTAUTH_URL=http://localhost:3000
```

**For Production** (add to Vercel environment variables):
```env
NEXTAUTH_URL=https://www.fineandcountryerp.com
GOOGLE_CLIENT_ID=your-production-client-id
GOOGLE_CLIENT_SECRET=your-production-client-secret
```

---

### Step 3: Generate NextAuth Secret

If you haven't already, generate a secure secret:

```bash
# On Mac/Linux:
openssl rand -base64 32

# On Windows PowerShell:
$bytes = New-Object byte[] 32
[Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($bytes)
[Convert]::ToBase64String($bytes)
```

Add to `.env.local`:
```env
NEXTAUTH_SECRET=your-generated-secret-here
```

---

### Step 4: Restart Development Server

```bash
npm run dev
```

---

## 🧪 Testing

### Test Google Sign-In

1. Navigate to: `http://localhost:3000/login`
2. Click **"Sign in with Google"** button
3. Choose your Google account
4. Authorize the application
5. You should be redirected to `/post-login` and then to your dashboard

### Expected Behavior

**First-time Google User:**
- ✅ User automatically created in database
- ✅ Role: `CLIENT` (default)
- ✅ Branch: `Harare` (default)
- ✅ Email verified
- ✅ Redirected to client dashboard

**Existing User:**
- ✅ Signs in with existing account
- ✅ Uses role from database
- ✅ Redirected to appropriate dashboard based on role

---

## 🔍 Verification

### Check Database

```sql
-- See all users who signed in via Google
SELECT email, name, role, branch, "emailVerified", "createdAt"
FROM users
WHERE email IN (
  SELECT DISTINCT u.email 
  FROM users u 
  JOIN accounts a ON u.id = a.user_id 
  WHERE a.provider = 'google'
);
```

### Check Logs

Watch for these console messages:
```
[NEXTAUTH] Google sign-in detected: user@gmail.com
[NEXTAUTH] Creating new user from Google OAuth: user@gmail.com
[NEXTAUTH] JWT created: { id: 'xxx', role: 'CLIENT' }
```

---

## 🎨 UI Features

The Google button shows:
- ✅ Official Google logo (4 colors)
- ✅ Proper branding ("Sign in with Google")
- ✅ Matches existing UI style
- ✅ Disabled state during loading
- ✅ Hover effects

---

## 🔒 Security Features

1. **Auto-Registration Control**: New Google users get `CLIENT` role (lowest privilege)
2. **Inactive User Check**: Blocked users can't sign in even via Google
3. **Email Verification**: Google accounts are pre-verified
4. **Session Management**: Uses NextAuth JWT strategy
5. **HTTPS Only (Production)**: OAuth only works over HTTPS in production

---

## 📱 User Experience

### Login Page Flow

```
┌─────────────────────────────────────┐
│         Login Page                  │
├─────────────────────────────────────┤
│  Email: ___________________         │
│  Password: _______________          │
│  [ Sign In ]                        │
│                                     │
│  ─────── Or continue with ──────    │
│                                     │
│  [ 🔵 Sign in with Google ]         │
│                                     │
│  ─────── Don't have account? ────   │
│  Request Access →                   │
└─────────────────────────────────────┘
```

---

## 🛠 Troubleshooting

### Issue: "Error: redirect_uri_mismatch"

**Cause**: Redirect URI not added to Google Console

**Fix**: 
1. Go to Google Console → Credentials
2. Edit your OAuth Client ID
3. Add exact redirect URI: `http://localhost:3000/api/auth/callback/google`

---

### Issue: "Sign in with Google" button doesn't appear

**Cause**: Missing environment variables

**Fix**: 
1. Check `.env.local` has `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET`
2. Restart dev server: `npm run dev`
3. Check browser console for errors

---

### Issue: User signs in but gets 403 error

**Cause**: New user created with CLIENT role but trying to access admin pages

**Fix**: Update user role in database:
```sql
UPDATE users 
SET role = 'ADMIN' 
WHERE email = 'your-email@gmail.com';
```

---

### Issue: "Configuration" error

**Cause**: Missing `NEXTAUTH_SECRET` or `NEXTAUTH_URL`

**Fix**: Add to `.env.local`:
```env
NEXTAUTH_SECRET=your-secret-here
NEXTAUTH_URL=http://localhost:3000
```

---

## 🚀 Production Deployment

### Vercel Environment Variables

Add these to your Vercel project:

```
NEXTAUTH_URL=https://www.fineandcountryerp.com
NEXTAUTH_SECRET=your-production-secret
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret
```

### Google Console Production Setup

1. Add production redirect URI:
   ```
   https://www.fineandcountryerp.com/api/auth/callback/google
   ```

2. Update OAuth consent screen:
   - Add production domain
   - Submit for verification if needed

---

## 📊 Role Assignment

### Default Role for New Google Users

Currently set to: **CLIENT**

To change default role, edit `lib/authOptions.ts`:

```typescript
await prisma.user.create({
  data: {
    email: user.email!,
    name: user.name || profile?.name,
    image: user.image,
    role: 'CLIENT', // Change to AGENT, ADMIN, etc.
    branch: 'Harare',
    isActive: true,
    emailVerified: new Date(),
  }
});
```

### Manual Role Assignment

Admins can update user roles via:
1. Admin Dashboard → User Management
2. Or directly in database

---

## 🎯 Next Steps

### Optional Enhancements

1. **Add Microsoft Sign-In**:
   - Similar setup with Microsoft Entra ID (Azure AD)
   - Add `AZURE_AD_CLIENT_ID` and `AZURE_AD_CLIENT_SECRET`

2. **Add GitHub Sign-In**:
   - For developer accounts
   - Good for internal team

3. **Role Selection After Google Sign-In**:
   - Show role picker if user is new
   - Let them choose AGENT or CLIENT

4. **Email Domain Restrictions**:
   - Only allow `@fineandcountry.co.zw` for ADMIN role
   - Block personal emails for staff

---

## 📞 Support

For issues:
1. Check browser console logs
2. Check server logs (terminal)
3. Verify Google Console settings
4. Check database for user record

**Status**: ✅ Ready to use after adding credentials
