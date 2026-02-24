# Phase 5A: Admin Navigation Integration Guide

## Overview

This guide explains how to integrate the Payment Automation Control Panel into your admin navigation menu.

## Prerequisites

All Phase 5A files should be created:
- ✅ 3 API endpoints in `/app/api/admin/payment-automation/*`
- ✅ 4 React components in `/components/admin/`
- ✅ Admin page at `/app/admin/payment-automation/page.tsx`

## Integration Steps

### Step 1: Find Admin Navigation Component

Search for the admin layout or navigation component (typically one of):
- `components/layouts/AdminLayout.tsx`
- `components/navigation/AdminNav.tsx`
- `app/admin/layout.tsx`
- `components/Sidebar.tsx`

### Step 2: Add Menu Item

Add the following menu item to your admin navigation:

```tsx
// In your admin navigation component

import Link from 'next/link';
import { Mail } from 'lucide-react'; // or your icon library

export function AdminNavigation() {
  return (
    <nav>
      {/* ... other menu items ... */}
      
      {/* Payment Automation Control Panel */}
      <Link
        href="/admin/payment-automation"
        className="flex items-center gap-2 px-4 py-2 rounded-lg hover:bg-gray-100"
      >
        <Mail className="w-5 h-5" />
        <span>Payment Automation</span>
      </Link>
      
      {/* ... other menu items ... */}
    </nav>
  );
}
```

### Step 3: Add to Sidebar (if using one)

If you have a sidebar navigation:

```tsx
const sidebarItems = [
  // ... other items ...
  {
    label: 'Payment Automation',
    href: '/admin/payment-automation',
    icon: Mail,
    category: 'Automation',
  },
  // ... other items ...
];
```

### Step 4: Verify Route Exists

Ensure the route file exists:
```bash
ls -la app/admin/payment-automation/page.tsx
```

Should output the page.tsx file we created.

### Step 5: Test Navigation

1. Start the dev server: `npm run dev`
2. Login as admin
3. Navigate to the admin panel
4. Click the "Payment Automation" menu item
5. Should load the admin dashboard

## Optional: Add to Command Center

If you have a command center/quick navigation:

```tsx
// In your command center component

const commands = [
  // ... other commands ...
  {
    id: 'payment-automation',
    label: 'Payment Automation',
    description: 'Manage email reminders and escalations',
    category: 'Admin',
    action: () => router.push('/admin/payment-automation'),
  },
  // ... other commands ...
];
```

## Optional: Add to Admin Dashboard Shortcuts

Add a quick access card to your main admin dashboard:

```tsx
// In AdminDashboard.tsx or similar

<Card className="hover:shadow-lg transition-shadow">
  <Link href="/admin/payment-automation">
    <CardHeader className="cursor-pointer">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Mail className="w-5 h-5 text-blue-600" />
          <CardTitle>Payment Automation</CardTitle>
        </div>
        <ArrowRight className="w-4 h-4" />
      </div>
      <CardDescription>
        Manage automated email reminders and escalations
      </CardDescription>
    </CardHeader>
    <CardContent>
      <p className="text-sm text-gray-600">
        Control email frequency, customize templates, and monitor delivery
      </p>
    </CardContent>
  </Link>
</Card>
```

## Navigation Menu Examples

### Example 1: Sidebar Navigation

```tsx
const adminMenu = [
  {
    category: 'Dashboard',
    items: [
      { label: 'Overview', href: '/admin' },
    ],
  },
  {
    category: 'Automation',
    items: [
      { 
        label: 'Payment Automation',
        href: '/admin/payment-automation',
        icon: Mail,
      },
    ],
  },
  {
    category: 'Tools',
    items: [
      { label: 'Diagnostics', href: '/admin/diagnostics' },
      { label: 'Command Center', href: '/admin/command-center' },
    ],
  },
];
```

### Example 2: Dropdown Menu

```tsx
<DropdownMenu>
  <DropdownMenuTrigger>Automation</DropdownMenuTrigger>
  <DropdownMenuContent>
    <DropdownMenuItem asChild>
      <Link href="/admin/payment-automation">
        Payment Automation
      </Link>
    </DropdownMenuItem>
    <DropdownMenuItem asChild>
      <Link href="/admin/payment-automation/logs">
        Email Logs
      </Link>
    </DropdownMenuItem>
  </DropdownMenuContent>
</DropdownMenu>
```

