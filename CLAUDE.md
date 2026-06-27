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
POST /api/ai/:tool        auth      - forwards to JT's AI Gateway (8 tools).
                                      credit-profile + mortgage have extra
                                      handling (see Credit/AI notes below)
GET  /api/users/me        auth      - returns the logged-in user's profile
GET  /api/onboarding      auth      - returns the user's onboarding answers
POST /api/onboarding      auth      - create/update the user's onboarding answers
GET  /api/listings        public   - list properties (filters: location,
                                      listing_type, status, price_min, price_max)
GET  /api/listings/:id    public   - one property's full details
POST /api/listings        auth      - create a listing (partner-role check TODO)
```

The 8 AI tools are: `chat, scout, analyze, rental, valuate, mortgage,
credit-profile, investment-planner`. `credit-profile` responses are persisted
via `CreditAssessmentsService` (table `credit_assessments`, migration `003`);
`mortgage` resolves a prior credit assessment before forwarding. This credit/AI
work landed via PR #1 and #3 (Josh) — see the contract in
`src/ai/credit-ai.contract.ts` and `docs/project/credit-ai-contract.md`.

Folder layout (`apps/api/src`):

```
src/
├── main.ts                       app bootstrap (port, CORS, /api prefix)
├── app.module.ts                 wires controllers + providers together
├── auth/
│   └── supabase-auth.guard.ts    verifies Supabase Bearer token
├── supabase/
│   └── supabase.service.ts       builds Supabase clients: anon() / forUser(token) / service()
├── ai/
│   ├── ai.controller.ts          POST /api/ai/:tool (8 tools)
│   ├── ai-gateway.service.ts     forwards to JT's Gateway; logs each call
│   ├── ai-requests.service.ts    logs every AI call to ai_requests (service client)
│   ├── credit-ai.contract.ts     credit/mortgage input+output contract (Josh)
│   └── credit-assessments.service.ts  persists credit-profile, resolves mortgage (Josh)
├── users/
│   ├── users.controller.ts       GET /api/users/me
│   └── users.service.ts          reads profiles table (passes user token for RLS)
├── onboarding/
│   ├── onboarding.controller.ts  GET + POST /api/onboarding
│   └── onboarding.service.ts     reads/upserts onboarding_profiles
└── listings/
    ├── listings.controller.ts    GET (public) + POST (auth) /api/listings
    └── listings.service.ts       reads/writes listings (anon read, user-token write)
