import { Inject, Injectable, Optional } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { NormalizedCreditProfileInput } from "./credit-ai.contract";

type JsonObject = Record<string, unknown>;
type PersistenceStatus = "stored" | "skipped" | "failed";
type SupabaseWriter = Pick<SupabaseClient, "from">;

export interface UserFinancialProfilePersistenceResult {
  status: PersistenceStatus;
}

export interface UserFinancialProfileRow {
  user_id: string;
  annual_income?: number | null;
  monthly_debt?: number | null;
  current_housing_payment?: number | null;
  savings?: number | null;
  down_payment?: number | null;
  target_purchase_price?: number | null;
  employment_status?: string | null;
  employment_stability?: string | null;
  timeline?: string | null;
  target_location?: string | null;
  first_time_buyer?: boolean | null;
  risk_tolerance?: string | null;
  latest_credit_readiness_score?: number | null;
  latest_risk_level?: string | null;
  latest_credit_verified?: boolean;
  latest_credit_provider?: string | null;
  latest_credit_bureau?: string | null;
  latest_credit_assessment_expires_at?: string | null;
  updated_at: string;
}

@Injectable()
export class UserFinancialProfilesService {
  private client?: SupabaseWriter;

  constructor(
    private readonly config: ConfigService,
    @Optional()
    @Inject("USER_FINANCIAL_PROFILES_SUPABASE_WRITER")
    client?: SupabaseWriter
  ) {
    this.client = client;
  }

  // Persist safe reusable financial profile fields from the credit route.
  // The shaped response is already allowlisted by the API contract.
  async upsertFromCreditProfile(
    userId: string,
    normalizedCreditRequest: NormalizedCreditProfileInput,
    shapedCreditResponse: unknown
  ): Promise<UserFinancialProfilePersistenceResult> {
    const row = buildUserFinancialProfileRowFromCreditProfile(
      userId,
      normalizedCreditRequest,
      shapedCreditResponse
    );
    return this.upsertRow("financial_profile_credit_upsert", row);
  }

  // Persist only mortgage form financial fields. Client-supplied raw credit
  // handoff/provider data is ignored by the mortgage normalizer before use.
  async upsertFromMortgage(
    userId: string,
    mortgageRequest: unknown,
    mortgageResponse: unknown
  ): Promise<UserFinancialProfilePersistenceResult> {
    const row = buildUserFinancialProfileRowFromMortgage(
      userId,
      mortgageRequest,
      mortgageResponse
    );
    return this.upsertRow("financial_profile_mortgage_upsert", row);
  }

  private async upsertRow(
    stage: string,
    row: UserFinancialProfileRow | null
  ): Promise<UserFinancialProfilePersistenceResult> {
    if (!row || !hasPersistableFields(row)) {
      this.log(stage, "skipped");
      return { status: "skipped" };
    }

    const client = this.getServiceClient();
    if (!client) {
      this.log(stage, "skipped");
      return { status: "skipped" };
    }

    try {
      const { error } = await client
        .from("user_financial_profiles")
        .upsert(row, { onConflict: "user_id" });

      if (error) {
        this.log(stage, "failed");
        return { status: "failed" };
      }

      this.log(stage, "stored");
      return { status: "stored" };
    } catch {
      this.log(stage, "failed");
      return { status: "failed" };
    }
  }

