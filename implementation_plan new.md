# FIELDLOCK — PLAYHACK Implementation Plan
### Submit today · Iterate via GitHub → Vercel auto-deploy

---

## Project Identity

**Name:** FIELDLOCK
**Tagline:** *"One platform. Zero clashes."*
**Positioning:** **Intelligent Sports Resource Management** — not a booking app.

```
             FIELDLOCK
                 │
       ┌─────────┴─────────┐
       │                   │
  STUDENT SIDE        ADMIN SIDE
       │                   │
Smart Booking       Sports Intelligence
       │                   │
Fair Allocation     Demand Prediction
       │                   │
Smart Waitlist      Utilization Analytics
       │                   │
Check-in            Operational Actions
       └─────────┬─────────┘
                 │
       Reliable Booking Core
       Atomic · Consistent
       Concurrent-safe
```

The booking is the **foundation**. The intelligence sits **above** it.

---

## Tech Stack

| Layer | Choice | Reason |
|-------|--------|--------|
| Framework | **Next.js 14 (App Router)** | Already installed, Vercel-native, SSR + API routes in one |
| Database | **PostgreSQL via Supabase** | Free tier (500MB), managed Postgres, easy dashboard |
| ORM | **Prisma** | Type-safe, schema-first, easy migrations |
| Auth | **NextAuth.js** | Fast setup, credentials provider (roll number + password) |
| Styling | **Tailwind CSS** | Fast UI development |
| Realtime | **Server-Sent Events (SSE)** | No extra infra, built into Next.js, good enough for race demo |
| Background jobs | **Vercel Cron Jobs** | Free, no Redis needed for demo |
| Deployment | **Vercel** | Free, auto-deploy on every GitHub push |
| Predictive Layer | **Python → pre-computed JSON → DB** | No ML server needed; offline computation, stored as predictions |

---

