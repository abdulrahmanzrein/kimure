# Kimure Phase 2 — Person 1 Backend Scope

## Project Context

Kimure Phase 2 turns the existing static website, mobile prototype, and Gemini Gem AI tools into a real AI Brokerage Platform.

The full team is building:

- A connected production website
- A production mobile app
- A secure backend API
- Databases for users, listings, CRM, AI logs, and platform activity
- Gemini API integration through backend services
- Individual, partner/business, and admin CRM dashboards
- Lead marketplace and monetization infrastructure

Kimure is not just a listing platform. It is an AI-powered decision engine and lead marketplace.

## Person 1 Responsibility

Person 1 owns the backend foundation.

This includes:

- Backend infrastructure
- Database setup
- User authentication
- User roles and permissions
- Secure API key handling
- Core API endpoints
- Backend CRM logic
- User management routes
- API routes used by the website, mobile app, AI tools, and dashboards
- Backend routes that support AI requests and the AI orchestration layer

## Primary Backend Goals

Build the system that all other teams connect to.

The frontend, mobile app, CRM dashboards, and AI tools should never call sensitive services directly. They should call the backend API, and the backend should handle authentication, permissions, database access, AI provider calls, and secure secrets.

## Recommended Stack

- Node.js
- NestJS
- TypeScript
- Supabase Auth for authentication
- Supabase Postgres for structured platform data
- Supabase Row Level Security for database-level authorization
- Prisma ORM or Supabase client for backend database access, depending on implementation needs
- MongoDB later for AI interactions, logs, and behavior analytics
- Supabase-issued JWTs verified by the backend
- bcrypt for password hashing
- Redis later for caching and queues
- AWS for hosting/deployment
- S3 or equivalent object storage for uploads
- Secrets stored in environment variables or cloud secrets manager

## Auth And Backend Architecture Decision

Use Supabase Auth as the main authentication provider for Phase 2.

Supabase should handle:

- User signup
- User login
- Session/token issuing
- Email authentication
- Social login later, if needed
- Auth user IDs
- PostgreSQL database hosting
- Row Level Security policies

NestJS should still exist as the backend API layer.

NestJS should handle:

- Verifying Supabase JWTs
- Role-based API access checks
- CRM business logic
- User management workflows
- AI/Gemini orchestration
- Payment routes
- Admin actions
- Secure server-side integrations

Do not replace the backend with direct Supabase-only frontend access. Kimure still needs backend business logic because AI, CRM, payments, admin workflows, and secure API keys must remain server-side.

Recommended request flow:

```txt
Website / Mobile App
  -> Supabase Auth for login
  -> NestJS API with Supabase JWT

NestJS API
  -> verifies token
  -> checks role/permissions
  -> reads/writes Supabase Postgres
  -> calls Gemini/Stripe/external APIs securely
```

## Core API Areas

### Auth

- Signup
- Login
- Logout/session handling
- Supabase session management
- Supabase-issued JWT access tokens
- Backend JWT verification
- Role-based access control in both backend middleware and database policies

Supabase Auth handles password storage and hashing. Do not manually store user passwords in Kimure tables.

Expected routes:

```txt
POST /api/auth/sync-user
GET  /api/auth/me
```

Frontend/mobile may use Supabase client SDKs for signup/login. The backend should expose routes for current user data, role sync, profile creation, admin user management, and other protected platform behavior.

### Users And Roles

- Individual users
- Partner/business users
- Admin users
- Support/customer service users, if needed later

Expected routes:

```txt
GET   /api/users/me
PATCH /api/users/me
GET   /api/admin/users
PATCH /api/admin/users/:id/role
```

### Onboarding

Store the intelligent onboarding data that feeds AI and CRM.

Data includes:

- Budget
- Intent: buy, invest, rent, farm, sell
- Timeline
- Risk level
- Location preferences
- User profile details

Expected routes:

```txt
POST /api/onboarding
GET  /api/onboarding/me
```

### Listings

Provide live listing data to replace static marketplace cards.

Expected routes:

```txt
GET  /api/listings
GET  /api/listings/:id
POST /api/listings
GET  /api/listings/search
```

### CRM And Leads

Backend CRM logic turns user behavior into partner/business leads.

Lead signals can include:

- Onboarding completion
- Saved properties
- AI reports generated
- Agent connection requests
- Budget and timeline data
- High-intent user actions

Expected routes:

```txt
POST  /api/crm/leads
GET   /api/crm/leads
PATCH /api/crm/leads/:id/status
GET   /api/partners/:id/leads
```

### AI Gateway

The backend owns AI request routing. Gemini API keys must never be exposed in frontend or mobile code.

Expected routes:

```txt
POST /api/ai/scout
POST /api/ai/analyze
POST /api/ai/rental
POST /api/ai/valuate
POST /api/ai/mortgage
```

AI Gateway responsibilities:

- Accept AI requests from website/mobile/dashboard
- Load authenticated user context
- Inject onboarding/profile/listing data into prompts
- Call Gemini API securely from the backend
- Return structured responses, not raw text when possible
- Log AI interactions for future personalization
- Support the larger AI orchestration layer

## Initial Database Models

Start with these core models:

- profiles, linked to Supabase `auth.users`
- user_profiles
- roles or role enum
- onboarding_profiles
- listings
- saved_properties
- leads
- crm_pipeline or lead_status
- ai_requests
- ai_reports
- audit_logs

Later additions:

- partners
- subscriptions
- payments
- kyc_documents
- notifications
- support_tickets
- transactions

## Security Rules

- Never commit `.env` files.
- Never commit Gemini, Stripe, AWS, Firebase, Equifax, TransUnion, SendGrid, or Twilio keys.
- Store secrets in environment variables locally and a secrets manager in production.
- Do not store raw passwords or duplicate password hashes in custom tables.
- Let Supabase Auth handle credential storage.
- Verify Supabase JWTs in the backend.
- Use RBAC for protected backend routes.
- Use Supabase Row Level Security for database policies where direct client access is allowed.
- Validate all incoming request bodies.
- Keep AI provider calls server-side only.
- Add rate limiting before public production use.
- Design with PIPEDA, GDPR, and CASL compliance in mind.

## First Milestone

The first backend milestone should be:

```txt
A running backend API with project structure, environment config, PostgreSQL/Prisma setup, health endpoint, auth module, user module, onboarding module, listings module, CRM module, and AI gateway module.
```

After that:

1. Create Supabase project.
2. Configure Supabase Auth.
3. Create database tables and Row Level Security policies.
4. Create NestJS backend.
5. Add Supabase JWT verification in backend.
6. Add protected user/profile routes.
7. Store onboarding data.
8. Add listings API.
9. Add CRM lead routes.
10. Add AI gateway stubs.
11. Connect Gemini later once prompts/API key are available.

## Current Repo Organization

```txt
frontend/  Phase 1 static website from the previous developer
backend/   Backend workspace for Person 1
```

Keep frontend work separate unless the user explicitly asks to connect a frontend form to a backend API.

## Working Style For AI Assistants

When helping in this repo:

- Prefer small, incremental backend steps.
- Do not install large frameworks or dependencies without user confirmation.
- Keep the existing frontend intact.
- Do not expose or invent real credentials.
- Favor clear API documentation and maintainable module boundaries.
- Build for the team: website, mobile, AI, CRM, and admin dashboards will all depend on this backend.
