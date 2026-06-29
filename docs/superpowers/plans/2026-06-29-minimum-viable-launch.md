# Minimum Viable Launch Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Get Kimure live at a real URL where users can sign up, browse listings, save properties, and contact an agent.

**Architecture:** Add two thin API modules (saved-properties and leads) following the existing onboarding pattern. Seed 4 real listings into Supabase so the foreign key in `saved_properties` works. Deploy the static web to Netlify and the NestJS API to Railway.

**Tech Stack:** NestJS, Supabase (PostgreSQL + RLS), vanilla JS frontend, Railway (API hosting), Netlify (web hosting)

---

### Task 1: Seed listings into Supabase + fix mock provider IDs

The `saved_properties.listing_id` column requires a real UUID from `public.listings`. The mock provider currently uses string IDs like `"mock-ottawa-family-home"` that aren't valid UUIDs and don't exist in the DB. Fix both sides.

**Files:**
- Modify: `apps/api/src/listings/mock-listings.provider.ts`

- [ ] **Step 1: Run this SQL in the Supabase SQL Editor**

Go to your Supabase project → SQL Editor → paste and run:

```sql
insert into public.listings (id, title, listing_type, price, location, status, metadata) values
  (
    '11111111-1111-1111-1111-000000000001',
    'Sample family home near parks and transit',
    'residential', 685000, 'Ottawa, Ontario', 'active',
    '{"bedrooms":3,"bathrooms":2,"propertySize":"1,850 sq ft","addressSummary":"West Ottawa neighbourhood sample","matchSignals":["family-friendly","transit access","primary residence"]}'
  ),
  (
    '11111111-1111-1111-1111-000000000002',
    'Sample downtown rental condo',
    'residential', 2850, 'Toronto, Ontario', 'active',
    '{"bedrooms":2,"bathrooms":2,"propertySize":"820 sq ft","addressSummary":"Central Toronto rental sample","matchSignals":["rental","walkable","commuter-friendly"]}'
  ),
  (
    '11111111-1111-1111-1111-000000000003',
    'Sample investment townhome',
    'residential', 525000, 'Calgary, Alberta', 'active',
    '{"bedrooms":3,"bathrooms":3,"propertySize":"1,620 sq ft","addressSummary":"Northwest Calgary investment sample","matchSignals":["investment","rental potential","growth corridor"]}'
  ),
  (
    '11111111-1111-1111-1111-000000000004',
    'Sample rural land parcel',
    'land', 240000, 'Eastern Ontario', 'active',
    '{"bedrooms":0,"bathrooms":0,"propertySize":"18 acres","addressSummary":"Rural acreage sample","matchSignals":["rural land","long-term hold","development due diligence"]}'
  )
on conflict (id) do nothing;
```

Expected output: "Success. 4 rows affected."

- [ ] **Step 2: Update mock provider to use the real UUIDs**

Open `apps/api/src/listings/mock-listings.provider.ts`. Replace only the `id` field in each listing:

```typescript
const MOCK_LISTINGS: NormalizedListing[] = [
  {
    id: "11111111-1111-1111-1111-000000000001",
    title: "Sample family home near parks and transit",
    // ... rest unchanged
  },
  {
    id: "11111111-1111-1111-1111-000000000002",
    title: "Sample downtown rental condo",
    // ... rest unchanged
  },
  {
    id: "11111111-1111-1111-1111-000000000003",
    title: "Sample investment townhome",
    // ... rest unchanged
  },
  {
    id: "11111111-1111-1111-1111-000000000004",
    title: "Sample rural land parcel",
    // ... rest unchanged
  }
];
```

- [ ] **Step 3: Commit**

```bash
git add apps/api/src/listings/mock-listings.provider.ts
git commit -m "feat(api): use real Supabase UUIDs in mock listings provider"
```

---

### Task 2: Saved Properties API

**Files:**
- Create: `apps/api/src/saved-properties/saved-properties.service.ts`
- Create: `apps/api/src/saved-properties/saved-properties.controller.ts`
- Modify: `apps/api/src/app.module.ts`

- [ ] **Step 1: Create the service**

Create `apps/api/src/saved-properties/saved-properties.service.ts`:

```typescript
import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { createClient, SupabaseClient } from "@supabase/supabase-js";

@Injectable()
export class SavedPropertiesService {
  constructor(private readonly config: ConfigService) {}

  // Returns all listings the user has saved.
  async getSaved(userId: string, accessToken: string) {
    const client = this.getSupabaseClient(accessToken);
    const { data, error } = await client
      .from("saved_properties")
      .select("id, listing_id, created_at")
      .eq("user_id", userId)
      .order("created_at", { ascending: false });
    if (error) return [];
    return data;
  }

  // Saves a listing for the user. The unique constraint on (user_id, listing_id)
  // prevents duplicates — Supabase returns an error if already saved.
  async save(userId: string, accessToken: string, listingId: string) {
    const client = this.getSupabaseClient(accessToken);
    const { data, error } = await client
      .from("saved_properties")
      .insert({ user_id: userId, listing_id: listingId })
      .select()
      .single();
    if (error) return { error: error.message };
    return data;
  }

  // Removes a saved listing by its saved_properties row id.
  // The .eq("user_id", userId) ensures a user can only delete their own saves.
  async unsave(userId: string, accessToken: string, id: string) {
    const client = this.getSupabaseClient(accessToken);
    const { error } = await client
      .from("saved_properties")
      .delete()
      .eq("id", id)
      .eq("user_id", userId);
    if (error) return { error: error.message };
    return { deleted: true };
  }

  // Uses the user's own Bearer token so RLS allows them to read/write only their rows.
  private getSupabaseClient(accessToken: string): SupabaseClient {
    const url = this.config.get<string>("SUPABASE_URL")!;
    const publishableKey = this.config.get<string>("SUPABASE_PUBLISHABLE_KEY")!;
    return createClient(url, publishableKey, {
      auth: { autoRefreshToken: false, persistSession: false },
      global: { headers: { Authorization: `Bearer ${accessToken}` } }
    });
  }
}
```

- [ ] **Step 2: Create the controller**

Create `apps/api/src/saved-properties/saved-properties.controller.ts`:

```typescript
import { Body, Controller, Delete, Get, Param, Post, Req, UseGuards } from "@nestjs/common";
import { AuthenticatedRequest, SupabaseAuthGuard } from "../auth/supabase-auth.guard";
import { SavedPropertiesService } from "./saved-properties.service";

@Controller("saved-properties")
@UseGuards(SupabaseAuthGuard)
export class SavedPropertiesController {
  constructor(private readonly savedProperties: SavedPropertiesService) {}

  // GET /api/saved-properties
  @Get()
  async getAll(@Req() request: AuthenticatedRequest) {
    const userId = request.user!.id;
    const token = request.headers.authorization!.replace("Bearer ", "");
    return this.savedProperties.getSaved(userId, token);
  }

  // POST /api/saved-properties — body: { listing_id: "uuid" }
  @Post()
  async save(
    @Body() body: { listing_id: string },
    @Req() request: AuthenticatedRequest
  ) {
    const userId = request.user!.id;
    const token = request.headers.authorization!.replace("Bearer ", "");
    return this.savedProperties.save(userId, token, body.listing_id);
  }

  // DELETE /api/saved-properties/:id
  @Delete(":id")
  async unsave(@Param("id") id: string, @Req() request: AuthenticatedRequest) {
    const userId = request.user!.id;
    const token = request.headers.authorization!.replace("Bearer ", "");
    return this.savedProperties.unsave(userId, token, id);
  }
}
```

- [ ] **Step 3: Register in app.module.ts**

Replace the full contents of `apps/api/src/app.module.ts` with:

