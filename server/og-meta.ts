/**
 * Open Graph Meta Tag Generation
 *
 * Generates dynamic meta tags for shareable links so they show
 * rich previews in iMessage, WhatsApp, Slack, etc.
 */

import { db } from "./db";
import { storage } from "./storage";
import { rsvps as rsvpsTable, members as membersTable, guestInvites } from "@shared/schema";
import { eq, sql, and } from "drizzle-orm";

export type OGMetaData = {
  title: string;
  description: string;
  url: string;
  siteName: string;
  type: "website";
};

/**
 * Escape HTML special characters for safe meta tag insertion
 */
function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

/**
 * Truncate text to a maximum length, adding ellipsis if needed
 */
function truncate(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength - 3) + "...";
}

/**
 * Get the base URL for the app
 */
function getBaseUrl(): string {
  // Use the Replit domain in production
  if (process.env.REPLIT_DEV_DOMAIN) {
    return `https://${process.env.REPLIT_DEV_DOMAIN}`;
  }
  // Fallback for production deployment
  return process.env.BASE_URL || "https://kinmo.ai";
}

/**
 * Generate HTML meta tags from OG data
 */
export function generateOGMetaTags(meta: OGMetaData): string {
  const safeTitle = escapeHtml(truncate(meta.title, 60));
  const safeDescription = escapeHtml(truncate(meta.description, 160));

  return `
    <!-- Open Graph / Social -->
    <meta property="og:title" content="${safeTitle}" />
    <meta property="og:description" content="${safeDescription}" />
    <meta property="og:url" content="${meta.url}" />
    <meta property="og:site_name" content="${meta.siteName}" />
    <meta property="og:type" content="${meta.type}" />
    <!-- Twitter Card -->
    <meta name="twitter:card" content="summary" />
    <meta name="twitter:title" content="${safeTitle}" />
    <meta name="twitter:description" content="${safeDescription}" />
  `;
}

/**
 * Inject OG meta tags into HTML and update title
 */
export function injectOGMetaTags(html: string, meta: OGMetaData): string {
  const metaTags = generateOGMetaTags(meta);
  const safeTitle = escapeHtml(truncate(meta.title, 60));

  return html
    .replace(/<title>.*?<\/title>/, `<title>${safeTitle}</title>`)
    .replace("</head>", `${metaTags}\n  </head>`);
}

// ============================================
// Data fetchers for each shareable link type
// ============================================

/**
 * Get OG meta data for guest RSVP links (/guest-rsvp/:guestToken)
 */
export async function getGuestRsvpMeta(guestToken: string): Promise<OGMetaData | null> {
  try {
    // First try the rsvps table (for member guest RSVPs)
    const [guestRsvp] = await db
      .select()
      .from(rsvpsTable)
      .where(eq(rsvpsTable.guestToken, guestToken))
      .limit(1);

    let itineraryId: string | null = null;

    if (guestRsvp) {
      itineraryId = guestRsvp.itineraryId;
    } else {
      // Try guestInvites table (for non-member guest invites)
      const [guestInvite] = await db
        .select()
        .from(guestInvites)
        .where(eq(guestInvites.guestToken, guestToken))
        .limit(1);

      if (guestInvite) {
        itineraryId = guestInvite.itineraryId;
      }
    }

    if (!itineraryId) {
      return null;
    }

    // Get itinerary with items
    const itinerary = await storage.getItinerary(itineraryId);
    if (!itinerary || !itinerary.groupId) {
      return null;
    }

    // Get group
    const group = await storage.getGroup(itinerary.groupId);
    if (!group) {
      return null;
    }

    // Get RSVP count for "X going"
    const rsvps = await storage.getItineraryRsvps(itineraryId);
    const goingCount = rsvps.filter(r => r.response === "yes").length;

    // Get first venue name
    const firstVenue = itinerary.items?.[0];
    const venueName = firstVenue?.venueName || itinerary.name || "Event";

    // Build title and description
    const groupEmoji = group.emoji || "";
    const title = `${venueName} | ${groupEmoji} ${group.name}`.trim();

    let description = "You're invited!";
    if (goingCount > 0) {
      description = `${goingCount} going. RSVP now!`;
    } else {
      description = "Be the first to RSVP!";
    }

    return {
      title,
      description,
      url: `${getBaseUrl()}/guest-rsvp/${guestToken}`,
      siteName: "Kinmo",
      type: "website",
    };
  } catch (error) {
    console.error("[OG Meta] Error fetching guest RSVP data:", error);
    return null;
  }
}

/**
 * Get OG meta data for group join links (/join/:shareableLink)
 */
export async function getGroupJoinMeta(shareableLink: string): Promise<OGMetaData | null> {
  try {
    const group = await storage.getGroupByShareableLink(shareableLink);
    if (!group) {
      return null;
    }

    const groupEmoji = group.emoji || "";
    const title = `Join ${groupEmoji} ${group.name} on Kinmo`.trim();

    let description = "You've been invited to join a group that plans events together.";
    if (group.locationBase) {
      description = `You've been invited to join a group that plans events together in ${group.locationBase}.`;
    }

    return {
      title,
      description,
      url: `${getBaseUrl()}/join/${shareableLink}`,
      siteName: "Kinmo",
      type: "website",
    };
  } catch (error) {
    console.error("[OG Meta] Error fetching group join data:", error);
    return null;
  }
}

/**
 * Get OG meta data for member claim links (/claim/:claimToken)
 */
export async function getMemberClaimMeta(claimToken: string): Promise<OGMetaData | null> {
  try {
    // Find member by claim token
    const [member] = await db
      .select({
        id: membersTable.id,
        name: membersTable.name,
        groupId: membersTable.groupId,
      })
      .from(membersTable)
      .where(sql`claim_token = ${claimToken}`)
      .limit(1);

    if (!member) {
      return null;
    }

    // Get group info
    const group = await storage.getGroup(member.groupId);
    if (!group) {
      return null;
    }

    const groupEmoji = group.emoji || "";
    const title = `Claim your spot in ${groupEmoji} ${group.name}`.trim();
    const description = `Complete your profile to join ${group.name} and start receiving event invites.`;

    return {
      title,
      description,
      url: `${getBaseUrl()}/claim/${claimToken}`,
      siteName: "Kinmo",
      type: "website",
    };
  } catch (error) {
    console.error("[OG Meta] Error fetching member claim data:", error);
    return null;
  }
}
