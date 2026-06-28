-- Kimure Phase 2 - Credit consent and reusable financial profile storage
-- Run this after 003_credit_assessments.sql in the Supabase SQL Editor.

begin;

-- API-owned audit trail for explicit credit bureau consent.
-- Provider names stay as text because the provider registry may expand beyond
-- direct Equifax, Thirdstream, and TransUnion adapters later.
create table if not exists public.credit_consents (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  provider_choice text not null,
  provider text not null,
  bureau text not null,
  permissible_purpose text not null,
  consent_version text not null,
  consent_text_hash text not null,
  status text not null default 'active',
  consented_at timestamptz not null default now(),
  expires_at timestamptz not null,
  revoked_at timestamptz,
  source text not null default 'credit-profile',
  created_at timestamptz not null default now(),
  constraint credit_consents_status_check
    check (status in ('active', 'expired', 'revoked')),
  constraint credit_consents_expires_after_consented_check
    check (expires_at > consented_at)
);

comment on table public.credit_consents is
  'API-owned record of explicit credit bureau consent. Do not store SIN, raw identity, full address, raw provider request/response bodies, raw bureau data, tokens, prompts, or credentials here.';
comment on column public.credit_consents.provider_choice is
  'Requested credit provider choice such as equifax_oneview, thirdstream_equifax, thirdstream_transunion, or auto.';
comment on column public.credit_consents.consent_text_hash is
  'Hash of the consent wording/version accepted by the user. Do not store full legal copy here.';
comment on column public.credit_consents.source is
  'Flow that captured consent, for example credit-profile.';

create index if not exists credit_consents_user_id_idx
on public.credit_consents(user_id);

create index if not exists credit_consents_status_idx
on public.credit_consents(status);

create index if not exists credit_consents_expires_at_idx
on public.credit_consents(expires_at);

create index if not exists credit_consents_provider_status_idx
on public.credit_consents(user_id, provider, bureau, status);

-- Reusable, account-level financial profile for personalization.
-- This table stores user-provided financial inputs and safe derived credit
-- summary fields only. It must not store raw Equifax/Thirdstream/Gemini data.
create table if not exists public.user_financial_profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references public.profiles(id) on delete cascade,
  annual_income numeric,
  monthly_debt numeric,
  current_housing_payment numeric,
  savings numeric,
  down_payment numeric,
  target_purchase_price numeric,
  employment_status text,
  employment_stability text,
  timeline text,
  target_location text,
  first_time_buyer boolean,
  risk_tolerance text,
  latest_credit_readiness_score numeric,
  latest_risk_level text,
  latest_credit_verified boolean not null default false,
  latest_credit_provider text,
  latest_credit_bureau text,
  latest_credit_assessment_expires_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.user_financial_profiles is
  'Reusable user financial profile for dashboard, mortgage, marketplace, and future listing personalization.';
comment on column public.user_financial_profiles.latest_credit_readiness_score is
  'Safe derived readiness score only. Do not store raw bureau/provider/Gemini responses, prompts, sourceResponse, contentBase64, SIN, full DOB, full address, tokens, or credentials.';
comment on column public.user_financial_profiles.latest_credit_verified is
  'True only when a configured bureau provider returned verified data through the approved Gateway path.';

create index if not exists user_financial_profiles_latest_credit_verified_idx
on public.user_financial_profiles(latest_credit_verified);

create index if not exists user_financial_profiles_credit_expires_at_idx
on public.user_financial_profiles(latest_credit_assessment_expires_at);

-- Consent records are API-owned. No direct browser read/write policies are
-- added here; future dashboard views should go through sanitized API endpoints.
alter table public.credit_consents enable row level security;

revoke all on table public.credit_consents from anon;
revoke all on table public.credit_consents from authenticated;

-- Users may read their own reusable financial profile, but writes are reserved
-- for API services so normalization and provider-safety rules stay centralized.
alter table public.user_financial_profiles enable row level security;

revoke all on table public.user_financial_profiles from anon;
revoke all on table public.user_financial_profiles from authenticated;
grant select on table public.user_financial_profiles to authenticated;

drop policy if exists "user_financial_profiles_select_own"
on public.user_financial_profiles;

create policy "user_financial_profiles_select_own"
on public.user_financial_profiles
for select
to authenticated
using (auth.uid() = user_id);

commit;
