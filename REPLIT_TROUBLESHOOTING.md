# 🔧 Replit Troubleshooting Guide

When Replit preview stops working, try these commands in order:

## Quick Fixes (Try these first!)

### 1. **Kill and Restart** (Fastest - 5 seconds)
```bash
npm run kill
npm run dev
```
**When to use:** Preview not showing, "port in use" errors

---

### 2. **Full Fix** (Comprehensive - 10 seconds)
```bash
npm run fix
npm run dev
```
**When to use:** Random errors, build issues, preview broken

**What it does:**
- ✅ Kills all Node processes
- ✅ Frees ports 5000 & 5173
- ✅ Clears build caches
- ✅ Checks for zombie processes
- ✅ Verifies environment

---

### 3. **Nuclear Option** (If nothing else works - 30 seconds)
```bash
npm run fix:full
```
**When to use:** Major issues, after dependency changes

**What it does:** Everything above + reinstalls dependencies + starts dev server

---

## Common Errors & Solutions

### ❌ "Port 5000 already in use"
**Solution:**
```bash
npm run kill
npm run dev
```

### ❌ "Cannot find module" or build errors
**Solution:**
```bash
npm run clean
npm install
npm run dev
```

### ❌ "Preview not loading" but no errors
**Solution:**
```bash
npm run fix
npm run dev
```

### ❌ TypeScript errors preventing start
**Solution:**
```bash
npm run dev
# Dev server runs despite TS errors - fix them while it's running
```

---

## Manual Debugging

If scripts don't work, try these manual steps:

1. **Check what's running on ports:**
```bash
ss -tuln | grep -E ":(5000|5173) "
```

2. **View all Node processes:**
```bash
ps aux | grep -E "node|npm|tsx"
```

3. **Force kill everything:**
```bash
pkill -9 node && pkill -9 npm && pkill -9 tsx
```

4. **Start fresh:**
```bash
rm -rf node_modules/.vite dist
npm run dev
```

---

## Prevention Tips

1. **Always stop the server properly** before restarting
   - Use `Ctrl+C` in the terminal (not just closing the tab)

2. **If you see "No recipients with emails" spam:**
   - This is harmless - just informational logs
   - The app is working fine

3. **Before running npm install:**
   ```bash
   npm run kill
   # Then install
   npm install
   ```

---

## Quick Command Reference

| Command | Speed | What it does |
|---------|-------|--------------|
| `npm run kill` | ⚡ Instant | Kill all Node processes |
| `npm run clean` | ⚡ Fast | Clear build caches |
| `npm run fix` | 🔧 Quick | Full cleanup (no reinstall) |
| `npm run fix:full` | 🚀 Complete | Fix + reinstall + start |
| `npm run dev` | 🎯 Normal | Start dev server |

---

## Still Not Working?

1. Check Replit's **Secrets** tab - ensure all env vars are set
2. Check **Console** tab for actual error messages
3. Try **"Stop"** button in Replit, wait 10 seconds, then **"Run"**
4. Last resort: Hard refresh browser (`Ctrl+Shift+R` or `Cmd+Shift+R`)

---

*Created to reduce dependency on Replit Agent for common issues!*
