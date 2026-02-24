# Production URL Configuration Guide

**Status:** ✅ Production-Ready for fineandcountryerp.com
**Last Updated:** January 2, 2026

---

## Overview

This guide documents the URL configuration for Fine & Country Zimbabwe ERP production deployment at **https://fineandcountryerp.com**.

### Key Points

- ✅ All API endpoints use **relative paths** (`/api/...`) - automatically work across domains
- ✅ All static assets use **relative paths** (`/logos/...`, `/favicon.svg`)
- ✅ Production domain configured in `.env.production`
- ✅ Canonical URLs implemented for SEO
- ✅ URL redirects configured for old routes
- ✅ Security headers added to all responses
- ✅ Open Graph and Twitter meta tags for social sharing

---

## 1. URL Routing Configuration

### Environment Variables (.env.production)

```dotenv
# Production domain - used for canonical URLs and external links
NEXT_PUBLIC_APP_URL="https://fineandcountryerp.com"

# API base URL for external requests
NEXT_PUBLIC_API_BASE_URL="https://fineandcountryerp.com/api"

# Email domain
NEXT_PUBLIC_EMAIL_DOMAIN="fineandcountryerp.com"
```

### How It Works

1. **Internal API Calls:** All client-side API calls use relative paths
   ```typescript
   // ✅ Correct - automatically works on any domain
   fetch('/api/admin/developments')
   fetch('/api/admin/contracts')
   ```

2. **External Requests:** Use the full URL from environment variables
   ```typescript
   import { API_BASE_URL } from '@/lib/url-utils';
   
   // For server-side requests or webhooks
   const url = `${API_BASE_URL}/admin/developments`;
   ```

3. **Static Assets:** All use relative paths from `/public` directory
   ```typescript
   // ✅ Correct - relative paths
   <img src="/logos/logo-harare.svg" alt="Logo" />
   <img src="/favicon.svg" alt="Favicon" />
   ```

---

## 2. URL Redirects (next.config.mjs)

### Configured Redirects

| Source | Destination | Type | Reason |
|--------|-------------|------|--------|
| `/admin` | `/dashboards/manager` | 302 (Temporary) | Convenience redirect |
| `/agent-dashboard` | `/dashboards/agent` | 302 (Temporary) | Convenience redirect |
| `/client-dashboard` | `/dashboards/client` | 302 (Temporary) | Convenience redirect |
| `/agreements/*` | `/contracts/*` | 301 (Permanent) | Module consolidation |

### Adding New Redirects

To add a redirect, edit `next.config.mjs`:

```typescript
async redirects() {
  return [
    {
      source: '/old-path',
      destination: '/new-path',
      permanent: true,  // 301 (Permanent) or false for 302 (Temporary)
    },
  ];
}
```

### Important Notes

- **Permanent (301):** Use for SEO-important redirects (module changes, deprecated paths)
- **Temporary (302):** Use for convenience shortcuts that may change

---

## 3. Canonical URLs for SEO

### Layout Implementation

The root layout (`app/layout.tsx`) includes:

```typescript
// Canonical URL for main domain
<link rel="canonical" href="https://fineandcountryerp.com" />

// Alternate language versions
<link rel="alternate" hrefLang="en-ZW" href="https://fineandcountryerp.com" />
```

### Per-Page Canonical URLs

For individual pages that need unique canonical URLs:

```typescript
import { getCanonicalUrl } from '@/lib/url-utils';

export const metadata: Metadata = {
  title: "Developments",
  description: "View all developments",
  alternates: {
    canonical: getCanonicalUrl('/developments'),
  },
};
```

### Why Canonical URLs Matter

- Prevents duplicate content penalties from search engines
- Consolidates page ranking signals
- Clarifies the "preferred" version of a page
- Improves SEO performance

---

## 4. Open Graph & Twitter Meta Tags

### Current Configuration

**Root Layout Meta Tags:**

```typescript
openGraph: {
  type: 'website',
  url: 'https://fineandcountryerp.com',
  title: "Fine & Country Zimbabwe ERP",
  description: "Enterprise Resource Planning solution...",
  siteName: "Fine & Country Zimbabwe ERP",
  locale: 'en_ZW',
},

twitter: {
  card: 'summary_large_image',
  title: "Fine & Country Zimbabwe ERP",
  description: "Enterprise Resource Planning...",
}
```

