import { BadRequestException, Injectable, ServiceUnavailableException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { createClient, SupabaseClient } from "@supabase/supabase-js";

const ALLOWED_ROLES = ["individual", "partner", "admin", "support"] as const;
type AllowedRole = (typeof ALLOWED_ROLES)[number];

@Injectable()
export class AdminService {
  private serviceClient?: SupabaseClient;

  constructor(private readonly config: ConfigService) {}

  // List all users (profile + auth email) for the admin's Users tab.
  async listUsers() {
    const service = this.requireService();

    const { data: profiles, error } = await service
      .from("profiles")
      .select("id, role, full_name, phone, city, country, kyc_status, created_at")
      .order("created_at", { ascending: false })
      .limit(500);
    if (error || !profiles) return [];

    // Fetch emails via auth admin API in parallel
    const withEmails = await Promise.all(
      profiles.map(async (p) => {
        let email: string | null = null;
        try {
          const { data } = await service.auth.admin.getUserById(p.id);
          email = data?.user?.email || null;
        } catch { /* skip */ }
        return { ...p, email };
      })
    );

    return withEmails;
  }

  // Change any user's role (admin-only action).
  async updateUserRole(userId: string, role: string) {
    if (!ALLOWED_ROLES.includes(role as AllowedRole)) {
      throw new BadRequestException(`Invalid role. Allowed: ${ALLOWED_ROLES.join(", ")}`);
    }
    const service = this.requireService();
    const { data, error } = await service
      .from("profiles")
      .update({ role })
      .eq("id", userId)
      .select()
      .single();
    if (error) return { error: error.message };
    return data;
  }

  // List all partners with their business info + owner's profile info.
  async listPartners() {
    const service = this.requireService();

    const { data: partners, error } = await service
      .from("partners")
      .select("id, user_id, partner_type, business_name, verified, subscription_tier, created_at")
      .order("created_at", { ascending: false })
      .limit(500);
    if (error || !partners) return [];

    const userIds = Array.from(new Set(partners.map((p) => p.user_id)));

    const { data: profiles } = await service
      .from("profiles")
      .select("id, full_name, city, country")
      .in("id", userIds);
    const profileMap = new Map((profiles || []).map((p) => [p.id, p]));

    const emailMap = new Map<string, string>();
    await Promise.all(
      userIds.map(async (id) => {
        try {
          const { data } = await service.auth.admin.getUserById(id);
          if (data?.user?.email) emailMap.set(id, data.user.email);
        } catch { /* skip */ }
      })
    );

    return partners.map((p) => {
      const prof = profileMap.get(p.user_id);
      return {
        id: p.id,
        user_id: p.user_id,
        partner_type: p.partner_type,
        business_name: p.business_name,
        verified: p.verified,
        subscription_tier: p.subscription_tier,
        created_at: p.created_at,
        owner: {
          name: prof?.full_name || null,
          email: emailMap.get(p.user_id) || null,
          city: prof?.city || null,
          country: prof?.country || null
        }
      };
    });
  }

  // Approve or unapprove a partner (flips the verified flag).
  async setPartnerVerified(partnerId: string, verified: boolean) {
    const service = this.requireService();
    const { data, error } = await service
      .from("partners")
      .update({ verified })
      .eq("id", partnerId)
      .select()
      .single();
    if (error) return { error: error.message };
    return data;
  }

  // Platform-wide stats for the admin overview.
  async getStats() {
    const service = this.requireService();

    const [profiles, partners, leads] = await Promise.all([
      service.from("profiles").select("role", { count: "exact" }),
      service.from("partners").select("verified", { count: "exact" }),
      service.from("leads").select("status", { count: "exact" })
    ]);

    const roleCounts = { individual: 0, partner: 0, admin: 0, support: 0 };
    (profiles.data || []).forEach((r: any) => {
      if (r.role && roleCounts[r.role as keyof typeof roleCounts] !== undefined) {
        roleCounts[r.role as keyof typeof roleCounts]++;
      }
    });

    const partnersVerified = (partners.data || []).filter((p: any) => p.verified).length;
    const partnersPending = (partners.data || []).length - partnersVerified;

    const leadCounts = { new: 0, contacted: 0, negotiation: 0, closed_won: 0, closed_lost: 0 };
    (leads.data || []).forEach((r: any) => {
      if (r.status && leadCounts[r.status as keyof typeof leadCounts] !== undefined) {
        leadCounts[r.status as keyof typeof leadCounts]++;
      }
    });

    return {
      users: {
        total: profiles.count || 0,
        by_role: roleCounts
      },
      partners: {
        total: partners.count || 0,
        verified: partnersVerified,
        pending: partnersPending
      },
      leads: {
        total: leads.count || 0,
        by_status: leadCounts
      }
    };
  }

  private requireService(): SupabaseClient {
    if (this.serviceClient) return this.serviceClient;
    const url = this.config.get<string>("SUPABASE_URL");
    const serviceRoleKey = this.config.get<string>("SUPABASE_SERVICE_ROLE_KEY");
    if (!url || !serviceRoleKey) {
      throw new ServiceUnavailableException("Service role key not configured");
    }
    this.serviceClient = createClient(url, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false }
    });
    return this.serviceClient;
  }
}
