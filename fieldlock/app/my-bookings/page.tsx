import { requireAuth } from "@/lib/auth-guards";
import Link from "next/link";
import prisma from "@/lib/db";
import { formatDate, formatTime, getFacilityIcon } from "@/lib/utils";
import { Trophy, Calendar, Clock, MapPin, ChevronRight } from "lucide-react";
import CancelBookingButton from "./CancelBookingButton";

export default async function MyBookingsPage() {
  const session = await requireAuth();

  const bookings = await prisma.booking.findMany({
    where: { userId: session.user.id },
    include: {
      slotResource: {
        include: { facility: true },
      },
    },
    orderBy: [
      { slotResource: { slotDate: "desc" } },
      { createdAt: "desc" },
    ],
  });

  const activeBookings = bookings.filter((b) => b.status === "CONFIRMED");
  const pastBookings = bookings.filter((b) => b.status !== "CONFIRMED");

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
          <Link href="/my-bookings" className="text-white font-medium">My Bookings</Link>
          <Link href="/waitlist" className="text-slate-400 hover:text-white transition-colors">Waitlist</Link>
        </nav>
      </div>

      <div className="max-w-5xl mx-auto px-8 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-black mb-2">My Bookings</h1>
          <p className="text-slate-400">View active slot reservations and your booking history.</p>
        </div>

        {/* Active Bookings Section */}
        <div className="mb-10">
          <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
            <Calendar className="w-5 h-5 text-emerald-400" />
            Active Bookings ({activeBookings.length})
          </h2>

          {activeBookings.length === 0 ? (
            <div className="card text-center py-10 text-slate-500">
              <p>No active bookings.</p>
              <Link href="/facilities" className="text-purple-400 text-sm hover:underline mt-2 inline-block">
                Browse available facilities →
              </Link>
            </div>
          ) : (
            <div className="space-y-4">
              {activeBookings.map((b) => (
                <div
                  key={b.id}
                  className="card flex flex-col md:flex-row md:items-center justify-between gap-4 hover:border-white/20 transition-all"
                >
                  <div className="flex items-start gap-4">
                    <span className="text-4xl">{getFacilityIcon(b.slotResource.facility.type)}</span>
                    <div>
                      <h3 className="text-lg font-bold text-white">{b.slotResource.facility.name}</h3>
                      <div className="flex items-center gap-4 text-sm text-slate-400 mt-1">
                        <span className="flex items-center gap-1">
                          <MapPin className="w-3.5 h-3.5" />
                          {b.slotResource.facility.location}
                        </span>
                        <span className="flex items-center gap-1 font-mono text-emerald-400">
                          <Clock className="w-3.5 h-3.5" />
                          {formatDate(b.slotResource.slotDate)} ({formatTime(b.slotResource.startTime)} - {formatTime(b.slotResource.endTime)})
                        </span>
                      </div>
                      {b.qrToken && (
                        <p className="text-xs text-slate-500 font-mono mt-2">
                          QR Pass: <span className="text-slate-300">{b.qrToken}</span>
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-3 self-end md:self-center">
                    <CancelBookingButton bookingId={b.id} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Past Bookings Section */}
        <div>
          <h2 className="text-xl font-bold mb-4 text-slate-400">Booking History</h2>
          {pastBookings.length === 0 ? (
            <div className="card text-center py-6 text-slate-500 text-sm">
              No past bookings recorded yet.
            </div>
          ) : (
            <div className="space-y-3">
              {pastBookings.map((b) => (
                <div
                  key={b.id}
                  className="p-4 rounded-xl bg-[#13131a] border border-[#2a2a3a] flex items-center justify-between text-sm"
                >
                  <div className="flex items-center gap-3">
                    <span className="text-xl">{getFacilityIcon(b.slotResource.facility.type)}</span>
                    <div>
                      <p className="font-medium text-slate-200">{b.slotResource.facility.name}</p>
                      <p className="text-xs text-slate-500">
                        {formatDate(b.slotResource.slotDate)} · {formatTime(b.slotResource.startTime)}
                      </p>
                    </div>
                  </div>
                  <span
                    className={`text-xs px-2.5 py-1 rounded-md font-medium ${
                      b.status === "COMPLETED"
                        ? "bg-blue-500/10 border border-blue-500/20 text-blue-400"
                        : b.status === "CANCELLED"
                        ? "bg-red-500/10 border border-red-500/20 text-red-400"
                        : "bg-orange-500/10 border border-orange-500/20 text-orange-400"
                    }`}
                  >
                    {b.status}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
