import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { createClient, SupabaseClient } from "@supabase/supabase-js";

@Injectable()
export class LeadsService {
  private serviceClient?: SupabaseClient;

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
  // Auto-assigns to a random partner so partners see the lead in their dashboard.
  async createLead(
    userId: string,
    accessToken: string,
    listingId: string | null,
    intentData: Record<string, unknown>
  ) {
    const client = this.getSupabaseClient(accessToken);
    const row: Record<string, unknown> = {
      user_id: userId,
      intent_data: intentData
    };
    if (listingId) row.listing_id = listingId;

    // Auto-assign: pick a random partner from the DB.
    // Needs the service role key because the individual user's token can't
    // read the partners table (RLS lets each partner see only their own row).
    const partnerId = await this.pickRandomPartnerId();
    if (partnerId) row.partner_id = partnerId;

    const { data, error } = await client
      .from("leads")
      .insert(row)
      .select()
      .single();
    if (error) return { error: error.message };
    return data;
  }

  // Returns the id of a random partner, or null if no partners exist or the
  // service role key isn't configured.
  private async pickRandomPartnerId(): Promise<string | null> {
    const service = this.getServiceClient();
    if (!service) return null;

    const { data, error } = await service
      .from("partners")
      .select("id")
      .limit(100);
    if (error || !data || !data.length) return null;

    const pick = data[Math.floor(Math.random() * data.length)];
    return pick.id;
  }

  private getSupabaseClient(accessToken: string): SupabaseClient {
    const url = this.config.get<string>("SUPABASE_URL")!;
    const publishableKey = this.config.get<string>("SUPABASE_PUBLISHABLE_KEY")!;
    return createClient(url, publishableKey, {
      auth: { autoRefreshToken: false, persistSession: false },
      global: { headers: { Authorization: `Bearer ${accessToken}` } }
    });
  }

  private getServiceClient(): SupabaseClient | null {
    if (this.serviceClient) return this.serviceClient;
    const url = this.config.get<string>("SUPABASE_URL");
    const serviceRoleKey = this.config.get<string>("SUPABASE_SERVICE_ROLE_KEY");
    if (!url || !serviceRoleKey) return null;
    this.serviceClient = createClient(url, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false }
    });
    return this.serviceClient;
  }
}
