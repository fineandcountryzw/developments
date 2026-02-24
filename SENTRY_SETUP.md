# Sentry Error Tracking Setup

## ✅ Setup Complete

Sentry has been integrated into your Next.js application for comprehensive error tracking and monitoring.

## 📋 What Was Configured

### 1. **Sentry Packages**
- ✅ `@sentry/nextjs` installed

### 2. **Configuration Files**
- ✅ `sentry.client.config.ts` - Client-side error tracking
- ✅ `sentry.server.config.ts` - Server-side error tracking  
- ✅ `sentry.edge.config.ts` - Edge runtime error tracking
- ✅ `instrumentation.ts` - Auto-initialization

### 3. **Integration Points**
- ✅ `lib/logger.ts` - Logger automatically sends errors to Sentry
- ✅ `components/ErrorBoundary.tsx` - React error boundary integration
- ✅ `app/error.tsx` - Next.js error page integration
- ✅ `next.config.mjs` - Sentry webpack plugin configured

## 🔧 Environment Variables

Add these to your `.env` files:

```bash
# Sentry Error Tracking
SENTRY_DSN="https://your-sentry-dsn@sentry.io/PROJECT_ID"
NEXT_PUBLIC_SENTRY_DSN="https://your-sentry-dsn@sentry.io/PROJECT_ID"
SENTRY_RELEASE="fine-and-country-erp@0.0.0"
NEXT_PUBLIC_SENTRY_RELEASE="fine-and-country-erp@0.0.0"

# Optional: Sentry organization and project (for source maps)
SENTRY_ORG="your-org"
SENTRY_PROJECT="your-project"
```

## 🚀 Getting Your Sentry DSN

1. **Sign up** at [sentry.io](https://sentry.io)
2. **Create a project** (select Next.js)
3. **Copy your DSN** from Project Settings → Client Keys
4. **Add to `.env`** files

## 📊 Features Enabled

### Error Tracking
- ✅ Automatic error capture from:
  - API routes
  - Server components
  - Client components
  - Error boundaries
  - Unhandled promise rejections

### Performance Monitoring
- ✅ Transaction tracking (10% sample rate in production)
- ✅ Performance profiling (10% sample rate in production)
- ✅ API route performance
- ✅ Page load performance

### Context & Metadata
- ✅ User context (when available)
- ✅ Request context
- ✅ Custom tags (module, action)
- ✅ Breadcrumbs

### Security
- ✅ Sensitive data filtering
- ✅ Authorization headers removed
- ✅ Password fields filtered
- ✅ Cookie values removed

## 🎯 Usage

### Automatic Error Tracking

Errors are automatically captured when:
- Using `logger.error()` - Sentry integration built-in
- React Error Boundary catches errors
- Next.js error page is triggered
- Unhandled promise rejections occur

### Manual Error Reporting

```typescript
import * as Sentry from '@sentry/nextjs';

// Capture exception
try {
  // risky code
} catch (error) {
  Sentry.captureException(error, {
    tags: { module: 'MyModule', action: 'MyAction' },
    extra: { customData: 'value' },
  });
}

// Capture message
Sentry.captureMessage('Something went wrong', 'warning');

// Set user context
Sentry.setUser({ id: '123', email: 'user@example.com' });

// Add breadcrumb
Sentry.addBreadcrumb({
  message: 'User clicked button',
  category: 'ui',
  level: 'info',
});
```

## 📈 Monitoring Dashboard

Once configured, visit your Sentry dashboard to:
- View real-time error reports
- See error trends and frequency
- Analyze performance metrics
- Set up alerts for critical errors
- Track releases and deployments

## 🔍 Filtering & Ignoring

### Ignored Errors (Already Configured)
- Browser extension errors
- Network errors (handled gracefully)
- Chrome extension URLs
- Common non-critical errors

### Custom Filtering

Edit `sentry.client.config.ts` or `sentry.server.config.ts` to:
- Add more ignored errors
- Customize `beforeSend` hook
- Adjust sample rates
- Configure release tracking

## 🧪 Testing

### Test Error Tracking

1. **Create a test error**:
```typescript
// In any component or API route
throw new Error('Test Sentry integration');
```

2. **Check Sentry dashboard** - Error should appear within seconds

3. **Verify context** - Check that tags, breadcrumbs, and user data are included

## 📝 Next Steps

1. ✅ Add Sentry DSN to environment variables
2. ✅ Deploy and monitor errors
3. ✅ Set up alerts for critical errors
4. ✅ Configure release tracking
5. ✅ Set up performance monitoring dashboards

## 🔗 Resources

- [Sentry Next.js Docs](https://docs.sentry.io/platforms/javascript/guides/nextjs/)
- [Sentry Dashboard](https://sentry.io)
- [Error Tracking Best Practices](https://docs.sentry.io/product/issues/)

---

**Status:** ✅ Ready to use (add DSN to enable)
