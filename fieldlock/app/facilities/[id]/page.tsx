"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams, useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  Trophy, MapPin, Users, Clock, AlertTriangle,
  TrendingUp, CheckCircle, Loader2, ChevronLeft, Info
} from "lucide-react";
import { getFacilityIcon, formatTime, formatDate, cn } from "@/lib/utils";
import { toast } from "@/components/ui/toaster";

interface SlotData {
  id: string;
  startTime: string;
  endTime: string;
  status: string;
  _count: { waitlist: number };
  demand: {
    ratio: number;
    level: "HIGH" | "MEDIUM" | "LOW";
    recommendation: string | null;
  } | null;
}

interface FacilityData {
  id: string;
  name: string;
  type: string;
  capacity: number;
  location: string;
  description?: string;
}

export default function FacilityDetailPage() {
  const params = useParams<{ id: string }>();
  const searchParams = useSearchParams();
  const router = useRouter();
  const date = searchParams.get("date") ?? new Date().toISOString().split("T")[0];

  const [facility, setFacility] = useState<FacilityData | null>(null);
  const [slots, setSlots] = useState<SlotData[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedSlot, setSelectedSlot] = useState<SlotData | null>(null);
  const [booking, setBooking] = useState(false);
  const [bookingResult, setBookingResult] = useState<{
    status: "CONFIRMED" | "CONFLICT";
    waitlistPosition?: number;
    alternatives?: FacilityData[];
  } | null>(null);

  const fetchSlots = useCallback(async () => {
    setLoading(true);
    const res = await fetch(`/api/facilities/${params.id}/slots?date=${date}`);
    const data = await res.json();
    setFacility(data.facility);
    setSlots(data.slots);
    setLoading(false);
  }, [params.id, date]);

  useEffect(() => { fetchSlots(); }, [fetchSlots]);

  const handleBook = async () => {
    if (!selectedSlot) return;
    setBooking(true);

    const idempotencyKey = crypto.randomUUID();

    const res = await fetch("/api/bookings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ slotResourceId: selectedSlot.id, idempotencyKey }),
    });

    const data = await res.json();
    setBooking(false);

    if (data.status === "CONFIRMED") {
      toast("success", "Booking confirmed!", `${facility?.name} · ${formatTime(selectedSlot.startTime)}`);
      setBookingResult({ status: "CONFIRMED" });
      setTimeout(() => router.push("/my-bookings"), 2000);
    } else {
      setBookingResult({
        status: "CONFLICT",
        waitlistPosition: data.waitlistPosition,
        alternatives: data.alternatives,
      });
      toast("warning", "Slot taken!", `You're #${data.waitlistPosition} on the waitlist.`);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0a0a0f] flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-purple-400" />
      </div>
    );
  }

  if (!facility) return <div className="min-h-screen bg-[#0a0a0f] text-white flex items-center justify-center">Facility not found</div>;

  return (
    <main className="min-h-screen bg-[#0a0a0f] text-white">
      {/* Nav */}
      <div className="border-b border-white/5 px-8 py-4 flex items-center gap-4">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg gradient-brand flex items-center justify-center">
            <Trophy className="w-4 h-4 text-white" />
          </div>
          <span className="font-bold text-lg">FIELDLOCK</span>
        </div>
        <Link href="/facilities" className="flex items-center gap-1 text-slate-400 hover:text-white text-sm transition-colors ml-4">
          <ChevronLeft className="w-4 h-4" />
          Back to Facilities
        </Link>
      </div>

      <div className="max-w-5xl mx-auto px-8 py-8">

        {/* Facility header */}
        <div className="card mb-8">
          <div className="flex items-start gap-6">
            <div className="text-5xl">{getFacilityIcon(facility.type)}</div>
            <div className="flex-1">
              <h1 className="text-3xl font-black mb-2">{facility.name}</h1>
              <div className="flex items-center gap-4 text-slate-400 text-sm mb-3">
                <span className="flex items-center gap-1"><MapPin className="w-4 h-4" />{facility.location}</span>
                <span className="flex items-center gap-1"><Users className="w-4 h-4" />Capacity: {facility.capacity}</span>
              </div>
              {facility.description && (
                <p className="text-slate-500 text-sm">{facility.description}</p>
              )}
            </div>
            <div className="text-right">
              <p className="text-slate-400 text-sm">Viewing slots for</p>
              <p className="font-bold">{formatDate(date)}</p>
              <p className="text-emerald-400 text-sm mt-1">
                {slots.filter(s => s.status === "AVAILABLE").length} available
              </p>
            </div>
          </div>
        </div>

        {/* Booking result modal */}
        {bookingResult && (
          <div className={cn(
            "mb-8 p-6 rounded-2xl border",
            bookingResult.status === "CONFIRMED"
              ? "bg-emerald-500/10 border-emerald-500/30"
              : "bg-amber-500/10 border-amber-500/30"
          )}>
            {bookingResult.status === "CONFIRMED" ? (
              <div className="flex items-center gap-3">
                <CheckCircle className="w-6 h-6 text-emerald-400" />
                <div>
                  <p className="font-bold text-emerald-400">Booking Confirmed!</p>
                  <p className="text-sm text-slate-400">Redirecting to your bookings...</p>
                </div>
              </div>
            ) : (
              <div>
                <div className="flex items-center gap-3 mb-4">
                  <AlertTriangle className="w-6 h-6 text-amber-400" />
                  <div>
                    <p className="font-bold text-amber-400">Slot Just Taken</p>
                    <p className="text-sm text-slate-400">
                      You&apos;re #{bookingResult.waitlistPosition} on the waitlist. We&apos;ll notify you if it opens up.
                    </p>
                  </div>
                </div>
                {bookingResult.alternatives && bookingResult.alternatives.length > 0 && (
                  <div>
                    <p className="text-sm font-medium text-slate-300 mb-2">Alternative slots:</p>
                    <div className="flex flex-wrap gap-2">
                      {bookingResult.alternatives.map((alt: { id: string; name: string }) => (
                        <Link
                          key={alt.id}
                          href={`/facilities/${alt.id}?date=${date}`}
                          className="px-3 py-1.5 rounded-lg border border-purple-500/30 bg-purple-500/10 text-purple-400 text-sm hover:bg-purple-500/20 transition-all"
                        >
                          {alt.name}
                        </Link>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        <div className="grid lg:grid-cols-3 gap-8">

          {/* Slot grid */}
          <div className="lg:col-span-2">
            <h2 className="text-lg font-bold mb-4">Available Slots</h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {slots.map((slot) => {
                const isSelected = selectedSlot?.id === slot.id;
                const isAvailable = slot.status === "AVAILABLE";
                const demandLevel = slot.demand?.level;

                return (
                  <button
                    key={slot.id}
                    disabled={!isAvailable}
                    onClick={() => isAvailable && setSelectedSlot(isSelected ? null : slot)}
                    className={cn(
                      "p-4 rounded-xl border text-left transition-all",
                      isSelected
                        ? "border-orange-500 bg-orange-500/10 ring-2 ring-orange-500/20"
                        : isAvailable && demandLevel === "HIGH"
                        ? "slot-high-demand"
                        : isAvailable
                        ? "slot-available"
                        : slot.status === "BLOCKED"
                        ? "slot-blocked"
                        : "slot-booked"
                    )}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm font-bold">
                        {formatTime(slot.startTime)}
                      </span>
                      {demandLevel === "HIGH" && isAvailable && (
                        <TrendingUp className="w-3 h-3 text-amber-400" />
                      )}
                    </div>
                    <div className="text-xs opacity-60">{formatTime(slot.endTime)}</div>
                    {!isAvailable && (
                      <div className="text-xs mt-1 opacity-60">
                        {slot.status === "BOOKED"
                          ? `${slot._count.waitlist} waiting`
                          : "Blocked"}
                      </div>
                    )}
                    {isAvailable && demandLevel === "HIGH" && (
                      <div className="text-xs mt-1 text-amber-400">High demand</div>
                    )}
                  </button>
                );
              })}
            </div>

            {/* Legend */}
            <div className="flex items-center gap-4 mt-6 text-xs text-slate-500">
              <span className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded bg-emerald-500/30 border border-emerald-500/50 inline-block" /> Available
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded bg-amber-500/30 border border-amber-500/50 inline-block" /> High demand
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded bg-red-500/10 border border-red-500/20 inline-block" /> Booked
              </span>
            </div>
          </div>

          {/* Booking panel */}
          <div className="space-y-4">
            <div className="card sticky top-6">
              <h2 className="font-bold mb-4">Book This Slot</h2>

              {selectedSlot ? (
                <div className="space-y-4">
                  <div className="p-4 rounded-xl bg-[#0a0a0f] border border-white/10">
                    <p className="text-sm text-slate-400 mb-1">Selected slot</p>
                    <p className="font-bold text-lg">
                      {formatTime(selectedSlot.startTime)} – {formatTime(selectedSlot.endTime)}
                    </p>
                    <p className="text-sm text-slate-400">{formatDate(date)}</p>
                    <p className="text-sm text-slate-400">{facility.name}</p>
                  </div>

                  {selectedSlot.demand?.level === "HIGH" && (
                    <div className="flex items-start gap-2 p-3 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-400 text-xs">
                      <Info className="w-4 h-4 shrink-0 mt-0.5" />
                      <span>High demand slot. Book quickly — others may be competing for this.</span>
                    </div>
                  )}

                  <button
                    onClick={handleBook}
                    disabled={booking}
                    className={cn(
                      "w-full py-3 rounded-xl gradient-brand text-white font-bold transition-all",
                      booking ? "opacity-70 cursor-not-allowed" : "hover:opacity-90 hover:scale-[1.02] glow-orange"
                    )}
                  >
                    {booking ? (
                      <span className="flex items-center justify-center gap-2">
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Booking...
                      </span>
                    ) : (
                      "Confirm Booking"
                    )}
                  </button>

                  <p className="text-xs text-slate-500 text-center">
                    Booking is atomic — no double-booking possible.
                  </p>
                </div>
              ) : (
                <div className="text-center py-6 text-slate-500">
                  <Clock className="w-8 h-8 mx-auto mb-2 opacity-40" />
                  <p className="text-sm">Select a green slot to book it.</p>
                </div>
              )}
            </div>

            {/* Demand insight */}
            {selectedSlot?.demand?.recommendation && (
              <div className="p-4 rounded-xl bg-purple-500/10 border border-purple-500/20">
                <div className="flex items-center gap-2 mb-2">
                  <TrendingUp className="w-4 h-4 text-purple-400" />
                  <p className="text-sm font-medium text-purple-400">Demand Insight</p>
                </div>
                <p className="text-xs text-slate-400 leading-relaxed">
                  {selectedSlot.demand.recommendation}
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}
