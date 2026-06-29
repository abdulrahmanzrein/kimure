import { Inject, Injectable, Optional } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { createClient, SupabaseClient } from "@supabase/supabase-js";

type JsonObject = Record<string, unknown>;
type SupabaseReader = Pick<SupabaseClient, "from">;

export interface DashboardAiCreditResponse {
  profile: JsonObject | null;
  onboarding: JsonObject | null;
  financialProfile: JsonObject | null;
  creditReadiness: JsonObject | null;
  mortgageReadiness: JsonObject | null;
  consents: JsonObject[];
  aiInsights: JsonObject[];
  nextActions: string[];
}

@Injectable()
export class DashboardService {
  private client?: SupabaseReader;

  constructor(
    private readonly config: ConfigService,
    @Optional()
    @Inject("DASHBOARD_SUPABASE_READER")
    client?: SupabaseReader
  ) {
    this.client = client;
  }

  // All reads are filtered by the authenticated Supabase user id. This endpoint
  // returns dashboard-safe summaries only, never raw provider or AI payloads.
  async getAiCreditDashboard(
    userId: string
  ): Promise<DashboardAiCreditResponse> {
    const client = this.getServiceClient();
    if (!client) return emptyDashboard();

    const [
      profile,
      onboarding,
      financialProfile,
      creditReadiness,
      consents,
      aiInsights
    ] = await Promise.all([
      safeMaybeSingle(() =>
        client
          .from("profiles")
          .select(
            "id, role, full_name, city, country, kyc_status, created_at, updated_at"
          )
          .eq("id", userId)
          .maybeSingle()
      ),
      safeMaybeSingle(() =>
        client
          .from("onboarding_profiles")
          .select(
            "intent, budget_min, budget_max, timeline, risk_level, location_preferences, property_preferences, financial_inputs, updated_at"
          )
          .eq("user_id", userId)
          .maybeSingle()
      ),
      safeMaybeSingle(() =>
        client
          .from("user_financial_profiles")
          .select(
            "annual_income, monthly_debt, current_housing_payment, savings, down_payment, target_purchase_price, employment_status, employment_stability, timeline, target_location, first_time_buyer, risk_tolerance, latest_credit_readiness_score, latest_risk_level, latest_credit_verified, latest_credit_provider, latest_credit_bureau, latest_credit_assessment_expires_at, updated_at"
          )
          .eq("user_id", userId)
          .maybeSingle()
      ),
      safeMaybeSingle(() =>
        client
          .from("credit_assessments")
          .select(
            "status, tool, provider_choice, provider_status, verification_status, readiness_score, risk_level, result_type, created_at, expires_at, last_used_at, revoked_at"
          )
          .eq("user_id", userId)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle()
      ),
      safeList(() =>
        client
          .from("credit_consents")
          .select(
            "provider_choice, provider, bureau, permissible_purpose, consent_version, status, consented_at, expires_at, revoked_at, source, created_at"
          )
          .eq("user_id", userId)
          .order("created_at", { ascending: false })
          .limit(5)
      ),
      safeList(() =>
        client
          .from("ai_reports")
          .select("report_type, title, report_data, created_at")
          .eq("user_id", userId)
          .order("created_at", { ascending: false })
          .limit(8)
      )
    ]);

    const dashboard = {
      profile: shapeProfile(profile),
      onboarding: shapeOnboarding(onboarding),
      financialProfile: shapeFinancialProfile(financialProfile),
      creditReadiness: shapeCreditReadiness(creditReadiness, financialProfile),
      mortgageReadiness: shapeMortgageReadiness(aiInsights, creditReadiness),
      consents: consents.map(shapeConsent).filter(Boolean) as JsonObject[],
      aiInsights: aiInsights.map(shapeAiInsight).filter(Boolean) as JsonObject[],
      nextActions: [] as string[]
    };

    dashboard.nextActions = buildNextActions(dashboard);
    return dashboard;
  }

