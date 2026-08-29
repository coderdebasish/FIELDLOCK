# FIELDLOCK — Intelligent & Concurrency-Correct Sports Facility Allocation Platform

> **IIT Guwahati Sports Board × Tech Board — PLAYHACK 2024 Submission**

FIELDLOCK is a production-grade sports facility management system engineered to eliminate double-bookings during peak hours using a **Dedicated Slot-Resource Row-Level Locking Model**, coupled with a **Fair Allocation Engine** and **Predictive Intelligence Layer**.

---

## 🚀 Live Demo & Judge Credentials

* **Live App URL:** `https://fieldlock.vercel.app`
* **Live Concurrency Demo Panel:** `https://fieldlock.vercel.app/admin/race-demo`

### Test Accounts

| Role | Email | Password | Details |
| :--- | :--- | :--- | :--- |
| 👑 **Admin** | `admin@iitg.ac.in` | `admin123` | Full control + Live Race Panel |
| 🏆 **Student (High Priority)** | `220101001@iitg.ac.in` | `pass123` | Score: 92/100 (Reliable booker) |
| 📈 **Student (Mid Priority)** | `220101003@iitg.ac.in` | `pass123` | Score: 78/100 |
| ⚠️ **Student (Low Priority)** | `220101010@iitg.ac.in` | `pass123` | Score: 33/100 (No-show penalized) |

---

## 🛡️ Core Innovations & Technical Architecture

### 1. Dedicated `SlotResource` Lock Model (Zero Race Conditions)
Traditional booking platforms check slot availability and write bookings in two separate steps, creating race conditions under high concurrency.
FIELDLOCK models every bookable slot as a dedicated database row (`SlotResource`). All booking transactions execute `SELECT ... FOR UPDATE` inside `SERIALIZABLE` PostgreSQL transactions:
* **Outcome:** Exactly 1 winner per slot, 0 double-bookings, even under 50+ concurrent requests.

### 2. Fair Allocation Engine (Transparent Ranking)
Waitlists are dynamically ranked using weighted factors instead of raw speed:
* **35%** Attendance Reliability
* **20%** Usage Balance
* **15%** Cancellation Quality (advance notice)
* **15%** Waitlist Honor Rate
* **10%** New User Boost

### 3. Predictive Intelligence Layer
Analyzes historical booking patterns to auto-generate operational recommendations for administrators (e.g., *"Demand predicted at 2.4× capacity for Badminton Court A at 18:00. Suggested action: Open alternate facility or extend waitlist capacity"*).

---

## 🛠️ Tech Stack

* **Framework:** Next.js 14+ (App Router, Server Actions)
* **Database:** PostgreSQL (Supabase Free Tier)
* **ORM:** Prisma v6
* **Auth:** NextAuth (JWT Session Strategy)
* **Styling:** Tailwind CSS (Dark theme & Glassmorphism)

---

## ⚡ Local Setup

```bash
# 1. Clone & Install
git clone https://github.com/coderdebasish/FIELDLOCK.git
cd FIELDLOCK
npm install

# 2. Configure Environment (.env)
DATABASE_URL="your-supabase-postgresql-url"
DIRECT_URL="your-supabase-postgresql-url"
NEXTAUTH_SECRET="fieldlock-playhack-secret"
NEXTAUTH_URL="http://localhost:3000"

# 3. Setup DB & Seed
npx prisma generate
npx prisma db push
node prisma/seed.js

# 4. Run App
npm run dev
```
