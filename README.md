# Email Job Scheduler (ReachInbox assignment)

A production-style email scheduler: schedule emails through an API, persist them in Postgres, delay-schedule them with **BullMQ + Redis** (no cron), send through **Ethereal SMTP** from multiple senders, search them in **Elasticsearch**, and watch the queue live in **Bull Board**. A React dashboard (see the Frontend section) sits on top.

```
.
├── backend/    Express + TypeScript API, BullMQ worker
└── frontend/   React + Tailwind dashboard (setup below)
```

## Tech stack

| Layer | Choice |
|---|---|
| API | Node, Express 4, TypeScript |
| Queue | BullMQ on Redis (AOF persistence) |
| Database | PostgreSQL (`pg`, raw SQL, auto-migrated on boot) |
| SMTP | Ethereal via Nodemailer |
| Search | Elasticsearch 8 |
| Auth | Google OAuth 2.0, JWT in an httpOnly cookie |
| Notifications | Slack OAuth (incoming webhook) |
| Queue UI | Bull Board at `/admin/queues` |

---

## Running the backend

### 1. Infrastructure

**Option A: Docker (recommended)**

```bash
cd backend
docker compose up -d     # Postgres 16, Redis 7 (appendonly yes), Elasticsearch 8
```

**Option B: hosted services (no Docker)**

| Service | Example provider | Notes |
|---|---|---|
| Postgres | Neon | Use the connection string as `DATABASE_URL`. |
| Redis | Redis Cloud | Set the eviction policy to **`noeviction`** (BullMQ requirement). |
| Elasticsearch | Elastic Cloud / Bonsai | Use `ELASTICSEARCH_API_KEY` (or user/pass) instead of putting credentials in the URL. |

### 2. Environment

```bash
cp .env.example .env     # Windows PowerShell: Copy-Item .env.example .env
```

| Variable | Purpose | Default |
|---|---|---|
| `PORT`, `BACKEND_URL`, `FRONTEND_URL` | Server and CORS/redirect URLs | 4000 / localhost |
| `DATABASE_URL`, `REDIS_URL` | Connections | local |
| `ELASTICSEARCH_URL` | ES node URL | `http://localhost:9200` |
| `ELASTICSEARCH_API_KEY` or `ELASTICSEARCH_USER` / `ELASTICSEARCH_PASS` | ES auth (optional locally) | none |
| `JWT_SECRET` | Cookie signing | set your own |
| `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` | Google OAuth | none |
| `SLACK_CLIENT_ID`, `SLACK_CLIENT_SECRET`, `SLACK_REDIRECT_URI` | Slack OAuth | none |
| `WORKER_CONCURRENCY` | Parallel jobs per worker | 5 |
| `MIN_DELAY_BETWEEN_EMAILS_MS` | Minimum gap between sends | 2000 |
| `MAX_EMAILS_PER_HOUR_PER_SENDER` | Default hourly cap per sender | 100 |
| `SENDER_COUNT` | Ethereal senders to create | 3 |
| `BULL_BOARD_USER`, `BULL_BOARD_PASS` | Bull Board basic auth | admin / admin |
| `DEV_AUTH_BYPASS` | `true` skips login and uses a seeded dev user (local testing only) | false |

### 3. Start

```bash
npm install
npm run dev:api       # terminal 1: API + Bull Board on :4000
npm run dev:worker    # terminal 2: BullMQ worker
```

Expected output: `[api] http://localhost:4000 | queues: /admin/queues` and `[worker] up | concurrency=5 ...`.

### Ethereal setup

Nothing manual is needed. On first boot, `ensureSenders()` calls `nodemailer.createTestAccount()` until `SENDER_COUNT` senders exist and stores their SMTP credentials in the `senders` table. Every sent email gets a `preview_url`, so you can open the message in the Ethereal web inbox.

### Google OAuth setup