  private getServiceClient(): SupabaseReader | null {
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
}

export function emptyDashboard(): DashboardAiCreditResponse {
  return {
    profile: null,
    onboarding: null,
    financialProfile: null,
    creditReadiness: null,
    mortgageReadiness: null,
    consents: [],
    aiInsights: [],
    nextActions: ["Complete onboarding to start personalizing Kimure."]
  };
}

export function shapeProfile(value: unknown): JsonObject | null {
  const source = asObject(value);
  if (!source) return null;

  return compact({
    id: safeString(source.id, 100),
    role: safeString(source.role, 100),
    fullName: safeString(source.full_name, 200),
    city: safeString(source.city, 120),
    country: safeString(source.country, 120),
    kycStatus: safeString(source.kyc_status, 100),
    createdAt: safeTimestamp(source.created_at),
    updatedAt: safeTimestamp(source.updated_at)
  });
}

export function shapeOnboarding(value: unknown): JsonObject | null {
  const source = asObject(value);
  if (!source) return null;

  return compact({
    intent: safeString(source.intent, 120),
    budgetMin: safeNumber(source.budget_min),
    budgetMax: safeNumber(source.budget_max),
    timeline: safeString(source.timeline, 120),
    riskLevel: safeString(source.risk_level, 120),
    locationPreferences: safeLocationPreferences(source.location_preferences),
    propertyPreferences: safeStringArray(source.property_preferences),
    financialInputs: shapeOnboardingFinancialInputs(source.financial_inputs),
    updatedAt: safeTimestamp(source.updated_at)
  });
}

export function shapeFinancialProfile(value: unknown): JsonObject | null {
  const source = asObject(value);
  if (!source) return null;

  return compact({
    annualIncome: safeNumber(source.annual_income),
    monthlyDebt: safeNumber(source.monthly_debt),
    currentHousingPayment: safeNumber(source.current_housing_payment),
    savings: safeNumber(source.savings),
    downPayment: safeNumber(source.down_payment),
    targetPurchasePrice: safeNumber(source.target_purchase_price),
    employmentStatus: safeString(source.employment_status, 120),
    employmentStability: safeString(source.employment_stability, 120),
    timeline: safeString(source.timeline, 120),
    targetLocation: safeString(source.target_location, 200),
    firstTimeBuyer: safeBoolean(source.first_time_buyer),
    riskTolerance: safeString(source.risk_tolerance, 120),
    latestCreditReadinessScore: safeNumber(
      source.latest_credit_readiness_score
    ),
    latestRiskLevel: safeString(source.latest_risk_level, 120),
    latestCreditVerified: safeBoolean(source.latest_credit_verified),
    latestCreditProvider: safeString(source.latest_credit_provider, 120),
    latestCreditBureau: safeString(source.latest_credit_bureau, 120),
    latestCreditAssessmentExpiresAt: safeTimestamp(
      source.latest_credit_assessment_expires_at
    ),
    updatedAt: safeTimestamp(source.updated_at)
  });
}

export function shapeCreditReadiness(
  assessmentValue: unknown,
  financialProfileValue?: unknown
): JsonObject | null {
  const assessment = asObject(assessmentValue);
  const financialProfile = asObject(financialProfileValue);

  if (!assessment && !financialProfile) return null;

  const providerStatus = pickScalars(assessment?.provider_status, [
    "provider",
    "bureau",
    "status",
    "environment",
    "verified"
  ]);
  const verificationStatus = pickScalars(assessment?.verification_status, [
    "status",
    "provider",
    "bureau",
    "providerStatus",
    "bureauDataVerified",
    "providerEnvironment",
    "providedDataUsed"
  ]);

  return compact({
    status: safeString(assessment?.status, 100),
    providerChoice: safeString(assessment?.provider_choice, 120),
    provider: safeString(providerStatus.provider, 120) ||
      safeString(financialProfile?.latest_credit_provider, 120),
    bureau: safeString(providerStatus.bureau, 120) ||
      safeString(financialProfile?.latest_credit_bureau, 120),
    providerStatus: safeString(providerStatus.status, 120),
    verificationStatus: safeString(verificationStatus.status, 120),
    bureauDataVerified:
      safeBoolean(verificationStatus.bureauDataVerified) ??
      safeBoolean(providerStatus.verified) ??
      safeBoolean(financialProfile?.latest_credit_verified),
    readinessScore:
      safeNumber(assessment?.readiness_score) ??
      safeNumber(financialProfile?.latest_credit_readiness_score),
    riskLevel:
      safeString(assessment?.risk_level, 120) ||
      safeString(financialProfile?.latest_risk_level, 120),
    resultType: safeString(assessment?.result_type, 120),
    createdAt: safeTimestamp(assessment?.created_at),
    expiresAt:
      safeTimestamp(assessment?.expires_at) ||
      safeTimestamp(financialProfile?.latest_credit_assessment_expires_at),
    lastUsedAt: safeTimestamp(assessment?.last_used_at),
    revokedAt: safeTimestamp(assessment?.revoked_at),
    missingFields: safeStringArray(verificationStatus.missingFields),
    missingFieldCount: safeStringArray(verificationStatus.missingFields).length
  });
}

export function shapeMortgageReadiness(
  aiReports: unknown[],
  creditAssessment?: unknown
): JsonObject | null {
  const latestMortgageReport = aiReports
    .map(asObject)
    .find((report) => report?.report_type === "mortgage_estimate");
  const reportData = asObject(latestMortgageReport?.report_data);

  if (!latestMortgageReport && !asObject(creditAssessment)) return null;

  return compact({
    summary: safeString(reportData?.summary, 2000),
    score: safeNumber(reportData?.score),
    riskLevel: safeString(reportData?.riskLevel, 120),
    affordabilityRange: safeString(reportData?.affordabilityRange, 200),
    paymentRange: safeString(reportData?.paymentRange, 200),
    creditReferenceStatus: safeString(
      asObject(reportData?.safeMetadata)?.creditReferenceStatus,
      120
    ),
    generatedAt:
      safeTimestamp(asObject(reportData?.safeMetadata)?.generatedAt) ||
      safeTimestamp(latestMortgageReport?.created_at),
    latestCreditExpiresAt: safeTimestamp(asObject(creditAssessment)?.expires_at)
  });
}

export function shapeConsent(value: unknown): JsonObject | null {
  const source = asObject(value);
  if (!source) return null;

  return compact({
    providerChoice: safeString(source.provider_choice, 120),
    provider: safeString(source.provider, 120),
    bureau: safeString(source.bureau, 120),
    permissiblePurpose: safeString(source.permissible_purpose, 200),
    consentVersion: safeString(source.consent_version, 120),
    status: safeString(source.status, 100),
    consentedAt: safeTimestamp(source.consented_at),
    expiresAt: safeTimestamp(source.expires_at),
    revokedAt: safeTimestamp(source.revoked_at),
    source: safeString(source.source, 120),
    createdAt: safeTimestamp(source.created_at)
  });
}

export function shapeAiInsight(value: unknown): JsonObject | null {
  const source = asObject(value);
  if (!source) return null;

  const reportData = asObject(source.report_data);
  if (!reportData) {
    return compact({
      reportType: safeString(source.report_type, 120),
      title: safeString(source.title, 200),
      createdAt: safeTimestamp(source.created_at)
    });
  }

  return compact({
    reportType:
      safeString(reportData.insightType, 120) ||
      safeString(source.report_type, 120),
    tool: safeString(reportData.tool, 120),
    title: safeString(reportData.title, 200) || safeString(source.title, 200),
    summary: safeString(reportData.summary, 2000),
    score: safeNumber(reportData.score),
    riskLevel: safeString(reportData.riskLevel, 120),
    keyInsights: safeStringArray(reportData.keyInsights),
    recommendations: safeStringArray(reportData.recommendations),
    nextSteps: safeStringArray(reportData.nextSteps),
    status: safeString(reportData.status, 100),
    sourceLabel: safeString(reportData.sourceLabel, 120),
    disclaimer: safeString(reportData.disclaimer, 2000),
    safeMetadata: shapeSafeMetadata(reportData.safeMetadata),
    createdAt: safeTimestamp(source.created_at)
  });
}

function shapeSafeMetadata(value: unknown): JsonObject | null {
  const source = asObject(value);
  if (!source) return null;

  return compact({
    providerStatus: safeString(source.providerStatus, 120),
    verificationStatus: safeString(source.verificationStatus, 120),
    missingFieldCount: safeNumber(source.missingFieldCount),
    creditReferenceStatus: safeString(source.creditReferenceStatus, 120),
    expiresAt: safeTimestamp(source.expiresAt),
    generatedAt: safeTimestamp(source.generatedAt)
  });
}

function shapeOnboardingFinancialInputs(value: unknown): JsonObject | null {
  const source = asObject(value);
  if (!source) return null;

  return compact({
    availableFunds: safeNumber(source.available_funds),
    monthlyRentalIncome: safeNumber(source.monthly_rental_income),
    returnGoals: safeStringArray(source.return_goals)
  });
}

function buildNextActions(dashboard: DashboardAiCreditResponse): string[] {
  const actions: string[] = [];

  if (!dashboard.onboarding) actions.push("Complete smart onboarding.");
  if (!dashboard.financialProfile) actions.push("Save a financial profile.");
  if (!dashboard.creditReadiness) actions.push("Run a credit readiness check.");
  if (!dashboard.mortgageReadiness) actions.push("Generate a mortgage estimate.");
  if (!dashboard.consents.length) {
    actions.push("Add bureau consent only when requesting provider verification.");
  }

  return actions.slice(0, 5);
}

async function safeMaybeSingle(
  query: () => PromiseLike<{ data: unknown; error: unknown }>
): Promise<unknown | null> {
  try {
    const { data, error } = await query();
    if (error || !data) return null;
    return data;
  } catch {
    return null;
  }
}

async function safeList(
  query: () => PromiseLike<{ data: unknown; error: unknown }>
): Promise<unknown[]> {
  try {
    const { data, error } = await query();
    if (error || !Array.isArray(data)) return [];
    return data;
  } catch {
    return [];
  }
}

function pickScalars(value: unknown, keys: string[]): JsonObject {
  const source = asObject(value);
  const result: JsonObject = {};
  if (!source) return result;

  for (const key of keys) {
    const item = source[key];
    if (typeof item === "boolean") result[key] = item;
    if (typeof item === "number" && Number.isFinite(item)) result[key] = item;
    if (typeof item === "string" && item.trim()) {
      result[key] = item.trim().slice(0, 1000);
    }
  }

  return result;
}

function asObject(value: unknown): JsonObject | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as JsonObject)
    : null;
}

