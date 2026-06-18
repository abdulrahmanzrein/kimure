import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { createClient, SupabaseClient } from "@supabase/supabase-js";

// The shape of onboarding answers we store. Every field is optional because a
// user can save partial progress as they move through the form.
export interface OnboardingInput {
  intent?: string | null;
  budget_min?: number | null;
  budget_max?: number | null;
  timeline?: string | null;
  risk_level?: string | null;
  location_preferences?: unknown[];
  property_preferences?: unknown[];
  financial_inputs?: Record<string, unknown>;
}

@Injectable()
export class OnboardingService {
  constructor(private readonly config: ConfigService) {}

  // Load the user's onboarding answers, or null if they haven't filled it yet.
  async getOnboarding(userId: string, accessToken: string) {
    const client = this.getSupabaseClient(accessToken);

    const { data, error } = await client
      .from("onboarding_profiles")
      .select("*")
      .eq("user_id", userId)
      .maybeSingle(); // returns null (not an error) when there is no row yet

    if (error) {
      return null;
    }

    return data;
  }

  // Create or update the user's onboarding answers. There is one row per user,
  // so we "upsert": insert a new row, or update the existing one.
  async saveOnboarding(
    userId: string,
    accessToken: string,
    input: OnboardingInput
  ) {
    const client = this.getSupabaseClient(accessToken);

    // We set user_id ourselves from the verified token. Never trust a user_id
    // sent by the client.
    const row = { ...input, user_id: userId };

    const { data, error } = await client
      .from("onboarding_profiles")
      .upsert(row, { onConflict: "user_id" })
      .select()
      .single();

    if (error) {
      return { error: error.message };
    }

    return data;
  }

  // Build a Supabase client that acts as the logged-in user, so Row Level
  // Security allows them to read/write their own onboarding row.
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
