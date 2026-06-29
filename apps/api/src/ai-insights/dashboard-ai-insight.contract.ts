export type DashboardAiInsightType =
  | "onboarding_recommendation"
  | "credit_readiness"
  | "mortgage_estimate"
  | "marketplace_tool";

export type DashboardAiInsightStatus =
  | "success"
  | "fallback"
  | "expired"
  | "unavailable";

export type DashboardAiInsightSourceLabel =
  | "Gemini-backed"
  | "Platform-signal fallback"
  | "Rules-based directional";

export interface DashboardAiInsight {
  id: string | null;
  insightType: DashboardAiInsightType;
  tool: string;
  title: string;
  summary: string | null;
  score: number | null;
  riskLevel: string | null;
  keyInsights: string[];
  recommendations: string[];
  nextSteps: string[];
  crmSignals: DashboardAiCrmSignals;
  status: DashboardAiInsightStatus;
  sourceLabel: DashboardAiInsightSourceLabel;
  disclaimer: string | null;
  safeMetadata: DashboardAiInsightMetadata;
}

export interface DashboardAiCrmSignals {
  leadIntent?: string;
  leadTemperature?: string;
  readinessBand?: string;
  mortgageReadiness?: string;
  suggestedFollowUp?: string;
  recommendedFollowUp?: string;
}

export interface DashboardAiInsightMetadata {
  providerStatus?: string;
  verificationStatus?: string;
  missingFieldCount?: number;
  creditReferenceStatus?: string;
  expiresAt?: string;
  generatedAt: string;
}

export interface DashboardAiInsightOptions {
  id?: unknown;
  insightType?: DashboardAiInsightType;
  tool?: unknown;
  title?: unknown;
  generatedAt?: string;
}

type JsonObject = Record<string, unknown>;

const defaultTitles: Record<DashboardAiInsightType, string> = {
  onboarding_recommendation: "Smart Onboarding Recommendation",
  credit_readiness: "Credit Readiness Summary",
  mortgage_estimate: "Mortgage Estimate Summary",
  marketplace_tool: "Marketplace AI Insight"
};

// Convert an AI result into the only shape the future dashboard should read.
// This is intentionally allowlist-only; raw request/response payloads stay out.
export function shapeDashboardAiInsight(
  value: unknown,
  options: DashboardAiInsightOptions = {}
): DashboardAiInsight {
  const source = asObject(value);
  const reportData = asObject(source.reportData);
  const tool = safeCode(options.tool) || safeCode(source.tool) || "unknown";
  const insightType = options.insightType || inferInsightType(tool);
  const sourceLabel = inferSourceLabel(source, reportData, tool);
  const metadata = buildSafeMetadata(reportData, options.generatedAt);

  return {
    id: safeString(options.id) || safeString(source.id) || null,
    insightType,
    tool,
    title:
      safeText(options.title, 120) ||
      safeText(source.title, 120) ||
      defaultTitles[insightType],
    summary: safeText(source.summary, 4000),
    score: safeNumber(source.score),
    riskLevel: safeText(source.riskLevel, 120),
    keyInsights: safeStringArray(source.keyInsights),
    recommendations: safeStringArray(source.recommendations),
    nextSteps: firstStringArray(
      source.nextSteps,
      reportData.nextSteps,
      reportData.nextBestActions
    ),
    crmSignals: pickCrmSignals(source.crmSignals),
    status: inferStatus(source, metadata, sourceLabel),
    sourceLabel,
    disclaimer: safeText(source.disclaimer, 4000),
    safeMetadata: metadata
  };
}

function inferInsightType(tool: string): DashboardAiInsightType {
  if (tool === "credit-profile") return "credit_readiness";
  if (tool === "mortgage") return "mortgage_estimate";
  return "marketplace_tool";
}

