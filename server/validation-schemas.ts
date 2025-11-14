import { z } from 'zod';

// ========== ADMIN SCHEMAS ==========

export const importVenuesSchema = z.object({
  venues: z.array(z.object({
    title: z.string().min(1, "Title is required"),
    url: z.string().url("Invalid URL format"),
    street: z.string().optional(),
    city: z.string().optional(),
    state: z.string().optional(),
    countryCode: z.string().optional(),
    categoryName: z.string().optional(),
    totalScore: z.number().optional(),
    reviewsCount: z.number().optional(),
  })).min(1, "At least one venue is required"),
});

export const createBackupSchema = z.object({
  notes: z.string().optional(),
});

export const switchUserSchema = z.object({
  targetUserId: z.string().min(1, "Target user ID is required"),
});

export const uploadScrapedVenuesSchema = z.object({
  venues: z.array(z.any()).min(1, "At least one venue is required"),
});

export const importScrapedVenuesSchema = z.object({
  venues: z.array(z.any()).min(1, "At least one venue is required"),
});

// ========== USER/COLLECTION SCHEMAS ==========

export const createCollectionSchema = z.object({
  name: z.string().min(1, "Collection name is required").max(100, "Collection name too long"),
  orderIndex: z.number().int().min(0).optional(),
});

export const updateCollectionSchema = z.object({
  name: z.string().min(1, "Collection name is required").max(100, "Collection name too long"),
});

export const reorderCollectionsSchema = z.object({
  collectionOrders: z.array(z.object({
    id: z.string(),
    orderIndex: z.number().int().min(0),
  })).min(1, "At least one collection order is required"),
});

export const updateCollectionAssignmentSchema = z.object({
  collectionId: z.string().nullable(),
  orderIndex: z.number().int().min(0).optional(),
});

export const reorderGroupsSchema = z.object({
  groupOrders: z.array(z.object({
    id: z.string(),
    orderIndex: z.number().int().min(0),
  })).min(1, "At least one group order is required"),
});

// ========== GROUP SCHEMAS ==========

export const createGroupSchema = z.object({
  members: z.array(z.object({
    name: z.string().optional(),
    email: z.union([z.string().email("Invalid email format"), z.literal("")]).optional(),
  }).refine(
    (data) => data.name || data.email,
    { message: "Either name or email must be provided for each member" }
  )).optional(),
  name: z.string().min(1, "Group name is required").max(100, "Group name too long"),
  emoji: z.string().optional(),
  locationBase: z.string().min(1, "Location is required"),
  budgetMin: z.number().min(0, "Budget must be positive").optional(),
  budgetMax: z.number().min(0, "Budget must be positive"),
  meetingFrequency: z.string().optional(), // Format: "N-unit" or "Nx unit" (e.g., "1-week", "2x month")
  availability: z.any().optional(), // JSON object
  closenessLevel: z.number().int().min(1).max(5).optional(),
  noveltyPreference: z.number().int().min(1).max(5).optional(),
  pastPreferences: z.string().optional(),
  additionalInstructions: z.string().optional(),
  activityCategories: z.array(z.string()).optional(),
  searchRadius: z.number().int().min(2).max(50).optional(),
  mealEnabled: z.boolean().optional(),
  cafeEnabled: z.boolean().optional(),
  drinksEnabled: z.boolean().optional(),
  dessertEnabled: z.boolean().optional(),
  experiencesEnabled: z.boolean().optional(),
});

export const updateGroupRadiusSchema = z.object({
  searchRadius: z.union([z.literal(2), z.literal(10), z.literal(30), z.literal(50)], {
    errorMap: () => ({ message: "Invalid search radius. Must be 2, 10, 30, or 50 miles." })
  }),
});

export const updateAutomationSchema = z.object({
  field: z.string().optional(),
  value: z.boolean().optional(),
  // Direct field updates
  meal_enabled: z.boolean().optional(),
  cafe_enabled: z.boolean().optional(),
  drinks_enabled: z.boolean().optional(),
  dessert_enabled: z.boolean().optional(),
  experiences_enabled: z.boolean().optional(),
  autoActivitiesEnabled: z.boolean().optional(),
  autoItineraryEnabled: z.boolean().optional(),
  autoScheduleEnabled: z.boolean().optional(),
}).refine(
  (data) => {
    // Either field/value pair OR direct field updates
    const hasFieldValue = data.field !== undefined && data.value !== undefined;
    const hasDirectUpdates = Object.keys(data).some(k =>
      k !== 'field' && k !== 'value' && data[k as keyof typeof data] !== undefined
    );
    return hasFieldValue || hasDirectUpdates;
  },
  { message: "Must provide either field/value or direct field updates" }
);