### Social Sharing Benefits

- Enables rich previews when links are shared on social media
- Improves click-through rates on social platforms
- Controls how content appears on Facebook, Twitter, LinkedIn, etc.
- Uses locale `en_ZW` for Zimbabwe region targeting

### Using URL Utils for Dynamic OG Tags

```typescript
import { generateOpenGraphTags, generateTwitterTags } from '@/lib/url-utils';

const ogTags = generateOpenGraphTags({
  title: "Development Details",
  description: "View development information",
  url: getCanonicalUrl('/developments/123'),
});
```

---

## 5. Static Assets Configuration

### Public Directory Structure

```
/public/
  ├── favicon.svg              # Browser tab icon
  ├── logos/
  │   ├── logo-harare.svg      # Harare branch logo
  │   └── logo-bulawayo.svg    # Bulawayo branch logo
  ├── og-image.png             # OpenGraph sharing image
  └── twitter-image.png        # Twitter card image
```

### Asset References

**Always use relative paths:**

```typescript
// ✅ Correct
<img src="/logos/logo-harare.svg" alt="Harare Logo" />

// ❌ Avoid absolute URLs
<img src="https://fineandcountryerp.com/logos/logo-harare.svg" alt="Harare Logo" />
```

### Asset Optimization

- Assets are served from CDN in production
- Use Next.js Image component for optimization:
  ```typescript
  import Image from 'next/image';
  
  <Image src="/logos/logo-harare.svg" alt="Logo" width={200} height={200} />
  ```

---

## 6. Security Headers Configuration

### Implemented Headers

| Header | Value | Purpose |
|--------|-------|---------|
| `X-Content-Type-Options` | `nosniff` | Prevents MIME-type sniffing attacks |
| `X-Frame-Options` | `SAMEORIGIN` | Prevents clickjacking attacks |
| `X-XSS-Protection` | `1; mode=block` | Enables browser XSS protection |
| `Referrer-Policy` | `strict-origin-when-cross-origin` | Controls referrer information |

### CORS Configuration

API endpoints allow:
- **Methods:** GET, POST, PUT, DELETE, OPTIONS, PATCH
- **Headers:** All standard headers including Authorization
- **Origin:** All origins (`*` for public endpoints, restrict as needed)

---

## 7. API Endpoint URLs

### Relative Paths (Recommended for Client)

All frontend API calls use relative paths:

```typescript
// ✅ Works on any domain
await fetch('/api/admin/developments');
await fetch('/api/admin/contracts');
await fetch('/api/admin/settings?branch=Harare');
```

### Full URLs (For Server or External Services)

For server-side requests or webhooks, use full URLs:

```typescript
import { API_BASE_URL } from '@/lib/url-utils';

const response = await fetch(`${API_BASE_URL}/admin/developments`, {
  headers: { 'Authorization': `Bearer ${token}` }
});
```

### API Endpoints List

| Endpoint | Purpose |
|----------|---------|
| `/api/admin/developments` | CRUD operations for developments |
| `/api/admin/contracts` | Contract management |
| `/api/admin/settings` | Branch settings including logos |
| `/api/admin/agents` | Agent management |
| `/api/admin/clients` | Client management |
| `/api/analytics/*` | Analytics data endpoints |
| `/api/cron/*` | Scheduled job endpoints |

---

## 8. Email Configuration

### Email Domain

```
From: noreply@fineandcountryerp.com
Reply-To: portal@fineandcountryerp.com
Domain: fineandcountryerp.com
```

### Email Templates

All email templates should include:
- Logo from `/logos/` directory
- Links using relative paths
- Canonical footer with production URL

---

## 9. Testing URL Configuration

### Local Development

```bash
# Development (.env.local)
NEXT_PUBLIC_APP_URL="http://localhost:3000"
NEXT_PUBLIC_API_BASE_URL="http://localhost:3000/api"

# Run development server
npm run dev
# Visit: http://localhost:3000
```

### Staging Environment

