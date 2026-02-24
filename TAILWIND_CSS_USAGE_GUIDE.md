# Tailwind CSS & Design System Usage Guide

**Project**: Fine & Country Zimbabwe ERP
**Design Framework**: Tailwind CSS + Inter Font + Utility-First
**Version**: 1.0
**Date**: December 30, 2025

## Quick Start: Using the Design System

### 1. Typography Patterns

#### Headings
```tsx
// Main Heading (h1-style)
<h1 className="text-3xl font-black text-fcSlate tracking-tight">
  Page Title
</h1>

// Subheading (h2-style)
<h2 className="text-lg font-black text-fcSlate tracking-tight">
  Section Title
</h2>

// Small Heading (h3-style)
<h3 className="text-base font-black text-fcSlate font-sans">
  Card Title
</h3>
```

#### Body Text
```tsx
// Primary Body
<p className="text-sm text-slate-600">
  Main content paragraph
</p>

// Secondary Text
<span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
  Label or metadata
</span>
```

---

### 2. Card Components

#### Standard Card
```tsx
<div className="bg-white rounded-2xl border border-fcDivider p-6 shadow-sm">
  <h3 className="text-lg font-black text-fcSlate mb-4">Title</h3>
  {/* content */}
</div>
```

#### Status Card (Colored)
```tsx
// Orange (Warning/Pending)
<div className="p-4 bg-orange-50 rounded-xl border border-orange-200">
  <div className="text-[10px] font-black text-orange-600 uppercase">Label</div>
  <div className="text-2xl font-black text-orange-700">$15,000</div>
</div>

// Green (Success/Paid)
<div className="p-4 bg-green-50 rounded-xl border border-green-200">
  <div className="text-[10px] font-black text-green-600 uppercase">Label</div>
  <div className="text-2xl font-black text-green-700">$35,000</div>
</div>

// Blue (Info)
<div className="p-4 bg-blue-50 rounded-xl border border-blue-200">
  <div className="text-[10px] font-black text-blue-600 uppercase">Label</div>
  <div className="text-2xl font-black text-blue-700">December 2025</div>
</div>
```

---

### 3. Layout Patterns

#### Grid Layouts
```tsx
// 3-Column Grid (responsive)
<div className="grid grid-cols-1 md:grid-cols-3 gap-4">
  {/* cards */}
</div>

// 2-Column Grid (responsive)
<div className="grid grid-cols-1 md:grid-cols-2 gap-6">
  {/* items */}
</div>

// Single Column
<div className="grid grid-cols-1 gap-6">
  {/* items */}
</div>
```

#### Flexbox Layouts
```tsx
// Horizontal Layout with spacing
<div className="flex items-center justify-between gap-4">
  {/* content */}
</div>

// Vertical Stack
<div className="flex flex-col space-y-4">
  {/* items */}
</div>

// Centered
<div className="flex items-center justify-center">
  {/* content */}
</div>
```

#### Spacing Utilities
```tsx
// Grouped vertical spacing
<div className="space-y-2">
  <p>Item 1</p>
  <p>Item 2</p>
  <p>Item 3</p>
</div>

// Grouped horizontal spacing
<div className="flex space-x-4">
  <button>Action 1</button>
  <button>Action 2</button>
</div>
```

---

### 4. Color Usage

#### Brand Colors
```tsx
// Primary Brand Color (Gold)
className="text-fcGold"           // Text
className="bg-fcGold/10"          // Light background
className="border-fcGold"         // Border

// Slate (Dark Text)
className="text-fcSlate"          // Headings
className="bg-fcSlate"            // Backgrounds (rare)

// Divider (Borders)
className="border-fcDivider"      // Card borders
className="bg-slate-50"           // Subtle backgrounds
```

#### Status Colors
```tsx
// Success (Green)
className="text-green-700"        // Text
className="bg-green-50"           // Light background
className="border-green-200"      // Border
className="text-green-600"        // Label text

// Warning (Orange)
className="text-orange-700"       // Text
className="bg-orange-50"          // Light background
className="border-orange-200"     // Border
className="text-orange-600"       // Label text

// Info (Blue)
className="text-blue-700"         // Text
className="bg-blue-50"            // Light background
className="border-blue-200"       // Border
className="text-blue-600"         // Label text
```

---

### 5. Spacing Scale

