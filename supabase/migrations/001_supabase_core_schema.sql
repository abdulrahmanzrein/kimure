-- Kimure Phase 2 - Supabase-first core schema
-- Run this in the Supabase SQL Editor.
--
-- Supabase Auth owns login identity in auth.users.
-- Kimure app data lives in public tables linked back to auth.users.

begin;

create extension if not exists pgcrypto;

-- Roles are stored as an enum so invalid role names cannot be inserted.
do $$
begin
  create type public.user_role as enum ('individual', 'partner', 'admin', 'support');
exception
  when duplicate_object then null;
end $$;

do $$
begin
  create type public.kyc_status as enum ('not_started', 'pending', 'verified', 'rejected');
exception
  when duplicate_object then null;
end $$;

do $$
begin
  create type public.lead_status as enum ('new', 'contacted', 'negotiation', 'closed_won', 'closed_lost');
exception
  when duplicate_object then null;
end $$;

-- Kimure profile data for a Supabase Auth user.
-- The id is the same UUID as auth.users.id.
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  role public.user_role not null default 'individual',
  full_name text,
  phone text,
  country text,
  city text,
  kyc_status public.kyc_status not null default 'not_started',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Smart onboarding answers used by AI matching and CRM lead scoring.
create table if not exists public.onboarding_profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references public.profiles(id) on delete cascade,
  intent text,
  budget_min numeric(14,2),
  budget_max numeric(14,2),
  timeline text,
  risk_level text,
  location_preferences jsonb not null default '[]'::jsonb,
  property_preferences jsonb not null default '[]'::jsonb,
  financial_inputs jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Business/partner accounts such as agents, brokers, lenders, or operators.
create table if not exists public.partners (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  partner_type text not null,
  business_name text not null,
  verified boolean not null default false,
  subscription_tier text not null default 'free',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Marketplace listings. These start as Kimure/partner listings and can later
-- connect to MLS, Realtor.ca, Zillow, or other property data providers.
create table if not exists public.listings (
  id uuid primary key default gen_random_uuid(),
  partner_id uuid references public.partners(id) on delete set null,
  title text not null,
  listing_type text not null,
  price numeric(14,2),
  location text,
  status text not null default 'draft',
  ai_score integer,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint listings_ai_score_range check (ai_score is null or (ai_score >= 0 and ai_score <= 100))
);

-- User-saved listings for dashboards and AI personalization.
create table if not exists public.saved_properties (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  listing_id uuid not null references public.listings(id) on delete cascade,
  created_at timestamptz not null default now(),
  constraint saved_properties_unique unique (user_id, listing_id)
);

-- CRM leads created when a user requests agent/partner contact or shows
-- high-intent behavior.
create table if not exists public.leads (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  partner_id uuid references public.partners(id) on delete set null,
  listing_id uuid references public.listings(id) on delete set null,
  status public.lead_status not null default 'new',
  intent_data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Raw AI request/response logs for audit, debugging, usage monitoring, and
-- future personalization. Keep provider secrets out of this table.
create table if not exists public.ai_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id) on delete set null,
  engine text not null,
  request_payload jsonb not null default '{}'::jsonb,
  response_payload jsonb,
  status text not null default 'pending',
  error_message text,
  created_at timestamptz not null default now()
);

-- User-facing AI reports derived from AI requests.
create table if not exists public.ai_reports (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id) on delete set null,
  ai_request_id uuid references public.ai_requests(id) on delete set null,
  report_type text not null,
  title text,
  report_data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

-- Admin/security audit log. This is useful for support, compliance, and RBAC.
create table if not exists public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references public.profiles(id) on delete set null,
  action text not null,
  target_table text,
  target_id uuid,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists profiles_role_idx on public.profiles(role);
create index if not exists onboarding_profiles_user_id_idx on public.onboarding_profiles(user_id);
create index if not exists partners_user_id_idx on public.partners(user_id);
create index if not exists listings_partner_id_idx on public.listings(partner_id);
create index if not exists listings_status_idx on public.listings(status);
create index if not exists listings_listing_type_idx on public.listings(listing_type);
create index if not exists saved_properties_user_id_idx on public.saved_properties(user_id);
create index if not exists saved_properties_listing_id_idx on public.saved_properties(listing_id);
create index if not exists leads_user_id_idx on public.leads(user_id);
create index if not exists leads_partner_id_idx on public.leads(partner_id);
create index if not exists leads_status_idx on public.leads(status);
create index if not exists ai_requests_user_id_idx on public.ai_requests(user_id);
create index if not exists ai_requests_engine_idx on public.ai_requests(engine);
create index if not exists ai_reports_user_id_idx on public.ai_reports(user_id);
create index if not exists audit_logs_actor_id_idx on public.audit_logs(actor_id);

commit;