```bash
# Staging (.env.staging)
NEXT_PUBLIC_APP_URL="https://staging.fineandcountryerp.com"
NEXT_PUBLIC_API_BASE_URL="https://staging.fineandcountryerp.com/api"
```

### Production

```bash
# Production (.env.production)
NEXT_PUBLIC_APP_URL="https://fineandcountryerp.com"
NEXT_PUBLIC_API_BASE_URL="https://fineandcountryerp.com/api"
```

### Verification Checklist

- [ ] All API calls use relative paths `/api/...`
- [ ] All static assets use relative paths `/logos/...`
- [ ] Canonical URLs present in metadata
- [ ] Open Graph tags configured correctly
- [ ] Twitter Card tags present
- [ ] Security headers sent with all responses
- [ ] Redirects working correctly
- [ ] 404 pages styled and functional
- [ ] SSL/TLS certificate valid
- [ ] DNS records pointing to correct server

---

## 10. Common URL Mistakes & Fixes

### ❌ Mistake 1: Hardcoded Domain Names

```typescript
// ❌ Wrong
const url = 'https://localhost:3000/api/developments';

// ✅ Correct
const url = '/api/developments';
```

### ❌ Mistake 2: Absolute Asset Paths

```typescript
// ❌ Wrong
<img src="https://fineandcountryerp.com/logos/logo.svg" />

// ✅ Correct
<img src="/logos/logo.svg" />
```

### ❌ Mistake 3: Missing Canonical URLs

```typescript
// ❌ Wrong - No canonical URL
export const metadata: Metadata = {
  title: "Page",
};

// ✅ Correct
export const metadata: Metadata = {
  title: "Page",
  alternates: {
    canonical: getCanonicalUrl('/page'),
  },
};
```

### ❌ Mistake 4: Incorrect Redirects

```typescript
// ❌ Wrong - Permanent redirect for temporary route
{
  source: '/admin',
  destination: '/dashboards/manager',
  permanent: true,  // ← Should be false (302)
}

// ✅ Correct
{
  source: '/admin',
  destination: '/dashboards/manager',
  permanent: false,  // ← Temporary redirect
}
```

---

## 11. Monitoring & Maintenance

### URL Audit Script

Check for broken links:

```bash
# Using Screaming Frog (recommended)
# Download: https://www.screamingfrog.co.uk/seo-spider/

# Or using curl
curl -I https://fineandcountryerp.com
curl -I https://fineandcountryerp.com/api/admin/developments

# Check redirects
curl -L -I https://fineandcountryerp.com/admin
```

### Performance Monitoring

- Use Google Search Console to monitor crawl errors
- Check Core Web Vitals in PageSpeed Insights
- Monitor 404 errors in server logs
- Track redirect chains with SEO tools

---

## 12. Deployment Checklist

- [ ] `.env.production` updated with domain
- [ ] `next.config.mjs` redirects configured
- [ ] `app/layout.tsx` canonical URLs in place
- [ ] Open Graph & Twitter tags present
- [ ] Static assets in `/public` directory
- [ ] All API calls use relative paths
- [ ] Security headers configured
- [ ] SSL certificate installed
- [ ] DNS records pointing to server
- [ ] Build succeeds: `npm run build`
- [ ] No console errors or warnings
- [ ] URLs verified in production

---

## 13. URL Utilities (lib/url-utils.ts)

Helper functions available:

```typescript
import { 
  getCanonicalUrl,           // Generate canonical URL
  getApiUrl,                 // Generate API URL
  getAssetUrl,               // Generate asset URL
  getEmailDomain,            // Get email domain
  isValidUrl,                // Validate URL format
  generateOpenGraphTags,     // Generate OG tags
  generateTwitterTags,       // Generate Twitter tags
  normalizeInternalUrl,      // Normalize internal links
  getUrlConfig,              // Get config for environment
} from '@/lib/url-utils';
```

---

## Summary

The Fine & Country Zimbabwe ERP is **fully configured for production at fineandcountryerp.com** with:

✅ Proper environment variable configuration  
✅ Relative paths for all internal resources  
✅ Canonical URLs for SEO  
✅ Social sharing meta tags  
✅ Security headers  
✅ URL redirects for old routes  
✅ Comprehensive utilities for URL management  

All URLs are **production-ready** and follow Next.js best practices.
