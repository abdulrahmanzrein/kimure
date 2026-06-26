import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { createClient, SupabaseClient } from "@supabase/supabase-js";
import {
  DashboardAiInsight,
  DashboardAiInsightStatus,
  DashboardAiInsightOptions,
  DashboardAiInsightSourceLabel,
  DashboardAiInsightType,
  shapeDashboardAiInsight
} from "./dashboard-ai-insight.contract";

type DashboardInsightPersistenceStatus = "stored" | "skipped" | "failed";
type JsonObject = Record<string, unknown>;

export const dashboardInsightTypes: DashboardAiInsightType[] = [
  "onboarding_recommendation",
  "credit_readiness",
  "mortgage_estimate",
  "marketplace_tool"
];

export interface DashboardInsightPersistenceResult {
  status: DashboardInsightPersistenceStatus;
  insight: DashboardAiInsight;
}

export interface DashboardAiInsightsResponse {
  onboardingRecommendation: DashboardAiInsight | null;
  creditReadiness: DashboardAiInsight | null;
  mortgageEstimate: DashboardAiInsight | null;
  marketplaceTools: DashboardAiInsight[];
}

interface AiReportInsertRow {
  user_id: string;
  ai_request_id: null;
  report_type: string;
  title: string;
  report_data: DashboardAiInsight;
}

interface AiReportReadRow {
  report_type: string;
  report_data: unknown;
  created_at?: string | null;
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
      this.log("ai_report_persist", "skipped", insight.tool);
      return { status: "skipped", insight };
    }

    const row = buildAiReportInsertRow(userId, insight);

    try {
      const { error } = await client.from("ai_reports").insert(row);

      if (error) {
        this.log("ai_report_persist", "failed", insight.tool);
        return { status: "failed", insight };
      }
    } catch (error) {
      this.log("ai_report_persist", "failed", insight.tool);
      return { status: "failed", insight };
    }

    this.log("ai_report_persist", "stored", insight.tool);
    return { status: "stored", insight };
  }

  async getDashboardInsights(
    userId: string,
    accessToken: string
  ): Promise<DashboardAiInsightsResponse> {
    const rows = await this.fetchAiReportRows(userId, accessToken);
    return buildDashboardInsightsResponse(rows);
  }

  async getLatestInsight(
    userId: string,
    accessToken: string,
    insightType: DashboardAiInsightType
  ): Promise<DashboardAiInsight | null> {
    const rows = await this.fetchAiReportRows(userId, accessToken, insightType);
    return rows.map(normalizeAiReportRow).find(Boolean) ?? null;
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

  private getUserClient(accessToken: string): SupabaseClient | null {
    const url = this.config.get<string>("SUPABASE_URL");
    const publishableKey = this.config.get<string>("SUPABASE_PUBLISHABLE_KEY");
    if (!url || !publishableKey) return null;

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

  private async fetchAiReportRows(
    userId: string,
    accessToken: string,
    insightType?: DashboardAiInsightType
  ): Promise<AiReportReadRow[]> {
    const client = this.getUserClient(accessToken);
    if (!client) return [];

    let query = client
      .from("ai_reports")
      .select("report_type, report_data, created_at")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(insightType === "marketplace_tool" || !insightType ? 50 : 10);

    query = insightType
      ? query.eq("report_type", insightType)
      : query.in("report_type", dashboardInsightTypes);

    const { data, error } = await query;
    if (error || !Array.isArray(data)) return [];

    return data as AiReportReadRow[];
  }

  private log(stage: string, status: string, tool: string) {
    console.info("[ai-insights]", { stage, status, tool });
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

export function isDashboardInsightType(
  value: unknown
): value is DashboardAiInsightType {
  return (
    typeof value === "string" &&
    dashboardInsightTypes.includes(value as DashboardAiInsightType)
  );
}

export function buildDashboardInsightsResponse(
  rows: AiReportReadRow[]
): DashboardAiInsightsResponse {
  const insights = rows
    .map(normalizeAiReportRow)
    .filter((insight): insight is DashboardAiInsight => insight !== null);

  return {
    onboardingRecommendation: firstInsight(
      insights,
      "onboarding_recommendation"
    ),
    creditReadiness: firstInsight(insights, "credit_readiness"),
    mortgageEstimate: firstInsight(insights, "mortgage_estimate"),
    marketplaceTools: insights
      .filter((insight) => insight.insightType === "marketplace_tool")
      .slice(0, 10)
  };
}

export function normalizeAiReportRow(
  row: AiReportReadRow
): DashboardAiInsight | null {
  if (!isDashboardInsightType(row.report_type)) return null;

  const source = asObject(row.report_data);
  const fallback = shapeDashboardAiInsight(source, {
    insightType: row.report_type,
    tool: source.tool,
    title: source.title,
    generatedAt: safeTimestamp(row.created_at)
  });
  const storedMetadata = asObject(source.safeMetadata);

  return {
    id: safeString(source.id),
    insightType: row.report_type,
    tool: safeCode(source.tool) || fallback.tool,
    title: safeText(source.title, 120) || fallback.title,
    summary: safeText(source.summary, 4000),
    score: safeNumber(source.score),
    riskLevel: safeText(source.riskLevel, 120),
    keyInsights: safeStringArray(source.keyInsights),
    recommendations: safeStringArray(source.recommendations),
    nextSteps: safeStringArray(source.nextSteps),
    crmSignals: pickStoredCrmSignals(source.crmSignals),
    status: safeInsightStatus(source.status) || fallback.status,
    sourceLabel: safeSourceLabel(source.sourceLabel) || fallback.sourceLabel,
    disclaimer: safeText(source.disclaimer, 4000),
    safeMetadata: {
      providerStatus:
        safeCode(storedMetadata.providerStatus) ||
        fallback.safeMetadata.providerStatus,
      verificationStatus:
        safeCode(storedMetadata.verificationStatus) ||
        fallback.safeMetadata.verificationStatus,
      missingFieldCount:
        safeNumber(storedMetadata.missingFieldCount) ??
        fallback.safeMetadata.missingFieldCount,
      creditReferenceStatus:
        safeCode(storedMetadata.creditReferenceStatus) ||
        fallback.safeMetadata.creditReferenceStatus,
      expiresAt:
        safeTimestamp(storedMetadata.expiresAt) ||
        fallback.safeMetadata.expiresAt,
      generatedAt:
        safeTimestamp(storedMetadata.generatedAt) ||
        safeTimestamp(row.created_at) ||
        fallback.safeMetadata.generatedAt
    }
  };
}

function firstInsight(
  insights: DashboardAiInsight[],
  insightType: DashboardAiInsightType
): DashboardAiInsight | null {
  return insights.find((insight) => insight.insightType === insightType) ?? null;
}

function pickStoredCrmSignals(value: unknown) {
  const source = asObject(value);

  return compact({
    leadIntent: safeText(source.leadIntent, 200),
    leadTemperature: safeText(source.leadTemperature, 100),
    readinessBand: safeText(source.readinessBand, 100),
    mortgageReadiness: safeText(source.mortgageReadiness, 200),
    suggestedFollowUp: safeText(source.suggestedFollowUp, 500),
    recommendedFollowUp: safeText(source.recommendedFollowUp, 500)
  });
}

function safeInsightStatus(value: unknown): DashboardAiInsightStatus | null {
  return ["success", "fallback", "expired", "unavailable"].includes(
    safeString(value) || ""
  )
    ? (value as DashboardAiInsightStatus)
    : null;
}

function safeSourceLabel(
  value: unknown
): DashboardAiInsightSourceLabel | null {
  return [
    "Gemini-backed",
    "Platform-signal fallback",
    "Rules-based directional"
  ].includes(safeString(value) || "")
    ? (value as DashboardAiInsightSourceLabel)
    : null;
}

function safeStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];

  return value
    .map((item) => safeText(item, 1000))
    .filter((item): item is string => Boolean(item));
}

function safeText(value: unknown, max = 1000): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  return redactSensitiveText(trimmed).slice(0, max);
}

