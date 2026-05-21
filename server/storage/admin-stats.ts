import { db } from "../db";
import {
  users,
  groups,
  members,
  itineraries,
  rsvps,
} from "@shared/schema";
import { eq, and, or, desc, sql } from "drizzle-orm";

export const adminStatsStorage = {
  async getAdminStats(includeTestData: boolean = false) {
    const buildFilters = (includeGroups: boolean = false) => {
      const filters: any[] = [];

      if (!includeTestData) {
        if (includeGroups) {
          filters.push(eq(groups.isTest, false));
        }
        filters.push(
          sql`${users.email} NOT LIKE '%@example.com'`,
          sql`${users.email} NOT LIKE '%@test.com'`
        );
      }

      return filters.length > 0 ? and(...filters) : undefined;
    };

    const userEmailFilter = !includeTestData
      ? and(
          sql`${users.email} NOT LIKE '%@example.com'`,
          sql`${users.email} NOT LIKE '%@test.com'`
        )
      : undefined;

    const [authUsersResult] = await db
      .select({ count: sql<number>`count(*)` })
      .from(users)
      .where(userEmailFilter);
    const authUsersCount = Number(authUsersResult.count);

    const memberEmailFilters: any[] = [
      sql`${members.email} IS NOT NULL`,
      sql`NOT EXISTS (SELECT 1 FROM ${users} WHERE ${users.email} IS NOT NULL AND ${users.email} = ${members.email})`
    ];

    if (!includeTestData) {
      memberEmailFilters.push(
        sql`${members.email} NOT LIKE '%@example.com'`,
        sql`${members.email} NOT LIKE '%@test.com'`
      );
    }

    const [unclaimedMemberEmailsResult] = await db
      .select({ count: sql<number>`count(DISTINCT ${members.email})` })
      .from(members)
      .where(and(...memberEmailFilters));
    const unclaimedMemberEmails = Number(unclaimedMemberEmailsResult.count);

    const [groupsResult] = await db
      .select({ count: sql<number>`count(*)` })
      .from(groups)
      .innerJoin(users, eq(groups.userId, users.id))
      .where(buildFilters(true));
    const totalGroups = Number(groupsResult.count);

    const [eventsResult] = await db
      .select({ count: sql<number>`count(*)` })
      .from(itineraries)
      .innerJoin(groups, eq(itineraries.groupId, groups.id))
      .innerJoin(users, eq(groups.userId, users.id))
      .where(buildFilters(true));
    const totalEvents = Number(eventsResult.count);

    const notCancelledSql = sql`${itineraries.status} <> 'rejected'`;
    const eventHappenedSql = sql`${notCancelledSql} AND EXISTS (SELECT 1 FROM ${rsvps} WHERE ${rsvps.itineraryId} = ${itineraries.id} AND lower(${rsvps.response}) IN ('yes', 'going'))`;

    const eventsHeldFilter = buildFilters(true);
    const eventsHeldConditions = eventsHeldFilter
      ? and(
          eventsHeldFilter,
          sql`${itineraries.eventDate} IS NOT NULL`,
          sql`${itineraries.eventDate} < NOW()`,
          eventHappenedSql
        )
      : and(
          sql`${itineraries.eventDate} IS NOT NULL`,
          sql`${itineraries.eventDate} < NOW()`,
          eventHappenedSql
        );

    const [eventsHeldResult] = await db
      .select({ count: sql<number>`count(*)` })
      .from(itineraries)
      .innerJoin(groups, eq(itineraries.groupId, groups.id))
      .innerJoin(users, eq(groups.userId, users.id))
      .where(eventsHeldConditions);
    const eventsHeld = Number(eventsHeldResult.count);

    const sixtyDaysAgo = new Date();
    sixtyDaysAgo.setDate(sixtyDaysAgo.getDate() - 60);
    const now = new Date();

    const activeGroupsFilter = buildFilters(true);
    const activeGroupsConditions = activeGroupsFilter
      ? and(
          activeGroupsFilter,
          sql`${itineraries.eventDate} IS NOT NULL`,
          sql`${itineraries.eventDate} >= ${sixtyDaysAgo.toISOString()}`,
          sql`${itineraries.eventDate} <= ${now.toISOString()}`,
          eventHappenedSql
        )
      : and(
          sql`${itineraries.eventDate} IS NOT NULL`,
          sql`${itineraries.eventDate} >= ${sixtyDaysAgo.toISOString()}`,
          sql`${itineraries.eventDate} <= ${now.toISOString()}`,
          eventHappenedSql
        );

    const [activeGroupsResult] = await db
      .select({ count: sql<number>`count(DISTINCT ${itineraries.groupId})` })
      .from(itineraries)
      .innerJoin(groups, eq(itineraries.groupId, groups.id))
      .innerJoin(users, eq(groups.userId, users.id))
      .where(activeGroupsConditions);
    const activeGroups = Number(activeGroupsResult.count);

    const repeatAttendanceFilter = buildFilters(true);
    const repeatAttendanceConditions = repeatAttendanceFilter
      ? and(
          repeatAttendanceFilter,
          eq(rsvps.response, 'yes'),
          sql`${itineraries.eventDate} IS NOT NULL`,
          sql`${itineraries.eventDate} < NOW()`,
          notCancelledSql
        )
      : and(
          eq(rsvps.response, 'yes'),
          sql`${itineraries.eventDate} IS NOT NULL`,
          sql`${itineraries.eventDate} < NOW()`,
          notCancelledSql
        );

    const usersWithMultipleAttendances = await db
      .select({
        userId: rsvps.userId,
        memberId: rsvps.memberId,
        count: sql<number>`count(*)`
      })
      .from(rsvps)
      .innerJoin(itineraries, eq(rsvps.itineraryId, itineraries.id))
      .innerJoin(groups, eq(itineraries.groupId, groups.id))
      .innerJoin(users, eq(groups.userId, users.id))
      .where(repeatAttendanceConditions)
      .groupBy(rsvps.userId, rsvps.memberId)
      .having(sql`count(*) >= 2`);

    const repeatAttenders = usersWithMultipleAttendances.length;

    const [totalAttendeesResult] = await db
      .select({
        count: sql<number>`count(DISTINCT COALESCE(${rsvps.userId}, ${rsvps.memberId}))`
      })
      .from(rsvps)
      .innerJoin(itineraries, eq(rsvps.itineraryId, itineraries.id))
      .innerJoin(groups, eq(itineraries.groupId, groups.id))
      .innerJoin(users, eq(groups.userId, users.id))
      .where(repeatAttendanceConditions);

    const totalAttendees = Number(totalAttendeesResult.count);
    const repeatAttendanceRate = totalAttendees > 0 ? (repeatAttenders / totalAttendees) * 100 : 0;

    const topCitiesFilter = buildFilters(true);
    const topCitiesConditions = topCitiesFilter
      ? and(topCitiesFilter, sql`${itineraries.eventDate} IS NOT NULL`)
      : sql`${itineraries.eventDate} IS NOT NULL`;

    const cityEvents = await db
      .select({
        location: groups.locationBase,
        eventCount: sql<number>`count(${itineraries.id})`
      })
      .from(groups)
      .innerJoin(users, eq(groups.userId, users.id))
      .leftJoin(itineraries, eq(groups.id, itineraries.groupId))
      .where(topCitiesConditions)
      .groupBy(groups.locationBase)
      .orderBy(desc(sql`count(${itineraries.id})`))
      .limit(10);

    const topCities = cityEvents.map(row => ({
      city: row.location || 'Unknown',
      eventCount: Number(row.eventCount)
    }));

    const ninetyDaysAgo = new Date();
    ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);

    const weeklyEventsFilter = buildFilters(true);
    const weeklyEventsConditions = weeklyEventsFilter
      ? and(
          weeklyEventsFilter,
          sql`${itineraries.eventDate} IS NOT NULL`,
          sql`${itineraries.eventDate} >= ${ninetyDaysAgo.toISOString()}`
        )
      : and(
          sql`${itineraries.eventDate} IS NOT NULL`,
          sql`${itineraries.eventDate} >= ${ninetyDaysAgo.toISOString()}`
        );

    const weeklyEvents = await db
      .select({
        week: sql<string>`TO_CHAR(DATE_TRUNC('week', ${itineraries.eventDate}), 'YYYY-MM-DD')`,
        count: sql<number>`count(*)`
      })
      .from(itineraries)
      .innerJoin(groups, eq(itineraries.groupId, groups.id))
      .innerJoin(users, eq(groups.userId, users.id))
      .where(weeklyEventsConditions)
      .groupBy(sql`DATE_TRUNC('week', ${itineraries.eventDate})`)
      .orderBy(sql`DATE_TRUNC('week', ${itineraries.eventDate})`);

    const eventsPerWeek = weeklyEvents.map(row => ({
      week: row.week,
      count: Number(row.count)
    }));

    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);

    const thisMonthAttendeesFilter = buildFilters(true);
    const thisMonthAttendeesConditions = thisMonthAttendeesFilter
      ? and(
          thisMonthAttendeesFilter,
          eq(rsvps.response, 'yes'),
          sql`${itineraries.eventDate} >= ${startOfMonth.toISOString()}`
        )
      : and(
          eq(rsvps.response, 'yes'),
          sql`${itineraries.eventDate} >= ${startOfMonth.toISOString()}`
        );

    const thisMonthAttendees = await db
      .select({
        userId: rsvps.userId,
        memberId: rsvps.memberId
      })
      .from(rsvps)
      .innerJoin(itineraries, eq(rsvps.itineraryId, itineraries.id))
      .innerJoin(groups, eq(itineraries.groupId, groups.id))
      .innerJoin(users, eq(groups.userId, users.id))
      .where(thisMonthAttendeesConditions);

    let newAttendees = 0;
    let returningAttendees = 0;

    for (const attendee of thisMonthAttendees) {
      const priorAttendanceFilter = buildFilters(true);
      const priorAttendanceConditions = priorAttendanceFilter
        ? and(
            priorAttendanceFilter,
            eq(rsvps.response, 'yes'),
            sql`${itineraries.eventDate} < ${startOfMonth.toISOString()}`,
            attendee.userId
              ? eq(rsvps.userId, attendee.userId)
              : eq(rsvps.memberId, attendee.memberId!)
          )
        : and(
            eq(rsvps.response, 'yes'),
            sql`${itineraries.eventDate} < ${startOfMonth.toISOString()}`,
            attendee.userId
              ? eq(rsvps.userId, attendee.userId)
              : eq(rsvps.memberId, attendee.memberId!)
          );

      const priorAttendance = await db
        .select({ count: sql<number>`count(*)` })
        .from(rsvps)
        .innerJoin(itineraries, eq(rsvps.itineraryId, itineraries.id))
        .innerJoin(groups, eq(itineraries.groupId, groups.id))
        .innerJoin(users, eq(groups.userId, users.id))
        .where(priorAttendanceConditions);

      if (Number(priorAttendance[0].count) > 0) {
        returningAttendees++;
      } else {
        newAttendees++;
      }
    }

    return {
      registeredUsers: authUsersCount,
      invitedMembers: unclaimedMemberEmails,
      totalGroups,
      totalEvents,
      eventsHeld,
      activeGroups,
      repeatAttendanceRate: Math.round(repeatAttendanceRate * 10) / 10,
      topCities,
      eventsPerWeek,
      newVsReturning: {
        newAttendees,
        returningAttendees
      }
    };
  },

  async getTestAccounts() {
    const testUsers = await db
      .select({
        id: users.id,
        email: users.email,
        firstName: users.firstName,
        lastName: users.lastName
      })
      .from(users)
      .where(
        or(
          sql`${users.email} LIKE '%@example.com'`,
          sql`${users.email} LIKE '%@test.com'`
        )
      )
      .orderBy(users.email)
      .limit(50);

    return testUsers;
  },
};
