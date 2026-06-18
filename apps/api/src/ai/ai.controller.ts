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

    if (tool === "credit-profile" && input.consent !== true) {
      throw new BadRequestException(
        "consent must be true before requesting a credit profile"
      );
    }

    if (!request.user) {
      throw new BadRequestException("Authenticated user is missing");
    }

    return this.gateway.execute(
      tool,
      input,
      request.user.id,
      request.headers.authorization
    );
  }
}
