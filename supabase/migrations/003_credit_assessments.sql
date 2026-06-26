-- Kimure Phase 2 - Persistent credit assessment references
-- Run this after 002_auth_profile_trigger_and_rls.sql in the Supabase SQL Editor.

begin;

-- API-owned storage for Credit Readiness -> Mortgage handoff references.
-- Browsers should only keep the opaque creditAssessmentId, expiresAt, and userId.
-- The API stores a hash of the opaque id and resolves it server-side before
-- calling mortgage AI. Do not store raw bureau/provider/Gemini data here.
create table if not exists public.credit_assessments (
  id uuid primary key default gen_random_uuid(),
  assessment_id_hash text not null unique,
  user_id uuid not null references public.profiles(id) on delete cascade,
  source_ai_request_id uuid references public.ai_requests(id) on delete set null,
  status text not null default 'active',
  tool text not null default 'credit-profile',
  storage_version text not null default 'credit-assessment-v1',
  provider_choice text,
  provider_status jsonb not null default '{}'::jsonb,
  verification_status jsonb not null default '{}'::jsonb,
  consent_status jsonb not null default '{}'::jsonb,
  credit_mortgage_handoff jsonb not null default '{}'::jsonb,
  readiness_score numeric,
  risk_level text,
  result_type text,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  last_used_at timestamptz,
  revoked_at timestamptz,
  constraint credit_assessments_status_check
    check (status in ('active', 'expired', 'revoked')),
  constraint credit_assessments_tool_check
    check (tool = 'credit-profile'),
  constraint credit_assessments_expires_after_created_check
    check (expires_at > created_at)
);

comment on table public.credit_assessments is
  'API-owned persistent storage for opaque creditAssessmentId mortgage handoff references. Browser clients must not access this table directly.';
comment on column public.credit_assessments.assessment_id_hash is
  'Server-side hash of the opaque creditAssessmentId. Do not store the raw browser reference here.';
comment on column public.credit_assessments.credit_mortgage_handoff is
  'Minimized mortgage handoff only. Never store raw bureau/provider/Gemini responses, prompts, sourceResponse, contentBase64, SIN, full DOB, full address, tokens, or credentials.';

create index if not exists credit_assessments_user_id_idx
on public.credit_assessments(user_id);

create index if not exists credit_assessments_expires_at_idx
on public.credit_assessments(expires_at);

create index if not exists credit_assessments_active_lookup_idx
on public.credit_assessments(user_id, assessment_id_hash, expires_at)
where status = 'active' and revoked_at is null;

-- RLS is enabled with no direct anon/authenticated policies. The Kimure API
-- resolves these rows server-side after authenticating the Supabase user.
alter table public.credit_assessments enable row level security;

revoke all on table public.credit_assessments from anon;
revoke all on table public.credit_assessments from authenticated;

commit;
