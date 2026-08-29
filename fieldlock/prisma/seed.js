// prisma/seed.js
const { PrismaClient, Role, SlotStatus, BookingStatus } = require("@prisma/client");
const bcrypt = require("bcryptjs");

const prisma = new PrismaClient();

const FACILITIES = [
  {
    name: "Badminton Court A",
    type: "BADMINTON",
    capacity: 4,
    location: "Sports Complex, Block A",
    description: "Indoor synthetic court with professional lighting",
    openTime: "06:00",
    closeTime: "22:00",
    slotDuration: 60,
  },
  {
    name: "Badminton Court B",
    type: "BADMINTON",
    capacity: 4,
    location: "Sports Complex, Block B",
    description: "Indoor court — alternate option for peak hours",
    openTime: "08:00",
    closeTime: "21:00",
    slotDuration: 60,
  },
  {
    name: "Tennis Court",
    type: "TENNIS",
    capacity: 4,
    location: "Open Air Courts, Zone C",
    description: "All-weather synthetic surface",
    openTime: "06:00",
    closeTime: "20:00",
    slotDuration: 60,
  },
  {
    name: "Football Field",
    type: "FOOTBALL",
    capacity: 22,
    location: "Main Sports Ground",
    description: "Natural turf full-size football pitch",
    openTime: "06:00",
    closeTime: "19:00",
    slotDuration: 90,
  },
  {
    name: "Gymnasium",
    type: "GYM",
    capacity: 30,
    location: "Sports Complex, Ground Floor",
    description: "Fully equipped gym with cardio and weight training",
    openTime: "05:30",
    closeTime: "22:00",
    slotDuration: 60,
  },
];

const STUDENTS = [
  { name: "Arjun Sharma", rollNumber: "220101001", score: 92 },
  { name: "Priya Patel", rollNumber: "220101002", score: 85 },
  { name: "Rahul Gupta", rollNumber: "220101003", score: 78 },
  { name: "Sneha Singh", rollNumber: "220101004", score: 71 },
  { name: "Vikram Nair", rollNumber: "220101005", score: 65 },
  { name: "Anjali Mehta", rollNumber: "220101006", score: 88 },
  { name: "Rohan Das", rollNumber: "220101007", score: 55 },
  { name: "Kavya Reddy", rollNumber: "220101008", score: 47 },
  { name: "Aditya Kumar", rollNumber: "220101009", score: 90 },
  { name: "Divya Joshi", rollNumber: "220101010", score: 33 },
  { name: "Nikhil Verma", rollNumber: "220101011", score: 76 },
  { name: "Ishita Roy", rollNumber: "220101012", score: 82 },
  { name: "Siddharth Rao", rollNumber: "220101013", score: 60 },
  { name: "Meera Iyer", rollNumber: "220101014", score: 95 },
  { name: "Tanvir Ahmed", rollNumber: "220101015", score: 42 },
  { name: "Pooja Nambiar", rollNumber: "220101016", score: 69 },
  { name: "Karan Malhotra", rollNumber: "220101017", score: 87 },
  { name: "Shreya Bose", rollNumber: "220101018", score: 73 },
  { name: "Ravi Pillai", rollNumber: "220101019", score: 58 },
  { name: "Nandini Goel", rollNumber: "220101020", score: 80 },
];

function generateSlotTimes(openTime, closeTime, durationMin) {
  const slots = [];
  const [openH, openM] = openTime.split(":").map(Number);
  const [closeH, closeM] = closeTime.split(":").map(Number);
  let currentMin = openH * 60 + openM;
  const endMin = closeH * 60 + closeM;

  while (currentMin + durationMin <= endMin) {
    const startH = Math.floor(currentMin / 60);
    const startM = currentMin % 60;
    const endH = Math.floor((currentMin + durationMin) / 60);
    const endMins = (currentMin + durationMin) % 60;

    slots.push({
      startTime: `${startH.toString().padStart(2, "0")}:${startM.toString().padStart(2, "0")}`,
      endTime: `${endH.toString().padStart(2, "0")}:${endMins.toString().padStart(2, "0")}`,
    });
    currentMin += durationMin;
  }
  return slots;
}

function getDaysFromToday(offset) {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  d.setHours(0, 0, 0, 0);
  return d;
}

