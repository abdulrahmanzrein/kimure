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
POST /api/ai/scout
POST /api/ai/analyze
POST /api/ai/rental
POST /api/ai/valuate
POST /api/ai/mortgage
```

## Admin

```txt
GET   /api/admin/users
PATCH /api/admin/users/:id/role
GET   /api/admin/ai-usage
GET   /api/admin/leads
```
