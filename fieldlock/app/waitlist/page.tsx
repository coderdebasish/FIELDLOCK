import { requireAuth } from "@/lib/auth-guards";
import Link from "next/link";
import prisma from "@/lib/db";
import { formatDate, formatTime, getFacilityIcon } from "@/lib/utils";
import { Trophy, Clock, MapPin, ShieldCheck, Sparkles } from "lucide-react";

export default async function WaitlistPage() {
  const session = await requireAuth();

  const waitlistItems = await prisma.waitlist.findMany({
    where: { userId: session.user.id },
    include: {
      slotResource: {
        include: { facility: true },
      },
    },
    orderBy: { joinedAt: "desc" },
  });

  return (
    <main className="min-h-screen bg-[#0a0a0f] text-white">
      {/* Top Bar */}
      <div className="border-b border-white/5 px-8 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg gradient-brand flex items-center justify-center">
            <Trophy className="w-4 h-4 text-white" />
          </div>
          <span className="font-bold text-lg">FIELDLOCK</span>
        </div>
        <nav className="flex items-center gap-6 text-sm">
          <Link href="/dashboard" className="text-slate-400 hover:text-white transition-colors">Dashboard</Link>
          <Link href="/facilities" className="text-slate-400 hover:text-white transition-colors">Facilities</Link>
          <Link href="/my-bookings" className="text-slate-400 hover:text-white transition-colors">My Bookings</Link>
          <Link href="/waitlist" className="text-white font-medium">Waitlist</Link>
        </nav>
      </div>

      <div className="max-w-5xl mx-auto px-8 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-black mb-2 flex items-center gap-2">
            Smart Waitlist <Sparkles className="w-6 h-6 text-amber-400" />
          </h1>
          <p className="text-slate-400">
            Waitlists are prioritized dynamically using your Fair Allocation Engine score.
          </p>
        </div>

        {waitlistItems.length === 0 ? (
          <div className="card text-center py-12 text-slate-500">
            <Clock className="w-10 h-10 mx-auto mb-3 opacity-30" />
            <p className="text-lg text-slate-400">You are not currently on any waitlists.</p>
            <p className="text-xs text-slate-600 mt-1">
              When a requested slot is booked, you can join the queue automatically.
            </p>
            <Link href="/facilities" className="text-purple-400 text-sm hover:underline mt-4 inline-block">
              Browse facilities →
            </Link>
          </div>
        ) : (
          <div className="space-y-4">
            {waitlistItems.map((item) => (
              <div
                key={item.id}
                className="card flex flex-col md:flex-row md:items-center justify-between gap-4 border-amber-500/20 bg-amber-500/5"
              >
                <div className="flex items-start gap-4">
                  <span className="text-4xl">{getFacilityIcon(item.slotResource.facility.type)}</span>
                  <div>
                    <h3 className="text-lg font-bold text-white">{item.slotResource.facility.name}</h3>
                    <div className="flex items-center gap-4 text-sm text-slate-400 mt-1">
                      <span className="flex items-center gap-1">
                        <MapPin className="w-3.5 h-3.5" />
                        {item.slotResource.facility.location}
                      </span>
                      <span className="flex items-center gap-1 font-mono text-amber-400">
                        <Clock className="w-3.5 h-3.5" />
                        {formatDate(item.slotResource.slotDate)} ({formatTime(item.slotResource.startTime)})
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-4 border-t md:border-t-0 border-white/5 pt-3 md:pt-0">
                  <div className="text-right">
                    <p className="text-xs text-slate-400">Waitlist Score</p>
                    <p className="text-lg font-bold text-amber-400">{item.rankScore.toFixed(0)} pts</p>
                  </div>
                  <span
                    className={`text-xs px-3 py-1.5 rounded-lg border font-medium ${
                      item.status === "WAITING"
                        ? "bg-amber-500/10 border-amber-500/30 text-amber-400"
                        : item.status === "PROMOTED"
                        ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400"
                        : "bg-gray-500/10 border-gray-500/20 text-slate-400"
                    }`}
                  >
                    {item.status}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Explainability Banner */}
        <div className="mt-10 p-6 rounded-2xl bg-[#13131a] border border-[#2a2a3a]">
          <div className="flex items-center gap-2 mb-2 text-purple-400 font-semibold text-sm">
            <ShieldCheck className="w-4 h-4" />
            How Fair Waitlist Ranking Works
          </div>
          <p className="text-xs text-slate-400 leading-relaxed">
            Unlike simple first-come-first-served systems vulnerable to bots, FIELDLOCK ranks waitlists using a transparent formula:
            <span className="text-slate-200 font-medium ml-1">
              Reliability (35%) + Usage Balance (20%) + Cancellation Quality (15%) + Waitlist Honor (15%) + New User Boost (10%).
            </span>
          </p>
        </div>
      </div>
    </main>
  );
}
