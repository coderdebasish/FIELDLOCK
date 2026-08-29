import { NextResponse } from "next/server";
import prisma from "@/lib/db";

export async function GET() {
  try {
    const userCount = await prisma.user.count();
    const facilityCount = await prisma.facility.count();
    const sampleUser = await prisma.user.findFirst({
      select: { email: true, role: true, rollNumber: true },
    });

    return NextResponse.json({
      status: "OK",
      database: "CONNECTED",
      userCount,
      facilityCount,
      sampleUser,
    });
  } catch (error) {
    return NextResponse.json(
      {
        status: "ERROR",
        database: "DISCONNECTED",
        error: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
