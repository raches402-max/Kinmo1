// Reference: javascript_log_in_with_replit blueprint
import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { insertGroupSchema, insertMemberSchema, updateGroupSchema, updateMemberSchema, insertVotingEventSchema, updateVotingEventSchema, insertItinerarySchema, activities as activitiesTable, groups as groupsTable } from "@shared/schema";
import { generateActivitySuggestions, generateSwipeConcepts, categorizeByTime, categorizeVenue, analyzePreferencePatterns } from "./openai";
import { searchPlaces, searchNearbyPlaces, geocodeLocation } from "./google-places";
import { setupAuth, isAuthenticated } from "./replitAuth";
import { validateItinerary } from "./itinerary-validation";
import { db } from "./db";
import { eq, sql } from "drizzle-orm";

async function trackFeedbackAndMaybeAnalyze(groupId: string) {
  try {
    const [updatedGroup] = await db
      .update(groupsTable)
      .set({
        feedbackCount: sql`COALESCE(${groupsTable.feedbackCount}, 0) + 1`
      })
      .where(eq(groupsTable.id, groupId))
      .returning();

    if (!updatedGroup) {
      console.error(`Group ${groupId} not found when tracking feedback`);
      return;
    }

    const newCount = updatedGroup.feedbackCount || 0;
    console.log(`[Feedback Tracking] Group ${groupId} feedback count: ${newCount}`);

    if (newCount > 0 && newCount % 15 === 0) {
      console.log(`[Feedback Tracking] Triggering insights analysis at ${newCount} feedback actions`);
      
      setImmediate(async () => {
        try {
          const activities = await storage.getGroupActivities(groupId);
          const votingEvents = await storage.getGroupVotingEvents(groupId);
          const preferenceSignals = await storage.getGroupPreferenceSignals(groupId);

          const notThisFeedback = activities
            .filter(a => a.feedback === 'less')
            .map(a => ({
              venueName: a.venueName,
              venueType: a.venueType,
              feedback: a.feedback as string,
            }));

          const votingFeedback = votingEvents.map(event => ({
            venueName: event.title,
            venueType: event.venueType || 'event',
            upvotes: event.upvotes,
            downvotes: event.downvotes,
            netVotes: event.netVotes,
            description: event.description || ''
          }));

          const likedConcepts = preferenceSignals
            .filter(s => s.feedback === 'like')
            .map(s => s.conceptDescription);

          const passedConcepts = preferenceSignals
            .filter(s => s.feedback === 'pass')
            .map(s => s.conceptDescription);

          const patterns = await analyzePreferencePatterns({
            notThisFeedback: notThisFeedback.map(f => ({ ...f, description: '' })),
            votingFeedback,
            likedConcepts,
            passedConcepts
          });

          await db
            .update(groupsTable)
            .set({
              preferenceInsights: patterns,
              lastInsightsUpdate: sql`NOW()`
            })
            .where(eq(groupsTable.id, groupId));

          console.log(`[Feedback Tracking] Insights updated for group ${groupId}`);
        } catch (error) {
          console.error(`[Feedback Tracking] Background insights analysis failed:`, error);
        }
      });
    }
  } catch (error) {
    console.error(`[Feedback Tracking] Error tracking feedback for group ${groupId}:`, error);
  }
}

