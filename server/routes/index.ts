/**
 * Routes Index
 *
 * Registers extracted route modules, then delegates everything else
 * to the original monolithic registerRoutes() in ../routes.ts.
 *
 * Migration status:
 *   ✅ auth      — GET /api/auth/user
 *   ✅ groups    — POST/GET/PATCH/DELETE /api/groups/*, GET /api/user/groups
 *   ✅ events    — GET /api/user/events, GET+POST+PATCH+DELETE /api/itineraries/*, GET /api/groups/:id/itineraries
 *   ✅ members   — GET/PATCH/DELETE /api/members/:id, GET /api/groups/:id/members, DELETE /api/groups/:groupId/members/:memberId
 *   ✅ venues    — GET /api/venues/search, GET /api/curated-venues, POST /api/venues/:id/refresh-photo,
 *                  GET /api/user/all-places|places-swipe-queue,
 *                  GET+POST+DELETE /api/user/saved-places/*, GET+POST+DELETE /api/groups/:id/saved-places/*
 *   ✅ notifications — GET /api/notifications, GET /api/notifications/unread-count,
 *                      POST /api/notifications/:id/mark-read, POST /api/notifications/mark-all-read,
 *                      DELETE /api/notifications/:id
 *   ✅ rsvps     — PATCH /api/members/:id/rsvp, POST/GET/PATCH /api/rsvps/*, POST /api/rsvps/:id/approve|deny,
 *                  POST /api/itineraries/:id/rsvps|rsvp|guest-rsvp|organizer-rsvp,
 *                  GET /api/itineraries/:id/rsvps, GET+PATCH /api/guest-rsvp/:guestToken,
 *                  POST /api/standalone-invite/:inviteToken/rsvp
 *   ✅ activities — GET /api/groups/:id/activities, PATCH /api/activities/:activityId/feedback,
 *                  DELETE /api/groups/:id/activities, DELETE /api/activities/:activityId,
 *                  GET+PATCH+DELETE /api/voting-events/:id, POST+DELETE /api/voting-events/:id/vote,
 *                  GET /api/voting-events/:id/votes, GET /api/voting-events/:id/my-vote,
 *                  GET /api/voting-events, GET /api/groups/:groupId/voting-events
 *   ✅ admin     — POST/GET/DELETE /api/admin/* (import-venues, ai-stats, calibrate-all,
 *                  backfill-coordinates, stats, job-health, create-backup, backups, restore,
 *                  test-accounts, switch-user, cache-photos, backfill-favorites-coordinates,
 *                  audit-venue-data, cleanup-curated-venues, deleted-venues,
 *                  cleanup-orphaned-voting-data, groups/:id, recategorize-venues,
 *                  scraped-venues/*, venue-analytics, venues-by-filter, api-logs, api-costs)
 *   ✅ users     — GET/PATCH /api/user/profile, /api/user/preferences,
 *                  /api/user/preferences/groups/:groupId,
 *                  GET /api/user/contacts, /api/user/groups/backup, /api/user/collections,
 *                  POST/PATCH/DELETE /api/user/collections/*,
 *                  GET /api/user/dashboard, /api/user/hosting-requests
 *   ✅ health    — GET /api/health, /api/debug/paths
 *   ✅ swipe     — POST/GET /api/groups/:groupId/swipe-sessions, GET/POST /api/swipe-sessions/:id,
 *                  POST /api/groups/:groupId/activities/:activityId/swipe,
 *                  POST /api/groups/:groupId/favorites/:votingEventId/swipe,
 *                  GET /api/groups/:groupId/swipe-progress, swipe-triggers/*,
 *                  POST /api/cron/weekly-digest
 *   ✅ standalone-events — GET/POST/PATCH/DELETE /api/standalone-events/*,
 *                  POST /api/standalone-events/:id/invitees, /send-invites,
 *                  DELETE /api/standalone-events/:id/invitees/:inviteeId,
 *                  GET /api/standalone-invite/:inviteToken
 *   ✅ auto-events — POST /api/auto-events/:id/approve|skip,
 *                  DELETE /api/auto-events/:id,
 *                  GET /api/auto-events/:eventId/options,
 *                  POST /api/auto-events/:eventId/vote|select-option|regenerate-options
 *   ✅ photos    — GET /api/og-image/:type/:id, GET /api/geocode,
 *                  GET /api/photos/v1/:photoName(*), GET /api/photos/:photoReference
 *   ✅ group-join — GET /api/groups/by-link/:shareableLink, GET /api/groups/join-preview/:shareableLink,
 *                  POST /api/groups/:id/join
 *   ✅ group-automation — PATCH /api/groups/:id/automation|invite-link,
 *                  POST /api/groups/:id/pause-automation|resume-automation
 *   ✅ member-extras — GET /api/members/verify-claim/:inviteToken, POST /api/members/:id/claim,
 *                  PATCH /api/members/:id/preferences|constraints|profile,
 *                  GET /api/members/:memberId/constraint-analysis|favorites,
 *                  POST/DELETE /api/members/:memberId/favorites,
 *                  GET+PATCH /api/groups/:groupId/my-preferences,
 *                  GET /api/groups/:groupId/members-availability|members-budgets
 *   ✅ hosting   — PATCH /api/members/:id/hosting-toggle, POST /api/itineraries/:id/volunteer-host|hand-off-host,
 *                  POST /api/groups/:groupId/request-host, GET /api/groups/:groupId/pending-host-request,
 *                  GET /api/members/:memberId/host-assignments, POST /api/host-assignments/:assignmentId/respond
 *   ✅ member-claims — GET /api/members/claim/verify/:claimToken, POST /api/members/claim|register-guest|link-account,
 *                  GET /api/members/me/events
 *   ✅ guest-invites — POST+GET+PATCH+DELETE /api/itineraries/:itineraryId/guest-invites/*
 *   ✅ feedback   — POST /api/itineraries/:id/post-event-feedback,
 *                  GET /api/groups/:groupId/feedback-summary|post-event-feedback-summary
 *   ✅ availability-pulse — GET+POST /api/groups/:groupId/availability-pulse,
 *                  POST+GET /api/availability-pulse/:pulseId/respond(/:responseToken)
 *   ✅ planning-insights — GET /api/groups/:id/planning-insights, POST /api/planning-insights/:id/dismiss|acted,
 *                  POST /api/groups/:id/analyze
 *   ✅ itinerary-extras — DELETE /api/itinerary-invites/:id, POST /api/groups/:groupId/itineraries/validate,
 *                  DELETE+PATCH /api/itinerary-items/:id, POST /api/itineraries/:id/items(+ad-hoc),
 *                  GET+POST /api/itineraries/:itineraryId/time-slots, POST+DELETE /api/time-slots/:id/vote,
 *                  PATCH /api/time-slots/:id/select, GET /api/groups/:groupId/saved-itineraries,
 *                  POST /api/itineraries/:id/save|duplicate|send|send-backup|finalize,
 *                  GET /api/itineraries/:id/shareable-token|guest-list|invite-summary|availability-insights,
 *                  GET /api/groups/:groupId/proposed-itineraries
 *   ✅ auto-scheduling — POST /api/groups/:id/trigger-auto-schedule|maintain-event-pipeline,
 *                  DELETE /api/groups/:id/auto-scheduled-events,
 *                  GET+POST /api/groups/:groupId/auto-scheduled-events(+timeline)|auto-schedule-queue(+regenerate+approve),
 *                  GET /api/groups/:groupId/pending-auto-event,
 *                  POST /api/auto-schedule/:id/approve, POST /api/frequency-feedback,
 *                  POST /api/groups/:groupId/schedule-next-event
 *   ✅ generation — POST /api/groups/:id/retry-generation|activities/cancel-generation|
 *                  activities/regenerate-category|generate-category|activities/from-category-result
 *   ✅ ai-features — POST /api/groups/:id/schedule-from-prompt|analyze-patterns|compare-models|
 *                  swipe-concepts|discover-venues|swipe-feedback, GET /api/groups/:id/swipe-deck,
 *                  POST /api/groups/:groupId/nearby-suggestions|venue-nearby-suggestions,
 *                  POST /api/itineraries/:id/ai-suggestions|ai-chat|decide-now|suggest-time,
 *                  GET /api/itineraries/:id/suggested-schedule
 *   ✅ group-extras — PATCH /api/groups/:id/collection, PATCH /api/groups/reorder,
 *                  POST /api/voting-events, POST /api/groups/:id/quick-event|send-invitations|
 *                  add-venues-to-library, GET /api/groups/:id/category-search-history
 *   ✅ insights — GET /api/groups/:groupId/learning-insights|confidence-weights|insights,
 *                  POST /api/groups/:groupId/calibrate|insights/dismiss,
 *                  PATCH /api/groups/:groupId/insights/:insightType,
 *                  DELETE /api/groups/:groupId/rejected-venues
 *
 * Audit (2026-05-12): `node scripts/audit-route-split.mjs`
 *   - 30 mounted sub-routers
 *   - 257 sub-router endpoints total
 *   - 178 overlap still-present inline handlers in routes.ts (dead code)
 *   - 79 routes now exist only in sub-routers after inline cleanup
 *   - 0 routes remain exclusively in the monolith
 *
 * Usage (in server/index.ts or server/app.ts):
 *
 *   import { registerRoutes } from "./routes.ts";
 *   // routes.ts already calls registerSubRoutes internally — no change needed
 *
 * Or if wiring up manually:
 *   import { registerSubRoutes } from "./routes/index.ts";
 *   registerSubRoutes(app);
 */

