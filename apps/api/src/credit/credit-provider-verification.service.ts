import {
  BadGatewayException,
  BadRequestException,
  GatewayTimeoutException,
  Injectable,
  ServiceUnavailableException
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { randomUUID } from "crypto";

export type ProviderVerificationBlockedReason =
  | "credit_consent_required"
  | "credit_permissible_purpose_required"
  | "sandbox_identity_required";

export interface ProviderVerificationResponse {
  status: string;
  provider: "equifax";
  environment: string;
  verified: boolean;
  providerStatus: string;
  transactionId: string | null;
  scoreSummary?: unknown;
  debtSummary?: unknown;
  riskFlags?: unknown;
  blockedReason: string | null;
  sandboxVerificationReady: boolean;
  sandboxVerificationBlockedReason: string | null;
  safeToRunLiveCall: false;
}

@Injectable()
export class CreditProviderVerificationService {
  constructor(private readonly config: ConfigService) {}

  async runSandboxVerification(
    input: Record<string, unknown>,
    userId: string,
    authorization?: string
  ): Promise<ProviderVerificationResponse> {
    const safeInput = asRecord(input);
    const validation = validateSandboxVerificationInput(safeInput);
    if (!validation.ok) {
      return blockedApiResponse(validation.blockedReason);
    }

    const baseUrl = this.config.get<string>("AI_GATEWAY_BASE_URL");
    if (!baseUrl) {
      throw new ServiceUnavailableException("AI Gateway is not configured");
    }

    const requestId = randomUUID();
    const controller = new AbortController();
    const timeoutMs = this.config.get<number>("AI_GATEWAY_TIMEOUT_MS", 30000);
    const timeout = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch(
        `${baseUrl.replace(/\/$/, "")}/ai/equifax-sandbox-verification`,
        {
          method: "POST",
          headers: this.buildHeaders(requestId, authorization),
          body: JSON.stringify({
            requestId,
            capability: "equifax-sandbox-verification",
            user: { id: userId },
            input: buildGatewayVerificationInput(safeInput)
          }),
          signal: controller.signal
        }
      );
      const body = await this.readResponse(response);

      if (!response.ok) {
        throw new BadGatewayException({
          message: "AI Gateway rejected the provider verification request",
          requestId,
          upstreamStatus: response.status
        });
      }

      return shapeProviderVerificationResponse(body);
    } catch (error) {
      if (error instanceof BadGatewayException) throw error;
      if (
        typeof error === "object" &&
        error !== null &&
        "name" in error &&
        error.name === "AbortError"
      ) {
        throw new GatewayTimeoutException({
          message: "AI Gateway timed out",
          requestId
        });
      }

      throw new BadGatewayException({
        message: "AI Gateway could not be reached",
        requestId
      });
    } finally {
      clearTimeout(timeout);
    }
  }

  private buildHeaders(
    requestId: string,
    authorization?: string
  ): Record<string, string> {
    const headers: Record<string, string> = {
      "content-type": "application/json",
      "x-request-id": requestId
    };
    const gatewayKey = this.config.get<string>("AI_GATEWAY_API_KEY");

    if (authorization) headers.authorization = authorization;
    if (gatewayKey) headers["x-api-key"] = gatewayKey;

    return headers;
  }

  private async readResponse(response: Response): Promise<unknown> {
    const contentType = response.headers.get("content-type") || "";
    if (contentType.includes("application/json")) return response.json();
    return { message: await response.text() };
  }
}

export function validateSandboxVerificationInput(input: Record<string, unknown>) {
  const consent = asRecord(input.consent);
  const consentProvided =
    input.consent === true ||
    input.consentGiven === true ||
    input.creditConsent === true ||
    input.bureauConsent === true ||
    consent.provided === true ||
    consent.consentGiven === true ||
    consent.creditConsent === true ||
    consent.bureauConsent === true;

  if (!consentProvided) return invalid("credit_consent_required");
  if (!getPermissiblePurposeCode(input)) {
    return invalid("credit_permissible_purpose_required");
  }
  if (!hasSandboxIdentityMarker(input)) return invalid("sandbox_identity_required");
  if (containsSocialNumberLikeInput(input)) {
    throw new BadRequestException({
      errorCode: "sandbox_identity_required",
      message: "Sandbox verification does not accept SIN, SSN, or social number input"
    });
  }

  return { ok: true as const, blockedReason: null };
}

