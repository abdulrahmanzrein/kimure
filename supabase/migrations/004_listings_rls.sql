-- Listings Row Level Security policies.
--
-- The live database already has RLS enabled on public.listings, but NO policies
-- existed. With RLS on and no policy, Postgres denies everything: public reads
-- silently returned an empty array and every insert failed with
-- "new row violates row-level security policy for table listings".
-- This migration documents the enablement and adds the marketplace rules.
--
-- Read model:  listings are public marketplace data, so anyone (logged in or
--              not) may read *published* listings. Drafts stay private.
-- Write model: any authenticated user may create a listing for now. A
--              partner/agent role check will tighten this later.

-- Idempotent: harmless if RLS is already enabled on the live DB.
alter table public.listings enable row level security;

-- Public can read only published listings (drafts are not exposed).
drop policy if exists "listings_select_published" on public.listings;
create policy "listings_select_published"
  on public.listings
  for select
  to anon, authenticated
  using (status = 'published');

-- Authenticated users may create listings (partner-role check added later).
drop policy if exists "listings_insert_authenticated" on public.listings;
create policy "listings_insert_authenticated"
  on public.listings
  for insert
  to authenticated
  with check (true);
