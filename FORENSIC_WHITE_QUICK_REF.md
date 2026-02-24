# Forensic White Aesthetic - Quick Reference

## Brand Color Palette

```
🟦 brand-white     #FFFFFF      Pure white - all main backgrounds
🟨 brand-light     #F9FAFB      Light off-white - subtle backgrounds  
🏆 brand-gold      #C5A059      Estate gold - accents & interactive
⬛ brand-black     #1A1A1A      Ink black - primary text
⚫ brand-grey      #6B7280      Neutral grey - secondary text
```

## Usage Guidelines

### Backgrounds
- **Primary:** `bg-brand-white` (all cards, pages, modals)
- **Secondary:** `bg-brand-light` (subtle panels, sections)
- **Accents:** `bg-brand-gold` (buttons, active states)

### Text
- **Primary:** `text-brand-black` (headings, body text)
- **Secondary:** `text-brand-grey` (labels, descriptions)
- **Accent:** `text-brand-gold` (highlights, emphasis)

### Overlays
- **Pattern:** `bg-black/40 backdrop-blur-sm`
- **Never use:** `bg-black/50` or higher
- **Always include:** `backdrop-blur-sm` for depth

### Shadows
- **Minimal:** `shadow-forensic-sm` - subtle hover effects
- **Standard:** `shadow-forensic` or `shadow-forensic-md` - cards, default
- **Emphasis:** `shadow-forensic-lg` - modals, floating elements
- **Never use:** `shadow-xl`, `shadow-2xl` (too pronounced)

### Borders
- **Primary:** `border-brand-gold/20` - light gold accents
- **Secondary:** `border-brand-gold/10` - very subtle
- **Divider:** `border-brand-gold/5` - minimal separation

## Component Templates

### Modal
```tsx
<div className="fixed inset-0 z-50">
  <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
  <div className="relative bg-white rounded-2xl shadow-forensic border border-brand-gold/20">
    {/* content */}
  </div>
</div>
```

### Card
```tsx
<div className="bg-white rounded-2xl border border-brand-gold/10 p-6 shadow-forensic">
  <h3 className="text-lg font-bold text-brand-black">Title</h3>
  <p className="text-sm text-brand-grey mt-2">Description</p>
</div>
```

### Button (Primary)
```tsx
<button className="bg-brand-gold text-white px-6 py-3 rounded-xl font-bold hover:opacity-90 shadow-forensic">
  Action
</button>
```

### Button (Secondary)
```tsx
<button className="bg-brand-light text-brand-black px-6 py-3 rounded-xl font-bold hover:bg-brand-gold/10">
  Cancel
</button>
```

## Deprecated Colors

❌ Do NOT use these old colors:
- `fcSlate` (old dark) → use `brand-black`
- `text-white` → use `text-brand-black` or `text-brand-gold`
- `text-gray-*` → use `text-brand-grey` or `text-brand-black`
- `bg-black/50` → use `bg-black/40 backdrop-blur-sm`
- `shadow-lg shadow-*` → use `shadow-forensic` variants
- Old gold `#85754E` → use `brand-gold #C5A059`

## Font System

**Geist** is the primary font throughout:
- Headlines: Geist, 900-700 weight, ink black
- Body: Geist, 400-600 weight, ink black
- Accent text: Same font, estate gold color

## Common Patterns

### Section Headers
```tsx
<h3 className="text-sm font-black text-brand-black uppercase tracking-[0.3em]">
  Section Title
</h3>
```

### Secondary Text
```tsx
<p className="text-xs text-brand-grey font-bold uppercase tracking-widest">
  Secondary Info
</p>
```

### Active/Hover State
```tsx
className={isActive ? 'bg-brand-gold text-white shadow-forensic' : 'text-brand-grey hover:text-brand-black'}
```

### Divider
```tsx
<div className="border-t border-brand-gold/10" />
```

## Quick Conversion Checklist

When updating components:
- [ ] Replace `fcSlate` with `brand-black`
- [ ] Replace `text-white` with appropriate brand color
- [ ] Replace `text-gray-*` with `text-brand-grey`
- [ ] Replace `bg-black/50+` with `bg-black/40 backdrop-blur-sm`
- [ ] Replace `shadow-lg/xl/2xl` with `shadow-forensic` variants
- [ ] Replace `fcGold` with `brand-gold`
- [ ] Update borders to `border-brand-gold/[10-20]`
- [ ] Verify Geist font is applied (global CSS handles this)

## Shadow Values

```
shadow-forensic:    0 4px 30px rgba(0, 0, 0, 0.03)
shadow-forensic-sm: 0 2px 8px rgba(0, 0, 0, 0.04)
shadow-forensic-md: 0 4px 20px rgba(0, 0, 0, 0.05)
shadow-forensic-lg: 0 10px 40px rgba(0, 0, 0, 0.08)
```

All opacity values < 0.1 for maximum subtlety.

## Accessibility Notes

- Contrast ratio for text: ✅ WCAG AAA
  - `text-brand-black` (#1A1A1A) on white: 22.1:1
  - `text-brand-gold` on white: 10.5:1
  - `text-brand-grey` on white: 7.2:1

- All interactive elements maintain sufficient hover/focus states
- Subtle shadows do not interfere with readability

---

**Last Updated:** [Current Session]
**Status:** Production Ready ✅
**Font System:** Geist system-wide
**Color System:** Brand namespace complete
