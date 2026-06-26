-- Seed data: a handful of realistic *published* marketplace listings.
--
-- This is NOT a schema migration — it only inserts demo rows so the marketplace
-- has something to show before real partners/agents start posting listings.
-- Run it in the Supabase SQL editor AFTER migration 004 (listings RLS) is
-- applied. Safe to re-run: it deletes any prior seed rows first (identified by
-- metadata->>'seed' = 'true') so you never get duplicates.
--
-- Field notes:
--   listing_type : matches the marketplace page's data-type strings
--                  (Rural Land / Agricultural / Commercial / Residential) so
--                  the existing filter UI lines up with the data.
--   status       : 'published' so the public RLS read policy (004) exposes them.
--                  Drafts would stay hidden.
--   price        : whole-dollar amounts (numeric(14,2)).
--   ai_score     : 0–100, the "Kimure AI" confidence/quality score shown on cards.
--   metadata     : everything the card renders that has no dedicated column —
--                  roi, image, currency, a short description, and beds/acres.
--                  Kept in JSON so we don't add columns before we need them.

-- Remove previous seed rows so re-running this file stays idempotent.
delete from public.listings where metadata->>'seed' = 'true';

insert into public.listings (title, listing_type, price, location, status, ai_score, metadata)
values
  (
    'Modern Urban Apartment — Downtown Core',
    'Residential',
    480000,
    'Toronto, Canada',
    'published',
    92,
    jsonb_build_object(
      'seed', 'true',
      'currency', 'CAD',
      'roi', 7,
      'beds', 2,
      'baths', 2,
      'image', 'assets/images/listings/urban-apartment.jpg',
      'description', 'Bright 2-bed condo near transit, finance-ready with Kimure mortgage tools.'
    )
  ),
  (
    'Rural Land — 48 Acres of Open Acreage',
    'Rural Land',
    1420000,
    'Alberta, Canada',
    'published',
    88,
    jsonb_build_object(
      'seed', 'true',
      'currency', 'CAD',
      'roi', 12,
      'acres', 48,
      'image', 'assets/images/listings/rural-land.jpg',
      'description', '48-acre parcel suited to development or long-hold investment.'
    )
  ),
  (
    'Agricultural Farmland — Lease Option Available',
    'Agricultural',
    320000,
    'Iowa, US',
    'published',
    84,
    jsonb_build_object(
      'seed', 'true',
      'currency', 'USD',
      'roi', 9,
      'acres', 120,
      'image', 'assets/images/listings/farmland.jpg',
      'description', 'Productive cropland available to buy or lease, agri-credit eligible.'
    )
  ),
  (
    'Commercial Retail & Office Building',
    'Commercial',
    2100000,
    'Toronto, Canada',
    'published',
    90,
    jsonb_build_object(
      'seed', 'true',
      'currency', 'CAD',
      'roi', 9,
      'sqft', 14000,
      'image', 'assets/images/listings/commercial.jpg',
      'description', 'Mixed retail/office asset with stable tenancy in a prime corridor.'
    )
  ),
  (
    'Suburban Family Home — 4 Bed',
    'Residential',
    550000,
    'Austin, US',
    'published',
    91,
    jsonb_build_object(
      'seed', 'true',
      'currency', 'USD',
      'roi', 6,
      'beds', 4,
      'baths', 3,
      'image', 'assets/images/listings/house-suburban.jpg',
      'description', 'Single-family home in a growing suburb, strong rental potential.'
    )
  ),
  (
    'Urban Farm & Agri Parcel',
    'Agricultural',
    890000,
    'British Columbia, Canada',
    'published',
    86,
    jsonb_build_object(
      'seed', 'true',
      'currency', 'CAD',
      'roi', 11,
      'acres', 22,
      'image', 'assets/images/listings/farm-property.jpg',
      'description', 'Established urban farm parcel with infrastructure and water rights.'
    )
  );

-- Quick check after running: should return 6 rows.
-- select title, listing_type, price, location, status from public.listings
-- where metadata->>'seed' = 'true' order by price;
