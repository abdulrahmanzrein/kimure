import { Controller, Get, Req, UseGuards } from "@nestjs/common";
import {
  AuthenticatedRequest,
  SupabaseAuthGuard
} from "../auth/supabase-auth.guard";
import { DashboardService } from "./dashboard.service";

@Controller("dashboard")
@UseGuards(SupabaseAuthGuard)
export class DashboardController {
  constructor(private readonly dashboard: DashboardService) {}

  // GET /api/dashboard/ai-credit
  // Returns sanitized account, AI, credit, and mortgage summary data for the
  // authenticated user's future dashboard page.
  @Get("ai-credit")
  async getAiCreditDashboard(@Req() request: AuthenticatedRequest) {
    const userId = request.user!.id;
    return this.dashboard.getAiCreditDashboard(userId);
  }
}
