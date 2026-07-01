import {
  BadGatewayException,
  GatewayTimeoutException,
  Injectable,
  ServiceUnavailableException
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { randomUUID } from "crypto";
import {
  getSafeGatewayErrorCode,
  shapeCreditProfileResponse
} from "./credit-ai.contract";

@Injectable()
export class AiGatewayService {
  private serviceClient?: SupabaseClient;

  constructor(private readonly config: ConfigService) {}

  async execute(
    tool: string,
    input: Record<string, unknown>,
    userId: string,
    authorization?: string
  ): Promise<unknown> {
    const requestId = randomUUID();
    const isCreditProfile = tool === "credit-profile";
    const baseUrl = this.config.get<string>("AI_GATEWAY_BASE_URL");
    if (!baseUrl) {
      throw new ServiceUnavailableException("AI Gateway is not configured");
    }

    const requestBody = {
      requestId,
      capability: tool,
      user: { id: userId },
      input
    };
    const controller = new AbortController();
    const timeoutMs = this.config.get<number>("AI_GATEWAY_TIMEOUT_MS", 30000);
    const timeout = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch(
        `${baseUrl.replace(/\/$/, "")}/ai/${tool}`,
        {
          method: "POST",
          headers: this.buildHeaders(requestId, authorization),
          body: JSON.stringify(requestBody),
          signal: controller.signal
        }
      );
      const body = await this.readResponse(response);

      if (!response.ok) {
        this.logRequest(userId, tool, input, body, "failed", `Upstream ${response.status}`);
        throw new BadGatewayException({
          message: "AI Gateway rejected the request",
          requestId,
          upstreamStatus: response.status,
          ...(isCreditProfile
            ? { errorCode: getSafeGatewayErrorCode(body) }
            : { upstreamResponse: body })
        });
      }

      const shaped = isCreditProfile ? shapeCreditProfileResponse(body) : body;
      this.logRequest(userId, tool, input, shaped, "success", null);
      return shaped;
    } catch (error) {
      if (error instanceof BadGatewayException) throw error;
      if (
        typeof error === "object" &&
        error !== null &&
        "name" in error &&
        error.name === "AbortError"
      ) {
        this.logRequest(userId, tool, input, null, "failed", "Gateway timed out");
        throw new GatewayTimeoutException({
          message: "AI Gateway timed out",
          requestId
        });
      }

      this.logRequest(userId, tool, input, null, "failed", "Gateway could not be reached");
      throw new BadGatewayException({
        message: "AI Gateway could not be reached",
        requestId
      });
    } finally {
      clearTimeout(timeout);
    }
  }

  // Best-effort insert into ai_requests. Failures here are swallowed so they
  // never break the user-facing AI response. Uses service role because we log
  // every request regardless of RLS.
  private logRequest(
    userId: string,
    tool: string,
    requestPayload: unknown,
    responsePayload: unknown,
    status: "success" | "failed",
    errorMessage: string | null
  ): void {
    const client = this.getServiceClient();
    if (!client) return;

    // For credit-profile we skip storing raw payloads — the input contains
    // sensitive financial data that shouldn't sit in the audit log.
    const isCreditProfile = tool === "credit-profile";
    const row = {
      user_id: userId,
      engine: tool,
      request_payload: isCreditProfile ? { redacted: "credit_profile_input" } : requestPayload,
      response_payload: isCreditProfile ? { redacted: "credit_profile_output" } : responsePayload,
      status,
      error_message: errorMessage
    };

    client
      .from("ai_requests")
      .insert(row)
      .then(() => { /* noop */ })
      .then(null, () => { /* swallow — logging must not break the response */ });
  }

  private getServiceClient(): SupabaseClient | null {
    if (this.serviceClient) return this.serviceClient;
    const url = this.config.get<string>("SUPABASE_URL");
    const serviceRoleKey = this.config.get<string>("SUPABASE_SERVICE_ROLE_KEY");
    if (!url || !serviceRoleKey) return null;
    this.serviceClient = createClient(url, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false }
    });
    return this.serviceClient;
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
    if (contentType.includes("application/json")) {
      return response.json();
    }

    return { message: await response.text() };
  }
}
