// Reference: javascript_log_in_with_replit blueprint
import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { insertGroupSchema, insertMemberSchema, updateGroupSchema, updateMemberSchema, insertVotingEventSchema, updateVotingEventSchema } from "@shared/schema";
import { generateActivitySuggestions } from "./openai";
import { searchPlaces } from "./google-places";
import { setupAuth, isAuthenticated } from "./replitAuth";

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

  // Create a voting event (authenticated)
  app.post("/api/voting-events", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const validatedEvent = insertVotingEventSchema.parse(req.body);
      const event = await storage.createVotingEvent(validatedEvent, userId);
      res.json(event);
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
        .map(a => a.venueName)
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

    console.log(`[AI Generation] Found ${previousFeedback.length} activities with feedback`);
    console.log(`[AI Generation] Found ${votingFeedback.length} favorites with voting data`);
    console.log(`[AI Generation] Found ${previouslySuggestedVenues.length} previously suggested venues to avoid`);

    // Archive old activities before generating new ones (preserves feedback for AI)
    await storage.archiveGroupActivities(groupId);
    console.log(`[AI Generation] Archived existing activities for group ${groupId}`);

    // Generate AI suggestions with feedback and list of venues to avoid
    const suggestions = await generateActivitySuggestions({
      locationBase: groupData.locationBase,
      budgetMin: groupData.budgetMin,
      budgetMax: groupData.budgetMax,
      meetingFrequency: groupData.meetingFrequency,
      availability: groupData.availability,
      closenessLevel: groupData.closenessLevel,
      noveltyPreference: groupData.noveltyPreference,
      pastPreferences: groupData.pastPreferences,
      additionalInstructions: groupData.additionalInstructions,
      previousFeedback: previousFeedback.length > 0 ? previousFeedback : undefined,
      votingFeedback: votingFeedback.length > 0 ? votingFeedback : undefined,
      previouslySuggestedVenues: previouslySuggestedVenues.length > 0 ? previouslySuggestedVenues : undefined,
    });

    console.log(`[AI Generation] Received ${suggestions.length} suggestions from OpenAI`);

    // For each suggestion, search Google Places
    const activitiesData = await Promise.all(
      suggestions.map(async (suggestion) => {
        const places = await searchPlaces(suggestion.searchQuery, groupData.locationBase);
        
        // Also search for complementary food places if suggested
        let complementaryPlace = null;
        let complementaryPlace2 = null;
        if (suggestion.complementaryFoodPlace) {
          const foodPlaces = await searchPlaces(suggestion.complementaryFoodPlace, groupData.locationBase);
          if (foodPlaces.length > 0) {
            complementaryPlace = foodPlaces[0];
          }
          if (foodPlaces.length > 1) {
            complementaryPlace2 = foodPlaces[1];
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
            priceLevel: place.priceLevel,
            photoUrl: place.photoUrl,
            aiReasoning: suggestion.reasoning,
            suggestedDate: null,
            suggestedTime: null,
            priceEstimate: suggestion.priceEstimate || null,
            timeConstraints: suggestion.timeConstraints || null,
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
            priceLevel: null,
            photoUrl: null,
            aiReasoning: suggestion.reasoning,
            suggestedDate: null,
            suggestedTime: null,
            priceEstimate: suggestion.priceEstimate || null,
            timeConstraints: suggestion.timeConstraints || null,
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

    console.log(`[AI Generation] Created ${activitiesData.length} activities to store`);
    
    // Store all activities
    await storage.createActivities(activitiesData);
    
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
