# Kimure Backend

Backend workspace for Kimure Phase 2.

This service will provide the secure API layer for:

- Supabase Auth integration
- User profiles and role management
- Onboarding data capture
- Property/listings APIs
- CRM lead logic
- AI/Gemini gateway routes
- Admin/user management routes
- Future Stripe/payment and external API integrations

## Planned Stack

- Node.js
- NestJS
- TypeScript
- Supabase Auth
- Supabase Postgres
- Supabase Row Level Security
- Gemini API through backend-only routes

## Planned API Areas

```txt
src/auth        Supabase JWT verification and auth helpers
src/users       User account routes
src/profiles    Public/private profile data
src/onboarding  Intelligent onboarding data
src/listings    Marketplace/listings API
src/crm         Leads and CRM pipeline logic
src/ai          Gemini AI gateway/orchestration
src/admin       Admin-only platform routes
src/common      Shared guards, decorators, DTOs, utilities
src/config      Environment/config validation
src/supabase    Supabase client/server integration
```

## Setup Status

This folder is currently a skeleton. Dependencies have not been installed yet.

Next step:

```powershell
cd backend
npm init -y
```

Then install NestJS/TypeScript/Supabase packages when ready.