## Supabase Setup (Free PostgreSQL)
1. Go to [supabase.com](https://supabase.com) → New Project (pick any region)
2. Go to **Settings → Database → Connection String → URI**
3. Copy the **direct connection** string (NOT the pooler — Prisma needs direct)
4. It looks like: `postgresql://postgres:[PASSWORD]@db.xxxx.supabase.co:5432/postgres`
5. Paste as `DATABASE_URL` in your `.env` file and Vercel Environment Variables

> **Tip:** Supabase's visual table editor is useful to verify data during demo prep. If you hit Vercel connection timeouts, switch to the **Session Pooler** URL and append `?pgbouncer=true&connection_limit=1`.

---

## Phase Breakdown

### PHASE 1 — Project Bootstrap (30 min)
- [ ] `npx create-next-app@latest fieldlock --typescript --tailwind --app`
- [ ] Install: `prisma @prisma/client next-auth bcryptjs`
- [ ] Setup Supabase project, get connection string
- [ ] `npx prisma init` → configure `schema.prisma`
- [ ] Push to GitHub → connect Vercel → first live deploy

**Done when:** Vercel URL is live with a placeholder homepage.

---

### PHASE 2 — Database Schema (45 min)

#### The Concurrency Architecture: Dedicated SlotResource Model

The key insight: **every bookable facility-slot has a dedicated resource row in the database**. Transactions compete for ownership of that resource. The database guarantees exactly one transaction can claim it.

```
Facility
   ↓
SlotResource  ←── LOCKED ROW (this is what concurrent requests fight over)
   ↓
Booking       ←── Created only after resource is claimed
```

This makes the explanation to judges crystal clear:
> *"Every bookable slot has a unique database resource row. When you book, your transaction claims that resource. The database enforces that only one transaction can ever claim the same resource."*

```prisma
model User {
  id           String     @id @default(cuid())
  rollNumber   String     @unique
  name         String
  email        String     @unique
  password     String
  role         Role       @default(STUDENT)
  // Fair Allocation Engine score (0-100)
  allocationScore Float   @default(70)
  bookings     Booking[]
  waitlist     Waitlist[]
  createdAt    DateTime   @default(now())
}

model Facility {
  id           String         @id @default(cuid())
  name         String
  type         String         // BADMINTON, TENNIS, FOOTBALL, GYM
  capacity     Int
  location     String
  imageUrl     String?
  isActive     Boolean        @default(true)
  slotResources SlotResource[]
}

// THE CRITICAL MODEL — one row per bookable slot
// This row EXISTS before any booking, so SELECT FOR UPDATE always has a target
model SlotResource {
  id          String    @id @default(cuid())
  facilityId  String
  slotDate    DateTime
  startTime   String    // "18:00"
  endTime     String    // "19:00"
  status      SlotStatus @default(AVAILABLE)
  // CLAIMED = locked to a booking in progress
  // BOOKED = confirmed booking exists
  // BLOCKED = maintenance/closure
  booking     Booking?
  waitlist    Waitlist[]
  facility    Facility  @relation(fields: [facilityId], references: [id])

  // One resource per slot — the database enforces this
  @@unique([facilityId, slotDate, startTime])
}

model Booking {
  id              String       @id @default(cuid())
  slotResourceId  String       @unique  // ← one booking per resource, DB enforced
  userId          String
  status          BookingStatus @default(CONFIRMED)
  idempotencyKey  String       @unique
  noShowProb      Float?
  checkedIn       Boolean      @default(false)
  qrToken         String?      @unique
  cancelledAt     DateTime?
  slotResource    SlotResource @relation(fields: [slotResourceId], references: [id])
  user            User         @relation(fields: [userId], references: [id])
  createdAt       DateTime     @default(now())
}

model Waitlist {
  id             String         @id @default(cuid())
  slotResourceId String
  userId         String
  rankScore      Float          // Fair Allocation Engine score at time of joining
  status         WaitlistStatus @default(WAITING)
  slotResource   SlotResource   @relation(fields: [slotResourceId], references: [id])
  user           User           @relation(fields: [userId], references: [id])
  joinedAt       DateTime       @default(now())

  @@unique([slotResourceId, userId])
}

model AllocationEvent {
  // Audit trail for every Fair Allocation score change
  id          String   @id @default(cuid())
  userId      String
  eventType   String   // ATTENDED, NO_SHOW, LATE_CANCEL, EARLY_CANCEL, WAITLIST_HONORED
  delta       Float
  reason      String   // Human-readable explanation stored alongside score change
  bookingId   String?
  createdAt   DateTime @default(now())
}

model DemandPrediction {
  // Pre-computed by Python script, stored here
  id              String   @id @default(cuid())
  facilityId      String
  predictedDate   DateTime
  hour            Int
  predictedDemand Float    // Expected number of bookings
  capacityRatio   Float    // predictedDemand / facility.capacity
  recommendation  String?  // Auto-generated action text
  createdAt       DateTime @default(now())

  @@unique([facilityId, predictedDate, hour])
}

enum Role          { STUDENT ADMIN }
enum SlotStatus    { AVAILABLE BOOKED BLOCKED }
enum BookingStatus { CONFIRMED CANCELLED COMPLETED NO_SHOW RELEASED }
enum WaitlistStatus { WAITING PROMOTED EXPIRED }
```

**Done when:** `npx prisma db push` succeeds. SlotResource rows pre-seeded for all facility slots.

---

### PHASE 3 — Authentication (30 min)
- NextAuth with Credentials provider
- Login with roll number + password
- Two roles: STUDENT and ADMIN
- Seed 2 admin accounts + 20 student accounts with varied histories

```
Admin:    admin@iitg.ac.in   / admin123
Students: student1@iitg.ac.in through student20@iitg.ac.in / pass123
```

**Done when:** Login works, session carries role, protected routes redirect unauthenticated users.

---

### PHASE 4 — Core Booking API with Correct Concurrency (1.5 hrs)

#### The Concurrency Mechanism — Clean & Defensible

```typescript
// POST /api/bookings
// 
// Why this works:
// 1. SlotResource row ALWAYS EXISTS before any booking attempt
// 2. SELECT FOR UPDATE locks that specific row
// 3. All competing transactions queue on the same lock
// 4. First transaction through: changes status AVAILABLE → BOOKED, creates Booking
// 5. Every other transaction: sees BOOKED status → clean rejection
// 6. @@unique([slotResourceId]) on Booking = final DB backstop
// 7. Idempotency key = safe retry without double-processing

export async function POST(req: Request) {
  const { slotResourceId, idempotencyKey } = await req.json()
  const session = await getServerSession()
  const userId = session.user.id

  // Step 1: Idempotency — same request submitted twice returns cached result
  const cached = await prisma.booking.findUnique({ where: { idempotencyKey } })
  if (cached) return Response.json({ status: 'CONFIRMED', booking: cached })

  try {
    const result = await prisma.$transaction(async (tx) => {

      // Step 2: Lock the SlotResource row — this is the contention point
      // Because the row EXISTS, FOR UPDATE always has a target to lock
      const slot = await tx.$queryRaw<SlotResource[]>`
        SELECT * FROM "SlotResource"
        WHERE id = ${slotResourceId}
        FOR UPDATE
      `

      if (!slot[0]) throw new Error('SLOT_NOT_FOUND')

      // Step 3: Check if already claimed
      if (slot[0].status !== 'AVAILABLE') {
        // Add to Smart Waitlist
        const rankScore = await computeWaitlistRank(userId, tx)
        await tx.waitlist.upsert({
          where: { slotResourceId_userId: { slotResourceId, userId } },
          create: { slotResourceId, userId, rankScore },
          update: { rankScore }
        })
        const position = await getWaitlistPosition(slotResourceId, userId, tx)
        const alternatives = await findAlternatives(slot[0], tx)
        return { status: 'CONFLICT', waitlistPosition: position, alternatives }
      }

      // Step 4: Claim the resource atomically
      await tx.slotResource.update({
        where: { id: slotResourceId },
        data: { status: 'BOOKED' }
      })

      const booking = await tx.booking.create({
        data: { slotResourceId, userId, status: 'CONFIRMED', idempotencyKey }
      })

      return { status: 'CONFIRMED', booking }

    }, { isolationLevel: 'Serializable' })

    return Response.json(result)

  } catch (e: any) {
    if (e.code === 'P2002') {
      // Unique constraint fired — race caught at DB level (final backstop)
      return Response.json({ status: 'CONFLICT' }, { status: 409 })
    }
    throw e
  }
}
```

**What happens under 50 simultaneous requests:**
```
50 requests arrive simultaneously
        ↓
All enter SERIALIZABLE transactions
        ↓
All issue SELECT ... FOR UPDATE on the SAME SlotResource row
        ↓
Database queues them — only 1 transaction holds the lock
        ↓
Transaction 1: sees AVAILABLE → sets BOOKED → creates Booking → commits
        ↓
Transaction 2–50: each sees BOOKED → adds to Waitlist → returns CONFLICT
        ↓
Final DB state: SlotResource.status = BOOKED, Bookings count = 1
        ↓
Zero duplicates. Mathematically guaranteed.
```

**Other APIs:**
- `GET /api/facilities` — all facilities with today's slot availability summary
- `GET /api/facilities/[id]/slots?date=` — full slot grid for a day
- `GET /api/bookings/my` — student's bookings
- `DELETE /api/bookings/[id]` — cancel → release slot → trigger waitlist cascade
- `POST /api/bookings/[id]/checkin` — QR check-in
- `GET /api/admin/analytics` — utilization, no-shows, demand
- `GET /api/admin/predictions` — Predictive Intelligence Layer data

**Done when:** Booking works, conflict returns CONFLICT + waitlist position + alternatives, DB has exactly 1 confirmed booking per slot.

---

### PHASE 5 — Student UI (2 hrs)

**Pages:**
```
/              → Landing (hero + facility grid with live availability)
/login         → Roll number + password
/dashboard     → My bookings + Allocation Score card
/facilities    → Browse with filters (sport type, time, availability)
/facilities/[id] → Slot picker calendar + demand indicator per slot
/facilities/[id]/book/[slotId] → Booking confirmation
/waitlist      → My waitlist positions + rank explanation
/profile       → Allocation Score breakdown with event history
```

**Key components:**
- `SlotGrid` — color-coded: Available (green) / Booked (red) / High Demand (amber)
- `AllocationScoreCard` — circular gauge showing score + breakdown factors
- `WaitlistCard` — position + "Why am I ranked here?" explainer
- `AlternativesPanel` — shown on booking conflict: similar slots, similar facilities
- `QRCode` — for check-in at facility

**Done when:** Student can login → browse → book → see confirmation → cancel → view waitlist position.

---

### PHASE 6 — Admin Dashboard: Sports Intelligence (1 hr)

**Pages:**
```
/admin                → Overview: live occupancy + alerts + recommendations
/admin/facilities     → Manage facilities (CRUD + maintenance windows)
/admin/bookings       → All bookings with filters
/admin/analytics      → Utilization + no-show patterns + peak hours
/admin/intelligence   → Predictive Intelligence Layer panel
/admin/race-demo      → Live concurrency demonstration ← CENTERPIECE
```

**Key components:**
- `UtilizationChart` — bar: % occupied per facility this week
- `DemandHeatmap` — 7-day × 24-hour grid, color by predicted load
- `OperationalRecommendations` — actionable cards (not just charts)
- `NoShowTracker` — students with high no-show rate flagged for review
- `AllocationScoreDistribution` — campus-wide score histogram

**Done when:** Admin can see intelligence, manage facilities, view predictions and recommendations.

---

### PHASE 7 — THE RACE DEMO (1 hr) ★ THE CENTERPIECE

The judge tip from the problem statement says:
> *"Include a small 'race demo' in your presentation. Fire competing requests at one slot and show the database-backed result in real time."*

We make this the most visually dramatic moment of the demo.

**Visual Layout (`/admin/race-demo`):**
```
┌─────────────────────────────────────────────────────────┐
│                    BOOKING RACE DEMO                     │
│                                                          │
│  50 USERS ──────────────────────────→ FIELDLOCK ENGINE  │
│  [User avatars animate toward center]  [spinning lock]  │
│                                                          │
│              ┌──────┴──────┐                            │
│              ▼             ▼                            │
│         🏆 1 WINNER    ⚠ 49 SAFE CONFLICTS             │
│         [green card]   [amber cards, fill in]           │
│                             │                           │
│                             ▼                           │
│                    SMART WAITLIST                       │
│                    Ranked by Fair Allocation Score      │
│                                                         │
│  DATABASE STATE:                                        │
│  CONFIRMED BOOKINGS: 1  ✓                              │
│  DUPLICATE BOOKINGS: 0  ✓                              │
│  WAITLIST ENTRIES:  49  ✓                              │
└─────────────────────────────────────────────────────────┘
```

**Implementation:**
```typescript
// Fire 50 requests simultaneously from the browser
const fireRace = async () => {
  setRaceState('running')
  
  // 50 requests, each with a unique demo user and idempotency key
  const requests = DEMO_USERS.map((user, i) =>
    fetch('/api/bookings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        slotResourceId: DEMO_SLOT_ID,
        idempotencyKey: crypto.randomUUID(),
        demoUserId: user.id  // demo mode bypasses auth for this endpoint
      })
    })
    .then(r => r.json())
    .then(data => ({ user, data }))
  )

  // Results stream in as they resolve — update UI one by one
  for (const promise of requests) {
    promise.then(({ user, data }) => {
      if (data.status === 'CONFIRMED') setWinner(user)
      else addConflict(user, data.waitlistPosition)
    })
  }

  await Promise.allSettled(requests)
  setRaceState('done')
  // Fetch final DB state to display counts
  fetchFinalState()
}
```

**The moment judges care about:**
- Counter ticks from 0 → 50 requests fired
- Cards animate: 1 turns green, 49 turn amber
- DB panel shows: `CONFIRMED: 1 | DUPLICATES: 0`
- Presenter says: *"50 simultaneous requests. One database row. One winner. Zero corruption. This is what correctness looks like."*

**Done when:** Race runs, exactly 1 green card, DB panel shows 1 confirmed, visually impressive.

---

### PHASE 8 — Fair Allocation Engine + Smart Waitlist (45 min)

#### Fair Allocation Engine (not just a "fairness score")

The score is a **transparent allocation mechanism** with five defensible factors:

```
AllocationScore = 100 × (
  0.35 × reliability_rate        // Did they show up when they booked?
  + 0.20 × usage_balance         // Inverse of recent booking frequency (prevents hoarding)
  + 0.20 × wait_time_factor      // How long have they been in the system without a slot?
  + 0.15 × cancellation_quality  // Did they cancel with notice (good) or last-minute (bad)?
  + 0.10 × new_user_bonus        // 30-day boost for new students (prevents lock-out)
)
```

**Why this is defensible to judges:**
- It does NOT simply reward "who clicked first"
- It does NOT simply reward "who has been here longest"
- It balances reliability + fairness + wait time
- Every factor is transparent and auditable

**Explaining every allocation decision:**
```typescript
// When a slot is released and waitlist is promoted:
// The system generates a plain-English explanation stored alongside the event

const explanation = `
  ${winner.name} received this slot because their Allocation Score (${winner.score}/100) 
  ranked highest among ${waitlistCount} students waiting for this slot.
  
  Key factors:
  • Reliability: ${winner.reliability}% attendance rate (${winner.attendedCount}/${winner.totalBookings} sessions)  
  • Wait time: Waiting since ${formatDate(winner.joinedAt)} (${daysWaiting} days)
  • Cancellation quality: ${winner.cancelQuality} (always cancels with >4hr notice)
`
```

Student-facing: "Why am I ranked #3?"
> *"Your reliability score is strong (91%), but Rahul has been waiting 3 days longer and has a similar score. You're next in line."*

**Waitlist cascade on cancellation:**
```typescript
// 1. Booking cancelled → SlotResource.status set back to AVAILABLE
// 2. Query Waitlist for this slot, ORDER BY rankScore DESC
// 3. Top candidate: status → PROMOTED, notified via web notification
// 4. Response window: 15 minutes
// 5. If no response → expire, promote next candidate
// 6. Repeat until slot filled or waitlist exhausted
```

**Done when:** Cancel booking → top waitlist candidate promoted → explanation generated → slot reassigned.

---

### PHASE 9 — Predictive Intelligence Layer (30 min)

> Do not call this "AI". Call it the **Predictive Intelligence Layer**.

**The story is specific, not generic:**

```
Historical booking data (3 weeks simulated)
           ↓
Pattern analysis: which slots fill fastest, which sit empty
           ↓
Demand prediction per facility per hour
           ↓
Capacity ratio: predicted demand / available slots
           ↓
Actionable recommendation generated automatically
```

**Example output stored in DemandPrediction table:**
```json
{
  "facilityId": "badminton-court-a",
  "predictedDate": "2024-09-01",
  "hour": 18,
  "predictedDemand": 4.8,
  "capacityRatio": 2.4,
  "recommendation": "Demand predicted at 2.4× capacity for Badminton Court A tomorrow 6–7 PM. Suggested actions: (1) Open Court B for this slot if available. (2) Send early-bird notification encouraging 5 PM bookings. (3) Extend waitlist to 8 students."
}
```

**Python script (offline, run before demo, results stored in DB):**
```python
import json, random
from datetime import datetime, timedelta

# Simulate 3 weeks of booking history
# Identify peak patterns (weekday evenings, post-class hours)
# Apply simple weighted moving average per (facility, day_of_week, hour)
# Write recommendations to demand_predictions table via Supabase REST API
```

**Admin sees in dashboard:**
- 7-day demand heatmap with predicted vs actual
- Recommendation cards with specific actions (not just "demand is high")
- Click action: "Send notification to redirect demand" → triggers notification to eligible students

**Done when:** Admin dashboard shows predictions + at least 3 actionable recommendations pre-loaded.

---

### PHASE 10 — Seed Data + Polish (30 min)

**Seed script creates:**
- 5 facilities: Badminton Court A, Badminton Court B, Tennis Court, Football Field, Gymnasium
- SlotResource rows: 7 days × all facilities × 8 slots/day = 280 pre-existing slot rows
- 20 student accounts with varied AllocationScores (25–95) and booking histories
- 3 weeks of historical bookings: mix of COMPLETED (70%), NO_SHOW (15%), CANCELLED (15%)
- Pre-computed demand predictions for next 7 days
- 5 active waitlist entries for demo

**Polish checklist:**
- [ ] Loading skeletons on all data-fetching components
- [ ] Toast notifications for booking success / conflict / waitlist added
- [ ] Mobile responsive (judges may check on phone)
- [ ] Dark mode matching PLAYHACK dark theme
- [ ] Error boundaries so no crashes during demo
- [ ] `/admin/race-demo` resets cleanly after each run (delete demo bookings, reset SlotResource)

---

### PHASE 11 — Vercel Deployment (20 min)

```bash
# 1. Create GitHub repo and push
git init && git add . && git commit -m "FIELDLOCK v1.0 — PLAYHACK submission"
git remote add origin https://github.com/YOUR_USERNAME/fieldlock
git push -u origin main

# 2. vercel.com → New Project → Import repo → Deploy

# 3. Environment variables in Vercel dashboard:
#    DATABASE_URL     = (Supabase direct connection URI)
#    NEXTAUTH_SECRET  = fieldlock-playhack-2024
#    NEXTAUTH_URL     = https://fieldlock.vercel.app

# 4. Update package.json build script:
#    "build": "prisma generate && prisma db push && next build"

# 5. Redeploy → live URL ready
```

**Done when:** `https://fieldlock.vercel.app` fully functional with seeded data.

---

## MVP vs WOW Layers

### MUST HAVE (submit today)
- [ ] Login (student + admin)
- [ ] Facility browsing with slot availability grid
- [ ] Booking with correct SlotResource locking
- [ ] Cancel booking
- [ ] Admin: booking list + facility management
- [ ] **Race Demo panel** — non-negotiable centerpiece
- [ ] Seeded demo data

### SHOULD HAVE (push after submission)
- [ ] Fair Allocation Score display with breakdown on student profile
- [ ] Smart waitlist with ranking + "why am I ranked here?" explanation
- [ ] QR check-in flow
- [ ] Demand heatmap + operational recommendations on admin dashboard
- [ ] Waitlist cascade on cancellation (automated slot promotion)

### WOW (push when time permits)
- [ ] Predictive Intelligence Layer with auto-generated recommendations
- [ ] Explainable waitlist promotion with full audit trail
- [ ] No-show prediction per booking (pre-computed, shown on admin)
- [ ] AllocationEvent audit log (full history of every score change)
- [ ] Facility utilization analytics with week-over-week comparison

---

## Build Order (Today)

```
Hour 1:  Bootstrap + Supabase DB + Auth + seed script
Hour 2:  SlotResource schema + Booking API with FOR UPDATE locking
Hour 3:  Student UI — browse + slot grid + booking flow
Hour 4:  RACE DEMO PANEL ← most important hour of the build
Hour 5:  Admin dashboard + demand heatmap + recommendations
Hour 6:  Fair Allocation Engine + Smart Waitlist cascade
Hour 7:  Polish + mobile responsive + error handling
Hour 8:  Vercel deploy + test live URL + submit
```

---

## Demo Script (6 min)

1. **(30s)** "6 PM. IITG badminton court. 50 students. One slot. What happens without FIELDLOCK? Chaos."
2. **(45s)** Student logs in → availability grid → high demand slot visible → picks alternate based on suggestion
3. **(30s)** Books slot → confirmation + QR → "Your Fair Allocation Score: 83/100"
4. **(90s)** **RACE DEMO**: "Watch what happens when 50 students hit the same slot simultaneously" → fire race → 1 green, 49 amber → DB panel: `CONFIRMED: 1, DUPLICATES: 0` → *"Correctness guaranteed."*
5. **(30s)** Cancellation → waitlist auto-promotes student #1 → system explains why in plain English
6. **(45s)** Admin dashboard → demand heatmap → recommendation card: "Badminton demand tomorrow 6 PM = 2.4× capacity. Open Court B. Notify students."
7. **(30s)** Fair Allocation score breakdown: "Rahul scores 91 — 95% attendance, always cancels early. He gets priority. The system explains every decision."
8. **(30s)** "This is live at fieldlock.vercel.app. Every push updates it. FIELDLOCK isn't a booking app — it's how IITG manages sports intelligently."

---

## Key Judge Talking Points

- **Correctness:** "Every slot has a dedicated SlotResource row. Your transaction locks that row with SELECT FOR UPDATE. The row always exists — no empty-lock problem. The DB unique constraint on Booking.slotResourceId is the final backstop. Double booking is structurally impossible."
- **Fair Allocation:** "It's not first-come-first-served, and it's not arbitrary. Five transparent factors: reliability, usage balance, wait time, cancellation quality, new-user protection. Every decision is explained in plain English."
- **Predictive Intelligence:** "We compute demand predictions from historical patterns. The system doesn't just show a chart — it generates specific operational actions. That's decision intelligence, not decorative analytics."
- **Scalability:** "Supabase Postgres scales vertically and horizontally. The SlotResource model means concurrency is bounded at the row level — no global locks. Multi-tenant ready by adding a `tenantId` to every table."
- **Real value:** "This replaces the WhatsApp group chats IITG students use to coordinate court bookings. That's the actual problem we solved."
