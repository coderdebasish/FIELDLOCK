import { NextRequest } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/db";
import { apiError, apiSuccess } from "@/lib/utils";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const type = searchParams.get("type");
    const dateStr = searchParams.get("date") ?? new Date().toISOString().split("T")[0];
    const targetDate = new Date(dateStr);

    const where: { isActive: boolean; type?: string } = { isActive: true };
    if (type && type !== "ALL") where.type = type;

    const facilities = await prisma.facility.findMany({
      where,
      include: {
        slotResources: {
          where: { slotDate: targetDate },
          orderBy: { startTime: "asc" },
          take: 10,
          select: {
            id: true,
            startTime: true,
            endTime: true,
            status: true,
            _count: { select: { waitlist: true } },
          },
        },
      },
    });

    const enriched = await Promise.all(
      facilities.map(async (fac) => {
        const total = await prisma.slotResource.count({
          where: { facilityId: fac.id, slotDate: targetDate },
        });
        const available = await prisma.slotResource.count({
          where: { facilityId: fac.id, slotDate: targetDate, status: "AVAILABLE" },
        });
        const booked = await prisma.slotResource.count({
          where: { facilityId: fac.id, slotDate: targetDate, status: "BOOKED" },
        });

        return {
          ...fac,
          availabilityToday: { total, available, booked },
        };
      })
    );

    return apiSuccess(enriched);
  } catch (error) {
    console.error("Facilities fetch error:", error);
    return apiError("Failed to fetch facilities", 500);
  }
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (session?.user?.role !== "ADMIN") {
    return apiError("Unauthorized", 403);
  }

  const body = await req.json();
  const { name, type, capacity, location, description, openTime, closeTime, slotDuration } = body;

  const facility = await prisma.facility.create({
    data: { name, type, capacity, location, description, openTime, closeTime, slotDuration },
  });

  return apiSuccess(facility, 201);
}