```typescript
import { Controller, Get, Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { AiController } from "./ai/ai.controller";
import { AiGatewayService } from "./ai/ai-gateway.service";
import { CreditConsentsService } from "./ai/credit-consents.service";
import { CreditAssessmentsService } from "./ai/credit-assessments.service";
import { UserFinancialProfilesService } from "./ai/user-financial-profiles.service";
import { SupabaseAuthGuard } from "./auth/supabase-auth.guard";
import { DashboardController } from "./dashboard/dashboard.controller";
import { DashboardService } from "./dashboard/dashboard.service";
import { UsersController } from "./users/users.controller";
import { UsersService } from "./users/users.service";
import { OnboardingController } from "./onboarding/onboarding.controller";
import { OnboardingService } from "./onboarding/onboarding.service";
import { ListingsModule } from "./listings/listings.module";
import { CreditProviderStatusController } from "./credit/credit-provider-status.controller";
import { CreditProviderStatusService } from "./credit/credit-provider-status.service";
import { CreditProviderVerificationService } from "./credit/credit-provider-verification.service";
import { SavedPropertiesController } from "./saved-properties/saved-properties.controller";
import { SavedPropertiesService } from "./saved-properties/saved-properties.service";
import { LeadsController } from "./leads/leads.controller";
import { LeadsService } from "./leads/leads.service";

@Controller("health")
class HealthController {
  @Get()
  getHealth() {
    return {
      status: "ok",
      service: "kimure-api",
      timestamp: new Date().toISOString()
    };
  }
}

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ListingsModule
  ],
  controllers: [
    HealthController,
    AiController,
    CreditProviderStatusController,
    DashboardController,
    UsersController,
    OnboardingController,
    SavedPropertiesController,
    LeadsController
  ],
  providers: [
    AiGatewayService,
    CreditAssessmentsService,
    CreditConsentsService,
    CreditProviderStatusService,
    CreditProviderVerificationService,
    UserFinancialProfilesService,
    DashboardService,
    SupabaseAuthGuard,
    UsersService,
    OnboardingService,
    SavedPropertiesService,
    LeadsService
  ]
})
export class AppModule {}
```

- [ ] **Step 4: Smoke test**

Start the API locally (`nvm use 22 && npm run start:dev` inside `apps/api`). Get a token from `test.sh`, then:

```bash
TOKEN="paste-your-token-here"

# Save a listing
curl -s -X POST http://localhost:3001/api/saved-properties \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"listing_id":"11111111-1111-1111-1111-000000000001"}' | cat

# List saved
curl -s http://localhost:3001/api/saved-properties \
  -H "Authorization: Bearer $TOKEN" | cat
```

Expected POST: `{"id":"...","user_id":"...","listing_id":"11111111-1111-1111-1111-000000000001","created_at":"..."}`
Expected GET: array with one row.

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/saved-properties/ apps/api/src/app.module.ts
git commit -m "feat(api): add GET/POST/DELETE /api/saved-properties"
```

---

### Task 3: Leads API

**Files:**
- Create: `apps/api/src/leads/leads.service.ts`
- Create: `apps/api/src/leads/leads.controller.ts`

(`app.module.ts` was already updated in Task 2 Step 3)

- [ ] **Step 1: Create the service**

Create `apps/api/src/leads/leads.service.ts`:

```typescript
import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { createClient, SupabaseClient } from "@supabase/supabase-js";

@Injectable()
export class LeadsService {
  constructor(private readonly config: ConfigService) {}

  // Returns all leads the user has submitted.
  async getLeads(userId: string, accessToken: string) {
    const client = this.getSupabaseClient(accessToken);
    const { data, error } = await client
      .from("leads")
      .select("id, listing_id, status, intent_data, created_at")
      .eq("user_id", userId)
      .order("created_at", { ascending: false });
    if (error) return [];
    return data;
  }

  // Creates a lead when a user clicks "Contact agent".
  // listing_id is optional — the leads table allows null there.
  async createLead(
    userId: string,
    accessToken: string,
    listingId: string | null,
    intentData: Record<string, unknown>
  ) {
    const client = this.getSupabaseClient(accessToken);
    const row: Record<string, unknown> = { user_id: userId, intent_data: intentData };
    if (listingId) row.listing_id = listingId;

    const { data, error } = await client
      .from("leads")
      .insert(row)
      .select()
      .single();
    if (error) return { error: error.message };
    return data;
  }

  private getSupabaseClient(accessToken: string): SupabaseClient {
    const url = this.config.get<string>("SUPABASE_URL")!;
    const publishableKey = this.config.get<string>("SUPABASE_PUBLISHABLE_KEY")!;
    return createClient(url, publishableKey, {
      auth: { autoRefreshToken: false, persistSession: false },
      global: { headers: { Authorization: `Bearer ${accessToken}` } }
    });
  }
}
```

- [ ] **Step 2: Create the controller**

Create `apps/api/src/leads/leads.controller.ts`:

```typescript
import { Body, Controller, Get, Post, Req, UseGuards } from "@nestjs/common";
import { AuthenticatedRequest, SupabaseAuthGuard } from "../auth/supabase-auth.guard";
import { LeadsService } from "./leads.service";

