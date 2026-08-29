import { requireAdmin } from "@/lib/auth-guards";
import Link from "next/link";
import prisma from "@/lib/db";
import {
  Trophy, Zap, BarChart3, Calendar, Settings,
  Users, Clock, TrendingUp, AlertCircle, CheckCircle
} from "lucide-react";

export default async function AdminDashboardPage() {
  await requireAdmin();

  // Key metrics
  const [
    totalBookings,
    confirmedBookings,
    noShows,
    totalStudents,
    totalFacilities,
    waitlistTotal,
    recentBookings,
    topRecommendations,
  ] = await Promise.all([
    prisma.booking.count(),
    prisma.booking.count({ where: { status: "CONFIRMED" } }),
    prisma.booking.count({ where: { status: "NO_SHOW" } }),
    prisma.user.count({ where: { role: "STUDENT" } }),
    prisma.facility.count({ where: { isActive: true } }),
    prisma.waitlist.count({ where: { status: "WAITING" } }),
    prisma.booking.findMany({
      where: { status: "CONFIRMED" },
      include: {
        user: { select: { name: true, rollNumber: true } },
        slotResource: { include: { facility: { select: { name: true, type: true } } } },
      },
      orderBy: { createdAt: "desc" },
      take: 8,
    }),
    prisma.demandPrediction.findMany({
      where: {
        recommendation: { not: null },
        capacityRatio: { gt: 1.5 },
        predictedDate: { gte: new Date() },
      },
      include: { facility: { select: { name: true, type: true } } },
      orderBy: { capacityRatio: "desc" },
      take: 3,
    }),
  ]);

  const noShowRate = totalBookings > 0 ? Math.round((noShows / totalBookings) * 100) : 0;

  return (
    <main className="min-h-screen bg-[#0a0a0f] text-white">
      {/* Sidebar nav */}
      <div className="flex">
        <aside className="w-64 min-h-screen border-r border-white/5 p-6 flex flex-col gap-2">
          <div className="flex items-center gap-3 mb-8">
            <div className="w-8 h-8 rounded-lg gradient-brand flex items-center justify-center">
              <Trophy className="w-4 h-4 text-white" />
            </div>
            <div>
              <div className="font-bold text-sm">FIELDLOCK</div>
              <div className="text-xs text-slate-500">Admin Console</div>
            </div>
          </div>

          {[
            { label: "Dashboard", href: "/admin", icon: BarChart3 },
            { label: "Facilities", href: "/admin/facilities", icon: Calendar },
            { label: "All Bookings", href: "/admin/bookings", icon: CheckCircle },
            { label: "Analytics", href: "/admin/analytics", icon: TrendingUp },
            { label: "Intelligence", href: "/admin/intelligence", icon: Zap },
            { label: "⚡ Race Demo", href: "/admin/race-demo", icon: AlertCircle },
            { label: "Students", href: "/admin/students", icon: Users },
          ].map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="flex items-center gap-3 px-4 py-2.5 rounded-xl text-slate-400 hover:text-white hover:bg-white/5 transition-all text-sm"
            >
              <item.icon className="w-4 h-4" />
              {item.label}
            </Link>
          ))}

          <div className="mt-auto">
            <Link
              href="/api/auth/signout"
              className="flex items-center gap-3 px-4 py-2.5 rounded-xl text-slate-600 hover:text-white hover:bg-white/5 transition-all text-sm"
            >
              <Settings className="w-4 h-4" />
              Sign Out
            </Link>
          </div>
        </aside>

        {/* Main content */}
        <div className="flex-1 p-8">
          <div className="mb-8">
            <h1 className="text-3xl font-black">Sports Intelligence</h1>
            <p className="text-slate-400 mt-1">FIELDLOCK Admin — IIT Guwahati Sports Board</p>
          </div>

          {/* Metrics */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
            {[
              { label: "Active Bookings", value: confirmedBookings, color: "text-emerald-400", icon: CheckCircle },
              { label: "No-Show Rate", value: `${noShowRate}%`, color: noShowRate > 15 ? "text-red-400" : "text-amber-400", icon: AlertCircle },
              { label: "On Waitlist", value: waitlistTotal, color: "text-purple-400", icon: Users },
              { label: "Active Facilities", value: totalFacilities, color: "text-blue-400", icon: Calendar },
            ].map((m) => (
              <div key={m.label} className="card">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-slate-400 text-sm">{m.label}</span>
                  <m.icon className={`w-4 h-4 ${m.color}`} />
                </div>
                <p className={`text-3xl font-black ${m.color}`}>{m.value}</p>
              </div>
            ))}
          </div>

          <div className="grid lg:grid-cols-3 gap-6">

            {/* Operational Recommendations */}
            <div className="lg:col-span-1 space-y-4">
              <div className="card">
                <div className="flex items-center gap-2 mb-4">
                  <Zap className="w-5 h-5 text-orange-400" />
                  <h2 className="font-bold">Operational Recommendations</h2>
                </div>

                {topRecommendations.length === 0 ? (
                  <div className="text-center py-6 text-slate-500 text-sm">
                    <CheckCircle className="w-6 h-6 mx-auto mb-2 opacity-40" />
                    <p>All facilities operating normally.</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {topRecommendations.map((rec) => (
                      <div
                        key={rec.id}
                        className="p-3 rounded-xl bg-orange-500/10 border border-orange-500/20"
                      >
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-lg">
                            {rec.facility.type === "BADMINTON" ? "🏸" :
                             rec.facility.type === "TENNIS" ? "🎾" :
                             rec.facility.type === "FOOTBALL" ? "⚽" : "🏋️"}
                          </span>
                          <span className="font-medium text-sm text-orange-400">
                            {rec.facility.name}
                          </span>
                          <span className="ml-auto text-xs text-red-400 font-bold">
                            {rec.capacityRatio.toFixed(1)}× demand
                          </span>
                        </div>
                        <p className="text-xs text-slate-400 leading-relaxed">
                          {rec.recommendation?.substring(0, 120)}...
                        </p>
                      </div>
                    ))}
                  </div>
                )}

                <Link
                  href="/admin/intelligence"
                  className="mt-4 block text-center text-sm text-purple-400 hover:text-purple-300 transition-colors"
                >
                  View full intelligence dashboard →
                </Link>
              </div>

              {/* Race Demo CTA */}
              <Link href="/admin/race-demo" className="block">
                <div className="card border-orange-500/30 bg-orange-500/5 hover:bg-orange-500/10 transition-all cursor-pointer group">
                  <div className="flex items-center gap-3 mb-2">
                    <Zap className="w-5 h-5 text-orange-400" />
                    <span className="font-bold text-orange-400">Live Race Demo</span>
                  </div>
                  <p className="text-sm text-slate-400">
                    Fire simultaneous booking requests and watch the concurrency mechanism in action.
                  </p>
                  <div className="flex items-center gap-2 mt-3 text-orange-400 text-sm font-medium">
                    Launch Demo <span className="group-hover:translate-x-1 transition-transform inline-block">→</span>
                  </div>
                </div>
              </Link>
            </div>

            {/* Recent Bookings */}
            <div className="lg:col-span-2">
              <div className="card">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="font-bold">Recent Bookings</h2>
                  <Link href="/admin/bookings" className="text-sm text-purple-400 hover:text-purple-300 transition-colors">
                    View all
                  </Link>
                </div>

                <div className="space-y-2">
                  {recentBookings.map((b) => (
                    <div
                      key={b.id}
                      className="flex items-center gap-4 p-3 rounded-xl hover:bg-white/5 transition-all"
                    >
                      <span className="text-xl">
                        {b.slotResource.facility.type === "BADMINTON" ? "🏸" :
                         b.slotResource.facility.type === "TENNIS" ? "🎾" :
                         b.slotResource.facility.type === "FOOTBALL" ? "⚽" : "🏋️"}
                      </span>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{b.user.name}</p>
                        <p className="text-xs text-slate-500">
                          {b.slotResource.facility.name} · {b.slotResource.startTime}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-slate-500">
                          {new Date(b.createdAt).toLocaleDateString()}
                        </span>
                        <span className="text-xs px-2 py-0.5 rounded-md bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
                          CONFIRMED
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
