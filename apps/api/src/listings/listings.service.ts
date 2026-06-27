import { Injectable } from "@nestjs/common";
import { SupabaseService } from "../supabase/supabase.service";

// Filters the marketplace can pass on GET /api/listings. All optional.
// `location` does a partial (case-insensitive) text match; the rest are exact
// except price which is a numeric range.
export interface ListingFilters {
  location?: string;
  listing_type?: string;
  status?: string;
  price_min?: number;
  price_max?: number;
}

// The shape we accept when a partner creates a listing. `user_id` is NOT here:
// listings belong to a partner, and the partner/role link is added later.
export interface ListingInput {
  title: string;
  listing_type: string;
  price?: number | null;
  location?: string | null;
  status?: string | null;
  partner_id?: string | null;
  metadata?: Record<string, unknown>;
}

@Injectable()
export class ListingsService {
  constructor(private readonly supabase: SupabaseService) {}

  // List marketplace properties, newest first, with optional filters.
  // Reads are public, so this uses the plain anon client (no user token).
  // RLS on `listings` (migration 004) lets the anon role read only *published*
  // listings, so drafts never leak even though this query has no status filter.
  async listListings(filters: ListingFilters) {
    const client = this.supabase.anon();

    let query = client
      .from("listings")
      .select("*")
      .order("created_at", { ascending: false });

    // Apply only the filters the caller actually sent.
    if (filters.location) {
      query = query.ilike("location", `%${filters.location}%`);
    }
    if (filters.listing_type) {
      query = query.eq("listing_type", filters.listing_type);
    }
    if (filters.status) {
      query = query.eq("status", filters.status);
    }
    if (filters.price_min !== undefined) {
      query = query.gte("price", filters.price_min);
    }
    if (filters.price_max !== undefined) {
      query = query.lte("price", filters.price_max);
    }

    const { data, error } = await query;

    if (error) {
      return [];
    }

    return data;
  }

  // Return one listing's full details, or null if the id does not exist.
  async getListing(id: string) {
    const client = this.supabase.anon();

    const { data, error } = await client
      .from("listings")
      .select("*")
      .eq("id", id)
      .maybeSingle(); // null (not an error) when no row matches

    if (error) {
      return null;
    }

    return data;
  }

  // Create a listing. Requires a logged-in user (the controller guards it).
  // A partner-role check is a later task — for now any authenticated user can
  // create, and we pass their token so future RLS will see auth.uid().
  async createListing(accessToken: string, input: ListingInput) {
    const client = this.supabase.forUser(accessToken);

    const { data, error } = await client
      .from("listings")
      .insert(input)
      .select()
      .single();

    if (error) {
      return { error: error.message };
    }

    return data;
  }
}
