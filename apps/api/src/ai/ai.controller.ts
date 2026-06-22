import {
  BadRequestException,
  Body,
  Controller,
  Param,
  Post,
  Req,
  UseGuards
} from "@nestjs/common";
import {
  AuthenticatedRequest,
  SupabaseAuthGuard
} from "../auth/supabase-auth.guard";
import { AiGatewayService } from "./ai-gateway.service";
import {
  normalizeCreditProfileInput,
  normalizeMortgageInput
} from "./credit-ai.contract";

const allowedTools = [
  "chat",
  "scout",
  "analyze",
  "rental",
  "valuate",
  "mortgage",
  "credit-profile",
  "investment-planner"
] as const;

@Controller("ai")
@UseGuards(SupabaseAuthGuard)
export class AiController {
  constructor(private readonly gateway: AiGatewayService) {}

  // This one method handles POST /api/ai/chat, /scout, /mortgage, and the
  // other names in allowedTools.
  @Post(":tool")
  runTool(
    @Param("tool") tool: string,
    @Body() input: Record<string, unknown>,
    @Req() request: AuthenticatedRequest
  ) {
    if (!allowedTools.includes(tool as (typeof allowedTools)[number])) {
      throw new BadRequestException(`Unknown AI tool: ${tool}`);
    }

    if (!request.user) {
      throw new BadRequestException("Authenticated user is missing");
    }

    // Credit data crosses the service boundary only after capability-specific
    // validation and allowlist normalization.
    const normalizedInput =
      tool === "credit-profile"
        ? normalizeCreditProfileInput(input)
        : tool === "mortgage"
          ? normalizeMortgageInput(input)
          : input;

    return this.gateway.execute(
      tool,
      normalizedInput,
      request.user.id,
      request.headers.authorization
    );
  }
}
