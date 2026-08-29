# FIELDLOCK — PLAYHACK Implementation Plan
### Submit today · Iterate via GitHub → Vercel auto-deploy

---

## Project Name: **FIELDLOCK**
> *"One platform. Zero clashes."*

---

## Tech Stack

| Layer | Choice | Reason |
|-------|--------|--------|
| Framework | **Next.js 14 (App Router)** | Already installed, Vercel-native, SSR + API routes in one |
| Database | **PostgreSQL via Supabase** | Free tier (500MB), managed Postgres, easy dashboard, works perfectly with Vercel |
| ORM | **Prisma** | Type-safe, schema-first, easy migrations |
| Auth | **NextAuth.js** | Fast setup, supports credentials (roll number + password) |
| Styling | **Tailwind CSS** | Fast UI development |
| Realtime | **Server-Sent Events (SSE)** | No extra infra, built into Next.js, good enough for race demo |
| Background jobs | **Vercel Cron Jobs** | Free, no Redis needed for demo |
| Deployment | **Vercel** | Free, auto-deploy on every GitHub push |
| ML/AI | **Python script → pre-computed JSON** | No ML server needed; run offline, store predictions in DB |

---

## Supabase Setup (Free PostgreSQL)
1. Go to [supabase.com](https://supabase.com) → New Project (pick any region)
2. Go to **Settings → Database → Connection String → URI**
3. Copy the **direct connection** string (NOT the pooler — Prisma needs direct)
4. It looks like: `postgresql://postgres:[PASSWORD]@db.xxxx.supabase.co:5432/postgres`
5. Paste as `DATABASE_URL` in your `.env` file and in Vercel Environment Variables
6. Prisma connects automatically — no extra config needed

> **Tip:** Supabase also gives you a visual table editor at supabase.com/dashboard — useful to verify your data during demo prep.

---

## Phase Breakdown

### PHASE 1 — Project Bootstrap (30 min)
- [ ] `npx create-next-app@latest fieldlock --typescript --tailwind --app`
- [ ] Install deps: `prisma`, `@prisma/client`, `next-auth`, `bcryptjs`
- [ ] Setup Neon DB, get connection string
- [ ] `npx prisma init` → configure `schema.prisma`
- [ ] Push to GitHub → connect to Vercel → first deploy

**Done when:** Vercel URL is live with a placeholder homepage.

---

### PHASE 2 — Database Schema (45 min)

Core tables to create in Prisma:

```prisma
model User {
  id          String    @id @default(cuid())
  rollNumber  String    @unique
  name        String
  email       String    @unique
  password    String
  role        Role      @default(STUDENT)
  playScore   Float     @default(70)
  bookings    Booking[]
  waitlist    Waitlist[]
  createdAt   DateTime  @default(now())
}

model Facility {
  id          String    @id @default(cuid())
  name        String
  type        String
  capacity    Int
  location    String
  imageUrl    String?
  isActive    Boolean   @default(true)
  bookings    Booking[]
  waitlist    Waitlist[]
}

model Booking {
  id              String    @id @default(cuid())
  facilityId      String
  userId          String
  slotDate        DateTime
  startTime       String    // "18:00"
  endTime         String    // "19:00"
  status          BookingStatus @default(CONFIRMED)
  idempotencyKey  String    @unique
  noShowProb      Float?
  checkedIn       Boolean   @default(false)
  qrToken         String?   @unique
  facility        Facility  @relation(fields: [facilityId], references: [id])
  user            User      @relation(fields: [userId], references: [id])
  createdAt       DateTime  @default(now())

  @@unique([facilityId, slotDate, startTime, status])
  // This partial unique index is enforced at app layer for CONFIRMED only
}

model Waitlist {
  id          String    @id @default(cuid())
  facilityId  String
  userId      String
  slotDate    DateTime
  startTime   String
  rankScore   Float
  status      WaitlistStatus @default(WAITING)
  facility    Facility  @relation(fields: [facilityId], references: [id])
  user        User      @relation(fields: [userId], references: [id])
  joinedAt    DateTime  @default(now())

  @@unique([facilityId, slotDate, startTime, userId])
}

enum Role { STUDENT ADMIN }
enum BookingStatus { CONFIRMED CANCELLED COMPLETED NO_SHOW RELEASED }
enum WaitlistStatus { WAITING PROMOTED EXPIRED }
```

**Done when:** `npx prisma db push` succeeds, tables exist in Neon.

---

### PHASE 3 — Authentication (30 min)
- NextAuth with Credentials provider
- Login with roll number + password
- Two roles: STUDENT and ADMIN
- Seed 2 admin accounts + 10 student accounts for demo

**Seed data:**
```
Admin: admin@iitg.ac.in / admin123
Students: student1@iitg.ac.in through student10@iitg.ac.in / pass123
```

**Done when:** Login works, session has role, protected routes redirect unauthenticated users.

---

### PHASE 4 — Core Booking API (1.5 hrs)

**`POST /api/bookings` — The critical endpoint:**

```typescript
// Concurrency strategy:
// 1. Check idempotency key (prevent duplicate requests)
// 2. Prisma transaction with raw SQL FOR UPDATE lock
// 3. Check for existing CONFIRMED booking on same (facility, date, time)
// 4. Insert if clear, return 409 + waitlist add if conflict
// 5. Unique constraint in DB as final backstop

export async function POST(req: Request) {
  const { facilityId, slotDate, startTime, endTime, idempotencyKey } = await req.json()
  const session = await getServerSession()
  
  // Idempotency check
  const existing = await prisma.booking.findUnique({
    where: { idempotencyKey }
  })
  if (existing) return Response.json(existing)

  try {
    const result = await prisma.$transaction(async (tx) => {
      // Lock: raw SQL SELECT FOR UPDATE on the slot
      await tx.$executeRaw`
        SELECT id FROM bookings 
        WHERE facility_id = ${facilityId}
        AND slot_date = ${slotDate}
        AND start_time = ${startTime}
        AND status = 'CONFIRMED'
        FOR UPDATE
      `
      
      const conflict = await tx.booking.findFirst({
        where: { facilityId, slotDate, startTime, status: 'CONFIRMED' }
      })
      
      if (conflict) {
        // Add to waitlist
        const rank = session.user.playScore
        await tx.waitlist.upsert({ ... })
        return { status: 'CONFLICT', waitlistAdded: true }
      }
      
      // Book it
      return await tx.booking.create({
        data: { facilityId, userId: session.user.id, slotDate, 
                startTime, endTime, status: 'CONFIRMED', idempotencyKey }
      })
    }, { isolationLevel: 'Serializable' })
    
    return Response.json(result)
  } catch (e) {
    // Unique constraint violation = race condition caught at DB level
    return Response.json({ status: 'CONFLICT' }, { status: 409 })
  }
}
```

**Other APIs needed:**
- `GET /api/facilities` — list all with availability
- `GET /api/facilities/[id]/slots?date=` — slot grid for a day
- `GET /api/bookings/my` — user's bookings
- `DELETE /api/bookings/[id]` — cancel booking → trigger waitlist
- `POST /api/bookings/[id]/checkin` — QR check-in
- `GET /api/admin/analytics` — admin dashboard data
- `GET /api/race-demo` — SSE stream for live demo

**Done when:** Booking works correctly, conflict returns 409, DB has zero duplicate confirmed bookings.

---

### PHASE 5 — Student UI (2 hrs)

**Pages:**
```
/ → Landing page (hero + facilities grid)
/login → Roll number + password login
/dashboard → My bookings + PlayScore card
/facilities → Browse all facilities with filters
/facilities/[id] → Facility detail + slot picker calendar
/facilities/[id]/book → Booking confirmation page
/waitlist → My waitlist positions
/profile → PlayScore breakdown + history
```

**Key components:**
- `SlotGrid` — visual calendar grid, color-coded availability
- `BookingModal` — confirm booking, show idempotency handling
- `PlayScoreCard` — circular score display with breakdown
- `WaitlistBadge` — position in queue
- `QRCode` — for check-in

**Done when:** Student can login → browse → book → see confirmation → cancel.

---

### PHASE 6 — Admin Dashboard (1 hr)

**Pages:**
```
/admin → Dashboard overview
/admin/facilities → Manage facilities (CRUD)
/admin/bookings → All bookings table with filters
/admin/analytics → Charts: utilization, peak hours, no-shows
/admin/maintenance → Schedule facility closures
/admin/race-demo → Live concurrency demonstration panel
```

**Key components:**
- `UtilizationChart` — bar chart by facility
- `DemandHeatmap` — 7×24 grid of demand intensity
- `NoShowTracker` — list of no-shows this week
- `RaceDemoPanel` — THE WOW MOMENT (see Phase 7)

**Done when:** Admin can see all data, manage facilities, view analytics.

---

### PHASE 7 — THE RACE DEMO (1 hr) ★ MOST IMPORTANT

This is the feature judges will remember.

**How it works:**
1. Admin goes to `/admin/race-demo`
2. Clicks "Start Race — 50 Users → Badminton Court → 6:00 PM"
3. System fires 50 simultaneous POST requests to `/api/bookings`
4. Results stream back via SSE in real time
5. Screen shows:
   - Live counter: "Requests fired: 50 / Confirmed: 1 / Conflicts: 49"
   - Winner card: "🏆 Student #17 got the slot"
   - Conflict cards: "49 users added to waitlist — ranked by PlayScore"
   - DB state panel: shows the single CONFIRMED row

**Implementation:**
```typescript
// /app/admin/race-demo/page.tsx
// Fires 50 fetch() calls simultaneously using Promise.allSettled
// Each with unique idempotency key
// Results displayed as they resolve via React state updates

const fireRace = async () => {
  const requests = Array.from({ length: 50 }, (_, i) => 
    fetch('/api/bookings', {
      method: 'POST',
      body: JSON.stringify({
        facilityId: DEMO_FACILITY,
        slotDate: DEMO_DATE,
        startTime: '18:00',
        idempotencyKey: crypto.randomUUID(),
        demoUserId: DEMO_USERS[i]
      })
    }).then(r => r.json())
  )
  
  const results = await Promise.allSettled(requests)
  // Update UI with results
}
```

**Visual:**
- Animated request arrows flying into a "database vault"
- One arrow turns green (CONFIRMED), rest turn orange (CONFLICT→Waitlist)
- Transaction log visible in a code panel on the right

**Done when:** Demo runs, exactly 1 confirmed, DB shows 0 duplicates, visually impressive.

---

### PHASE 8 — PlayScore + Smart Waitlist (45 min)

**PlayScore calculation (runs on booking events):**
```typescript
// On check-in → +5 score
// On no-show → -15 score  
// On cancel < 1hr before → -8 score
// On cancel > 4hr before → -2 score
// On waitlist honor → +3 score
// New user bonus → starts at 70

function recalcPlayScore(events: PlayScoreEvent[]): number {
  // Weighted rolling average of last 30 days
  // Clamped between 0 and 100
}
```

**Waitlist ranking on slot release:**
```typescript
// When booking cancelled → slot released
// Query waitlist for that slot, order by rank_score DESC
// Top candidate gets notified first
// If no response in 15 min → promote next candidate
// rank_score = user.playScore + urgency_bonus + recency_penalty
```

**Done when:** Cancellation → waitlist top user gets notified → slot reassigned.

---

### PHASE 9 — Seed Data + Polish (30 min)

**Seed script creates:**
- 5 facilities: Badminton Court A/B, Tennis Court, Football Field, Gymnasium
- 50 student accounts with varied PlayScores (30–95)
- 3 weeks of historical bookings (mix of confirmed/completed/no-show)
- Pre-populated demand predictions (static JSON → DB)
- A few waitlist entries for demo

**Polish:**
- Loading states on all async operations
- Error boundaries
- Toast notifications for booking success/failure
- Mobile responsive layout
- Dark mode (matches PLAYHACK branding)

---

### PHASE 10 — Vercel Deployment (20 min)

```bash
# 1. Push to GitHub
git init && git add . && git commit -m "Initial FIELDLOCK submission"
git remote add origin https://github.com/YOUR_USERNAME/fieldlock
git push -u origin main

# 2. Go to vercel.com → New Project → Import GitHub repo
# 3. Add environment variables in Vercel dashboard:
#    DATABASE_URL = (direct connection string from Supabase → Settings → Database)
#    NEXTAUTH_SECRET = (any random string, e.g. "fieldlock-secret-2024")
#    NEXTAUTH_URL = https://fieldlock.vercel.app

# 4. Add this to package.json build script so Prisma migrates on deploy:
#    "build": "prisma generate && prisma db push && next build"

# 5. Deploy → get live URL
```

> **Supabase note:** If you see a connection timeout on Vercel, switch to the **Session pooler** URL from Supabase (port 5432, mode=session). Add `?pgbouncer=true&connection_limit=1` to the URL.

**Done when:** `https://fieldlock.vercel.app` is live and functional.

---

## MVP vs WOW Layers

### MUST HAVE (submit today)
- [ ] Login (student + admin roles)
- [ ] Facility browsing with real-time slot availability
- [ ] Book a slot (with correct concurrency handling)
- [ ] Cancel a booking
- [ ] Admin dashboard with booking list
- [ ] Race Demo panel — THE CENTERPIECE
- [ ] Seeded demo data

### SHOULD HAVE (push after submission)
- [ ] PlayScore display on student profile
- [ ] Smart waitlist with ranking
- [ ] QR check-in flow
- [ ] Demand heatmap on admin dashboard
- [ ] Email/web notifications

### WOW (push when time permits)
- [ ] No-show prediction ML (pre-computed)
- [ ] Operational recommendations on admin dashboard
- [ ] Explainable waitlist promotion ("Why did Rohan get the slot?")
- [ ] Facility utilization analytics with actionable insights

---

## Build Order (Today)

```
Hour 1:  Bootstrap + DB + Auth + seed
Hour 2:  Booking API (concurrency-correct)
Hour 3:  Student UI (facilities + slot picker + booking)
Hour 4:  Race Demo panel (THE MOST IMPORTANT HOUR)
Hour 5:  Admin dashboard + analytics
Hour 6:  PlayScore + waitlist logic
Hour 7:  Polish + seed data + mobile responsive
Hour 8:  Deploy to Vercel + test live URL + submit
```

---

## Demo Script (5 min)

1. **(30s)** Show the problem: "6 PM at IITG. Everyone wants the badminton court."
2. **(30s)** Student logs in → browses facilities → sees availability grid
3. **(30s)** Student picks a slot → books → sees confirmation + QR
4. **(60s)** **RACE DEMO**: 50 users, one slot, simultaneous → 1 winner, 49 to waitlist — DB shows exactly 1 row
5. **(30s)** Cancellation → waitlist auto-promotes top-ranked student (PlayScore visible)
6. **(30s)** Admin dashboard: utilization chart, demand heatmap, no-show tracker
7. **(30s)** Show PlayScore: "This student has 85/100 — they get waitlist priority because they always show up"
8. **(30s)** Final slide: live Vercel URL — "It's live right now. Every GitHub push updates it."

---

## Key Judge Talking Points

- **Correctness**: "Our booking goes through a SERIALIZABLE transaction with SELECT FOR UPDATE. The DB unique index is the final backstop. Double booking is mathematically impossible."
- **Innovation**: "PlayScore makes the waitlist fair and explainable — not just first-come-first-served."
- **Scalability**: "Supabase Postgres + Vercel edge functions scale horizontally. Architecture is multi-tenant ready."
- **Real value**: "This would actually replace the manual coordination students at IITG do today."