1. Google Cloud Console, then OAuth consent screen (External), and add yourself as a test user.
2. Create a Web OAuth client with the redirect URI `http://localhost:4000/auth/google/callback`.
3. Put the client ID and secret in `.env`.

### Slack setup

1. Create a Slack app and add the `incoming-webhook` bot scope.
2. Add the redirect URL (`SLACK_REDIRECT_URI`, e.g. `https://<ngrok>/api/slack/callback`; Slack requires https outside localhost).
3. Put the client ID and secret in `.env`.
4. In the dashboard, click **Connect Slack**.

---

## Running the frontend

```bash
cd frontend
npm install
npm run dev     # http://localhost:3000
```

In development Vite proxies `/api` and `/auth` to `http://localhost:4000`, so no frontend `.env` is needed and cookies stay same-origin. If the API runs on another origin, set `VITE_API_URL` (see `frontend/.env.example`) and make sure `FRONTEND_URL` in the backend `.env` matches the frontend origin.

Frontend stack: Vite, React 19, TypeScript, Tailwind CSS 4, React Router, TipTap (rich-text editor), DOMPurify.

```
frontend/src/
├── components/
│   ├── ui/        Button, Avatar, Toast, Skeleton, EmptyState, Logo
│   ├── layout/    Sidebar, AppLayout, ProtectedRoute
│   ├── emails/    EmailRow, StatusPill
│   └── compose/   RichTextEditor, RecipientsInput, SendLaterPopover
├── hooks/         useAuth, useEmails (polling + search), useCounts
├── lib/           api client, formatters, email extraction
├── pages/         LoginPage, MailboxPage, EmailDetailPage, ComposePage
└── types.ts       shared API types
```

---

## Architecture

```
 Client ──▶ Express API ──▶ Postgres (source of truth: emails, senders, users)
                │   └────▶ Elasticsearch (searchable copy)
                └────────▶ Redis / BullMQ (delayed jobs)
                                │
                          Worker(s) ──▶ rate limiter (Redis) ──▶ Ethereal SMTP
                                │
                                └────▶ Slack webhook (on hourly-limit hit)
```

### How scheduling works

1. `POST /api/emails/schedule` receives subject, body, recipients, `startTime`, `delayBetweenMs`, and an optional `hourlyLimit`.
2. Recipients are de-duplicated. Each email gets `scheduled_at = startTime + index × delayBetweenMs` and a sender assigned round-robin.
3. All rows are written to Postgres in one `INSERT ... SELECT FROM unnest(...)`, which scales to thousands of rows per request.
4. One BullMQ **delayed job** is added per email with `delay = scheduled_at - now` and **`jobId = email id`**. There is no cron, no polling loop of our own, and no `node-cron` or `agenda`.
5. Each email is also indexed in Elasticsearch.
6. When the delay elapses, a worker picks up the job, sends the email, and sets the row to `sent` (with `sent_at`, `message_id`, `preview_url`) or `failed`.

### Persistence across restarts

- Delayed jobs live in Redis with AOF enabled, so they survive both worker and Redis restarts.
- Postgres is the source of truth. On worker boot, `reconcile()` scans for rows still `scheduled` or `processing` and re-enqueues them. Because `jobId` is the email id, BullMQ ignores any job that already exists, so this repairs lost Redis state without creating duplicates.
- Nothing restarts from scratch. A worker restart only affects jobs that hadn't fired yet.

### Idempotency (no duplicate sends)

1. `jobId = email id` means one job per email, no matter how many times enqueueing is attempted.
2. BullMQ job locks mean only one worker processes a job at a time.
3. The worker exits early if the row is already `sent` or `failed`.
4. The DB update to `sent` is guarded (`WHERE status <> 'sent'`).

### Concurrency

`WORKER_CONCURRENCY` sets how many jobs a worker runs in parallel. Multiple worker processes can run against the same queue, because the rate limiting and de-duplication state lives in Redis and Postgres, not in memory.

### Delay between emails (throttling)

