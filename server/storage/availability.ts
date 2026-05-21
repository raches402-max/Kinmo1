import { db } from "../db";
import {
  availabilityPulses,
  availabilityPulseResponses,
  members,
  groups,
  type AvailabilityPulse,
  type InsertAvailabilityPulse,
  type AvailabilityPulseResponse,
  type InsertAvailabilityPulseResponse,
  type Member,
  type Group,
  type DateSpecificAvailability,
} from "@shared/schema";
import { eq, and, desc, gt, lt, sql } from "drizzle-orm";
import { randomBytes } from "crypto";

export const availabilityStorage = {
  // Availability Pulses
  async createAvailabilityPulse(data: InsertAvailabilityPulse): Promise<AvailabilityPulse> {
    const [pulse] = await db
      .insert(availabilityPulses)
      .values(data)
      .returning();
    return pulse;
  },

  async getAvailabilityPulse(id: string): Promise<AvailabilityPulse | undefined> {
    const [pulse] = await db
      .select()
      .from(availabilityPulses)
      .where(eq(availabilityPulses.id, id));
    return pulse;
  },

  async getActivePulseForGroup(groupId: string): Promise<AvailabilityPulse | undefined> {
    // status='active' is set on creation but nothing flips it when the deadline
    // passes, so an expiresAt check is required — otherwise we surface long-past
    // pulses as "active", which both shows a stale dashboard card and blocks the
    // organizer from creating a new pulse.
    const [pulse] = await db
      .select()
      .from(availabilityPulses)
      .where(
        and(
          eq(availabilityPulses.groupId, groupId),
          eq(availabilityPulses.status, 'active'),
          gt(availabilityPulses.expiresAt, new Date())
        )
      )
      .orderBy(desc(availabilityPulses.createdAt))
      .limit(1);
    return pulse;
  },

  async getActivePulseWithResponses(groupId: string): Promise<{
    pulse: AvailabilityPulse;
    responses: AvailabilityPulseResponse[];
  } | undefined> {
    const pulse = await availabilityStorage.getActivePulseForGroup(groupId);
    if (!pulse) return undefined;

    const responses = await db
      .select()
      .from(availabilityPulseResponses)
      .where(eq(availabilityPulseResponses.pulseId, pulse.id));

    return { pulse, responses };
  },

  async updatePulseStatus(id: string, status: string, completedAt?: Date): Promise<AvailabilityPulse | undefined> {
    const [pulse] = await db
      .update(availabilityPulses)
      .set({
        status,
        ...(completedAt && { completedAt })
      })
      .where(eq(availabilityPulses.id, id))
      .returning();
    return pulse;
  },

  async updatePulseEmailSentAt(id: string): Promise<void> {
    await db
      .update(availabilityPulses)
      .set({ emailSentAt: new Date() })
      .where(eq(availabilityPulses.id, id));
  },

  async updatePulseReminderSentAt(id: string): Promise<void> {
    await db
      .update(availabilityPulses)
      .set({ reminderSentAt: new Date() })
      .where(eq(availabilityPulses.id, id));
  },

  async incrementPulseResponseCount(id: string): Promise<void> {
    await db
      .update(availabilityPulses)
      .set({
        responseCount: sql`${availabilityPulses.responseCount} + 1`
      })
      .where(eq(availabilityPulses.id, id));
  },

  async expireOldPulses(): Promise<number> {
    const result = await db
      .update(availabilityPulses)
      .set({ status: 'expired' })
      .where(
        and(
          eq(availabilityPulses.status, 'active'),
          lt(availabilityPulses.expiresAt, new Date())
        )
      )
      .returning();
    return result.length;
  },

  // Availability Pulse Responses
  async createPulseResponse(data: InsertAvailabilityPulseResponse): Promise<AvailabilityPulseResponse> {
    const responseToken = randomBytes(16).toString('hex');
    const [response] = await db
      .insert(availabilityPulseResponses)
      .values({ ...data, responseToken })
      .returning();

    await availabilityStorage.incrementPulseResponseCount(data.pulseId);

    return response;
  },

  async updatePulseResponse(id: string, availability: DateSpecificAvailability, notes?: string): Promise<AvailabilityPulseResponse | undefined> {
    const [response] = await db
      .update(availabilityPulseResponses)
      .set({
        availability,
        notes,
        updatedAt: new Date()
      })
      .where(eq(availabilityPulseResponses.id, id))
      .returning();
    return response;
  },

  async getPulseResponse(pulseId: string, memberId: string): Promise<AvailabilityPulseResponse | undefined> {
    const [response] = await db
      .select()
      .from(availabilityPulseResponses)
      .where(
        and(
          eq(availabilityPulseResponses.pulseId, pulseId),
          eq(availabilityPulseResponses.memberId, memberId)
        )
      );
    return response;
  },

  async getPulseResponseByToken(responseToken: string): Promise<AvailabilityPulseResponse | undefined> {
    const [response] = await db
      .select()
      .from(availabilityPulseResponses)
      .where(eq(availabilityPulseResponses.responseToken, responseToken));
    return response;
  },

  async getPulseResponses(pulseId: string): Promise<AvailabilityPulseResponse[]> {
    return await db
      .select()
      .from(availabilityPulseResponses)
      .where(eq(availabilityPulseResponses.pulseId, pulseId));
  },

  async getAggregatedPulseAvailability(pulseId: string): Promise<{
    aggregated: Record<string, { morning: number; afternoon: number; evening: number }>;
    totalResponses: number;
  }> {
    const responses = await availabilityStorage.getPulseResponses(pulseId);

    const aggregated: Record<string, { morning: number; afternoon: number; evening: number }> = {};

    for (const response of responses) {
      const availability = response.availability as DateSpecificAvailability;
      for (const [dateStr, slots] of Object.entries(availability)) {
        if (!aggregated[dateStr]) {
          aggregated[dateStr] = { morning: 0, afternoon: 0, evening: 0 };
        }
        if (slots.morning) aggregated[dateStr].morning++;
        if (slots.afternoon) aggregated[dateStr].afternoon++;
        if (slots.evening) aggregated[dateStr].evening++;
      }
    }

    return { aggregated, totalResponses: responses.length };
  },

  async getPulseResponseWithDetails(responseToken: string): Promise<{
    response: AvailabilityPulseResponse;
    pulse: AvailabilityPulse;
    member: Member;
    group: Group;
  } | undefined> {
    const response = await availabilityStorage.getPulseResponseByToken(responseToken);
    if (!response) return undefined;

    const [pulse] = await db
      .select()
      .from(availabilityPulses)
      .where(eq(availabilityPulses.id, response.pulseId));
    if (!pulse) return undefined;

    const [member] = await db
      .select()
      .from(members)
      .where(eq(members.id, response.memberId));
    if (!member) return undefined;

    const [group] = await db
      .select()
      .from(groups)
      .where(eq(groups.id, pulse.groupId));
    if (!group) return undefined;

    return { response, pulse, member, group };
  },

  async getOrCreatePulseResponseForMember(
    pulseId: string,
    memberId: string,
    userId?: string
  ): Promise<AvailabilityPulseResponse> {
    const existing = await availabilityStorage.getPulseResponse(pulseId, memberId);
    if (existing) return existing;

    const responseToken = randomBytes(16).toString('hex');
    const [response] = await db
      .insert(availabilityPulseResponses)
      .values({
        pulseId,
        memberId,
        userId,
        availability: {},
        responseToken,
      })
      .returning();

    return response;
  },
};