export function buildGatewayVerificationInput(input: Record<string, unknown>) {
  const consent = asRecord(input.consent);

  return {
    consent: {
      provided: true,
      permissiblePurposeCode: getPermissiblePurposeCode(input)
    },
    permissiblePurposeCode: getPermissiblePurposeCode(input),
    sandboxIdentity: true,
    sandboxIdentityMarker: "equifax_sandbox_test_identity"
  };
}

export function shapeProviderVerificationResponse(
  response: unknown
): ProviderVerificationResponse {
  const body = asRecord(response);

  return {
    status: safeString(body.status) || "blocked",
    provider: "equifax",
    environment: safeString(body.environment) || "sandbox",
    verified: body.verified === true,
    providerStatus: safeString(body.providerStatus) || "blocked",
    transactionId: safeString(body.transactionId),
    scoreSummary: safeObject(body.scoreSummary),
    debtSummary: safeObject(body.debtSummary),
    riskFlags: safeObject(body.riskFlags),
    blockedReason: safeString(body.blockedReason),
    sandboxVerificationReady: body.sandboxVerificationReady === true,
    sandboxVerificationBlockedReason: safeString(
      body.sandboxVerificationBlockedReason
    ),
    safeToRunLiveCall: false
  };
}

function blockedApiResponse(
  blockedReason: ProviderVerificationBlockedReason
): ProviderVerificationResponse {
  return {
    status: "blocked",
    provider: "equifax",
    environment: "sandbox",
    verified: false,
    providerStatus: "blocked",
    transactionId: null,
    blockedReason,
    sandboxVerificationReady: false,
    sandboxVerificationBlockedReason: blockedReason,
    safeToRunLiveCall: false
  };
}

function invalid(blockedReason: ProviderVerificationBlockedReason) {
  return { ok: false as const, blockedReason };
}

function getPermissiblePurposeCode(input: Record<string, unknown>) {
  const consent = asRecord(input.consent);
  return safeString(
    input.permissiblePurposeCode ||
      consent.permissiblePurposeCode ||
      consent.purposeCode
  );
}

function hasSandboxIdentityMarker(input: Record<string, unknown>) {
  return (
    input.sandboxIdentity === true ||
    input.sandboxTestIdentity === true ||
    input.sandboxIdentityMarker === "equifax_sandbox_test_identity" ||
    input.testIdentityMarker === "equifax_sandbox_test_identity"
  );
}

function containsSocialNumberLikeInput(value: unknown): boolean {
  if (!value || typeof value !== "object") return false;
  if (Array.isArray(value)) return value.some(containsSocialNumberLikeInput);

  return Object.entries(value as Record<string, unknown>).some(
    ([key, nestedValue]) => {
      if (/ssn|sin|social/i.test(key)) return true;
      if (
        typeof nestedValue === "string" &&
        /\b\d{3}-?\d{2}-?\d{4}\b/.test(nestedValue)
      ) {
        return true;
      }
      return containsSocialNumberLikeInput(nestedValue);
    }
  );
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function safeString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function safeObject(value: unknown): unknown {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;

  return Object.entries(value as Record<string, unknown>).reduce(
    (result, [key, nestedValue]) => {
      if (isForbiddenKey(key)) return result;
      if (nestedValue && typeof nestedValue === "object") {
        const nested = safeObject(nestedValue);
        if (nested !== null) result[key] = nested;
        return result;
      }
      if (["string", "number", "boolean"].includes(typeof nestedValue)) {
        result[key] = nestedValue;
      }
      return result;
    },
    {} as Record<string, unknown>
  );
}

function isForbiddenKey(key: string): boolean {
  return /token|authorization|secret|password|sourceResponse|contentBase64|raw|providerDiagnostics|stack|request|response|tradeline|trade|pdf|identity|address|sin|ssn|social/i.test(
    key
  );
}