// ========== MEMBER SCHEMAS ==========

export const joinGroupSchema = z.object({
  name: z.string().min(1, "Name is required").optional(),
  email: z.string().email("Invalid email format").optional(),
  availability: z.any().optional(),
  preferences: z.string().optional(),
});

export const claimMemberSchema = z.object({
  claimToken: z.string().min(1, "Claim token is required"),
});

export const updateMemberRsvpSchema = z.object({
  rsvpStatus: z.enum(['going', 'maybe', 'not_going'], {
    errorMap: () => ({ message: "Invalid RSVP status" })
  }),
  claimToken: z.string().min(1, "Claim token is required"),
});

export const updateMemberPreferencesSchema = z.object({
  memberLocation: z.string().optional(),
  memberBudgetMin: z.number().min(0).optional(),
  memberBudgetMax: z.number().min(0).optional(),
  memberAvailability: z.any().optional(),
  claimToken: z.string().min(1, "Claim token is required"),
});

export const updateMemberConstraintsSchema = z.object({
  memberConstraints: z.object({
    scheduleConflicts: z.array(z.string()).optional(),
    budgetConcern: z.boolean().optional(),
    distanceConcern: z.boolean().optional(),
    notes: z.string().optional(),
  }),
  claimToken: z.string().min(1, "Claim token is required"),
});

export const updateMemberProfileSchema = z.object({
  homeBaseLocation: z.string().optional(),
  homeBaseLatitude: z.number().optional(),
  homeBaseLongitude: z.number().optional(),
  activityPreferences: z.array(z.string()).optional(),
  personalAvailability: z.any().optional(),
});

export const toggleHostingSchema = z.object({
  openToHosting: z.boolean(),
  claimToken: z.string().optional(),
});

export const updateMemberGroupPreferencesSchema = z.object({
  budgetOverrideMin: z.number().min(0).optional(),
  budgetOverrideMax: z.number().min(0).optional(),
  categoryPreferencesOverride: z.array(z.string()).optional(),
  availabilityOverride: z.any().optional(),
  meetingFrequencyOverride: z.enum(['weekly', 'biweekly', 'monthly', 'bimonthly']).optional(),
});

// ========== ACTIVITY SCHEMAS ==========

export const updateActivityFeedbackSchema = z.object({
  feedback: z.enum(['love', 'more', 'less']).nullable(),
});

export const regenerateCategorySchema = z.object({
  category: z.enum(['meal', 'cafes', 'drinks', 'dessert', 'experiences'], {
    errorMap: () => ({ message: "Invalid category" })
  }),
  currentVenueNames: z.array(z.string()).optional(),
  checkedActivityIds: z.array(z.string()).optional(),
});

export const generateCategorySchema = z.object({
  categories: z.array(z.enum(['meal', 'cafes', 'drinks', 'dessert', 'experiences'])).optional(),
  category: z.enum(['meal', 'cafes', 'drinks', 'dessert', 'experiences']).optional(),
  location: z.object({
    address: z.string().optional(),
    lat: z.number().optional(),
    lng: z.number().optional(),
  }).optional(),
  radius: z.number().int().min(2).max(50).optional(),
  count: z.number().int().min(1).max(100).default(9),
  sortBy: z.enum(['distance', 'rating']).default('rating'),
  tempInstructions: z.string().optional(),
}).refine(
  (data) => data.categories || data.category,
  { message: "Must provide either categories or category" }
);

export const scheduleFromPromptSchema = z.object({
  prompt: z.string().min(1, "Prompt is required").max(500, "Prompt too long"),
});

export const createActivityFromSearchSchema = z.object({
  activityData: z.object({
    venueName: z.string().min(1, "Venue name is required"),
    venueType: z.string().optional(),
    venueAddress: z.string().optional(),
    description: z.string().optional(),
    googlePlaceId: z.string().optional(),
    latitude: z.string().optional(),
    longitude: z.string().optional(),
    rating: z.string().optional(),
    priceLevel: z.string().optional(),
    photoUrl: z.string().optional(),
  }),
});

