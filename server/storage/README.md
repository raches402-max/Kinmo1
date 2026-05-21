# server/storage/ — domain-split storage modules

`server/storage.ts` was 4,100+ lines of a single `DatabaseStorage` class. We're
extracting it into per-domain modules incrementally. This is W4 Slice 3.

## Pattern

Each domain file exports a plain object whose methods take the same arguments
and return the same types as the original `DatabaseStorage` methods. The class
in `server/storage.ts` keeps the same shape (still implements `IStorage`) but
delegates to these objects via field assignment:

```ts
// server/storage/reminders.ts
export const remindersStorage = {
  async logReminder(log: InsertReminderLog): Promise<ReminderLog> { ... },
  async getReminderLogs(itineraryId: string): Promise<ReminderLog[]> { ... },
};

// server/storage.ts
import { remindersStorage } from "./storage/reminders";

class DatabaseStorage implements IStorage {
  // ... other methods stay inline for now
  logReminder = remindersStorage.logReminder;
  getReminderLogs = remindersStorage.getReminderLogs;
}
```

All ~660 callsites of `storage.foo(...)` stay unchanged. Extractions are
fully backward-compatible.

## Cross-method calls

A handful of original methods call `this.getGroup(...)`, `this.getMember(...)`,
etc. When extracting one of those, either:

1. Inline the small helper into the extracted module, or
2. Import the relevant domain module and call its method directly
   (`groupsStorage.getGroup(...)`).

Avoid keeping `this.` references in extracted code — once detached from the
class, `this` no longer resolves.

## What's extracted so far

- `reminders.ts` — `logReminder`, `getReminderLogs`
- `frequency-feedback.ts` — `createFrequencyFeedback`, `getGroupFrequencyFeedback`

## What's left

Everything else in `server/storage.ts`. Natural next candidates (small, low
cross-ref): user profiles, auto-scheduled events, category search history,
time-slot voting. Then the bigger domains (groups, members, itineraries,
rsvps) once the pattern feels stable.
