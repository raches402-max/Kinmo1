/**
 * Dashboard Redesign V2 - Three Alternative Approaches
 *
 * CONSTRAINT: Google Places photos are often low quality, so designs
 * should NOT rely on large photo areas. Instead, use:
 * - Typography and color
 * - Icons and emojis
 * - Geometric patterns
 * - Data visualization
 *
 * THREE DESIGN DIRECTIONS:
 * 1. "Geometric Minimalist" - Clean lines, bold shapes, no photos
 * 2. "Playful Cards" - Colorful, emoji-forward, personality-driven
 * 3. "Data Dashboard" - Analytics-inspired, information-dense
 */

import { useState } from "react";
import {
  Calendar, MapPin, Users, Clock, ChevronRight, ChevronDown,
  Sparkles, Plus, MessageCircle, Star, Check, Circle,
  ArrowRight, Bell, Settings, Zap, TrendingUp, Heart
} from "lucide-react";

type DesignVariant = 'geometric' | 'playful' | 'data';

export default function PrototypeDashboardV2() {
  const [activeVariant, setActiveVariant] = useState<DesignVariant>('geometric');

  return (
    <div className="min-h-screen">
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700&family=Fraunces:opsz,wght@9..144,400;9..144,500;9..144,600;9..144,700&family=Sora:wght@300;400;500;600;700&display=swap');

        .font-outfit { font-family: 'Outfit', system-ui, sans-serif; }
        .font-fraunces { font-family: 'Fraunces', Georgia, serif; }
        .font-sora { font-family: 'Sora', system-ui, sans-serif; }

        /* Smooth animations */
        @keyframes slideUp {
          from { opacity: 0; transform: translateY(16px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .animate-slide-up {
          animation: slideUp 0.4s ease-out forwards;
        }
        .delay-1 { animation-delay: 50ms; }
        .delay-2 { animation-delay: 100ms; }
        .delay-3 { animation-delay: 150ms; }
        .delay-4 { animation-delay: 200ms; }

        /* Noise texture overlay */
        .noise-overlay::before {
          content: '';
          position: absolute;
          inset: 0;
          opacity: 0.03;
          background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E");
          pointer-events: none;
        }
      `}</style>

      {/* Variant Selector */}
      <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50">
        <div className="flex gap-1 p-1.5 bg-white/95 backdrop-blur-md rounded-2xl shadow-lg border border-gray-200">
          {[
            { id: 'geometric', label: 'Geometric', color: 'bg-slate-900' },
            { id: 'playful', label: 'Playful', color: 'bg-orange-500' },
            { id: 'data', label: 'Data View', color: 'bg-indigo-600' },
          ].map((v) => (
            <button
              key={v.id}
              onClick={() => setActiveVariant(v.id as DesignVariant)}
              className={`px-4 py-2 rounded-xl text-sm font-medium transition-all ${
                activeVariant === v.id
                  ? `${v.color} text-white`
                  : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              {v.label}
            </button>
          ))}
        </div>
      </div>

      {activeVariant === 'geometric' && <GeometricDashboard />}
      {activeVariant === 'playful' && <PlayfulDashboard />}
      {activeVariant === 'data' && <DataDashboard />}
    </div>
  );
}

// ============================================
// VARIANT 1: GEOMETRIC MINIMALIST
// Clean lines, bold typography, no photos
// ============================================
function GeometricDashboard() {
  return (
    <div className="min-h-screen bg-[#FAFAFA] font-outfit pt-16">
      {/* Header with geometric accent */}
      <header className="relative overflow-hidden border-b border-gray-200">
        {/* Geometric background shapes */}
        <div className="absolute -right-20 -top-20 w-64 h-64 bg-slate-900 rounded-full opacity-[0.03]" />
        <div className="absolute right-40 top-10 w-32 h-32 bg-amber-500 rounded-full opacity-[0.08]" />

        <div className="max-w-5xl mx-auto px-6 py-8">
          <p className="text-sm font-medium text-gray-400 tracking-widest uppercase mb-1">
            Thursday, December 12
          </p>
          <h1 className="text-4xl font-semibold text-slate-900 tracking-tight">
            Hey, Rachel
          </h1>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-8">
        {/* Next Event - Bold typography, no photo */}
        <section className="mb-12 animate-slide-up">
          <div className="bg-slate-900 rounded-3xl p-8 text-white relative overflow-hidden">
            {/* Decorative corner accent */}
            <div className="absolute top-0 right-0 w-40 h-40">
              <div className="absolute top-6 right-6 w-24 h-24 border-2 border-amber-400/30 rounded-full" />
              <div className="absolute top-10 right-10 w-16 h-16 bg-amber-400 rounded-full opacity-20" />
            </div>

            <div className="relative">
              <div className="flex items-center gap-2 mb-4">
                <span className="text-3xl">👖</span>
                <span className="text-amber-400 font-medium text-sm tracking-wide uppercase">
                  Sweatpants · Tomorrow
                </span>
              </div>

              <h2 className="text-4xl font-semibold tracking-tight mb-6">
                Holiday PopUp
              </h2>

              <div className="grid grid-cols-3 gap-6 mb-8">
                <div>
                  <p className="text-gray-400 text-xs uppercase tracking-wider mb-1">When</p>
                  <p className="text-lg font-medium">Fri, Dec 13</p>
                  <p className="text-gray-400">6:00 PM</p>
                </div>
                <div>
                  <p className="text-gray-400 text-xs uppercase tracking-wider mb-1">Where</p>
                  <p className="text-lg font-medium">The Double Standard</p>
                  <p className="text-gray-400">Oakland</p>
                </div>
                <div>
                  <p className="text-gray-400 text-xs uppercase tracking-wider mb-1">Attending</p>
                  <div className="flex items-center gap-2 mt-1">
                    <div className="flex -space-x-2">
                      {['R', 'K', 'A'].map((initial, i) => (
                        <div key={i} className="w-8 h-8 rounded-full bg-amber-400 flex items-center justify-center text-xs font-semibold text-slate-900 border-2 border-slate-900">
                          {initial}
                        </div>
                      ))}
                    </div>
                    <span className="text-gray-400 text-sm">+1 pending</span>
                  </div>
                </div>
              </div>

              <button className="inline-flex items-center gap-2 px-6 py-3 bg-white text-slate-900 rounded-xl font-semibold hover:bg-gray-100 transition-colors">
                View Event <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </section>

        {/* Upcoming Events - Compact list */}
        <section className="mb-12 animate-slide-up delay-1">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-semibold text-slate-900">Coming Up</h2>
            <button className="text-sm text-gray-500 hover:text-slate-900 transition-colors">
              View all →
            </button>
          </div>

          <div className="space-y-3">
            {[
              { date: '19', month: 'Dec', day: 'Thu', title: 'Sweet Maple', group: '👖', status: 'rsvp' },
              { date: '21', month: 'Dec', day: 'Sat', title: 'Winter Brunch', group: '🩳', status: 'planning' },
              { date: '28', month: 'Dec', day: 'Sat', title: 'NYE Pre-Party', group: '👖', status: 'confirmed' },
            ].map((event, i) => (
              <div
                key={i}
                className="flex items-center gap-4 p-4 bg-white rounded-2xl border border-gray-100 hover:border-gray-200 hover:shadow-sm transition-all cursor-pointer group"
              >
                {/* Date block */}
                <div className="w-14 h-14 rounded-xl bg-gray-50 flex flex-col items-center justify-center flex-shrink-0">
                  <span className="text-xs text-gray-400 uppercase">{event.day}</span>
                  <span className="text-xl font-semibold text-slate-900">{event.date}</span>
                </div>

                {/* Event info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="text-lg">{event.group}</span>
                    <h3 className="font-medium text-slate-900 truncate">{event.title}</h3>
                  </div>
                  <p className="text-sm text-gray-500">{event.month} {event.date}</p>
                </div>

                {/* Status */}
                {event.status === 'rsvp' && (
                  <span className="px-3 py-1.5 bg-amber-50 text-amber-700 text-xs font-medium rounded-full">
                    RSVP needed
                  </span>
                )}
                {event.status === 'confirmed' && (
                  <span className="px-3 py-1.5 bg-green-50 text-green-700 text-xs font-medium rounded-full flex items-center gap-1">
                    <Check className="w-3 h-3" /> Going
                  </span>
                )}
                {event.status === 'planning' && (
                  <span className="px-3 py-1.5 bg-gray-100 text-gray-600 text-xs font-medium rounded-full">
                    Planning
                  </span>
                )}

                <ChevronRight className="w-5 h-5 text-gray-300 group-hover:text-gray-400 transition-colors" />
              </div>
            ))}
          </div>
        </section>

        {/* Groups Grid */}
        <section className="animate-slide-up delay-2">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-semibold text-slate-900">Your Groups</h2>
            <button className="flex items-center gap-2 px-4 py-2 bg-slate-900 text-white text-sm font-medium rounded-xl hover:bg-slate-800 transition-colors">
              <Plus className="w-4 h-4" /> New Group
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {[
              { emoji: '👖', name: 'Sweatpants', members: 4, color: '#8B7355', next: 'Tomorrow' },
              { emoji: '🩳', name: 'Sweatshorts', members: 5, color: '#6B8E6B', next: 'Sat, Dec 21' },
              { emoji: '🎿', name: 'Ski Trip 2025', members: 8, color: '#7B8BA4', next: 'Planning' },
            ].map((group, i) => (
              <div
                key={i}
                className="bg-white rounded-2xl border border-gray-100 p-5 hover:border-gray-200 hover:shadow-sm transition-all cursor-pointer group"
              >
                <div className="flex items-start justify-between mb-4">
                  <div className="w-12 h-12 rounded-xl flex items-center justify-center text-2xl" style={{ backgroundColor: `${group.color}15` }}>
                    {group.emoji}
                  </div>
                  <div className="w-2 h-2 rounded-full" style={{ backgroundColor: group.color }} />
                </div>

                <h3 className="font-semibold text-slate-900 mb-1">{group.name}</h3>
                <p className="text-sm text-gray-500 mb-3">{group.members} members</p>

                <div className="flex items-center gap-2 text-xs">
                  <Sparkles className="w-3.5 h-3.5" style={{ color: group.color }} />
                  <span className="text-gray-600">Next: {group.next}</span>
                </div>
              </div>
            ))}
          </div>
        </section>
      </main>
    </div>
  );
}

// ============================================
// VARIANT 2: PLAYFUL CARDS
// Colorful, emoji-forward, fun personality
// ============================================
function PlayfulDashboard() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-50 via-amber-50 to-yellow-50 font-sora pt-16 relative noise-overlay">
      <style>{`
        .card-playful {
          background: white;
          border-radius: 24px;
          box-shadow: 0 2px 8px rgba(0,0,0,0.04), 0 8px 24px rgba(0,0,0,0.06);
          transition: all 0.2s ease;
        }
        .card-playful:hover {
          transform: translateY(-2px);
          box-shadow: 0 4px 12px rgba(0,0,0,0.06), 0 12px 32px rgba(0,0,0,0.1);
        }
      `}</style>

      {/* Fun Header */}
      <header className="max-w-4xl mx-auto px-6 py-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-orange-500 text-sm font-semibold mb-1">👋 Hey Rachel!</p>
            <h1 className="text-2xl font-bold text-gray-900">What's happening</h1>
          </div>
          <div className="flex items-center gap-2">
            <button className="w-10 h-10 rounded-full bg-white shadow-sm flex items-center justify-center hover:shadow-md transition-shadow">
              <Bell className="w-5 h-5 text-gray-600" />
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-6 pb-24">
        {/* Hero Event - Colorful & Fun */}
        <section className="mb-8 animate-slide-up">
          <div className="card-playful p-6 relative overflow-hidden">
            {/* Fun background shapes */}
            <div className="absolute -right-8 -top-8 w-32 h-32 bg-orange-400 rounded-full opacity-10" />
            <div className="absolute right-16 top-8 w-16 h-16 bg-amber-400 rounded-full opacity-20" />

            <div className="relative">
              {/* Tomorrow pill */}
              <div className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-orange-100 text-orange-600 rounded-full text-sm font-semibold mb-4">
                <Zap className="w-4 h-4" />
                Tomorrow!
              </div>

              <div className="flex items-start gap-4">
                {/* Big emoji */}
                <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-amber-100 to-orange-100 flex items-center justify-center text-5xl flex-shrink-0">
                  👖
                </div>

                <div className="flex-1 min-w-0">
                  <h2 className="text-2xl font-bold text-gray-900 mb-1">Holiday PopUp</h2>
                  <p className="text-gray-600 mb-4">with Sweatpants</p>

                  <div className="flex flex-wrap gap-3 mb-4">
                    <div className="flex items-center gap-1.5 text-sm text-gray-600">
                      <Calendar className="w-4 h-4 text-orange-400" />
                      Fri, Dec 13 · 6pm
                    </div>
                    <div className="flex items-center gap-1.5 text-sm text-gray-600">
                      <MapPin className="w-4 h-4 text-orange-400" />
                      The Double Standard
                    </div>
                  </div>

                  {/* Who's coming - fun pill style */}
                  <div className="flex flex-wrap gap-2">
                    {[
                      { name: 'Rachel', status: 'yes' },
                      { name: 'Katie', status: 'yes' },
                      { name: 'Addison', status: 'yes' },
                      { name: 'Aidan', status: 'maybe' },
                    ].map((m) => (
                      <div
                        key={m.name}
                        className={`px-3 py-1.5 rounded-full text-sm font-medium flex items-center gap-1.5 ${
                          m.status === 'yes'
                            ? 'bg-green-100 text-green-700'
                            : 'bg-amber-100 text-amber-700'
                        }`}
                      >
                        {m.status === 'yes' ? '✓' : '?'} {m.name}
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <button className="mt-6 w-full py-3.5 bg-gradient-to-r from-orange-500 to-amber-500 text-white rounded-2xl font-semibold hover:from-orange-600 hover:to-amber-600 transition-all shadow-lg shadow-orange-200">
                Open Event →
              </button>
            </div>
          </div>
        </section>

        {/* Quick Stats Strip */}
        <section className="mb-8 animate-slide-up delay-1">
          <div className="grid grid-cols-3 gap-3">
            <div className="card-playful p-4 text-center">
              <p className="text-3xl font-bold text-orange-500 mb-1">3</p>
              <p className="text-xs text-gray-500">events this month</p>
            </div>
            <div className="card-playful p-4 text-center">
              <p className="text-3xl font-bold text-green-500 mb-1">92%</p>
              <p className="text-xs text-gray-500">attendance rate</p>
            </div>
            <div className="card-playful p-4 text-center">
              <p className="text-3xl font-bold text-amber-500 mb-1">Fri</p>
              <p className="text-xs text-gray-500">favorite day</p>
            </div>
          </div>
        </section>

        {/* Groups as colorful cards */}
        <section className="mb-8 animate-slide-up delay-2">
          <h2 className="text-lg font-bold text-gray-900 mb-4">Your squads</h2>

          <div className="space-y-3">
            {[
              { emoji: '👖', name: 'Sweatpants', members: ['Rachel', 'Katie', 'Addison', 'Aidan'], color: 'from-amber-400 to-orange-400', next: 'Tomorrow!' },
              { emoji: '🩳', name: 'Sweatshorts', members: ['Rachel', 'Jen', 'Mike', 'Sam', 'Alex'], color: 'from-emerald-400 to-teal-400', next: 'Sat, Dec 21' },
              { emoji: '🎿', name: 'Ski Trip 2025', members: ['Rachel', 'Katie', '+6 more'], color: 'from-blue-400 to-indigo-400', next: 'Planning' },
            ].map((group, i) => (
              <div key={i} className="card-playful p-4 flex items-center gap-4 cursor-pointer">
                {/* Gradient emoji container */}
                <div className={`w-14 h-14 rounded-2xl bg-gradient-to-br ${group.color} flex items-center justify-center text-2xl shadow-lg`}>
                  {group.emoji}
                </div>

                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-gray-900">{group.name}</h3>
                  <div className="flex items-center gap-2 mt-1">
                    <div className="flex -space-x-1.5">
                      {group.members.slice(0, 3).map((m, j) => (
                        <div key={j} className="w-5 h-5 rounded-full bg-gray-200 border border-white text-[8px] flex items-center justify-center font-medium text-gray-600">
                          {m[0]}
                        </div>
                      ))}
                    </div>
                    <span className="text-xs text-gray-500">{group.members.length} members</span>
                  </div>
                </div>

                <div className="text-right">
                  <span className={`text-xs font-medium ${group.next === 'Tomorrow!' ? 'text-orange-500' : 'text-gray-500'}`}>
                    {group.next}
                  </span>
                  <ChevronRight className="w-5 h-5 text-gray-300 mt-1 ml-auto" />
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Action prompt */}
        <section className="animate-slide-up delay-3">
          <div className="card-playful p-5 bg-gradient-to-r from-violet-50 to-purple-50 border-2 border-violet-100">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-violet-400 to-purple-400 flex items-center justify-center">
                <Sparkles className="w-6 h-6 text-white" />
              </div>
              <div className="flex-1">
                <h3 className="font-semibold text-gray-900">Ready to plan something?</h3>
                <p className="text-sm text-gray-500">Let AI suggest the perfect outing</p>
              </div>
              <button className="px-4 py-2 bg-violet-500 text-white text-sm font-medium rounded-xl hover:bg-violet-600 transition-colors">
                Let's go
              </button>
            </div>
          </div>
        </section>
      </main>

      {/* Floating Add Button */}
      <button className="fixed bottom-6 right-6 w-14 h-14 rounded-full bg-gradient-to-r from-orange-500 to-amber-500 text-white shadow-xl shadow-orange-300 flex items-center justify-center hover:scale-105 transition-transform">
        <Plus className="w-6 h-6" />
      </button>
    </div>
  );
}

// ============================================
// VARIANT 3: DATA DASHBOARD
// Analytics-inspired, information-dense
// ============================================
function DataDashboard() {
  return (
    <div className="min-h-screen bg-slate-50 font-outfit pt-16">
      <style>{`
        .glass-card {
          background: rgba(255, 255, 255, 0.8);
          backdrop-filter: blur(12px);
          border: 1px solid rgba(255, 255, 255, 0.5);
        }
      `}</style>

      {/* Compact Header */}
      <header className="bg-white border-b border-slate-200">
        <div className="max-w-6xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-6">
              <h1 className="text-xl font-semibold text-slate-900">Dashboard</h1>
              <nav className="flex items-center gap-1 bg-slate-100 p-1 rounded-lg">
                {['Overview', 'Events', 'Groups', 'Insights'].map((tab, i) => (
                  <button
                    key={tab}
                    className={`px-3 py-1.5 text-sm rounded-md transition-colors ${
                      i === 0 ? 'bg-white shadow-sm text-slate-900 font-medium' : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    {tab}
                  </button>
                ))}
              </nav>
            </div>
            <div className="flex items-center gap-3">
              <button className="p-2 rounded-lg hover:bg-slate-100 transition-colors">
                <Bell className="w-5 h-5 text-slate-600" />
              </button>
              <div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center text-sm font-medium text-indigo-600">
                R
              </div>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-6">
        {/* Metrics Row */}
        <section className="grid grid-cols-4 gap-4 mb-6 animate-slide-up">
          {[
            { label: 'Upcoming Events', value: '4', change: '+2', icon: Calendar, color: 'indigo' },
            { label: 'This Month', value: '3', change: '+1', icon: TrendingUp, color: 'emerald' },
            { label: 'Active Groups', value: '3', change: '0', icon: Users, color: 'amber' },
            { label: 'RSVP Rate', value: '94%', change: '+8%', icon: Check, color: 'violet' },
          ].map((stat, i) => (
            <div key={i} className="bg-white rounded-xl border border-slate-200 p-4">
              <div className="flex items-center justify-between mb-3">
                <div className={`w-8 h-8 rounded-lg bg-${stat.color}-100 flex items-center justify-center`}>
                  <stat.icon className={`w-4 h-4 text-${stat.color}-600`} />
                </div>
                {stat.change !== '0' && (
                  <span className="text-xs font-medium text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded">
                    {stat.change}
                  </span>
                )}
              </div>
              <p className="text-2xl font-semibold text-slate-900">{stat.value}</p>
              <p className="text-xs text-slate-500 mt-0.5">{stat.label}</p>
            </div>
          ))}
        </section>

        <div className="grid grid-cols-3 gap-6">
          {/* Main Column - Events */}
          <div className="col-span-2 space-y-6">
            {/* Next Event Card */}
            <section className="bg-white rounded-xl border border-slate-200 overflow-hidden animate-slide-up delay-1">
              <div className="p-4 border-b border-slate-100 flex items-center justify-between">
                <h2 className="font-semibold text-slate-900">Next Event</h2>
                <span className="text-xs font-medium text-indigo-600 bg-indigo-50 px-2 py-1 rounded-full">
                  Tomorrow
                </span>
              </div>

              <div className="p-4">
                <div className="flex items-center gap-4 mb-4">
                  <div className="w-12 h-12 rounded-xl bg-slate-100 flex items-center justify-center text-2xl">
                    👖
                  </div>
                  <div>
                    <h3 className="font-semibold text-slate-900">Holiday PopUp</h3>
                    <p className="text-sm text-slate-500">Sweatpants</p>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-4 p-3 bg-slate-50 rounded-lg mb-4">
                  <div>
                    <p className="text-xs text-slate-500 mb-1">Date & Time</p>
                    <p className="text-sm font-medium text-slate-900">Fri, Dec 13</p>
                    <p className="text-xs text-slate-500">6:00 PM PST</p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-500 mb-1">Location</p>
                    <p className="text-sm font-medium text-slate-900">The Double Standard</p>
                    <p className="text-xs text-slate-500">Oakland, CA</p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-500 mb-1">Responses</p>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-green-600">3 yes</span>
                      <span className="text-sm text-slate-400">·</span>
                      <span className="text-sm font-medium text-amber-600">1 pending</span>
                    </div>
                  </div>
                </div>

                {/* RSVP Progress */}
                <div className="mb-4">
                  <div className="flex items-center justify-between text-xs text-slate-500 mb-2">
                    <span>RSVP Progress</span>
                    <span>3 of 4 responded</span>
                  </div>
                  <div className="h-2 bg-slate-100 rounded-full overflow-hidden flex">
                    <div className="h-full bg-green-500" style={{ width: '75%' }} />
                    <div className="h-full bg-amber-400" style={{ width: '25%' }} />
                  </div>
                </div>

                <button className="w-full py-2.5 bg-indigo-600 text-white rounded-lg font-medium hover:bg-indigo-700 transition-colors">
                  View Details
                </button>
              </div>
            </section>

            {/* Events List */}
            <section className="bg-white rounded-xl border border-slate-200 overflow-hidden animate-slide-up delay-2">
              <div className="p-4 border-b border-slate-100 flex items-center justify-between">
                <h2 className="font-semibold text-slate-900">Upcoming Events</h2>
                <button className="text-sm text-indigo-600 hover:text-indigo-700">View all</button>
              </div>

              <div className="divide-y divide-slate-100">
                {[
                  { date: 'Dec 19', title: 'Sweet Maple', group: 'Sweatpants', status: 'pending', emoji: '👖' },
                  { date: 'Dec 21', title: 'Winter Brunch', group: 'Sweatshorts', status: 'confirmed', emoji: '🩳' },
                  { date: 'Dec 28', title: 'NYE Pre-Party', group: 'Sweatpants', status: 'confirmed', emoji: '👖' },
                ].map((event, i) => (
                  <div key={i} className="flex items-center gap-4 p-4 hover:bg-slate-50 transition-colors cursor-pointer">
                    <div className="w-10 h-10 rounded-lg bg-slate-100 flex items-center justify-center text-lg flex-shrink-0">
                      {event.emoji}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-slate-900">{event.title}</p>
                      <p className="text-sm text-slate-500">{event.group}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-medium text-slate-900">{event.date}</p>
                      <p className={`text-xs ${event.status === 'confirmed' ? 'text-green-600' : 'text-amber-600'}`}>
                        {event.status === 'confirmed' ? 'Going' : 'RSVP needed'}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Groups */}
            <section className="bg-white rounded-xl border border-slate-200 overflow-hidden animate-slide-up delay-3">
              <div className="p-4 border-b border-slate-100 flex items-center justify-between">
                <h2 className="font-semibold text-slate-900">Groups</h2>
                <button className="w-6 h-6 rounded-md bg-slate-100 flex items-center justify-center hover:bg-slate-200 transition-colors">
                  <Plus className="w-4 h-4 text-slate-600" />
                </button>
              </div>

              <div className="divide-y divide-slate-100">
                {[
                  { emoji: '👖', name: 'Sweatpants', members: 4, events: 12 },
                  { emoji: '🩳', name: 'Sweatshorts', members: 5, events: 8 },
                  { emoji: '🎿', name: 'Ski Trip 2025', members: 8, events: 0 },
                ].map((group, i) => (
                  <div key={i} className="flex items-center gap-3 p-3 hover:bg-slate-50 transition-colors cursor-pointer">
                    <span className="text-xl">{group.emoji}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-slate-900 truncate">{group.name}</p>
                      <p className="text-xs text-slate-500">{group.members} members · {group.events} events</p>
                    </div>
                    <ChevronRight className="w-4 h-4 text-slate-400" />
                  </div>
                ))}
              </div>
            </section>

            {/* Activity Feed */}
            <section className="bg-white rounded-xl border border-slate-200 overflow-hidden animate-slide-up delay-4">
              <div className="p-4 border-b border-slate-100">
                <h2 className="font-semibold text-slate-900">Recent Activity</h2>
              </div>

              <div className="p-4 space-y-4">
                {[
                  { icon: Check, text: 'Katie RSVPed yes', time: '2h ago', color: 'green' },
                  { icon: MessageCircle, text: 'New suggestion for Sweatpants', time: '5h ago', color: 'indigo' },
                  { icon: Users, text: 'Addison joined Ski Trip', time: '1d ago', color: 'amber' },
                ].map((activity, i) => (
                  <div key={i} className="flex items-start gap-3">
                    <div className={`w-6 h-6 rounded-full bg-${activity.color}-100 flex items-center justify-center flex-shrink-0`}>
                      <activity.icon className={`w-3 h-3 text-${activity.color}-600`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-slate-700">{activity.text}</p>
                      <p className="text-xs text-slate-400">{activity.time}</p>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          </div>
        </div>
      </main>
    </div>
  );
}
