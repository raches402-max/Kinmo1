/**
 * Dashboard Redesign V2 - Geometric with Kinmo Colors
 *
 * DESIGN: Clean geometric minimalist with Kinmo's warm gold palette
 * - Primary: Golden yellow hsl(44, 91%, 57%) #F5C030
 * - Clean lines, bold typography, no photos
 * - Warm, approachable but professional
 */

import { useState } from "react";
import {
  Calendar, MapPin, Users, Clock, ChevronRight,
  Sparkles, Plus, MessageCircle, Check,
  ArrowRight, Bell, Settings, Zap, TrendingUp
} from "lucide-react";

export default function PrototypeDashboardV2() {
  return (
    <div className="min-h-screen">
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700&display=swap');

        .font-outfit { font-family: 'Outfit', system-ui, sans-serif; }

        /* Kinmo Colors */
        :root {
          --kinmo-gold: hsl(44, 91%, 57%);
          --kinmo-gold-light: hsl(44, 91%, 95%);
          --kinmo-gold-dark: hsl(44, 80%, 35%);
          --kinmo-warm-bg: hsl(44, 40%, 98%);
          --kinmo-warm-border: hsl(44, 30%, 90%);
        }

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

        /* Kinmo card style */
        .card-kinmo {
          background: white;
          border: 1px solid var(--kinmo-warm-border);
          border-radius: 16px;
          transition: all 0.2s ease;
        }
        .card-kinmo:hover {
          border-color: hsl(44, 50%, 80%);
          box-shadow: 0 4px 20px -4px hsl(44 60% 50% / 0.15);
        }
      `}</style>

      <GeometricKinmoDashboard />
    </div>
  );
}

function GeometricKinmoDashboard() {
  return (
    <div className="min-h-screen font-outfit" style={{ background: 'var(--kinmo-warm-bg)' }}>
      {/* Header with warm gold accent */}
      <header className="relative overflow-hidden border-b" style={{ borderColor: 'var(--kinmo-warm-border)' }}>
        {/* Geometric background shapes in Kinmo gold */}
        <div
          className="absolute -right-20 -top-20 w-64 h-64 rounded-full opacity-[0.08]"
          style={{ background: 'var(--kinmo-gold)' }}
        />
        <div
          className="absolute right-32 top-8 w-24 h-24 rounded-full opacity-[0.12]"
          style={{ background: 'var(--kinmo-gold)' }}
        />

        <div className="max-w-5xl mx-auto px-6 py-8 relative">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium tracking-widest uppercase mb-1" style={{ color: 'hsl(44, 70%, 45%)' }}>
                Thursday, December 12
              </p>
              <h1 className="text-4xl font-semibold text-gray-900 tracking-tight">
                Hey, Rachel
              </h1>
            </div>
            <div className="flex items-center gap-3">
              <button
                className="p-3 rounded-xl hover:bg-white transition-colors"
                style={{ background: 'hsl(44, 40%, 96%)' }}
              >
                <Bell className="w-5 h-5" style={{ color: 'hsl(44, 60%, 40%)' }} />
              </button>
              <button
                className="p-3 rounded-xl hover:bg-white transition-colors"
                style={{ background: 'hsl(44, 40%, 96%)' }}
              >
                <Settings className="w-5 h-5" style={{ color: 'hsl(44, 60%, 40%)' }} />
              </button>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-8">
        {/* Next Event - Hero Card with Kinmo gold */}
        <section className="mb-10 animate-slide-up">
          <div
            className="rounded-3xl p-8 text-white relative overflow-hidden"
            style={{ background: 'linear-gradient(135deg, hsl(44, 80%, 42%) 0%, hsl(44, 85%, 35%) 100%)' }}
          >
            {/* Decorative corner accent */}
            <div className="absolute top-0 right-0 w-48 h-48">
              <div className="absolute top-6 right-6 w-28 h-28 border-2 border-white/20 rounded-full" />
              <div className="absolute top-12 right-12 w-16 h-16 bg-white/10 rounded-full" />
            </div>

            <div className="relative">
              <div className="flex items-center gap-2 mb-4">
                <span className="text-3xl">👖</span>
                <span className="text-white/80 font-medium text-sm tracking-wide uppercase">
                  Sweatpants · Tomorrow
                </span>
              </div>

              <h2 className="text-4xl font-semibold tracking-tight mb-6">
                Holiday PopUp
              </h2>

              <div className="grid grid-cols-3 gap-6 mb-8">
                <div>
                  <p className="text-white/60 text-xs uppercase tracking-wider mb-1">When</p>
                  <p className="text-lg font-medium">Fri, Dec 13</p>
                  <p className="text-white/70">6:00 PM</p>
                </div>
                <div>
                  <p className="text-white/60 text-xs uppercase tracking-wider mb-1">Where</p>
                  <p className="text-lg font-medium">The Double Standard</p>
                  <p className="text-white/70">Oakland</p>
                </div>
                <div>
                  <p className="text-white/60 text-xs uppercase tracking-wider mb-1">Attending</p>
                  <div className="flex items-center gap-2 mt-1">
                    <div className="flex -space-x-2">
                      {['R', 'K', 'A'].map((initial, i) => (
                        <div
                          key={i}
                          className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-semibold border-2"
                          style={{
                            background: 'hsl(44, 91%, 57%)',
                            color: 'hsl(44, 80%, 25%)',
                            borderColor: 'hsl(44, 80%, 42%)'
                          }}
                        >
                          {initial}
                        </div>
                      ))}
                    </div>
                    <span className="text-white/70 text-sm">+1 pending</span>
                  </div>
                </div>
              </div>

              <button className="inline-flex items-center gap-2 px-6 py-3 bg-white text-gray-900 rounded-xl font-semibold hover:bg-gray-50 transition-colors">
                View Event <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </section>

        {/* Quick Stats */}
        <section className="mb-10 animate-slide-up delay-1">
          <div className="grid grid-cols-4 gap-4">
            {[
              { label: 'This Week', value: '2', sub: 'events' },
              { label: 'RSVP Rate', value: '94%', sub: 'all time' },
              { label: 'Groups', value: '3', sub: 'active' },
              { label: 'Best Day', value: 'Fri', sub: 'most available' },
            ].map((stat, i) => (
              <div key={i} className="card-kinmo p-4 text-center">
                <p className="text-2xl font-bold text-gray-900">{stat.value}</p>
                <p className="text-sm text-gray-600">{stat.label}</p>
                <p className="text-xs text-gray-400">{stat.sub}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Upcoming Events - Compact list */}
        <section className="mb-10 animate-slide-up delay-2">
          <div className="flex items-center justify-between mb-5">
            <h2 className="text-xl font-semibold text-gray-900">Coming Up</h2>
            <button className="text-sm font-medium hover:underline" style={{ color: 'hsl(44, 70%, 40%)' }}>
              View all →
            </button>
          </div>

          <div className="space-y-3">
            {[
              { date: '19', month: 'Dec', day: 'Thu', title: 'Sweet Maple', group: '👖', groupName: 'Sweatpants', status: 'rsvp' },
              { date: '21', month: 'Dec', day: 'Sat', title: 'Winter Brunch', group: '🩳', groupName: 'Sweatshorts', status: 'planning' },
              { date: '28', month: 'Dec', day: 'Sat', title: 'NYE Pre-Party', group: '👖', groupName: 'Sweatpants', status: 'confirmed' },
            ].map((event, i) => (
              <div
                key={i}
                className="card-kinmo flex items-center gap-4 p-4 cursor-pointer group"
              >
                {/* Date block */}
                <div
                  className="w-14 h-14 rounded-xl flex flex-col items-center justify-center flex-shrink-0"
                  style={{ background: 'var(--kinmo-gold-light)' }}
                >
                  <span className="text-xs uppercase" style={{ color: 'hsl(44, 60%, 45%)' }}>{event.day}</span>
                  <span className="text-xl font-semibold text-gray-900">{event.date}</span>
                </div>

                {/* Event info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="text-lg">{event.group}</span>
                    <h3 className="font-medium text-gray-900 truncate">{event.title}</h3>
                  </div>
                  <p className="text-sm text-gray-500">{event.groupName} · {event.month} {event.date}</p>
                </div>

                {/* Status */}
                {event.status === 'rsvp' && (
                  <span
                    className="px-3 py-1.5 text-xs font-medium rounded-full"
                    style={{ background: 'var(--kinmo-gold-light)', color: 'hsl(44, 70%, 35%)' }}
                  >
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
        <section className="animate-slide-up delay-3">
          <div className="flex items-center justify-between mb-5">
            <h2 className="text-xl font-semibold text-gray-900">Your Groups</h2>
            <button
              className="flex items-center gap-2 px-4 py-2 text-white text-sm font-medium rounded-xl hover:opacity-90 transition-opacity"
              style={{ background: 'var(--kinmo-gold)' }}
            >
              <Plus className="w-4 h-4" /> New Group
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {[
              { emoji: '👖', name: 'Sweatpants', members: 4, next: 'Tomorrow', active: true },
              { emoji: '🩳', name: 'Sweatshorts', members: 5, next: 'Sat, Dec 21', active: true },
              { emoji: '🎿', name: 'Ski Trip 2025', members: 8, next: 'Planning', active: false },
            ].map((group, i) => (
              <div
                key={i}
                className="card-kinmo p-5 cursor-pointer group"
              >
                <div className="flex items-start justify-between mb-4">
                  <div
                    className="w-14 h-14 rounded-xl flex items-center justify-center text-2xl"
                    style={{ background: 'var(--kinmo-gold-light)' }}
                  >
                    {group.emoji}
                  </div>
                  {group.active && (
                    <div className="flex items-center gap-1.5 px-2 py-1 rounded-full" style={{ background: 'hsl(142, 50%, 95%)' }}>
                      <div className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse" />
                      <span className="text-xs text-green-700 font-medium">Active</span>
                    </div>
                  )}
                </div>

                <h3 className="font-semibold text-gray-900 mb-1">{group.name}</h3>
                <p className="text-sm text-gray-500 mb-3">{group.members} members</p>

                <div className="flex items-center gap-2 text-xs text-gray-600">
                  <Sparkles className="w-3.5 h-3.5" style={{ color: 'var(--kinmo-gold)' }} />
                  <span>Next: {group.next}</span>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* AI Suggestion Banner */}
        <section className="mt-10 animate-slide-up delay-4">
          <div
            className="card-kinmo p-5 flex items-center gap-4"
            style={{ background: 'linear-gradient(135deg, hsl(44, 50%, 97%) 0%, hsl(44, 60%, 94%) 100%)' }}
          >
            <div
              className="w-12 h-12 rounded-xl flex items-center justify-center"
              style={{ background: 'var(--kinmo-gold)' }}
            >
              <Sparkles className="w-6 h-6 text-white" />
            </div>
            <div className="flex-1">
              <h3 className="font-semibold text-gray-900">Ready to plan something new?</h3>
              <p className="text-sm text-gray-600">Let Kinmo suggest the perfect spot based on your group's preferences</p>
            </div>
            <button
              className="px-5 py-2.5 text-white text-sm font-medium rounded-xl hover:opacity-90 transition-opacity"
              style={{ background: 'var(--kinmo-gold)' }}
            >
              Get Suggestions
            </button>
          </div>
        </section>
      </main>

      {/* Floating Add Button */}
      <button
        className="fixed bottom-6 right-6 w-14 h-14 rounded-full text-white shadow-xl flex items-center justify-center hover:scale-105 transition-transform"
        style={{
          background: 'var(--kinmo-gold)',
          boxShadow: '0 8px 24px -4px hsl(44 80% 50% / 0.4)'
        }}
      >
        <Plus className="w-6 h-6" />
      </button>
    </div>
  );
}