function inferStatus(
  source: JsonObject,
  metadata: DashboardAiInsightMetadata,
  sourceLabel: DashboardAiInsightSourceLabel
): DashboardAiInsightStatus {
  const status = safeCode(source.status);
  if (status === "error" || status === "failed") return "unavailable";
  if (metadata.creditReferenceStatus === "not_found_or_expired") {
    return "expired";
  }
  if (sourceLabel === "Platform-signal fallback") return "fallback";
  return "success";
}

function inferSourceLabel(
  source: JsonObject,
  reportData: JsonObject,
  tool: string
): DashboardAiInsightSourceLabel {
  const sourceCode = safeCode(source.source) || safeCode(reportData.source);
  const geminiMode = safeCode(reportData.geminiMode);
  const aiReasoning = asObject(reportData.aiReasoning);
  const fallbackData = asObject(reportData.fallbackData);
  const providerStatus = asObject(reportData.providerStatus);
  const verificationStatus = asObject(reportData.verificationStatus);

  if (sourceCode === "gemini" || geminiMode === "live") {
    return "Gemini-backed";
  }

  if (
    safeCode(aiReasoning.mode) === "rules_directional" ||
    (tool === "credit-profile" &&
      (safeCode(providerStatus.provider) === "directional" ||
        safeCode(verificationStatus.status) === "directional_only"))
  ) {
    return "Rules-based directional";
  }

  if (
    sourceCode === "fallback" ||
    Object.keys(fallbackData).length > 0 ||
    (geminiMode !== null && geminiMode !== "live")
  ) {
    return "Platform-signal fallback";
  }

  // Do not claim Gemini unless the response explicitly says so.
  return "Platform-signal fallback";
}

function buildSafeMetadata(
  reportData: JsonObject,
  generatedAt?: string
): DashboardAiInsightMetadata {
  const providerStatus = asObject(reportData.providerStatus);
  const verificationStatus = asObject(reportData.verificationStatus);
  const creditAssessment = asObject(reportData.creditAssessment);
  const creditReferenceStatus = asObject(
    reportData.creditReferenceStatus || reportData.creditAssessmentResolution
  );
  const missingFields = safeStringArray(reportData.missingFields);
  const referenceWarning = safeCode(creditReferenceStatus.warning);
  const referenceStatus = referenceWarning === "credit_assessment_not_found_or_expired"
    ? "not_found_or_expired"
    : safeCode(creditReferenceStatus.status);

  const metadata: DashboardAiInsightMetadata = {
    missingFieldCount: missingFields.length,
    generatedAt: generatedAt || new Date().toISOString()
  };
  const providerStatusCode = safeCode(providerStatus.status);
  const verificationStatusCode = safeCode(verificationStatus.status);
  const expiresAt =
    safeTimestamp(creditAssessment.expiresAt) ||
    safeTimestamp(creditReferenceStatus.expiresAt);

  if (providerStatusCode) metadata.providerStatus = providerStatusCode;
  if (verificationStatusCode) {
    metadata.verificationStatus = verificationStatusCode;
  }
  if (referenceStatus) metadata.creditReferenceStatus = referenceStatus;
  if (expiresAt) metadata.expiresAt = expiresAt;

  return metadata;
}

function pickCrmSignals(value: unknown): DashboardAiCrmSignals {
  const source = asObject(value);

  return compact({
    leadIntent: safeText(source.leadIntent, 200),
    leadTemperature: safeText(source.leadTemperature, 100),
    readinessBand: safeText(source.readinessBand, 100),
    mortgageReadiness: safeText(source.mortgageReadiness, 200),
    suggestedFollowUp: safeText(source.suggestedFollowUp, 500),
    recommendedFollowUp: safeText(source.recommendedFollowUp, 500)
  }) as DashboardAiCrmSignals;
}

function firstStringArray(...values: unknown[]): string[] {
  for (const value of values) {
    const normalized = safeStringArray(value);
    if (normalized.length > 0) return normalized;
  }

  return [];
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
