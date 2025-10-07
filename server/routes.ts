import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { insertGroupSchema, insertMemberSchema } from "@shared/schema";
import { generateActivitySuggestions } from "./openai";
import { searchPlaces } from "./google-places";

export async function registerRoutes(app: Express): Promise<Server> {
  // Create group with AI suggestions
  app.post("/api/groups", async (req, res) => {
    try {
      const { members, ...groupData } = req.body;
      
      // Validate group data
      const validatedGroup = insertGroupSchema.parse(groupData);
      
      // Create group with members
      const group = await storage.createGroup(validatedGroup, members || []);
      
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

  // Retry activity generation
  app.post("/api/groups/:id/retry-generation", async (req, res) => {
    try {
      const group = await storage.getGroup(req.params.id);
      if (!group) {
        return res.status(404).json({ message: "Group not found" });
      }

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
        additionalInstructions: group.additionalInstructions,
      });

      res.json({ success: true, message: "Activity generation restarted" });
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

    // Generate AI suggestions
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
    });

    console.log(`[AI Generation] Received ${suggestions.length} suggestions from OpenAI`);

    // For each suggestion, search Google Places
    const activitiesData = await Promise.all(
      suggestions.map(async (suggestion) => {
        const places = await searchPlaces(suggestion.searchQuery, groupData.locationBase);
        
        if (places.length > 0) {
          const place = places[0];
          return {
            groupId,
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
          };
        } else {
          // If no Google Places result, use AI suggestion directly
          return {
            groupId,
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
