// POST /api/bookings
// THE CRITICAL CONCURRENCY-CORRECT BOOKING ENDPOINT
//
// Strategy:
//   1. Idempotency check (safe retries)
//   2. SERIALIZABLE transaction
//   3. SELECT FOR UPDATE on SlotResource row (row-level lock)
//      — row ALWAYS exists, so lock always has a target
//   4. Status check inside the lock
//   5. Atomic update + booking creation
//   6. DB unique constraint on Booking.slotResourceId = final backstop
//   7. Conflict → waitlist + alternatives

import { NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import prisma from "@/lib/db";
import { apiError, apiSuccess, computeWaitlistRank, generateQRToken } from "@/lib/utils";

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return apiError("Unauthorized", 401);

  const body = await req.json();
  const { slotResourceId, idempotencyKey } = body;

  if (!slotResourceId || !idempotencyKey) {
    return apiError("slotResourceId and idempotencyKey are required");
  }

  const userId = session.user.id;

  // ── Step 1: Idempotency check ──────────────────────────────────────────────
  // If the same request was already processed, return the cached result
  const cached = await prisma.bookingRequest.findUnique({
    where: { idempotencyKey },
  });
  if (cached) {
    if (cached.resultStatus === "CONFIRMED" && cached.resultBookingId) {
      const booking = await prisma.booking.findUnique({
        where: { id: cached.resultBookingId },
        include: { slotResource: { include: { facility: true } }, user: true },
      });
      return apiSuccess({ status: "CONFIRMED", booking, cached: true });
    }
    return apiSuccess({ status: "CONFLICT", cached: true }, 409);
  }

  try {
    const result = await prisma.$transaction(
      async (tx) => {
        // ── Step 2: Lock the SlotResource row ─────────────────────────────────
        // SELECT FOR UPDATE acquires a row-level lock.
        // All concurrent transactions serialise here — only one proceeds at a time.
        // The row ALWAYS EXISTS (pre-seeded), so the lock is always valid.
        const slots = await tx.$queryRaw<
          Array<{ id: string; status: string; facility_id: string; start_time: string; end_time: string; slot_date: Date }>
        >`
          SELECT id, status, facility_id, start_time, end_time, slot_date
          FROM slot_resources
          WHERE id = ${slotResourceId}
          FOR UPDATE
        `;

        if (slots.length === 0) {
          throw new Error("SLOT_NOT_FOUND");
        }

        const slot = slots[0];

        // ── Step 3: Status check inside the lock ──────────────────────────────
        if (slot.status !== "AVAILABLE") {
          // Slot is taken — add to ranked waitlist
          const rankScore = computeWaitlistRank(
            session.user.allocationScore ?? 70,
            0 // wait time = 0 at join
          );

          await tx.waitlist.upsert({
            where: {
              slotResourceId_userId: { slotResourceId, userId },
            },
            create: { slotResourceId, userId, rankScore },
            update: { rankScore },
          });

          // Count position
          const position = await tx.waitlist.count({
            where: {
              slotResourceId,
              rankScore: { gt: rankScore },
              status: "WAITING",
            },
          });

          // Find alternative slots (same facility type, same day, nearby time)
          const slotDetails = await tx.slotResource.findUnique({
            where: { id: slotResourceId },
            include: { facility: true },
          });

          const alternatives = slotDetails
            ? await tx.slotResource.findMany({
                where: {
                  status: "AVAILABLE",
                  slotDate: slotDetails.slotDate,
                  facility: { type: slotDetails.facility.type },
                  id: { not: slotResourceId },
                },
                include: { facility: true },
                take: 3,
              })
            : [];

          return {
            status: "CONFLICT" as const,
            waitlistPosition: position + 1,
            rankScore,
            alternatives,
          };
        }

        // ── Step 4: Claim the slot atomically ─────────────────────────────────
        await tx.slotResource.update({
          where: { id: slotResourceId },
          data: { status: "BOOKED" },
        });

        const qrToken = generateQRToken();

        const booking = await tx.booking.create({
          data: {
            slotResourceId,
            userId,
            status: "CONFIRMED",
            idempotencyKey,
            qrToken,
            noShowProb: 0.15, // default; overridden by ML pre-computation
          },
          include: {
            slotResource: { include: { facility: true } },
            user: true,
          },
        });

        return { status: "CONFIRMED" as const, booking };
      },
      {
        isolationLevel: "Serializable",
        timeout: 10000,
      }
    );

    // ── Step 5: Record idempotency result ──────────────────────────────────────
    await prisma.bookingRequest.create({
      data: {
        idempotencyKey,
        userId,
        slotResourceId,
        resultStatus: result.status,
        resultBookingId:
          result.status === "CONFIRMED" ? result.booking.id : undefined,
      },
    });

    if (result.status === "CONFIRMED") {
      return apiSuccess(result, 201);
    } else {
      return apiSuccess(result, 409);
    }
  } catch (e: unknown) {
    const error = e as { code?: string; message?: string };
    
    // DB unique constraint fired — race caught at database level (final backstop)
    if (error.code === "P2002") {
      return apiError("Slot already booked — unique constraint enforced", 409);
    }
    if (error.message === "SLOT_NOT_FOUND") {
      return apiError("Slot not found", 404);
    }

    console.error("[POST /api/bookings]", e);
    return apiError("Booking failed. Please try again.", 500);
  }
}

// GET /api/bookings — current user's bookings
export async function GET() {
  const session = await auth();
  if (!session?.user) return apiError("Unauthorized", 401);

  const bookings = await prisma.booking.findMany({
    where: { userId: session.user.id },
    include: {
      slotResource: { include: { facility: true } },
    },
    orderBy: [
      { slotResource: { slotDate: "desc" } },
      { createdAt: "desc" },
    ],
  });

  return apiSuccess(bookings);
}
