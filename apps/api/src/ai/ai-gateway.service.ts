import {
  BadGatewayException,
  GatewayTimeoutException,
  Injectable,
  ServiceUnavailableException
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { randomUUID } from "crypto";
import {
  getSafeGatewayErrorCode,
  shapeCreditProfileResponse
} from "./credit-ai.contract";
import { AiRequestsService } from "./ai-requests.service";

@Injectable()
export class AiGatewayService {
  constructor(
    private readonly config: ConfigService,
    private readonly aiRequests: AiRequestsService
  ) {}

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
        // Log the rejected call (it has a response body) before surfacing it.
        await this.aiRequests.log({
          userId,
          engine: tool,
          requestPayload: input,
          responsePayload: body,
          status: "error",
          errorMessage: `AI Gateway responded ${response.status}`
        });

        throw new BadGatewayException({
          message: "AI Gateway rejected the request",
          requestId,
          upstreamStatus: response.status,
          ...(isCreditProfile
            ? { errorCode: getSafeGatewayErrorCode(body) }
            : { upstreamResponse: body })
        });
      }

      const result = isCreditProfile
        ? shapeCreditProfileResponse(body)
        : body;

      // Log the successful call.
      await this.aiRequests.log({
        userId,
        engine: tool,
        requestPayload: input,
        responsePayload: body,
        status: "success"
      });

      return result;
    } catch (error) {
      // Gateway rejections were already logged above; just re-throw them.
      if (error instanceof BadGatewayException) throw error;

      const isTimeout =
        typeof error === "object" &&
        error !== null &&
        "name" in error &&
        error.name === "AbortError";
      const errorMessage = isTimeout
        ? "AI Gateway timed out"
        : "AI Gateway could not be reached";

      // Log transport-level failures (timeout / unreachable) — no response body.
      await this.aiRequests.log({
        userId,
        engine: tool,
        requestPayload: input,
        responsePayload: null,
        status: "error",
        errorMessage
      });

      if (isTimeout) {
        throw new GatewayTimeoutException({ message: errorMessage, requestId });
      }

      throw new BadGatewayException({ message: errorMessage, requestId });
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
    if (contentType.includes("application/json")) {
      return response.json();
    }

    return { message: await response.text() };
  }
}
