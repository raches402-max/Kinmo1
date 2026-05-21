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
- `user-profiles.ts` — `getUserProfile`, `upsertUserProfile`
- `category-search-history.ts` — `saveCategorySearch`, `getRecentCategorySearches`
- `time-slots.ts` — proposed time slots + time slot votes (11 methods)
- `backups.ts` — database backup operations (5 methods, 217 lines)
- `group-collections.ts` — group collections + collection assignments (7 methods)
- `hosting.ts` — event hosting + host assignments (9 methods)
- `seen-activities.ts` — `markVenuesAsSeen`, `getSeenVenues`
- `curated-venues.ts` — `getAllCuratedVenues`, `updateVenueCategory`
- `saved-places.ts` — member favorites + user saved + group saved (13 methods)
- `availability.ts` — availability pulses + responses (17 methods, multiple internal cross-refs rewritten as `availabilityStorage.X`)
- `standalone-events.ts` — standalone events + invitees (11 methods, one cross-domain `this.getUser` inlined as a direct db query to avoid coupling)
- `auto-scheduled-events.ts` — auto-scheduled events lifecycle (14 methods, 388 lines). Two `this.getAutoScheduledEvent` self-refs rewritten as `autoScheduledEventsStorage.X`. Two `this.getItinerary` cross-domain refs replaced by a module-local `fetchItineraryWithItems` helper that inlines the same db query, keeping this module decoupled from the not-yet-extracted itineraries domain.
- `admin-stats.ts` — `getAdminStats` + `getTestAccounts` (2 methods, ~320 lines). Pure SQL aggregation across users/groups/itineraries/rsvps — no internal cross-refs.
- `scraped-venues-import.ts` — clear/insert/compare/import scraped venues (4 methods, ~160 lines). Dynamic import of `getPlaceDetails` rewritten as `'../google-places'` (path adjusted for new module location).
- `rsvps.ts` — `createRsvp`, `getItineraryRsvps`, `updateRsvp`, `deleteRsvp` (4 methods, ~35 lines). Pure CRUD, no cross-refs.
- `preference-signals.ts` — `createPreferenceSignal`, `getGroupPreferenceSignals` (2 methods, trivial).
- `venue-visit-tracking.ts` — `logVenueVisits`, `getVenueVisitHistory`, `getHighlyRatedVenues` (3 methods, ~180 lines). `this.getItinerary` cross-domain ref replaced with the same `fetchItineraryWithItems` helper used in `auto-scheduled-events.ts`.

## Self-references when extracting

Some methods called sibling methods via `this.` inside the original
`DatabaseStorage` class. When extracting, rewrite those as a direct
reference to the extracted object (e.g. `backupsStorage.getDatabaseBackup`)
rather than `this.`. The field-assignment pattern means `this` inside an
extracted method still resolves to the class instance, which would
re-route through the delegate field — that works, but referencing the
exported object directly is clearer and less surprising.

## What's left

Everything else in `server/storage.ts`. Natural next candidates:
auto-scheduled events (medium), group collections (small), event hosting +
host assignments, scraped venues import, seen activities, curated venues,
member favorite venues, user/group saved places, standalone events,
availability pulses. Then the biggest domains (groups, members,
itineraries, rsvps).
