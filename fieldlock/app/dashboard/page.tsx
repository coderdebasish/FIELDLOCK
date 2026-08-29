import { requireAuth } from "@/lib/auth-guards";
import { redirect } from "next/navigation";
import Link from "next/link";
import prisma from "@/lib/db";
import { formatDate, formatTime, getFacilityIcon } from "@/lib/utils";
import {
  Trophy, Calendar, ChevronRight, Star, TrendingUp
} from "lucide-react";

export default async function DashboardPage() {
  const session = await requireAuth();
  if (session.user.role === "ADMIN") redirect("/admin");

  const userId = session.user.id;

  // Normalized start of today
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // Fetch upcoming & today's bookings
  const upcomingBookings = await prisma.booking.findMany({
    where: {
      userId,
      status: "CONFIRMED",
      slotResource: { slotDate: { gte: today } },
    },
    include: { slotResource: { include: { facility: true } } },
    orderBy: [
      { slotResource: { slotDate: "asc" } },
      { slotResource: { startTime: "asc" } },
    ],
    take: 5,
  });

  // Fetch waitlist positions
  const waitlistItems = await prisma.waitlist.findMany({
    where: { userId, status: "WAITING" },
    include: { slotResource: { include: { facility: true } } },
    orderBy: { joinedAt: "asc" },
    take: 3,
  });

  // Fetch user's allocation score events (last 5)
  const scoreEvents = await prisma.allocationEvent.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    take: 5,
  });

  // Full user data
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      allocationScore: true, totalBookings: true,
      attendedCount: true, noShowCount: true, name: true,
    },
  });

  const score = user?.allocationScore ?? 70;
  const attendanceRate = user?.totalBookings
    ? Math.min(100, Math.round(((user.attendedCount ?? 0) / user.totalBookings) * 100))
    : 100;

  // Score color
  const scoreColor =
    score >= 80 ? "text-emerald-400" :
    score >= 60 ? "text-amber-400" :
    "text-red-400";

  const scoreRing =
    score >= 80 ? "stroke-emerald-400" :
    score >= 60 ? "stroke-amber-400" :
    "stroke-red-400";

  const circumference = 2 * Math.PI * 40;
  const dashOffset = circumference - (Math.min(100, Math.max(0, score)) / 100) * circumference;

  return (
    <main className="min-h-screen bg-[#0a0a0f] text-white">
      {/* Top bar */}
      <div className="border-b border-white/5 px-8 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg gradient-brand flex items-center justify-center">
            <Trophy className="w-4 h-4 text-white" />
          </div>
          <span className="font-bold text-lg">FIELDLOCK</span>
        </div>
        <nav className="flex items-center gap-6 text-sm">
          <Link href="/dashboard" className="text-white font-medium">Dashboard</Link>
          <Link href="/facilities" className="text-slate-400 hover:text-white transition-colors">Facilities</Link>
          <Link href="/my-bookings" className="text-slate-400 hover:text-white transition-colors">My Bookings</Link>
          <Link href="/waitlist" className="text-slate-400 hover:text-white transition-colors">Waitlist</Link>
        </nav>
        <div className="flex items-center gap-3">
          <span className="text-sm text-slate-400">{session.user.name}</span>
          <Link
            href="/api/auth/signout"
            className="text-xs text-slate-500 hover:text-white transition-colors"
          >
            Sign out
          </Link>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-8 py-8">
        {/* Welcome */}
        <div className="mb-8">
          <h1 className="text-3xl font-black">
            Welcome back, {session.user.name?.split(" ")[0]} 👋
          </h1>
          <p className="text-slate-400 mt-1">Your sports dashboard for today.</p>
        </div>

        <div className="grid lg:grid-cols-3 gap-6">
          {/* Left column — bookings */}
          <div className="lg:col-span-2 space-y-6">

            {/* Quick action */}
            <Link
              href="/facilities"
              className="flex items-center justify-between p-5 rounded-2xl gradient-brand hover:opacity-90 transition-all hover:scale-[1.01] group"
            >
              <div>
                <p className="font-bold text-lg">Book a Facility</p>
                <p className="text-white/80 text-sm">Browse available slots right now</p>
              </div>
              <ChevronRight className="w-6 h-6 group-hover:translate-x-1 transition-transform" />
            </Link>

            {/* Upcoming bookings */}
            <div className="card">
              <div className="flex items-center justify-between mb-5">
                <h2 className="text-lg font-bold">Upcoming Bookings</h2>
                <Link href="/my-bookings" className="text-sm text-purple-400 hover:text-purple-300 transition-colors">
                  View all
                </Link>
              </div>

              {upcomingBookings.length === 0 ? (
                <div className="text-center py-8 text-slate-500">
                  <Calendar className="w-8 h-8 mx-auto mb-2 opacity-40" />
                  <p>No upcoming bookings.</p>
                  <Link href="/facilities" className="text-purple-400 text-sm hover:underline mt-1 inline-block">
                    Book a slot →
                  </Link>
                </div>
              ) : (
                <div className="space-y-3">
                  {upcomingBookings.map((b) => (
                    <div
                      key={b.id}
                      className="flex items-center justify-between p-4 rounded-xl bg-[#1a1a24] border border-white/5 hover:border-white/10 transition-all"
                    >
                      <div className="flex items-center gap-4">
                        <span className="text-2xl">
                          {getFacilityIcon(b.slotResource.facility.type)}
                        </span>
                        <div>
                          <p className="font-medium">{b.slotResource.facility.name}</p>
                          <p className="text-sm text-slate-400">
                            {formatDate(b.slotResource.slotDate)} ·{" "}
                            {formatTime(b.slotResource.startTime)} –{" "}
                            {formatTime(b.slotResource.endTime)}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-xs px-2 py-1 rounded-md bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 font-medium">
                          CONFIRMED
                        </span>
                        <Link
                          href="/my-bookings"
                          className="text-slate-500 hover:text-white transition-colors"
                        >
                          <ChevronRight className="w-4 h-4" />
                        </Link>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Waitlist */}
            {waitlistItems.length > 0 && (
              <div className="card">
                <div className="flex items-center justify-between mb-5">
                  <h2 className="text-lg font-bold">Your Waitlist</h2>
                  <Link href="/waitlist" className="text-sm text-purple-400 hover:text-purple-300 transition-colors">
                    View all
                  </Link>
                </div>
                <div className="space-y-3">
                  {waitlistItems.map((w) => (
                    <div
                      key={w.id}
                      className="flex items-center justify-between p-4 rounded-xl bg-amber-500/5 border border-amber-500/20"
                    >
                      <div className="flex items-center gap-4">
                        <span className="text-2xl">
                          {getFacilityIcon(w.slotResource.facility.type)}
                        </span>
                        <div>
                          <p className="font-medium">{w.slotResource.facility.name}</p>
                          <p className="text-sm text-slate-400">
                            {formatDate(w.slotResource.slotDate)} · {formatTime(w.slotResource.startTime)}
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-amber-400 font-bold text-sm">Waiting</p>
                        <p className="text-xs text-slate-500">Score: {w.rankScore.toFixed(0)}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Right column — Allocation Score */}
          <div className="space-y-6">

            {/* Allocation Score card */}
            <div className="card">
              <div className="flex items-center gap-2 mb-4">
                <Star className="w-5 h-5 text-orange-400" />
                <h2 className="font-bold">Fair Allocation Score</h2>
              </div>

              {/* Circular gauge */}
              <div className="flex justify-center mb-4">
                <div className="relative w-28 h-28">
                  <svg className="w-28 h-28 -rotate-90" viewBox="0 0 100 100">
                    <circle cx="50" cy="50" r="40" fill="none" stroke="#1a1a24" strokeWidth="10" />
                    <circle
                      cx="50" cy="50" r="40" fill="none"
                      strokeWidth="10"
                      strokeLinecap="round"
                      strokeDasharray={circumference}
                      strokeDashoffset={dashOffset}
                      className={`${scoreRing} transition-all duration-1000`}
                    />
                  </svg>
                  <div className="absolute inset-0 flex flex-col items-center justify-center">
                    <span className={`text-2xl font-black ${scoreColor}`}>
                      {score.toFixed(0)}
                    </span>
                    <span className="text-xs text-slate-500">/ 100</span>
                  </div>
                </div>
              </div>

              {/* Score breakdown */}
              <div className="space-y-2">
                {[
                  { label: "Attendance Rate", value: `${attendanceRate}%`, good: attendanceRate > 80 },
                  { label: "Total Bookings", value: `${user?.totalBookings ?? 0}`, good: true },
                  { label: "No-shows", value: `${user?.noShowCount ?? 0}`, good: (user?.noShowCount ?? 0) === 0 },
                ].map((item) => (
                  <div key={item.label} className="flex justify-between text-sm">
                    <span className="text-slate-400">{item.label}</span>
                    <span className={item.good ? "text-emerald-400" : "text-red-400"}>
                      {item.value}
                    </span>
                  </div>
                ))}
              </div>

              <div className={`mt-4 p-3 rounded-lg text-xs ${
                score >= 80
                  ? "bg-emerald-500/10 border border-emerald-500/20 text-emerald-400"
                  : score >= 60
                  ? "bg-amber-500/10 border border-amber-500/20 text-amber-400"
                  : "bg-red-500/10 border border-red-500/20 text-red-400"
              }`}>
                {score >= 80 && "🏆 Priority access — you're a reliable booker!"}
                {score >= 60 && score < 80 && "📈 Good standing. Keep attending to boost your score."}
                {score < 60 && "⚠️ Low score. Avoid no-shows to restore priority access."}
              </div>
            </div>

            {/* Recent score events */}
            {scoreEvents.length > 0 && (
              <div className="card">
                <div className="flex items-center gap-2 mb-4">
                  <TrendingUp className="w-4 h-4 text-purple-400" />
                  <h3 className="font-semibold text-sm">Score History</h3>
                </div>
                <div className="space-y-2">
                  {scoreEvents.map((ev) => (
                    <div key={ev.id} className="flex justify-between items-start text-xs">
                      <span className="text-slate-400 leading-tight">{ev.reason.substring(0, 45)}...</span>
                      <span className={`font-bold ml-2 ${ev.delta > 0 ? "text-emerald-400" : "text-red-400"}`}>
                        {ev.delta > 0 ? "+" : ""}{ev.delta}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Quick links */}
            <div className="card">
              <h3 className="font-semibold text-sm mb-3">Quick Links</h3>
              <div className="space-y-2">
                {[
                  { label: "Browse Facilities", href: "/facilities", icon: "🏟️" },
                  { label: "My Bookings", href: "/my-bookings", icon: "📅" },
                  { label: "My Waitlist", href: "/waitlist", icon: "⏳" },
                ].map((link) => (
                  <Link
                    key={link.href}
                    href={link.href}
                    className="flex items-center gap-3 p-2 rounded-lg hover:bg-white/5 transition-colors text-sm text-slate-300 hover:text-white"
                  >
                    <span>{link.icon}</span>
                    {link.label}
                  </Link>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
