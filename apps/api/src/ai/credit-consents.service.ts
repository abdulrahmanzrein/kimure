import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { createHash } from "crypto";
import { NormalizedCreditProfileInput } from "./credit-ai.contract";

type JsonObject = Record<string, unknown>;
type PersistenceStatus = "stored" | "skipped" | "failed";
type SupabaseWriter = Pick<SupabaseClient, "from">;

export interface CreditConsentPersistenceOptions {
  source?: string;
  expiresAt?: string;
  consentTextHash?: string;
}

export interface CreditConsentPersistenceResult {
  status: PersistenceStatus;
}

export interface CreditConsentRow {
  user_id: string;
  provider_choice: string;
  provider: string;
  bureau: string;
  permissible_purpose: string;
  consent_version: string;
  consent_text_hash: string;
  status: "active";
  consented_at: string;
  expires_at: string;
  source: string;
}

@Injectable()
export class CreditConsentsService {
  private client?: SupabaseWriter;

  constructor(
    private readonly config: ConfigService,
    client?: SupabaseWriter
  ) {
    this.client = client;
  }

  // Persist only explicit provider/bureau consent metadata. This never stores
  // SIN, DOB, address, identity, provider request/response bodies, or tokens.
  async persistConsent(
    userId: string,
    normalizedCreditRequest: NormalizedCreditProfileInput,
    options: CreditConsentPersistenceOptions = {}
  ): Promise<CreditConsentPersistenceResult> {
    const target = resolveCreditProviderTarget(
      normalizedCreditRequest.providerChoice
    );
    const row = buildCreditConsentRow(userId, normalizedCreditRequest, options);

    if (!row) {
      this.log("credit_consent_persist", "skipped", target);
      return { status: "skipped" };
    }

    const client = this.getServiceClient();
    if (!client) {
      this.log("credit_consent_persist", "skipped", target);
      return { status: "skipped" };
    }

    try {
      const { error } = await client.from("credit_consents").insert(row);
      if (error) {
        this.log("credit_consent_persist", "failed", target);
        return { status: "failed" };
      }

      this.log("credit_consent_persist", "stored", target);
      return { status: "stored" };
    } catch {
      this.log("credit_consent_persist", "failed", target);
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

  private log(
    stage: string,
    status: PersistenceStatus,
    target: CreditProviderTarget
  ) {
    console.info("[credit-consents]", {
      stage,
      status,
      provider: target.provider,
      bureau: target.bureau
    });
  }
}

export interface CreditProviderTarget {
  provider: string;
  bureau: string;
}

export function resolveCreditProviderTarget(
  providerChoice: string
): CreditProviderTarget {
  if (providerChoice === "equifax_oneview") {
    return { provider: "equifax", bureau: "equifax" };
  }

  if (providerChoice === "thirdstream_equifax") {
    return { provider: "thirdstream", bureau: "equifax" };
  }

  if (providerChoice === "thirdstream_transunion") {
    return { provider: "thirdstream", bureau: "transunion" };
  }

  if (providerChoice === "auto") {
    return { provider: "auto", bureau: "auto" };
  }

  return { provider: providerChoice || "directional", bureau: "none" };
}

export function buildCreditConsentRow(
  userId: string,
  normalizedCreditRequest: NormalizedCreditProfileInput,
  options: CreditConsentPersistenceOptions = {}
): CreditConsentRow | null {
  const providerChoice = normalizedCreditRequest.providerChoice;
  const consent = asObject(normalizedCreditRequest.consent);
  const providerMode = providerChoice !== "directional";
  const hasBureauConsent = consent.hasBureauConsent === true;

  if (!providerMode || !hasBureauConsent) return null;

  const permissiblePurpose = safeString(consent.permissiblePurpose, 200);
  if (!permissiblePurpose) return null;

  const target = resolveCreditProviderTarget(providerChoice);
  const source = safeString(options.source, 100) || "credit-profile";
  const consentVersion =
    safeString(consent.consentVersion, 100) || "kimure-credit-consent-v1";
  const consentedAt =
    safeTimestamp(consent.consentTimestamp) || new Date().toISOString();
  const expiresAt = safeFutureTimestamp(options.expiresAt, consentedAt);
  const consentTextHash =
    safeString(options.consentTextHash, 128) ||
    hashConsentText({
      providerChoice,
      provider: target.provider,
      bureau: target.bureau,
      permissiblePurpose,
      consentVersion,
      source
    });

  return {
    user_id: userId,
    provider_choice: providerChoice,
    provider: target.provider,
    bureau: target.bureau,
    permissible_purpose: permissiblePurpose,
    consent_version: consentVersion,
    consent_text_hash: consentTextHash,
    status: "active",
    consented_at: consentedAt,
    expires_at: expiresAt,
    source
  };
}

export function hashConsentText(value: JsonObject): string {
  return createHash("sha256")
    .update(JSON.stringify(value))
    .digest("hex");
}

function safeFutureTimestamp(value: unknown, baseTimestamp: string): string {
  const provided = safeTimestamp(value);
  const baseMs = Date.parse(baseTimestamp);
  if (provided && Date.parse(provided) > baseMs) return provided;

  const oneYearMs = 365 * 24 * 60 * 60 * 1000;
  return new Date(baseMs + oneYearMs).toISOString();
}

function safeTimestamp(value: unknown): string | null {
  const text = safeString(value, 100);
  if (!text || Number.isNaN(Date.parse(text))) return null;
  return new Date(text).toISOString();
}

function safeString(value: unknown, max = 1000): string | null {
  return typeof value === "string" && value.trim()
    ? value.trim().slice(0, max)
    : null;
}

function asObject(value: unknown): JsonObject {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as JsonObject)
    : {};
}
