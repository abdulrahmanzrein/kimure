-- Kimure Phase 2 - Auth profile trigger and first Row Level Security policies
-- Run this after 001_supabase_core_schema.sql in the Supabase SQL Editor.

begin;

-- When Supabase Auth creates a row in auth.users, this function creates the
-- matching Kimure app profile in public.profiles.
create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, full_name)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name')
  )
  on conflict (id) do nothing;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_auth_user();

-- Enable Row Level Security. RLS means a user only gets access allowed by
-- policies, even if the frontend queries Supabase directly.
alter table public.profiles enable row level security;
alter table public.onboarding_profiles enable row level security;
alter table public.saved_properties enable row level security;
alter table public.leads enable row level security;
alter table public.ai_requests enable row level security;
alter table public.ai_reports enable row level security;

-- Profiles: users can read and update their own profile.
drop policy if exists "profiles_select_own" on public.profiles;
create policy "profiles_select_own"
on public.profiles
for select
to authenticated
using (auth.uid() = id);

drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own"
on public.profiles
for update
to authenticated
using (auth.uid() = id)
with check (auth.uid() = id);

-- Onboarding: users can manage their own onboarding row.
drop policy if exists "onboarding_select_own" on public.onboarding_profiles;
create policy "onboarding_select_own"
on public.onboarding_profiles
for select
to authenticated
using (auth.uid() = user_id);

drop policy if exists "onboarding_insert_own" on public.onboarding_profiles;
create policy "onboarding_insert_own"
on public.onboarding_profiles
for insert
to authenticated
with check (auth.uid() = user_id);

drop policy if exists "onboarding_update_own" on public.onboarding_profiles;
create policy "onboarding_update_own"
on public.onboarding_profiles
for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

-- Saved properties: users can save/unsave/read their own saved listings.
drop policy if exists "saved_properties_select_own" on public.saved_properties;
create policy "saved_properties_select_own"
on public.saved_properties
for select
to authenticated
using (auth.uid() = user_id);

drop policy if exists "saved_properties_insert_own" on public.saved_properties;
create policy "saved_properties_insert_own"
on public.saved_properties
for insert
to authenticated
with check (auth.uid() = user_id);

drop policy if exists "saved_properties_delete_own" on public.saved_properties;
create policy "saved_properties_delete_own"
on public.saved_properties
for delete
to authenticated
using (auth.uid() = user_id);

-- Leads: users can create and read their own leads.
drop policy if exists "leads_select_own" on public.leads;
create policy "leads_select_own"
on public.leads
for select
to authenticated
using (auth.uid() = user_id);

drop policy if exists "leads_insert_own" on public.leads;
create policy "leads_insert_own"
on public.leads
for insert
to authenticated
with check (auth.uid() = user_id);

-- AI logs/reports: users can read their own AI history.
drop policy if exists "ai_requests_select_own" on public.ai_requests;
create policy "ai_requests_select_own"
on public.ai_requests
for select
to authenticated
using (auth.uid() = user_id);

drop policy if exists "ai_reports_select_own" on public.ai_reports;
create policy "ai_reports_select_own"
on public.ai_reports
for select
to authenticated
using (auth.uid() = user_id);

commit;

