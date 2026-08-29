"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { Trophy, Search, Filter, MapPin, Clock, Users, TrendingUp, ArrowRight } from "lucide-react";
import { getFacilityIcon, formatTime, cn } from "@/lib/utils";

interface Slot {
  id: string;
  startTime: string;
  endTime: string;
  status: string;
  _count: { waitlist: number };
}

interface Facility {
  id: string;
  name: string;
  type: string;
  capacity: number;
  location: string;
  description?: string;
  availabilityToday: { total: number; available: number; booked: number };
  slotResources: Slot[];
}

const TYPES = ["ALL", "BADMINTON", "TENNIS", "FOOTBALL", "GYM", "CRICKET"];

export default function FacilitiesPage() {
  const [facilities, setFacilities] = useState<Facility[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("ALL");
  const [search, setSearch] = useState("");
  const [selectedDate, setSelectedDate] = useState(
    new Date().toISOString().split("T")[0]
  );

  const fetchFacilities = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams({ date: selectedDate });
    if (filter !== "ALL") params.set("type", filter);
    const res = await fetch(`/api/facilities?${params}`);
    const data = await res.json();
    setFacilities(data);
    setLoading(false);
  }, [selectedDate, filter]);

  useEffect(() => { fetchFacilities(); }, [fetchFacilities]);

  const filtered = facilities.filter((f) =>
    f.name.toLowerCase().includes(search.toLowerCase()) ||
    f.location.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <main className="min-h-screen bg-[#0a0a0f] text-white">
      {/* Nav */}
      <div className="border-b border-white/5 px-8 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg gradient-brand flex items-center justify-center">
            <Trophy className="w-4 h-4 text-white" />
          </div>
          <span className="font-bold text-lg">FIELDLOCK</span>
        </div>
        <nav className="flex items-center gap-6 text-sm">
          <Link href="/dashboard" className="text-slate-400 hover:text-white transition-colors">Dashboard</Link>
          <Link href="/facilities" className="text-white font-medium">Facilities</Link>
          <Link href="/my-bookings" className="text-slate-400 hover:text-white transition-colors">My Bookings</Link>
        </nav>
      </div>

      <div className="max-w-7xl mx-auto px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-black mb-2">Browse Facilities</h1>
          <p className="text-slate-400">Select a date and facility to view available slots.</p>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-4 mb-8">
          {/* Search */}
          <div className="relative flex-1 min-w-[200px] max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search facilities..."
              className="w-full bg-[#13131a] border border-[#2a2a3a] rounded-xl pl-10 pr-4 py-3 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-purple-500/50 transition-all"
            />
          </div>

          {/* Date picker */}
          <input
            type="date"
            value={selectedDate}
            min={new Date().toISOString().split("T")[0]}
            onChange={(e) => setSelectedDate(e.target.value)}
            className="bg-[#13131a] border border-[#2a2a3a] rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-purple-500/50 transition-all"
          />

          {/* Type filter */}
          <div className="flex items-center gap-2 flex-wrap">
            <Filter className="w-4 h-4 text-slate-500" />
            {TYPES.map((t) => (
              <button
                key={t}
                onClick={() => setFilter(t)}
                className={cn(
                  "px-3 py-1.5 rounded-lg text-xs font-medium border transition-all",
                  filter === t
                    ? "gradient-brand border-transparent text-white"
                    : "border-[#2a2a3a] text-slate-400 hover:text-white hover:border-white/20"
                )}
              >
                {t === "ALL" ? "All" : `${getFacilityIcon(t)} ${t}`}
              </button>
            ))}
          </div>
        </div>

        {/* Facility grid */}
        {loading ? (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="card animate-pulse">
                <div className="h-4 bg-white/5 rounded mb-3 w-2/3" />
                <div className="h-3 bg-white/5 rounded mb-2 w-1/2" />
                <div className="h-3 bg-white/5 rounded w-3/4" />
              </div>
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-20 text-slate-500">
            <Search className="w-12 h-12 mx-auto mb-3 opacity-30" />
            <p className="text-lg">No facilities found.</p>
          </div>
        ) : (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filtered.map((facility) => {
              const availRatio = facility.availabilityToday.total > 0
                ? facility.availabilityToday.available / facility.availabilityToday.total
                : 0;
              const availColor =
                availRatio > 0.5 ? "text-emerald-400 bg-emerald-500/10 border-emerald-500/20" :
                availRatio > 0.2 ? "text-amber-400 bg-amber-500/10 border-amber-500/20" :
                "text-red-400 bg-red-500/10 border-red-500/20";

              return (
                <Link
                  key={facility.id}
                  href={`/facilities/${facility.id}?date=${selectedDate}`}
                  className="card hover:border-white/20 hover:scale-[1.02] transition-all cursor-pointer group"
                >
                  {/* Header */}
                  <div className="flex items-start justify-between mb-4">
                    <div className="text-3xl">{getFacilityIcon(facility.type)}</div>
                    <span className={cn("text-xs px-2 py-1 rounded-md border font-medium", availColor)}>
                      {facility.availabilityToday.available}/{facility.availabilityToday.total} slots
                    </span>
                  </div>

                  <h3 className="text-lg font-bold mb-1 group-hover:text-orange-400 transition-colors">
                    {facility.name}
                  </h3>

                  <div className="flex items-center gap-1 text-slate-500 text-sm mb-1">
                    <MapPin className="w-3 h-3" />
                    {facility.location}
                  </div>

                  <div className="flex items-center gap-1 text-slate-500 text-sm mb-4">
                    <Users className="w-3 h-3" />
                    Capacity: {facility.capacity}
                  </div>

                  {/* Availability bar */}
                  <div className="mb-4">
                    <div className="flex justify-between text-xs text-slate-500 mb-1">
                      <span>Availability</span>
                      <span>{Math.round(availRatio * 100)}%</span>
                    </div>
                    <div className="w-full h-1.5 bg-[#1a1a24] rounded-full">
                      <div
                        className={`h-1.5 rounded-full transition-all ${
                          availRatio > 0.5 ? "bg-emerald-500" :
                          availRatio > 0.2 ? "bg-amber-500" : "bg-red-500"
                        }`}
                        style={{ width: `${availRatio * 100}%` }}
                      />
                    </div>
                  </div>

                  {/* Quick slot preview */}
                  <div className="flex flex-wrap gap-1">
                    {facility.slotResources.slice(0, 4).map((slot) => (
                      <span
                        key={slot.id}
                        className={cn(
                          "text-xs px-2 py-0.5 rounded-md border font-mono",
                          slot.status === "AVAILABLE"
                            ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-400"
                            : "border-red-500/20 bg-red-500/5 text-red-400/50"
                        )}
                      >
                        {formatTime(slot.startTime)}
                      </span>
                    ))}
                    {facility.slotResources.length > 4 && (
                      <span className="text-xs text-slate-500 px-2 py-0.5">
                        +{facility.slotResources.length - 4} more
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-1 text-orange-400 text-sm font-medium mt-4 group-hover:gap-2 transition-all">
                    View slots <ArrowRight className="w-4 h-4" />
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </main>
  );
}
