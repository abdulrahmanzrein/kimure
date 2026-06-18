import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { createClient, SupabaseClient } from "@supabase/supabase-js";

@Injectable()
export class UsersService {
  constructor(private readonly config: ConfigService) {}

  // Get the current logged-in user's profile from Supabase.
  // We pass the user's access token so Row Level Security knows who is asking
  // and allows them to read their own profile row.
  async getCurrentUser(userId: string, accessToken: string) {
    const client = this.getSupabaseClient(accessToken);

    // Query the profiles table for this user
    const { data, error } = await client
      .from("profiles")
      .select("*")
      .eq("id", userId)
      .single();

    if (error || !data) {
      return null;
    }

    return data; // {id, role, full_name, phone, country, city, kyc_status, created_at, updated_at}
  }

  // Build a Supabase client that acts as the logged-in user.
  // The token in the Authorization header makes auth.uid() work inside RLS policies.
  private getSupabaseClient(accessToken: string): SupabaseClient {
    const url = this.config.get<string>("SUPABASE_URL")!;
    const publishableKey = this.config.get<string>("SUPABASE_PUBLISHABLE_KEY")!;

    return createClient(url, publishableKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      },
      global: {
        headers: { Authorization: `Bearer ${accessToken}` }
      }
    });
  }
}
