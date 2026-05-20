import "dotenv/config";

import { db } from "../server/db";
import { storage } from "../server/storage";
import { itineraries, rsvps as rsvpsTable, venueVisitHistory } from "../shared/schema";
import { and, eq, inArray, isNotNull, lt, or, sql } from "drizzle-orm";

const APPLY = process.argv.includes("--apply");
const REMOVE = process.argv.includes("--remove");

function getFlagValue(flag: string): string | undefined {
  const index = process.argv.indexOf(flag);
  if (index === -1) return undefined;
  return process.argv[index + 1];
}

const LIMIT = Number(getFlagValue("--limit") || "100");
const ITINERARY_ID = getFlagValue("--itinerary");

type Candidate = {
  id: string;
  name: string | null;
  status: string | null;
  groupId: string | null;
  eventDate: Date | null;
  hasYesRsvp: boolean;
  existingVisitCount: number;
};

async function fetchCandidates(): Promise<Candidate[]> {
  const now = new Date();

  const rows = await db
    .select({
      id: itineraries.id,
      name: itineraries.name,
      status: itineraries.status,
      groupId: itineraries.groupId,
      eventDate: itineraries.eventDate,
    })
    .from(itineraries)
    .where(
      and(
        isNotNull(itineraries.groupId),
        isNotNull(itineraries.eventDate),
        lt(itineraries.eventDate, now),
        ITINERARY_ID
          ? eq(itineraries.id, ITINERARY_ID)
          : or(eq(itineraries.status, "scheduled"), eq(itineraries.status, "proposed"), eq(itineraries.status, "completed"))
      )
    )
    .orderBy(itineraries.eventDate)
    .limit(Math.max(LIMIT, 1));

  if (rows.length === 0) return [];

  const itineraryIds = rows.map((row) => row.id);

  const yesRsvps = await db
    .selectDistinct({ itineraryId: rsvpsTable.itineraryId })
    .from(rsvpsTable)
    .where(
      and(
        inArray(rsvpsTable.itineraryId, itineraryIds),
        sql`${rsvpsTable.response} IN ('yes', 'going')`,
        sql`(is_guest IS NULL OR is_guest = false)`
      )
    );

  const existingVisits = await db
    .select({
      itineraryId: venueVisitHistory.itineraryId,
      visitCount: sql<number>`count(*)::int`,
    })
    .from(venueVisitHistory)
    .where(inArray(venueVisitHistory.itineraryId, itineraryIds))
    .groupBy(venueVisitHistory.itineraryId);

  const yesRsvpSet = new Set(yesRsvps.map((row) => row.itineraryId));
  const visitCountMap = new Map(existingVisits.map((row) => [row.itineraryId, Number(row.visitCount)]));

  return rows.map((row) => ({
    ...row,
    hasYesRsvp: yesRsvpSet.has(row.id),
    existingVisitCount: visitCountMap.get(row.id) || 0,
  }));
}