async function main() {
  console.log("🌱 Seeding FIELDLOCK database on Supabase...");

  await prisma.waitlist.deleteMany();
  await prisma.booking.deleteMany();
  await prisma.bookingRequest.deleteMany();
  await prisma.slotResource.deleteMany();
  await prisma.allocationEvent.deleteMany();
  await prisma.demandPrediction.deleteMany();
  await prisma.maintenanceWindow.deleteMany();
  await prisma.facility.deleteMany();
  await prisma.user.deleteMany();

  const adminPassword = await bcrypt.hash("admin123", 12);
  const admin = await prisma.user.create({
    data: {
      rollNumber: "ADMIN001",
      name: "Sports Admin",
      email: "admin@iitg.ac.in",
      password: adminPassword,
      role: Role.ADMIN,
      allocationScore: 100,
    },
  });
  console.log(`✅ Admin created: ${admin.email}`);

  const studentPassword = await bcrypt.hash("pass123", 12);
  const students = await Promise.all(
    STUDENTS.map((s) =>
      prisma.user.create({
        data: {
          rollNumber: s.rollNumber,
          name: s.name,
          email: `${s.rollNumber.toLowerCase()}@iitg.ac.in`,
          password: studentPassword,
          role: Role.STUDENT,
          allocationScore: s.score,
          totalBookings: Math.floor(Math.random() * 20) + 5,
          attendedCount: Math.floor(s.score / 10),
        },
      })
    )
  );
  console.log(`✅ ${students.length} students created`);

  const facilities = await Promise.all(
    FACILITIES.map((f) => prisma.facility.create({ data: f }))
  );
  console.log(`✅ ${facilities.length} facilities created`);

  let slotCount = 0;
  const createdSlots = [];

  for (const facility of facilities) {
    const times = generateSlotTimes(facility.openTime, facility.closeTime, facility.slotDuration);

    for (let dayOffset = -2; dayOffset <= 5; dayOffset++) {
      const slotDate = getDaysFromToday(dayOffset);

      for (const { startTime, endTime } of times) {
        const slot = await prisma.slotResource.create({
          data: {
            facilityId: facility.id,
            slotDate,
            startTime,
            endTime,
            status: SlotStatus.AVAILABLE,
          },
        });
        createdSlots.push({ id: slot.id, facilityId: facility.id, slotDate, startTime });
        slotCount++;
      }
    }
  }
  console.log(`✅ ${slotCount} slot resources created`);

  // Seed historical bookings
  const pastSlots = createdSlots.filter((s) => s.slotDate < new Date());
  let bookingCount = 0;

  for (const slot of pastSlots) {
    if (Math.random() > 0.5) {
      const user = students[Math.floor(Math.random() * students.length)];
      const statuses = [BookingStatus.COMPLETED, BookingStatus.COMPLETED, BookingStatus.NO_SHOW, BookingStatus.CANCELLED];
      const status = statuses[Math.floor(Math.random() * statuses.length)];

      await prisma.slotResource.update({
        where: { id: slot.id },
        data: { status: status === BookingStatus.CANCELLED ? SlotStatus.AVAILABLE : SlotStatus.BOOKED },
      });

      await prisma.booking.create({
        data: {
          slotResourceId: slot.id,
          userId: user.id,
          status,
          idempotencyKey: `seed-${slot.id}-${user.id}`,
          checkedIn: status === BookingStatus.COMPLETED,
          noShowProb: Math.random() * 0.3,
        },
      });
      bookingCount++;
    }
  }
  console.log(`✅ ${bookingCount} historical bookings seeded`);

  // Demand predictions
  for (const facility of facilities) {
    for (let dayOffset = 0; dayOffset <= 5; dayOffset++) {
      const predictedDate = getDaysFromToday(dayOffset);
      const peakHours = [8, 9, 17, 18, 19, 20];

      for (let hour = 6; hour < 22; hour++) {
        const isPeak = peakHours.includes(hour);
        const demand = isPeak ? facility.capacity * (1.5 + Math.random() * 1.5) : facility.capacity * (0.2 + Math.random() * 0.6);
        const ratio = demand / facility.capacity;

        let recommendation = null;
        if (ratio > 2.0) {
          recommendation = `Demand predicted at ${ratio.toFixed(1)}× capacity for ${facility.name} at ${hour}:00. Suggested action: Open alternate facility or extend waitlist capacity.`;
        }

        await prisma.demandPrediction.create({
          data: {
            facilityId: facility.id,
            predictedDate,
            hour,
            predictedDemand: Math.round(demand * 10) / 10,
            capacityRatio: Math.round(ratio * 100) / 100,
            recommendation,
          },
        });
      }
    }
  }
  console.log("✅ Demand predictions seeded");
  console.log("\n🎉 Database Seed Successful!");
}

main()
  .catch((e) => {
    console.error("❌ Seed error:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
