// GET /api/facilities — list all active facilities with today's availability summary
// POST /api/facilities — create facility (admin only)

import { NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import prisma from "@/lib/db";
import { apiError, apiSuccess } from "@/lib/utils";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const type = searchParams.get("type");
  const date = searchParams.get("date") ?? new Date().toISOString().split("T")[0];

  const targetDate = new Date(date);
  targetDate.setHours(0, 0, 0, 0);
  const nextDay = new Date(targetDate);
  nextDay.setDate(nextDay.getDate() + 1);

  const facilities = await prisma.facility.findMany({
    where: {
      isActive: true,
      ...(type ? { type: type.toUpperCase() } : {}),
    },
    include: {
      slotResources: {
        where: {
          slotDate: { gte: targetDate, lt: nextDay },
        },
        select: {
          id: true,
          startTime: true,
          endTime: true,
          status: true,
          _count: { select: { waitlist: true } },
        },
        orderBy: { startTime: "asc" },
      },
    },
    orderBy: { name: "asc" },
  });

  // Compute availability summary per facility
  const result = facilities.map((f) => {
    const total = f.slotResources.length;
    const available = f.slotResources.filter((s) => s.status === "AVAILABLE").length;
    return {
      ...f,
      availabilityToday: { total, available, booked: total - available },
    };
  });

  return apiSuccess(result);
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user || session.user.role !== "ADMIN") {
    return apiError("Admin access required", 403);
  }

  const body = await req.json();
  const { name, type, capacity, location, description, openTime, closeTime, slotDuration } = body;

  if (!name || !type || !capacity || !location) {
    return apiError("name, type, capacity, location are required");
  }

  const facility = await prisma.facility.create({
    data: {
      name,
      type: type.toUpperCase(),
      capacity,
      location,
      description,
      openTime: openTime ?? "06:00",
      closeTime: closeTime ?? "22:00",
      slotDuration: slotDuration ?? 60,
    },
  });

  return apiSuccess(facility, 201);
}
