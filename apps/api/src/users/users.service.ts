import { BadRequestException, Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { createClient, SupabaseClient } from "@supabase/supabase-js";

// The only roles a user is allowed to self-assign.
// TODO: before production, remove "admin" from this list and only allow
// promotion via an invite flow.
const ALLOWED_ROLES = ["individual", "partner", "admin"] as const;
type AllowedRole = (typeof ALLOWED_ROLES)[number];

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

  // Update the logged-in user's role. Called right after signup so the user's
  // profile reflects the role they picked in the UI (individual / partner / admin).
  async updateRole(userId: string, accessToken: string, role: string) {
    if (!ALLOWED_ROLES.includes(role as AllowedRole)) {
      throw new BadRequestException(`Invalid role: ${role}`);
    }

    const client = this.getSupabaseClient(accessToken);
    const { data, error } = await client
      .from("profiles")
      .update({ role })
      .eq("id", userId)
      .select()
      .single();

    if (error) {
      return { error: error.message };
    }

    return data;
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
