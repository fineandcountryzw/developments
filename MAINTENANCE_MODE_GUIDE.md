# 🔒 ERP Maintenance Mode - Coming Soon Page

## Overview

A premium, password-protected "Coming Soon" landing page that can temporarily block access to the entire ERP system. Perfect for maintenance windows, upgrades, or staged rollouts.

## ✨ Features

- 🎨 **Premium UI Design** - Glass morphism, smooth animations, professional aesthetics
- 🔐 **Secure Password Protection** - Server-side validation, HttpOnly cookies, no client-side exposure
- 🚀 **Zero Breaking Changes** - Fully reversible, doesn't affect existing routes or code
- 📱 **Mobile-First** - Responsive design, optimized for all devices
- ⚡ **Performance** - No heavy dependencies, minimal overhead when disabled
- 🎯 **Easy Toggle** - Single environment variable to enable/disable

---

## 🚦 Quick Start

### Enable Maintenance Mode

1. **Set Environment Variables** (in `.env.local` or production environment):

```bash
# Enable maintenance mode
ERP_MAINTENANCE_MODE=true

# Set access password (change this!)
ERP_ACCESS_PASSWORD=YourSecurePassword123
```

2. **Restart the application**:

```bash
npm run dev
# or in production
npm run build && npm start
```

3. **Test it**:
   - Visit any route → You'll see the Coming Soon page
   - Enter the password → Access granted
   - Cookie valid for 7 days

### Disable Maintenance Mode

1. **Update Environment Variable**:

```bash
ERP_MAINTENANCE_MODE=false
```

2. **Restart the application** - Normal operation resumes

---

## 🏗️ Architecture

### Files Created/Modified

#### New Files:
- ✅ `app/coming-soon/page.tsx` - Premium Coming Soon UI component
- ✅ `app/api/unlock/route.ts` - Secure password validation API

#### Modified Files:
- ✅ `middleware.ts` - Added maintenance mode check (Phase 1)
- ✅ `.env.example` - Added maintenance mode variables
- ✅ `.env.local.template` - Added maintenance mode variables

### How It Works

```
┌─────────────────────────────────────────────┐
│  User requests ANY route                     │
└──────────────┬──────────────────────────────┘
               │
               ▼
┌─────────────────────────────────────────────┐
│  MIDDLEWARE (Phase 1)                        │
│  Check: ERP_MAINTENANCE_MODE=true?           │
└──────────────┬──────────────────────────────┘
               │
       ┌───────┴────────┐
       │                │
       ▼ NO             ▼ YES
   ┌────────┐      ┌──────────────────┐
   │ Normal │      │ Check cookie:    │
   │ Flow   │      │ erp_unlocked?    │
   └────────┘      └────┬─────────────┘
                        │
                ┌───────┴────────┐
                │                │
                ▼ YES            ▼ NO
           ┌─────────┐      ┌────────────┐
           │ Allow   │      │ Redirect   │
           │ Access  │      │ /coming-   │
           └─────────┘      │ soon       │
                            └────────────┘
                                  │
                                  ▼
                        ┌──────────────────┐
                        │ User enters      │
                        │ password         │
                        └────┬─────────────┘
                             │
                             ▼
                   ┌─────────────────────┐
                   │ POST /api/unlock    │
                   │ Validate password   │
                   └────┬────────────────┘
                        │
                ┌───────┴────────┐
                │                │
                ▼ Valid          ▼ Invalid
          ┌──────────┐      ┌──────────┐
          │ Set      │      │ Show     │
          │ cookie   │      │ error    │
          │ Redirect │      └──────────┘
          └──────────┘
```

### Security Model

1. **Password Storage**: 
   - ✅ Only in environment variables
   - ✅ Never exposed to client
   - ✅ Not in any client-side bundle