#### Padding
```tsx
className="p-3"   // Small (12px)
className="p-4"   // Standard (16px)
className="p-6"   // Medium (24px)
className="p-8"   // Large (32px)
className="p-10"  // Extra Large (40px)
className="p-12"  // Huge (48px)
```

#### Margin
```tsx
className="m-1"   // Tiny (4px)
className="m-2"   // Small (8px)
className="m-4"   // Medium (16px)
className="m-6"   // Large (24px)
```

#### Gaps
```tsx
className="gap-2" // 8px gap
className="gap-4" // 16px gap
className="gap-6" // 24px gap
```

---

### 6. Border & Radius

#### Border Radius
```tsx
className="rounded-2xl"  // Large (16px) - Cards
className="rounded-xl"   // Medium (12px) - Inputs, icons
className="rounded-lg"   // Small (8px) - Small elements
className="rounded-full" // Circular (50%)
```

#### Borders
```tsx
// Light border (default)
className="border border-fcDivider"

// Status borders
className="border border-orange-200"
className="border border-green-200"
className="border border-blue-200"

// Thick border (rare)
className="border-2 border-fcGold"
```

#### Shadows
```tsx
className="shadow-sm"   // Subtle (light cards)
className="shadow-md"   // Normal (interactive)
className="shadow-lg"   // Large (modals)
```

---

### 7. Responsive Design

#### Mobile-First Pattern
```tsx
// Base styles = mobile, add md: for tablet+
className="w-full md:w-1/2 p-4 md:p-6"

// Grid that stacks on mobile
className="grid grid-cols-1 md:grid-cols-3 gap-4"

// Flex that stacks on mobile
className="flex flex-col md:flex-row items-start md:items-center"

// Text that changes size
className="text-sm md:text-base text-[10px] md:text-xs"
```

#### Responsive Examples
```tsx
// Button
<button className="w-full md:w-auto px-6 py-3">
  Click me
</button>

// Section
<section className="px-4 md:px-6 lg:px-8">
  {/* content */}
</section>

// Typography
<h1 className="text-2xl md:text-3xl lg:text-4xl">
  Responsive Heading
</h1>
```

---

### 8. Interactive States

#### Hover States
```tsx
<button className="bg-fcGold text-white hover:bg-fcGold/90 transition-all">
  Hover me
</button>
```

#### Focus States
```tsx
<input className="border border-slate-300 focus:border-fcGold focus:ring focus:ring-fcGold/10" />
```

#### Transitions
```tsx
<div className="transition-all duration-300">
  Smooth animation
</div>

// Progress bar animation
<div className="transition-all duration-500 ease-in-out" style={{width: `${percentage}%`}}>
  {/* bar */}
</div>
```

---

### 9. Real-World Examples

#### Financial Summary Card
```tsx
<div className="grid grid-cols-1 md:grid-cols-3 gap-4">
  {/* Outstanding Balance */}
  <div className="p-4 bg-orange-50 rounded-xl border border-orange-200">
    <div className="text-[10px] font-black text-orange-600 uppercase tracking-widest mb-2">
      Outstanding Balance
    </div>
    <div className="text-2xl font-black text-orange-700">
      $15,000
    </div>
    <div className="text-[9px] text-orange-600 font-bold mt-1">
      30% remaining
    </div>
  </div>

  {/* Total Payments */}
  <div className="p-4 bg-green-50 rounded-xl border border-green-200">
    <div className="text-[10px] font-black text-green-600 uppercase tracking-widest mb-2">
      Total Payments
    </div>
    <div className="text-2xl font-black text-green-700">
      $35,000
    </div>
    <div className="text-[9px] text-green-600 font-bold mt-1">
      70% paid
    </div>
  </div>

  {/* Period */}
  <div className="p-4 bg-blue-50 rounded-xl border border-blue-200">
    <div className="text-[10px] font-black text-blue-600 uppercase tracking-widest mb-2">
      Statement Period
    </div>
    <div className="text-2xl font-black text-blue-700">
      Dec 2025
    </div>
    <div className="text-[9px] text-blue-600 font-bold mt-1">
      5 transactions
    </div>
  </div>
</div>
```

