# Port Configuration Guide

## ⚠️ CRITICAL: Port 5000 is Reserved for Replit Preview

**DO NOT change the backend to use port 5000!**

This has been a recurring issue. Here's why:

### Current Port Setup

| Service | Port | Purpose |
|---------|------|---------|
| **Replit Preview** | 5000 | External preview window (RESERVED - do not use!) |
| **Backend Server** | 3000 | Express.js API and serving Vite build |
| **Vite Dev Server** | 5173 | Frontend dev server (default Vite port) |

### Why Port 5000 is Reserved

Replit's preview functionality is configured in `.replit` to use port 5000:
```toml
[[ports]]
localPort = 5000
externalPort = 5000
```

When the backend tries to use port 5000, it conflicts with Replit's preview service.

### Configuration Files

These files control the port configuration:

1. **`server/config.ts`** (line 25): Default port is `'3000'`
2. **`server/index.ts`** (line 161): Fallback to `'3000'`
3. **`.env.example`** (line 56): Documents port as `3000`
4. **`.replit`**: Replit preview configuration (port 5000)

### If This Breaks Again

1. Check `server/config.ts` - ensure default is `'3000'` not `'5000'`
2. Check `server/index.ts` - ensure fallback is `'3000'` not `'5000'`
3. Check `.replit` file - ensure `PORT = "3000"` in the `[env]` section
4. Look for warning comments about port 5000
5. **IMPORTANT**: Restart the ENTIRE Replit environment (not just the server)
   - Environment variables from `.replit` only reload on Replit restart
   - Stopping/starting the server is not enough

### Testing the Fix

```bash
# Check which port the server is using
npm run dev

# Should see: "✅ Port 3000 is available"
# Should NOT see: "serving on port 5000"
```

### Historical Context

This issue has occurred multiple times because:
- Claude Code or other tools sometimes revert to port 5000 as a "standard" backend port
- Port 5000 seems like a natural choice for backend services
- The Replit preview requirement isn't immediately obvious

**Solution:** Clear warnings in code + this documentation file
