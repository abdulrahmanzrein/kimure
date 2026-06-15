# Database Migrations

Run migrations in the Supabase SQL Editor.

## Current Migration

1. `001_supabase_core_schema.sql`
2. `002_auth_profile_trigger_and_rls.sql`

This is the first Supabase-first database version for Kimure Phase 2.

Key decision:

- Supabase Auth owns real signup, login, password storage, sessions, and JWT issuing through `auth.users`.
- Kimure stores app-specific user data in `public.profiles`, linked to `auth.users.id`.
- Do not create a separate password table.

Initial tables:

- `profiles`
- `onboarding_profiles`
- `partners`
- `listings`
- `saved_properties`
- `leads`
- `ai_requests`
- `ai_reports`
- `audit_logs`

Next step after running the schema:

1. Confirm the tables appear in Supabase Table Editor.
2. Confirm Row Level Security is enabled for user-owned tables.
3. Test signup in Supabase Auth.
4. Confirm a matching row appears in `public.profiles`.
5. Scaffold the NestJS backend and connect it to Supabase.