```

**Pattern to copy for new features:** a folder with a `*.controller.ts`
(routes) and a `*.service.ts` (Supabase/database logic), both registered in
`app.module.ts`. The service injects `SupabaseService` and picks the right
client for the job: `supabase.anon()` for public reads, `supabase.forUser(token)`
for the logged-in user's own rows (so `auth.uid()` works in RLS), or
`supabase.service()` for privileged server-side writes that bypass RLS. See
`listings.service.ts` (anon + user) or `users.service.ts` (user). Note: the auth
guard and Josh's `credit-assessments.service.ts` still build their own clients —
they can adopt `SupabaseService` later.

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
- [x] **Credit/AI contract + AI Gateway app** (Josh, PR #1) — added the
  `apps/ai-gateway` app, `src/ai/credit-ai.contract.ts` (input/output contract
  for `credit-profile` + `mortgage`), and the credit-profile / mortgage web
  pages. Docs: `docs/project/credit-ai-contract.md`.
- [x] **Credit assessment persistence** (Josh, PR #3) — `credit_assessments`
  table (migration `003`) + `src/ai/credit-assessments.service.ts`:
  `POST /api/ai/credit-profile` persists the result; `POST /api/ai/mortgage`
  resolves a prior assessment before forwarding to the Gateway.
  ⚠️ **Before Josh can run the live credit→mortgage persistence test**, the API
  env (`apps/api/.env`) needs: (1) migration `003` **applied to the live DB**
  (verify: `select count(*) from public.credit_assessments;` returns 0, not an
  error); (2) **`SUPABASE_SERVICE_ROLE_KEY`** filled in (currently EMPTY — paste
  from Supabase Project Settings → API → service_role); (3)
  `CREDIT_ASSESSMENT_HASH_SECRET` — **done** (set 2026-06-26). The service role
  key bypasses RLS, so it lives in `.env` only, never in web config.
- [x] **Listings API** — `src/listings/` (controller + service): `GET /api/listings`
  (public, filters: location / listing_type / status / price_min / price_max),
  `GET /api/listings/:id` (public), `POST /api/listings` (auth; partner-role check
  still TODO). Reads use the anon client, writes use the user-token client.
  Verified live: health + all three routes mapped, 200 on list, 404 on missing
  id, 401 on POST without token. Test script: `test-listings.sh` (repo root).
- [x] **Listings RLS** — migration `004_listings_rls.sql`, **applied to the live
  DB and verified.** Found during testing: the live DB had RLS **enabled on
  `listings` with no policies** (drift), so reads returned `[]` and inserts
  failed with "violates row-level security policy". 004 adds a public read policy
  (published only) + an authenticated insert policy. Confirmed via
  `test-listings.sh`: public LIST/DETAILS return data, authenticated POST creates
  a row. The marketplace frontend is still not wired to the API yet (see Next #5).
- [x] **Seed listings** — `supabase/seed_listings.sql` (NOT a migration): inserts
  6 published demo listings mirroring the marketplace's hardcoded cards
  (listing_type matches the page's data-type strings; card extras — roi, image,
  beds/acres, currency, description — live in `metadata` jsonb). Idempotent
  (deletes prior rows where `metadata->>'seed' = 'true'`). Run AFTER 004.
- [x] **AI request logging** — `src/ai/ai-requests.service.ts` (`AiRequestsService`),
  called from `ai-gateway.service.ts`. Every `POST /api/ai/:tool` call writes one
  row to `ai_requests` (engine, request_payload, response_payload, status,
  error_message): success on a good response, error on gateway rejection /
  timeout / unreachable. Uses the service-role client (bypasses RLS, writes for
  any user); `log()` never throws so a logging failure can't break the AI
  response. Registered in `app.module.ts`. ⚠️ Payloads stored as-is — redacting
  sensitive credit-profile fields is a future refinement.
- [x] **Marketplace frontend wired to the API** — `apps/web/public/assets/js/marketplace.js`
  now `fetch`es `GET /api/listings` and builds the featured cards from live DB
  data (price formatting, type/location, ROI or AI-fit badge, image from
  `metadata`), then runs the existing Buy/Sale/Rent/Invest distribution + search.
  Buy/Sale/Rent/Invest tabs don't exist in the DB, so modes are derived from
  `listing_type` (land/agri→buy/sale/invest, commercial→all, else buy/sale/rent).
  Falls back to the hardcoded demo cards if the API is empty/unreachable. Verified
  in the browser (7 listings render). Serve site on :3000, API on :3001 (CORS).

### ⬜ Next (in build order)

Each task = one folder under `apps/api/src` with a controller + service,
registered in `app.module.ts`. Build one, test, then check it off.

#### 1. Saved properties (favorites) — `src/saved-properties/`
```
GET    /api/saved-properties       - my saved listings
POST   /api/saved-properties       - save a listing { listing_id }
DELETE /api/saved-properties/:id   - unsave
```
- Reads/writes `saved_properties` (unique on user_id + listing_id).

#### 2. Leads / CRM starter — `src/leads/`
```
POST /api/leads   - user requests agent contact -> creates a lead
GET  /api/leads   - user sees their leads (agents see theirs later)
```
- Reads/writes `leads` (status enum: new/contacted/negotiation/closed_won/closed_lost).
- **Why:** the business model — "the CRM monetizes user intent."

#### 3. Rate limiting — AI routes
Add a per-user limit (e.g. 10 req/min) on `POST /api/ai/:tool`.
- Consider `@nestjs/throttler`. Keep it minimal.
- **Why:** prevent abuse / runaway Gemini cost before production.

#### 4. Wire the remaining frontend flows to the backend
Onboarding, credit-profile, mortgage, **and marketplace** are now wired (see
Done). Remaining: saved-properties and leads flows — wire those once their API
routes exist (tasks #1 and #2). Change the relevant
`apps/web/public/assets/js/*.js` so they call the API routes instead of Supabase
directly.
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
