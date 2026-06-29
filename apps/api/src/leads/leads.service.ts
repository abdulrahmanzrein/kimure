import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { createClient, SupabaseClient } from "@supabase/supabase-js";

@Injectable()
export class LeadsService {
  constructor(private readonly config: ConfigService) {}

  // Returns all leads the user has submitted.
  async getLeads(userId: string, accessToken: string) {
    const client = this.getSupabaseClient(accessToken);
    const { data, error } = await client
      .from("leads")
      .select("id, listing_id, status, intent_data, created_at")
      .eq("user_id", userId)
      .order("created_at", { ascending: false });
    if (error) return [];
    return data;
  }

  // Creates a lead when a user clicks "Contact agent".
  // listing_id is optional — leads table allows null there.
  async createLead(
    userId: string,
    accessToken: string,
    listingId: string | null,
    intentData: Record<string, unknown>
  ) {
    const client = this.getSupabaseClient(accessToken);
    const row: Record<string, unknown> = { user_id: userId, intent_data: intentData };
    if (listingId) row.listing_id = listingId;

    const { data, error } = await client
      .from("leads")
      .insert(row)
      .select()
      .single();
    if (error) return { error: error.message };
    return data;
  }

  private getSupabaseClient(accessToken: string): SupabaseClient {
    const url = this.config.get<string>("SUPABASE_URL")!;
    const publishableKey = this.config.get<string>("SUPABASE_PUBLISHABLE_KEY")!;
    return createClient(url, publishableKey, {
      auth: { autoRefreshToken: false, persistSession: false },
      global: { headers: { Authorization: `Bearer ${accessToken}` } }
    });
  }
}
