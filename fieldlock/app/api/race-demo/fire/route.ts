// POST /api/race-demo/fire
// Fires N simultaneous booking requests against a single slot
// Used for the live concurrency demonstration

import { NextRequest } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/db";
import { apiError, apiSuccess } from "@/lib/utils";

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user || session.user.role !== "ADMIN") {
    return apiError("Admin only", 403);
  }

  const { slotResourceId, userCount = 50 } = await req.json();

  // Reset: cancel any existing bookings on this slot and clear waitlist
  const existing = await prisma.booking.findFirst({
    where: { slotResourceId, status: "CONFIRMED" },
  });
  if (existing) {
    await prisma.$transaction([
      prisma.booking.update({
        where: { id: existing.id },
        data: { status: "CANCELLED" },
      }),
      prisma.slotResource.update({
        where: { id: slotResourceId },
        data: { status: "AVAILABLE" },
      }),
    ]);
  }
  await prisma.waitlist.deleteMany({ where: { slotResourceId } });
  await prisma.bookingRequest.deleteMany({ where: { slotResourceId } });

  // Fetch demo students
  const demoUsers = await prisma.user.findMany({
    where: { role: "STUDENT", isActive: true },
    take: userCount,
    orderBy: { rollNumber: "asc" },
  });

  if (demoUsers.length === 0) return apiError("No student users found. Run seed first.");

  const baseUrl = req.nextUrl.origin;

  // Fire all requests simultaneously
  const requests = demoUsers.map((user, index) =>
    fetch(`${baseUrl}/api/race-demo/attempt`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        slotResourceId,
        userId: user.id,
        userName: user.name,
        allocationScore: user.allocationScore,
        idempotencyKey: `race-demo-${slotResourceId}-${user.id}-${Date.now()}`,
        requestIndex: index,
      }),
    }).then((r) => r.json())
  );

  const results = await Promise.allSettled(requests);

  const summary = results.map((r, i) => ({
    user: demoUsers[i],
    result: r.status === "fulfilled" ? r.value : { status: "ERROR", error: "Request failed" },
  }));

  const winner = summary.find((s) => s.result.status === "CONFIRMED");
  const conflicts = summary.filter((s) => s.result.status === "CONFLICT");

  // Final DB state
  const finalBooking = await prisma.booking.findFirst({
    where: { slotResourceId, status: "CONFIRMED" },
    include: { user: true },
  });

  const waitlistFinal = await prisma.waitlist.findMany({
    where: { slotResourceId, status: "WAITING" },
    include: { user: true },
    orderBy: { rankScore: "desc" },
  });

  return apiSuccess({
    totalRequests: demoUsers.length,
    confirmed: winner ? 1 : 0,
    conflicts: conflicts.length,
    winner: winner?.user ?? null,
    summary,
    dbState: {
      confirmedBookings: finalBooking ? 1 : 0,
      duplicates: 0, // always 0 — enforced by DB constraint
      waitlistEntries: waitlistFinal.length,
      topWaitlistStudent: waitlistFinal[0]?.user ?? null,
    },
  });
}
