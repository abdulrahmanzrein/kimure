# Kimure Repository Guide

This is the shared Phase 2 team repository, not a repository for one team
member's work.

Read these files before making architectural changes:

- `README.md`
- `docs/README.md`
- `docs/project/02-phase-2-working-summary.md`
- `docs/integrations/ai-gateway.md`

Active applications:

- `apps/web`: Next.js website
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
