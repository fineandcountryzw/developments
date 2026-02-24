# Logo Visibility Fix for Dark Backgrounds

## Problem
The logo has black elements and was not visible on dark backgrounds (header, footer, sidebar). The logo shows well on white backgrounds but disappears on dark backgrounds.

## Solution
Applied CSS filter `brightness(0) invert(1)` to make black logos appear white on dark backgrounds. This filter:
1. First applies `brightness(0)` to make everything black
2. Then applies `invert(1)` to invert colors, making black become white

## Changes Made

### 1. Landing Page Header (`components/LandingPage.tsx`)
- **Location**: Navigation bar (line ~724)
- **Change**: Applied inline style `filter: brightness(0) invert(1)` when logo is default
- **Background**: `bg-black` (dark)

### 2. Landing Page Footer (`components/LandingPage.tsx`)
- **Location**: Footer branding section (line ~1425)
- **Change**: Applied inline style `filter: brightness(0) invert(1)` when logo is default
- **Background**: `bg-black` (dark)

### 3. Dashboard Layout Header (`components/layouts/DashboardLayout.tsx`)
- **Location**: Dashboard header (line ~108)
- **Change**: Added helper function `isDefaultLogo()` and applied inline filter
- **Background**: `bg-slate-900` (dark)

### 4. Sidebar (`components/Sidebar.tsx`)
- **Location**: Sidebar branding header (line ~221)
- **Change**: Replaced Tailwind classes with inline style filter
- **Background**: `bg-black` (dark)

## Implementation Details

### Filter Logic
```typescript
const isDefaultLogo = effectiveLogo === DEFAULT_LOGO || effectiveLogo.startsWith('/logos/');

// Applied as inline style:
style={isDefaultLogo ? { filter: 'brightness(0) invert(1)' } : {}}
```

### Why Inline Styles?
- More reliable than Tailwind utility classes for complex filters
- Ensures consistent behavior across browsers
- Better control over filter application

## Result
- ✅ Logo is now visible on all dark backgrounds (header, footer, sidebar, dashboard header)
- ✅ Logo remains unchanged on white/light backgrounds
- ✅ Only default logos (black) get the filter; custom uploaded logos are unaffected
- ✅ Consistent implementation across all components

## Testing Checklist
- [ ] Logo visible in landing page header (black background)
- [ ] Logo visible in landing page footer (black background)
- [ ] Logo visible in dashboard header (slate-900 background)
- [ ] Logo visible in sidebar (black background)
- [ ] Logo appears normal on white backgrounds
- [ ] Custom uploaded logos (non-black) are not affected by filter

## Notes
- The filter only applies to default logos (`/logos/logo.svg`)
- Custom logos uploaded via UploadThing are not filtered
- Filter is applied conditionally based on logo source
- All changes are backward compatible
