import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { createHmac } from "crypto";
import { sanitizeCreditMortgageHandoff } from "./credit-ai.contract";

type JsonObject = Record<string, unknown>;

type PersistenceStatus = "stored" | "skipped" | "failed";
type ResolutionStatus =
  | "not_provided"
  | "resolved"
  | "not_found_or_expired"
  | "unavailable";

export interface CreditAssessmentPersistenceResult {
  status: PersistenceStatus;
  response: JsonObject;
}

export interface CreditAssessmentResolution {
  status: ResolutionStatus;
  creditMortgageHandoff?: JsonObject;
  expiresAt?: string;
}

interface CreditAssessmentRow {
  assessment_id_hash: string;
  user_id: string;
  status: "active";
  tool: "credit-profile";
  storage_version: "credit-assessment-v1";
  provider_choice: string | null;
  provider_status: JsonObject;
  verification_status: JsonObject;
  consent_status: JsonObject;
  credit_mortgage_handoff: JsonObject;
  readiness_score: number | null;
  risk_level: string | null;
  result_type: string | null;
  expires_at: string;
}

@Injectable()
export class CreditAssessmentsService {
  private client?: SupabaseClient;

  constructor(private readonly config: ConfigService) {}

  // Store only the API-shaped credit result. This keeps raw bureau/provider
  // data, prompts, tokens, identity data, and full addresses out of Supabase.
  async persistCreditProfileResponse(
    userId: string,
    response: unknown
  ): Promise<CreditAssessmentPersistenceResult> {
    const source = asObject(response);
    const client = this.getServiceClient();
    const hashSecret = this.getHashSecret();

    if (!client || !hashSecret) {
      this.log("credit_profile_persist", "skipped");
      return { status: "skipped", response: source };
    }

    const row = buildCreditAssessmentRow(userId, source, hashSecret);
    if (!row) {
      this.log("credit_profile_persist", "skipped");
      return { status: "skipped", response: source };
    }

    const { error } = await client
      .from("credit_assessments")
      .upsert(row, { onConflict: "assessment_id_hash" });

    if (error) {
      this.log("credit_profile_persist", "failed");
      return { status: "failed", response: source };
    }

    this.log("credit_profile_persist", "stored");
    return {
      status: "stored",
      response: markCreditAssessmentPersisted(source)
    };
  }

  // Resolve the opaque browser reference against the authenticated user.
  // A missing or expired reference never blocks the mortgage route.
  async resolveForMortgage(
    userId: string,
    assessmentId: unknown
  ): Promise<CreditAssessmentResolution> {
    const normalizedAssessmentId = safeString(assessmentId, 200);
    if (!normalizedAssessmentId) {
      this.log("mortgage_reference_resolve", "not_provided");
      return { status: "not_provided" };
    }

    const client = this.getServiceClient();
    const hashSecret = this.getHashSecret();
    if (!client || !hashSecret) {
      this.log("mortgage_reference_resolve", "unavailable");
      return { status: "unavailable" };
    }

    const assessmentIdHash = hashCreditAssessmentId(
      normalizedAssessmentId,
      hashSecret
    );
    const { data, error } = await client
      .from("credit_assessments")
      .select("credit_mortgage_handoff, expires_at")
      .eq("assessment_id_hash", assessmentIdHash)
      .eq("user_id", userId)
      .eq("status", "active")
      .is("revoked_at", null)
      .gt("expires_at", new Date().toISOString())
      .maybeSingle();

    if (error || !data) {
      this.log("mortgage_reference_resolve", "not_found_or_expired");
      return { status: "not_found_or_expired" };
    }

    await client
      .from("credit_assessments")
      .update({ last_used_at: new Date().toISOString() })
      .eq("assessment_id_hash", assessmentIdHash)
      .eq("user_id", userId);

    this.log("mortgage_reference_resolve", "resolved");
    return {
      status: "resolved",
      creditMortgageHandoff: sanitizeCreditMortgageHandoff(
        data.credit_mortgage_handoff
      ),
      expiresAt: safeString(data.expires_at, 100) ?? undefined
    };
  }

