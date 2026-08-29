// POST /api/race-demo/attempt
// Individual booking attempt called by the race demo
// This is the same logic as /api/bookings but accepts userId directly (demo mode)

import { NextRequest } from "next/server";
import prisma from "@/lib/db";
import { apiSuccess, computeWaitlistRank, generateQRToken } from "@/lib/utils";

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { slotResourceId, userId, userName, allocationScore, idempotencyKey } = body;

  try {
    const result = await prisma.$transaction(
      async (tx) => {
        // Lock the SlotResource row — same mechanism as production booking
        const slots = await tx.$queryRaw<Array<{ id: string; status: string }>>`
          SELECT id, status FROM slot_resources
          WHERE id = ${slotResourceId}
          FOR UPDATE
        `;

        if (slots.length === 0) throw new Error("NOT_FOUND");

        const slot = slots[0];

        if (slot.status !== "AVAILABLE") {
          // Add to waitlist
          const rankScore = computeWaitlistRank(allocationScore ?? 70, 0);
          await tx.waitlist.upsert({
            where: { slotResourceId_userId: { slotResourceId, userId } },
            create: { slotResourceId, userId, rankScore },
            update: { rankScore },
          });

          const position = await tx.waitlist.count({
            where: {
              slotResourceId,
              rankScore: { gt: rankScore },
              status: "WAITING",
            },
          });

          return {
            status: "CONFLICT" as const,
            userName,
            waitlistPosition: position + 1,
            rankScore,
          };
        }

        // Claim it
        await tx.slotResource.update({
          where: { id: slotResourceId },
          data: { status: "BOOKED" },
        });

        await tx.booking.create({
          data: {
            slotResourceId,
            userId,
            status: "CONFIRMED",
            idempotencyKey,
            qrToken: generateQRToken(),
          },
        });

        return { status: "CONFIRMED" as const, userName };
      },
      { isolationLevel: "Serializable", timeout: 15000 }
    );

    await prisma.bookingRequest.upsert({
      where: { idempotencyKey },
      create: {
        idempotencyKey,
        userId,
        slotResourceId,
        resultStatus: result.status,
      },
      update: { resultStatus: result.status },
    });

    return apiSuccess(result, result.status === "CONFIRMED" ? 201 : 409);
  } catch (e: unknown) {
    const error = e as { code?: string };
    if (error.code === "P2002") {
      return apiSuccess({ status: "CONFLICT", userName, reason: "DB_CONSTRAINT" }, 409);
    }
    return apiSuccess({ status: "ERROR", userName }, 500);
  }
}