@Controller("leads")
@UseGuards(SupabaseAuthGuard)
export class LeadsController {
  constructor(private readonly leads: LeadsService) {}

  // GET /api/leads
  @Get()
  async getLeads(@Req() request: AuthenticatedRequest) {
    const userId = request.user!.id;
    const token = request.headers.authorization!.replace("Bearer ", "");
    return this.leads.getLeads(userId, token);
  }

  // POST /api/leads — body: { listing_id?: "uuid", intent_data?: {} }
  @Post()
  async createLead(
    @Body() body: { listing_id?: string; intent_data?: Record<string, unknown> },
    @Req() request: AuthenticatedRequest
  ) {
    const userId = request.user!.id;
    const token = request.headers.authorization!.replace("Bearer ", "");
    return this.leads.createLead(
      userId,
      token,
      body.listing_id || null,
      body.intent_data || {}
    );
  }
}
```

- [ ] **Step 3: Smoke test**

```bash
TOKEN="paste-your-token-here"

curl -s -X POST http://localhost:3001/api/leads \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"listing_id":"11111111-1111-1111-1111-000000000001","intent_data":{"source":"marketplace","message":"Interested in this listing"}}' | cat
```

Expected: `{"id":"...","user_id":"...","listing_id":"11111111-...","status":"new","intent_data":{...},"created_at":"..."}`

- [ ] **Step 4: Commit**

```bash
git add apps/api/src/leads/
git commit -m "feat(api): add GET/POST /api/leads"
```

---

### Task 4: Save and Contact Agent buttons in marketplace.js

**Files:**
- Modify: `apps/web/public/assets/js/marketplace.js`
- Modify: `apps/web/public/assets/css/marketplace.css`

- [ ] **Step 1: Add `saveListing` function**

Inside the IIFE in `marketplace.js`, add this function directly after the closing `}` of `renderProviderListingCard`:

```javascript
async function saveListing(listingId, btn) {
  var token = await getAccessToken();
  if (!token) {
    btn.textContent = "Sign in to save";
    setTimeout(function () { btn.textContent = "Save listing"; }, 2000);
    return;
  }
  btn.disabled = true;
  btn.textContent = "Saving...";
  try {
    var res = await fetch(getApiBaseUrl() + "/saved-properties", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": "Bearer " + token },
      body: JSON.stringify({ listing_id: listingId })
    });
    btn.textContent = res.ok ? "Saved!" : "Save listing";
    if (!res.ok) btn.disabled = false;
  } catch (err) {
    btn.textContent = "Save listing";
    btn.disabled = false;
  }
}
```

- [ ] **Step 2: Add `contactAgent` function**

Directly after `saveListing`, add:

```javascript
async function contactAgent(listingId, listingTitle, btn) {
  var token = await getAccessToken();
  if (!token) {
    btn.textContent = "Sign in first";
    setTimeout(function () { btn.textContent = "Contact agent"; }, 2000);
    return;
  }
  btn.disabled = true;
  btn.textContent = "Sending...";
  try {
    var res = await fetch(getApiBaseUrl() + "/leads", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": "Bearer " + token },
      body: JSON.stringify({
        listing_id: listingId,
        intent_data: { source: "marketplace", listing_title: listingTitle }
      })
    });
    btn.textContent = res.ok ? "Agent contacted!" : "Contact agent";
    if (!res.ok) btn.disabled = false;
  } catch (err) {
    btn.textContent = "Contact agent";
    btn.disabled = false;
  }
}
```

- [ ] **Step 3: Add buttons inside `renderProviderListingCard`**

At the very end of `renderProviderListingCard`, just before its closing `}`, add:

```javascript
  var actions = appendNode(card, "div", "mp-provider-card-actions");

  var saveBtn = document.createElement("button");
  saveBtn.className = "btn btn-outline mp-save-btn";
  saveBtn.textContent = "Save listing";
  saveBtn.addEventListener("click", function () {
    saveListing(listing.id, saveBtn);
  });
  actions.appendChild(saveBtn);

  var contactBtn = document.createElement("button");
  contactBtn.className = "btn btn-primary mp-contact-btn";
  contactBtn.textContent = "Contact agent";
  contactBtn.addEventListener("click", function () {
    contactAgent(listing.id, listing.title || "this listing", contactBtn);
  });
  actions.appendChild(contactBtn);
