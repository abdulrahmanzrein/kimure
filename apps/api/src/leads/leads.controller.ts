import { Body, Controller, Get, Post, Req, UseGuards } from "@nestjs/common";
import { AuthenticatedRequest, SupabaseAuthGuard } from "../auth/supabase-auth.guard";
import { LeadsService } from "./leads.service";

@Controller("leads")
@UseGuards(SupabaseAuthGuard)
export class LeadsController {
  constructor(private readonly leads: LeadsService) {}

  // GET /api/leads
  @Get()
  async getLeads(@Req() request: AuthenticatedRequest) {
    const userId = request.user!.id;
    const token = request.headers.authorization!.replace("Bearer ", "");
    return this.leads.getLeads(userId, token);
  }

  // POST /api/leads — body: { listing_id?: "any-string", intent_data?: {} }
  @Post()
  async createLead(
    @Body() body: { listing_id?: string; intent_data?: Record<string, unknown> },
    @Req() request: AuthenticatedRequest
  ) {
    const userId = request.user!.id;
    const token = request.headers.authorization!.replace("Bearer ", "");
    return this.leads.createLead(
      userId,
      token,
      body.listing_id || null,
      body.intent_data || {}
    );
  }
}
