# Kimure Phase 2

Team repository for the Kimure AI Brokerage Platform.

Kimure connects real estate, rural land, agricultural assets, financial
services, AI-assisted decisions, and CRM lead workflows.

## Repository Layout

```txt
apps/
  api/                      NestJS API and Supabase token verification
  web/                      Active Next.js website
supabase/
  migrations/               Versioned database schema and RLS migrations
docs/
  api/                      API roadmap and module ownership
  architecture/             Technical architecture decisions
  integrations/             Cross-service contracts
  project/                  Employer scope and source requirements
archive/
  phase-1-static-site/      Original static website snapshot
```

The active applications are `apps/web` and `apps/api`. The archive is
reference material and should not receive new product work.

## Quick Start

Install each application once:

```powershell
npm.cmd run install:all
```

Run the website:

```powershell
npm.cmd run dev:web
```

Run the API in a second terminal:

```powershell
Copy-Item apps/api/.env.example apps/api/.env
npm.cmd run dev:api
```

Default local URLs:

- Website: `http://localhost:3000`
- API: `http://localhost:3001/api`
- Health check: `http://localhost:3001/api/health`

## Current Status

- Supabase schema, profile trigger, and initial RLS policies are defined.
- Website signup, login, logout, and onboarding persistence use Supabase.
- NestJS API foundation is running.
- Authenticated AI adapter endpoints are implemented in five beginner-readable
  API source files.
- JT's AI Gateway still needs to confirm its request and response contract.

Start with [docs/README.md](docs/README.md) for documentation and ownership.

## Security

- Never commit `.env` files or `supabase-config.js`.
- Browser code may use only the Supabase publishable key.
- Service-role, AI Gateway, Gemini, Stripe, and other private keys remain
  server-side.
- All protected API routes require a Supabase access token.
