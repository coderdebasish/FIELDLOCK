import { NextRequest } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/db";
import { apiError, apiSuccess, computeAllocationScore } from "@/lib/utils";

export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) return apiError("Unauthorized", 401);

    const bookingId = params.id;

    const booking = await prisma.booking.findUnique({
      where: { id: bookingId },
      include: { slotResource: true },
    });

    if (!booking) return apiError("Booking not found", 404);
    if (booking.userId !== session.user.id && session.user.role !== "ADMIN") {
      return apiError("Forbidden", 403);
    }

    await prisma.$transaction(async (tx) => {
      // 1. Mark booking CANCELLED
      await tx.booking.update({
        where: { id: bookingId },
        data: { status: "CANCELLED" },
      });

      // 2. Check waitlist
      const nextInLine = await tx.waitlist.findFirst({
        where: { slotResourceId: booking.slotResourceId, status: "WAITING" },
        orderBy: { rankScore: "desc" },
      });

      if (nextInLine) {
        // Promote waitlisted student
        await tx.waitlist.update({
          where: { id: nextInLine.id },
          data: { status: "PROMOTED", notifiedAt: new Date() },
        });

        await tx.booking.create({
          data: {
            slotResourceId: booking.slotResourceId,
            userId: nextInLine.userId,
            status: "CONFIRMED",
            idempotencyKey: `auto-promote-${nextInLine.id}`,
          },
        });
      } else {
        // Release slot back to AVAILABLE
        await tx.slotResource.update({
          where: { id: booking.slotResourceId },
          data: { status: "AVAILABLE" },
        });
      }

      // Recompute allocation score reward
      const user = await tx.user.findUnique({ where: { id: session.user.id } });
      if (user) {
        const newScore = computeAllocationScore({
          attendanceRate: user.totalBookings > 0 ? user.attendedCount / user.totalBookings : 1.0,
          totalBookingsThisMonth: user.totalBookings,
          cancellationsInAdvance: 1,
          waitlistHonoredCount: 0,
          isNewUser: false,
        });

        await tx.user.update({
          where: { id: session.user.id },
          data: { allocationScore: newScore },
        });
      }
    });

    return apiSuccess({ message: "Booking cancelled and slot released" });
  } catch (error) {
    console.error("Cancel booking error:", error);
    return apiError("Failed to cancel booking", 500);
  }
}