export const swipeFeedbackSchema = z.object({
  conceptType: z.string().min(1, "Concept type is required"),
  conceptDescription: z.string().min(1, "Concept description is required"),
  feedback: z.enum(['like', 'pass'], {
    errorMap: () => ({ message: "Feedback must be 'like' or 'pass'" })
  }),
});

// ========== VOTING SCHEMAS ==========

export const castVoteSchema = z.object({
  voteType: z.enum(['upvote', 'downvote'], {
    errorMap: () => ({ message: "Invalid vote type" })
  }),
});

// ========== ITINERARY SCHEMAS ==========

export const validateItinerarySchema = z.object({
  selectedVenues: z.array(z.object({
    sourceType: z.enum(['activity', 'voting_event']),
    sourceId: z.string(),
  })).min(1, "At least one venue is required"),
});

export const nearbySuggestionsSchema = z.object({
  selectedVenues: z.array(z.object({
    sourceType: z.enum(['activity', 'voting_event']),
    sourceId: z.string(),
  })).optional(),
});

export const venueNearbySuggestionsSchema = z.object({
  lat: z.number(),
  lng: z.number(),
  placeId: z.string().optional(),
  excludePlaceIds: z.array(z.string()).optional(),
});

export const addItineraryItemsSchema = z.object({
  items: z.array(z.object({
    sourceType: z.enum(['activity', 'voting_event']),
    sourceId: z.string(),
  })).min(1, "At least one item is required"),
});

export const updateItineraryOrderSchema = z.object({
  proposedOrder: z.array(z.string()).min(1, "Proposed order cannot be empty"),
});

export const saveItinerarySchema = z.object({
  name: z.string().max(100, "Name too long").optional(),
  timingRecommendations: z.string().optional(),
});

export const sendItinerarySchema = z.object({
  isPrimary: z.boolean().optional(),
  eventDate: z.string().datetime().optional(),
  eventDates: z.array(z.string().datetime()).optional(),
  autoScheduleConfig: z.object({
    inviteAdvanceDays: z.number().int().min(1).max(90).default(14),
    rsvpWindowDays: z.number().int().min(1).max(30).default(11),
    reminders: z.array(z.object({
      type: z.enum(['gentle_nudge', 'final_call', 'day_before']),
      daysBeforeDeadline: z.number().int().min(0).optional(),
      daysBeforeEvent: z.number().int().min(0).optional(),
    })).optional(),
  }).optional(),
});

export const sendBackupItinerarySchema = z.object({
  backupForItineraryId: z.string().min(1, "Backup itinerary ID is required"),
});

// ========== RSVP SCHEMAS ==========

export const createRsvpSchema = z.object({
  itineraryId: z.string().min(1, "Itinerary ID is required"),
  inviteToken: z.string().min(1, "Invite token is required"),
  response: z.enum(['yes', 'maybe', 'no'], {
    errorMap: () => ({ message: "Invalid response. Must be yes, maybe, or no" })
  }),
  rsvpFeedback: z.object({
    budgetConcern: z.boolean().optional(),
    timeConcern: z.boolean().optional(),
    locationConcern: z.boolean().optional(),
    activityTypeConcern: z.boolean().optional(),
    otherConcern: z.boolean().optional(),
    notes: z.string().optional(),
    tryEarlier: z.boolean().optional(),
    tryLater: z.boolean().optional(),
    notThisWeek: z.boolean().optional(),
    unavailableOn: z.array(z.string()).optional(),
  }).optional(),
  claimedMemberId: z.string().optional(),
  guestName: z.string().optional(),
  additionalAttendees: z.array(z.string()).optional(),
  numberOfKids: z.number().int().min(0).optional(),
});

export const organizerRsvpSchema = z.object({
  response: z.enum(['yes', 'maybe', 'no'], {
    errorMap: () => ({ message: "Valid response required (yes, maybe, or no)" })
  }),
  rsvpFeedback: z.any().optional(),
});

export const createItineraryRsvpSchema = z.object({
  response: z.enum(['yes', 'maybe', 'no']),
  constraintText: z.string().optional(),
  memberId: z.string().optional(),
  userId: z.string().optional(),
  memberName: z.string().optional(),
});