async function removeMode() {
  if (!ITINERARY_ID) {
    console.error("--remove requires --itinerary <id>");
    process.exit(1);
  }

  console.log(`Mode: REMOVE ${APPLY ? "(APPLY)" : "(DRY RUN)"}`);
  console.log(`Target itinerary: ${ITINERARY_ID}`);

  const [itinerary] = await db
    .select()
    .from(itineraries)
    .where(eq(itineraries.id, ITINERARY_ID))
    .limit(1);

  if (!itinerary) {
    console.error(`Itinerary ${ITINERARY_ID} not found`);
    process.exit(1);
  }

  const visitRows = await db
    .select()
    .from(venueVisitHistory)
    .where(eq(venueVisitHistory.itineraryId, ITINERARY_ID));

  console.log(`\nCurrent state:`);
  console.log(`  name:            ${itinerary.name || "(unnamed)"}`);
  console.log(`  status:          ${itinerary.status}`);
  console.log(`  eventDate:       ${itinerary.eventDate?.toISOString().slice(0, 10) || "(none)"}`);
  console.log(`  visit_history:   ${visitRows.length} row(s)`);

  console.log(`\nPlanned actions:`);
  console.log(`  - set status: ${itinerary.status} -> cancelled`);
  console.log(`  - delete ${visitRows.length} venue_visit_history row(s) for this itinerary`);
  console.log(`  - (RSVPs and feedback are NOT touched -- they reflect what people said)`);

  if (!APPLY) {
    console.log(`\nDry run. Re-run with --apply to commit.`);
    return;
  }

  await storage.updateItinerary(ITINERARY_ID, { status: "cancelled" });
  const deleted = await db
    .delete(venueVisitHistory)
    .where(eq(venueVisitHistory.itineraryId, ITINERARY_ID))
    .returning();

  console.log(`\nRemoved:`);
  console.log(`  - status set to cancelled`);
  console.log(`  - deleted ${deleted.length} venue_visit_history row(s)`);
}

async function main() {
  if (REMOVE) {
    await removeMode();
    return;
  }

  console.log(`Mode: ${APPLY ? "APPLY" : "DRY RUN"}`);
  console.log(`Limit: ${LIMIT}`);
  if (ITINERARY_ID) {
    console.log(`Scoped itinerary: ${ITINERARY_ID}`);
  }

  const candidates = await fetchCandidates();

  if (candidates.length === 0) {
    console.log("No matching past itineraries found.");
    return;
  }

  const actionable = candidates.filter((candidate) => candidate.hasYesRsvp && candidate.eventDate);
  const skippedNoYes = candidates.filter((candidate) => !candidate.hasYesRsvp);
  const alreadyLogged = actionable.filter((candidate) => candidate.existingVisitCount > 0);
  const needsVisitBackfill = actionable.filter((candidate) => candidate.existingVisitCount === 0);
  const needsStatusBackfill = actionable.filter((candidate) => candidate.status !== "completed");

  console.table(
    candidates.map((candidate) => ({
      id: candidate.id,
      name: candidate.name || "(unnamed)",
      status: candidate.status,
      eventDate: candidate.eventDate?.toISOString().slice(0, 10),
      hasYesRsvp: candidate.hasYesRsvp,
      existingVisitCount: candidate.existingVisitCount,
    }))
  );

  console.log(`\nSummary:`);
  console.log(`- Candidates scanned: ${candidates.length}`);
  console.log(`- Actionable (has yes RSVP): ${actionable.length}`);
  console.log(`- Needs status backfill: ${needsStatusBackfill.length}`);
  console.log(`- Needs venue visit backfill: ${needsVisitBackfill.length}`);
  console.log(`- Already has venue visits: ${alreadyLogged.length}`);
  console.log(`- Skipped (no yes RSVP): ${skippedNoYes.length}`);

  if (!APPLY) {
    console.log("\nDry run complete. Re-run with --apply to write changes.");
    return;
  }

  let statusUpdated = 0;
  let visitsLogged = 0;
  let failures = 0;

  for (const candidate of actionable) {
    try {
      if (candidate.status !== "completed") {
        await storage.updateItinerary(candidate.id, { status: "completed" });
        statusUpdated += 1;
      }

      if (candidate.eventDate && candidate.existingVisitCount === 0) {
        await storage.logVenueVisits(candidate.id, new Date(candidate.eventDate));
        visitsLogged += 1;
      }
    } catch (error) {
      failures += 1;
      console.error(`[Backfill] Failed for itinerary ${candidate.id}:`, error);
    }
  }

  console.log(`\nApplied:`);
  console.log(`- Statuses updated: ${statusUpdated}`);
  console.log(`- Venue histories logged: ${visitsLogged}`);
  console.log(`- Failures: ${failures}`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("[Backfill] Fatal error:", error);
    process.exit(1);
  });