#### Portfolio Card with Stand ID
```tsx
<div className="flex items-center justify-between p-6 bg-slate-50/50 rounded-2xl border border-fcDivider">
  <div className="flex items-center space-x-6">
    {/* Icon */}
    <div className="p-4 bg-white rounded-xl border border-fcDivider">
      <MapPin size={24} className="text-fcGold" />
    </div>

    {/* Info */}
    <div className="space-y-1">
      <div className="text-base font-black text-fcSlate">
        Nyenga South Extension
      </div>
      <div className="text-sm font-bold text-slate-600">
        Stand #A-45
      </div>
      <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
        Stand ID: st_abc123de • 1500 m² • AVAILABLE
      </div>
    </div>
  </div>

  {/* Value */}
  <div className="text-right">
    <div className="text-xl font-black text-fcSlate font-mono">
      $50,000
    </div>
    <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
      Contract Value
    </div>
  </div>
</div>
```

---

### 10. Do's and Don'ts

#### ✅ DO
```tsx
// ✅ Use Tailwind utilities
className="flex items-center p-4 rounded-xl border border-fcDivider"

// ✅ Combine utilities meaningfully
className="grid grid-cols-1 md:grid-cols-3 gap-4"

// ✅ Use semantic color variables
className="text-fcGold bg-fcSlate"

// ✅ Keep class names readable
className="bg-white rounded-2xl border border-fcDivider p-8 shadow-sm"

// ✅ Use responsive prefixes
className="w-full md:w-1/2 lg:w-1/3"
```

#### ❌ DON'T
```tsx
// ❌ Avoid inline styles
style={{color: '#85754E'}}

// ❌ Avoid custom CSS
className="my-custom-card-style"

// ❌ Don't hardcode colors
className="text-#85754E"

// ❌ Don't nest unnecessary divs
<div><div><div>content</div></div></div>

// ❌ Avoid non-Tailwind utilities
className="my-padding-large"
```

---

## Component Template

### Standard Card Template
```tsx
export const Card = ({ title, children, className = "" }) => (
  <div className={`bg-white rounded-2xl border border-fcDivider p-6 shadow-sm ${className}`}>
    {title && (
      <h3 className="text-lg font-black text-fcSlate mb-4">
        {title}
      </h3>
    )}
    {children}
  </div>
);
```

### Status Card Template
```tsx
export const StatusCard = ({ label, value, percentage, status = "orange" }) => {
  const colors = {
    orange: "bg-orange-50 border-orange-200 text-orange-600 text-orange-700",
    green: "bg-green-50 border-green-200 text-green-600 text-green-700",
    blue: "bg-blue-50 border-blue-200 text-blue-600 text-blue-700",
  };

  return (
    <div className={`p-4 rounded-xl border ${colors[status]}`}>
      <div className="text-[10px] font-black uppercase tracking-widest mb-2">
        {label}
      </div>
      <div className="text-2xl font-black">
        {value}
      </div>
      <div className="text-[9px] font-bold mt-1">
        {percentage}
      </div>
    </div>
  );
};
```

---

## Tailwind Configuration

### Available Custom Colors
```javascript
// In layout.tsx tailwind.config
colors: {
  fcGold:    '#85754E',    // Brand primary
  fcDark:    '#1a1a1a',    // Very dark
  fcSlate:   '#1e293b',    // Dark heading text
  fcDivider: '#e0e0e0',    // Light borders
  fcText:    '#333333',    // Body text
  fcBg:      '#fafafa',    // Light background
  fcBorder:  '#cccccc',    // Medium border
  fcCream:   '#fffbf0'     // Cream background
}
```

### Extending Tailwind
```javascript
// Add new utility or modify existing
theme: {
  extend: {
    colors: {
      // Your custom colors here
    },
    spacing: {
      // Your custom spacing
    }
  }
}
```

---

## Performance Tips

1. **Use utility classes** - Smaller CSS payload
2. **Combine classes** - Not separate classNames
3. **Responsive prefixes** - Don't duplicate for different sizes
4. **System fonts** - Fallback to Inter loading issues
5. **Avoid over-nesting** - Keep HTML flat when possible

---

## References

- [Tailwind CSS Docs](https://tailwindcss.com/docs)
- [Next.js Font Optimization](https://nextjs.org/docs/app/building-your-application/optimizing/fonts)
- [Design System](./DESIGN_SYSTEM_TAILWIND_AUDIT.md)
- [Compliance Checklist](./DESIGN_STANDARDS_COMPLIANCE.md)

---

**Last Updated**: December 30, 2025
**Version**: 1.0
**Maintainer**: Development Team
