# Kimure Database Plan

Supabase Postgres will be the primary database for structured platform data.

## Current Tables

- profiles
- onboarding_profiles
- partners
- listings
- saved_properties
- leads
- ai_requests
- ai_reports
- audit_logs

Roles currently use the `public.user_role` enum.

## Planned Tables

- subscriptions
- payments
- kyc_documents
- notifications
- support_tickets
- transactions

## Auth Relationship

Do not create a custom password table.

Use Supabase `auth.users` for auth identity. Public application tables should reference the Supabase user ID.

Example:

```txt
profiles.id -> auth.users.id
onboarding_profiles.user_id -> auth.users.id
leads.user_id -> auth.users.id
```

The executable source of truth is `supabase/migrations/`. This document
describes the model direction; migration SQL defines the database that
actually exists.