I use the BullMQ worker **limiter**: `{ max: 1, duration: MIN_DELAY_BETWEEN_EMAILS_MS }`. The default is **one send every 2 seconds**, and it is enforced **globally across all workers**, mimicking provider throttling. Per-batch spacing is also applied at schedule time via `delayBetweenMs`.

### Hourly rate limiting

- A Redis **Lua script** atomically increments the counter `rl:{senderId}:{hourWindow}` (`hourWindow = floor(now / 1h)`) and rolls it back if the limit is exceeded. Atomicity makes it safe across many workers and instances.
- The limit is `hourlyLimit` from the request if provided, otherwise `MAX_EMAILS_PER_HOUR_PER_SENDER`. Nothing is hardcoded.
- When a sender is over its limit, the job is **not dropped or failed**. The worker moves it to the start of the next hour window with `job.moveToDelayed`, then throws BullMQ's `DelayedError`, which doesn't consume a retry attempt.
- Order is preserved approximately: each deferred job gets a small offset (`seq × 5 ms`) so the original sequence is kept when the window opens.
- The row's `scheduled_at` is updated so the dashboard shows the new time.

**Trade-off:** the counter is per sender per hour, shared by all batches. If sender A already sent 100 emails this hour from an earlier batch, a new batch's emails on A wait for the next window. This is deliberate: it models a real provider quota.

### Behavior under load (1000+ emails at the same time)

- The request is a single bulk insert plus bulk enqueue in chunks of 500.
- Jobs become due together, but the global limiter admits one send per `MIN_DELAY_BETWEEN_EMAILS_MS`, and the per-sender counters cap each sender per hour.
- Over-limit jobs are rescheduled into the next hour windows, so a backlog drains over successive hours instead of failing. Slack is notified once per sender per window, not once per job.

### Slack notifications

1. **Connect Slack** calls `GET /api/slack/connect`, which returns a real Slack authorize URL. The `state` is a signed, short-lived JWT carrying the user id.
2. Slack redirects to `/api/slack/callback`, which exchanges the code and stores the incoming-webhook URL per user in `slack_connections`.
3. When a sender hits its hourly limit, the worker posts a message to that user's webhook.
4. **Not connected:** the lookup returns nothing and the notification is skipped, with no crash. **Connected later:** it works immediately, because the connection is read from the DB at notify time, with no redeploy.
5. `DELETE /api/slack` disconnects.

### Search

Emails are indexed in Elasticsearch on creation and updated on status change. `GET /api/emails/search?q=...&status=...` runs a fuzzy multi-field match on recipient, subject and body, scoped to the logged-in user. If Elasticsearch is unavailable, indexing errors are logged and scheduling and sending continue.

### Live queue dashboard

Bull Board is mounted at `/admin/queues` (basic auth).

---

## API reference

| Method | Path | Description |
|---|---|---|
| GET | `/auth/google` | Start Google login |
| GET | `/auth/google/callback` | OAuth callback, sets cookie, redirects to the dashboard |
| GET | `/auth/me` | Current user (name, email, avatar) |
| POST | `/auth/logout` | Clear session |
| POST | `/api/emails/schedule` | Schedule a batch |
| GET | `/api/emails/scheduled` | Scheduled and processing emails |
| GET | `/api/emails/sent` | Sent and failed emails |
| GET | `/api/emails/counts` | Sidebar counts (`scheduled`, `sent`) |
| GET | `/api/emails/search` | Elasticsearch-ranked search (`q`, `status`); falls back to Postgres `ILIKE` if ES is down |
| GET | `/api/emails/:id` | Single email with body and sender |
| GET | `/api/senders` | Available sender accounts (From dropdown) |
| GET | `/api/slack/connect` | Slack authorize URL |
| GET | `/api/slack/callback` | Slack OAuth callback |
| GET | `/api/slack/status` | Connection status |
| DELETE | `/api/slack` | Disconnect Slack |
| GET | `/health` | Health check |

