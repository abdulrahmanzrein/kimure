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
import {
  AiInsightsService,
  DashboardAiInsightOptions
} from "../ai-insights";

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
    private readonly aiInsights: AiInsightsService
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
      await this.persistDashboardInsight(
        request.user.id,
        persisted.response,
        getDashboardInsightOptionsForAiTool(tool, normalizedInput)
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

      const response = await this.gateway.execute(
        tool,
        gatewayInput,
        request.user.id,
        request.headers.authorization
      );
      await this.persistDashboardInsight(
        request.user.id,
        response,
        getDashboardInsightOptionsForAiTool(tool, gatewayInput)
      );
      return response;
    }

    const response = await this.gateway.execute(
      tool,
      input,
      request.user.id,
      request.headers.authorization
    );
    await this.persistDashboardInsight(
      request.user.id,
      response,
      getDashboardInsightOptionsForAiTool(tool, input)
    );
    return response;
  }

  private async persistDashboardInsight(
    userId: string,
    response: unknown,
    options: DashboardAiInsightOptions | null
  ) {
    if (!options) return;
    await this.aiInsights.persistDashboardInsight(userId, response, options);
  }
}

export function getDashboardInsightOptionsForAiTool(
  tool: string,
  input: Record<string, unknown>
): DashboardAiInsightOptions | null {
  if (tool === "credit-profile") {
    return {
      insightType: "credit_readiness",
      tool,
      title: "Credit Readiness Summary"
    };
  }

  if (tool === "mortgage") {
    return {
      insightType: "mortgage_estimate",
      tool,
      title: "Mortgage Estimate Summary"
    };
  }

  if (isMarketplaceAiTool(tool)) {
    return {
      insightType: "marketplace_tool",
      tool,
      title: getMarketplaceInsightTitle(tool)
    };
  }

  if (tool === "chat" && isSmartOnboardingRequest(input)) {
    return {
      insightType: "onboarding_recommendation",
      tool,
      title: "Smart Onboarding Recommendation"
    };
  }

  return null;
}

function isMarketplaceAiTool(tool: string): boolean {
  return [
    "scout",
    "analyze",
    "rental",
    "valuate",
    "investment-planner"
  ].includes(tool);
}

function getMarketplaceInsightTitle(tool: string): string {
  const titles: Record<string, string> = {
    scout: "Property Scout Insight",
    analyze: "Property Analysis Insight",
    rental: "Rental Finder Insight",
    valuate: "Property Valuation Insight",
    "investment-planner": "Investment Planner Insight"
  };

  return titles[tool] || "Marketplace AI Insight";
}

function isSmartOnboardingRequest(input: Record<string, unknown>): boolean {
  const metadata = asObject(input.metadata);
  const context = asObject(input.context);
  const markers = [
    input.context,
    input.source,
    input.flow,
    input.intent,
    metadata.context,
    metadata.source,
    metadata.flow,
    context.context,
    context.source,
    context.flow
  ];

  return markers.some((marker) => {
    if (typeof marker !== "string") return false;
    const normalized = marker.trim().toLowerCase().replace(/[-\s]+/g, "_");
    return normalized === "smart_onboarding";
  });
}

function asObject(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}
