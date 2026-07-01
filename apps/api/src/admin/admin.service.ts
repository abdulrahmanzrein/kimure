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

  // AI usage summary for the admin dashboard.
  async getAiUsage() {
    const service = this.requireService();

    // Pull the last 500 requests so we can compute counts + show recent list
    const { data: requests } = await service
      .from("ai_requests")
      .select("id, user_id, engine, status, error_message, created_at")
      .order("created_at", { ascending: false })
      .limit(500);

    const rows = requests || [];
    const total = rows.length;
    const success = rows.filter((r) => r.status === "success").length;
    const failed = rows.filter((r) => r.status === "failed").length;

    // Count by engine
    const byEngine: Record<string, number> = {};
    rows.forEach((r) => {
      const engine = r.engine || "unknown";
      byEngine[engine] = (byEngine[engine] || 0) + 1;
    });

    // Requests per day for the last 7 days
    const now = new Date();
    const byDay: { date: string; count: number }[] = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(d.getDate() - i);
      const iso = d.toISOString().slice(0, 10);
      byDay.push({ date: iso, count: 0 });
    }
    rows.forEach((r) => {
      const iso = (r.created_at || "").slice(0, 10);
      const bucket = byDay.find((b) => b.date === iso);
      if (bucket) bucket.count++;
    });

    // Recent 20 requests, enriched with email
    const recent = rows.slice(0, 20);
    const userIds = Array.from(new Set(recent.map((r) => r.user_id).filter(Boolean)));
    const emailMap = new Map<string, string>();
    await Promise.all(
      userIds.map(async (id) => {
        try {
          const { data } = await service.auth.admin.getUserById(id);
          if (data?.user?.email) emailMap.set(id, data.user.email);
        } catch { /* skip */ }
      })
    );

    return {
      totals: { total, success, failed, success_rate: total ? Math.round((success / total) * 100) : 0 },
      by_engine: byEngine,
      by_day: byDay,
      recent: recent.map((r) => ({
        id: r.id,
        engine: r.engine,
        status: r.status,
        error_message: r.error_message,
        created_at: r.created_at,
        user_email: emailMap.get(r.user_id) || null
      }))
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