Schedule request (`hourlyLimit` and `senderId` are optional; without `senderId`, senders rotate round-robin):

```json
{
  "subject": "Hello",
  "body": "Message body",
  "recipients": ["a@example.com", "b@example.com"],
  "startTime": "2026-11-01T10:00:00.000Z",
  "delayBetweenMs": 3000,
  "hourlyLimit": 100,
  "senderId": 1
}
```

---

## Features implemented

### Backend

| Requirement | Status |
|---|---|
| Schedule via API, store in Postgres | Done |
| BullMQ delayed jobs, no cron | Done |
| Multiple senders via Ethereal | Done (round-robin) |
| Restart persistence, no duplicates | Done (Redis AOF + reconcile + idempotent job ids) |
| Configurable worker concurrency | Done |
| Minimum delay between sends | Done (BullMQ limiter) |
| Hourly limit, Redis-backed, multi-worker safe | Done (Lua counter) |
| Over-limit jobs rescheduled, not dropped | Done |
| Slack notification on limit hit | Implemented (OAuth connect, per-user webhook, message on limit hit; see Slack setup) |
| Elasticsearch search | Done |
| Live BullMQ dashboard | Done (Bull Board) |
| Google OAuth | Done |

### Frontend

| Requirement | Status |
|---|---|
| Real Google OAuth login, redirect to dashboard | Done |
| User name, email and avatar shown (sidebar user card) | Done |
| Logout | Done (user menu) |
| Scheduled and Sent sections with live counts | Done |
| "Compose" primary action | Done |
| Compose: subject, rich-text body (TipTap) | Done |
| Compose: upload CSV/text list, shows number of addresses detected | Done |
| Compose: start time ("Send Later" picker), delay between emails, hourly limit | Done |
| From selector (rotate senders or pin one) | Done |
| Scheduled table: email, subject, scheduled time, status | Done |
| Sent table: email, subject, sent time, status (`sent` / `failed`) | Done |
| Loading skeletons, empty states, error toasts and retry | Done |
| Search (Elasticsearch-backed) | Done |
| Email detail view | Done |
| Connect / disconnect Slack | Done (user menu) |
| Auto-refresh | Done (10 s polling) |

Design note: the layout follows the provided Figma (sidebar, list rows with time pills, compose screen). The email/password login form in the design is rendered but disabled, because the assignment requires Google login only.

---

## Assumptions, shortcuts and trade-offs

- **Delivery is at-least-once.** If a worker crashes after SMTP accepts a message but before the DB update, that single email could be sent again on retry. A strict exactly-once guarantee would need an outbox or provider-side idempotency keys, which Ethereal doesn't offer.
- **Hourly windows are fixed clock hours**, not sliding windows. This is simple and cheap in Redis, but allows a burst across a window boundary.
- **Senders are Ethereal test accounts** created automatically. Mail never reaches real inboxes; use the preview URLs.
- **Rate-limit counters are per sender**, shared across batches (see above).
- **The recipient list is parsed in the browser** and sent as a JSON array. Very large lists are bounded by the 10 MB JSON limit and 50,000 recipients per request.
- **Raw SQL migrations** run on boot (`CREATE TABLE IF NOT EXISTS`) instead of a migration tool, to keep setup to one command.
- `DEV_AUTH_BYPASS` exists only for local testing and must stay `false` in any shared environment.
- Slack requires an https redirect URI, so local testing needs a tunnel such as ngrok.

## Demo checklist

1. Schedule a batch from the dashboard and show the Scheduled tab.
2. Show the Sent tab filling in, and the Bull Board queue live.
3. **Restart scenario:** schedule ~10 emails 90 seconds out, stop the worker, start it again, and show they still send exactly once.
4. **Rate limit:** set `MAX_EMAILS_PER_HOUR_PER_SENDER=2`, schedule a batch, and show the deferred rows' new `scheduled_at` and the Slack message.#   o u t b o x - a s s i g n m e n t  
 