export async function registerRoutes(app: Express): Promise<Server> {
  // Set up authentication
  await setupAuth(app);

  // Auth routes
  app.get('/api/auth/user', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);
      res.json(user);
    } catch (error) {
      console.error("Error fetching user:", error);
      res.status(500).json({ message: "Failed to fetch user" });
    }
  });

  // Get user's groups
  app.get("/api/user/groups", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const groups = await storage.getUserGroups(userId);
      res.json(groups);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Create group with AI suggestions (protected)
  app.post("/api/groups", isAuthenticated, async (req: any, res) => {
    try {
      const { members, ...groupData } = req.body;
      const userId = req.user.claims.sub;

      // Validate group data
      const validatedGroup = insertGroupSchema.parse(groupData);

      // Geocode location to get coordinates
      const geocoded = await geocodeLocation(validatedGroup.locationBase);
      if (geocoded) {
        validatedGroup.latitude = geocoded.latitude.toString();
        validatedGroup.longitude = geocoded.longitude.toString();
        console.log(`Geocoded location: ${validatedGroup.locationBase} -> (${geocoded.latitude}, ${geocoded.longitude})`);
      } else {
        console.warn(`Failed to geocode location: ${validatedGroup.locationBase}`);
      }

      // Create group with members
      const group = await storage.createGroup(validatedGroup, userId, members || []);

      // Generate AI activity suggestions in background
      generateAndStoreActivities(group.id, validatedGroup);

      res.json(group);
    } catch (error: any) {
      console.error("Error creating group:", error);
      res.status(400).json({ message: error.message });
    }
  });

  // Get group by ID
  app.get("/api/groups/:id", async (req, res) => {
    try {
      const group = await storage.getGroup(req.params.id);
      if (!group) {
        return res.status(404).json({ message: "Group not found" });
      }
      res.json(group);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Update group details
  app.patch("/api/groups/:id", async (req, res) => {
    try {
      const group = await storage.getGroup(req.params.id);
      if (!group) {
        return res.status(404).json({ message: "Group not found" });
      }

      const validatedUpdates = updateGroupSchema.parse(req.body);

      // If location is being updated, geocode it
      let geocodingResult: 'success' | 'failed' | 'not_attempted' = 'not_attempted';
      if (validatedUpdates.locationBase) {
        const geocoded = await geocodeLocation(validatedUpdates.locationBase);
        if (geocoded) {
          validatedUpdates.latitude = geocoded.latitude.toString();
          validatedUpdates.longitude = geocoded.longitude.toString();
          geocodingResult = 'success';
          console.log(`Geocoded location update: ${validatedUpdates.locationBase} -> (${geocoded.latitude}, ${geocoded.longitude})`);
        } else {
          geocodingResult = 'failed';
          console.warn(`Failed to geocode location: ${validatedUpdates.locationBase}`);
        }
      }

      const updatedGroup = await storage.updateGroup(req.params.id, validatedUpdates);
      res.json({ ...updatedGroup, geocodingResult });
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  // Update search radius
  app.patch("/api/groups/:id/radius", async (req, res) => {
    try {
      const { searchRadius } = req.body;

      if (![2, 10, 30, 50].includes(searchRadius)) {
        return res.status(400).json({ message: "Invalid search radius. Must be 2, 10, 30, or 50 miles." });
      }

      const updatedGroup = await storage.updateGroup(req.params.id, { searchRadius });
      res.json(updatedGroup);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  // Get group by shareable link
  app.get("/api/groups/by-link/:shareableLink", async (req, res) => {
    try {
      const group = await storage.getGroupByShareableLink(req.params.shareableLink);
      if (!group) {
        return res.status(404).json({ message: "Group not found" });
      }
      res.json(group);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Get group members
  app.get("/api/groups/:id/members", async (req, res) => {
    try {
      const members = await storage.getGroupMembers(req.params.id);
      res.json(members);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Get group activities
  app.get("/api/groups/:id/activities", async (req, res) => {
    try {
      const activities = await storage.getGroupActivities(req.params.id);
      res.json(activities);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Update activity feedback
  app.patch("/api/activities/:activityId/feedback", async (req, res) => {
    try {
      const { feedback } = req.body;
      if (feedback !== null && !["love", "more", "less"].includes(feedback)) {
        return res.status(400).json({ message: "Invalid feedback value" });
      }
      const activity = await storage.updateActivityFeedback(req.params.activityId, feedback);
      
      if (activity.groupId) {
        await trackFeedbackAndMaybeAnalyze(activity.groupId);
      }
      
      res.json(activity);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Join a group
  app.post("/api/groups/:id/join", async (req, res) => {
    try {
      const { name, email, availability, preferences } = req.body;

      const memberData = {
        groupId: req.params.id,
        name: name || null,
        email: email || null,
        availability: availability || null,
        preferences: preferences || null,
        isOrganizer: false,
        invitationSent: false,
        hasJoined: true,
      };

      const member = await storage.createMember(memberData);
      res.json(member);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  // Update member
  app.patch("/api/members/:id", async (req, res) => {
    try {
      const validatedUpdates = updateMemberSchema.parse(req.body);
      const member = await storage.updateMember(req.params.id, validatedUpdates);
      res.json(member);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  // Delete member
  app.delete("/api/members/:id", async (req, res) => {
    try {
      await storage.deleteMember(req.params.id);
      res.json({ success: true });
    } catch (error: any) {
      const status = error.message.includes("Cannot delete organizer") ? 400 : 500;
      res.status(status).json({ message: error.message });
    }
  });

  // Member RSVP Routes

  // Claim a member identity (no auth required)
  app.post("/api/members/:id/claim", async (req, res) => {
    try {
      const { claimToken } = req.body;
      
      if (!claimToken) {
        return res.status(400).json({ message: "Claim token required" });
      }

      // Check if member exists and if already claimed
      const existingMember = await storage.getMember(req.params.id);
      if (!existingMember) {
        return res.status(404).json({ message: "Member not found" });
      }

      // If member already has a claim token, reject the claim attempt
      // This prevents RSVP hijacking - once claimed, the identity is locked to that token
      if (existingMember.claimToken && existingMember.claimToken !== claimToken) {
        return res.status(409).json({ 
          message: "This member has already been claimed by someone else",
          alreadyClaimed: true 
        });
      }

      // If not claimed yet, or re-claiming with same token, allow it
      const member = await storage.updateMember(req.params.id, {
        claimToken,
        hasJoined: true,
      });

      res.json(member);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  // Update member RSVP status (no auth required, validates claim token)
  app.patch("/api/members/:id/rsvp", async (req, res) => {
    try {
      const { rsvpStatus, claimToken } = req.body;

      if (!claimToken) {
        return res.status(401).json({ message: "Claim token required" });
      }

      if (!["going", "maybe", "not_going"].includes(rsvpStatus)) {
        return res.status(400).json({ message: "Invalid RSVP status" });
      }

      // Verify the claim token matches
      const member = await storage.getMember(req.params.id);
      if (!member) {
        return res.status(404).json({ message: "Member not found" });
      }

      if (member.claimToken !== claimToken) {
        return res.status(401).json({ message: "Invalid claim token" });
      }

      // Update RSVP status
      const updatedMember = await storage.updateMember(req.params.id, {
        rsvpStatus,
      });

      res.json(updatedMember);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  // Update member preferences (no auth required, validates claim token)
  app.patch("/api/members/:id/preferences", async (req, res) => {
    try {
      const { memberLocation, memberBudgetMin, memberBudgetMax, memberAvailability, claimToken } = req.body;

      if (!claimToken) {
        return res.status(401).json({ message: "Claim token required" });
      }

      // Verify the claim token matches
      const member = await storage.getMember(req.params.id);
      if (!member) {
        return res.status(404).json({ message: "Member not found" });
      }

      if (member.claimToken !== claimToken) {
        return res.status(401).json({ message: "Invalid claim token" });
      }

      // Build update object with only provided fields
      const updates: any = {};
      if (memberLocation !== undefined) updates.memberLocation = memberLocation;
      if (memberBudgetMin !== undefined) updates.memberBudgetMin = memberBudgetMin;
      if (memberBudgetMax !== undefined) updates.memberBudgetMax = memberBudgetMax;
      if (memberAvailability !== undefined) updates.memberAvailability = memberAvailability;

      // Update preferences
      const updatedMember = await storage.updateMember(req.params.id, updates);

      res.json(updatedMember);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  // Update member constraints from RSVP follow-ups (no auth required, validates claim token)
  app.patch("/api/members/:id/constraints", async (req, res) => {
    try {
      const { memberConstraints, claimToken } = req.body;

      if (!claimToken) {
        return res.status(401).json({ message: "Claim token required" });
      }

      // Verify the claim token matches
      const member = await storage.getMember(req.params.id);
      if (!member) {
        return res.status(404).json({ message: "Member not found" });
      }

      if (member.claimToken !== claimToken) {
        return res.status(401).json({ message: "Invalid claim token" });
      }

      // Update constraints
      const updatedMember = await storage.updateMember(req.params.id, {
        memberConstraints,
      });

      res.json(updatedMember);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  // Voting Events Routes

  // Get all voting events (top 10 with vote counts)
  app.get("/api/voting-events", async (req, res) => {
    try {
      const events = await storage.getVotingEvents();
      res.json(events);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Get group-specific voting events (top 10 with vote counts)
  app.get("/api/groups/:groupId/voting-events", async (req, res) => {
    try {
      const events = await storage.getGroupVotingEvents(req.params.groupId);
      res.json(events);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Create a voting event (authenticated) - enriches with Google Places data
  app.post("/api/voting-events", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const validatedEvent = insertVotingEventSchema.parse(req.body);
      const skipEnrichmentCheck = req.body.skipEnrichmentCheck === true;

      // Get the group to know the location for Google Places search
      const group = await storage.getGroup(validatedEvent.groupId);
      if (!group) {
        return res.status(404).json({ message: "Group not found" });
      }

      // Search Google Places to enrich the event with venue details
      let enrichedEvent = { ...validatedEvent };
      let enrichmentStatus: 'success' | 'no_results' | 'error' | 'skipped' = 'error';

      // Only check Google Places if not explicitly skipping
      if (!skipEnrichmentCheck) {
        try {
          const coordinates = group.latitude && group.longitude 
            ? { lat: parseFloat(group.latitude), lng: parseFloat(group.longitude) }
            : undefined;
          const places = await searchPlaces(
            validatedEvent.title, 
            group.locationBase,
            group.searchRadius || 2, // Use group's search radius
            coordinates
          );

          // Merge Google Places data if found
          if (places.length > 0) {
            const place = places[0];
            enrichedEvent = {
              ...validatedEvent,
              venueAddress: place.address || validatedEvent.venueAddress,
              googlePlaceId: place.placeId || validatedEvent.googlePlaceId,
              latitude: place.location?.lat?.toString() || validatedEvent.latitude,
              longitude: place.location?.lng?.toString() || validatedEvent.longitude,
              rating: place.rating || validatedEvent.rating,
              reviewCount: place.reviewCount || validatedEvent.reviewCount,
              priceLevel: place.priceLevel || validatedEvent.priceLevel,
              photoUrl: place.photoUrl || validatedEvent.photoUrl,
            };

            enrichmentStatus = 'success';
            console.log(`[Voting Event] Enriched "${validatedEvent.title}" with Google Places data:`, {
              name: place.name,
              rating: place.rating,
              reviewCount: place.reviewCount,
              address: place.address,
            });
          } else {
            enrichmentStatus = 'no_results';
            console.log(`[Voting Event] No Google Places results for "${validatedEvent.title}"`);
            // Don't create event yet - let frontend ask for confirmation
            return res.json({ enrichmentStatus });
          }
        } catch (error) {
          enrichmentStatus = 'error';
          console.error(`[Voting Event] Google Places enrichment failed for "${validatedEvent.title}":`, error);
          // Continue with un-enriched event - graceful degradation
        }
      } else {
        enrichmentStatus = 'skipped';
        console.log(`[Voting Event] Skipping enrichment check for "${validatedEvent.title}"`);
      }

      const event = await storage.createVotingEvent(enrichedEvent, userId);
      res.json({ event, enrichmentStatus });
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  // Update a voting event (authenticated)
  app.patch("/api/voting-events/:id", isAuthenticated, async (req: any, res) => {
    try {
      const event = await storage.getVotingEvent(req.params.id);
      if (!event) {
        return res.status(404).json({ message: "Event not found" });
      }

      const userId = req.user.claims.sub;
      if (event.createdBy !== userId) {
        return res.status(403).json({ message: "Unauthorized to edit this event" });
      }

      const validatedUpdates = updateVotingEventSchema.parse(req.body);
      const updatedEvent = await storage.updateVotingEvent(req.params.id, validatedUpdates);
      res.json(updatedEvent);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  // Delete a voting event (authenticated)
  app.delete("/api/voting-events/:id", isAuthenticated, async (req: any, res) => {
    try {
      const event = await storage.getVotingEvent(req.params.id);
      if (!event) {
        return res.status(404).json({ message: "Event not found" });
      }

      const userId = req.user.claims.sub;
      if (event.createdBy !== userId) {
        return res.status(403).json({ message: "Unauthorized to delete this event" });
      }

      await storage.deleteVotingEvent(req.params.id);
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Cast a vote (authenticated)
  app.post("/api/voting-events/:id/vote", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { voteType } = req.body;

      if (!['upvote', 'downvote'].includes(voteType)) {
        return res.status(400).json({ message: "Invalid vote type" });
      }

      const vote = await storage.castVote(req.params.id, userId, voteType);
      
      const event = await storage.getVotingEvent(req.params.id);
      if (event?.groupId) {
        await trackFeedbackAndMaybeAnalyze(event.groupId);
      }
      
      res.json(vote);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  // Remove a vote (authenticated)
  app.delete("/api/voting-events/:id/vote", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      await storage.removeVote(req.params.id, userId);
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Get votes for an event
  app.get("/api/voting-events/:id/votes", async (req, res) => {
    try {
      const votes = await storage.getEventVotes(req.params.id);
      res.json(votes);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Get user's vote for an event (authenticated)
  app.get("/api/voting-events/:id/my-vote", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const vote = await storage.getUserVote(req.params.id, userId);
      res.json(vote || null);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Retry activity generation
  app.post("/api/groups/:id/retry-generation", async (req, res) => {
    try {
      const group = await storage.getGroup(req.params.id);
      if (!group) {
        return res.status(404).json({ message: "Group not found" });
      }

      // Accept temporary instructions from the request body
      const { tempInstructions } = req.body;

      // Combine permanent and temporary instructions
      const combinedInstructions = [
        group.additionalInstructions,
        tempInstructions
      ].filter(Boolean).join('\n');

      // Reset status and trigger regeneration
      await storage.updateGroupStatus(req.params.id, "pending");

      generateAndStoreActivities(req.params.id, {
        locationBase: group.locationBase,
        budgetMin: group.budgetMin,
        budgetMax: group.budgetMax,
        meetingFrequency: group.meetingFrequency,
        availability: group.availability,
        closenessLevel: group.closenessLevel,
        noveltyPreference: group.noveltyPreference,
        pastPreferences: group.pastPreferences,
        additionalInstructions: combinedInstructions || group.additionalInstructions,
      });

      res.json({ success: true, message: "Activity generation restarted" });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Regenerate specific category
  app.post("/api/groups/:id/activities/regenerate-category", async (req, res) => {
    try {
      const group = await storage.getGroup(req.params.id);
      if (!group) {
        return res.status(404).json({ message: "Group not found" });
      }

      const { category, currentVenueNames, checkedActivityIds } = req.body;

      if (!category || !['meal', 'cafes', 'drinks', 'dessert', 'experiences'].includes(category)) {
        return res.status(400).json({ message: "Invalid category" });
      }

      console.log(`[Category Regen] Regenerating ${category} for group ${req.params.id}`);
      console.log(`[Category Regen] Avoiding ${currentVenueNames?.length || 0} current venues`);
      console.log(`[Category Regen] Preserving ${checkedActivityIds?.length || 0} checked activities`);

      // Calculate how many new activities we need
      const existingActivities = await storage.getGroupActivities(req.params.id);
      const checkedIds = new Set(checkedActivityIds || []);
      let checkedCount = 0;

      for (const a of existingActivities) {
        const activityCategory = await categorizeVenue(a.venueName, a.venueType);
        if (activityCategory === category && checkedIds.has(a.id)) {
          checkedCount++;
        }
      }

      const neededCount = 3 - checkedCount;
      console.log(`[Category Regen] Need ${neededCount} new activities (have ${checkedCount} checked)`);

      if (neededCount <= 0) {
        console.log(`[Category Regen] Category already has 3 cards (all checked), skipping regeneration`);
        return res.json([]);
      }

      // Get feedback data for AI context
      const previousFeedback = existingActivities
        .filter(a => a.feedback)
        .map(a => ({
          venueName: a.venueName,
          venueType: a.venueType,
          feedback: a.feedback!,
          description: a.description
        }));

      const votingEvents = await storage.getGroupVotingEvents(req.params.id);
      const votingFeedback = votingEvents
        .filter(e => e.netVotes !== 0 && e.venueType)
        .map(e => ({
          venueName: e.title,
          venueType: e.venueType!,
          upvotes: e.upvotes,
          downvotes: e.downvotes,
          netVotes: e.netVotes,
          description: e.description || ''
        }));

      const preferenceSignals = await storage.getGroupPreferenceSignals(req.params.id);
      const likedConcepts = preferenceSignals
        .filter(s => s.feedback === 'like')
        .map(s => s.conceptDescription);
      const passedConcepts = preferenceSignals
        .filter(s => s.feedback === 'pass')
        .map(s => s.conceptDescription);

      // Retry logic to ensure we get enough quality venues
      let allValidActivities: any[] = [];
      const seenVenues = new Set<string>(); // Track across attempts

      // Add existing venues (both checked and current) to prevent duplicates
      for (const venue of existingActivities) {
        const venueKey = venue.googlePlaceId || venue.venueName.toLowerCase();
        seenVenues.add(venueKey);
      }
      for (const venue of currentVenueNames || []) {
        seenVenues.add(venue.toLowerCase());
      }

      let attempt = 0;
      const maxAttempts = 3;

      while (allValidActivities.length < neededCount && attempt < maxAttempts) {
        attempt++;
        console.log(`[Category Regen] Attempt ${attempt}/${maxAttempts}: Need ${neededCount - allValidActivities.length} more venues`);

        // Get member constraints for this category regeneration
        const groupMembers = await storage.getGroupMembers(group.id);
        const memberConstraints = groupMembers
          .filter(m => m.memberConstraints)
          .map(m => m.memberConstraints as { scheduleConflicts?: string[]; budgetConcern?: boolean; distanceConcern?: boolean; notes?: string });

        // Generate suggestions for this specific category
        const suggestions = await generateActivitySuggestions({
          locationBase: group.locationBase,
          budgetMin: group.budgetMin,
          budgetMax: group.budgetMax,
          meetingFrequency: group.meetingFrequency,
          availability: group.availability,
          closenessLevel: group.closenessLevel,
          noveltyPreference: group.noveltyPreference,
          activityCategories: group.activityCategories || undefined,
          pastPreferences: group.pastPreferences || undefined,
          additionalInstructions: group.additionalInstructions || undefined,
          searchRadius: group.searchRadius || undefined,
          previousFeedback: previousFeedback.length > 0 ? previousFeedback : undefined,
          votingFeedback: votingFeedback.length > 0 ? votingFeedback : undefined,
          likedConcepts: likedConcepts.length > 0 ? likedConcepts : undefined,
          passedConcepts: passedConcepts.length > 0 ? passedConcepts : undefined,
          previouslySuggestedVenues: currentVenueNames || [],
          targetCategories: [category],
          memberConstraints: memberConstraints.length > 0 ? memberConstraints : undefined,
        });

        console.log(`[Category Regen] Attempt ${attempt}: Got ${suggestions.length} suggestions for ${category}`);

        // Enrich with Google Places
        const coordinates = group.latitude && group.longitude 
          ? { lat: parseFloat(group.latitude), lng: parseFloat(group.longitude) }
          : undefined;
        const enrichedActivities = await Promise.all(
        suggestions.map(async (suggestion) => {
          const places = await searchPlaces(
            suggestion.searchQuery,
            group.locationBase,
            group.searchRadius || 2,
            coordinates
          );

          const searchRadius = group.searchRadius || 2;
          const qualityFiltered = places.filter(place => {
            const rating = parseFloat(place.rating || '0');
            const reviewCount = place.reviewCount || 0;

            // Stricter quality requirements to ensure legitimacy
            if (searchRadius <= 2) {
              return rating >= 3.5 && reviewCount >= 20;
            } else if (searchRadius <= 10) {
              return rating >= 3.8 && reviewCount >= 50;
            } else if (searchRadius <= 30) {
              return rating >= 4.0 && reviewCount >= 100;
            } else {
              return rating >= 4.2 && reviewCount >= 150;
            }
          });

          // Apply budget filtering based on Google Places price level
          const budgetFiltered = qualityFiltered.filter(place => {
            const priceLevel = parseInt(place.priceLevel || '0');
            const budgetMax = group.budgetMax;

            if (budgetMax < 50) {
              return priceLevel <= 1; // Free or $ only
            } else if (budgetMax < 100) {
              return priceLevel <= 2; // Free, $, or $$
            } else if (budgetMax < 200) {
              return priceLevel <= 3; // Free, $, $$, or $$$
            } else {
              return priceLevel <= 4; // All price levels
            }
          });

          // Only use venues that meet quality AND budget standards
          const finalPlaces = budgetFiltered;

          // Search for complementary places
          let complementaryPlace = null;
          let complementaryPlace2 = null;
          if (suggestion.complementaryFoodPlace && finalPlaces.length > 0 && finalPlaces[0].location) {
            const foodPlaces = await searchNearbyPlaces(
              suggestion.complementaryFoodPlace,
              finalPlaces[0].location,
              805,
              3.5
            );
            const validFoodPlaces = foodPlaces.filter(fp => fp.placeId !== finalPlaces[0].placeId);
            if (validFoodPlaces.length > 0) {
              complementaryPlace = validFoodPlaces[0];
            }
            if (validFoodPlaces.length > 1) {
              complementaryPlace2 = validFoodPlaces[1];
            }
          }

          if (finalPlaces.length > 0) {
            const place = finalPlaces[0];
            
            // CRITICAL: Only include venues with verified Google Places data
            // Reject venues missing essential information (rating, address, or photo)
            if (!place.rating || !place.address || !place.photoUrl) {
              console.log(`[Category Regen] Rejecting ${place.name} - missing critical data (rating: ${place.rating}, address: ${!!place.address}, photo: ${!!place.photoUrl})`);
              return null;
            }
            
            return {
              aiSuggestedName: suggestion.venueName,
              venueName: place.name,
              venueAddress: place.address,
              venueType: suggestion.venueType,
              description: suggestion.description,
              googlePlaceId: place.placeId,
              latitude: place.location?.lat?.toString() || null,
              longitude: place.location?.lng?.toString() || null,
              rating: place.rating,
              reviewCount: place.reviewCount || null,
              priceLevel: place.priceLevel,
              photoUrl: place.photoUrl,
              googleReview: place.review || null,
              aiReasoning: suggestion.reasoning,
              timeCategory: categorizeByTime(suggestion.venueType),
              category: categorizeVenue(place.name, suggestion.venueType, place.types),
              complementaryPlaceName: complementaryPlace?.name || null,
              complementaryPlaceAddress: complementaryPlace?.address || null,
              complementaryPlaceId: complementaryPlace?.placeId || null,
              complementaryPlacePhotoUrl: complementaryPlace?.photoUrl || null,
              complementaryPlaceRating: complementaryPlace?.rating || null,
              complementaryPlaceName2: complementaryPlace2?.name || null,
              complementaryPlaceAddress2: complementaryPlace2?.address || null,
              complementaryPlaceId2: complementaryPlace2?.placeId || null,
              complementaryPlacePhotoUrl2: complementaryPlace2?.photoUrl || null,
              complementaryPlaceRating2: complementaryPlace2?.rating || null,
            };
          }
          
          console.log(`[Category Regen] Rejecting ${suggestion.venueName} - no Google Places results found`);
          return null;
        })
      );

        const validActivities = enrichedActivities.filter(a => a !== null);
        console.log(`[Category Regen] Attempt ${attempt}: Got ${validActivities.length} enriched activities`);

        // Add unique activities to our collection
        for (const activity of validActivities) {
          const venueKey = activity.googlePlaceId || activity.venueName.toLowerCase();
          if (!seenVenues.has(venueKey) && allValidActivities.length < neededCount) {
            seenVenues.add(venueKey);
            allValidActivities.push(activity);
            console.log(`[Category Regen] Added unique venue: ${activity.venueName} (${allValidActivities.length}/${neededCount})`);
          }
        }

        console.log(`[Category Regen] After attempt ${attempt}: Have ${allValidActivities.length}/${neededCount} venues`);
      }

      console.log(`[Category Regen] Retry complete: Collected ${allValidActivities.length}/${neededCount} valid activities`);

      // Check if we successfully collected enough venues
      if (allValidActivities.length < neededCount) {
        const errorMsg = `Could not find enough quality venues after ${maxAttempts} attempts. Found ${allValidActivities.length}/${neededCount} venues. Try adjusting search radius or preferences.`;
        console.error(`[Category Regen] ${errorMsg}`);
        return res.status(400).json({ message: errorMsg });
      }

      // Delete unchecked activities in this category
      const uncheckedActivities = [];

      for (const a of existingActivities) {
        const activityCategory = await categorizeVenue(a.venueName, a.venueType);
        if (activityCategory === category && !checkedIds.has(a.id)) {
          uncheckedActivities.push(a);
        }
      }

      console.log(`[Category Regen] Category has ${checkedCount} checked activities, ${uncheckedActivities.length} unchecked`);

      // Delete unchecked activities
      for (const activity of uncheckedActivities) {
        await db.delete(activitiesTable).where(eq(activitiesTable.id, activity.id));
      }
      console.log(`[Category Regen] Deleted ${uncheckedActivities.length} unchecked activities`);

      // Insert new activities to reach exactly 3 total for this category
      const newActivities = [];
      console.log(`[Category Regen] Inserting ${Math.min(neededCount, allValidActivities.length)}/${neededCount} new activities`);

      for (let i = 0; i < Math.min(neededCount, allValidActivities.length); i++) {
        const activityData = allValidActivities[i];
        const activityCategory = await categorizeVenue(activityData.venueName, activityData.venueType);
        const newActivity = await storage.createActivity({
          ...activityData,
          groupId: req.params.id,
          category: activityCategory,
        });
        newActivities.push(newActivity);
      }

      const finalCount = checkedCount + newActivities.length;
      console.log(`[Category Regen] Created ${newActivities.length} new activities. Category now has ${finalCount}/3 cards`);

      res.json(newActivities);
    } catch (error: any) {
      console.error("[Category Regen] Error:", error);
      res.status(500).json({ message: error.message });
    }
  });

  // Analyze preference patterns and generate insights
  app.post("/api/groups/:id/analyze-patterns", async (req, res) => {
    try {
      const group = await storage.getGroup(req.params.id);
      if (!group) {
        return res.status(404).json({ message: "Group not found" });
      }

      console.log(`[AI Insights] Analyzing preference patterns for group ${req.params.id}`);

      // Gather all feedback data
      const activities = await storage.getAllGroupActivities(req.params.id);
      const notThisFeedback = activities
        .filter(a => a.feedback === 'less')
        .map(a => ({
          venueName: a.venueName,
          venueType: a.venueType,
          description: a.description
        }));

      const votingEvents = await storage.getGroupVotingEvents(req.params.id);
      const votingFeedback = votingEvents
        .filter(e => e.netVotes !== 0 && e.venueType)
        .map(e => ({
          venueName: e.title,
          venueType: e.venueType!,
          upvotes: e.upvotes,
          downvotes: e.downvotes,
          netVotes: e.netVotes
        }));

      const preferenceSignals = await storage.getGroupPreferenceSignals(req.params.id);
      const likedConcepts = preferenceSignals
        .filter(s => s.feedback === 'like')
        .map(s => s.conceptDescription);
      const passedConcepts = preferenceSignals
        .filter(s => s.feedback === 'pass')
        .map(s => s.conceptDescription);

      console.log(`[AI Insights] Feedback data: ${notThisFeedback.length} not-this, ${votingFeedback.length} voting, ${likedConcepts.length} likes, ${passedConcepts.length} passes`);

      // Generate insights using OpenAI
      const patterns = await analyzePreferencePatterns({
        notThisFeedback,
        votingFeedback,
        likedConcepts,
        passedConcepts
      });

      // Update group with insights
      await db.update(groupsTable)
        .set({
          preferenceInsights: patterns,
          lastInsightsUpdate: new Date()
        })
        .where(eq(groupsTable.id, req.params.id));

      console.log(`[AI Insights] Generated and saved ${patterns.length} patterns for group ${req.params.id}`);

      res.json({ patterns });
    } catch (error: any) {
      console.error("[AI Insights] Error:", error);
      res.status(500).json({ message: error.message });
    }
  });

  // Clear all activities for a group
  app.delete("/api/groups/:id/activities", async (req, res) => {
    try {
      const group = await storage.getGroup(req.params.id);
      if (!group) {
        return res.status(404).json({ message: "Group not found" });
      }

      await storage.deleteAllGroupActivities(req.params.id);
      res.json({ success: true, message: "All activities cleared" });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Send email invitations (simplified - logs to console for MVP)
  app.post("/api/groups/:id/send-invitations", async (req, res) => {
    try {
      const group = await storage.getGroup(req.params.id);
      if (!group) {
        return res.status(404).json({ message: "Group not found" });
      }

      const members = await storage.getGroupMembers(req.params.id);
      const inviteLink = `${req.headers.origin || 'http://localhost:5000'}/join/${group.shareableLink}`;

      // For MVP: Log email invitations to console
      // In production, this would integrate with an email service
      const emailsSent = members
        .filter(m => m.email && !m.invitationSent)
        .map(m => {
          console.log(`
=== EMAIL INVITATION ===
To: ${m.email}
Subject: Join ${group.name} - Group Activity Planner
Body:
You've been invited to join "${group.name}"!

${m.name ? `Hi ${m.name},` : 'Hi there,'}

Click the link below to join the group and see AI-powered activity suggestions:
${inviteLink}

Looking forward to planning great activities together!
========================
          `);
          return m.email;
        });

      // Mark invitations as sent
      if (emailsSent.length > 0) {
        await storage.markInvitationsSent(req.params.id);
      }

      res.json({ 
        success: true, 
        emailsSent: emailsSent.length,
        message: `Invitations logged for ${emailsSent.length} members. Check server console for details.`
      });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Generate swipeable concepts for preference refinement
  app.post("/api/groups/:id/swipe-concepts", async (req, res) => {
    try {
      const group = await storage.getGroup(req.params.id);
      if (!group) {
        return res.status(404).json({ message: "Group not found" });
      }

      // Get previously seen concepts to avoid repeats
      const previousSignals = await storage.getGroupPreferenceSignals(req.params.id);
      const previouslySeenConcepts = previousSignals.map(s => s.conceptDescription);

      const concepts = await generateSwipeConcepts({
        locationBase: group.locationBase,
        budgetMin: group.budgetMin,
        budgetMax: group.budgetMax,
        activityCategories: group.activityCategories || [],
        pastPreferences: group.pastPreferences || '',
        previouslySeenConcepts,
      });

      res.json({ concepts });
    } catch (error: any) {
      console.error("Error generating swipe concepts:", error);
      res.status(500).json({ message: error.message });
    }
  });

  // Save swipe feedback (like or pass)
  app.post("/api/groups/:id/swipe-feedback", async (req, res) => {
    try {
      const { conceptType, conceptDescription, feedback } = req.body;

      if (!conceptType || !conceptDescription || !feedback) {
        return res.status(400).json({ message: "Missing required fields" });
      }

      if (feedback !== 'like' && feedback !== 'pass') {
        return res.status(400).json({ message: "Feedback must be 'like' or 'pass'" });
      }

      const signal = await storage.createPreferenceSignal({
        groupId: req.params.id,
        conceptType,
        conceptDescription,
        feedback,
      });

      await trackFeedbackAndMaybeAnalyze(req.params.id);

      res.json({ signal });
    } catch (error: any) {
      console.error("Error saving swipe feedback:", error);
      res.status(500).json({ message: error.message });
    }
  });

  // Validate and create itinerary
  app.post("/api/groups/:groupId/itineraries/validate", isAuthenticated, async (req: any, res) => {
    try {
      const { groupId } = req.params;
      const { selectedVenues } = req.body; // Array of { sourceType, sourceId }
      const userId = req.user.claims.sub;

      if (!selectedVenues || !Array.isArray(selectedVenues) || selectedVenues.length === 0) {
        return res.status(400).json({ message: "No venues selected" });
      }

      // Fetch venue details with location data
      const venuesWithDetails = await Promise.all(
        selectedVenues.map(async (v: { sourceType: string; sourceId: string }) => {
          if (v.sourceType === 'activity') {
            const activities = await storage.getGroupActivities(groupId);
            const activity = activities.find(a => a.id === v.sourceId);
            if (!activity) return null;

            // Fetch location from Google Places if we have a place ID
            let location: { lat: number; lng: number } | undefined;
            if (activity.googlePlaceId) {
              const placeDetails = await import('./google-places').then(m => m.getPlaceDetails(activity.googlePlaceId!));
              if (placeDetails?.location) {
                location = placeDetails.location;
              }
            }

            return {
              sourceType: 'activity' as const,
              sourceId: activity.id,
              venueName: activity.venueName,
              venueType: activity.venueType,
              venueAddress: activity.venueAddress,
              googlePlaceId: activity.googlePlaceId,
              location,
            };
          } else {
            const events = await storage.getGroupVotingEvents(groupId);
            const event = events.find(e => e.id === v.sourceId);
            if (!event) return null;

            // Fetch location from Google Places if we have a place ID
            let location: { lat: number; lng: number } | undefined;
            if (event.googlePlaceId) {
              const placeDetails = await import('./google-places').then(m => m.getPlaceDetails(event.googlePlaceId!));
              if (placeDetails?.location) {
                location = placeDetails.location;
              }
            }

            return {
              sourceType: 'voting_event' as const,
              sourceId: event.id,
              venueName: event.title,
              venueType: event.venueType || 'venue',
              venueAddress: event.venueAddress,
              googlePlaceId: event.googlePlaceId,
              location,
            };
          }
        })
      );

      const validVenues = venuesWithDetails.filter(Boolean);

      if (validVenues.length === 0) {
        return res.status(400).json({ message: "No valid venues found" });
      }

      // Validate itinerary with AI
      const validation = await validateItinerary(validVenues as any);

      if (!validation.isValid) {
        return res.status(400).json({
          message: validation.validationNotes,
          issues: validation.issues,
        });
      }

      // Create itinerary with proposed order
      const itinerary = await storage.createItinerary(
        {
          groupId,
          status: 'proposed',
          aiValidationNotes: validation.validationNotes,
          proposedOrder: validation.proposedOrder,
        },
        userId,
        validation.proposedOrder.map(sourceId => {
          const venue = validVenues.find(v => v?.sourceId === sourceId);
          return {
            sourceType: venue?.sourceType || 'activity',
            sourceId: sourceId,
          };
        })
      );

      // Fetch full itinerary with items
      const fullItinerary = await storage.getItinerary(itinerary.id);

      res.json({
        itinerary: fullItinerary,
        validation: {
          notes: validation.validationNotes,
          issues: validation.issues,
        },
      });
    } catch (error: any) {
      console.error("Error validating itinerary:", error);
      res.status(500).json({ message: error.message });
    }
  });

  // Get nearby add-on suggestions for selected venues
  app.post("/api/groups/:groupId/nearby-suggestions", async (req, res) => {
    try {
      const { selectedVenues } = req.body; // Array of { sourceType, sourceId }
      const { groupId } = req.params;

      if (!selectedVenues || !Array.isArray(selectedVenues) || selectedVenues.length === 0) {
        return res.json({ suggestions: [] });
      }

      // Fetch venue details with location data
      const venuesWithLocations = await Promise.all(
        selectedVenues.map(async (v: { sourceType: string; sourceId: string }) => {
          if (v.sourceType === 'activity') {
            const activities = await storage.getGroupActivities(groupId);
            const activity = activities.find(a => a.id === v.sourceId);
            if (!activity?.googlePlaceId) return null;

            const placeDetails = await import('./google-places').then(m => m.getPlaceDetails(activity.googlePlaceId!));
            if (!placeDetails?.location) return null;

            return {
              location: placeDetails.location,
              placeId: activity.googlePlaceId,
              name: activity.venueName,
            };
          } else {
            const events = await storage.getGroupVotingEvents(groupId);
            const event = events.find(e => e.id === v.sourceId);
            if (!event?.googlePlaceId) return null;

            const placeDetails = await import('./google-places').then(m => m.getPlaceDetails(event.googlePlaceId!));
            if (!placeDetails?.location) return null;

            return {
              location: placeDetails.location,
              placeId: event.googlePlaceId,
              name: event.title,
            };
          }
        })
      );

      const validLocations = venuesWithLocations.filter(Boolean);

      if (validLocations.length === 0) {
        return res.json({ suggestions: [] });
      }

      // Search for nearby high-rated places around the first venue
      const centerLocation = validLocations[0]!.location;
      const selectedPlaceIds = validLocations.map(v => v!.placeId);

      // Search for various types of nearby venues
      const searchQueries = ['restaurant', 'cafe', 'bar', 'dessert', 'ice cream'];
      const allNearbyPlaces = await Promise.all(
        searchQueries.map(query => 
          searchNearbyPlaces(query, centerLocation, 805, 4.0) // 0.5 miles = 805 meters, 4.0+ rating
        )
      );

      // Flatten and deduplicate
      const uniquePlaces = new Map();
      allNearbyPlaces.flat().forEach(place => {
        // Skip if it's one of the selected venues
        if (selectedPlaceIds.includes(place.placeId)) return;

        if (!uniquePlaces.has(place.placeId)) {
          uniquePlaces.set(place.placeId, place);
        }
      });

      // Take top 3 suggestions by rating
      const suggestions = Array.from(uniquePlaces.values())
        .sort((a, b) => {
          const ratingA = parseFloat(a.rating || '0');
          const ratingB = parseFloat(b.rating || '0');
          return ratingB - ratingA;
        })
        .slice(0, 3);

      res.json({ suggestions });
    } catch (error: any) {
      console.error("Error fetching nearby suggestions:", error);
      res.status(500).json({ message: error.message });
    }
  });

  // Search for venues by query string
  app.get("/api/groups/:groupId/search-venues", async (req, res) => {
    try {
      const { query } = req.query;
      const { groupId } = req.params;

      if (!query || typeof query !== 'string' || query.trim().length < 2) {
        return res.json({ results: [] });
      }

      // Get group location for context
      const group = await storage.getGroup(groupId);
      if (!group) {
        return res.status(404).json({ message: "Group not found" });
      }

      // Use Google Places Text Search with group location as context
      const searchQuery = query.trim();
      const location = group.locationBase;
      const radius = group.searchRadius || 10;
      const coordinates = group.latitude && group.longitude
        ? { lat: parseFloat(group.latitude), lng: parseFloat(group.longitude) }
        : undefined;

      const results = await searchPlaces(searchQuery, location, radius, coordinates);

      // Return top 10 results
      const limitedResults = results.slice(0, 10).map(place => ({
        placeId: place.placeId,
        name: place.name,
        address: place.address,
        photoUrl: place.photoUrl,
        rating: place.rating,
        reviewCount: place.reviewCount,
        types: place.types || [],
      }));

      res.json({ results: limitedResults });
    } catch (error: any) {
      console.error("Error searching venues:", error);
      res.status(500).json({ message: error.message });
    }
  });

  // Get group itineraries
  app.get("/api/groups/:groupId/itineraries", async (req, res) => {
    try {
      const itineraries = await storage.getGroupItineraries(req.params.groupId);
      res.json(itineraries);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Delete itinerary item
  app.delete("/api/itinerary-items/:id", async (req, res) => {
    try {
      const itemId = req.params.id;

      // Get the item to find its itinerary
      const item = await storage.getItineraryItemById(itemId);
      if (!item) {
        return res.status(404).json({ message: "Itinerary item not found" });
      }

      // Delete the item
      await storage.deleteItineraryItem(itemId);

      res.json({ message: "Itinerary item deleted successfully" });
    } catch (error: any) {
      console.error("[Delete Itinerary Item] Error:", error);
      res.status(500).json({ message: error.message || "Failed to delete itinerary item" });
    }
  });

  // Update itinerary item order
  app.patch("/api/itineraries/:id/order", isAuthenticated, async (req, res) => {
    try {
      const { proposedOrder } = req.body; // New array of sourceIds

      const itinerary = await storage.updateItinerary(req.params.id, {
        proposedOrder,
      });

      res.json(itinerary);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Delete itinerary
  app.delete("/api/itineraries/:id", isAuthenticated, async (req, res) => {
    try {
      await storage.deleteItinerary(req.params.id);
      res.json({ message: "Itinerary deleted" });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Admin endpoint to backfill coordinates for existing groups
  // Protected endpoint - requires authentication
  app.post("/api/admin/backfill-coordinates", isAuthenticated, async (req, res) => {
    try {
      const groups = await storage.getAllGroups();
      let backfilled = 0;
      let failed = 0;
      let skipped = 0;

      for (const group of groups) {
        // Skip if already has coordinates
        if (group.latitude && group.longitude) {
          skipped++;
          continue;
        }

        // Skip if no location to geocode
        if (!group.locationBase || group.locationBase.trim() === '') {
          skipped++;
          continue;
        }

        // Geocode the location
        const geocoded = await geocodeLocation(group.locationBase);
        if (geocoded) {
          await storage.updateGroup(group.id, {
            latitude: geocoded.latitude.toString(),
            longitude: geocoded.longitude.toString(),
          });
          console.log(`Backfilled coordinates for group ${group.id}: ${group.locationBase} -> (${geocoded.latitude}, ${geocoded.longitude})`);
          backfilled++;
        } else {
          console.warn(`Failed to geocode location for group ${group.id}: ${group.locationBase}`);
          failed++;
        }
      }

      res.json({
        success: true,
        message: `Backfilled ${backfilled} groups, ${skipped} already had coordinates, ${failed} failed to geocode`,
        backfilled,
        skipped,
        failed,
      });
    } catch (error: any) {
      console.error("Error backfilling coordinates:", error);
      res.status(500).json({ message: error.message });
    }
  });

  const httpServer = createServer(app);

  return httpServer;
}

// Helper function to generate and store activities
async function generateAndStoreActivities(groupId: string, groupData: any) {
  try {
    // Update status to generating
    await storage.updateGroupStatus(groupId, "generating");

    console.log(`[AI Generation] Starting for group ${groupId}`);
    console.log(`[AI Generation] Group data:`, JSON.stringify(groupData, null, 2));

    // Get ALL activities (including archived) to avoid repeating venue names
    const allActivities = await storage.getAllGroupActivities(groupId);

    // Track BOTH AI suggested types AND actual Google business names to prevent duplicates
    const previouslySuggestedVenues = [
      // AI suggested types (e.g., "Dessert Shop", "Public Park")
      ...allActivities
        .filter(a => a.aiSuggestedName)
        .map(a => a.aiSuggestedName!),
      // Actual Google business names (e.g., "Sweet Indulgence", "Central Park")
      ...allActivities
        .filter(a => a.venueName)
        .map(a => a.venueName),
      // Complementary food place names (prevent duplicate dessert/food suggestions)
      ...allActivities
        .filter(a => a.complementaryPlaceName)
        .map(a => a.complementaryPlaceName!),
      ...allActivities
        .filter(a => a.complementaryPlaceName2)
        .map(a => a.complementaryPlaceName2!)
    ].filter((name, index, self) => name && self.indexOf(name) === index); // Remove nulls and duplicates

    // Get existing (non-archived) activities with feedback for this group
    const existingActivities = await storage.getGroupActivities(groupId);
    const previousFeedback = existingActivities
      .filter(a => a.feedback)
      .map(a => ({
        venueName: a.venueName,
        venueType: a.venueType,
        feedback: a.feedback!,
        description: a.description
      }));

    // Get voting events (Favorites list) with vote counts to incorporate into AI
    const votingEvents = await storage.getGroupVotingEvents(groupId);
    const votingFeedback = votingEvents
      .filter(e => e.netVotes !== 0 && e.venueType) // Only include events with votes and valid venue type
      .map(e => ({
        venueName: e.title,
        venueType: e.venueType!,
        upvotes: e.upvotes,
        downvotes: e.downvotes,
        netVotes: e.netVotes,
        description: e.description || ''
      }));

    // Get preference signals from swipe sessions
    const preferenceSignals = await storage.getGroupPreferenceSignals(groupId);
    const likedConcepts = preferenceSignals
      .filter(s => s.feedback === 'like')
      .map(s => s.conceptDescription);
    const passedConcepts = preferenceSignals
      .filter(s => s.feedback === 'pass')
      .map(s => s.conceptDescription);

    // Get member constraints from RSVP feedback
    const groupMembers = await storage.getGroupMembers(groupId);
    const memberConstraints = groupMembers
      .filter(m => m.memberConstraints)
      .map(m => m.memberConstraints as { scheduleConflicts?: string[]; budgetConcern?: boolean; distanceConcern?: boolean; notes?: string });

    console.log(`[AI Generation] Found ${previousFeedback.length} activities with feedback`);
    console.log(`[AI Generation] Found ${votingFeedback.length} favorites with voting data`);
    console.log(`[AI Generation] Found ${likedConcepts.length} liked concepts from swipe sessions`);
    console.log(`[AI Generation] Found ${passedConcepts.length} passed concepts from swipe sessions`);
    console.log(`[AI Generation] Found ${memberConstraints.length} members with constraints`);
    console.log(`[AI Generation] Found ${previouslySuggestedVenues.length} previously suggested venues to avoid`);

    // Archive old activities before generating new ones (preserves feedback for AI)
    await storage.archiveGroupActivities(groupId);
    console.log(`[AI Generation] Archived existing activities for group ${groupId}`);

    // Track all unique activities across retries
    const allUniqueActivities: any[] = [];
    const seenVenues = new Set<string>(); // Track across all attempts
    let attempt = 0;
    const maxAttempts = 5; // Try up to 5 times to ensure exactly 3 cards per category
    let targetCategories: string[] | undefined = undefined; // For targeted retry

    // Helper function to check if we have exactly 3 cards per category
    const hasBalancedDistribution = (activities: any[]): boolean => {
      const categoryCounts: Record<string, number> = {
        meal: 0,
        cafes: 0,
        drinks: 0,
        dessert: 0,
        experiences: 0
      };

      for (const activity of activities) {
        if (activity.category) {
          categoryCounts[activity.category] = (categoryCounts[activity.category] || 0) + 1;
        }
      }

      // All categories must have at least 3 cards
      return Object.values(categoryCounts).every(count => count >= 3);
    };

    while (!hasBalancedDistribution(allUniqueActivities) && attempt < maxAttempts) {
      attempt++;
      const attemptStart = Date.now();
      const needed = 15 - allUniqueActivities.length;
      console.log(`[AI Generation] Attempt ${attempt}/${maxAttempts}: Need ${needed} more unique activities (have ${allUniqueActivities.length})`);

      // Generate AI suggestions with feedback and list of venues to avoid
      const aiPromptStart = Date.now();
      const suggestions = await generateActivitySuggestions({
        locationBase: groupData.locationBase,
        budgetMin: groupData.budgetMin,
        budgetMax: groupData.budgetMax,
        meetingFrequency: groupData.meetingFrequency,
        availability: groupData.availability,
        closenessLevel: groupData.closenessLevel,
        noveltyPreference: groupData.noveltyPreference,
        activityCategories: groupData.activityCategories,
        pastPreferences: groupData.pastPreferences,
        additionalInstructions: groupData.additionalInstructions,
        searchRadius: groupData.searchRadius, // Pass search radius to AI
        previousFeedback: previousFeedback.length > 0 ? previousFeedback : undefined,
        votingFeedback: votingFeedback.length > 0 ? votingFeedback : undefined,
        likedConcepts: likedConcepts.length > 0 ? likedConcepts : undefined,
        passedConcepts: passedConcepts.length > 0 ? passedConcepts : undefined,
        previouslySuggestedVenues: previouslySuggestedVenues.length > 0 ? previouslySuggestedVenues : undefined,
        targetCategories: targetCategories, // Pass underrepresented categories on retry
        memberConstraints: memberConstraints.length > 0 ? memberConstraints : undefined, // Pass member RSVP constraints
      });

      const aiPromptEnd = Date.now();
      console.log(`[AI Generation] Attempt ${attempt}: AI prompt took ${((aiPromptEnd - aiPromptStart) / 1000).toFixed(1)}s`);
      console.log(`[AI Generation] Attempt ${attempt}: Received ${suggestions.length} suggestions from OpenAI`);

      const googleSearchStart = Date.now();
      // For each suggestion, search Google Places with group's search radius
      const coordinates = groupData.latitude && groupData.longitude 
        ? { lat: parseFloat(groupData.latitude), lng: parseFloat(groupData.longitude) }
        : undefined;
      
      // Process all suggestions in parallel (30 at once for maximum speed)
      const batchSize = 30;
      const activitiesData: any[] = [];
      
      for (let i = 0; i < suggestions.length; i += batchSize) {
        const batch = suggestions.slice(i, i + batchSize);
        const batchResults = await Promise.all(
          batch.map(async (suggestion) => {
            const places = await searchPlaces(
              suggestion.searchQuery, 
              groupData.locationBase, 
              groupData.searchRadius || 2,
              coordinates
            );

          // Apply quality filtering based on search radius
          // Farther venues must have higher ratings and review counts
          const searchRadius = groupData.searchRadius || 2;
          const qualityFiltered = places.filter(place => {
            const rating = parseFloat(place.rating || '0');
            const reviewCount = place.reviewCount || 0;

            // Quality requirements by tier (stricter to ensure legitimacy):
            // < 2 miles (Nearby): 3.5+ stars, 20+ reviews
            // < 10 miles (Citywide): 3.8+ stars, 50+ reviews
            // < 30 miles (Special Trip): 4.0+ stars, 100+ reviews
            // < 50 miles (Road Trip): 4.2+ stars, 150+ reviews

            if (searchRadius <= 2) {
              return rating >= 3.5 && reviewCount >= 20;
            } else if (searchRadius <= 10) {
              return rating >= 3.8 && reviewCount >= 50;
            } else if (searchRadius <= 30) {
              return rating >= 4.0 && reviewCount >= 100;
            } else {
              return rating >= 4.2 && reviewCount >= 150;
            }
          });

          // Apply budget filtering based on Google Places price level
          const budgetFiltered = qualityFiltered.filter(place => {
            const priceLevel = parseInt(place.priceLevel || '0');
            const budgetMax = groupData.budgetMax;

            if (budgetMax < 50) {
              return priceLevel <= 1; // Free or $ only
            } else if (budgetMax < 100) {
              return priceLevel <= 2; // Free, $, or $$
            } else if (budgetMax < 200) {
              return priceLevel <= 3; // Free, $, $$, or $$$
            } else {
              return priceLevel <= 4; // All price levels
            }
          });

          // Only use venues that meet quality AND budget standards
          const finalPlaces = budgetFiltered;

          // Also search for complementary food places if suggested
          let complementaryPlace = null;
          let complementaryPlace2 = null;
          if (suggestion.complementaryFoodPlace && finalPlaces.length > 0 && finalPlaces[0].location) {
            // Use nearby search with distance and rating constraints (<0.5 miles, 3.5+ stars)
            const foodPlaces = await searchNearbyPlaces(
              suggestion.complementaryFoodPlace,
              finalPlaces[0].location,
              805, // 0.5 miles in meters
              3.5  // minimum rating
            );
            // Filter out the main venue from complementary results (avoid suggesting venue as its own complement)
            const validFoodPlaces = foodPlaces.filter(fp => fp.placeId !== finalPlaces[0].placeId);
            if (validFoodPlaces.length > 0) {
              complementaryPlace = validFoodPlaces[0];
            }
            if (validFoodPlaces.length > 1) {
              complementaryPlace2 = validFoodPlaces[1];
            }
          }

          if (finalPlaces.length > 0) {
            const place = finalPlaces[0];
            
            // CRITICAL: Only include venues with verified Google Places data
            // Reject venues missing essential information (rating, address, or photo)
            if (!place.rating || !place.address || !place.photoUrl) {
              console.log(`[AI Generation] Rejecting ${place.name} - missing critical data (rating: ${place.rating}, address: ${!!place.address}, photo: ${!!place.photoUrl})`);
              return null;
            }
            
            return {
              groupId,
              aiSuggestedName: suggestion.venueName, // Store what AI originally suggested
              venueName: place.name,
              venueAddress: place.address,
              venueType: suggestion.venueType,
              description: suggestion.description,
              googlePlaceId: place.placeId,
              latitude: place.location?.lat?.toString() || null,
              longitude: place.location?.lng?.toString() || null,
              rating: place.rating,
              reviewCount: place.reviewCount || null,
              priceLevel: place.priceLevel,
              photoUrl: place.photoUrl,
              googleReview: place.review || null, // Add positive review from Google
              aiReasoning: suggestion.reasoning,
              suggestedDate: null,
              suggestedTime: null,
              priceEstimate: suggestion.priceEstimate || null,
              timeConstraints: suggestion.timeConstraints || null,
              timeCategory: categorizeByTime(suggestion.venueType), // Categorize by time commitment
              complementaryPlaceName: complementaryPlace?.name || null,
              complementaryPlaceAddress: complementaryPlace?.address || null,
              complementaryPlaceId: complementaryPlace?.placeId || null,
              complementaryPlacePhotoUrl: complementaryPlace?.photoUrl || null,
              complementaryPlaceRating: complementaryPlace?.rating || null,
              complementaryPlaceName2: complementaryPlace2?.name || null,
              complementaryPlaceAddress2: complementaryPlace2?.address || null,
              complementaryPlaceId2: complementaryPlace2?.placeId || null,
              complementaryPlacePhotoUrl2: complementaryPlace2?.photoUrl || null,
              complementaryPlaceRating2: complementaryPlace2?.rating || null,
            };
          } else {
            // Reject suggestions with no Google Places results
            console.log(`[AI Generation] Rejecting ${suggestion.venueName} - no Google Places results found`);
            return null;
          }
          })
        );
        activitiesData.push(...batchResults);
      }

      const googleSearchEnd = Date.now();
      console.log(`[AI Generation] Attempt ${attempt}: Google Places search took ${((googleSearchEnd - googleSearchStart) / 1000).toFixed(1)}s`);
      console.log(`[AI Generation] Attempt ${attempt}: Created ${activitiesData.length} activities from Google Places`);

      // Filter out null activities (from failed Google Places searches)
      const validActivities = activitiesData.filter((a: any) => a !== null);
      console.log(`[AI Generation] After filtering nulls: ${validActivities.length} valid activities`);

      // First, categorize all new activities in batches
      const categorizationStart = Date.now();
      const uncategorized = validActivities.filter((a: any) => !a.category);
      for (let i = 0; i < uncategorized.length; i += batchSize) {
        const batch = uncategorized.slice(i, i + batchSize);
        await Promise.all(
          batch.map(async (activity: any) => {
            activity.category = await categorizeVenue(activity.venueName, activity.venueType);
          })
        );
      }
      const categorizationEnd = Date.now();
      console.log(`[AI Generation] Attempt ${attempt}: AI categorization took ${((categorizationEnd - categorizationStart) / 1000).toFixed(1)}s for ${uncategorized.length} venues`);

      // Count current category distribution
      const currentCategoryCounts: Record<string, number> = {
        meal: 0,
        cafes: 0,
        drinks: 0,
        dessert: 0,
        experiences: 0
      };

      for (const activity of allUniqueActivities) {
        if (activity.category) {
          currentCategoryCounts[activity.category] = (currentCategoryCounts[activity.category] || 0) + 1;
        }
      }

      // Add new unique activities from this batch, respecting category limits (max 3 per category)
      for (const activity of validActivities as any[]) {
        // Create a unique key based on Google Place ID (if available) or venue name
        const venueKey = activity.googlePlaceId || activity.venueName.toLowerCase();
        const category = activity.category;

        if (!seenVenues.has(venueKey) && category && currentCategoryCounts[category] < 3) {
          seenVenues.add(venueKey);
          allUniqueActivities.push(activity);
          currentCategoryCounts[category]++;
          console.log(`[AI Generation] Added unique venue: ${activity.venueName} [${category.toUpperCase()}] (${currentCategoryCounts[category]}/3 in category)`);
        } else if (seenVenues.has(venueKey)) {
          console.log(`[AI Generation] Skipping duplicate venue: ${activity.venueName}`);
        } else if (category && currentCategoryCounts[category] >= 3) {
          console.log(`[AI Generation] Skipping ${activity.venueName} - ${category.toUpperCase()} category already has 3 cards`);
        }
      }

      console.log(`[AI Generation] After attempt ${attempt}: Have ${allUniqueActivities.length}/15 unique activities`);

      // After each attempt, check category distribution if we aren't done yet
      if (!hasBalancedDistribution(allUniqueActivities) && attempt < maxAttempts) {
        // Count by category
        const categoryCounts: Record<string, number> = {
          meal: 0,
          cafes: 0,
          drinks: 0,
          dessert: 0,
          experiences: 0
        };

        for (const activity of allUniqueActivities) {
          if (activity.category) {
            categoryCounts[activity.category] = (categoryCounts[activity.category] || 0) + 1;
          }
        }

        console.log(`[AI Generation] 📊 Current category distribution after attempt ${attempt}:`, categoryCounts);

        // Identify underrepresented categories (less than 3)
        const underrepresentedCategories = Object.entries(categoryCounts)
          .filter(([_, count]) => count < 3)
          .map(([category]) => category);

        if (underrepresentedCategories.length > 0) {
          console.log(`[AI Generation] ⚠️ Underrepresented categories (< 3 cards): ${underrepresentedCategories.join(', ')}`);
          // Set target categories for next attempt
          targetCategories = underrepresentedCategories;
          console.log(`[AI Generation] 🎯 Next attempt will target: ${targetCategories.join(', ')}`);
        } else {
          console.log(`[AI Generation] ✅ All categories have exactly 3 cards - balanced distribution achieved!`);
        }
      }

      const attemptEnd = Date.now();
      console.log(`[AI Generation] 🏁 Attempt ${attempt} total time: ${((attemptEnd - attemptStart) / 1000).toFixed(1)}s`);
    }

    // Store the unique activities (up to 15)
    if (allUniqueActivities.length > 0) {
      console.log(`[AI Generation] Categorizing ${allUniqueActivities.length} activities with AI...`);

      // Add AI categorization to each activity in parallel (for any not yet categorized)
      await Promise.all(
        allUniqueActivities.map(async (activity: any) => {
          if (!activity.category) {
            activity.category = await categorizeVenue(activity.venueName, activity.venueType);
          }
        })
      );

      // Final category distribution logging
      const finalCategoryCounts: Record<string, number> = {
        meal: 0,
        cafes: 0,
        drinks: 0,
        dessert: 0,
        experiences: 0
      };

      for (const activity of allUniqueActivities) {
        if (activity.category) {
          finalCategoryCounts[activity.category] = (finalCategoryCounts[activity.category] || 0) + 1;
        }
      }

      console.log(`[AI Generation] Final category distribution:`, finalCategoryCounts);
      console.log(`[AI Generation] Storing ${allUniqueActivities.length} unique activities`);
      await storage.createActivities(allUniqueActivities);
    } else {
      console.warn(`[AI Generation] WARNING: No unique activities generated after ${maxAttempts} attempts`);
    }

    console.log(`[AI Generation] Successfully stored activities for group ${groupId}`);

    // Update status to completed
    await storage.updateGroupStatus(groupId, "completed");
  } catch (error) {
    console.error("Error in generateAndStoreActivities:", error);

    // Update status to failed with error message
    await storage.updateGroupStatus(
      groupId, 
      "failed", 
      error instanceof Error ? error.message : "Unknown error occurred"
    );
  }
}