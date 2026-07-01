import { Body, Controller, Get, Param, Patch, Post, Req, UseGuards } from "@nestjs/common";
import { AuthenticatedRequest, SupabaseAuthGuard } from "../auth/supabase-auth.guard";
import { PartnerInput, PartnersService } from "./partners.service";

@Controller("partners")
@UseGuards(SupabaseAuthGuard)
export class PartnersController {
  constructor(private readonly partners: PartnersService) {}

  // GET /api/partners/me — the current partner's business profile row.
  @Get("me")
  async getMe(@Req() request: AuthenticatedRequest) {
    const userId = request.user!.id;
    const token = request.headers.authorization!.replace("Bearer ", "");
    return this.partners.getMe(userId, token);
  }

  // POST /api/partners/me — create or update the current partner's business
  // profile. Called from the partner-setup form.
  @Post("me")
  async createOrUpdate(
    @Body() body: PartnerInput,
    @Req() request: AuthenticatedRequest
  ) {
    const userId = request.user!.id;
    const token = request.headers.authorization!.replace("Bearer ", "");
    return this.partners.createOrUpdate(userId, token, body);
  }

  // GET /api/partners/me/leads — leads assigned to this partner.
  @Get("me/leads")
  async getLeads(@Req() request: AuthenticatedRequest) {
    const userId = request.user!.id;
    const token = request.headers.authorization!.replace("Bearer ", "");
    return this.partners.getAssignedLeads(userId, token);
  }

  // PATCH /api/partners/me/leads/:id/status — move a lead through the pipeline.
  @Patch("me/leads/:id/status")
  async updateLeadStatus(
    @Param("id") leadId: string,
    @Body() body: { status: string },
    @Req() request: AuthenticatedRequest
  ) {
    const userId = request.user!.id;
    const token = request.headers.authorization!.replace("Bearer ", "");
    return this.partners.updateLeadStatus(userId, token, leadId, body.status);
  }
}
