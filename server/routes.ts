// Reference: javascript_log_in_with_replit blueprint
import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { insertGroupSchema, insertMemberSchema, updateGroupSchema, updateMemberSchema, insertVotingEventSchema, updateVotingEventSchema, insertItinerarySchema } from "@shared/schema";
import { generateActivitySuggestions, generateSwipeConcepts, categorizeByTime, categorizeVenue } from "./openai";
import { searchPlaces, searchNearbyPlaces } from "./google-places";
import { setupAuth, isAuthenticated } from "./replitAuth";
import { validateItinerary } from "./itinerary-validation";

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
      const updatedGroup = await storage.updateGroup(req.params.id, validatedUpdates);
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
          const places = await searchPlaces(validatedEvent.title, group.locationBase);
          
          // Merge Google Places data if found
          if (places.length > 0) {
            const place = places[0];
            enrichedEvent = {
              ...validatedEvent,
              venueAddress: place.address || validatedEvent.venueAddress,
              googlePlaceId: place.placeId || validatedEvent.googlePlaceId,
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

  // Get group itineraries
  app.get("/api/groups/:groupId/itineraries", async (req, res) => {
    try {
      const itineraries = await storage.getGroupItineraries(req.params.groupId);
      res.json(itineraries);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Update itinerary order
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

    console.log(`[AI Generation] Found ${previousFeedback.length} activities with feedback`);
    console.log(`[AI Generation] Found ${votingFeedback.length} favorites with voting data`);
    console.log(`[AI Generation] Found ${likedConcepts.length} liked concepts from swipe sessions`);
    console.log(`[AI Generation] Found ${passedConcepts.length} passed concepts from swipe sessions`);
    console.log(`[AI Generation] Found ${previouslySuggestedVenues.length} previously suggested venues to avoid`);

    // Archive old activities before generating new ones (preserves feedback for AI)
    await storage.archiveGroupActivities(groupId);
    console.log(`[AI Generation] Archived existing activities for group ${groupId}`);

    // Track all unique activities across retries
    const allUniqueActivities: any[] = [];
    const seenVenues = new Set<string>(); // Track across all attempts
    let attempt = 0;
    const maxAttempts = 3; // Try up to 3 times (75 suggestions each = 225 total) to ensure 15 unique cards
    let targetCategories: string[] | undefined = undefined; // For targeted retry

    while (allUniqueActivities.length < 15 && attempt < maxAttempts) {
      attempt++;
      const needed = 15 - allUniqueActivities.length;
      console.log(`[AI Generation] Attempt ${attempt}/${maxAttempts}: Need ${needed} more unique activities (have ${allUniqueActivities.length})`);

      // Generate AI suggestions with feedback and list of venues to avoid
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
        previousFeedback: previousFeedback.length > 0 ? previousFeedback : undefined,
        votingFeedback: votingFeedback.length > 0 ? votingFeedback : undefined,
        likedConcepts: likedConcepts.length > 0 ? likedConcepts : undefined,
        passedConcepts: passedConcepts.length > 0 ? passedConcepts : undefined,
        previouslySuggestedVenues: previouslySuggestedVenues.length > 0 ? previouslySuggestedVenues : undefined,
        targetCategories: targetCategories, // Pass underrepresented categories on retry
      });

      console.log(`[AI Generation] Attempt ${attempt}: Received ${suggestions.length} suggestions from OpenAI`);

      // For each suggestion, search Google Places
      const activitiesData = await Promise.all(
        suggestions.map(async (suggestion) => {
          const places = await searchPlaces(suggestion.searchQuery, groupData.locationBase);
          
          // Also search for complementary food places if suggested
          let complementaryPlace = null;
          let complementaryPlace2 = null;
          if (suggestion.complementaryFoodPlace && places.length > 0 && places[0].location) {
            // Use nearby search with distance and rating constraints (<0.5 miles, 3.5+ stars)
            const foodPlaces = await searchNearbyPlaces(
              suggestion.complementaryFoodPlace,
              places[0].location,
              805, // 0.5 miles in meters
              3.5  // minimum rating
            );
            // Filter out the main venue from complementary results (avoid suggesting venue as its own complement)
            const validFoodPlaces = foodPlaces.filter(fp => fp.placeId !== places[0].placeId);
            if (validFoodPlaces.length > 0) {
              complementaryPlace = validFoodPlaces[0];
            }
            if (validFoodPlaces.length > 1) {
              complementaryPlace2 = validFoodPlaces[1];
            }
          }
          
          if (places.length > 0) {
            const place = places[0];
            return {
              groupId,
              aiSuggestedName: suggestion.venueName, // Store what AI originally suggested
              venueName: place.name,
              venueAddress: place.address,
              venueType: suggestion.venueType,
              description: suggestion.description,
              googlePlaceId: place.placeId,
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
            // If no Google Places result, use AI suggestion directly
            return {
              groupId,
              aiSuggestedName: suggestion.venueName, // Store what AI originally suggested
              venueName: suggestion.venueName,
              venueAddress: groupData.locationBase,
              venueType: suggestion.venueType,
              description: suggestion.description,
              googlePlaceId: null,
              rating: null,
              reviewCount: null,
              priceLevel: null,
              photoUrl: null,
              googleReview: null,
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
          }
        })
      );

      console.log(`[AI Generation] Attempt ${attempt}: Created ${activitiesData.length} activities from Google Places`);
      
      // Add new unique activities from this batch to our collection
      for (const activity of activitiesData) {
        // Create a unique key based on Google Place ID (if available) or venue name
        const venueKey = activity.googlePlaceId || activity.venueName.toLowerCase();
        
        if (!seenVenues.has(venueKey) && allUniqueActivities.length < 15) {
          seenVenues.add(venueKey);
          allUniqueActivities.push(activity);
          console.log(`[AI Generation] Added unique venue: ${activity.venueName} (${allUniqueActivities.length}/15)`);
        } else if (seenVenues.has(venueKey)) {
          console.log(`[AI Generation] Skipping duplicate venue: ${activity.venueName}`);
        }
      }
      
      console.log(`[AI Generation] After attempt ${attempt}: Have ${allUniqueActivities.length}/15 unique activities`);
      
      // After each attempt, check category distribution if we have activities but aren't done yet
      if (allUniqueActivities.length > 0 && allUniqueActivities.length < 15 && attempt < maxAttempts) {
        // First, categorize what we have so far
        await Promise.all(
          allUniqueActivities.map(async (activity) => {
            if (!activity.category) {
              activity.category = await categorizeVenue(activity.venueType);
            }
          })
        );
        
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
          console.log(`[AI Generation] ✅ All categories have at least 3 cards - balanced distribution achieved!`);
        }
      }
    }

    // Store the unique activities (up to 15)
    if (allUniqueActivities.length > 0) {
      console.log(`[AI Generation] Categorizing ${allUniqueActivities.length} activities with AI...`);
      
      // Add AI categorization to each activity in parallel (for any not yet categorized)
      await Promise.all(
        allUniqueActivities.map(async (activity) => {
          if (!activity.category) {
            activity.category = await categorizeVenue(activity.venueType);
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