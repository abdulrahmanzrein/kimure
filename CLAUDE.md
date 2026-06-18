# Kimure Repository Guide

This is the shared Phase 2 team repository, not a repository for one team
member's work.

> **This file is a living progress tracker.** Every time a piece of work is
> finished, check it off in the "Progress Tracker" section below and move the
> next task's details up. A fresh Claude session should be able to read this
> file and immediately know what is done and what to build next.

Read these files before making architectural changes:

- `README.md`
- `docs/README.md`
- `docs/project/02-phase-2-working-summary.md`
- `docs/integrations/ai-gateway.md`

Active applications:

- `apps/web`: Next.js website (currently mostly static HTML in `public/`)
- `apps/api`: NestJS API

Infrastructure:

- `supabase/migrations`: database and RLS migrations

Reference only:

- `archive/phase-1-static-site`: original static website snapshot

Keep private keys out of browser code and Git. The website may use the
Supabase publishable key. Service-role, AI Gateway, Gemini, Stripe, and other
private credentials stay server-side.

JT owns AI Gateway internals and Gemini logic. The Kimure API owns Supabase
authentication, stable `/api/ai/*` routes, validation, user context, and
forwarding to that Gateway.

---

## Working Style (read before generating code)

The repo owner (Abdul) wants to **understand every file**. When generating code:

- **Minimum work required.** Build only the skeleton for the current step. No
  extra files, no speculative abstractions, no "senior-level" cleverness.
- **One step at a time.** Generate one route/feature, test it, then move on.
- **Add comments** explaining what each piece does, in plain language.
- **Clean, predictable folder structure** so it's obvious where to work.
- Match the existing simple style (see `apps/api/src/ai` and `auth`).

---

## Dev Workflow (how to run + test the API)

**Environment gotchas already solved (do not re-debug these):**

- Node must run **inside WSL**, not Windows. Use **Node 22+** via `nvm`
  (`nvm use 22`). Node 22 has native WebSocket, which `@supabase/supabase-js`
  needs — older Node throws a "WebSocket not supported" error.
- `apps/api/.env` exists locally (gitignored) and holds the Supabase URL +
  publishable key. If auth returns `503 ... not configured`, the `.env` is
  missing or empty.
- Port 3001 often gets stuck with an old server. If you see `EADDRINUSE`, run
  `npx kill-port 3001` first. Only **one** server should run at a time.

**Run the server (Terminal 1, inside `apps/api`):**

```bash
nvm use 22
npx kill-port 3001
npm run start:dev
```

Wait for: `Kimure backend running at http://localhost:3001/api`

**Test a protected route (Terminal 2):**

There is a helper script at repo root: `test.sh`. It logs in, grabs a fresh
Supabase token, and calls `GET /api/users/me`. Run:

```bash
bash /mnt/c/Users/abdul/Downloads/kimuntu/test.sh
```

To test a different route, edit the last `curl` line in `test.sh`. The token is
valid for 1 hour, so the script re-fetches it each run.

**Testing the website against the API (browser):** serve the static site on
port **3000** (`cd apps/web/public && npx serve -l 3000`) and open
`http://localhost:3000/...`. The browser enforces CORS; `main.ts` only allows
the origin in `CORS_ORIGINS` (default `http://localhost:3000`). Opening pages as
`file://` or on another port will fail with a CORS error — not a code bug. The
frontend's API base URL is set in `apps/web/public/supabase-config.js`
(`apiBaseUrl`). Note: login/auth still goes browser→Supabase directly; only data
flows route through the API.

---

## Architecture in one picture

```
Website / Mobile
  -> Kimure NestJS API (apps/api)   <- auth, validation, logging, rate limits
  -> JT AI Gateway                  <- prompts, model choice, structured output
  -> Gemini
```

Abdul owns the middle box. He is the **middleman**: authenticate the user,
validate the request, log it, forward it, handle errors, return the response.
He does NOT implement Gemini or AI logic.

The website currently talks **directly** to Supabase for auth + onboarding. A
major goal of the remaining work is to route those flows **through the API**
instead, so the backend can validate, log, and control them.

---

## Current API Surface

```
GET  /api/health          public   - liveness check
POST /api/ai/:tool        auth      - forwards to JT's AI Gateway (8 tools)
GET  /api/users/me        auth      - returns the logged-in user's profile
GET  /api/onboarding      auth      - returns the user's onboarding answers
POST /api/onboarding      auth      - create/update the user's onboarding answers
```

Folder layout (`apps/api/src`):

```
src/
├── main.ts                       app bootstrap (port, CORS, /api prefix)
├── app.module.ts                 wires controllers + providers together
├── auth/
│   └── supabase-auth.guard.ts    verifies Supabase Bearer token
├── ai/
│   ├── ai.controller.ts          POST /api/ai/:tool
│   └── ai-gateway.service.ts     forwards request to JT's Gateway
├── users/
│   ├── users.controller.ts       GET /api/users/me
│   └── users.service.ts          reads profiles table (passes user token for RLS)
└── onboarding/
    ├── onboarding.controller.ts  GET + POST /api/onboarding
    └── onboarding.service.ts     reads/upserts onboarding_profiles
```

