import { Resend } from 'resend';
import { withRetry } from './lib/retry';

// Email is enabled only if RESEND_API_KEY is configured
const EMAIL_ENABLED = !!process.env.RESEND_API_KEY;

const resend = new Resend(process.env.RESEND_API_KEY || 'stub_key_not_used');

// Email-specific retry options
const EMAIL_RETRY_OPTIONS = {
  maxRetries: 3,
  initialDelay: 1000,
  maxDelay: 10000,
  shouldRetry: (error: any) => {
    // Retry on rate limits and server errors
    const status = error.status || error.statusCode;
    if (status === 429 || (status >= 500 && status < 600)) return true;
    // Retry on network errors
    if (error.code === 'ECONNRESET' || error.code === 'ETIMEDOUT') return true;
    // Don't retry on client errors (bad email, etc.)
    if (status >= 400 && status < 500) return false;
    return true;
  },
  onRetry: (error: any, attempt: number, delay: number) => {
    console.log(`[EMAIL Retry] Attempt ${attempt} failed, retrying in ${delay}ms:`, error.message);
  },
};

/**
 * Send email with automatic retry on transient failures
 */
async function sendEmailWithRetry(emailConfig: Parameters<typeof resend.emails.send>[0]) {
  return withRetry(
    async () => {
      const result = await resend.emails.send(emailConfig);
      // Treat Resend API-level errors as failures that should be retried
      if (result.error) {
        const error = new Error(result.error.message) as any;
        error.status = 500; // Treat as server error to trigger retry
        throw error;
      }
      return result;
    },
    EMAIL_RETRY_OPTIONS
  );
}

export interface EmailRecipient {
  email: string;
  name: string;
}

export interface ItineraryInviteData {
  groupName: string;
  organizerName: string;
  eventDate: string;
  eventTime: string;
  venues: Array<{
    name: string;
    type: string;
    address?: string;
  }>;
  rsvpDeadline: string;
  rsvpLink: string;
}

export interface ReminderData {
  groupName: string;
  organizerName: string;
  eventDate: string;
  eventTime: string;
  rsvpDeadline?: string;
  rsvpLink: string;
  daysUntilEvent?: number;
}

export interface RescheduleData {
  groupName: string;
  eventDate: string;
  eventTime: string;
  venues: Array<{
    name: string;
    type: string;
  }>;
  reason: string;
  rsvpLink: string;
}

// Helper to build events dashboard URL from any RSVP/claim link
function getEventsUrl(fullUrl: string): string {
  try {
    const url = new URL(fullUrl);
    url.pathname = '/events';
    url.search = '';
    return url.toString();
  } catch {
    // Fallback if URL parsing fails
    return fullUrl.split('/rsvp/')[0].split('/claim/')[0] + '/events';
  }
}

