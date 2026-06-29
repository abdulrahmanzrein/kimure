# Frontend Redesign Design Spec

**Date:** 2026-06-29
**Reference:** HouseSigma (housesigma.com)
**Approach:** Full HTML + CSS rewrite of 6 core pages. All existing JS functionality (auth, marketplace API, AI tools, save/contact buttons) stays untouched.

---

## Goal

Transform Kimure's current dark, cluttered, multi-dropdown frontend into a clean, light, professional real estate marketplace — similar in feel to HouseSigma. Every page should feel spacious, fast, and purposeful.

---

## Pages In Scope

| Page | File | Status |
|---|---|---|
| Homepage | `index.html` | Rewrite |
| Marketplace | `marketplace.html` | Rewrite |
| Dashboard | `dashboard.html` | Rewrite |
| Onboarding Form | `onboarding-form.html` | Rewrite |
| Credit Profile | `credit-profile.html` | Rewrite |
| Mortgage | `mortgage.html` | Rewrite |

## Pages to Remove

Delete these files — content either moves to footer or is redundant:
- `platform.html`
- `solutions.html`
- `investors.html`
- `about.html`
- `onboarding.html`

---

## Design System

### Colors
```css
--white: #FFFFFF;
--bg: #F7F8FA;          /* light gray for alternating sections */
--text: #111827;         /* near black */
--muted: #6B7280;        /* secondary text */
--muted2: #9CA3AF;       /* placeholders, labels */
--gold: #9F8049;         /* Kimure brand accent */
--gold-light: #F5EFE6;   /* gold tint for backgrounds */
--border: #E5E7EB;       /* subtle borders */
--green: #10B981;        /* positive badges */
--shadow-card: 0 1px 4px rgba(0,0,0,0.08), 0 4px 16px rgba(0,0,0,0.04);
```

### Typography
```css
font-family: Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;

/* Scale */
--text-xs: 11px;
--text-sm: 13px;
--text-base: 15px;
--text-lg: 18px;
--text-xl: 24px;
--text-2xl: 32px;
--text-3xl: 44px;
```

### Spacing & Layout
- Max content width: `1200px`, centered
- Section vertical padding: `80px`
- Card border radius: `12px`
- Input/button border radius: `8px`
- Card gap in grid: `20px`
- Nav height: `64px`

### Remove From All Pages
- Dark/light mode toggle
- Language (EN/FR) toggle
- All dropdown mega-menus
- Heavy gradient backgrounds
- Dense stacked marketing sections

---

## Shared Navigation (all 6 pages)

Single flat row, white background, 1px bottom border `#E5E7EB`.

```
[Kimure Logo]    Marketplace   Credit Profile   Mortgage   Dashboard       [Sign In]  [Get Started →]
```

- Logo: left, links to `index.html`
- 4 nav links: plain text, no dropdowns, `#6B7280`, bold on hover/active
- Right side: `Sign In` ghost button + `Get Started` gold filled button
- When logged in: replace buttons with user's name + Sign Out link
- Mobile: hamburger menu collapsing to stacked links

---

## Page 1: Homepage (`index.html`)

### Section 1 — Hero
- Full-width background: large house photo (`assets/images/home.png` or `house-in-hand.png`)
- Dark overlay `rgba(0,0,0,0.45)` so text is readable
- White headline: **"Make Smarter Real Estate Decisions"** (44px, bold)
- White subtext: "AI-powered listings, credit readiness, and mortgage tools — all in one place."
- Search bar below headline: text input + gold "Search" button
- Two ghost CTA buttons: "Browse Listings →" (links to marketplace.html) + "Try AI Tools →"

### Section 2 — How It Works
- White background
- Section label: "HOW IT WORKS" in gold small caps
- Headline: "From search to decision in minutes"
- 3 cards in a row:
  1. 🔍 Browse Listings — "Search real properties filtered by location, type, and budget"
  2. 🤖 AI Analysis — "Get AI-powered property analysis, valuations, and investment plans"
  3. ✅ Credit & Mortgage — "Check credit readiness and run a mortgage estimate instantly"

