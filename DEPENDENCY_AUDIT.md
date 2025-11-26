# Dependency Audit Report

**Date:** 2025-11-24
**Tool:** depcheck v1.4.7

---

## Potentially Unused Dependencies

### Regular Dependencies:

1. **@jridgewell/trace-mapping** - Source map support
   - Likely used by build tools (keep)
   - ✅ KEEP - Build dependency

2. **embla-carousel-react** - Carousel component  
   - May be used in components
   - ⚠️ VERIFY - Check if actually used

3. **input-otp** - OTP input component
   - May be for future feature
   - ⚠️ REVIEW - Remove if not used

4. **next-themes** - Theme provider
   - Not using Next.js
   - ⚠️ LIKELY UNUSED - Consider removing

5. **react-icons** - Icon library
   - Using lucide-react instead
   - ⚠️ LIKELY UNUSED - Consider removing

6. **zod-validation-error** - Zod error formatting
   - May be used in validation
   - ⚠️ VERIFY - Check usage

### Dev Dependencies:

1. **@tailwindcss/vite** - Tailwind Vite plugin
   - FALSE POSITIVE - Used in vite.config.ts
   - ✅ KEEP

2. **autoprefixer** - CSS prefixing
   - Used by PostCSS/Tailwind
   - ✅ KEEP

3. **postcss** - CSS processing
   - Used by Tailwind
   - ✅ KEEP

---

## Recommendations

### Safe to Remove (Likely unused):
```bash
npm uninstall next-themes react-icons
```

### Requires Investigation:
- embla-carousel-react
- input-otp  
- zod-validation-error

### Keep (False positives or used):
- @jridgewell/trace-mapping
- @tailwindcss/vite
- autoprefixer
- postcss

---

## Bundle Size Impact

Current bundle: ~2.0 MB (from build output)  
Removing unused deps: Minimal impact (<50KB estimated)

**Recommendation:** Low priority - safe to defer until post-launch cleanup.

---

*Audit completed: 2025-11-24*