function safeString(value: unknown, max = 1000): string | null {
  return typeof value === "string" && value.trim()
    ? value.trim().slice(0, max)
    : null;
}

function safeNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function safeBoolean(value: unknown): boolean | null {
  return typeof value === "boolean" ? value : null;
}

function safeTimestamp(value: unknown): string | null {
  const text = safeString(value, 100);
  if (!text || Number.isNaN(Date.parse(text))) return null;
  return new Date(text).toISOString();
}

function safeStringArray(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value
      .filter((item) => typeof item === "string" && item.trim())
      .map((item) => item.trim().slice(0, 300))
      .slice(0, 20);
  }

  return [];
}

function safeLocationPreferences(value: unknown): string[] {
  if (!Array.isArray(value)) return [];

  return value
    .map((item) => {
      if (typeof item === "string") return safeString(item, 300);
      const source = asObject(item);
      if (!source) return null;
      return [
        safeString(source.city, 120),
        safeString(source.country, 120)
      ].filter(Boolean).join(", ");
    })
    .filter((item): item is string => Boolean(item))
    .slice(0, 10);
}

function compact(value: JsonObject): JsonObject {
  return Object.fromEntries(
    Object.entries(value).filter(
      ([, item]) => item !== undefined && item !== null
    )
  );
}
