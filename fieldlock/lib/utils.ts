import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";
import { format, parseISO } from "date-fns";

// ── Tailwind class merging ────────────────────────────────────────────────────

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// ── Date / time helpers ───────────────────────────────────────────────────────

export function formatDate(date: Date | string): string {
  const d = typeof date === "string" ? parseISO(date) : date;
  return format(d, "dd MMM yyyy");
}

export function formatDateTime(date: Date | string): string {
  const d = typeof date === "string" ? parseISO(date) : date;
  return format(d, "dd MMM yyyy, hh:mm a");
}

export function formatTime(time: string): string {
  const [h, m] = time.split(":").map(Number);
  const period = h >= 12 ? "PM" : "AM";
  const hour = h % 12 || 12;
  return `${hour}:${m.toString().padStart(2, "0")} ${period}`;
}

export function todayISO(): string {
  return new Date().toISOString().split("T")[0];
}

export function generateSlotTimes(
  openTime: string,
  closeTime: string,
  durationMin: number
): Array<{ startTime: string; endTime: string }> {
  const slots: Array<{ startTime: string; endTime: string }> = [];
  const [openH, openM] = openTime.split(":").map(Number);
  const [closeH, closeM] = closeTime.split(":").map(Number);

  let currentMin = openH * 60 + openM;
  const endMin = closeH * 60 + closeM;

  while (currentMin + durationMin <= endMin) {
    const startH = Math.floor(currentMin / 60);
    const startM = currentMin % 60;
    const endH = Math.floor((currentMin + durationMin) / 60);
    const endMins = (currentMin + durationMin) % 60;

    slots.push({
      startTime: `${startH.toString().padStart(2, "0")}:${startM.toString().padStart(2, "0")}`,
      endTime: `${endH.toString().padStart(2, "0")}:${endMins.toString().padStart(2, "0")}`,
    });
    currentMin += durationMin;
  }

  return slots;
}

// ── Fair Allocation Engine ────────────────────────────────────────────────────

export interface AllocationFactors {
  totalBookings: number;
  attendedCount: number;
  noShowCount: number;
  earlyCancel: number;
  lateCancel: number;
  waitlistHonored: number;
  isNewUser: boolean; // < 30 days old
}

export function computeAllocationScore(factors: AllocationFactors): number {
  const {
    totalBookings,
    attendedCount,
    noShowCount,
    earlyCancel,
    lateCancel,
    waitlistHonored,
    isNewUser,
  } = factors;

  // Reliability: attendance / total (excluding cancels)
  const attended = totalBookings > 0 ? attendedCount / totalBookings : 0.7;

  // Usage balance: penalise heavy bookers slightly (normalised to 0-1)
  const usageBalance = Math.max(0, 1 - (totalBookings - 5) / 50);

  // Wait time factor: not computable here — handled at waitlist ranking time

  // Cancellation quality
  const cancelTotal = earlyCancel + lateCancel;
  const cancelQuality = cancelTotal > 0 ? earlyCancel / cancelTotal : 1;

  // No-show penalty
  const noShowPenalty = noShowCount * 0.05;

  // Waitlist honor rate
  const honor = waitlistHonored > 0 ? Math.min(1, waitlistHonored / 5) : 0.5;

  // New user bonus
  const newUserBonus = isNewUser ? 0.1 : 0;

  const raw =
    0.35 * attended +
    0.20 * usageBalance +
    0.15 * cancelQuality +
    0.15 * honor +
    0.05 * (1 - noShowPenalty) +
    0.10 * newUserBonus;

  return Math.min(100, Math.max(0, raw * 100));
}

// Waitlist rank at join time: score + recency bonus (newer waiters slightly penalised)
export function computeWaitlistRank(
  allocationScore: number,
  waitingSinceMs: number
): number {
  const waitHours = waitingSinceMs / (1000 * 60 * 60);
  const waitBonus = Math.min(10, waitHours * 0.5); // max +10 for waiting 20hr
  return Math.min(100, allocationScore + waitBonus);
}

// ── API helpers ───────────────────────────────────────────────────────────────

export function apiError(message: string, status = 400) {
  return Response.json({ error: message }, { status });
}

export function apiSuccess<T>(data: T, status = 200) {
  return Response.json(data, { status });
}

// ── Misc ─────────────────────────────────────────────────────────────────────

export function generateQRToken(): string {
  return `FL-${Date.now()}-${Math.random().toString(36).substring(2, 9).toUpperCase()}`;
}

export function getFacilityIcon(type: string): string {
  const icons: Record<string, string> = {
    BADMINTON: "🏸",
    TENNIS: "🎾",
    FOOTBALL: "⚽",
    CRICKET: "🏏",
    GYM: "🏋️",
  };
  return icons[type.toUpperCase()] ?? "🏟️";
}

export function getStatusColor(status: string): string {
  const colors: Record<string, string> = {
    AVAILABLE: "text-emerald-400",
    BOOKED: "text-red-400",
    BLOCKED: "text-gray-500",
    CONFIRMED: "text-emerald-400",
    CANCELLED: "text-red-400",
    COMPLETED: "text-blue-400",
    NO_SHOW: "text-orange-400",
    WAITING: "text-amber-400",
    PROMOTED: "text-emerald-400",
  };
  return colors[status] ?? "text-gray-400";
}
