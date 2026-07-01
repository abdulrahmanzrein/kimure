import { BadRequestException, Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { createClient, SupabaseClient } from "@supabase/supabase-js";

const ALLOWED_PARTNER_TYPES = ["agent", "broker", "lender", "operator"] as const;
type PartnerType = (typeof ALLOWED_PARTNER_TYPES)[number];

export interface PartnerInput {
  partner_type: string;
  business_name: string;
}

@Injectable()
export class PartnersService {
  private serviceClient?: SupabaseClient;

  constructor(private readonly config: ConfigService) {}

  // Get the current partner's business profile row, or null if they haven't
  // set one up yet.
  async getMe(userId: string, accessToken: string) {
    const client = this.getUserClient(accessToken);
    const { data, error } = await client
      .from("partners")
      .select("*")
      .eq("user_id", userId)
      .maybeSingle();
    if (error) return null;
    return data;
  }

  // Create or update the partner's business profile. Called on first-time
  // partner setup, or when they edit their info later.
  async createOrUpdate(userId: string, accessToken: string, input: PartnerInput) {
    if (!ALLOWED_PARTNER_TYPES.includes(input.partner_type as PartnerType)) {
      throw new BadRequestException(
        `Invalid partner type. Allowed: ${ALLOWED_PARTNER_TYPES.join(", ")}`
      );
    }
    const businessName = (input.business_name || "").trim();
    if (!businessName) {
      throw new BadRequestException("Business name is required");
    }

    const client = this.getUserClient(accessToken);
    const existing = await this.getMe(userId, accessToken);

    if (existing) {
      const { data, error } = await client
        .from("partners")
        .update({
          partner_type: input.partner_type,
          business_name: businessName
        })
        .eq("user_id", userId)
        .select()
        .single();
      if (error) return { error: error.message };
      return data;
    }

    const { data, error } = await client
      .from("partners")
      .insert({
        user_id: userId,
        partner_type: input.partner_type,
        business_name: businessName
      })
      .select()
      .single();
    if (error) return { error: error.message };
    return data;
  }

  // Return all leads assigned to this partner, enriched with the user's
  // profile info, contact email, and onboarding goals so the partner has
  // the full context they need to work the lead.
  async getAssignedLeads(userId: string, accessToken: string) {
    const partner = await this.getMe(userId, accessToken);
    if (!partner) return [];

    const service = this.getServiceClient();
    if (!service) return [];

    const { data: leads, error } = await service
      .from("leads")
      .select("id, user_id, listing_id, status, intent_data, created_at, updated_at")
      .eq("partner_id", partner.id)
      .order("created_at", { ascending: false });
    if (error || !leads || !leads.length) return [];

    const userIds = Array.from(new Set(leads.map((l) => l.user_id).filter(Boolean)));

    // Fetch profiles for all lead-submitters in one query
    const { data: profiles } = await service
      .from("profiles")
      .select("id, full_name, phone, city, country")
      .in("id", userIds);
    const profileMap = new Map((profiles || []).map((p) => [p.id, p]));

    // Fetch onboarding goals for all lead-submitters in one query
    const { data: onboarding } = await service
      .from("onboarding_profiles")
      .select("user_id, intent, budget_min, budget_max, timeline, risk_level")
      .in("user_id", userIds);
    const onboardingMap = new Map((onboarding || []).map((o) => [o.user_id, o]));

    // Fetch auth emails using the service role admin API
    const emailMap = new Map<string, string>();
    await Promise.all(
      userIds.map(async (id) => {
        try {
          const { data } = await service.auth.admin.getUserById(id);
          if (data?.user?.email) emailMap.set(id, data.user.email);
        } catch { /* skip */ }
      })
    );

    return leads.map((lead) => {
      const profile = profileMap.get(lead.user_id) || null;
      const onb = onboardingMap.get(lead.user_id) || null;
      return {
        id: lead.id,
        status: lead.status,
        created_at: lead.created_at,
        updated_at: lead.updated_at,
        intent_data: lead.intent_data,
        user: {
          id: lead.user_id,
          name: profile?.full_name || null,
          email: emailMap.get(lead.user_id) || null,
          phone: profile?.phone || null,
          city: profile?.city || null,
          country: profile?.country || null
        },
        goals: onb ? {
          intent: onb.intent,
          budget_min: onb.budget_min,
          budget_max: onb.budget_max,
          timeline: onb.timeline,
          risk_level: onb.risk_level
        } : null
      };
    });
  }

  // Change a lead's status. Only the partner assigned to the lead can update it.
  async updateLeadStatus(
    userId: string,
    accessToken: string,
    leadId: string,
    status: string
  ) {
    const allowed = ["new", "contacted", "negotiation", "closed_won", "closed_lost"];
    if (!allowed.includes(status)) {
      throw new BadRequestException(`Invalid status. Allowed: ${allowed.join(", ")}`);
    }

    const partner = await this.getMe(userId, accessToken);
    if (!partner) throw new BadRequestException("No partner profile found");

    const service = this.getServiceClient();
    if (!service) throw new BadRequestException("Service role key not configured");

    const { data, error } = await service
      .from("leads")
      .update({ status, updated_at: new Date().toISOString() })
      .eq("id", leadId)
      .eq("partner_id", partner.id)
      .select()
      .single();
    if (error) return { error: error.message };
    return data;
  }

  private getUserClient(accessToken: string): SupabaseClient {
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