### Example 3: Breadcrumb Navigation

```tsx
<Breadcrumb>
  <BreadcrumbItem>
    <Link href="/admin">Admin</Link>
  </BreadcrumbItem>
  <BreadcrumbSeparator />
  <BreadcrumbItem>
    <Link href="/admin/payment-automation">Payment Automation</Link>
  </BreadcrumbItem>
</Breadcrumb>
```

## URL Structure

The payment automation control panel is accessible at:

```
/admin/payment-automation          Main dashboard
/admin/payment-automation/logs     Email activity logs
/admin/payment-automation/settings Admin settings form
```

Note: These are tabs within the main page, not separate pages.

## API Endpoints Available

For integrating with custom dashboards:

```
GET /api/admin/payment-automation/settings
POST /api/admin/payment-automation/settings
GET /api/admin/payment-automation/logs
POST /api/admin/payment-automation/test-email
```

See **PHASE_5A_QUICK_REFERENCE.md** for API examples.

## Access Control

The page automatically checks:
1. User is logged in (NextAuth session)
2. User has admin role

Non-admin users are redirected to login page.

```tsx
// In app/admin/payment-automation/page.tsx

const session = await getServerSession();
if (!session || session.user?.role !== 'admin') {
  redirect('/auth/signin');
}
```

## Testing the Integration

### Checklist
- [ ] Admin menu item is visible
- [ ] Menu item links to `/admin/payment-automation`
- [ ] Page loads when clicked
- [ ] Admin can see dashboard
- [ ] Non-admin users are redirected
- [ ] Settings can be viewed and updated
- [ ] Email logs can be viewed and filtered
- [ ] Test email modal works

### Quick Test Commands

```bash
# Start dev server
npm run dev

# In another terminal, test the endpoint
curl http://localhost:3000/api/admin/payment-automation/settings \
  -H "Authorization: Bearer YOUR_SESSION_TOKEN"
```

## Troubleshooting Integration

### Issue: Menu Item Not Showing
- Verify route exists: `ls app/admin/payment-automation/page.tsx`
- Check if sidebar component is rendering correctly
- Verify you're logged in as admin

### Issue: 404 When Clicking Menu Item
- Check that page.tsx file exists in correct location
- Verify file syntax is correct
- Restart dev server: `npm run dev`

### Issue: Access Denied / Redirected to Login
- Verify you're logged in as admin
- Check `role` field in your session object
- Ensure NextAuth is configured correctly

### Issue: Dashboard Not Loading
- Check browser console for errors (F12)
- Check network tab for failed API calls
- Verify database connection
- Check server logs for backend errors

## Menu Item Styling

### Example with Tailwind CSS

```tsx
<Link
  href="/admin/payment-automation"
  className={`
    flex items-center gap-3 px-4 py-2 rounded-lg
    transition-colors duration-200
    hover:bg-gray-100 dark:hover:bg-gray-800
    text-gray-700 dark:text-gray-300
    ${isActive ? 'bg-blue-50 text-blue-600 dark:bg-blue-900' : ''}
  `}
>
  <Mail className="w-5 h-5" />
  <span>Payment Automation</span>
</Link>
```

### With Badge for Active Users

```tsx
<Link
  href="/admin/payment-automation"
  className="flex items-center justify-between px-4 py-2 rounded-lg hover:bg-gray-100"
>
  <div className="flex items-center gap-2">
    <Mail className="w-5 h-5" />
    <span>Payment Automation</span>
  </div>
  {/* Badge showing if automation is active */}
  <Badge variant="success">Active</Badge>
</Link>
```

## Next Steps

1. Add menu item to admin navigation
2. Test the link works
3. Verify access control
4. Add styling to match your admin theme
5. Consider adding to quick access shortcuts
6. Test with different user roles

## Files Modified

- Your admin navigation component (sidebar, menu, etc.)

## Files Not Modified

- `/app/admin/payment-automation/page.tsx` - Already created
- All API endpoints - Already created
- All React components - Already created

## Documentation Files

For more information, see:
- **PHASE_5A_ADMIN_CONTROL_PANEL.md** - Complete documentation
- **PHASE_5A_QUICK_REFERENCE.md** - Quick reference guide
- **PHASE_5A_COMPLETION_SUMMARY.md** - Implementation summary

---

**Integration Guide Version**: 1.0
**Status**: Ready to implement
**Difficulty**: Easy (5-10 minutes)
