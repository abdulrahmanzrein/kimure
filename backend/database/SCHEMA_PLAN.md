# Kimure Database Plan

Supabase Postgres will be the primary database for structured platform data.

## Initial Tables

- profiles
- user_roles
- onboarding_profiles
- listings
- saved_properties
- leads
- ai_requests
- ai_reports
- audit_logs

## Later Tables

- partners
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