2. **Cookie Security**:
   - ✅ HttpOnly (JavaScript can't access)
   - ✅ Secure flag (HTTPS only in production)
   - ✅ SameSite: Lax
   - ✅ 7-day expiration

3. **Server-Side Validation**:
   - ✅ Password checked in API route
   - ✅ No client-side bypass possible
   - ✅ Middleware enforces on every request

---

## 🎨 UI Design

### Visual Elements

- **Background**: Full-viewport hero image with premium dark gradient overlay
- **Card**: Glass morphism with backdrop blur, subtle animations
- **Colors**: Amber/gold accent (brand alignment), white text on dark
- **Typography**: Light/semibold mix, professional hierarchy
- **Animations**: Smooth transitions, hover effects, loading states

### Responsive Breakpoints

- Mobile: 320px - 640px (optimized for small screens)
- Tablet: 641px - 1024px
- Desktop: 1025px+ (centered, max-width constrained)

### Image Implementation

```tsx
<Image
  src="https://p95t08lhll.ufs.sh/f/I5VkKRpIwc8j6cHk9iebfHgyVdO1n3XA9vJzheM4ZYrUSEqw"
  alt="Background"
  fill
  priority
  className="object-cover"
  quality={90}
  sizes="100vw"
/>
```

- ✅ Next.js Image optimization
- ✅ `fill` + `object-cover` for full viewport
- ✅ Priority loading (above the fold)
- ✅ No CLS (Cumulative Layout Shift)

---

## 🔧 Configuration

### Environment Variables

| Variable | Type | Default | Description |
|----------|------|---------|-------------|
| `ERP_MAINTENANCE_MODE` | boolean | `false` | Enable/disable maintenance mode |
| `ERP_ACCESS_PASSWORD` | string | - | Password to unlock ERP (required if mode=true) |

### Cookie Configuration

Located in: `app/api/unlock/route.ts`

```typescript
const UNLOCK_COOKIE_NAME = 'erp_unlocked';
const COOKIE_MAX_AGE = 60 * 60 * 24 * 7; // 7 days
```

**Customization Options**:
- Change cookie name: Update `UNLOCK_COOKIE_NAME`
- Adjust duration: Change `COOKIE_MAX_AGE` (in seconds)
- Session-only cookie: Set `maxAge: undefined`

### Allowed Paths (in maintenance mode)

Located in: `middleware.ts`

```typescript
const allowedPaths = [
  '/coming-soon',    // The coming soon page itself
  '/api/unlock',     // Password validation endpoint
  '/_next',          // Next.js internal routes
  '/favicon.ico',    // Favicon
];
```

**To allow additional paths** (e.g., `/login`, `/api/health`):
```typescript
const allowedPaths = [
  '/coming-soon',
  '/api/unlock',
  '/login',          // Allow login page
  '/api/health',     // Allow health check
  '/_next',
  '/favicon.ico',
];
```

---

## 🧪 Testing Guide

### Local Testing

1. **Enable maintenance mode**:
```bash
# .env.local
ERP_MAINTENANCE_MODE=true
ERP_ACCESS_PASSWORD=TestPassword123
```

2. **Restart dev server**:
```bash
npm run dev
```

3. **Test scenarios**:

| Test | Action | Expected Result |
|------|--------|-----------------|
| Block access | Visit `/` | Redirect to `/coming-soon` |
| Coming soon page | Visit `/coming-soon` | Display premium UI |
| Wrong password | Enter incorrect password | Show error message |
| Correct password | Enter correct password | Set cookie, redirect to `/` |
| Unlocked access | Visit any route after unlock | Normal access |
| Cookie expiry | Delete cookie manually | Block access again |

### Production Testing

1. **Deploy with maintenance mode enabled**
2. **Verify all routes are blocked**
3. **Test password unlock from different IPs**
4. **Verify cookie persistence across sessions**
5. **Test mobile responsiveness**

---

## 📱 User Experience Flow

### First Visit (Locked)
```
User → Any Route → Middleware Check → No Cookie → /coming-soon
```

### Unlock Flow
```
Coming Soon Page → Enter Password → 
API Validation → Success → Set Cookie → Redirect to /
```

### Subsequent Visits (Unlocked)
```
User → Any Route → Middleware Check → Cookie Present → Allow Access
```

---

## 🚀 Production Deployment

### Vercel / Netlify

1. **Add environment variables in dashboard**:
   - `ERP_MAINTENANCE_MODE=true`
   - `ERP_ACCESS_PASSWORD=YourSecurePassword`

2. **Redeploy application**

3. **Verify maintenance page is live**

### Docker / Self-Hosted

1. **Update environment file**:
```bash
# docker-compose.yml or .env
ERP_MAINTENANCE_MODE=true
ERP_ACCESS_PASSWORD=YourSecurePassword
```

2. **Restart containers**:
```bash
docker-compose down
docker-compose up -d
```

---

## 🔒 Security Best Practices

### Password Management

✅ **DO**:
- Use strong, unique passwords (12+ characters)
- Rotate password after maintenance window
- Use environment variables (never hardcode)
- Share password via secure channels only

❌ **DON'T**:
- Use the default password from templates
- Share password in code repositories
- Use weak passwords (e.g., "password123")
- Log password in server logs

### Cookie Security

The implementation already follows best practices:
- HttpOnly (prevents XSS attacks)
- Secure flag in production (HTTPS only)
- SameSite: Lax (prevents CSRF)
- Reasonable expiration (7 days)

### Rate Limiting (Optional Enhancement)

For production, consider adding rate limiting to `/api/unlock`:

```typescript
// Example using vercel/rate-limit
import rateLimit from '@vercel/rate-limit';

const limiter = rateLimit({
  interval: 60 * 1000, // 1 minute
  uniqueTokenPerInterval: 500,
});

export async function POST(request: NextRequest) {
  try {
    await limiter.check(request, 5, 'CACHE_TOKEN'); // 5 attempts per minute
    // ... rest of validation logic
  } catch {
    return NextResponse.json(
      { success: false, message: 'Rate limit exceeded' },
      { status: 429 }
    );
  }
}
```

---

## 🔄 Reversibility

This feature is designed to be **100% reversible**:

### To Disable Completely

1. **Set environment variable**:
```bash
ERP_MAINTENANCE_MODE=false
```

2. **Restart application** - That's it! Everything works normally

### To Remove Feature (Future)

If you want to completely remove the feature later:

1. **Delete new files**:
   - `app/coming-soon/page.tsx`
   - `app/api/unlock/route.ts`

2. **Revert middleware.ts** to git history:
```bash
git checkout <commit-hash-before-maintenance> -- middleware.ts
```

3. **Remove environment variables** from `.env.*` files

No other code is affected. The ERP will work exactly as before.

---

## 📊 Monitoring & Logs

### Server Logs

The middleware logs maintenance mode activity:

```
[MAINTENANCE] Mode active, checking access for: /dashboards/admin
[MAINTENANCE] Access denied, redirecting to /coming-soon
[MAINTENANCE] Unlocked, proceeding...
```

### Unlock Attempts

Successful/failed unlock attempts are logged:

```
[UNLOCK] Failed unlock attempt from: 192.168.1.1
[UNLOCK] Access granted from: 192.168.1.1
```

### Monitoring in Production

Consider tracking:
- Number of unlock attempts
- Failed attempt IPs (for security)
- Average time in maintenance mode
- User feedback during maintenance

---

## 🐛 Troubleshooting

### Issue: Infinite redirect to /coming-soon

**Cause**: Cookie not being set properly

**Solution**:
1. Check browser allows cookies
2. Verify `secure: true` only in production
3. Check cookie domain settings

### Issue: Password not working

**Cause**: Environment variable not loaded

**Solution**:
1. Verify `.env.local` has correct password
2. Restart dev server after env changes
3. Check `process.env.ERP_ACCESS_PASSWORD` in API route

### Issue: Maintenance mode not activating

**Cause**: String comparison issue ("true" vs true)

**Solution**:
- Ensure `ERP_MAINTENANCE_MODE="true"` (string, not boolean)
- Check middleware logs for status

### Issue: Image not loading

**Cause**: Next.js image optimization error

**Solution**:
1. Verify image URL is accessible
2. Check `next.config.js` allows remote images:
```javascript
images: {
  remotePatterns: [
    {
      protocol: 'https',
      hostname: 'p95t08lhll.ufs.sh',
    },
  ],
},
```

---

## 📝 Changelog

### Version 1.0.0 (Initial Release)

**Added**:
- ✅ Premium Coming Soon page with glass morphism design
- ✅ Secure password protection via server-side validation
- ✅ Middleware-based global route protection
- ✅ HttpOnly cookie session management
- ✅ Environment-based feature toggle
- ✅ Mobile-first responsive design
- ✅ Full reversibility support

**Security**:
- ✅ No client-side password exposure
- ✅ Server-side validation only
- ✅ Secure cookie configuration
- ✅ Constant-time comparison ready

---

## 🤝 Support & Contributing

### Questions?

- Check this README first
- Review middleware logs
- Test in local environment before production

### Future Enhancements

Potential improvements:
- Multi-password support (different passwords for different user groups)
- Scheduled maintenance mode (auto-enable at specific times)
- Maintenance status API endpoint
- Email notifications when maintenance mode activates
- Analytics tracking for unlock attempts

---

## 📄 License

Part of Fine & Country Zimbabwe ERP - Internal use only

---

**Last Updated**: February 6, 2026  
**Implemented by**: GitHub Copilot (Claude Sonnet 4.5)  
**Status**: ✅ Production Ready