  // Build the Gateway mortgage input after the API has resolved the reference.
  // The browser's raw handoff is already dropped by normalizeMortgageInput.
  buildMortgageGatewayInput(
    input: JsonObject,
    resolution: CreditAssessmentResolution
  ): JsonObject {
    return buildMortgageGatewayInputForResolution(input, resolution);
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

  private getHashSecret(): string | null {
    return (
      this.config.get<string>("CREDIT_ASSESSMENT_HASH_SECRET") ||
      this.config.get<string>("SUPABASE_SERVICE_ROLE_KEY") ||
      null
    );
  }

  private log(stage: string, status: string) {
    console.info("[credit-assessments]", { stage, status });
  }
}

export function hashCreditAssessmentId(
  assessmentId: string,
  secret: string
): string {
  return createHmac("sha256", secret).update(assessmentId).digest("hex");
}

export function buildCreditAssessmentRow(
  userId: string,
  response: JsonObject,
  hashSecret: string
): CreditAssessmentRow | null {
  const reportData = asObject(response.reportData);
  const creditAssessment = asObject(reportData.creditAssessment);
  const assessmentId = safeString(creditAssessment.assessmentId, 200);
  const expiresAt = safeTimestamp(creditAssessment.expiresAt);
  const handoff = sanitizeCreditMortgageHandoff(
    reportData.creditMortgageHandoff
  );

  if (!assessmentId || !expiresAt || !hasHandoffData(handoff)) return null;

  const providerStatus = pickAllowedScalars(reportData.providerStatus, [
    "provider",
    "bureau",
    "status",
    "environment",
    "verified",
    "dataClassification"
  ]);
  const verificationStatus = pickAllowedScalars(reportData.verificationStatus, [
    "status",
    "provider",
    "bureau",
    "providerStatus",
    "bureauDataVerified",
    "providerEnvironment",
    "durableAuthReady",
    "providedDataUsed"
  ]);

  return {
    assessment_id_hash: hashCreditAssessmentId(assessmentId, hashSecret),
    user_id: userId,
    status: "active",
    tool: "credit-profile",
    storage_version: "credit-assessment-v1",
    provider_choice: safeString(providerStatus.provider, 100),
    provider_status: providerStatus,
    verification_status: verificationStatus,
    consent_status: {},
    credit_mortgage_handoff: handoff,
    readiness_score:
      safeNumber(handoff.readinessScore) ?? safeNumber(response.score),
    risk_level: safeString(response.riskLevel, 100),
    result_type: safeString(response.resultType, 100),
    expires_at: expiresAt
  };
}

export function buildMortgageGatewayInputForResolution(
  input: JsonObject,
  resolution: CreditAssessmentResolution
): JsonObject {
  const { creditAssessmentId, ...baseInput } = input;

  if (resolution.status === "resolved") {
    return compact({
      ...baseInput,
      creditMortgageHandoff: resolution.creditMortgageHandoff,
      creditMortgageHandoffTrust: "api_resolved_trusted",
      creditAssessment: {
        status: "resolved",
        sourceTrust: "api_resolved_trusted",
        expiresAt: resolution.expiresAt
      }
    });
  }

  if (resolution.status === "not_found_or_expired") {
    return compact({
      ...baseInput,
      creditAssessment: {
        status: "not_found_or_expired",
        sourceTrust: "none",
        warning: "credit_assessment_not_found_or_expired"
      }
    });
  }

  return baseInput;
}

function markCreditAssessmentPersisted(response: JsonObject): JsonObject {
  const reportData = asObject(response.reportData);
  const creditAssessment = asObject(reportData.creditAssessment);

  return {
    ...response,
    reportData: {
      ...reportData,
      creditAssessment: {
        ...creditAssessment,
        storageMode: "api_supabase",
        trustedServerSide: true,
        productionPersistenceRequired: false
      }
    }
  };
}

function hasHandoffData(value: JsonObject): boolean {
  return Object.values(value).some((item) => {
    if (item === null || item === undefined) return false;
    if (typeof item === "object") {
      return Object.values(item as JsonObject).some(
        (nested) => nested !== null && nested !== undefined
      );
    }
    return true;
  });
}

function pickAllowedScalars(value: unknown, keys: string[]): JsonObject {
  const source = asObject(value);
  const result: JsonObject = {};

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

function safeTimestamp(value: unknown): string | null {
  const text = safeString(value, 100);
  if (!text || Number.isNaN(Date.parse(text))) return null;
  return text;
}

function safeString(value: unknown, max = 1000): string | null {
  return typeof value === "string" && value.trim()
    ? value.trim().slice(0, max)
    : null;
}

function safeNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
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
