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

@Injectable()
export class AiGatewayService {
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
        throw new BadGatewayException({
          message: "AI Gateway rejected the request",
          requestId,
          upstreamStatus: response.status,
          ...(isCreditProfile
            ? { errorCode: getSafeGatewayErrorCode(body) }
            : { upstreamResponse: body })
        });
      }

      if (isCreditProfile) {
        return shapeCreditProfileResponse(body);
      }

      return body;
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
    if (contentType.includes("application/json")) {
      return response.json();
    }

    return { message: await response.text() };
  }
}