export async function sendItineraryInvite(
  recipient: EmailRecipient,
  data: ItineraryInviteData
): Promise<{ success: boolean; error?: string }> {
  if (!EMAIL_ENABLED) {
    console.log('[EMAIL DISABLED] Would send itinerary invite to:', recipient.email);
    return { success: true };
  }
  try {
    const venueList = data.venues.map((v, idx) => 
      `${idx + 1}. ${v.name} (${v.type})${v.address ? ` - ${v.address}` : ''}`
    ).join('\n');
    
    const eventsUrl = getEventsUrl(data.rsvpLink);

    // Format venue type for display, filtering out generic terms
    const formatVenueType = (type: string): string => {
      const normalized = type.toLowerCase().replace(/_/g, ' ').trim();

      // Generic terms that aren't helpful to show
      const genericTerms = [
        'venue', 'place', 'establishment', 'point of interest',
        'meal', 'food', 'store', 'shop', 'business', 'local business',
        'premise', 'general contractor', 'subpremise'
      ];

      if (genericTerms.includes(normalized)) {
        return ''; // Return empty so it won't display
      }

      // Title case the result
      return normalized.replace(/\b\w/g, c => c.toUpperCase());
    };

    const result = await sendEmailWithRetry({
      from: 'Kinmo <invites@kinmo.ai>',
      to: recipient.email,
      subject: `${data.organizerName} invited you · ${data.groupName}`,
      html: `
        <!DOCTYPE html>
        <html>
          <head>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <link href="https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,400;9..144,500;9..144,600&family=DM+Sans:wght@400;500&display=swap" rel="stylesheet">
          </head>
          <body style="margin: 0; padding: 0; background-color: #f5f0e8; font-family: 'DM Sans', -apple-system, sans-serif;">
            <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f5f0e8; padding: 40px 20px;">
              <tr>
                <td align="center">
                  <table width="100%" cellpadding="0" cellspacing="0" style="max-width: 520px; background-color: #fffdf9; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 24px rgba(0,0,0,0.06);">

                    <!-- Header with warm accent -->
                    <tr>
                      <td style="background: linear-gradient(135deg, #e07a5f 0%, #d4a574 100%); padding: 32px 40px; text-align: center;">
                        <p style="margin: 0 0 8px 0; font-size: 13px; letter-spacing: 2px; text-transform: uppercase; color: rgba(255,255,255,0.85); font-weight: 500;">You're invited</p>
                        <h1 style="margin: 0; font-family: 'Fraunces', Georgia, serif; font-size: 28px; font-weight: 500; color: #ffffff; line-height: 1.2;">${data.groupName}</h1>
                      </td>
                    </tr>

                    <!-- Main content -->
                    <tr>
                      <td style="padding: 36px 40px 24px;">
                        <p style="margin: 0 0 20px; font-size: 16px; color: #3d3d3d; line-height: 1.6;">
                          Hey ${recipient.name},
                        </p>
                        <p style="margin: 0 0 28px; font-size: 16px; color: #3d3d3d; line-height: 1.6;">
                          <strong style="color: #1a1a1a;">${data.organizerName}</strong> wants to hang out and hopes you can make it.
                        </p>

                        <!-- Date/Time card -->
                        <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #faf7f2; border-radius: 12px; margin-bottom: 24px;">
                          <tr>
                            <td style="padding: 20px 24px;">
                              <table width="100%" cellpadding="0" cellspacing="0">
                                <tr>
                                  <td width="48" valign="top">
                                    <div style="width: 40px; height: 40px; background: linear-gradient(135deg, #e07a5f 0%, #d4a574 100%); border-radius: 10px; text-align: center; line-height: 40px; font-size: 18px;">📅</div>
                                  </td>
                                  <td valign="top" style="padding-left: 12px;">
                                    <p style="margin: 0 0 2px; font-size: 13px; text-transform: uppercase; letter-spacing: 1px; color: #8b7355; font-weight: 500;">When</p>
                                    <p style="margin: 0; font-family: 'Fraunces', Georgia, serif; font-size: 18px; color: #1a1a1a; font-weight: 500;">${data.eventDate}</p>
                                    <p style="margin: 4px 0 0; font-size: 15px; color: #5c5c5c;">${data.eventTime}</p>
                                  </td>
                                </tr>
                              </table>
                            </td>
                          </tr>
                        </table>

                        <!-- Venues -->
                        <p style="margin: 0 0 16px; font-size: 13px; text-transform: uppercase; letter-spacing: 1.5px; color: #8b7355; font-weight: 500;">The Plan</p>

                        ${data.venues.map((v, idx) => `
                          <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom: 12px;">
                            <tr>
                              <td width="32" valign="top">
                                <div style="width: 24px; height: 24px; background-color: ${idx === 0 ? '#e07a5f' : '#d4a574'}; border-radius: 50%; text-align: center; line-height: 24px; font-size: 12px; color: white; font-weight: 600;">${idx + 1}</div>
                              </td>
                              <td valign="top" style="padding-left: 8px; border-bottom: 1px solid #f0ebe3; padding-bottom: 12px;">
                                <p style="margin: 0 0 2px; font-size: 16px; color: #1a1a1a; font-weight: 500;">${v.name}</p>
                                <p style="margin: 0; font-size: 13px; color: #8b8b8b;">${formatVenueType(v.type) ? `${formatVenueType(v.type)}${v.address ? ' · ' : ''}` : ''}${v.address || ''}</p>
                              </td>
                            </tr>
                          </table>
                        `).join('')}
                      </td>
                    </tr>

                    <!-- CTA Section -->
                    <tr>
                      <td style="padding: 8px 40px 36px;">
                        <table width="100%" cellpadding="0" cellspacing="0">
                          <tr>
                            <td align="center">
                              <a href="${data.rsvpLink}" style="display: inline-block; background: linear-gradient(135deg, #e07a5f 0%, #c96a50 100%); color: #ffffff; text-decoration: none; padding: 16px 48px; border-radius: 50px; font-size: 15px; font-weight: 500; letter-spacing: 0.5px; box-shadow: 0 4px 12px rgba(224,122,95,0.35);">RSVP Now</a>
                            </td>
                          </tr>
                          <tr>
                            <td align="center" style="padding-top: 16px;">
                              <p style="margin: 0; font-size: 13px; color: #a09080;">Please respond by <strong style="color: #5c5c5c;">${data.rsvpDeadline}</strong></p>
                            </td>
                          </tr>
                        </table>
                      </td>
                    </tr>

                    <!-- Footer -->
                    <tr>
                      <td style="background-color: #faf7f2; padding: 24px 40px; text-align: center; border-top: 1px solid #f0ebe3;">
                        <p style="margin: 0 0 8px; font-size: 13px; color: #a09080;">
                          Can't make it? No worries — just let us know.
                        </p>
                        <p style="margin: 0; font-size: 12px; color: #c0b0a0;">
                          <a href="${eventsUrl}" style="color: #8b7355; text-decoration: none;">View all your events</a> · Sent via <a href="https://kinmo.ai" style="color: #8b7355; text-decoration: none;">Kinmo</a>
                        </p>
                      </td>
                    </tr>

                  </table>
                </td>
              </tr>
            </table>
          </body>
        </html>
      `,
    });

    console.log(`[EMAIL] Successfully sent invite to ${recipient.email}, id: ${result.data?.id}`);
    return { success: true };
  } catch (error) {
    console.error('[EMAIL] Error sending invite email (after retries):', error);
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}

export async function sendGentleNudge(
  recipient: EmailRecipient,
  data: ReminderData
): Promise<{ success: boolean; error?: string }> {
  if (!EMAIL_ENABLED) {
    console.log('[EMAIL DISABLED] Would send gentle nudge to:', recipient.email);
    return { success: true };
  }
  try {
    const eventsUrl = getEventsUrl(data.rsvpLink);
    await sendEmailWithRetry({
      from: 'Kinmo <invites@kinmo.ai>',
      to: recipient.email,
      subject: `${data.groupName} · ${data.eventDate}`,
      html: `
        <!DOCTYPE html>
        <html>
          <head>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <link href="https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,400;9..144,500;9..144,600&family=DM+Sans:wght@400;500&display=swap" rel="stylesheet">
          </head>
          <body style="margin: 0; padding: 0; background-color: #f5f0e8; font-family: 'DM Sans', -apple-system, sans-serif;">
            <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f5f0e8; padding: 40px 20px;">
              <tr>
                <td align="center">
                  <table width="100%" cellpadding="0" cellspacing="0" style="max-width: 520px; background-color: #fffdf9; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 24px rgba(0,0,0,0.06);">

                    <!-- Header with warm accent -->
                    <tr>
                      <td style="background: linear-gradient(135deg, #d4a574 0%, #c9956a 100%); padding: 32px 40px; text-align: center;">
                        <p style="margin: 0 0 8px 0; font-size: 13px; letter-spacing: 2px; text-transform: uppercase; color: rgba(255,255,255,0.85); font-weight: 500;">Coming up</p>
                        <h1 style="margin: 0; font-family: 'Fraunces', Georgia, serif; font-size: 28px; font-weight: 500; color: #ffffff; line-height: 1.2;">${data.groupName}</h1>
                      </td>
                    </tr>

                    <!-- Main content -->
                    <tr>
                      <td style="padding: 36px 40px 24px;">
                        <p style="margin: 0 0 20px; font-size: 16px; color: #3d3d3d; line-height: 1.6;">
                          Hey ${recipient.name},
                        </p>
                        <p style="margin: 0 0 28px; font-size: 16px; color: #3d3d3d; line-height: 1.6;">
                          Hope you can make it! Just let us know when you get a chance — it helps us plan.
                        </p>

                        <!-- Date/Time card -->
                        <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #faf7f2; border-radius: 12px; margin-bottom: 24px;">
                          <tr>
                            <td style="padding: 20px 24px;">
                              <table width="100%" cellpadding="0" cellspacing="0">
                                <tr>
                                  <td width="48" valign="top">
                                    <div style="width: 40px; height: 40px; background: linear-gradient(135deg, #d4a574 0%, #c9956a 100%); border-radius: 10px; text-align: center; line-height: 40px; font-size: 18px;">📅</div>
                                  </td>
                                  <td valign="top" style="padding-left: 12px;">
                                    <p style="margin: 0 0 2px; font-size: 13px; text-transform: uppercase; letter-spacing: 1px; color: #8b7355; font-weight: 500;">When</p>
                                    <p style="margin: 0; font-family: 'Fraunces', Georgia, serif; font-size: 18px; color: #1a1a1a; font-weight: 500;">${data.eventDate}</p>
                                    <p style="margin: 4px 0 0; font-size: 15px; color: #5c5c5c;">${data.eventTime}</p>
                                  </td>
                                </tr>
                                ${data.rsvpDeadline ? `
                                <tr>
                                  <td width="48" valign="top" style="padding-top: 16px;">
                                    <div style="width: 40px; height: 40px; background: linear-gradient(135deg, #c9956a 0%, #b8895f 100%); border-radius: 10px; text-align: center; line-height: 40px; font-size: 18px;">⏰</div>
                                  </td>
                                  <td valign="top" style="padding-left: 12px; padding-top: 16px;">
                                    <p style="margin: 0 0 2px; font-size: 13px; text-transform: uppercase; letter-spacing: 1px; color: #8b7355; font-weight: 500;">RSVP by</p>
                                    <p style="margin: 0; font-family: 'Fraunces', Georgia, serif; font-size: 18px; color: #1a1a1a; font-weight: 500;">${data.rsvpDeadline}</p>
                                  </td>
                                </tr>
                                ` : ''}
                              </table>
                            </td>
                          </tr>
                        </table>
                      </td>
                    </tr>

                    <!-- CTA Section -->
                    <tr>
                      <td style="padding: 8px 40px 36px;">
                        <table width="100%" cellpadding="0" cellspacing="0">
                          <tr>
                            <td align="center">
                              <a href="${data.rsvpLink}" style="display: inline-block; background: linear-gradient(135deg, #d4a574 0%, #b8895f 100%); color: #ffffff; text-decoration: none; padding: 16px 48px; border-radius: 50px; font-size: 15px; font-weight: 500; letter-spacing: 0.5px; box-shadow: 0 4px 12px rgba(212,165,116,0.35);">RSVP</a>
                            </td>
                          </tr>
                        </table>
                      </td>
                    </tr>

                    <!-- Footer -->
                    <tr>
                      <td style="background-color: #faf7f2; padding: 24px 40px; text-align: center; border-top: 1px solid #f0ebe3;">
                        <p style="margin: 0 0 8px; font-size: 13px; color: #a09080;">
                          Either way works — just helps to know.
                        </p>
                        <p style="margin: 0; font-size: 12px; color: #c0b0a0;">
                          <a href="${eventsUrl}" style="color: #8b7355; text-decoration: none;">View all your events</a> · Sent via <a href="https://kinmo.ai" style="color: #8b7355; text-decoration: none;">Kinmo</a>
                        </p>
                      </td>
                    </tr>

                  </table>
                </td>
              </tr>
            </table>
          </body>
        </html>
      `,
    });

    return { success: true };
  } catch (error) {
    console.error('Error sending gentle nudge:', error);
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}

export async function sendFinalCall(
  recipient: EmailRecipient,
  data: ReminderData
): Promise<{ success: boolean; error?: string }> {
  if (!EMAIL_ENABLED) {
    console.log('[EMAIL DISABLED] Would send final call to:', recipient.email);
    return { success: true };
  }
  try {
    const eventsUrl = getEventsUrl(data.rsvpLink);
    await sendEmailWithRetry({
      from: 'Kinmo <invites@kinmo.ai>',
      to: recipient.email,
      subject: `This ${data.eventDate.split(',')[0]} · ${data.groupName}`,
      html: `
        <!DOCTYPE html>
        <html>
          <head>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <link href="https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,400;9..144,500;9..144,600&family=DM+Sans:wght@400;500&display=swap" rel="stylesheet">
          </head>
          <body style="margin: 0; padding: 0; background-color: #f5f0e8; font-family: 'DM Sans', -apple-system, sans-serif;">
            <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f5f0e8; padding: 40px 20px;">
              <tr>
                <td align="center">
                  <table width="100%" cellpadding="0" cellspacing="0" style="max-width: 520px; background-color: #fffdf9; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 24px rgba(0,0,0,0.06);">

                    <!-- Header with warm coral accent -->
                    <tr>
                      <td style="background: linear-gradient(135deg, #e07a5f 0%, #d4a574 100%); padding: 32px 40px; text-align: center;">
                        <p style="margin: 0 0 8px 0; font-size: 13px; letter-spacing: 2px; text-transform: uppercase; color: rgba(255,255,255,0.85); font-weight: 500;">Coming up soon</p>
                        <h1 style="margin: 0; font-family: 'Fraunces', Georgia, serif; font-size: 28px; font-weight: 500; color: #ffffff; line-height: 1.2;">${data.groupName}</h1>
                      </td>
                    </tr>

                    <!-- Main content -->
                    <tr>
                      <td style="padding: 36px 40px 24px;">
                        <p style="margin: 0 0 20px; font-size: 16px; color: #3d3d3d; line-height: 1.6;">
                          Hey ${recipient.name},
                        </p>
                        <p style="margin: 0 0 28px; font-size: 16px; color: #3d3d3d; line-height: 1.6;">
                          This is coming up soon — would love to know if you can join! A quick response helps us get everything ready.
                        </p>

                        <!-- Date/Time card -->
                        <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #faf7f2; border-radius: 12px; margin-bottom: 24px;">
                          <tr>
                            <td style="padding: 20px 24px;">
                              <table width="100%" cellpadding="0" cellspacing="0">
                                <tr>
                                  <td width="48" valign="top">
                                    <div style="width: 40px; height: 40px; background: linear-gradient(135deg, #e07a5f 0%, #d4a574 100%); border-radius: 10px; text-align: center; line-height: 40px; font-size: 18px;">📅</div>
                                  </td>
                                  <td valign="top" style="padding-left: 12px;">
                                    <p style="margin: 0 0 2px; font-size: 13px; text-transform: uppercase; letter-spacing: 1px; color: #8b7355; font-weight: 500;">When</p>
                                    <p style="margin: 0; font-family: 'Fraunces', Georgia, serif; font-size: 18px; color: #1a1a1a; font-weight: 500;">${data.eventDate}</p>
                                    <p style="margin: 4px 0 0; font-size: 15px; color: #5c5c5c;">${data.eventTime}</p>
                                  </td>
                                </tr>
                                ${data.rsvpDeadline ? `
                                <tr>
                                  <td width="48" valign="top" style="padding-top: 16px;">
                                    <div style="width: 40px; height: 40px; background: linear-gradient(135deg, #d4a574 0%, #c96a50 100%); border-radius: 10px; text-align: center; line-height: 40px; font-size: 18px;">⏰</div>
                                  </td>
                                  <td valign="top" style="padding-left: 12px; padding-top: 16px;">
                                    <p style="margin: 0 0 2px; font-size: 13px; text-transform: uppercase; letter-spacing: 1px; color: #8b7355; font-weight: 500;">RSVP by</p>
                                    <p style="margin: 0; font-family: 'Fraunces', Georgia, serif; font-size: 18px; color: #1a1a1a; font-weight: 500;">${data.rsvpDeadline}</p>
                                  </td>
                                </tr>
                                ` : ''}
                              </table>
                            </td>
                          </tr>
                        </table>
                      </td>
                    </tr>

                    <!-- CTA Section -->
                    <tr>
                      <td style="padding: 8px 40px 36px;">
                        <table width="100%" cellpadding="0" cellspacing="0">
                          <tr>
                            <td align="center">
                              <a href="${data.rsvpLink}" style="display: inline-block; background: linear-gradient(135deg, #e07a5f 0%, #c96a50 100%); color: #ffffff; text-decoration: none; padding: 16px 48px; border-radius: 50px; font-size: 15px; font-weight: 500; letter-spacing: 0.5px; box-shadow: 0 4px 12px rgba(224,122,95,0.35);">RSVP</a>
                            </td>
                          </tr>
                        </table>
                      </td>
                    </tr>

                    <!-- Footer -->
                    <tr>
                      <td style="background-color: #faf7f2; padding: 24px 40px; text-align: center; border-top: 1px solid #f0ebe3;">
                        <p style="margin: 0 0 8px; font-size: 13px; color: #a09080;">
                          No pressure — just let us know when you can.
                        </p>
                        <p style="margin: 0; font-size: 12px; color: #c0b0a0;">
                          <a href="${eventsUrl}" style="color: #8b7355; text-decoration: none;">View all your events</a> · Sent via <a href="https://kinmo.ai" style="color: #8b7355; text-decoration: none;">Kinmo</a>
                        </p>
                      </td>
                    </tr>

                  </table>
                </td>
              </tr>
            </table>
          </body>
        </html>
      `,
    });

    return { success: true };
  } catch (error) {
    console.error('Error sending final call:', error);
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}

export async function sendDayBeforeReminder(
  recipient: EmailRecipient,
  data: ReminderData
): Promise<{ success: boolean; error?: string }> {
  if (!EMAIL_ENABLED) {
    console.log('[EMAIL DISABLED] Would send day-before reminder to:', recipient.email);
    return { success: true };
  }
  try {
    const eventsUrl = getEventsUrl(data.rsvpLink);
    await sendEmailWithRetry({
      from: 'Kinmo <invites@kinmo.ai>',
      to: recipient.email,
      subject: `Tomorrow · ${data.groupName}`,
      html: `
        <!DOCTYPE html>
        <html>
          <head>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <link href="https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,400;9..144,500;9..144,600&family=DM+Sans:wght@400;500&display=swap" rel="stylesheet">
          </head>
          <body style="margin: 0; padding: 0; background-color: #f5f0e8; font-family: 'DM Sans', -apple-system, sans-serif;">
            <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f5f0e8; padding: 40px 20px;">
              <tr>
                <td align="center">
                  <table width="100%" cellpadding="0" cellspacing="0" style="max-width: 520px; background-color: #fffdf9; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 24px rgba(0,0,0,0.06);">

                    <!-- Header with sage/green accent for positive vibes -->
                    <tr>
                      <td style="background: linear-gradient(135deg, #7c9a7e 0%, #a3b899 100%); padding: 32px 40px; text-align: center;">
                        <p style="margin: 0 0 8px 0; font-size: 13px; letter-spacing: 2px; text-transform: uppercase; color: rgba(255,255,255,0.85); font-weight: 500;">See you tomorrow</p>
                        <h1 style="margin: 0; font-family: 'Fraunces', Georgia, serif; font-size: 28px; font-weight: 500; color: #ffffff; line-height: 1.2;">${data.groupName}</h1>
                      </td>
                    </tr>

                    <!-- Main content -->
                    <tr>
                      <td style="padding: 36px 40px 24px;">
                        <p style="margin: 0 0 20px; font-size: 16px; color: #3d3d3d; line-height: 1.6;">
                          Hey ${recipient.name},
                        </p>
                        <p style="margin: 0 0 28px; font-size: 16px; color: #3d3d3d; line-height: 1.6;">
                          Just a friendly reminder — this is happening tomorrow. Hope to see you there!
                        </p>

                        <!-- Date/Time card -->
                        <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #faf7f2; border-radius: 12px; margin-bottom: 24px;">
                          <tr>
                            <td style="padding: 20px 24px;">
                              <table width="100%" cellpadding="0" cellspacing="0">
                                <tr>
                                  <td width="48" valign="top">
                                    <div style="width: 40px; height: 40px; background: linear-gradient(135deg, #7c9a7e 0%, #a3b899 100%); border-radius: 10px; text-align: center; line-height: 40px; font-size: 18px;">📅</div>
                                  </td>
                                  <td valign="top" style="padding-left: 12px;">
                                    <p style="margin: 0 0 2px; font-size: 13px; text-transform: uppercase; letter-spacing: 1px; color: #8b7355; font-weight: 500;">Tomorrow</p>
                                    <p style="margin: 0; font-family: 'Fraunces', Georgia, serif; font-size: 18px; color: #1a1a1a; font-weight: 500;">${data.eventDate}</p>
                                    <p style="margin: 4px 0 0; font-size: 15px; color: #5c5c5c;">${data.eventTime}</p>
                                  </td>
                                </tr>
                              </table>
                            </td>
                          </tr>
                        </table>
                      </td>
                    </tr>

                    <!-- CTA Section -->
                    <tr>
                      <td style="padding: 8px 40px 36px;">
                        <table width="100%" cellpadding="0" cellspacing="0">
                          <tr>
                            <td align="center">
                              <a href="${data.rsvpLink}" style="display: inline-block; background: linear-gradient(135deg, #7c9a7e 0%, #6b8a6d 100%); color: #ffffff; text-decoration: none; padding: 16px 48px; border-radius: 50px; font-size: 15px; font-weight: 500; letter-spacing: 0.5px; box-shadow: 0 4px 12px rgba(124,154,126,0.35);">View details</a>
                            </td>
                          </tr>
                        </table>
                      </td>
                    </tr>

                    <!-- Footer -->
                    <tr>
                      <td style="background-color: #faf7f2; padding: 24px 40px; text-align: center; border-top: 1px solid #f0ebe3;">
                        <p style="margin: 0 0 8px; font-size: 13px; color: #a09080;">
                          See you there.
                        </p>
                        <p style="margin: 0; font-size: 12px; color: #c0b0a0;">
                          <a href="${eventsUrl}" style="color: #8b7355; text-decoration: none;">View all your events</a> · Sent via <a href="https://kinmo.ai" style="color: #8b7355; text-decoration: none;">Kinmo</a>
                        </p>
                      </td>
                    </tr>

                  </table>
                </td>
              </tr>
            </table>
          </body>
        </html>
      `,
    });

    return { success: true };
  } catch (error) {
    console.error('Error sending day-before reminder:', error);
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}

export interface MemberWelcomeData {
  groupName: string;
  groupEmoji: string;
  organizerName: string;
  claimLink: string;
}

export async function sendMemberWelcome(
  recipient: EmailRecipient,
  data: MemberWelcomeData
): Promise<{ success: boolean; error?: string }> {
  if (!EMAIL_ENABLED) {
    console.log('[EMAIL DISABLED] Would send member welcome to:', recipient.email);
    return { success: true };
  }
  try {
    const eventsUrl = getEventsUrl(data.claimLink);
    await sendEmailWithRetry({
      from: 'Kinmo.ai <invites@kinmo.ai>',
      to: recipient.email,
      subject: `Welcome to ${data.groupName}!`,
      html: `
        <!DOCTYPE html>
        <html>
          <head>
            <style>
              body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; line-height: 1.6; color: #333; }
              .container { max-width: 600px; margin: 0 auto; padding: 20px; }
              .header { background: linear-gradient(135deg, #7c3aed 0%, #a855f7 100%); color: white; padding: 30px; border-radius: 8px; margin-bottom: 20px; text-align: center; }
              .content { background: #f9fafb; padding: 30px; border-radius: 8px; }
              .button { display: inline-block; background: #7c3aed; color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px; margin: 20px 0; }
              .footer { text-align: center; color: #6b7280; font-size: 14px; margin-top: 30px; }
              .feature-list { background: white; padding: 20px; border-radius: 6px; margin: 20px 0; }
              .feature-item { padding: 10px 0; display: flex; align-items: start; }
              .feature-icon { margin-right: 10px; font-size: 20px; }
            </style>
          </head>
          <body>
            <div class="container">
              <div class="header">
                <div style="font-size: 48px; margin-bottom: 10px;">${data.groupEmoji}</div>
                <h1 style="margin: 0;">Welcome to ${data.groupName}!</h1>
              </div>
              
              <div class="content">
                <p>Hi ${recipient.name}!</p>
                
                <p>${data.organizerName} has added you to <strong>${data.groupName}</strong> on Kinmo.ai - the easiest way to plan group activities.</p>
                
                <div class="feature-list">
                  <h3 style="margin-top: 0;">What you can do:</h3>
                  <div class="feature-item">
                    <span class="feature-icon">🎉</span>
                    <span>RSVP to group events and outings</span>
                  </div>
                  <div class="feature-item">
                    <span class="feature-icon">🗳️</span>
                    <span>Vote on venue suggestions</span>
                  </div>
                  <div class="feature-item">
                    <span class="feature-icon">📍</span>
                    <span>See upcoming plans and itineraries</span>
                  </div>
                  <div class="feature-item">
                    <span class="feature-icon">💬</span>
                    <span>Share your availability and preferences</span>
                  </div>
                </div>
                
                <p><strong>Get started by claiming your membership:</strong></p>
                
                <center>
                  <a href="${data.claimLink}" class="button">Claim Your Membership</a>
                </center>
                
                <p style="font-size: 14px; color: #6b7280; margin-top: 30px;">
                  Once you claim your membership, you'll be able to:
                </p>
                <ul style="font-size: 14px; color: #6b7280;">
                  <li>View all upcoming events in one place</li>
                  <li>RSVP to invitations anytime</li>
                  <li>See past events and group history</li>
                </ul>
                
                <p style="font-size: 14px; color: #6b7280; text-align: center; border-top: 1px solid #e5e7eb; padding-top: 20px; margin-top: 20px;">
                  💡 After claiming, visit <a href="${eventsUrl}" style="color: #7c3aed;">kinmo.ai/events</a> anytime to manage your group invitations
                </p>
              </div>
              
              <div class="footer">
                <p>Powered by Kinmo.ai - Making group planning effortless</p>
              </div>
            </div>
          </body>
        </html>
      `,
    });

    return { success: true };
  } catch (error) {
    console.error('Error sending member welcome email:', error);
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}

export async function sendItineraryReschedule(
  recipient: EmailRecipient,
  data: RescheduleData
): Promise<{ success: boolean; error?: string }> {
  if (!EMAIL_ENABLED) {
    console.log('[EMAIL DISABLED] Would send reschedule notice to:', recipient.email);
    return { success: true };
  }
  try {
    const eventsUrl = getEventsUrl(data.rsvpLink);
    await sendEmailWithRetry({
      from: 'Kinmo.ai <invites@kinmo.ai>',
      to: recipient.email,
      subject: `Updated time! ${data.groupName} - New schedule`,
      html: `
        <!DOCTYPE html>
        <html>
          <head>
            <style>
              body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; line-height: 1.6; color: #333; }
              .container { max-width: 600px; margin: 0 auto; padding: 20px; }
              .header { background: linear-gradient(135deg, #f59e0b 0%, #f97316 100%); color: white; padding: 30px; border-radius: 8px; margin-bottom: 20px; }
              .content { background: #f9fafb; padding: 30px; border-radius: 8px; }
              .venue-list { background: white; padding: 20px; border-radius: 6px; margin: 20px 0; }
              .venue-item { padding: 10px 0; border-bottom: 1px solid #e5e7eb; }
              .venue-item:last-child { border-bottom: none; }
              .button { display: inline-block; background: #f59e0b; color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px; margin: 20px 0; }
              .footer { text-align: center; color: #6b7280; font-size: 14px; margin-top: 30px; }
              .update-notice { background: #fef3c7; border-left: 4px solid #f59e0b; padding: 15px; margin: 20px 0; border-radius: 4px; }
              .reason { background: #e0e7ff; border-left: 4px solid #6366f1; padding: 15px; margin: 20px 0; border-radius: 4px; font-style: italic; }
            </style>
          </head>
          <body>
            <div class="container">
              <div class="header">
                <h1 style="margin: 0;">📅 Schedule Update</h1>
                <p style="margin: 10px 0 0 0; font-size: 18px;">${data.groupName}</p>
              </div>
              
              <div class="content">
                <p>Hi ${recipient.name}!</p>
                
                <div class="update-notice">
                  <strong>🔄 We've adjusted the time based on everyone's feedback!</strong>
                </div>
                
                <p><strong>📅 New time:</strong> ${data.eventDate} at ${data.eventTime}</p>
                
                <div class="reason">
                  <strong>Why the change?</strong><br>
                  ${data.reason}
                </div>
                
                <div class="venue-list">
                  <h3 style="margin-top: 0;">The Plan (same great venues!):</h3>
                  ${data.venues.map((v, idx) => `
                    <div class="venue-item">
                      <strong>${idx + 1}. ${v.name}</strong><br>
                      <span style="color: #6b7280;">${v.type}</span>
                    </div>
                  `).join('')}
                </div>
                
                <p><strong>Can you make the new time?</strong> Please update your RSVP:</p>
                
                <center>
                  <a href="${data.rsvpLink}" class="button">Update RSVP</a>
                </center>
                
                <p style="font-size: 14px; color: #6b7280; margin-top: 30px;">
                  We appreciate your flexibility! Let us know if this works better for you.
                </p>
                
                <p style="font-size: 14px; color: #6b7280; text-align: center; border-top: 1px solid #e5e7eb; padding-top: 20px; margin-top: 20px;">
                  💡 View all your upcoming events anytime at <a href="${eventsUrl}" style="color: #f59e0b;">kinmo.ai/events</a>
                </p>
              </div>
              
              <div class="footer">
                <p>Powered by Kinmo.ai - Making group planning effortless</p>
              </div>
            </div>
          </body>
        </html>
      `,
    });

    return { success: true };
  } catch (error) {
    console.error('Error sending reschedule email:', error);
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}

interface AvailabilityPulseData {
  groupName: string;
  groupEmoji: string;
  memberName: string;
  targetEventDate: string;
  pulseLink: string;
  deadline: string;
}

export async function sendAvailabilityPulseRequest(
  recipient: EmailRecipient,
  data: AvailabilityPulseData
): Promise<{ success: boolean; error?: string }> {
  if (!EMAIL_ENABLED) {
    console.log('[EMAIL DISABLED] Would send availability pulse to:', recipient.email);
    return { success: true };
  }
  try {
    const targetDate = new Date(data.targetEventDate);
    const deadlineDate = new Date(data.deadline);
    const formattedTarget = targetDate.toLocaleDateString('en-US', { month: 'long', day: 'numeric' });
    const formattedDeadline = deadlineDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

    await sendEmailWithRetry({
      from: 'Kinmo.ai <invites@kinmo.ai>',
      to: recipient.email,
      subject: `When works for you? · ${data.groupName}`,
      html: `
        <!DOCTYPE html>
        <html>
          <head>
            <style>
              body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; line-height: 1.6; color: #333; }
              .container { max-width: 600px; margin: 0 auto; padding: 20px; }
              .header { background: linear-gradient(135deg, #8b5cf6 0%, #6366f1 100%); color: white; padding: 30px; border-radius: 8px; margin-bottom: 20px; text-align: center; }
              .content { background: #f9fafb; padding: 30px; border-radius: 8px; }
              .button { display: inline-block; background: #6366f1; color: white; padding: 14px 32px; text-decoration: none; border-radius: 8px; margin: 20px 0; font-weight: 600; }
              .button:hover { background: #4f46e5; }
              .footer { text-align: center; color: #6b7280; font-size: 14px; margin-top: 30px; }
              .info-box { background: #ede9fe; border-radius: 8px; padding: 16px; margin: 20px 0; }
              .subtle { color: #6b7280; font-size: 14px; }
            </style>
          </head>
          <body>
            <div class="container">
              <div class="header">
                <div style="font-size: 48px; margin-bottom: 10px;">${data.groupEmoji || '📅'}</div>
                <h1 style="margin: 0; font-size: 24px;">${data.groupName}</h1>
              </div>

              <div class="content">
                <p>Hey ${data.memberName}!</p>

                <p>We're planning ${data.groupName}'s next hangout for around <strong>${formattedTarget}</strong>.</p>

                <div class="info-box">
                  <strong>When are you free over the next few weeks?</strong><br>
                  <span class="subtle">Your input helps us pick a time that works for everyone.</span>
                </div>

                <center>
                  <a href="${data.pulseLink}" class="button">Share Your Availability</a>
                </center>

                <p class="subtle" style="text-align: center;">
                  No pressure if you can't fill this out - we'll work with what we have!
                </p>

                <p class="subtle" style="text-align: center; margin-top: 20px;">
                  This link is good until ${formattedDeadline}
                </p>
              </div>

              <div class="footer">
                <p>Powered by Kinmo.ai - Making group planning effortless</p>
                <p class="subtle" style="font-size: 12px;">This link is just for you - don't share it with others</p>
              </div>
            </div>
          </body>
        </html>
      `,
    });

    return { success: true };
  } catch (error) {
    console.error('Error sending availability pulse email:', error);
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}