export const guestRsvpSchema = z.object({
  guestName: z.string().min(1, "Guest name is required"),
  guestEmail: z.string().email("Invalid email format").optional(),
  response: z.enum(['yes', 'maybe', 'no'], {
    errorMap: () => ({ message: "Valid response required (yes, maybe, or no)" })
  }),
});

export const updateGuestRsvpSchema = z.object({
  response: z.enum(['yes', 'maybe', 'no'], {
    errorMap: () => ({ message: "Valid response required (yes, maybe, or no)" })
  }),
});

export const postEventFeedbackSchema = z.object({
  actuallyAttended: z.boolean(),
  venueRating: z.number().min(1).max(5).optional(),
  frequencyPreference: z.enum(['more_frequent', 'just_right', 'less_frequent']).optional(),
  wouldDoAgain: z.enum(['yes', 'maybe', 'no']).optional(),
  improvementNotes: z.string().optional(),
});

// ========== TIME SLOT SCHEMAS ==========

export const createTimeSlotsSchema = z.object({
  timeSlots: z.array(z.object({
    proposedDateTime: z.string().datetime(),
    label: z.string().optional(),
  })).min(1, "At least one time slot is required"),
});

export const voteForTimeSlotSchema = z.object({
  memberId: z.string().optional(),
  memberName: z.string().optional(),
  voteType: z.enum(['yes', 'maybe', 'no']).default('yes'),
}).refine(
  (data) => data.memberId !== undefined,
  { message: "Member ID is required" }
);

export const removeTimeSlotVoteSchema = z.object({
  memberId: z.string().optional(),
});

// ========== HOST SCHEMAS ==========

export const requestHostSchema = z.object({
  itineraryId: z.string().min(1, "Itinerary ID is required"),
});

export const volunteerHostSchema = z.object({
  claimToken: z.string().optional(),
});

export const handOffHostSchema = z.object({
  newHostMemberId: z.string().min(1, "New host member ID is required"),
  claimToken: z.string().optional(),
});

export const respondToHostAssignmentSchema = z.object({
  accepted: z.boolean(),
  claimToken: z.string().optional(),
});

// ========== GUEST INVITE SCHEMAS ==========

export const createGuestInviteSchema = z.object({
  guestName: z.string().min(1, "Guest name is required"),
});

// ========== FREQUENCY FEEDBACK SCHEMA ==========

export const frequencyFeedbackSchema = z.object({
  groupId: z.string().min(1, "Group ID is required"),
  feedback: z.enum(['more_often', 'just_right', 'less_often']),
});

// ========== AD-HOC VENUE SCHEMAS ==========

export const addAdHocVenueSchema = z.object({
  name: z.string().min(1, "Venue name is required"),
  address: z.string().optional(),
  googlePlaceId: z.string().optional(),
  googleMapsUrl: z.string().optional(),
  notes: z.string().optional(),
  venueType: z.string().optional(),
}).refine(
  (data) => data.address || data.googlePlaceId || data.googleMapsUrl,
  { message: "Either address, googlePlaceId, or googleMapsUrl must be provided" }
);

export const updateItineraryItemSchema = z.object({
  venueName: z.string().min(1).optional(),
  venueAddress: z.string().optional(),
  notes: z.string().optional(),
  googleMapsUrl: z.string().optional(),
  arrivalTime: z.string().datetime().optional().nullable(),
  departureTime: z.string().datetime().optional().nullable(),
  travelNotes: z.string().optional(),
});

// ========== SEARCH SCHEMAS ==========

export const searchVenuesSchema = z.object({
  query: z.string().min(2, "Query must be at least 2 characters"),
});

// Helper type exports for TypeScript inference
export type ImportVenuesInput = z.infer<typeof importVenuesSchema>;
export type CreateCollectionInput = z.infer<typeof createCollectionSchema>;
export type CreateGroupInput = z.infer<typeof createGroupSchema>;
export type UpdateAutomationInput = z.infer<typeof updateAutomationSchema>;
export type CreateRsvpInput = z.infer<typeof createRsvpSchema>;
export type GenerateCategoryInput = z.infer<typeof generateCategorySchema>;
export type SendItineraryInput = z.infer<typeof sendItinerarySchema>;
export type PostEventFeedbackInput = z.infer<typeof postEventFeedbackSchema>;
export type AddAdHocVenueInput = z.infer<typeof addAdHocVenueSchema>;