import type { Express } from "express";
import authRouter from "./auth";
import groupsRouter from "./groups";
import eventsRouter from "./events";
import membersRouter from "./members";
import venuesRouter from "./venues";
import notificationsRouter from "./notifications";
import rsvpsRouter from "./rsvps";
import activitiesRouter from "./activities";
import adminRouter from "./admin";
import usersRouter from "./users";
import healthRouter from "./health";
import swipeRouter from "./swipe";
import standaloneEventsRouter from "./standalone-events";
import autoEventsRouter from "./auto-events";
import photosRouter from "./photos";
import groupJoinRouter from "./group-join";
import groupAutomationRouter from "./group-automation";
import memberExtrasRouter from "./member-extras";
import hostingRouter from "./hosting";
import memberClaimsRouter from "./member-claims";
import guestInvitesRouter from "./guest-invites";
import feedbackRouter from "./feedback";
import availabilityPulseRouter from "./availability-pulse";
import planningInsightsRouter from "./planning-insights";
import itineraryExtrasRouter from "./itinerary-extras";
import autoSchedulingRouter from "./auto-scheduling";
import generationRouter from "./generation";
import aiFeaturesRouter from "./ai-features";
import groupExtrasRouter from "./group-extras";
import insightsRouter from "./insights";

/**
 * Register all extracted sub-route modules onto the app.
 * Call this BEFORE or AFTER the monolithic registerRoutes() as needed.
 *
 * Currently, this is called from within registerRoutes() in ../routes.ts
 * so the ordering is controlled there.
 */