  private getServiceClient(): SupabaseWriter | null {
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

  private log(stage: string, status: PersistenceStatus) {
    console.info("[user-financial-profiles]", { stage, status });
  }
}

export function buildUserFinancialProfileRowFromCreditProfile(
  userId: string,
  normalizedCreditRequest: NormalizedCreditProfileInput,
  shapedCreditResponse: unknown
): UserFinancialProfileRow {
  const financialProfile = asObject(normalizedCreditRequest.financialProfile);
  const response = asObject(shapedCreditResponse);
  const reportData = asObject(response.reportData);
  const providerStatus = asObject(reportData.providerStatus);
  const verificationStatus = asObject(reportData.verificationStatus);
  const creditAssessment = asObject(reportData.creditAssessment);

  return compact({
    user_id: userId,
    ...safeFinancialFields(financialProfile),
    latest_credit_readiness_score: safeNumber(response.score),
    latest_risk_level: safeString(response.riskLevel, 100),
    latest_credit_verified:
      verificationStatus.bureauDataVerified === true ||
      providerStatus.verified === true,
    latest_credit_provider: safeString(
      providerStatus.provider || verificationStatus.provider,
      100
    ),
    latest_credit_bureau: safeString(
      providerStatus.bureau || verificationStatus.bureau,
      100
    ),
    latest_credit_assessment_expires_at: safeTimestamp(
      creditAssessment.expiresAt
    ),
    updated_at: new Date().toISOString()
  });
}

export function buildUserFinancialProfileRowFromMortgage(
  userId: string,
  mortgageRequest: unknown,
  mortgageResponse: unknown
): UserFinancialProfileRow {
  const request = asObject(mortgageRequest);
  const financials = asObject(request.financials);
  const financialProfile = asObject(request.financialProfile);
  const property = asObject(request.property);
  const source = {
    ...request,
    ...financialProfile,
    ...financials,
    targetPurchasePrice: firstDefined(
      request.targetPurchasePrice,
      financials.targetPurchasePrice,
      property.price
    ),
    location: firstDefined(request.location, financials.location, property.location),
    annualIncome: firstDefined(
      request.annualIncome,
      request.annualGross,
      financials.annualIncome,
      financials.annualGross
    ),
    monthlyDebt: firstDefined(
      request.monthlyDebt,
      request.monthlyDebtPayments,
      financials.monthlyDebt,
      financials.monthlyDebtPayments
    ),
    employmentStatus: firstDefined(
      request.employmentStatus,
      request.employmentType,
      financials.employmentStatus,
      financials.employmentType
    )
  };
  const response = asObject(mortgageResponse);
  const reportData = asObject(response.reportData);

  return compact({
    user_id: userId,
    ...safeFinancialFields(source),
    ...safeCreditSummaryFields(reportData),
    updated_at: new Date().toISOString()
  });
}

function safeFinancialFields(source: JsonObject): Partial<UserFinancialProfileRow> {
  return compact({
    annual_income: safeNumber(source.annualIncome),
    monthly_debt: safeNumber(source.monthlyDebt),
    current_housing_payment: safeNumber(source.currentHousingPayment),
    savings: safeNumber(firstDefined(source.savings, source.availableFunds)),
    down_payment: safeNumber(source.downPayment),
    target_purchase_price: safeNumber(source.targetPurchasePrice),
    employment_status: safeString(source.employmentStatus, 100),
    employment_stability: safeString(source.employmentStability, 100),
    timeline: safeString(source.timeline, 100),
    target_location: safeString(source.location, 200),
    first_time_buyer: safeBoolean(source.firstTimeBuyer),
    risk_tolerance: safeString(source.riskTolerance, 100)
  });
}

function safeCreditSummaryFields(
  reportData: JsonObject
): Partial<UserFinancialProfileRow> {
  const providerStatus = asObject(reportData.providerStatus);
  const verificationStatus = asObject(reportData.verificationStatus);
  const creditAssessment = asObject(reportData.creditAssessment);
  const hasCreditSummary =
    Object.keys(providerStatus).length > 0 ||
    Object.keys(verificationStatus).length > 0 ||
    reportData.creditReadinessScore !== undefined ||
    reportData.creditRiskLevel !== undefined ||
    creditAssessment.expiresAt !== undefined;

  if (!hasCreditSummary) return {};

  return compact({
    latest_credit_readiness_score: safeNumber(reportData.creditReadinessScore),
    latest_risk_level: safeString(reportData.creditRiskLevel, 100),
    latest_credit_verified:
      verificationStatus.bureauDataVerified === true ||
      providerStatus.verified === true,
    latest_credit_provider: safeString(
      firstDefined(providerStatus.provider, verificationStatus.provider),
      100
    ),
    latest_credit_bureau: safeString(
      firstDefined(providerStatus.bureau, verificationStatus.bureau),
      100
    ),
    latest_credit_assessment_expires_at: safeTimestamp(
      creditAssessment.expiresAt
    )
  });
}

function hasPersistableFields(row: UserFinancialProfileRow): boolean {
  return Object.entries(row).some(([key, value]) => {
    return key !== "user_id" && key !== "updated_at" && value !== undefined;
  });
}

function compact<T extends JsonObject>(value: T): T {
  return Object.fromEntries(
    Object.entries(value).filter(([, item]) => item !== undefined)
  ) as T;
}

function asObject(value: unknown): JsonObject {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as JsonObject)
    : {};
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

function firstDefined(...values: unknown[]): unknown {
  return values.find((value) => value !== undefined && value !== null);
}