**Pattern to copy for new features:** a folder with a `*.controller.ts`
(routes) and a `*.service.ts` (Supabase/database logic), both registered in
`app.module.ts`. To make RLS work, the service creates the Supabase client with
the user's token in a `global.headers.Authorization` Bearer header (see
`users.service.ts`).

---

## Progress Tracker

### ✅ Done

- [x] Supabase project + migrations (schema + RLS) — `supabase/migrations`
- [x] Profile auto-creation trigger on signup
- [x] Website signup / login / logout / onboarding persistence (direct to Supabase)
- [x] NestJS backend foundation + `GET /api/health`
- [x] `SupabaseAuthGuard` — verifies Supabase access tokens
- [x] `POST /api/ai/:tool` — authenticated AI proxy routes + integration contract
- [x] **`GET /api/users/me`** — returns the logged-in user's profile (tested end-to-end)
- [x] **`GET` + `POST /api/onboarding`** — read/upsert onboarding answers in
  `onboarding_profiles` (tested end-to-end). Test script: `test-onboarding.sh`.
- [x] **Onboarding frontend wired to the API** — `auth.js`
  (`saveOnboardingProfile` / `fetchOnboardingProfile`) now calls `POST` / `GET
  /api/onboarding` with the user's Bearer token instead of Supabase directly
  (verified in the browser). API base URL lives in `supabase-config.js`
  (`apiBaseUrl`). Login still goes browser→Supabase; only data routes through the API.

### ⬜ Next (in build order)

Each task = one folder under `apps/api/src` with a controller + service,
registered in `app.module.ts`. Build one, test, then check it off.

#### 1. AI request logging — edit `src/ai/ai-gateway.service.ts`
After receiving JT's response, insert a row into `ai_requests`.
```
ai_requests: { user_id, engine, request_payload, response_payload, status, error_message }
```
- Needs a Supabase client. Simplest clean option: a small shared
  `SupabaseService` the AI + users services both use, OR reuse the existing
  per-request token client pattern.
- Log on both success and failure (set `status` + `error_message`).
- **Why:** compliance (PIPEDA/GDPR), debugging, future personalization, billing.

#### 2. Listings API — `src/listings/`
```
GET  /api/listings        - list properties (filters: city, price, type, status)
GET  /api/listings/:id    - one property's full details
POST /api/listings        - create a listing (partners only - role check later)
```
- Reads/writes `listings` table.
- `GET` can be public-ish (listings are marketplace data); `POST` needs auth +
  later a partner-role check.
- After this works, replace the hardcoded listings in
  `apps/web/public/marketplace.html` / `assets/js/marketplace.js` with a fetch
  to `/api/listings`.
- **Why:** first "it's real" moment — the marketplace shows live DB data.

#### 3. Saved properties (favorites) — `src/saved-properties/`
```
GET    /api/saved-properties       - my saved listings
POST   /api/saved-properties       - save a listing { listing_id }
DELETE /api/saved-properties/:id   - unsave
```
- Reads/writes `saved_properties` (unique on user_id + listing_id).

#### 4. Leads / CRM starter — `src/leads/`
```
POST /api/leads   - user requests agent contact -> creates a lead
GET  /api/leads   - user sees their leads (agents see theirs later)
```
- Reads/writes `leads` (status enum: new/contacted/negotiation/closed_won/closed_lost).
- **Why:** the business model — "the CRM monetizes user intent."

#### 5. Rate limiting — AI routes
Add a per-user limit (e.g. 10 req/min) on `POST /api/ai/:tool`.
- Consider `@nestjs/throttler`. Keep it minimal.
- **Why:** prevent abuse / runaway Gemini cost before production.

#### 6. Wire the remaining frontend flows to the backend
Onboarding is already wired (see Done). Do the same for the rest: change
`apps/web/public/assets/js/*.js` so listings, saved, leads, and AI-tool flows
call the API routes above instead of Supabase directly.
- **Why:** turns two separate pieces into one connected platform. After this,
  every user action flows through the backend where it can be controlled.

### 🔮 Later (not yet scoped)

- Partner/agent dashboard routes (manage own leads + listings)
- Admin dashboard routes (approve partners, RBAC, usage, revenue)
- `ai_reports` persistence (user-facing report history)
- Role-based access control (RBAC) enforcement in the API
- Stripe subscriptions/payments
- Production deployment (API + web)
- Mobile app backend connection
- Integration / e2e tests

---

## How to update this file

When a task in **Next** is finished and tested:

1. Move its `- [ ]` line to the **Done** section as `- [x]` with a one-line note.
2. Delete its detailed block from **Next** (or trim to a one-liner).
3. If the API surface changed, update the **Current API Surface** section.
4. If a new env var or gotcha appeared, add it to **Dev Workflow**.

Keep it short and current — this is the first thing a new session reads.