```

- [ ] **Step 4: Add CSS for the action row**

At the bottom of `apps/web/public/assets/css/marketplace.css`, add:

```css
.mp-provider-card-actions {
  display: flex;
  gap: 0.5rem;
  margin-top: 1rem;
}

.mp-provider-card-actions .btn {
  flex: 1;
  font-size: 0.85rem;
  padding: 0.5rem 0.75rem;
}
```

- [ ] **Step 5: Test in browser**

```bash
cd apps/web/public && npx serve -l 3000
```

Open `http://localhost:3000/marketplace.html` → click "Search preview" → cards should appear with Save and Contact agent buttons.

1. Click Save without logging in → button shows "Sign in to save" then resets.
2. Log in, click Save → shows "Saved!". Check Supabase → `saved_properties` has a new row.
3. Click "Contact agent" → shows "Agent contacted!". Check Supabase → `leads` has a new row with `status: "new"`.

- [ ] **Step 6: Commit**

```bash
git add apps/web/public/assets/js/marketplace.js apps/web/public/assets/css/marketplace.css
git commit -m "feat(web): add save listing and contact agent buttons to marketplace cards"
```

---

### Task 5: Deploy API to Railway

- [ ] **Step 1: Create a Railway project**

Go to railway.app → sign in with GitHub → "New Project" → "Deploy from GitHub repo" → select `kimure` repo.

When asked for the **Root Directory**, enter: `apps/api`

- [ ] **Step 2: Set environment variables**

In Railway → your service → "Variables" tab, add all of these:

```
NODE_ENV=production
SUPABASE_URL=https://YOUR_PROJECT_ID.supabase.co
SUPABASE_PUBLISHABLE_KEY=your-supabase-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-supabase-service-role-key
AI_GATEWAY_BASE_URL=http://localhost:4000
AI_GATEWAY_TIMEOUT_MS=30000
CORS_ORIGINS=http://localhost:3000
```

(Update `CORS_ORIGINS` to the Netlify URL after Task 6.)

- [ ] **Step 3: Set build and start commands**

In Railway → your service → "Settings":
- Build command: `npm run build`
- Start command: `npm run start`

Railway injects `PORT` automatically. The API reads it from env.

- [ ] **Step 4: Confirm the deploy**

Wait 2-3 minutes for the build. Once live, test:

```bash
curl https://YOUR-RAILWAY-URL.up.railway.app/api/health
```

Expected: `{"status":"ok","service":"kimure-api","timestamp":"..."}`

Note down the Railway URL — you need it in Task 6.

---

### Task 6: Deploy Web to Netlify

- [ ] **Step 1: Create the production supabase-config.js locally**

Create `apps/web/public/supabase-config.js` (this file is gitignored — do not commit it):

```javascript
window.KIMURE_SUPABASE_CONFIG = {
  url: "https://YOUR_PROJECT_ID.supabase.co",
  anonKey: "your-supabase-anon-key",
  apiBaseUrl: "https://YOUR-RAILWAY-URL.up.railway.app/api"
};
```

Find the values in Supabase → Project Settings → API.
Replace `YOUR-RAILWAY-URL` with the URL from Task 5.

- [ ] **Step 2: Deploy to Netlify**

Go to netlify.com → "Add new site" → "Deploy manually".

Drag and drop the entire `apps/web/public/` folder (the one containing `index.html`, `marketplace.html`, etc.) onto the Netlify upload zone.

Wait ~30 seconds. Netlify gives you a URL like `https://radiant-unicorn-abc123.netlify.app`.

- [ ] **Step 3: Give the site a readable name (optional)**

Netlify → Site configuration → Site details → "Change site name" → set something like `kimure-app` so the URL becomes `https://kimure-app.netlify.app`.

- [ ] **Step 4: Update CORS_ORIGINS on Railway**

Go to Railway → Variables → update:

```
CORS_ORIGINS=https://kimure-app.netlify.app
```

Railway redeploys automatically (~1 minute).

- [ ] **Step 5: End-to-end test in incognito**

Open the Netlify URL in an incognito window:

1. Click "Get Early Access" → sign up → complete onboarding → confirm it saves.
2. Go to Marketplace → "Search preview" → listings appear with Save and Contact agent buttons.
3. Click "Save listing" → shows "Saved!".
4. Click "Contact agent" → shows "Agent contacted!".
5. Check Supabase table editor → `saved_properties` and `leads` have new rows.

The site is now live.
