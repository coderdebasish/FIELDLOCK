"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Trophy, Zap, Play, RotateCcw, CheckCircle, AlertCircle, Database, Loader2, Shield } from "lucide-react";
import { cn } from "@/lib/utils";

interface DemoUser {
  id: string;
  name: string;
  rollNumber: string;
  allocationScore: number;
}

interface RaceResult {
  totalRequests: number;
  confirmed: number;
  conflicts: number;
  winner: DemoUser | null;
  summary: Array<{
    user: DemoUser;
    result: { status: string; waitlistPosition?: number; rankScore?: number };
  }>;
  dbState: {
    confirmedBookings: number;
    duplicates: number;
    waitlistEntries: number;
    topWaitlistStudent: DemoUser | null;
  };
}

interface Facility {
  id: string;
  name: string;
  type: string;
}

interface SlotResource {
  id: string;
  startTime: string;
  status: string;
}

export default function RaceDemoPage() {
  const [facilities, setFacilities] = useState<Facility[]>([]);
  const [selectedFacility, setSelectedFacility] = useState("");
  const [slots, setSlots] = useState<SlotResource[]>([]);
  const [selectedSlot, setSelectedSlot] = useState("");
  const [userCount, setUserCount] = useState(20);
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<RaceResult | null>(null);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    fetch("/api/facilities")
      .then((r) => r.json())
      .then((data) => {
        setFacilities(data);
        if (data.length > 0) setSelectedFacility(data[0].id);
      });
  }, []);

  useEffect(() => {
    if (!selectedFacility) return;
    const today = new Date();
    today.setDate(today.getDate() + 1);
    const date = today.toISOString().split("T")[0];
    fetch(`/api/facilities/${selectedFacility}/slots?date=${date}`)
      .then((r) => r.json())
      .then((data) => {
        setSlots(data.slots ?? []);
        const avail = (data.slots ?? []).find((s: SlotResource) => s.status === "AVAILABLE");
        if (avail) setSelectedSlot(avail.id);
      });
  }, [selectedFacility]);

  const fireRace = async () => {
    if (!selectedSlot) return;
    setRunning(true);
    setResult(null);
    setProgress(0);

    // Animate progress
    const interval = setInterval(() => {
      setProgress((p) => Math.min(p + 4, 90));
    }, 80);

    const res = await fetch("/api/race-demo/fire", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ slotResourceId: selectedSlot, userCount }),
    });

    clearInterval(interval);
    setProgress(100);

    const data = await res.json();
    setResult(data);
    setRunning(false);
  };

  const reset = () => {
    setResult(null);
    setProgress(0);
  };

  const confirmed = result?.summary.filter((s) => s.result.status === "CONFIRMED") ?? [];
  const conflicts = result?.summary.filter((s) => s.result.status === "CONFLICT") ?? [];

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
        <span className="text-slate-600 mx-2">›</span>
        <span className="text-slate-400 text-sm">Admin</span>
        <span className="text-slate-600 mx-2">›</span>
        <span className="text-white text-sm font-medium">Race Demo</span>
      </div>

      <div className="max-w-6xl mx-auto px-8 py-8">

        {/* Header */}
        <div className="text-center mb-10">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-orange-500/30 bg-orange-500/10 text-orange-300 text-sm mb-4">
            <Zap className="w-4 h-4" />
            Live Concurrency Demonstration
          </div>
          <h1 className="text-5xl font-black mb-3">
            The <span className="gradient-text">Booking Race</span>
          </h1>
          <p className="text-slate-400 text-lg max-w-2xl mx-auto">
            Fire multiple simultaneous requests at the same slot.
            Watch the database guarantee exactly one winner.
          </p>
        </div>

        {/* Architecture diagram */}
        <div className="card mb-8 text-center">
          <div className="flex items-center justify-center gap-2 md:gap-4 flex-wrap text-sm">
            <div className="flex flex-col items-center gap-1">
              <div className="flex gap-1">
                {[...Array(Math.min(userCount, 8))].map((_, i) => (
                  <div
                    key={i}
                    className={cn(
                      "w-6 h-6 rounded-full flex items-center justify-center text-xs border transition-all",
                      running
                        ? "border-orange-500/50 bg-orange-500/20 animate-pulse"
                        : result
                        ? i === 0
                          ? "border-emerald-500 bg-emerald-500/20"
                          : "border-amber-500/30 bg-amber-500/10"
                        : "border-white/20 bg-white/5"
                    )}
                  >
                    {i < 8 ? "👤" : ""}
                  </div>
                ))}
                {userCount > 8 && (
                  <div className="w-6 h-6 rounded-full border border-white/20 bg-white/5 flex items-center justify-center text-xs text-slate-500">
                    +{userCount - 8}
                  </div>
                )}
              </div>
              <span className="text-slate-500 text-xs">{userCount} Users</span>
            </div>

            <div className="text-slate-600 text-2xl hidden md:block">→→→</div>

            <div className="flex flex-col items-center gap-1">
              <div className={cn(
                "w-16 h-16 rounded-xl border flex items-center justify-center transition-all",
                running
                  ? "border-orange-500 bg-orange-500/20 glow-orange pulse-glow-orange"
                  : result
                  ? "border-emerald-500 bg-emerald-500/10"
                  : "border-purple-500/30 bg-purple-500/10"
              )}>
                <Shield className={cn("w-8 h-8", running ? "text-orange-400" : result ? "text-emerald-400" : "text-purple-400")} />
              </div>
              <span className="text-slate-500 text-xs">FIELDLOCK Engine</span>
            </div>

            <div className="text-slate-600 text-2xl hidden md:block">→→→</div>

            <div className="flex gap-4">
              <div className="flex flex-col items-center gap-1">
                <div className={cn(
                  "w-14 h-14 rounded-xl border flex items-center justify-center text-2xl transition-all",
                  result ? "border-emerald-500 bg-emerald-500/20 glow-emerald" : "border-white/10 bg-white/5"
                )}>
                  🏆
                </div>
                <span className={cn("text-xs font-bold", result ? "text-emerald-400" : "text-slate-500")}>
                  {result ? "1 WINNER" : "1 Winner"}
                </span>
              </div>
              <div className="flex flex-col items-center gap-1">
                <div className={cn(
                  "w-14 h-14 rounded-xl border flex items-center justify-center text-2xl transition-all",
                  result ? "border-amber-500/30 bg-amber-500/10" : "border-white/10 bg-white/5"
                )}>
                  ⚠️
                </div>
                <span className={cn("text-xs font-bold", result ? "text-amber-400" : "text-slate-500")}>
                  {result ? `${result.conflicts} Safe` : "N-1 Safe"}
                </span>
                <span className="text-xs text-slate-600">Conflicts</span>
              </div>
            </div>

            <div className="text-slate-600 text-2xl hidden md:block">→→→</div>

            <div className="flex flex-col items-center gap-1">
              <div className={cn(
                "w-16 h-16 rounded-xl border flex items-center justify-center transition-all",
                result ? "border-purple-500 bg-purple-500/20" : "border-white/10 bg-white/5"
              )}>
                <Database className={cn("w-8 h-8", result ? "text-purple-400" : "text-slate-600")} />
              </div>
              <span className="text-slate-500 text-xs">Smart Waitlist</span>
            </div>
          </div>
        </div>

        <div className="grid lg:grid-cols-3 gap-6">

          {/* Controls */}
          <div className="space-y-4">
            <div className="card">
              <h2 className="font-bold mb-4">Race Configuration</h2>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm text-slate-400 mb-2">Facility</label>
                  <select
                    value={selectedFacility}
                    onChange={(e) => setSelectedFacility(e.target.value)}
                    className="w-full bg-[#0a0a0f] border border-[#2a2a3a] rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-purple-500/50"
                  >
                    {facilities.map((f) => (
                      <option key={f.id} value={f.id}>{f.name}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm text-slate-400 mb-2">Target Slot</label>
                  <select
                    value={selectedSlot}
                    onChange={(e) => setSelectedSlot(e.target.value)}
                    className="w-full bg-[#0a0a0f] border border-[#2a2a3a] rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-purple-500/50"
                  >
                    {slots.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.startTime} — {s.status}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm text-slate-400 mb-2">
                    Concurrent Users: <span className="text-orange-400 font-bold">{userCount}</span>
                  </label>
                  <input
                    type="range"
                    min={5}
                    max={20}
                    value={userCount}
                    onChange={(e) => setUserCount(Number(e.target.value))}
                    className="w-full accent-orange-500"
                  />
                  <div className="flex justify-between text-xs text-slate-600 mt-1">
                    <span>5</span><span>20</span>
                  </div>
                </div>

                <div className="flex gap-2">
                  <button
                    onClick={fireRace}
                    disabled={running || !selectedSlot}
                    className={cn(
                      "flex-1 flex items-center justify-center gap-2 py-3 rounded-xl font-bold transition-all",
                      running
                        ? "bg-orange-500/20 border border-orange-500/30 text-orange-400 cursor-not-allowed"
                        : "gradient-brand text-white hover:opacity-90 hover:scale-[1.02] glow-orange"
                    )}
                  >
                    {running ? (
                      <><Loader2 className="w-4 h-4 animate-spin" />Racing...</>
                    ) : (
                      <><Play className="w-4 h-4" />Fire Race</>
                    )}
                  </button>

                  {result && (
                    <button
                      onClick={reset}
                      className="px-4 py-3 rounded-xl border border-white/10 text-slate-400 hover:text-white hover:border-white/20 transition-all"
                    >
                      <RotateCcw className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* Explanation */}
            <div className="card border-purple-500/20">
              <h3 className="font-semibold text-sm text-purple-400 mb-3">How it works</h3>
              <div className="space-y-2 text-xs text-slate-400">
                <div className="flex gap-2"><span className="text-purple-400">1.</span> All {userCount} requests fire simultaneously</div>
                <div className="flex gap-2"><span className="text-purple-400">2.</span> Each enters a SERIALIZABLE transaction</div>
                <div className="flex gap-2"><span className="text-purple-400">3.</span> SELECT FOR UPDATE locks the SlotResource row</div>
                <div className="flex gap-2"><span className="text-purple-400">4.</span> First transaction: AVAILABLE → BOOKED + Booking created</div>
                <div className="flex gap-2"><span className="text-purple-400">5.</span> All others: see BOOKED → CONFLICT → Waitlist</div>
                <div className="flex gap-2"><span className="text-orange-400 font-bold">✓</span> DB unique constraint = final backstop</div>
              </div>
            </div>
          </div>

          {/* Progress + Results */}
          <div className="lg:col-span-2 space-y-4">

            {/* Progress bar */}
            {running && (
              <div className="card">
                <div className="flex items-center justify-between mb-3">
                  <span className="font-medium text-orange-400">Race in progress...</span>
                  <span className="text-sm text-slate-400">{progress}%</span>
                </div>
                <div className="w-full h-2 bg-[#0a0a0f] rounded-full overflow-hidden">
                  <div
                    className="h-2 gradient-brand rounded-full transition-all duration-200"
                    style={{ width: `${progress}%` }}
                  />
                </div>
                <p className="text-xs text-slate-500 mt-2">
                  Firing {userCount} simultaneous SERIALIZABLE transactions...
                </p>
              </div>
            )}

            {/* DB State proof */}
            {result && (
              <div className="card border-emerald-500/20">
                <div className="flex items-center gap-2 mb-4">
                  <Database className="w-5 h-5 text-emerald-400" />
                  <h2 className="font-bold text-emerald-400">Database State — Proof of Correctness</h2>
                </div>
                <div className="grid grid-cols-3 gap-4">
                  <div className="text-center p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20">
                    <p className="text-3xl font-black text-emerald-400">{result.dbState.confirmedBookings}</p>
                    <p className="text-xs text-slate-400 mt-1">CONFIRMED bookings</p>
                  </div>
                  <div className="text-center p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20">
                    <p className="text-3xl font-black text-emerald-400">{result.dbState.duplicates}</p>
                    <p className="text-xs text-slate-400 mt-1">Duplicate bookings</p>
                  </div>
                  <div className="text-center p-4 rounded-xl bg-purple-500/10 border border-purple-500/20">
                    <p className="text-3xl font-black text-purple-400">{result.dbState.waitlistEntries}</p>
                    <p className="text-xs text-slate-400 mt-1">On smart waitlist</p>
                  </div>
                </div>
                {result.winner && (
                  <div className="mt-4 p-4 rounded-xl bg-amber-500/10 border border-amber-500/30">
                    <p className="text-xs text-slate-400 mb-1">🏆 Winner</p>
                    <p className="font-bold text-amber-400">{result.winner.name}</p>
                    <p className="text-xs text-slate-500">
                      Roll: {result.winner.rollNumber} · Allocation Score: {result.winner.allocationScore.toFixed(0)}
                    </p>
                  </div>
                )}
                {result.dbState.topWaitlistStudent && (
                  <div className="mt-3 p-3 rounded-xl bg-purple-500/10 border border-purple-500/20">
                    <p className="text-xs text-slate-400 mb-1">Next in waitlist (highest ranked)</p>
                    <p className="font-medium text-purple-400 text-sm">{result.dbState.topWaitlistStudent.name}</p>
                    <p className="text-xs text-slate-500">Will be notified if slot is released</p>
                  </div>
                )}
              </div>
            )}

            {/* Results stream */}
            {result && (
              <div className="card">
                <h2 className="font-bold mb-4">Request Results ({result.totalRequests} total)</h2>
                <div className="grid grid-cols-2 gap-3 max-h-80 overflow-y-auto pr-1">
                  {result.summary.map((item, i) => (
                    <div
                      key={i}
                      className={cn(
                        "p-3 rounded-xl border flex items-start gap-2 text-xs animate-in",
                        item.result.status === "CONFIRMED"
                          ? "border-emerald-500/40 bg-emerald-500/10"
                          : "border-amber-500/20 bg-amber-500/5"
                      )}
                      style={{ animationDelay: `${i * 20}ms` }}
                    >
                      {item.result.status === "CONFIRMED" ? (
                        <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                      ) : (
                        <AlertCircle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                      )}
                      <div>
                        <p className={cn("font-medium", item.result.status === "CONFIRMED" ? "text-emerald-400" : "text-slate-300")}>
                          {item.user.name.split(" ")[0]}
                        </p>
                        <p className="text-slate-500">
                          {item.result.status === "CONFIRMED"
                            ? "BOOKED ✓"
                            : `Waitlist #${item.result.waitlistPosition}`}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Empty state */}
            {!result && !running && (
              <div className="card text-center py-16 border-dashed border-white/10">
                <Play className="w-12 h-12 mx-auto mb-4 text-slate-600" />
                <p className="text-slate-500 text-lg mb-2">Race not started</p>
                <p className="text-slate-600 text-sm">Configure and click &quot;Fire Race&quot; to begin the demonstration.</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}
