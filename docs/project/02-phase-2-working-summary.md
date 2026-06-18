# Kimure Phase 2 - Working Summary

Received: 2026-06-11

This summary normalizes the full employer-provided Phase 2 scope for future development sessions. The raw source files are stored in `docs/employer/raw/`.

## Product Positioning

Kimure is not just a listing portal. Kimure is an AI-powered decision engine and lead marketplace for:

- Real estate
- Rural land
- Agricultural assets
- Financial services

The website shows listings, the AI creates intelligence, and the CRM monetizes user intent.

## Phase 1 Starting Point

Phase 1 delivered:

- Static website front-end
- Semi-functional mobile prototype
- Visual onboarding flow
- Light/dark mode and English/French localization
- Five Gemini AI tools:
  - Property Scout
  - Property Analyzer
  - Rental Finder
  - Property Evaluator
  - Mortgage Calculator

## Phase 2 Target

Phase 2 turns the static/prototype assets into a functional integrated platform:

- Secure backend
- Live auth
- Database-backed users, listings, onboarding, leads, dashboards, and AI logs
- Gemini API integration inside the backend
- Website connected to backend APIs
- Mobile app connected to backend APIs
- Three-tier CRM dashboard
- Lead marketplace and monetization infrastructure
- Payment/subscription support
- Production deployment path

## Current Repo Decision

The employer docs mention Firebase Auth as an option, but this repo has already chosen Supabase for the backend foundation.

Use:

- Supabase Auth for signup, login, sessions, password reset, and JWT issuing
- Supabase Postgres for structured platform data
- Supabase Row Level Security for table/row-level authorization
- NestJS as the secure backend API layer

Do not store user passwords in custom tables. Do not expose service-role keys or private API keys in frontend code.

## Person 1 Scope

Abdul owns:

- Backend infrastructure
- Database setup
- User authentication
- User roles and permissions
- Secure API key handling
- Core API endpoints
- Backend CRM logic
- User management
- AI backend routes and AI orchestration support
- API routes used by website, mobile app, AI tools, CRM, and admin dashboards
- Connecting the frontend to the backend

## Main Platform Areas

### Website

Current state: static UI.

Phase 2 needs:

- Signup/login connected to auth
- Onboarding data capture connected to database
- Live listings API
- Marketplace search/filtering from backend
- AI recommendation panels
- User dashboard data
- Partner/admin dashboard data later
- PWA support with manifest/service worker later

### Mobile App

Current state: semi-functional prototype outside this repo.

Phase 2 needs:

- Production app using React Native/Expo or Flutter
- Real authentication
- Individual and business dashboards
- AI assistant interface: "Ask Kimure AI"
- Real-time sync with backend
- Push notifications

### AI System

Move AI logic out of standalone Gemini Gems and into backend services.

Planned routes:

- `POST /api/ai/chat`
- `POST /api/ai/scout`
- `POST /api/ai/analyze`
- `POST /api/ai/rental`
- `POST /api/ai/valuate`
- `POST /api/ai/mortgage`
- `POST /api/ai/credit-profile`
- `POST /api/ai/investment-planner`

AI service responsibilities:

- Load authenticated user context
- Inject profile, onboarding, listing, market, and financial data into prompts
- Call Gemini API securely from backend
- Return structured report/card responses
- Log AI interactions for personalization and CRM intent scoring

Team ownership note:

- JT owns the AI Gateway internals, Gemini logic, AI routing, and structured AI outputs.
- Abdul's side should not implement Gemini logic directly.
- Abdul's side should make sure website/backend flows can call the AI Gateway cleanly, pass the correct payloads, and consume/display structured responses.
- Main integration points are onboarding/smart forms, Buy/Invest/Rent, marketplace/listings, and later dashboard/leads.

### CRM Dashboards

Three dashboard tiers:

- Individual user dashboard:
  - AI recommendations
  - Saved listings
  - AI reports history
  - Financial insights
  - Connect-with-agent CTA

- Partner/business dashboard:
  - Lead inbox
  - User intent data
  - CRM pipeline: New, Contacted, Negotiation, Closed
  - Listing management
  - AI lead insights
  - Subscription/billing information

- Admin dashboard:
  - User management
  - Partner approvals
  - RBAC management
  - AI usage monitoring
  - Revenue tracking
  - Audit trail
  - Support/ticket oversight

## Core Data Areas

Structured data belongs in Supabase Postgres:

- Users/profiles
- Roles
- Onboarding profiles
- Partners
- Listings
- Saved properties
- Leads
- CRM pipeline/statuses
- Transactions
- Subscriptions/payments later
- Notifications later
- Audit logs

Flexible/AI behavior data may later use MongoDB or Postgres JSONB depending on implementation constraints:

- AI interactions
- User behavior
- Search logs
- Recommendation cache
- Report history

## Integration Deliverables

The full project expects:

- Integration plan
- Functional API modules
- Auth/user management
- AI request routes
- Property/listings routes
- CRM/lead routes
- Website-backend connection
- Mobile-backend connection
- Testing and documentation
- Final demo/presentation

## Implementation Status

Completed:

1. Supabase project and initial database migrations.
2. Profile creation trigger and initial RLS policies.
3. Website signup, login, logout, and onboarding persistence.
4. NestJS backend foundation and health endpoint.
5. Supabase access-token verification guard.
6. Authenticated AI adapter routes and integration contract.

Next:

1. Confirm the AI Gateway contract with JT.
2. Implement current-user and profile API routes.
3. Move onboarding persistence behind the API where business logic requires it.
4. Implement listings API and connect the marketplace.
5. Implement lead and CRM starter routes.
6. Add AI request/report persistence and rate limiting.
7. Add integration and end-to-end tests as workflows become connected.

## Security Rules

- Secrets stay in environment variables or cloud secret manager.
- Frontend must never contain Supabase service-role key, Gemini API key, Stripe key, Equifax/TransUnion keys, AWS keys, Twilio keys, or SendGrid keys.
- Backend verifies Supabase JWTs before protected actions.
- Use RBAC in backend.
- Use Supabase RLS for database-level access control.
- Validate incoming request bodies.
- Add rate limiting before production.
- Maintain PIPEDA, GDPR, and CASL awareness in data handling.
