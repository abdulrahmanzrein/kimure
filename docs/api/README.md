# Kimure Backend API Plan

## Auth

Supabase handles signup/login/session creation. The backend verifies Supabase JWTs and exposes protected platform routes.

Planned backend routes:

```txt
GET  /api/auth/me
POST /api/auth/sync-user
```

## Users And Profiles

```txt
GET   /api/users/me
PATCH /api/users/me
GET   /api/profiles/me
PATCH /api/profiles/me
```

## Onboarding

```txt
POST /api/onboarding
GET  /api/onboarding/me
```

## Listings

```txt
GET  /api/listings
GET  /api/listings/:id
GET  /api/listings/search
POST /api/listings
```

## CRM

```txt
POST  /api/crm/leads
GET   /api/crm/leads
PATCH /api/crm/leads/:id/status
```

## AI Gateway

```txt
POST /api/ai/chat
POST /api/ai/scout
POST /api/ai/analyze
POST /api/ai/rental
POST /api/ai/valuate
POST /api/ai/mortgage
POST /api/ai/credit-profile
POST /api/ai/investment-planner
```

All AI routes require a Supabase access token:

```txt
Authorization: Bearer <supabase-access-token>
```

These routes do not run Gemini directly. They validate the website/mobile
payload, add authenticated user context, and forward it to the AI team's
Gateway. See [the AI Gateway contract](../integrations/ai-gateway.md).

## Admin

```txt
GET   /api/admin/users
PATCH /api/admin/users/:id/role
GET   /api/admin/ai-usage
GET   /api/admin/leads
```
