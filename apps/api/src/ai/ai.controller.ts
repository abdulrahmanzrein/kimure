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
import { CreditAssessmentsService } from "./credit-assessments.service";

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
  constructor(
    private readonly gateway: AiGatewayService,
    private readonly creditAssessments: CreditAssessmentsService
  ) {}

  // This one method handles POST /api/ai/chat, /scout, /mortgage, and the
  // other names in allowedTools.
  @Post(":tool")
  async runTool(
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
    if (tool === "credit-profile") {
      const normalizedInput = normalizeCreditProfileInput(input);
      const response = await this.gateway.execute(
        tool,
        normalizedInput,
        request.user.id,
        request.headers.authorization
      );
      const persisted =
        await this.creditAssessments.persistCreditProfileResponse(
          request.user.id,
          response
        );
      return persisted.response;
    }

    if (tool === "mortgage") {
      const normalizedInput = normalizeMortgageInput(input);
      const resolution = await this.creditAssessments.resolveForMortgage(
        request.user.id,
        normalizedInput.creditAssessmentId
      );
      const gatewayInput = this.creditAssessments.buildMortgageGatewayInput(
        normalizedInput,
        resolution
      );

      return this.gateway.execute(
        tool,
        gatewayInput,
        request.user.id,
        request.headers.authorization
      );
    }

    return this.gateway.execute(
      tool,
      input,
      request.user.id,
      request.headers.authorization
    );
  }
}
