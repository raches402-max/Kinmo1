# Logging Strategy for Production

**Status:** 📋 Guidelines  
**Created:** 2025-11-24

---

## Current State

- **console.log:** 1,149 instances
- **console.error:** 373 instances ✅ (keep - critical errors)
- **console.warn:** 22 instances ✅ (keep - warnings)

---

## Production Logging Strategy

### ✅ KEEP These Logs:

1. **Structured Logs with Prefixes**
   ```typescript
   console.log('[Auth] User logged in:', userId);
   console.log('[Selection] Top 10 scored venues');
   console.log(`[Group ${groupId}] Created event`);
   ```
   These are monitoring/audit logs - KEEP them!

2. **Error Logs**
   ```typescript
   console.error('[Database] Connection failed:', error);
   ```
   All console.error statements should remain.

3. **Warning Logs**
   ```typescript
   console.warn('Rate limit approaching threshold');
   ```
   All console.warn statements should remain.

---

### ❌ REMOVE These Logs (Future Cleanup):

1. **Raw Object Dumps**
   ```typescript
   console.log(data); // No context
   console.log(response); // Debug only
   ```

2. **Debug-Only Logs**
   ```typescript
   console.log('here'); // Debugging
   console.log('test'); // Debugging
   ```

3. **Verbose Data Logging**
   ```typescript
   console.log(JSON.stringify(largeObject, null, 2));
   ```

---

## Recommendations for Production

### Immediate (Pre-Launch):
- ✅ Current logging is acceptable for MVP launch
- ✅ Structured logs provide good visibility
- ⚠️ No action required (logs are monitoring-friendly)

### Post-Launch (Future):
1. **Add Log Levels**
   - Replace console.log with proper log levels (info, debug, error, warn)
   
2. **Implement Structured Logging**
   - Consider libraries: pino, winston
   - JSON-formatted logs for easier parsing

3. **Log Aggregation**
   - Set up log aggregation service (Datadog, Loggly, CloudWatch)
   - Enable log search and alerting

4. **Cleanup Debug Logs**
   - Remove logs without structured prefixes
   - Remove verbose object dumps

---

## Sample Production Logger (Future)

```typescript
import pino from 'pino';

const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
  formatters: {
    level: (label) => {
      return { level: label };
    },
  },
});

// Usage
logger.info({ userId, action: 'login' }, 'User logged in');
logger.error({ err, userId }, 'Authentication failed');
```

---

## Decision for Launch

**✅ NO CHANGES NEEDED FOR MVP LAUNCH**

The current console.log statements are:
1. Mostly structured with prefixes
2. Useful for monitoring and debugging
3. Not exposing sensitive data
4. Acceptable for production MVP

**Post-launch:** Consider migrating to structured logging library.

---

*Logging guide created: 2025-11-24*
*Current strategy: Keep existing logs for launch, improve post-launch*