export function registerSubRoutes(app: Express): void {
  // Auth routes: /api/auth/*
  // Note: Google OAuth (login/callback/logout) is handled by setupAuth() in googleAuth.ts
  app.use("/api/auth", authRouter);

  // Groups CRUD: /api/groups/* and /api/user/groups
  // Router paths are prefixed with /groups or /user/groups internally
  app.use("/api", groupsRouter);

  // Events/Itineraries CRUD: /api/user/events, /api/itineraries/*, /api/groups/:id/itineraries
  app.use("/api", eventsRouter);

  // Members CRUD: /api/members/:id, /api/groups/:id/members, /api/groups/:groupId/members/:memberId
  app.use("/api", membersRouter);

  // Venues/Places: /api/venues/search, /api/curated-venues, /api/venues/:id/refresh-photo,
  //                /api/user/all-places, /api/user/places-swipe-queue,
  //                /api/user/saved-places/*, /api/groups/:id/saved-places/*
  app.use("/api", venuesRouter);

  // Notifications: /api/notifications/*, /api/notifications/unread-count
  app.use("/api", notificationsRouter);

  // RSVPs: /api/rsvps/*, /api/itineraries/:id/rsvps|rsvp|guest-rsvp|organizer-rsvp,
  //        /api/guest-rsvp/:guestToken, /api/members/:id/rsvp,
  //        /api/standalone-invite/:inviteToken/rsvp
  app.use("/api", rsvpsRouter);

  // Activities & Voting Events: /api/groups/:id/activities, /api/activities/:activityId,
  //   /api/voting-events/*, /api/groups/:groupId/voting-events
  app.use("/api", activitiesRouter);

  // Admin: /api/admin/*
  app.use("/api", adminRouter);

  // User profile, preferences, collections, dashboard, hosting-requests
  app.use("/api", usersRouter);

  // Health & debug: /api/health, /api/debug/paths
  app.use("/api", healthRouter);

  // Swipe sessions & swipe recording: /api/groups/:groupId/swipe-sessions, /api/swipe-sessions/:id, /api/cron/weekly-digest
  app.use("/api", swipeRouter);

  // Standalone events: /api/standalone-events/*, /api/standalone-invite/:inviteToken
  app.use("/api", standaloneEventsRouter);

  // Auto-events management: /api/auto-events/:id/approve|skip|vote|select-option|regenerate-options
  app.use("/api", autoEventsRouter);

  // Photos & OG images: /api/og-image/:type/:id, /api/geocode, /api/photos/*
  app.use("/api", photosRouter);

  // Group join/share links: /api/groups/by-link/:link, /api/groups/join-preview/:link, POST /api/groups/:id/join
  app.use("/api", groupJoinRouter);

  // Group automation & invite link: PATCH /api/groups/:id/automation|invite-link,
  //   POST /api/groups/:id/pause-automation|resume-automation
  app.use("/api", groupAutomationRouter);

  // Member extras: verify-claim, claim, preferences, constraints, profile, favorites,
  //   group my-preferences, members-availability, members-budgets
  app.use("/api", memberExtrasRouter);

  // Hosting: toggle, volunteer, hand-off, request-host, host-assignments
  app.use("/api", hostingRouter);

  // Member claims: verify, claim, register-guest, link-account, me/events
  app.use("/api", memberClaimsRouter);

  // Guest invites: CRUD for guest invitations on itineraries
  app.use("/api", guestInvitesRouter);

  // Feedback: post-event feedback, feedback-summary, post-event-feedback-summary
  app.use("/api", feedbackRouter);

  // Availability pulse: create, get, respond (auth + token-based)
  app.use("/api", availabilityPulseRouter);

  // Planning insights: get, dismiss, acted, analyze
  app.use("/api", planningInsightsRouter);

  // Itinerary extras: invites, items CRUD, time slots, send/finalize, guest list, availability insights
  app.use("/api", itineraryExtrasRouter);

  // Auto-scheduling: trigger, pipeline, queue, schedule-next-event, pending-auto-event, frequency-feedback
  app.use("/api", autoSchedulingRouter);

  // Generation: retry, cancel, regenerate-category, generate-category, from-category-result
  app.use("/api", generationRouter);

  // AI features: ai-chat, ai-suggestions, decide-now, suggest-time, schedule-from-prompt,
  //   discover-venues, swipe-deck, nearby-suggestions, compare-models, analyze-patterns
  app.use("/api", aiFeaturesRouter);

  // Group extras: collections, reorder, voting-events, quick-event, send-invitations,
  //   category-search-history, add-venues-to-library
  app.use("/api", groupExtrasRouter);

  // Insights: learning-insights, confidence-weights, calibrate, rejected-venues, insights CRUD
  app.use("/api", insightsRouter);
}
