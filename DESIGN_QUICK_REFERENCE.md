# Design System Quick Reference Card

**Design Framework**: Tailwind CSS + Inter Font + Minimalist Principles
**Version**: 1.0
**Last Updated**: December 30, 2025

---

## 🎨 Color Palette

### Brand Colors
```
fcGold    #85754E    Primary brand color
fcSlate   #1e293b    Dark text/headings
fcDivider #e0e0e0    Light borders
fcCream   #fffbf0    Cream background
```

### Status Colors
```
Green     #22C55E    Success/Paid
Orange    #F97316    Warning/Pending
Blue      #3B82F6    Info/Period
Slate     #64748B    Neutral/Secondary
```

---

## 📝 Typography

### Headings
```
Large      text-3xl font-black text-fcSlate
Medium     text-lg font-black text-fcSlate
Small      text-base font-black text-fcSlate
```

### Body & Labels
```
Body       text-sm text-slate-600
Label      text-[10px] uppercase tracking-widest text-slate-400
Caption    text-[9px] font-bold text-slate-500
```

### Values/Numbers
```
text-2xl font-black font-mono text-fcSlate
```

---

## 📐 Spacing Scale

| Class | Size | Usage |
|-------|------|-------|
| `p-3` | 12px | Compact |
| `p-4` | 16px | Standard |
| `p-6` | 24px | Cards |
| `p-8` | 32px | Large |
| `gap-4` | 16px | Default |
| `gap-6` | 24px | Large |

---

## 🎯 Common Components

### Card Container
```tsx
className="bg-white rounded-2xl border border-fcDivider p-6 shadow-sm"
```

### Status Card (Orange/Green/Blue)
```tsx
className="p-4 bg-orange-50 rounded-xl border border-orange-200"
```

### Icon Box
```tsx
className="p-4 bg-white rounded-xl border border-fcDivider"
```

### Grid Layout (Responsive)
```tsx
className="grid grid-cols-1 md:grid-cols-3 gap-4"
```

### Flex Layout
```tsx
className="flex items-center justify-between"
```

---

## 📱 Responsive Breakpoints

```
Mobile:   base (no prefix)    320px+
Tablet:   md:                 768px+
Desktop:  lg:                 1024px+
```

### Examples
```tsx
// 1 column on mobile, 3 on desktop
className="grid grid-cols-1 md:grid-cols-3"

// Full width on mobile, half on desktop
className="w-full md:w-1/2"

// Stack on mobile, row on desktop
className="flex flex-col md:flex-row"
```

---

## ✨ Design Principles

✅ **Utility-First**: Only Tailwind classes, no custom CSS
✅ **Minimalist**: Clean, purposeful design
✅ **Semantic**: Colors convey meaning
✅ **Accessible**: WCAG AA compliant
✅ **Responsive**: Mobile-first approach
✅ **Consistent**: Unified palette and typography

---

## 🚫 Don'ts

- ❌ No inline styles: `style={{color: '#..'}}`
- ❌ No custom CSS: `my-custom-class`
- ❌ No non-Tailwind utilities
- ❌ Don't hardcode colors in class names
- ❌ Avoid unnecessary nesting

---

## 📚 Documentation

| Document | Purpose |
|----------|---------|
| [DESIGN_SYSTEM_TAILWIND_AUDIT.md](DESIGN_SYSTEM_TAILWIND_AUDIT.md) | Complete design audit |
| [DESIGN_STANDARDS_COMPLIANCE.md](DESIGN_STANDARDS_COMPLIANCE.md) | Compliance checklist |
| [TAILWIND_CSS_USAGE_GUIDE.md](TAILWIND_CSS_USAGE_GUIDE.md) | Practical guide |
| [DESIGN_SYSTEM_IMPLEMENTATION.md](DESIGN_SYSTEM_IMPLEMENTATION.md) | Implementation summary |

---

## 🔧 Quick Copy-Paste Snippets

### Current Statement Card
```tsx
<div className="bg-white rounded-2xl border border-fcDivider p-8 shadow-sm">
  <div className="flex items-center justify-between mb-6">
    <h3 className="text-lg font-black text-fcSlate">Current Statement</h3>
    <div className="p-3 bg-fcGold/10 rounded-xl">
      <FileText size={24} className="text-fcGold" />
    </div>
  </div>
  
  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
    <div className="p-4 bg-orange-50 rounded-xl border border-orange-200">
      <div className="text-[10px] font-black text-orange-600 uppercase">Outstanding</div>
      <div className="text-2xl font-black text-orange-700">$15,000</div>
    </div>
    {/* Green and Blue cards... */}
  </div>
</div>
```

### Portfolio Card with Stand ID
```tsx
<div className="flex items-center justify-between p-6 bg-slate-50/50 rounded-2xl border border-fcDivider">
  <div className="flex items-center space-x-6">
    <div className="p-4 bg-white rounded-xl border border-fcDivider">
      <MapPin size={24} className="text-fcGold" />
    </div>
    <div className="space-y-1">
      <div className="text-base font-black text-fcSlate">Development Name</div>
      <div className="text-sm font-bold text-slate-600">Stand #A-45</div>
      <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
        Stand ID: {id} • 1500 m² • AVAILABLE
      </div>
    </div>
  </div>
  <div className="text-right">
    <div className="text-xl font-black text-fcSlate font-mono">$50,000</div>
    <div className="text-[10px] font-black text-slate-400">CONTRACT VALUE</div>
  </div>
</div>
```

---

## ✅ Compliance Checklist

- [x] Uses Tailwind utilities only
- [x] Inter font loaded
- [x] Minimalist design applied
- [x] Colors semantic
- [x] Typography hierarchical
- [x] Responsive design implemented
- [x] Accessibility standards met
- [x] No custom CSS
- [x] No inline styles
- [x] Production ready

---

## 🎓 Learning Resources

- [Tailwind CSS Documentation](https://tailwindcss.com/docs)
- [Next.js Font Optimization](https://nextjs.org/docs/app/building-your-application/optimizing/fonts)
- [Web Accessibility Guidelines](https://www.w3.org/WAI/WCAG21/quickref/)

---

**Status**: ✅ PRODUCTION READY
**Version**: 1.0
**Last Updated**: December 30, 2025