function safeString(value: unknown, max = 200): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed ? trimmed.slice(0, max) : null;
}

function safeCode(value: unknown): string | undefined {
  const text = safeString(value, 120);
  if (!text) return undefined;
  return text.toLowerCase().replace(/[^a-z0-9_-]+/g, "_").slice(0, 120);
}

function safeNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function safeTimestamp(value: unknown): string | undefined {
  const text = safeString(value, 100);
  if (!text || Number.isNaN(Date.parse(text))) return undefined;
  return text;
}

function asObject(value: unknown): JsonObject {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as JsonObject)
    : {};
}

function compact(value: JsonObject): JsonObject {
  return Object.fromEntries(
    Object.entries(value).filter(([, item]) => item !== undefined)
  );
}

function redactSensitiveText(value: string): string {
  return value
    .replace(/\b\d{3}[- ]?\d{3}[- ]?\d{3}\b/g, "[redacted-id]")
    .replace(/\b\d{4}-\d{2}-\d{2}\b/g, "[redacted-date]")
    .replace(
      /\b\d{1,6}\s+[A-Za-z0-9 .'-]+(?:Street|St|Avenue|Ave|Road|Rd|Drive|Dr|Boulevard|Blvd|Lane|Ln|Court|Ct|Way)\b/gi,
      "[redacted-address]"
    )
    .replace(/\bBearer\s+[A-Za-z0-9._~+/-]+=*/g, "Bearer [redacted-token]")
    .replace(/\bAIza[A-Za-z0-9_-]{20,}\b/g, "[redacted-api-key]");
}
