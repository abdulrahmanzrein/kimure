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
import { CreditConsentsService } from "./credit-consents.service";
import { UserFinancialProfilesService } from "./user-financial-profiles.service";

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
    private readonly creditAssessments: CreditAssessmentsService,
    private readonly creditConsents: CreditConsentsService,
    private readonly userFinancialProfiles: UserFinancialProfilesService
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
    const userId = request.user.id;

    // Credit data crosses the service boundary only after capability-specific
    // validation and allowlist normalization.
    if (tool === "credit-profile") {
      const normalizedInput = normalizeCreditProfileInput(input);
      if (
        normalizedInput.providerChoice !== "directional" &&
        normalizedInput.consent.hasBureauConsent
      ) {
        await this.runBestEffort(() =>
          this.creditConsents.persistConsent(userId, normalizedInput)
        );
      }
      const response = await this.gateway.execute(
        tool,
        normalizedInput,
        userId,
        request.headers.authorization
      );
      const persisted = await this.runBestEffortValue(
        () =>
          this.creditAssessments.persistCreditProfileResponse(
            userId,
            response
          ),
        { status: "failed", response }
      );
      await this.runBestEffort(() =>
        this.userFinancialProfiles.upsertFromCreditProfile(
          userId,
          normalizedInput,
          persisted.response
        )
      );
      return persisted.response;
    }

    if (tool === "mortgage") {
      const normalizedInput = normalizeMortgageInput(input);
      const resolution = await this.creditAssessments.resolveForMortgage(
        userId,
        normalizedInput.creditAssessmentId
      );
      const gatewayInput = this.creditAssessments.buildMortgageGatewayInput(
        normalizedInput,
        resolution
      );

      const response = await this.gateway.execute(
        tool,
        gatewayInput,
        userId,
        request.headers.authorization
      );
      await this.runBestEffort(() =>
        this.userFinancialProfiles.upsertFromMortgage(
          userId,
          normalizedInput,
          response
        )
      );
      return response;
    }

    return this.gateway.execute(
      tool,
      input,
      userId,
      request.headers.authorization
    );
  }

  private async runBestEffort(action: () => Promise<unknown>) {
    try {
      await action();
    } catch {
      // Persistence helpers are best-effort only. They log safe status metadata
      // themselves and must never block the user-facing AI response.
    }
  }

  private async runBestEffortValue<T>(
    action: () => Promise<T>,
    fallback: T
  ): Promise<T> {
    try {
      return await action();
    } catch {
      return fallback;
    }
  }
}
