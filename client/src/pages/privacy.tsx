import { Link } from "wouter";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function Privacy() {
  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-3xl mx-auto px-4 py-8">
        <Link href="/">
          <Button variant="ghost" size="sm" className="mb-6">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Button>
        </Link>

        <h1 className="text-3xl font-bold mb-2">Privacy Policy</h1>
        <p className="text-muted-foreground mb-8">Last updated: November 25, 2024</p>

        <div className="prose prose-neutral dark:prose-invert max-w-none space-y-6">
          <section>
            <h2 className="text-xl font-semibold mb-3">1. Introduction</h2>
            <p className="text-muted-foreground">
              Kinmo ("we," "our," or "us") is a group event planning platform that helps friends coordinate outings.
              This Privacy Policy explains how we collect, use, and protect your information when you use our service at kinmo.ai.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">2. Information We Collect</h2>

            <h3 className="text-lg font-medium mt-4 mb-2">Account Information</h3>
            <ul className="list-disc pl-6 text-muted-foreground space-y-1">
              <li>Email address (via Replit authentication)</li>
              <li>Display name and profile picture (if provided)</li>
              <li>First and last name (optional)</li>
            </ul>

            <h3 className="text-lg font-medium mt-4 mb-2">Group and Event Data</h3>
            <ul className="list-disc pl-6 text-muted-foreground space-y-1">
              <li>Groups you create or join</li>
              <li>Group member names and email addresses</li>
              <li>Event details, RSVPs, and preferences</li>
              <li>Venue selections and feedback</li>
              <li>Availability schedules</li>
            </ul>

            <h3 className="text-lg font-medium mt-4 mb-2">Location Information</h3>
            <ul className="list-disc pl-6 text-muted-foreground space-y-1">
              <li>Group base locations (city/neighborhood level)</li>
              <li>Member home base locations (for event planning)</li>
              <li>Venue addresses from Google Places</li>
            </ul>

            <h3 className="text-lg font-medium mt-4 mb-2">Usage Data</h3>
            <ul className="list-disc pl-6 text-muted-foreground space-y-1">
              <li>Venue swipes and preferences</li>
              <li>Event attendance history</li>
              <li>Feature usage patterns</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">3. How We Use Your Information</h2>
            <ul className="list-disc pl-6 text-muted-foreground space-y-1">
              <li><strong>Event Planning:</strong> To suggest venues, coordinate schedules, and send event invitations</li>
              <li><strong>AI Recommendations:</strong> To provide personalized venue and activity suggestions using OpenAI</li>
              <li><strong>Venue Search:</strong> To find nearby places using Google Places API</li>
              <li><strong>Notifications:</strong> To send event reminders and updates via email (Resend)</li>
              <li><strong>Service Improvement:</strong> To understand usage patterns and improve the platform</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">4. Third-Party Services</h2>
            <p className="text-muted-foreground mb-3">We use the following third-party services:</p>

            <ul className="list-disc pl-6 text-muted-foreground space-y-2">
              <li>
                <strong>Replit:</strong> Authentication and hosting.
                <a href="https://replit.com/site/privacy" className="text-primary hover:underline ml-1" target="_blank" rel="noopener noreferrer">
                  Replit Privacy Policy
                </a>
              </li>
              <li>
                <strong>OpenAI:</strong> AI-powered venue recommendations and event planning. Your group preferences and event details may be processed by OpenAI's API.
                <a href="https://openai.com/privacy" className="text-primary hover:underline ml-1" target="_blank" rel="noopener noreferrer">
                  OpenAI Privacy Policy
                </a>
              </li>
              <li>
                <strong>Google Places:</strong> Venue information, photos, and search.
                <a href="https://policies.google.com/privacy" className="text-primary hover:underline ml-1" target="_blank" rel="noopener noreferrer">
                  Google Privacy Policy
                </a>
              </li>
              <li>
                <strong>Resend:</strong> Email delivery for notifications and reminders.
                <a href="https://resend.com/legal/privacy-policy" className="text-primary hover:underline ml-1" target="_blank" rel="noopener noreferrer">
                  Resend Privacy Policy
                </a>
              </li>
              <li>
                <strong>Neon:</strong> Database hosting (PostgreSQL).
                <a href="https://neon.tech/privacy-policy" className="text-primary hover:underline ml-1" target="_blank" rel="noopener noreferrer">
                  Neon Privacy Policy
                </a>
              </li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">5. Data Retention</h2>
            <p className="text-muted-foreground">
              We retain your data for as long as your account is active. Event and group data is kept to provide
              historical context and improve recommendations. You can request deletion of your account and associated
              data by contacting us.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">6. Data Security</h2>
            <p className="text-muted-foreground">
              We implement reasonable security measures including:
            </p>
            <ul className="list-disc pl-6 text-muted-foreground space-y-1 mt-2">
              <li>HTTPS encryption for all data in transit</li>
              <li>Secure authentication via Replit OAuth</li>
              <li>Database encryption at rest</li>
              <li>Rate limiting to prevent abuse</li>
              <li>Access controls and authorization checks</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">7. Your Rights</h2>
            <p className="text-muted-foreground">You have the right to:</p>
            <ul className="list-disc pl-6 text-muted-foreground space-y-1 mt-2">
              <li>Access the personal data we hold about you</li>
              <li>Request correction of inaccurate data</li>
              <li>Request deletion of your data</li>
              <li>Opt out of email notifications</li>
              <li>Export your data</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">8. Cookies</h2>
            <p className="text-muted-foreground">
              We use essential cookies for authentication and session management. We do not use tracking or
              advertising cookies.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">9. Children's Privacy</h2>
            <p className="text-muted-foreground">
              Kinmo is not intended for users under 13 years of age. We do not knowingly collect personal
              information from children under 13.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">10. Changes to This Policy</h2>
            <p className="text-muted-foreground">
              We may update this Privacy Policy from time to time. We will notify you of significant changes
              by posting a notice on our website or sending you an email.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">11. Contact Us</h2>
            <p className="text-muted-foreground">
              If you have questions about this Privacy Policy or want to exercise your rights, please contact us at:
            </p>
            <p className="text-muted-foreground mt-2">
              <strong>Email:</strong> support@kinmo.ai
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
