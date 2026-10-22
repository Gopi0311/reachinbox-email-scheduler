# 🚀 ReachInbox.ai Full-Stack Email Job Scheduler

A production-grade, distributed email scheduling engine built for the ReachInbox.ai internship assignment. It reliably schedules, rate-limits, and dispatches batch emails via **BullMQ delayed jobs** on **Redis**, persisted in **PostgreSQL**, indexed in **Elasticsearch**, and delivered through **Ethereal SMTP (Nodemailer)** with real **Google OAuth** and **Slack alerts**.

---

## 📑 Table of Contents
1. [Tech Stack](#-tech-stack)
2. [Architecture & Design Principles](#-architecture--design-principles)
   - [Zero-Cron BullMQ Delayed Scheduling](#1-zero-cron-bullmq-delayed-scheduling)
   - [Strict Database Idempotency & Concurrency](#2-strict-database-idempotency--concurrency)
   - [Durable Restart Recovery](#3-durable-restart-recovery)
   - [Redis Sliding Window Rate Limiting & Auto-Rescheduling](#4-redis-sliding-window-rate-limiting--auto-rescheduling)
   - [Elasticsearch Full-Text Search](#5-elasticsearch-full-text-search)
   - [Bull Board Queue Monitoring](#6-bull-board-queue-monitoring)
3. [Repository Structure](#-repository-structure)
4. [Environment Configuration](#-environment-configuration)
5. [Quick Start & Setup Guide](#-quick-start--setup-guide)
   - [Prerequisites](#prerequisites)
   - [1. Infrastructure via Docker Compose](#1-infrastructure-via-docker-compose)
   - [2. Backend Setup](#2-backend-setup)
   - [3. Frontend Setup](#3-frontend-setup)
6. [External Credentials Setup](#-external-credentials-setup)
   - [Google OAuth](#google-oauth-google-cloud-console)
   - [Slack OAuth & Incoming Webhooks](#slack-oauth--incoming-webhooks)
   - [Ethereal SMTP Email Credentials](#ethereal-smtp-email-credentials)
   - [Elasticsearch](#elasticsearch)
7. [Automated Testing](#-automated-testing)
8. [Step-by-Step Demo & Verification Checklist](#-step-by-step-demo--verification-checklist)
9. [Feature Mapping Matrix](#-feature-mapping-matrix)
10. [Assumptions, Trade-offs & Production Hardening](#-assumptions-trade-offs--production-hardening)

---

## 🛠 Tech Stack

- **Backend**: Node.js (v20+), TypeScript (v5), Express.js (v4)
- **Database**: PostgreSQL (v16) with Prisma ORM
- **Queue / Scheduler**: BullMQ (v5) on Redis (v7) — **Zero cron jobs or crontabs**
- **Email Delivery**: Nodemailer with Ethereal SMTP test transporter & web preview links
- **Search Engine**: Elasticsearch (v8) with resilient PostgreSQL fallback
- **Queue UI**: Bull Board (`@bull-board/express` & `@bull-board/ui`) at `/admin/queues`
- **Authentication**: Real Google OAuth 2.0 (Passport.js) + session cookie
- **Alerts**: Real Slack OAuth 2.0 + Incoming Webhooks on hourly limit reach
- **Frontend**: Next.js 14 (App Router), React 18, Tailwind CSS, Lucide icons, TypeScript

---

## 📐 Architecture & Design Principles

```
  ┌─────────────────────────────────────────────────────────────┐
  │                   Next.js 14 Frontend                       │
  │     (OAuth, Live Dashboard, Compose Modal, Slack Card)      │
  └──────────────┬──────────────────────────────▲───────────────┘
                 │ HTTP (REST)                  │ Session Cookies
  ┌──────────────▼──────────────────────────────┴───────────────┐
  │                    Express Backend                          │
  │   - Zod Request Validation                                  │
  │   - Google OAuth / Session Middleware                       │
  │   - Startup Reconciliation Service                          │
  │   - Bull Board Monitoring (/admin/queues)                   │
  └──────┬──────────────────────┬──────────────────────┬────────┘
         │                      │                      │
  ┌──────▼──────┐        ┌──────▼──────┐        ┌──────▼──────┐
  │ PostgreSQL  │        │    Redis    │        │Elasticsearch│
  │ (Email Jobs,│        │  (BullMQ,   │        │(Search Query│
  │  Senders,   │        │ Rate Limits,│        │   Engine)   │
  │  Slack,     │        │ Min Delay)  │        └─────────────┘
  │  Users)     │        └──────┬──────┘
  └─────────────┘               │
                         ┌──────▼───────────────────────────────┐
                         │   BullMQ Background Worker Process   │
                         │   - Conditional Claim (Idempotency)  │
                         │   - Min-Delay Enforcer               │
                         │   - Hourly Limit (Atomic Lua)        │
                         │   - Ethereal SMTP Delivery           │
                         │   - Slack Rate Limit Alerting        │
                         └──────────────────────────────────────┘
```

### 1. Zero-Cron BullMQ Delayed Scheduling
- **No cron jobs, `node-cron`, or OS crontabs are used anywhere.**
- Each email job calculates `targetTimestamp = startTime + (index * delayBetweenEmailsMs)`.
- The email is inserted into PostgreSQL with a stable UUID (`id`), and added to BullMQ as a delayed job (`emailQueue.add('send-email', data, { jobId: emailJob.id, delay })`).
- Supports **1,000+ jobs scheduled simultaneously** without memory leaks or race conditions.

### 2. Strict Database Idempotency & Concurrency
- The same email can **never be sent twice**.
- When a worker picks up a job, it executes an **atomic conditional claim**:
  ```sql
  UPDATE "email_jobs"
  SET "status" = 'processing', "attempts" = "attempts" + 1, "updatedAt" = NOW()
  WHERE "id" = $1 AND ("status" = 'scheduled' OR "status" = 'rescheduled');
  ```
- If another worker claimed it or it is already sent, `count === 0` and the worker immediately skips it.

### 3. Durable Restart Recovery
- If the server or worker process crashes mid-flight, future jobs are preserved:
  1. On server startup, `ReconciliationService.reconcile()` finds any jobs left in `PROCESSING` and resets them safely to `SCHEDULED`.
  2. It iterates through all `SCHEDULED` / `RESCHEDULED` jobs in PostgreSQL and verifies their existence in BullMQ. Any job missing from Redis is automatically re-enqueued with remaining delay.

### 4. Redis Sliding Window Rate Limiting & Auto-Rescheduling
- When a sender reaches their `hourlyLimit`, the job is **NEVER dropped or failed**.
- An atomic Redis Lua script checks and increments `rate:hourly:{senderId}:{hourWindow}`:
  - If limit is reached, the worker changes status to `RESCHEDULED` and adds a delayed BullMQ job to the start of the next hour window (`retryAfterMs`).
  - Automatically sends a rich **Slack alert** to the user's workspace notifying them that the limit was reached.
- Minimum delay between emails per sender is tracked using `rate:last_send:{senderId}`.

### 5. Elasticsearch Full-Text Search
- Scheduled, sent, and failed jobs are indexed in Elasticsearch (`email_jobs` index).
- `GET /api/emails/search?q=` queries recipient, subject, and body.
- If Elasticsearch is offline, the backend seamlessly falls back to PostgreSQL `ILIKE` queries.

### 6. Bull Board Queue Monitoring
- Exposed at `http://localhost:5000/admin/queues`.
- Real-time visualization of Delayed, Active, Waiting, Completed, and Failed BullMQ jobs.

---

## 📁 Repository Structure

```
ReachInbox.ai/
├── docker-compose.yml              # Local PostgreSQL, Redis, Elasticsearch
├── .env.example                    # Root environment template
├── sample-recipients.csv           # 10 sample contacts for manual testing
├── load-test-1000.csv              # 1,000 valid contacts for load/stress testing
├── backend/
│   ├── prisma/
│   │   ├── schema.prisma           # Prisma PostgreSQL schema
│   │   └── seed.ts                 # Database seeder (sample user & sample jobs)
│   ├── src/
│   │   ├── config/                 # Zod env, Redis, ES, Ethereal, Passport, Logger
│   │   ├── db/                     # Prisma Client initialization
│   │   ├── middleware/             # Auth guard, Zod validation, error handler
│   │   ├── queues/                 # BullMQ queue & Bull Board configuration
│   │   ├── services/               # Scheduler, EmailSender, RateLimiter, ES, Slack, Reconciliation
│   │   ├── controllers/            # Auth, Email, and Slack controllers
│   │   ├── routes/                 # Express route definitions
│   │   ├── workers/                # BullMQ Worker implementation and standalone runner
│   │   ├── types/                  # Core backend TypeScript types
│   │   ├── app.ts                  # Express application setup
│   │   └── server.ts               # Server bootstrap & embedded worker
│   ├── tests/                      # Automated Vitest test suite
│   │   ├── scheduling.test.ts      # Staggered delayed job scheduling tests
│   │   ├── rate-limiting.test.ts   # Redis atomic hourly limit & load test
│   │   ├── idempotency.test.ts     # Multi-worker race condition & lock tests
│   │   └── restart-recovery.test.ts# Crash recovery and re-enqueue tests
│   ├── package.json
│   └── tsconfig.json
└── frontend/
    ├── src/
    │   ├── app/
    │   │   ├── layout.tsx          # Root layout with ToastProvider
    │   │   ├── page.tsx            # Auth route redirector
    │   │   ├── login/page.tsx      # Google Sign-in
    │   │   └── dashboard/page.tsx  # Interactive scheduler dashboard
    │   ├── components/             # Header, StatsCards, ComposeModal, Tables, SlackCard
    │   │   └── ui/                 # Button, Input, Modal, Tabs, Toast, Spinner, EmptyState
    │   └── lib/                    # Typed API client, TypeScript models, formatters
    ├── package.json
    ├── tailwind.config.js
    └── next.config.mjs
```

---

## ⚙️ Environment Configuration

Copy `.env.example` to `backend/.env`:

```env
PORT=5000
NODE_ENV=development
FRONTEND_URL=http://localhost:3000
BACKEND_URL=http://localhost:5000

# Secret for express-session cookie signing
SESSION_SECRET=super-secure-session-secret-change-in-production-reachinbox-2026

# PostgreSQL Connection String
DATABASE_URL=postgresql://postgres:postgrespassword@localhost:5432/reachinbox_scheduler?schema=public

# Redis Connection String
REDIS_URL=redis://localhost:6379

# Elasticsearch Connection String
ELASTICSEARCH_URL=http://localhost:9200

# Worker Concurrency & Defaults
WORKER_CONCURRENCY=5
MIN_EMAIL_DELAY_MS=2000
MAX_EMAILS_PER_HOUR=100

# Ethereal SMTP (Leave blank to automatically generate a free test account on startup)
ETHEREAL_HOST=smtp.ethereal.email
ETHEREAL_PORT=587
ETHEREAL_USER=
ETHEREAL_PASSWORD=

# Google OAuth 2.0 Credentials
GOOGLE_CLIENT_ID=your-google-client-id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your-google-client-secret

# Slack OAuth 2.0 Credentials
SLACK_CLIENT_ID=your-slack-client-id
SLACK_CLIENT_SECRET=your-slack-client-secret
```

---

## 🚀 Quick Start & Setup Guide

### Prerequisites
- **Node.js**: v20 or higher (`node -v`)
- **Docker**: For running PostgreSQL, Redis, and Elasticsearch containers

### 1. Infrastructure via Docker Compose
Start the supporting services (PostgreSQL, Redis, Elasticsearch):
```bash
docker compose up -d
```
*Verify containers are healthy:*
```bash
docker ps
```

### 2. Backend Setup
1. Navigate to the backend directory and install dependencies:
   ```bash
   cd backend
   npm install
   ```
2. Push the Prisma database schema and run seed data:
   ```bash
   npm run prisma:push
   npm run seed
   ```
3. Start the backend server:
   ```bash
   npm run dev
   ```
   *(By default, the server runs with an embedded BullMQ worker. To run the worker in a separate process, run `npm run worker` in a second terminal).*

### 3. Frontend Setup
1. Open a new terminal and navigate to the frontend directory:
   ```bash
   cd frontend
   npm install
   ```
2. Start the Next.js development server:
   ```bash
   npm run dev
   ```
3. Open your browser and navigate to:
   **`http://localhost:3000`**

---

## 🔑 External Credentials Setup

### Google OAuth (Google Cloud Console)
1. Go to the [Google Cloud Console Credentials](https://console.cloud.google.com/apis/credentials).
2. Create an **OAuth 2.0 Client ID** (Web application).
3. Set **Authorized redirect URIs**:
   ```
   http://localhost:5000/auth/google/callback
   ```
4. Copy `Client ID` and `Client Secret` into `backend/.env`.

### Slack OAuth & Incoming Webhooks
1. Create a new Slack App at [api.slack.com/apps](https://api.slack.com/apps).
2. Enable **OAuth & Permissions**:
   - Add Bot Token Scopes: `chat:write`, `incoming-webhook`.
   - Add Redirect URL:
     ```
     http://localhost:5000/api/slack/callback
     ```
3. Copy `Client ID` and `Client Secret` into `backend/.env`.
4. In the app dashboard, click **"Connect Slack"** to link your workspace.
5. If Slack is not connected, the scheduler continues uninterrupted.

### Ethereal SMTP Email Credentials
- You **do not need to create an account manually**.
- If `ETHEREAL_USER` and `ETHEREAL_PASSWORD` are left empty, Nodemailer will **auto-generate an ephemeral Ethereal test account on startup**.
- Sent emails will include a clickable **"View Email"** link in the dashboard opening the exact email in the Ethereal web viewer!

### Elasticsearch
- Handled automatically by `docker-compose.yml` on port `9200`.
- The backend initializes the `email_jobs` index on startup.
- If Elasticsearch is stopped, search queries gracefully fall back to PostgreSQL full-text search.

---

## 🧪 Automated Testing

The backend includes automated tests covering scheduling, rate limits, restart recovery, and idempotency:

```bash
cd backend
npm test
```

### Tests Covered:
- `tests/scheduling.test.ts`: Tests batch email deduplication and staggered delayed job creation with exact millisecond spacing.
- `tests/rate-limiting.test.ts`: Tests atomic Redis Lua rate limiting, 1,000 rapid requests consistency, and next-window rescheduling.
- `tests/idempotency.test.ts`: Simulates 5 simultaneous worker processes racing to claim the same job, verifying only 1 can process it.
- `tests/restart-recovery.test.ts`: Verifies recovery of stuck `PROCESSING` jobs and re-enqueueing of missing `SCHEDULED` jobs on startup.

---

## 📋 Step-by-Step Demo & Verification Checklist

| Step | Action | Expected Result |
|---|---|---|
| **1. Authentication** | Open `http://localhost:3000` and sign in with Google. | Redirected to `/dashboard` displaying avatar, user email, and metrics. |
| **2. Queue UI** | Click **"Bull Board"** in the top navigation. | Opens `http://localhost:5000/admin/queues` showing BullMQ queue state. |
| **3. Schedule Emails** | Click **"Compose Email"** → Load 10 sample emails → Set 2s delay → Click **Schedule**. | 10 delayed jobs are created in BullMQ and appear in the "Scheduled Queue" tab. |
| **4. Live Execution** | Watch the dashboard without refreshing (polling runs every 5s). | Delayed jobs count down, get processed one-by-one with 2s spacing, and move to "Sent Emails". |
| **5. Ethereal Preview** | Switch to the "Sent Emails" tab and click **"View Email"**. | Opens the Ethereal web viewer displaying the rendered email and headers. |
| **6. Restart Recovery** | Schedule 50 emails with 5s delay. Stop the backend server (`Ctrl+C`), wait 10s, and restart it (`npm run dev`). | Startup reconciliation runs; pending jobs are recovered and continue dispatching without duplicates. |
| **7. Hourly Rate Limit** | In Compose modal, set "Hourly Limit" to `5`. Schedule 10 emails. | First 5 send; the remaining 5 are marked `rescheduled` to the next hour window. If Slack is connected, a rate-limit alert is delivered. |
| **8. Elasticsearch Search** | Type a recipient email in the search bar. | Table filters instantly using Elasticsearch (or DB fallback) matching the query. |
| **9. 1,000 Job Stress Test** | Upload `load-test-1000.csv` in the Compose modal. | 1,000 jobs are batch inserted into DB and enqueued in chunks without server lag. |

---

## 📊 Feature Mapping Matrix

| Requirement | Implementation Module | Status |
|---|---|---|
| **Zero Cron Scheduling** | `backend/src/queues/email.queue.ts` via BullMQ `delay` | ✅ Verified |
| **Restart Recovery** | `backend/src/services/reconciliation.service.ts` | ✅ Verified |
| **DB Idempotency** | Conditional update in `backend/src/services/email-sender.service.ts` | ✅ Verified |
| **Configurable Concurrency** | BullMQ Worker with `env.WORKER_CONCURRENCY` | ✅ Verified |
| **Hourly Limit & Rescheduling** | `backend/src/services/rate-limiter.service.ts` (Lua script) | ✅ Verified |
| **Ethereal Delivery & Previews** | `backend/src/config/email.ts` & `nodemailer.getTestMessageUrl` | ✅ Verified |
| **Real Google OAuth** | `backend/src/config/passport.ts` (GoogleStrategy) | ✅ Verified |
| **Slack OAuth & Alerts** | `backend/src/services/slack.service.ts` | ✅ Verified |
| **Elasticsearch Index & Search** | `backend/src/services/elasticsearch.service.ts` | ✅ Verified |
| **Bull Board Queue Monitoring** | Mount at `/admin/queues` via `@bull-board/express` | ✅ Verified |
| **Next.js 14 Frontend** | App Router, Tailwind CSS, Loading Skeletons, Toasts | ✅ Verified |
| **1,000+ Email Support** | Chunked DB inserts & `load-test-1000.csv` | ✅ Verified |

---

## 💡 Assumptions, Trade-offs & Production Hardening

1. **Email Preview URLs**: Ethereal is designed for test environments. In production, Ethereal would be swapped for Amazon SES, SendGrid, or Postmark by updating `nodemailer` transporter options in `backend/src/config/email.ts`.
2. **Elasticsearch Fallback**: If Elasticsearch is not started locally, the system automatically falls back to PostgreSQL `ILIKE` queries, ensuring zero disruption during development.
3. **Session Store**: Session cookies use Redis via `connect-redis` for distributed state across multiple backend instances.
4. **Rescheduling Window**: When an hourly limit is hit, jobs are delayed to `Math.floor(now / 3600000) * 3600000 + 3600000 + 500ms`, preserving the sequence for the next available sending quota.
