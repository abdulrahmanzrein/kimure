# Person 1 Scope - Backend, Database, Auth, Core APIs

Received: 2026-06-11

## Ownership

Person 1 owns:

- Backend infrastructure
- Database setup
- User authentication
- User roles
- Secure API key handling
- Core API endpoints

Person 1 also owns:

- Backend side of CRM logic
- User management
- API routes used by the website, mobile app, AI tools, and dashboards

## AI-Related Responsibility

Person 1 sets up the backend routes needed for AI requests and supports the AI orchestration layer.

## Frontend Integration Responsibility

Person 1 is also responsible for connecting the frontend to the backend.

## Backend Platform Decision

Use Supabase as the backend foundation for authentication, Postgres database storage, and Row Level Security.

Recommended architecture:

- Supabase Auth handles signup, login, sessions, password reset, and JWT issuing.
- Supabase Postgres stores platform data such as users, profiles, onboarding, listings, leads, CRM records, and AI logs.
- Supabase Row Level Security protects database access at the table/row level.
- NestJS remains the secure API layer for business logic, role checks, CRM workflows, AI/Gemini routes, admin routes, and secure integrations.
- The frontend can use Supabase Auth for user login/signup, then send the Supabase access token to the backend API.

Do not expose Supabase service-role keys, Gemini keys, Stripe keys, or other private credentials in frontend code.
