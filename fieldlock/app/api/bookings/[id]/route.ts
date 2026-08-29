// DELETE /api/bookings/[id] — Cancel a booking
// Releases the slot and triggers smart waitlist cascade

import { NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import prisma from "@/lib/db";
import { apiError, apiSuccess } from "@/lib/utils";

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user) return apiError("Unauthorized", 401);

  const { id } = await params;

  const booking = await prisma.booking.findUnique({
    where: { id },
    include: { slotResource: true },
  });

  if (!booking) return apiError("Booking not found", 404);
  if (booking.userId !== session.user.id && session.user.role !== "ADMIN") {
    return apiError("Forbidden", 403);
  }
  if (booking.status !== "CONFIRMED") {
    return apiError("Only confirmed bookings can be cancelled");
  }

  // Cancel booking + release slot atomically
  await prisma.$transaction([
    prisma.booking.update({
      where: { id },
      data: {
        status: "CANCELLED",
        cancelledAt: new Date(),
      },
    }),
    prisma.slotResource.update({
      where: { id: booking.slotResourceId },
      data: { status: "AVAILABLE" },
    }),
  ]);

  // Trigger waitlist cascade — promote top-ranked waiting student
  await promoteFromWaitlist(booking.slotResourceId);

  // Allocation score penalty (late cancel vs early cancel)
  const slotDateTime = new Date(booking.slotResource.slotDate);
  const [h, m] = booking.slotResource.startTime.split(":").map(Number);
  slotDateTime.setHours(h, m, 0, 0);
  const hoursUntilSlot = (slotDateTime.getTime() - Date.now()) / (1000 * 60 * 60);

  const isEarlyCancel = hoursUntilSlot > 4;
  await prisma.allocationEvent.create({
    data: {
      userId: booking.userId,
      eventType: isEarlyCancel ? "EARLY_CANCEL" : "LATE_CANCEL",
      delta: isEarlyCancel ? -2 : -8,
      reason: isEarlyCancel
        ? `Cancelled ${Math.round(hoursUntilSlot)}h before slot — early notice appreciated`
        : `Cancelled only ${Math.round(hoursUntilSlot * 60)}min before slot — last-minute cancellation`,
      bookingId: id,
    },
  });

  // Recompute allocation score
  await recomputeScore(booking.userId);

  return apiSuccess({ message: "Booking cancelled. Slot released to waitlist." });
}

// GET /api/bookings/[id] — single booking detail
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user) return apiError("Unauthorized", 401);

  const { id } = await params;

  const booking = await prisma.booking.findUnique({
    where: { id },
    include: {
      slotResource: { include: { facility: true } },
      user: { select: { id: true, name: true, rollNumber: true, allocationScore: true } },
    },
  });

  if (!booking) return apiError("Not found", 404);
  if (booking.userId !== session.user.id && session.user.role !== "ADMIN") {
    return apiError("Forbidden", 403);
  }

  return apiSuccess(booking);
}

// ── Helpers ───────────────────────────────────────────────────────────────────

async function promoteFromWaitlist(slotResourceId: string) {
  // Find top-ranked WAITING entry for this slot
  const top = await prisma.waitlist.findFirst({
    where: { slotResourceId, status: "WAITING" },
    orderBy: { rankScore: "desc" },
    include: { user: true },
  });

  if (!top) return; // no one waiting

  const responseDeadline = new Date(Date.now() + 15 * 60 * 1000); // 15 min

  await prisma.waitlist.update({
    where: { id: top.id },
    data: {
      status: "PROMOTED",
      notifiedAt: new Date(),
      responseDeadline,
      promotedAt: new Date(),
    },
  });

  // In production: send push/email notification here
  console.log(
    `[Waitlist] Promoted ${top.user.name} (score: ${top.rankScore}) for slot ${slotResourceId}. Deadline: ${responseDeadline.toISOString()}`
  );
}

async function recomputeScore(userId: string) {
  const events = await prisma.allocationEvent.findMany({
    where: {
      userId,
      createdAt: { gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) }, // last 30 days
    },
  });

  const baseScore = 70;
  const delta = events.reduce((sum, e) => sum + e.delta, 0);
  const newScore = Math.min(100, Math.max(0, baseScore + delta));

  await prisma.user.update({
    where: { id: userId },
    data: { allocationScore: newScore },
  });
}
