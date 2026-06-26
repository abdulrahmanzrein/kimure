import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { createClient, SupabaseClient } from "@supabase/supabase-js";
import {
  DashboardAiInsight,
  DashboardAiInsightOptions,
  shapeDashboardAiInsight
} from "./dashboard-ai-insight.contract";

type DashboardInsightPersistenceStatus = "stored" | "skipped" | "failed";

export interface DashboardInsightPersistenceResult {
  status: DashboardInsightPersistenceStatus;
  insight: DashboardAiInsight;
}

interface AiReportInsertRow {
  user_id: string;
  ai_request_id: null;
  report_type: string;
  title: string;
  report_data: DashboardAiInsight;
}

@Injectable()
export class AiInsightsService {
  private client?: SupabaseClient;

  constructor(private readonly config: ConfigService) {}

  // Store only the sanitized dashboard contract. Persistence is best-effort:
  // a database problem must never block the user's live AI response.
  async persistDashboardInsight(
    userId: string,
    response: unknown,
    options: DashboardAiInsightOptions = {}
  ): Promise<DashboardInsightPersistenceResult> {
    const insight = shapePersistableDashboardInsight(response, options);
    const client = this.getServiceClient();

    if (!client) {
      this.log("ai_report_persist", "skipped");
      return { status: "skipped", insight };
    }

    const row = buildAiReportInsertRow(userId, insight);
    const { error } = await client.from("ai_reports").insert(row);

    if (error) {
      this.log("ai_report_persist", "failed");
      return { status: "failed", insight };
    }

    this.log("ai_report_persist", "stored");
    return { status: "stored", insight };
  }

  private getServiceClient(): SupabaseClient | null {
    if (this.client) return this.client;

    const url = this.config.get<string>("SUPABASE_URL");
    const serviceRoleKey = this.config.get<string>("SUPABASE_SERVICE_ROLE_KEY");
    if (!url || !serviceRoleKey) return null;

    this.client = createClient(url, serviceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    });
    return this.client;
  }

  private log(stage: string, status: string) {
    console.info("[ai-insights]", { stage, status });
  }
}

export function shapePersistableDashboardInsight(
  response: unknown,
  options: DashboardAiInsightOptions = {}
): DashboardAiInsight {
  const insight = shapeDashboardAiInsight(response, options);

  return {
    ...insight,
    id: null
  };
}

export function buildAiReportInsertRow(
  userId: string,
  insight: DashboardAiInsight
): AiReportInsertRow {
  return {
    user_id: userId,
    ai_request_id: null,
    report_type: insight.insightType,
    title: insight.title,
    report_data: insight
  };
}
