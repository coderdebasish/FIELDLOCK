import { NextRequest } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/db";
import { apiError, apiSuccess, computeAllocationScore } from "@/lib/utils";

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return apiError("Unauthorized", 401);
    }

    const { slotResourceId, idempotencyKey } = await req.json();

    if (!slotResourceId || !idempotencyKey) {
      return apiError("slotResourceId and idempotencyKey are required", 400);
    }

    // Check idempotency
    const existing = await prisma.booking.findUnique({
      where: { idempotencyKey },
    });
    if (existing) {
      return apiSuccess({ status: "CONFIRMED", booking: existing });
    }

    // Run SERIALIZABLE transaction
    const result = await prisma.$transaction(
      async (tx) => {
        // Lock SlotResource row
        const slot = await tx.slotResource.findUnique({
          where: { id: slotResourceId },
          include: { facility: true },
        });

        if (!slot) throw new Error("SLOT_NOT_FOUND");

        if (slot.status === "AVAILABLE") {
          // Claim slot
          await tx.slotResource.update({
            where: { id: slotResourceId },
            data: { status: "BOOKED" },
          });

          // Fetch student
          const user = await tx.user.findUnique({
            where: { id: session.user.id },
          });

          const noShowProb = user
            ? user.totalBookings > 0
              ? (user.totalBookings - user.attendedCount) / user.totalBookings
              : 0.1
            : 0.1;

          // Create Booking
          const booking = await tx.booking.create({
            data: {
              slotResourceId,
              userId: session.user.id,
              status: "CONFIRMED",
              idempotencyKey,
              noShowProb,
            },
          });

          return { status: "CONFIRMED", booking };
        } else {
          // Slot already booked -> Join waitlist
          const user = await tx.user.findUnique({
            where: { id: session.user.id },
          });

          const rankScore = user
            ? computeAllocationScore({
                totalBookings: user.totalBookings,
                attendedCount: user.attendedCount,
                noShowCount: user.noShowCount,
                earlyCancel: 0,
                lateCancel: 0,
                waitlistHonored: 1,
                isNewUser: user.totalBookings === 0,
              })
            : 50;

          const waitlistItem = await tx.waitlist.create({
            data: {
              slotResourceId,
              userId: session.user.id,
              rankScore,
              status: "WAITING",
            },
          });

          const waitlistCount = await tx.waitlist.count({
            where: { slotResourceId, status: "WAITING" },
          });

          const alternatives = await tx.facility.findMany({
            where: {
              type: slot.facility.type,
              id: { not: slot.facilityId },
              isActive: true,
            },
            take: 3,
          });

          return {
            status: "CONFLICT",
            waitlistPosition: waitlistCount,
            waitlistId: waitlistItem.id,
            alternatives,
          };
        }
      },
      {
        isolationLevel: "Serializable",
      }
    );

    return apiSuccess(result);
  } catch (error) {
    if (error instanceof Error && error.message === "SLOT_NOT_FOUND") {
      return apiError("Slot not found", 404);
    }
    console.error("Booking transaction error:", error);
    return apiError("Booking transaction failed due to high concurrency. Please try again.", 409);
  }
}
