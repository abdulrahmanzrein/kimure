# Supabase

Supabase provides Kimure's authentication, PostgreSQL database, and Row Level
Security.

## Migrations

Run migrations in numerical order:

1. `migrations/001_supabase_core_schema.sql`
2. `migrations/002_auth_profile_trigger_and_rls.sql`

The current schema creates:

- `profiles`
- `onboarding_profiles`
- `partners`
- `listings`
- `saved_properties`
- `leads`
- `ai_requests`
- `ai_reports`
- `audit_logs`

Supabase Auth owns credentials and sessions in `auth.users`. Kimure application
data belongs in `public` tables linked by the Supabase user ID. Do not create a
custom password table.

## Row Level Security

The second migration enables initial user-owned policies for profiles,
onboarding, saved properties, leads, AI requests, and AI reports.

Policy direction:

- Users can read and update their own profile.
- Users can manage their own onboarding profile and saved properties.
- Users can create and read their own leads.
- Users can read their own AI history.
- Partner and admin policies will be added with those API modules.
- Public listing reads will be added when listing publication rules are final.

## Applying Changes

For now, migrations are run manually in the Supabase SQL Editor. Each future
database change should be a new numbered migration; do not edit a migration
that has already been applied to the shared project.