### Section 3 — Listing Preview Sections
Fetches from `GET /api/listings/search` via Repliers on page load. Shows 3 horizontal sections, each with 3 cards:

- **"Best For Investment"** — filters intent=investment
- **"Best For Families"** — filters intent=primary residence
- **"New to Market"** — no filter, just the latest

Each section header:
```
Best For Investment                                    See More →
────────────────────────────────────────────────────────────────
[card] [card] [card]
```

"See More →" links to `marketplace.html`.

### Section 4 — AI Tools Teaser
- Light gray `#F7F8FA` background
- Headline: "AI Tools Built Into Every Search"
- 3 feature pills in a row: Property Scout · Property Analyzer · Mortgage Calculator
- Single gold CTA: "Open AI Workspace →" (links to marketplace.html#marketplace-ai-tools)

### Section 5 — Footer
- White background, `#E5E7EB` top border
- Left: © 2026 Kimutu Power Inc.
- Center links: Marketplace · Dashboard · Credit Profile · Mortgage · Legal
- Right: social icons (Facebook, LinkedIn)

---

## Page 2: Marketplace (`marketplace.html`)

### Section 1 — Filter Bar
- White background, sticky on scroll
- Inline filter row:
  ```
  [Location input] [Property Type ▾] [Max Price ▾] [Intent ▾] [Provider ▾]  [Search]
  ```
- Compact, single row. Gold "Search" button on the right.

### Section 2 — Listing Sections with Separators
After search, renders listings in categorized sections exactly like HouseSigma:

**Section headers:**
```
Best For Investment                                    See All
────────────────────────────────────────────────────────────
[card] [card] [card] [card]
```

**Categories shown:**
1. Best For Investment (matchSignals includes "investment")
2. Best For Families (matchSignals includes "family-friendly" or "primary residence")
3. Best For Rental (matchSignals includes "rental")
4. Rural & Agricultural (type includes "land" or "farm")
5. All Results (everything else)

If a category has 0 results it is hidden entirely.

### Listing Card Design
```
┌─────────────────────────────┐
│  [House Photo - 200px tall] │  ← Repliers CDN image or placeholder
│  [Badge: "Rental Yield 9%"] │  ← AI match signal overlaid top-left
├─────────────────────────────┤
│  $685,000                   │  ← price, bold, large
│  Ottawa, Ontario            │  ← location
│  West Ottawa neighbourhood  │  ← addressSummary, muted
│  ── ── ──                   │
│  🛏 3   🚿 2   📐 1,850sqft  │  ← beds/baths/size row
├─────────────────────────────┤
│  [Save listing] [Contact →] │  ← existing JS buttons
└─────────────────────────────┘
```

- Photo: `listing.imageUrl` from Repliers CDN. If null: gray placeholder with house icon.
- Badge: first `matchSignals` item, shown as green pill overlaid on photo top-left.
- Price: `#111827`, 20px bold.
- Beds/baths row: icon + number, `#6B7280`, 13px.
- Save + Contact buttons: full width, stacked or side by side.

### Section 3 — AI Workspace
- Below listings section
- Gold-tinted background `#F5EFE6`
- Tabbed panel (same 6 tools as before, same JS)
- Clean minimal card styling — white cards, no heavy borders
- One tool visible at a time

### Provider Status Bar
- Small text above results: "Showing Repliers preview data — sample listings only"
- If CREA pending: "Live MLS listings coming soon"

---

## Page 3: Dashboard (`dashboard.html`)

### Layout
Two-column: narrow left sidebar + main content area.

### Left Sidebar
- User avatar placeholder (circle, initials)
- User name + email
- Nav links: Overview · Saved Listings · My Leads · Profile
- Sign Out button at bottom

### Main Content

**Overview tab:**
- Welcome header: "Welcome back, [Name]"
- 3 stat cards in a row: Saved Listings (count) · Active Leads (count) · Onboarding (Complete/Incomplete)

**Saved Listings tab:**
- Grid of listing cards (same card design as marketplace)
- Uses `GET /api/saved-properties` + enriches with listing data
- Empty state: "No saved listings yet. Browse the marketplace →"

**My Leads tab:**
- Table: Listing · Status badge · Date submitted
- Status badges: `new` (blue) · `contacted` (yellow) · `negotiation` (orange) · `closed_won` (green)
- Empty state: "No leads yet. Contact an agent from the marketplace →"

**Profile tab:**
- Shows onboarding answers (intent, budget, timeline, risk level)
- "Edit onboarding" link

---

## Page 4: Onboarding Form (`onboarding-form.html`)

### Layout
- Centered, max-width 560px
- Step indicator at top: Step 1 of 3 / Step 2 of 3 / Step 3 of 3
- One step visible at a time
- Gold "Continue →" button, "Back" ghost link

### Steps
1. **Account** — full name, email, password (Supabase auth)
2. **Your Goals** — intent (buy/rent/invest), budget range, timeline
3. **Preferences** — risk level, location, property type preferences

Clean white card, generous padding, no distractions.

---

## Page 5: Credit Profile (`credit-profile.html`)

### Layout
- Two-column: form left, result right
- Form: provider choice, financial inputs, consent checkbox
- Result card: readiness score (large number), risk level badge, key insights list, disclaimer
- On mobile: stacked

### Design
- White background, clean form inputs
- Score displayed as large number with color indicator (green/yellow/red)
- "Run Credit Check" gold button
- Existing JS (`credit-profile.js`) stays untouched

---

## Page 6: Mortgage (`mortgage.html`)

### Layout
- Two-column: inputs left, estimate result right
- Inputs: annual income, down payment, monthly debt, property price, interest rate
- Result: monthly payment estimate, affordability range, key breakdown
- "Calculate Estimate" gold button

### Design
- Same clean pattern as credit profile
- Existing JS (`mortgage.js`) stays untouched

---

## CSS Architecture

### Files
- `assets/css/styles.css` — full rewrite, all shared styles (design system, nav, footer, cards, buttons, inputs, badges)
- `assets/css/marketplace.css` — marketplace-specific layout only
- `assets/css/dashboard.css` — dashboard sidebar + tabs layout only
- `assets/css/onboarding.css` — onboarding step layout only
- `assets/css/credit-profile.css` — two-column form/result layout
- `assets/css/mortgage.css` — two-column form/result layout

### What Gets Deleted From CSS
- All dark theme variables and `.theme-dark` classes
- All `.toggle` (theme/lang) styles
- All `.nav-dropdown` mega-menu styles
- All heavy gradient backgrounds
- All `.mp-intent-hub`, `.mp-listings--intent` category grid styles (replaced by new section separator pattern)

---

## JS Changes (Minimal)

All existing `.js` files stay unchanged except:

- `auth.js` — remove any references to dark mode, language toggle
- `marketplace.js` — update `renderProviderListingCard` to use new card HTML structure with photo, badge, beds/baths row
- `main.js` — remove theme toggle, lang toggle initialization

No new JS files needed.

---

## Image Handling for Listing Cards

Repliers returns `imageUrl` from their CDN (`cdn.repliers.io`). The updated `repliers-preview.provider.ts` already extracts this. In `renderProviderListingCard`:

```javascript
var img = document.createElement("img");
img.src = listing.imageUrl || "";
img.alt = listing.title || "Property";
img.className = "mp-card-photo";
img.onerror = function () {
  img.style.display = "none";
  card.querySelector(".mp-card-photo-wrap").classList.add("mp-card-photo-placeholder");
};
```

Placeholder: gray `#F3F4F6` background with a house SVG icon centered.

---

## Spec Self-Review

**Placeholder scan:** No TBDs or incomplete sections.

**Consistency check:** Card design is defined once and referenced consistently across Homepage, Marketplace, and Dashboard. Nav is defined once. Footer is defined once.

**Scope check:** This is one spec but 6 pages — each page is simple enough that a single implementation plan can cover all 6 sequentially. Implementation order: styles.css → nav/footer → index → marketplace → dashboard → onboarding → credit → mortgage.

**Ambiguity check:** "Best For Families" uses matchSignals filtering client-side after the API returns results. No ambiguity — the JS already has access to `matchSignals` on each listing object.
