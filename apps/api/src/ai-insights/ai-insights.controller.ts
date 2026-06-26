import {
  BadRequestException,
  Controller,
  Get,
  Query,
  Req,
  UseGuards
} from "@nestjs/common";
import {
  AuthenticatedRequest,
  SupabaseAuthGuard
} from "../auth/supabase-auth.guard";
import {
  AiInsightsService,
  isDashboardInsightType
} from "./ai-insights.service";

@Controller("ai/insights")
@UseGuards(SupabaseAuthGuard)
export class AiInsightsController {
  constructor(private readonly aiInsights: AiInsightsService) {}

  // GET /api/ai/insights/dashboard
  // Returns the latest sanitized AI report cards for dashboard widgets.
  @Get("dashboard")
  async getDashboard(@Req() request: AuthenticatedRequest) {
    const userId = request.user!.id;
    const token = request.headers.authorization!.replace("Bearer ", "");

    return this.aiInsights.getDashboardInsights(userId, token);
  }

  // GET /api/ai/insights/latest?type=credit_readiness
  // Returns the latest sanitized AI report card for one supported report type.
  @Get("latest")
  async getLatest(
    @Query("type") type: string,
    @Req() request: AuthenticatedRequest
  ) {
    if (!isDashboardInsightType(type)) {
      throw new BadRequestException("Unsupported AI insight type");
    }

    const userId = request.user!.id;
    const token = request.headers.authorization!.replace("Bearer ", "");

    return this.aiInsights.getLatestInsight(userId, token, type);
  }
}
