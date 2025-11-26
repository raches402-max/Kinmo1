import { Link } from "wouter";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function Terms() {
  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-3xl mx-auto px-4 py-8">
        <Link href="/">
          <Button variant="ghost" size="sm" className="mb-6">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Button>
        </Link>

        <h1 className="text-3xl font-bold mb-2">Terms of Service</h1>
        <p className="text-muted-foreground mb-8">Last updated: November 25, 2024</p>

        <div className="prose prose-neutral dark:prose-invert max-w-none space-y-6">
          <section>
            <h2 className="text-xl font-semibold mb-3">1. Acceptance of Terms</h2>
            <p className="text-muted-foreground">
              By accessing or using Kinmo ("the Service") at kinmo.ai, you agree to be bound by these Terms of Service.
              If you do not agree to these terms, please do not use the Service.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">2. Description of Service</h2>
            <p className="text-muted-foreground">
              Kinmo is a group event planning platform that helps friends coordinate outings by suggesting venues,
              managing RSVPs, and scheduling events. The Service uses AI to provide personalized recommendations
              and automate event planning tasks.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">3. User Accounts</h2>
            <ul className="list-disc pl-6 text-muted-foreground space-y-2">
              <li>You must authenticate through Replit to use the Service</li>
              <li>You are responsible for maintaining the security of your account</li>
              <li>You must provide accurate information when creating groups and events</li>
              <li>You may not use the Service for any illegal or unauthorized purpose</li>
              <li>You must be at least 13 years old to use the Service</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">4. User Content</h2>
            <p className="text-muted-foreground mb-3">
              You retain ownership of content you create (group names, event details, feedback, etc.).
              By using the Service, you grant us a license to use, store, and process this content to provide
              and improve the Service.
            </p>
            <p className="text-muted-foreground">You agree not to post content that:</p>
            <ul className="list-disc pl-6 text-muted-foreground space-y-1 mt-2">
              <li>Is unlawful, harmful, threatening, or harassing</li>
              <li>Infringes on intellectual property rights</li>
              <li>Contains malware or harmful code</li>
              <li>Impersonates others or misrepresents your identity</li>
              <li>Violates the privacy of others</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">5. AI-Generated Content</h2>
            <p className="text-muted-foreground">
              The Service uses artificial intelligence (OpenAI) to generate venue recommendations, event suggestions,
              and other content. While we strive for accuracy, AI-generated content may contain errors or inaccuracies.
              You should verify important details (venue hours, prices, availability) before making plans.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">6. Third-Party Services</h2>
            <p className="text-muted-foreground">
              The Service integrates with third-party services including Google Places for venue information.
              Venue details, ratings, and availability are provided by these services and may change without notice.
              We are not responsible for the accuracy of third-party data.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">7. Acceptable Use</h2>
            <p className="text-muted-foreground">You agree not to:</p>
            <ul className="list-disc pl-6 text-muted-foreground space-y-1 mt-2">
              <li>Use the Service to spam or harass others</li>
              <li>Attempt to gain unauthorized access to other accounts or systems</li>
              <li>Interfere with or disrupt the Service</li>
              <li>Use automated scripts or bots without permission</li>
              <li>Scrape or collect data from the Service without authorization</li>
              <li>Use the Service for commercial purposes without our consent</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">8. Intellectual Property</h2>
            <p className="text-muted-foreground">
              The Service, including its design, features, and code, is owned by Kinmo and protected by
              intellectual property laws. You may not copy, modify, or distribute any part of the Service
              without our written permission.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">9. Disclaimer of Warranties</h2>
            <p className="text-muted-foreground">
              THE SERVICE IS PROVIDED "AS IS" WITHOUT WARRANTIES OF ANY KIND, EXPRESS OR IMPLIED.
              WE DO NOT GUARANTEE THAT THE SERVICE WILL BE UNINTERRUPTED, ERROR-FREE, OR SECURE.
              WE ARE NOT RESPONSIBLE FOR VENUE AVAILABILITY, QUALITY, OR ANY ISSUES THAT ARISE
              FROM EVENTS PLANNED USING THE SERVICE.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">10. Limitation of Liability</h2>
            <p className="text-muted-foreground">
              TO THE MAXIMUM EXTENT PERMITTED BY LAW, KINMO SHALL NOT BE LIABLE FOR ANY INDIRECT,
              INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES ARISING FROM YOUR USE OF THE SERVICE.
              OUR TOTAL LIABILITY SHALL NOT EXCEED THE AMOUNT YOU PAID US IN THE PAST 12 MONTHS (IF ANY).
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">11. Indemnification</h2>
            <p className="text-muted-foreground">
              You agree to indemnify and hold harmless Kinmo and its operators from any claims, damages,
              or expenses arising from your use of the Service or violation of these Terms.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">12. Termination</h2>
            <p className="text-muted-foreground">
              We may suspend or terminate your access to the Service at any time for violation of these Terms
              or for any other reason. You may stop using the Service at any time. Upon termination,
              your right to use the Service ceases immediately.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">13. Changes to Terms</h2>
            <p className="text-muted-foreground">
              We may modify these Terms at any time. We will notify you of significant changes by posting
              a notice on the Service. Continued use of the Service after changes constitutes acceptance
              of the new Terms.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">14. Governing Law</h2>
            <p className="text-muted-foreground">
              These Terms are governed by the laws of the State of California, United States, without regard
              to conflict of law principles.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">15. Contact</h2>
            <p className="text-muted-foreground">
              For questions about these Terms, please contact us at:
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
