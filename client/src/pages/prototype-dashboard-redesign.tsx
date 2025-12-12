/**
 * Dashboard Redesign Mockup
 *
 * DESIGN DIRECTION: "Warm Editorial"
 * - Magazine-style layouts with intentional asymmetry
 * - Soft, warm color palette (amber, terracotta, sage)
 * - Elegant typography with Playfair Display headers
 * - Generous whitespace and breathing room
 * - Subtle micro-interactions and hover states
 *
 * KEY IMPROVEMENTS:
 * 1. Hero Event Card - Make the next event unmissable
 * 2. Timeline View - Events shown as a visual timeline, not just a list
 * 3. Quick Actions - Floating action buttons for common tasks
 * 4. Group Activity Pulse - Show which groups are most active
 * 5. Smart Suggestions - AI-driven "You might enjoy" section
 */

import { useState } from "react";
import {
  Calendar, MapPin, Users, Clock, ChevronRight,
  Sparkles, Plus, Heart, MessageCircle, Star,
  ArrowRight, Bell, Settings
} from "lucide-react";

export default function PrototypeDashboardRedesign() {
  const [activeView, setActiveView] = useState<'main' | 'group'>('main');

  return (
    <div className="min-h-screen bg-[#FAF8F5]">
      {/* Custom font injection */}
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;500;600;700&family=DM+Sans:wght@400;500;600&display=swap');

        .font-editorial { font-family: 'Playfair Display', Georgia, serif; }
        .font-body { font-family: 'DM Sans', system-ui, sans-serif; }

        /* Warm gradient backgrounds */
        .gradient-warm {
          background: linear-gradient(135deg, #FEF3E2 0%, #FAE8D4 50%, #F5DCC8 100%);
        }
        .gradient-sage {
          background: linear-gradient(135deg, #E8F0E8 0%, #D4E6D4 100%);
        }
        .gradient-terracotta {
          background: linear-gradient(135deg, #F5E6E0 0%, #EBDAD4 100%);
        }

        /* Soft shadows */
        .shadow-warm {
          box-shadow: 0 4px 20px rgba(139, 90, 43, 0.08),
                      0 1px 3px rgba(139, 90, 43, 0.04);
        }
        .shadow-warm-lg {
          box-shadow: 0 8px 40px rgba(139, 90, 43, 0.12),
                      0 2px 8px rgba(139, 90, 43, 0.06);
        }

        /* Elegant hover transitions */
        .hover-lift {
          transition: transform 0.3s cubic-bezier(0.34, 1.56, 0.64, 1),
                      box-shadow 0.3s ease;
        }
        .hover-lift:hover {
          transform: translateY(-4px);
          box-shadow: 0 12px 48px rgba(139, 90, 43, 0.16);
        }

        /* Stagger animation for lists */
        @keyframes fadeSlideUp {
          from {
            opacity: 0;
            transform: translateY(20px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        .animate-stagger > * {
          animation: fadeSlideUp 0.5s ease forwards;
          opacity: 0;
        }
        .animate-stagger > *:nth-child(1) { animation-delay: 0ms; }
        .animate-stagger > *:nth-child(2) { animation-delay: 80ms; }
        .animate-stagger > *:nth-child(3) { animation-delay: 160ms; }
        .animate-stagger > *:nth-child(4) { animation-delay: 240ms; }
        .animate-stagger > *:nth-child(5) { animation-delay: 320ms; }

        /* Timeline connector */
        .timeline-dot {
          position: relative;
        }
        .timeline-dot::before {
          content: '';
          position: absolute;
          left: 50%;
          top: 100%;
          width: 2px;
          height: 40px;
          background: linear-gradient(to bottom, #D4A574 0%, transparent 100%);
          transform: translateX(-50%);
        }
        .timeline-dot:last-child::before {
          display: none;
        }
      `}</style>

      {/* View Toggle */}
      <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50">
        <div className="flex gap-1 p-1 bg-white/90 backdrop-blur-md rounded-full shadow-warm border border-amber-100">
          <button
            onClick={() => setActiveView('main')}
            className={`px-4 py-2 rounded-full text-sm font-medium transition-all ${
              activeView === 'main'
                ? 'bg-amber-600 text-white'
                : 'text-amber-800 hover:bg-amber-50'
            }`}
          >
            Main Dashboard
          </button>
          <button
            onClick={() => setActiveView('group')}
            className={`px-4 py-2 rounded-full text-sm font-medium transition-all ${
              activeView === 'group'
                ? 'bg-amber-600 text-white'
                : 'text-amber-800 hover:bg-amber-50'
            }`}
          >
            Group Detail
          </button>
        </div>
      </div>

      {activeView === 'main' ? <MainDashboard /> : <GroupDashboard />}
    </div>
  );
}

function MainDashboard() {
  return (
    <div className="font-body">
      {/* Header - Simplified, elegant */}
      <header className="gradient-warm border-b border-amber-200/50">
        <div className="max-w-6xl mx-auto px-6 py-8">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-amber-600 text-sm font-medium tracking-wide uppercase">
                Thursday, December 12
              </p>
              <h1 className="font-editorial text-4xl text-amber-950 mt-1">
                Good evening, Rachel
              </h1>
            </div>
            <div className="flex items-center gap-3">
              <button className="p-3 rounded-full bg-white/60 hover:bg-white transition-colors shadow-warm">
                <Bell className="w-5 h-5 text-amber-700" />
              </button>
              <button className="p-3 rounded-full bg-white/60 hover:bg-white transition-colors shadow-warm">
                <Settings className="w-5 h-5 text-amber-700" />
              </button>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-8">
        {/* IMPROVEMENT #1: Hero Event Card */}
        {/* Make the next upcoming event impossible to miss */}
        <section className="mb-12">
          <HeroEventCard />
        </section>

        {/* IMPROVEMENT #2: Timeline View */}
        {/* Events shown as a visual timeline, not just a list */}
        <section className="mb-12">
          <div className="flex items-center justify-between mb-6">
            <h2 className="font-editorial text-2xl text-amber-950">Coming Up</h2>
            <button className="text-amber-600 text-sm font-medium flex items-center gap-1 hover:gap-2 transition-all">
              View all <ChevronRight className="w-4 h-4" />
            </button>
          </div>
          <EventTimeline />
        </section>

        {/* Two Column Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left Column - Groups */}
          <div className="lg:col-span-2">
            {/* IMPROVEMENT #3: Group Cards with Activity Pulse */}
            <section>
              <div className="flex items-center justify-between mb-6">
                <h2 className="font-editorial text-2xl text-amber-950">Your Groups</h2>
                <button className="flex items-center gap-2 px-4 py-2 bg-amber-600 text-white rounded-full text-sm font-medium hover:bg-amber-700 transition-colors shadow-warm">
                  <Plus className="w-4 h-4" />
                  New Group
                </button>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 animate-stagger">
                <GroupCardRedesigned
                  emoji="👖"
                  name="Sweatpants"
                  memberCount={4}
                  nextEvent="Holiday PopUp · Tomorrow"
                  activityLevel="high"
                  accentColor="#8B7355"
                />
                <GroupCardRedesigned
                  emoji="🩳"
                  name="Sweatshorts"
                  memberCount={5}
                  nextEvent="Brunch · Saturday"
                  activityLevel="medium"
                  accentColor="#6B8E6B"
                />
                <GroupCardRedesigned
                  emoji="🎿"
                  name="Ski Trip 2025"
                  memberCount={8}
                  nextEvent="Planning in progress"
                  activityLevel="low"
                  accentColor="#7B8BA4"
                />
              </div>
            </section>
          </div>

          {/* Right Column - Smart Suggestions */}
          <div>
            {/* IMPROVEMENT #4: Smart Suggestions */}
            <section>
              <h2 className="font-editorial text-2xl text-amber-950 mb-6">For You</h2>
              <div className="space-y-4">
                <SmartSuggestionCard
                  type="venue"
                  title="New spot in Oakland"
                  subtitle="Based on Sweatpants preferences"
                  image="https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=400"
                />
                <SmartSuggestionCard
                  type="time"
                  title="Friday evenings work best"
                  subtitle="4 of 4 members available"
                  icon={<Clock className="w-5 h-5" />}
                />
                <SmartSuggestionCard
                  type="feedback"
                  title="How was The Double Standard?"
                  subtitle="Your feedback helps us improve"
                  icon={<MessageCircle className="w-5 h-5" />}
                />
              </div>
            </section>
          </div>
        </div>
      </main>

      {/* IMPROVEMENT #5: Floating Quick Actions */}
      <QuickActionsFAB />
    </div>
  );
}

function GroupDashboard() {
  return (
    <div className="font-body">
      {/* Group Header - Immersive */}
      <header className="relative gradient-terracotta border-b border-rose-200/50 overflow-hidden">
        {/* Decorative background pattern */}
        <div className="absolute inset-0 opacity-5">
          <div className="absolute inset-0" style={{
            backgroundImage: `radial-gradient(circle at 2px 2px, #8B5A2B 1px, transparent 0)`,
            backgroundSize: '24px 24px'
          }} />
        </div>

        <div className="relative max-w-6xl mx-auto px-6 py-8">
          {/* Breadcrumb */}
          <div className="flex items-center gap-2 text-amber-600 text-sm mb-4">
            <button className="hover:text-amber-800 transition-colors">Dashboard</button>
            <ChevronRight className="w-4 h-4" />
            <span className="text-amber-900">Sweatpants</span>
          </div>

          <div className="flex items-start justify-between">
            <div className="flex items-center gap-5">
              {/* Large emoji with glow effect */}
              <div className="w-20 h-20 rounded-2xl bg-white/80 backdrop-blur flex items-center justify-center text-4xl shadow-warm-lg">
                👖
              </div>
              <div>
                <h1 className="font-editorial text-3xl text-amber-950">Sweatpants</h1>
                <div className="flex items-center gap-4 mt-2 text-amber-700">
                  <span className="flex items-center gap-1.5">
                    <Users className="w-4 h-4" />
                    4 members
                  </span>
                  <span className="flex items-center gap-1.5">
                    <MapPin className="w-4 h-4" />
                    San Francisco Bay Area
                  </span>
                  <span className="flex items-center gap-1.5">
                    <Clock className="w-4 h-4" />
                    Monthly
                  </span>
                </div>
              </div>
            </div>

            {/* Member Avatars */}
            <div className="flex items-center -space-x-3">
              {['Rachel', 'Katie', 'Addison', 'Aidan'].map((name, i) => (
                <div
                  key={name}
                  className="w-10 h-10 rounded-full bg-white border-2 border-rose-100 flex items-center justify-center text-sm font-medium text-amber-800 shadow-warm"
                  style={{ zIndex: 4 - i }}
                >
                  {name[0]}
                </div>
              ))}
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-8">
        {/* IMPROVEMENT: Featured Event Section */}
        <section className="mb-10">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-1.5 h-6 bg-amber-500 rounded-full" />
            <h2 className="font-editorial text-2xl text-amber-950">Next Event</h2>
          </div>

          <div className="bg-white rounded-3xl shadow-warm-lg overflow-hidden hover-lift">
            <div className="grid grid-cols-1 md:grid-cols-2">
              {/* Event Image */}
              <div className="aspect-[4/3] md:aspect-auto relative">
                <img
                  src="https://images.unsplash.com/photo-1572116469696-31de0f17cc34?w=800"
                  alt="The Double Standard"
                  className="w-full h-full object-cover"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent" />
                <div className="absolute bottom-4 left-4 right-4">
                  <span className="inline-block px-3 py-1 bg-amber-500 text-white text-xs font-medium rounded-full">
                    Tomorrow
                  </span>
                </div>
              </div>

              {/* Event Details */}
              <div className="p-6 md:p-8 flex flex-col">
                <h3 className="font-editorial text-2xl text-amber-950 mb-2">
                  Holiday PopUp
                </h3>
                <p className="text-amber-700 mb-1 flex items-center gap-2">
                  <MapPin className="w-4 h-4" />
                  The Double Standard · Oakland
                </p>
                <p className="text-amber-700 mb-6 flex items-center gap-2">
                  <Calendar className="w-4 h-4" />
                  Friday, Dec 13 · 6:00 PM
                </p>

                {/* RSVP Status Visual */}
                <div className="flex-1">
                  <p className="text-sm text-amber-600 mb-3">Who's coming?</p>
                  <div className="flex flex-wrap gap-2 mb-6">
                    {[
                      { name: 'Rachel', status: 'yes' },
                      { name: 'Katie', status: 'yes' },
                      { name: 'Addison', status: 'yes' },
                      { name: 'Aidan', status: 'pending' },
                    ].map((member) => (
                      <div
                        key={member.name}
                        className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-sm ${
                          member.status === 'yes'
                            ? 'bg-green-50 text-green-700 border border-green-200'
                            : 'bg-amber-50 text-amber-700 border border-amber-200'
                        }`}
                      >
                        <span className={`w-2 h-2 rounded-full ${
                          member.status === 'yes' ? 'bg-green-500' : 'bg-amber-400'
                        }`} />
                        {member.name}
                      </div>
                    ))}
                  </div>
                </div>

                {/* Action buttons */}
                <div className="flex gap-3">
                  <button className="flex-1 px-6 py-3 bg-amber-600 text-white rounded-xl font-medium hover:bg-amber-700 transition-colors shadow-warm">
                    View Details
                  </button>
                  <button className="px-6 py-3 border border-amber-200 text-amber-700 rounded-xl font-medium hover:bg-amber-50 transition-colors">
                    Share
                  </button>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* IMPROVEMENT: Event History as Cards, not Table */}
        <section className="mb-10">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <div className="w-1.5 h-6 bg-amber-300 rounded-full" />
              <h2 className="font-editorial text-2xl text-amber-950">Past Events</h2>
            </div>
            <button className="text-amber-600 text-sm font-medium">View all</button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <PastEventCard
              name="Taniku Izakaya"
              date="Nov 20"
              attendees={4}
              rating={5}
              image="https://images.unsplash.com/photo-1580822184713-fc5400e7fe10?w=400"
            />
            <PastEventCard
              name="Sweet Maple Brunch"
              date="Oct 15"
              attendees={3}
              rating={4}
              image="https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=400"
            />
            <PastEventCard
              name="Garden Creamery"
              date="Sep 22"
              attendees={4}
              rating={5}
              image="https://images.unsplash.com/photo-1497034825429-c343d7c6a68f?w=400"
            />
          </div>
        </section>

        {/* IMPROVEMENT: Quick Stats Row */}
        <section className="mb-10">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <StatCard label="Events This Year" value="12" trend="+3" />
            <StatCard label="Avg Attendance" value="3.5" trend="+0.5" />
            <StatCard label="Favorite Spot" value="Oakland" />
            <StatCard label="Best Time" value="Fri 6pm" />
          </div>
        </section>

        {/* IMPROVEMENT: Venue Discovery Section */}
        <section>
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <div className="w-1.5 h-6 bg-sage-400 rounded-full" style={{ backgroundColor: '#8BA888' }} />
              <h2 className="font-editorial text-2xl text-amber-950">Discover Venues</h2>
            </div>
            <button className="flex items-center gap-2 text-amber-600 text-sm font-medium">
              <Sparkles className="w-4 h-4" />
              Get AI suggestions
            </button>
          </div>

          <div className="gradient-sage rounded-3xl p-6 border border-green-200/50">
            <p className="text-green-800 mb-4">
              Based on your group's preferences, we think you'd love these spots:
            </p>
            <div className="flex gap-3 overflow-x-auto pb-2 -mx-2 px-2">
              {['Hopscotch', 'Chez Panisse', 'Burma Superstar', 'Flour + Water'].map((venue) => (
                <div
                  key={venue}
                  className="flex-shrink-0 bg-white rounded-xl p-4 shadow-warm hover-lift cursor-pointer"
                  style={{ minWidth: '180px' }}
                >
                  <div className="w-full aspect-[4/3] rounded-lg bg-green-100 mb-3" />
                  <p className="font-medium text-amber-900">{venue}</p>
                  <p className="text-sm text-amber-600">Oakland</p>
                </div>
              ))}
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}

// Component: Hero Event Card
function HeroEventCard() {
  return (
    <div className="relative bg-white rounded-3xl shadow-warm-lg overflow-hidden hover-lift group">
      {/* Background gradient accent */}
      <div className="absolute top-0 right-0 w-1/2 h-full gradient-warm opacity-50" />

      <div className="relative grid grid-cols-1 md:grid-cols-2 gap-0">
        {/* Content Side */}
        <div className="p-8 md:p-10 flex flex-col justify-center">
          <div className="flex items-center gap-2 mb-4">
            <span className="text-3xl">👖</span>
            <span className="text-amber-600 font-medium">Sweatpants</span>
          </div>

          <h2 className="font-editorial text-3xl md:text-4xl text-amber-950 mb-3">
            Holiday PopUp
          </h2>

          <div className="space-y-2 text-amber-700 mb-6">
            <p className="flex items-center gap-2">
              <Calendar className="w-5 h-5 text-amber-500" />
              Tomorrow · Friday, Dec 13
            </p>
            <p className="flex items-center gap-2">
              <Clock className="w-5 h-5 text-amber-500" />
              6:00 PM
            </p>
            <p className="flex items-center gap-2">
              <MapPin className="w-5 h-5 text-amber-500" />
              The Double Standard, Oakland
            </p>
          </div>

          {/* Attendance Pills */}
          <div className="flex items-center gap-2 mb-8">
            <div className="flex -space-x-2">
              {['R', 'K', 'Ad'].map((initial, i) => (
                <div
                  key={i}
                  className="w-8 h-8 rounded-full bg-green-100 border-2 border-white flex items-center justify-center text-xs font-medium text-green-700"
                >
                  {initial}
                </div>
              ))}
            </div>
            <span className="text-sm text-amber-600 ml-2">3 going · 1 pending</span>
          </div>

          <button className="inline-flex items-center gap-2 px-6 py-3 bg-amber-600 text-white rounded-xl font-medium hover:bg-amber-700 transition-colors shadow-warm w-fit group-hover:gap-3">
            View Event <ArrowRight className="w-5 h-5" />
          </button>
        </div>

        {/* Image Side */}
        <div className="relative aspect-[4/3] md:aspect-auto">
          <img
            src="https://images.unsplash.com/photo-1572116469696-31de0f17cc34?w=800"
            alt="The Double Standard"
            className="w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-r from-white via-transparent to-transparent md:hidden" />
        </div>
      </div>
    </div>
  );
}

// Component: Event Timeline
function EventTimeline() {
  const events = [
    { date: 'Dec 13', day: 'Fri', title: 'Holiday PopUp', venue: 'The Double Standard', group: '👖', status: 'confirmed' },
    { date: 'Dec 19', day: 'Thu', title: 'Sweet Maple', venue: 'Sweet Maple', group: '👖', status: 'rsvp-needed' },
    { date: 'Dec 21', day: 'Sat', title: 'Winter Brunch', venue: 'TBD', group: '🩳', status: 'planning' },
  ];

  return (
    <div className="flex gap-6 overflow-x-auto pb-4 -mx-2 px-2">
      {events.map((event, i) => (
        <div
          key={i}
          className="flex-shrink-0 w-72 bg-white rounded-2xl shadow-warm p-5 hover-lift cursor-pointer"
        >
          {/* Date badge */}
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="text-center">
                <p className="text-xs text-amber-500 font-medium uppercase">{event.day}</p>
                <p className="text-xl font-bold text-amber-900">{event.date.split(' ')[1]}</p>
              </div>
              <div className="w-px h-10 bg-amber-200" />
              <span className="text-2xl">{event.group}</span>
            </div>

            {/* Status indicator */}
            <div className={`w-3 h-3 rounded-full ${
              event.status === 'confirmed' ? 'bg-green-400' :
              event.status === 'rsvp-needed' ? 'bg-amber-400 animate-pulse' :
              'bg-gray-300'
            }`} />
          </div>

          <h3 className="font-semibold text-amber-950 mb-1">{event.title}</h3>
          <p className="text-sm text-amber-600 flex items-center gap-1.5">
            <MapPin className="w-3.5 h-3.5" />
            {event.venue}
          </p>

          {event.status === 'rsvp-needed' && (
            <button className="mt-4 w-full py-2 bg-amber-100 text-amber-700 rounded-lg text-sm font-medium hover:bg-amber-200 transition-colors">
              RSVP Now
            </button>
          )}
        </div>
      ))}

      {/* Add event card */}
      <div className="flex-shrink-0 w-72 border-2 border-dashed border-amber-200 rounded-2xl p-5 flex flex-col items-center justify-center text-amber-400 hover:border-amber-400 hover:text-amber-500 transition-colors cursor-pointer">
        <Plus className="w-8 h-8 mb-2" />
        <span className="font-medium">Plan an Event</span>
      </div>
    </div>
  );
}

// Component: Group Card Redesigned
function GroupCardRedesigned({
  emoji, name, memberCount, nextEvent, activityLevel, accentColor
}: {
  emoji: string;
  name: string;
  memberCount: number;
  nextEvent: string;
  activityLevel: 'high' | 'medium' | 'low';
  accentColor: string;
}) {
  return (
    <div
      className="bg-white rounded-2xl shadow-warm overflow-hidden hover-lift cursor-pointer"
    >
      {/* Activity indicator bar */}
      <div
        className="h-1"
        style={{
          background: activityLevel === 'high'
            ? `linear-gradient(90deg, ${accentColor} 0%, ${accentColor}88 100%)`
            : activityLevel === 'medium'
            ? `linear-gradient(90deg, ${accentColor}88 0%, ${accentColor}44 100%)`
            : `linear-gradient(90deg, ${accentColor}44 0%, ${accentColor}22 100%)`
        }}
      />

      <div className="p-5">
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-3">
            <div
              className="w-12 h-12 rounded-xl flex items-center justify-center text-2xl"
              style={{ backgroundColor: `${accentColor}15` }}
            >
              {emoji}
            </div>
            <div>
              <h3 className="font-semibold text-amber-950">{name}</h3>
              <p className="text-sm text-amber-600">{memberCount} members</p>
            </div>
          </div>

          {/* Activity pulse */}
          {activityLevel === 'high' && (
            <div className="flex items-center gap-1.5 px-2.5 py-1 bg-green-50 rounded-full">
              <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
              <span className="text-xs text-green-700 font-medium">Active</span>
            </div>
          )}
        </div>

        <div className="flex items-center gap-2 text-sm text-amber-700">
          <Sparkles className="w-4 h-4 text-amber-400" />
          {nextEvent}
        </div>
      </div>
    </div>
  );
}

// Component: Smart Suggestion Card
function SmartSuggestionCard({
  type, title, subtitle, image, icon
}: {
  type: 'venue' | 'time' | 'feedback';
  title: string;
  subtitle: string;
  image?: string;
  icon?: React.ReactNode;
}) {
  return (
    <div className="bg-white rounded-2xl shadow-warm p-4 hover-lift cursor-pointer">
      <div className="flex items-start gap-4">
        {image ? (
          <div className="w-16 h-16 rounded-xl overflow-hidden flex-shrink-0">
            <img src={image} alt="" className="w-full h-full object-cover" />
          </div>
        ) : icon ? (
          <div className="w-12 h-12 rounded-xl bg-amber-100 flex items-center justify-center text-amber-600 flex-shrink-0">
            {icon}
          </div>
        ) : null}

        <div className="flex-1 min-w-0">
          <h4 className="font-medium text-amber-950 mb-0.5">{title}</h4>
          <p className="text-sm text-amber-600">{subtitle}</p>
        </div>

        <ChevronRight className="w-5 h-5 text-amber-400 flex-shrink-0" />
      </div>
    </div>
  );
}

// Component: Past Event Card
function PastEventCard({
  name, date, attendees, rating, image
}: {
  name: string;
  date: string;
  attendees: number;
  rating: number;
  image: string;
}) {
  return (
    <div className="bg-white rounded-2xl shadow-warm overflow-hidden hover-lift cursor-pointer">
      <div className="aspect-[4/3] relative">
        <img src={image} alt={name} className="w-full h-full object-cover" />
        <div className="absolute top-3 right-3 px-2.5 py-1 bg-white/90 backdrop-blur rounded-full text-xs font-medium text-amber-800">
          {date}
        </div>
      </div>
      <div className="p-4">
        <h4 className="font-medium text-amber-950 mb-1">{name}</h4>
        <div className="flex items-center justify-between text-sm text-amber-600">
          <span>{attendees} attended</span>
          <div className="flex items-center gap-1">
            {[...Array(rating)].map((_, i) => (
              <Star key={i} className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// Component: Stat Card
function StatCard({
  label, value, trend
}: {
  label: string;
  value: string;
  trend?: string;
}) {
  return (
    <div className="bg-white rounded-2xl shadow-warm p-5 text-center">
      <p className="text-2xl font-bold text-amber-950 mb-1">{value}</p>
      <p className="text-sm text-amber-600">{label}</p>
      {trend && (
        <p className="text-xs text-green-600 mt-1">↑ {trend}</p>
      )}
    </div>
  );
}

// Component: Quick Actions FAB
function QuickActionsFAB() {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="fixed bottom-6 right-6 z-50">
      {/* Action menu */}
      {isOpen && (
        <div className="absolute bottom-16 right-0 space-y-3 animate-stagger">
          <button className="flex items-center gap-3 px-4 py-3 bg-white rounded-xl shadow-warm-lg hover:shadow-lg transition-shadow whitespace-nowrap">
            <Calendar className="w-5 h-5 text-amber-600" />
            <span className="font-medium text-amber-900">Plan Event</span>
          </button>
          <button className="flex items-center gap-3 px-4 py-3 bg-white rounded-xl shadow-warm-lg hover:shadow-lg transition-shadow whitespace-nowrap">
            <Users className="w-5 h-5 text-amber-600" />
            <span className="font-medium text-amber-900">New Group</span>
          </button>
          <button className="flex items-center gap-3 px-4 py-3 bg-white rounded-xl shadow-warm-lg hover:shadow-lg transition-shadow whitespace-nowrap">
            <Sparkles className="w-5 h-5 text-amber-600" />
            <span className="font-medium text-amber-900">AI Suggestions</span>
          </button>
        </div>
      )}

      {/* Main FAB */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`w-14 h-14 rounded-full shadow-warm-lg flex items-center justify-center transition-all ${
          isOpen
            ? 'bg-amber-100 text-amber-700 rotate-45'
            : 'bg-amber-600 text-white hover:bg-amber-700'
        }`}
      >
        <Plus className="w-6 h-6" />
      </button>
    </div>
  );
}
