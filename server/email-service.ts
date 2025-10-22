import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);

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

export async function sendItineraryInvite(
  recipient: EmailRecipient,
  data: ItineraryInviteData
): Promise<{ success: boolean; error?: string }> {
  try {
    const venueList = data.venues.map((v, idx) => 
      `${idx + 1}. ${v.name} (${v.type})${v.address ? ` - ${v.address}` : ''}`
    ).join('\n');

    await resend.emails.send({
      from: 'Kinmo.ai <invites@kinmo.ai>',
      to: recipient.email,
      subject: `You're invited! ${data.groupName} - ${data.eventDate}`,
      html: `
        <!DOCTYPE html>
        <html>
          <head>
            <style>
              body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; line-height: 1.6; color: #333; }
              .container { max-width: 600px; margin: 0 auto; padding: 20px; }
              .header { background: linear-gradient(135deg, #7c3aed 0%, #a855f7 100%); color: white; padding: 30px; border-radius: 8px; margin-bottom: 20px; }
              .content { background: #f9fafb; padding: 30px; border-radius: 8px; }
              .venue-list { background: white; padding: 20px; border-radius: 6px; margin: 20px 0; }
              .venue-item { padding: 10px 0; border-bottom: 1px solid #e5e7eb; }
              .venue-item:last-child { border-bottom: none; }
              .button { display: inline-block; background: #7c3aed; color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px; margin: 20px 0; }
              .footer { text-align: center; color: #6b7280; font-size: 14px; margin-top: 30px; }
              .deadline { background: #fef3c7; border-left: 4px solid #f59e0b; padding: 12px; margin: 20px 0; border-radius: 4px; }
            </style>
          </head>
          <body>
            <div class="container">
              <div class="header">
                <h1 style="margin: 0;">🎉 You're Invited!</h1>
                <p style="margin: 10px 0 0 0; font-size: 18px;">${data.groupName}</p>
              </div>
              
              <div class="content">
                <p>Hi ${recipient.name}!</p>
                
                <p>${data.organizerName} has planned an awesome outing and wants you to join!</p>
                
                <p><strong>📅 When:</strong> ${data.eventDate} at ${data.eventTime}</p>
                
                <div class="venue-list">
                  <h3 style="margin-top: 0;">The Plan:</h3>
                  ${data.venues.map((v, idx) => `
                    <div class="venue-item">
                      <strong>${idx + 1}. ${v.name}</strong><br>
                      <span style="color: #6b7280;">${v.type}${v.address ? ` • ${v.address}` : ''}</span>
                    </div>
                  `).join('')}
                </div>
                
                <div class="deadline">
                  <strong>⏰ RSVP by ${data.rsvpDeadline}</strong><br>
                  <span style="font-size: 14px;">Let us know if you can make it!</span>
                </div>
                
                <center>
                  <a href="${data.rsvpLink}" class="button">RSVP Now</a>
                </center>
                
                <p style="font-size: 14px; color: #6b7280; margin-top: 30px;">
                  Can't make it? No worries - just let us know through the RSVP link above.
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
    console.error('Error sending invite email:', error);
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}

export async function sendGentleNudge(
  recipient: EmailRecipient,
  data: ReminderData
): Promise<{ success: boolean; error?: string }> {
  try {
    await resend.emails.send({
      from: 'Kinmo.ai <invites@kinmo.ai>',
      to: recipient.email,
      subject: `Reminder: ${data.groupName} - Haven't heard from you yet!`,
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
            </style>
          </head>
          <body>
            <div class="container">
              <div class="header">
                <h1 style="margin: 0;">👋 Quick reminder!</h1>
              </div>
              
              <div class="content">
                <p>Hi ${recipient.name}!</p>
                
                <p>Just checking in - we haven't heard back from you yet about ${data.groupName} on <strong>${data.eventDate}</strong>.</p>
                
                <p>${data.organizerName} would love to know if you can join!</p>
                
                ${data.rsvpDeadline ? `
                  <p><strong>⏰ Please RSVP by ${data.rsvpDeadline}</strong></p>
                ` : ''}
                
                <center>
                  <a href="${data.rsvpLink}" class="button">RSVP Now</a>
                </center>
                
                <p style="font-size: 14px; color: #6b7280; margin-top: 30px;">
                  Takes just a moment - click the button above to let us know!
                </p>
              </div>
              
              <div class="footer">
                <p>Powered by Kinmo.ai</p>
              </div>
            </div>
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
  try {
    await resend.emails.send({
      from: 'Kinmo.ai <invites@kinmo.ai>',
      to: recipient.email,
      subject: `Final call! ${data.groupName} - RSVP needed`,
      html: `
        <!DOCTYPE html>
        <html>
          <head>
            <style>
              body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; line-height: 1.6; color: #333; }
              .container { max-width: 600px; margin: 0 auto; padding: 20px; }
              .header { background: linear-gradient(135deg, #dc2626 0%, #f97316 100%); color: white; padding: 30px; border-radius: 8px; margin-bottom: 20px; text-align: center; }
              .content { background: #f9fafb; padding: 30px; border-radius: 8px; }
              .button { display: inline-block; background: #dc2626; color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px; margin: 20px 0; }
              .footer { text-align: center; color: #6b7280; font-size: 14px; margin-top: 30px; }
              .urgent { background: #fee2e2; border-left: 4px solid #dc2626; padding: 15px; margin: 20px 0; border-radius: 4px; }
            </style>
          </head>
          <body>
            <div class="container">
              <div class="header">
                <h1 style="margin: 0;">⏰ Final Call!</h1>
              </div>
              
              <div class="content">
                <p>Hi ${recipient.name}!</p>
                
                <div class="urgent">
                  <strong>This is the last chance to RSVP!</strong><br>
                  <span style="font-size: 14px;">The RSVP deadline for ${data.groupName} is coming up soon.</span>
                </div>
                
                <p><strong>Event:</strong> ${data.eventDate} at ${data.eventTime}</p>
                
                <p>We need to finalize the headcount - please let ${data.organizerName} know if you can make it!</p>
                
                <center>
                  <a href="${data.rsvpLink}" class="button">RSVP Right Now</a>
                </center>
                
                <p style="font-size: 14px; color: #6b7280; margin-top: 30px;">
                  Even if you can't make it, please respond so we can plan accordingly. Thanks!
                </p>
              </div>
              
              <div class="footer">
                <p>Powered by Kinmo.ai</p>
              </div>
            </div>
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
  try {
    await resend.emails.send({
      from: 'Kinmo.ai <invites@kinmo.ai>',
      to: recipient.email,
      subject: `Tomorrow! ${data.groupName} - See you soon 🎉`,
      html: `
        <!DOCTYPE html>
        <html>
          <head>
            <style>
              body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; line-height: 1.6; color: #333; }
              .container { max-width: 600px; margin: 0 auto; padding: 20px; }
              .header { background: linear-gradient(135deg, #10b981 0%, #3b82f6 100%); color: white; padding: 30px; border-radius: 8px; margin-bottom: 20px; text-align: center; }
              .content { background: #f9fafb; padding: 30px; border-radius: 8px; }
              .button { display: inline-block; background: #10b981; color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px; margin: 20px 0; }
              .footer { text-align: center; color: #6b7280; font-size: 14px; margin-top: 30px; }
              .highlight { background: #dbeafe; border-left: 4px solid #3b82f6; padding: 15px; margin: 20px 0; border-radius: 4px; }
            </style>
          </head>
          <body>
            <div class="container">
              <div class="header">
                <h1 style="margin: 0;">🎉 Tomorrow's the day!</h1>
              </div>
              
              <div class="content">
                <p>Hi ${recipient.name}!</p>
                
                <p>This is a friendly reminder that <strong>${data.groupName}</strong> is happening <strong>tomorrow</strong>!</p>
                
                <div class="highlight">
                  <strong>📅 When:</strong> ${data.eventDate} at ${data.eventTime}
                </div>
                
                <p>Looking forward to seeing you there! 🎉</p>
                
                <center>
                  <a href="${data.rsvpLink}" class="button">View Event Details</a>
                </center>
                
                <p style="font-size: 14px; color: #6b7280; margin-top: 30px;">
                  Questions? Reply to this email or check the event page for full details.
                </p>
              </div>
              
              <div class="footer">
                <p>Powered by Kinmo.ai</p>
              </div>
            </div>
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
  try {
    await resend.emails.send({
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
                  You'll be able to sign in with your Replit account and see all the group's activities.
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
  try {
    await resend.emails.send({
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
