# Development Overview Image Audit

**Date:** 2026-01-28  
**Issue:** Large hero image disturbing development overview visibility

---

## 🔍 FINDINGS

### Issue Identified
**Location:** `components/DevelopmentDetailView.tsx` (Line 241)

**Problem:**
- Hero image gallery has fixed height: `h-[500px]` (500 pixels)
- This large image takes up significant viewport space, especially on mobile devices
- Overview content is pushed down below the image, requiring scroll to see
- On smaller screens, 500px can be 50-70% of viewport height

**Current Structure:**
```tsx
{/* Hero Image Gallery */}
<div className="relative w-full h-[500px] bg-slate-900">
  {/* Large image with overlay */}
</div>

{/* Content starts here - Overview Card */}
<div className="max-w-7xl mx-auto px-6 py-12">
  <div className="bg-white rounded-2xl border border-gray-200 p-8 shadow-lg">
    <h2>Overview</h2>
    {/* Overview content */}
  </div>
</div>
```

### Impact
1. **Mobile UX:** 500px image on mobile (typically 800-900px viewport) = ~55-60% of screen
2. **Content Visibility:** Users must scroll past large image to see overview
3. **Overview Text:** If `development.overview` exists, it's buried below the image
4. **First Impression:** Image dominates, overview text gets less attention

---

## 🎯 RECOMMENDED FIXES

### Option 1: Responsive Height (Recommended)
Make image height responsive - smaller on mobile, larger on desktop:
- Mobile: `h-[250px]` or `h-[300px]` (25-30% of viewport)
- Tablet: `h-[400px]` 
- Desktop: `h-[500px]` (current)

### Option 2: Reduce Fixed Height
Reduce to `h-[350px]` or `h-[400px]` across all devices

### Option 3: Use Aspect Ratio
Use `aspect-[16/9]` or `aspect-[21/9]` instead of fixed height for better responsiveness

---

## 📋 IMPLEMENTATION PLAN

### P0 (Critical - Implement Now)
1. **Make hero image responsive**
   - Change `h-[500px]` to responsive classes
   - Use Tailwind responsive breakpoints

2. **Ensure overview is visible above fold**
   - Consider reducing image height on mobile
   - Or add overview preview in hero overlay

### P1 (Nice to Have)
1. Add overview text excerpt in hero overlay (if space allows)
2. Make image collapsible/expandable
3. Add "Skip to Overview" link/button

---

## 🔧 FILES TO MODIFY

1. `components/DevelopmentDetailView.tsx`
   - Line 241: Change hero image height to responsive

---

## ✅ ACCEPTANCE CRITERIA

- [ ] Hero image height is responsive (smaller on mobile)
- [ ] Overview content is visible without excessive scrolling
- [ ] Image maintains aspect ratio and doesn't distort
- [ ] No layout shifts or visual regressions
- [ ] Works on mobile, tablet, and desktop
