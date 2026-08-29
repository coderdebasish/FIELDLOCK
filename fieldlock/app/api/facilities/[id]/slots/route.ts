// GET /api/facilities/[id]/slots?date=YYYY-MM-DD
// Returns all slot resources for a facility on a given date
// including waitlist count and demand prediction

import { NextRequest } from "next/server";
import prisma from "@/lib/db";
import { apiError, apiSuccess } from "@/lib/utils";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const { searchParams } = new URL(req.url);
  const dateStr = searchParams.get("date") ?? new Date().toISOString().split("T")[0];

  const targetDate = new Date(dateStr);
  targetDate.setHours(0, 0, 0, 0);
  const nextDay = new Date(targetDate);
  nextDay.setDate(nextDay.getDate() + 1);

  const facility = await prisma.facility.findUnique({ where: { id } });
  if (!facility) return apiError("Facility not found", 404);

  const slots = await prisma.slotResource.findMany({
    where: {
      facilityId: id,
      slotDate: { gte: targetDate, lt: nextDay },
    },
    include: {
      _count: { select: { waitlist: true } },
      booking: {
        select: {
          status: true,
          user: { select: { name: true, rollNumber: true } },
        },
      },
    },
    orderBy: { startTime: "asc" },
  });

  // Fetch demand predictions for this day
  const predictions = await prisma.demandPrediction.findMany({
    where: {
      facilityId: id,
      predictedDate: { gte: targetDate, lt: nextDay },
    },
  });

  const predictionMap = new Map(
    predictions.map((p) => [p.hour, p])
  );

  // Annotate slots with demand info
  const annotated = slots.map((slot) => {
    const [h] = slot.startTime.split(":").map(Number);
    const prediction = predictionMap.get(h);
    return {
      ...slot,
      demand: prediction
        ? {
            ratio: prediction.capacityRatio,
            level:
              prediction.capacityRatio > 1.5
                ? "HIGH"
                : prediction.capacityRatio > 0.8
                ? "MEDIUM"
                : "LOW",
            recommendation: prediction.recommendation,
          }
        : null,
    };
  });

  return apiSuccess({ facility, slots: annotated });
}
