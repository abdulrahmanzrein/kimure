import { Injectable } from "@nestjs/common";
import { SupabaseService } from "../supabase/supabase.service";

@Injectable()
export class UsersService {
  constructor(private readonly supabase: SupabaseService) {}

  // Get the current logged-in user's profile from Supabase.
  // We pass the user's access token so Row Level Security knows who is asking
  // and allows them to read their own profile row.
  async getCurrentUser(userId: string, accessToken: string) {
    const client = this.supabase.forUser(accessToken);

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
}
