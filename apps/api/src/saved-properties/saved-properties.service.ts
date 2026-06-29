import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { createClient, SupabaseClient } from "@supabase/supabase-js";

@Injectable()
export class SavedPropertiesService {
  constructor(private readonly config: ConfigService) {}

  // Returns all listings the user has saved.
  async getSaved(userId: string, accessToken: string) {
    const client = this.getSupabaseClient(accessToken);
    const { data, error } = await client
      .from("saved_properties")
      .select("id, listing_id, created_at")
      .eq("user_id", userId)
      .order("created_at", { ascending: false });
    if (error) return [];
    return data;
  }

  // Saves a listing for the user.
  async save(userId: string, accessToken: string, listingId: string) {
    const client = this.getSupabaseClient(accessToken);
    const { data, error } = await client
      .from("saved_properties")
      .insert({ user_id: userId, listing_id: listingId })
      .select()
      .single();
    if (error) return { error: error.message };
    return data;
  }

  // Removes a saved listing by its saved_properties row id.
  async unsave(userId: string, accessToken: string, id: string) {
    const client = this.getSupabaseClient(accessToken);
    const { error } = await client
      .from("saved_properties")
      .delete()
      .eq("id", id)
      .eq("user_id", userId);
    if (error) return { error: error.message };
    return { deleted: true };
  }

  // Uses the user's own Bearer token so RLS allows them to read/write only their rows.
  private getSupabaseClient(accessToken: string): SupabaseClient {
    const url = this.config.get<string>("SUPABASE_URL")!;
    const publishableKey = this.config.get<string>("SUPABASE_PUBLISHABLE_KEY")!;
    return createClient(url, publishableKey, {
      auth: { autoRefreshToken: false, persistSession: false },
      global: { headers: { Authorization: `Bearer ${accessToken}` } }
    });
  }
}
